/**
 * Native SQLite storage adapter (Capacitor iOS/Android).
 *
 * Provides the same API surface as web-sqlite-storage.ts,
 * so repositories work identically on both platforms.
 *
 * This module requires @capacitor-community/sqlite and is loaded only
 * when unified-storage selects the native backend.
 */
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Capacitor } from '@capacitor/core'
import { DB_NAME, DB_VERSION, ALL_DDL, INDEXES, MIGRATIONS } from './schema'
import { createSqliteJsonStore } from './sqlite-json-store'

let dbPromise: Promise<SQLiteDBConnection> | null = null
let sqliteConnection: SQLiteConnection | null = null

function getSqliteConnection(): SQLiteConnection {
  if (!sqliteConnection) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite)
  }
  return sqliteConnection
}

async function openDb(): Promise<SQLiteDBConnection> {
  if (dbPromise) return dbPromise

  dbPromise = (async () => {
    const conn = getSqliteConnection()

    const existsResult = await conn.isDatabase(DB_NAME)
    const exists = existsResult.result

    const db = await conn.createConnection(
      DB_NAME,
      false,    // encrypted
      'no-encryption',
      DB_VERSION,
      false,    // not readonly
    )
    await db.open()

    const currentVersion = exists ? (await db.getVersion()).version : 0
    if (currentVersion < DB_VERSION) {
      await migrate(db, currentVersion)
    }

    return db
  })()

  return dbPromise
}

async function migrate(db: SQLiteDBConnection, _fromVersion: number): Promise<void> {
  await db.execute(ALL_DDL)
  for (const migration of MIGRATIONS) {
    try { await db.execute(migration) } catch { /* migration may already be applied */ }
  }
  for (const idx of INDEXES) {
    try { await db.execute(idx) } catch { /* index may already exist */ }
  }
}

/** Ensure the database is open and ready. */
async function ensureDb(): Promise<SQLiteDBConnection> {
  return openDb()
}

/**
 * Execute a raw SQL query and return rows as an array of objects.
 * For parameterized queries, use ? placeholders and pass values array.
 */
async function queryRows<T>(
  sql: string,
  values: any[] = [],
): Promise<T[]> {
  const db = await ensureDb()
  const result = await db.query(sql, values)
  return (result.values ?? []) as T[]
}

/** Execute a write statement (INSERT/UPDATE/DELETE). */
async function run(sql: string, values: any[] = [], transaction = true): Promise<void> {
  const db = await ensureDb()
  await db.run(sql, values, transaction)
}

async function execute(sql: string, transaction = true): Promise<void> {
  const db = await ensureDb()
  await db.execute(sql, transaction)
}

const jsonStore = createSqliteJsonStore({
  label: 'sqlite-storage',
  queryRows,
  run,
  execute,
})

export const sqliteStorage = {
  ...jsonStore,
  async saveBlob(
    blob: Blob,
    meta?: { mimeType?: string; sessionId?: string; round?: number },
  ): Promise<string> {
    const { Directory, Filesystem } = await import('@capacitor/filesystem')
    const id = Capacitor.isNativePlatform()
      ? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      : (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

    const ext = meta?.mimeType?.includes('ogg') ? 'ogg'
      : meta?.mimeType?.includes('mp4') ? 'mp4'
      : 'webm'
    const path = `recordings/${id}.${ext}`
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)

    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    })

    // Store metadata in SQLite
    await jsonStore.put('recordings', {
      id,
      localPath: path,
      mimeType: meta?.mimeType ?? blob.type,
      sessionId: meta?.sessionId ?? null,
      round: meta?.round ?? null,
      createdAt: new Date().toISOString(),
    } as any)

    return id
  },

  async getBlob(
    id: string,
  ): Promise<{ blob: Blob; mimeType?: string; sessionId?: string; round?: number } | null> {
    const { Directory, Filesystem } = await import('@capacitor/filesystem')

    const meta = await jsonStore.get<any>('recordings', id)
    if (!meta?.localPath) return null

    try {
      const result = await Filesystem.readFile({
        path: meta.localPath,
        directory: Directory.Data,
      })
      // result.data is a base64 string on Capacitor
      const base64 = typeof result.data === 'string' ? result.data : ''
      if (!base64) return null
      const binaryStr = atob(base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      return {
        blob: new Blob([bytes], { type: meta.mimeType ?? 'audio/webm' }),
        mimeType: meta.mimeType,
        sessionId: meta.sessionId,
        round: meta.round,
      }
    } catch {
      return null
    }
  },

  async deleteBlob(id: string): Promise<void> {
    const { Directory, Filesystem } = await import('@capacitor/filesystem')

    const meta = await jsonStore.get<any>('recordings', id)
    if (meta?.localPath) {
      try {
        await Filesystem.deleteFile({ path: meta.localPath, directory: Directory.Data })
      } catch { /* file may already be gone */ }
    }
    await jsonStore.delete('recordings', id)
  },

  // ── Lifecycle ──────────────────────────────────────────

  async close(): Promise<void> {
    if (dbPromise) {
      try {
        const db = await dbPromise
        await db.close()
        const conn = getSqliteConnection()
        await conn.closeConnection(DB_NAME, false)
      } catch {
        // ignore close errors
      }
      dbPromise = null
      sqliteConnection = null
    }
  },

  isAvailable(): boolean {
    return Capacitor.isNativePlatform()
  },
}

/** Convert ArrayBuffer to base64 string. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}
