/**
 * Lazy loader for SQLite storage.
 *
 * The sqlite-storage module imports @capacitor-community/sqlite,
 * which should NOT be bundled on Web. This file uses dynamic import()
 * so the module is only loaded when actually called on Native.
 */
import type { TableName } from './schema'

// Mirror the sqliteStorage interface for type safety
interface SqliteStorage {
  get<T extends { id: string }>(storeName: TableName, id: string): Promise<T | null>
  put<T extends { id: string }>(storeName: TableName, value: T): Promise<void>
  putMany<T extends { id: string }>(storeName: TableName, values: T[]): Promise<void>
  delete(storeName: TableName, id: string): Promise<void>
  list<T extends { id: string }>(storeName: TableName): Promise<T[]>
  count(storeName: TableName): Promise<number>
  clear(storeName: TableName): Promise<void>
  saveBlob(blob: Blob, meta?: { mimeType?: string; sessionId?: string; round?: number }): Promise<string>
  getBlob(id: string): Promise<{ blob: Blob; mimeType?: string; sessionId?: string; round?: number } | null>
  deleteBlob(id: string): Promise<void>
  close(): Promise<void>
  isAvailable(): boolean
}

let sqliteStoragePromise: Promise<SqliteStorage> | null = null

/** Dynamically import sqlite-storage (only on Native). */
async function loadSqliteStorage(): Promise<SqliteStorage> {
  const mod = await import('./sqlite-storage')
  return mod.sqliteStorage
}

/**
 * Get the SQLite storage instance.
 * Only loads the capacitor-sqlite module on Native platforms.
 * Returns null on Web (use IndexedDB local-db instead).
 */
export async function getSqliteStorage(): Promise<SqliteStorage | null> {
  // Quick guard: don't even attempt the dynamic import on web
  if (typeof window !== 'undefined' && !(window as any)?.Capacitor?.isNativePlatform?.()) {
    // Check if we have the Capacitor global with native platform flag
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) return null
    } catch {
      return null
    }
  }

  if (!sqliteStoragePromise) {
    sqliteStoragePromise = loadSqliteStorage().catch(() => {
      sqliteStoragePromise = null
      throw new Error('[sqlite-storage] Failed to load SQLite module')
    })
  }
  return sqliteStoragePromise
}
