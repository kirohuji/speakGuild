/**
 * SQLite-based storage adapter for Native (Capacitor).
 *
 * Provides the same API surface as IndexedDB local-db,
 * so repositories can work identically on both platforms.
 *
 * Usage:
 *   import { sqliteStorage as localDb } from './sqlite-storage'
 *   // then use localDb.get / put / list / delete / clear just like before
 */
import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DB_NAME, DB_VERSION, TABLE_NAMES, ALL_DDL, INDEXES, type TableName } from './schema'

// Re-export TableName for consumers
export type { TableName }

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

let dbPromise: Promise<SQLiteDBConnection> | null = null
let sqliteConnection: SQLiteConnection | null = null

function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

function getSqliteConnection(): SQLiteConnection {
  if (!sqliteConnection) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite)
  }
  return sqliteConnection
}

async function openDb(): Promise<SQLiteDBConnection> {
  if (dbPromise) return dbPromise
  if (!isNative()) {
    // Fall back to IndexedDB on web — caller should import local-db.ts instead
    dbPromise = Promise.reject(new Error('[sqlite-storage] Not available on web — use local-db instead'))
    return dbPromise
  }

  dbPromise = (async () => {
    const conn = getSqliteConnection()

    // Check if database already exists
    const existsResult = await conn.isDatabase(DB_NAME)
    const exists = existsResult.result

    // Create or open the connection
    const db = await conn.createConnection(
      DB_NAME,
      false,    // encrypted
      'no-encryption',
      DB_VERSION,
      false,    // not readonly
    )
    await db.open()

    // Run migrations if the database is newly created or version upgraded
    const currentVersion = exists ? (await db.getVersion()).version : 0
    if (currentVersion < DB_VERSION) {
      await migrate(db, currentVersion)
    }

    return db
  })()

  return dbPromise
}

async function migrate(db: SQLiteDBConnection, _fromVersion: number): Promise<void> {
  // Create all tables (IF NOT EXISTS handles existing ones)
  await db.execute(ALL_DDL)

  // Create indexes
  for (const idx of INDEXES) {
    try { await db.execute(idx) } catch { /* index may already exist */ }
  }

  // Future: version-specific migrations go here
}

/** Ensure the database is open and ready. */
async function ensureDb(): Promise<SQLiteDBConnection> {
  if (!isNative()) {
    throw new Error('[sqlite-storage] SQLite is only available on Native platform. Use IndexedDB on Web.')
  }
  return openDb()
}

/**
 * Execute a raw SQL query and return rows as an array of objects.
 * For parameterized queries, use ? placeholders and pass values array.
 */
async function queryRows<T = JsonValue>(
  sql: string,
  values: any[] = [],
): Promise<T[]> {
  const db = await ensureDb()
  const result = await db.query(sql, values)
  if (!result.values || result.values.length === 0) return []

  // result.values[0] = column names, result.values[1..n] = data rows
  const cols = result.values[0] as string[]
  return result.values.slice(1).map((row: any[]) => {
    const obj: any = {}
    cols.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj as T
  })
}

/** Execute a write statement (INSERT/UPDATE/DELETE). */
async function execute(sql: string, values: any[] = []): Promise<void> {
  const db = await ensureDb()
  await db.run(sql, values)
}

// ══════════════════════════════════════════════════
// Public API — mirrors local-db.ts interface
// ══════════════════════════════════════════════════

export const sqliteStorage = {
  /** Get a single record by ID. Returns null if not found. */
  async get<T extends { id: string }>(storeName: TableName, id: string): Promise<T | null> {
    try {
      const rows = await queryRows<{ data: string }>(
        `SELECT data FROM "${storeName}" WHERE id = ?`,
        [id],
      )
      if (rows.length === 0) return null
      return JSON.parse(rows[0].data) as T
    } catch (error) {
      console.warn(`[sqlite-storage] get failed for ${storeName}:${id}`, error)
      return null
    }
  },

  /** Insert or update a record (upsert by id). */
  async put<T extends { id: string }>(storeName: TableName, value: T): Promise<void> {
    try {
      const json = JSON.stringify(value)
      await execute(
        `INSERT INTO "${storeName}" (id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        [value.id, json, new Date().toISOString()],
      )
    } catch (error) {
      console.warn(`[sqlite-storage] put failed for ${storeName}:${value.id}`, error)
      throw error
    }
  },

  /** Insert multiple records in a transaction. */
  async putMany<T extends { id: string }>(storeName: TableName, values: T[]): Promise<void> {
    if (values.length === 0) return
    try {
      const db = await ensureDb()
      // Build a batch of INSERT ... ON CONFLICT statements
      const statements = values.map((value) => {
        const json = JSON.stringify(value).replace(/'/g, "''")
        const now = new Date().toISOString()
        return `INSERT INTO "${storeName}" (id, data, updated_at) VALUES ('${value.id}', '${json}', '${now}') ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      })
      await db.execute(statements.join(';\n'))
    } catch (error) {
      console.warn(`[sqlite-storage] putMany failed for ${storeName}`, error)
      throw error
    }
  },

  /** Delete a record by ID. */
  async delete(storeName: TableName, id: string): Promise<void> {
    try {
      await execute(`DELETE FROM "${storeName}" WHERE id = ?`, [id])
    } catch (error) {
      console.warn(`[sqlite-storage] delete failed for ${storeName}:${id}`, error)
    }
  },

  /** List all records in a store. */
  async list<T extends { id: string }>(storeName: TableName): Promise<T[]> {
    try {
      const rows = await queryRows<{ data: string }>(
        `SELECT data FROM "${storeName}" ORDER BY updated_at DESC`,
      )
      return rows.map((row) => JSON.parse(row.data) as T)
    } catch (error) {
      console.warn(`[sqlite-storage] list failed for ${storeName}`, error)
      return []
    }
  },

  /** Count records in a store. */
  async count(storeName: TableName): Promise<number> {
    try {
      const rows = await queryRows<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM "${storeName}"`,
      )
      return rows[0]?.cnt ?? 0
    } catch {
      return 0
    }
  },

  /** Delete all records in a store. */
  async clear(storeName: TableName): Promise<void> {
    try {
      await execute(`DELETE FROM "${storeName}"`)
    } catch (error) {
      console.warn(`[sqlite-storage] clear failed for ${storeName}`, error)
    }
  },

  /**
   * Save a recording blob.
   * On Native, blob data is stored in Capacitor Filesystem;
   * SQLite only holds metadata (mimeType, sessionId, round, localPath).
   */
  async saveBlob(
    blob: Blob,
    meta?: { mimeType?: string; sessionId?: string; round?: number },
  ): Promise<string> {
    // Delegate to the existing asset-cache / filesystem approach.
    // For now, throw a descriptive error so callers know to use asset-cache.service.
    throw new Error(
      '[sqlite-storage] saveBlob not implemented — use asset-cache.service for file storage on Native',
    )
  },

  /** Get recording metadata (not the blob itself). */
  async getBlob(
    _id: string,
  ): Promise<{ blob: Blob; mimeType?: string; sessionId?: string; round?: number } | null> {
    throw new Error(
      '[sqlite-storage] getBlob not implemented — use asset-cache.service for file storage on Native',
    )
  },

  /** Delete a recording. */
  async deleteBlob(id: string): Promise<void> {
    // Delete metadata from SQLite + file from Filesystem
    await sqliteStorage.delete('recordings', id)
    // File cleanup would be handled by asset-cache.service
  },

  /** Close the database connection. Call on app suspend. */
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

  /** Check if SQLite is available on this platform. */
  isAvailable(): boolean {
    return isNative()
  },
}
