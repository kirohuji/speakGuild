/**
 * Unified offline storage — auto-selects SQLite backend by platform.
 *
 * ┌──────────────────────────────────────────────────────┐
 * │ Platform        │ Backend                            │
 * ├──────────────────┼────────────────────────────────────┤
 * │ iOS / Android   │ @capacitor-community/sqlite (native)│
 * │ Web (browser)   │ @capacitor-community/sqlite + jeep  │
 * └──────────────────┴────────────────────────────────────┘
 *
 * All backends expose the same `localDb` API used by repositories.
 *
 * Internal storage facade. Business code should use the repositories exported
 * from '@/lib/offline' instead of importing localDb directly.
 */
import type { TableName } from './sqlite/schema'
import { Capacitor } from '@capacitor/core'

// ── Storage interface (shared by all backends) ──────────

export interface ILocalDb {
  get<T>(storeName: TableName, id: string): Promise<T | null>
  put<T>(storeName: TableName, value: T & { id: string }): Promise<void>
  putMany<T>(storeName: TableName, values: (T & { id: string })[]): Promise<void>
  delete(storeName: TableName, id: string): Promise<void>
  list<T>(storeName: TableName): Promise<T[]>
  findByIndex<T>(storeName: TableName, columnName: string, value: string | number | null): Promise<T[]>
  count(storeName: TableName): Promise<number>
  clear(storeName: TableName): Promise<void>
  deleteWhere<T>(storeName: TableName, predicate: (value: T & { id: string }) => boolean): Promise<void>
  close(): Promise<void>
  /** Drop cached backend/connection. Next access re-initializes from scratch. */
  reset(): void
  isAvailable(): boolean
}

// ── Lazy backend initialization ────────────────────────

let backendPromise: Promise<ILocalDb> | null = null
let resolvedBackend: ILocalDb | null = null

async function initBackend(): Promise<ILocalDb> {
  if (resolvedBackend) return resolvedBackend

  if (Capacitor.isNativePlatform()) {
    // Native: use Capacitor SQLite plugin
    try {
      const { sqliteStorage } = await import('./sqlite/sqlite-storage')
      if (sqliteStorage.isAvailable()) {
        resolvedBackend = sqliteStorage as unknown as ILocalDb
        return resolvedBackend
      }
    } catch (error) {
      console.warn('[unified-storage] Native SQLite init failed:', error)
    }
  }

  // Web: use the Capacitor SQLite web adapter backed by jeep-sqlite.
  try {
    const { webSqliteStorage } = await import('./sqlite/web-sqlite-storage')
    if (webSqliteStorage.isAvailable()) {
      resolvedBackend = webSqliteStorage as unknown as ILocalDb
      return resolvedBackend
    }
  } catch (error) {
    console.warn('[unified-storage] Web SQLite init failed:', error)
  }

  throw new Error('[unified-storage] SQLite storage is unavailable')
}

async function getBackend(): Promise<ILocalDb> {
  if (resolvedBackend) return resolvedBackend
  if (!backendPromise) {
    backendPromise = initBackend()
  }
  return backendPromise
}

// ── Public API ────────────────────────────────────────

export const localDb: ILocalDb = {
  async get<T>(storeName: TableName, id: string): Promise<T | null> {
    return (await getBackend()).get<T>(storeName, id)
  },

  async put<T>(storeName: TableName, value: T & { id: string }): Promise<void> {
    return (await getBackend()).put(storeName, value)
  },

  async putMany<T>(storeName: TableName, values: (T & { id: string })[]): Promise<void> {
    return (await getBackend()).putMany(storeName, values)
  },

  async delete(storeName: TableName, id: string): Promise<void> {
    return (await getBackend()).delete(storeName, id)
  },

  async list<T>(storeName: TableName): Promise<T[]> {
    return (await getBackend()).list<T>(storeName)
  },

  async findByIndex<T>(
    storeName: TableName,
    columnName: string,
    value: string | number | null,
  ): Promise<T[]> {
    return (await getBackend()).findByIndex<T>(storeName, columnName, value)
  },

  async count(storeName: TableName): Promise<number> {
    return (await getBackend()).count(storeName)
  },

  async clear(storeName: TableName): Promise<void> {
    return (await getBackend()).clear(storeName)
  },

  async deleteWhere<T>(
    storeName: TableName,
    predicate: (value: T & { id: string }) => boolean,
  ): Promise<void> {
    return (await getBackend()).deleteWhere(storeName, predicate)
  },

  async close(): Promise<void> {
    return (await getBackend()).close()
  },

  reset(): void {
    resolvedBackend = null
    backendPromise = null
  },

  isAvailable(): boolean {
    if (resolvedBackend) return resolvedBackend.isAvailable()
    if (Capacitor.isNativePlatform()) return true
    return typeof window !== 'undefined' && typeof customElements !== 'undefined'
  },
}
