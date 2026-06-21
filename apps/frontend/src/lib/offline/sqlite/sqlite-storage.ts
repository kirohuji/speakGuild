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
import { DB_NAME, DB_VERSION, ALL_DDL, INDEXES } from './schema'
import { createSqliteJsonStore } from './sqlite-json-store'

let dbPromise: Promise<SQLiteDBConnection> | null = null
let sqliteConnection: SQLiteConnection | null = null

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isConnectionAlreadyExistsError(error: unknown): boolean {
  return errorText(error).includes('already exists')
}

function isConnectionDoesNotExistError(error: unknown): boolean {
  const message = errorText(error).toLowerCase()
  return message.includes('does not exist') || message.includes('no available connection')
}

async function openConnection(db: SQLiteDBConnection): Promise<void> {
  try {
    await db.open()
  } catch (error) {
    const message = errorText(error).toLowerCase()
    if (!message.includes('already open')) throw error
  }
}

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

    // Check if a connection with our name already exists on the native side.
    const existing = await conn.isConnection(DB_NAME, false)
    if (existing.result) {
      try {
        const db = await conn.retrieveConnection(DB_NAME, false)
        await openConnection(db)
        await initializeSchema(db)
        return db
      } catch (error) {
        // Connection exists in native registry but the handle is dead
        // (typical in dev:host after background/foreground cycles).
        // Clean up native side AND JS side, then retry from scratch.
        console.warn('[sqlite-storage] retrieveConnection failed, restarting:', errorText(error))
        try { await conn.closeConnection(DB_NAME, false) } catch { /* ignore */ }
        resetConnectionState()
        return openDb()
      }
    }

    // No existing connection — create a fresh one.
    let db: SQLiteDBConnection
    try {
      db = await conn.createConnection(
        DB_NAME,
        false,    // encrypted
        'no-encryption',
        DB_VERSION,
        false,    // not readonly
      )
    } catch (error) {
      // "already exists" means a stale registration survived — clean up and retry.
      if (isConnectionAlreadyExistsError(error)) {
        console.warn('[sqlite-storage] createConnection failed (already exists), restarting:', errorText(error))
        try { await conn.closeConnection(DB_NAME, false) } catch { /* ignore */ }
        resetConnectionState()
        return openDb()
      }
      throw error
    }
    await openConnection(db)
    await initializeSchema(db)
    return db
  })().catch((error) => {
    dbPromise = null
    throw error
  })

  return dbPromise
}

function resetConnectionState() {
  dbPromise = null
  sqliteConnection = null
}

async function initializeSchema(db: SQLiteDBConnection): Promise<void> {
  await db.execute(ALL_DDL)
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
  try {
    const db = await ensureDb()
    const result = await db.query(sql, values)
    return (result.values ?? []) as T[]
  } catch (error) {
    if (!isConnectionDoesNotExistError(error)) throw error
    resetConnectionState()
    const db = await ensureDb()
    const result = await db.query(sql, values)
    return (result.values ?? []) as T[]
  }
}

/** Execute a write statement (INSERT/UPDATE/DELETE). */
async function run(sql: string, values: any[] = [], transaction = true): Promise<void> {
  try {
    const db = await ensureDb()
    await db.run(sql, values, transaction)
  } catch (error) {
    if (!isConnectionDoesNotExistError(error)) throw error
    resetConnectionState()
    const db = await ensureDb()
    await db.run(sql, values, transaction)
  }
}

async function execute(sql: string, transaction = true): Promise<void> {
  try {
    const db = await ensureDb()
    await db.execute(sql, transaction)
  } catch (error) {
    if (!isConnectionDoesNotExistError(error)) throw error
    resetConnectionState()
    const db = await ensureDb()
    await db.execute(sql, transaction)
  }
}

const jsonStore = createSqliteJsonStore({
  label: 'sqlite-storage',
  queryRows,
  run,
  execute,
})

export const sqliteStorage = {
  ...jsonStore,
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

  /** Drop cached connection handle. Next access will open a fresh one. */
  reset(): void {
    resetConnectionState()
  },

  isAvailable(): boolean {
    return Capacitor.isNativePlatform()
  },
}
