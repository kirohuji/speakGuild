/**
 * Web SQLite storage adapter backed by @capacitor-community/sqlite + jeep-sqlite.
 *
 * Repositories use the same localDb API on Web and Native; the persistence
 * details stay inside the Capacitor SQLite plugin.
 */
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { defineCustomElements } from 'jeep-sqlite/loader'
import { DB_NAME, DB_VERSION, ALL_DDL, INDEXES } from './schema'
import { createSqliteJsonStore } from './sqlite-json-store'

const JEEP_SQLITE_TAG = 'jeep-sqlite'

let dbPromise: Promise<SQLiteDBConnection> | null = null
let sqliteConnection: SQLiteConnection | null = null
let webStorePromise: Promise<void> | null = null

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

async function ensureJeepSqliteElement(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('[web-sqlite] Window is not available')
  }

  defineCustomElements(window)
  await customElements.whenDefined(JEEP_SQLITE_TAG)

  let element = document.querySelector(JEEP_SQLITE_TAG) as HTMLElement | null
  if (!element) {
    element = document.createElement(JEEP_SQLITE_TAG)
    const jeepElement = element as any
    jeepElement.autoSave = true
    jeepElement.wasmPath = '/assets'
    element.setAttribute('autoSave', 'true')
    element.setAttribute('wasmPath', '/assets')
    const mountTarget = document.body ?? document.documentElement
    mountTarget.appendChild(element)
  }
}

async function ensureWebStore(): Promise<void> {
  if (webStorePromise) return webStorePromise

  webStorePromise = (async () => {
    await ensureJeepSqliteElement()
    await getSqliteConnection().initWebStore()
  })().catch((error) => {
    webStorePromise = null
    throw error
  })

  return webStorePromise
}

async function openDb(): Promise<SQLiteDBConnection> {
  if (dbPromise) return dbPromise

  dbPromise = (async () => {
    await ensureWebStore()
    const conn = getSqliteConnection()

    const existing = await conn.isConnection(DB_NAME, false)
    if (existing.result) {
      try {
        const db = await conn.retrieveConnection(DB_NAME, false)
        await openConnection(db)
        await initializeSchema(db)
        return db
      } catch (error) {
        console.warn('[web-sqlite] retrieveConnection failed, restarting:', errorText(error))
        try { await conn.closeConnection(DB_NAME, false) } catch { /* ignore */ }
        resetConnectionState()
        return openDb()
      }
    }

    let db: SQLiteDBConnection
    try {
      db = await conn.createConnection(
        DB_NAME,
        false,
        'no-encryption',
        DB_VERSION,
        false,
      )
    } catch (error) {
      if (isConnectionAlreadyExistsError(error)) {
        console.warn('[web-sqlite] createConnection failed (already exists), restarting:', errorText(error))
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
  webStorePromise = null
}

async function initializeSchema(db: SQLiteDBConnection): Promise<void> {
  await db.execute(ALL_DDL)
  for (const idx of INDEXES) {
    try { await db.execute(idx) } catch { /* index may already exist */ }
  }
  await getSqliteConnection().saveToStore(DB_NAME)
}

async function ensureDb(): Promise<SQLiteDBConnection> {
  return openDb()
}

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

async function saveToStore(): Promise<void> {
  await getSqliteConnection().saveToStore(DB_NAME)
}

const jsonStore = createSqliteJsonStore({
  label: 'web-sqlite',
  queryRows,
  run,
  execute,
  afterWrite: saveToStore,
})

export const webSqliteStorage = {
  ...jsonStore,
  async close(): Promise<void> {
    if (!dbPromise) return

    try {
      const db = await dbPromise
      await getSqliteConnection().saveToStore(DB_NAME)
      await db.close()
      await getSqliteConnection().closeConnection(DB_NAME, false)
    } catch {
      // ignore close errors
    } finally {
      dbPromise = null
      sqliteConnection = null
      webStorePromise = null
    }
  },

  isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof customElements !== 'undefined'
  },
}
