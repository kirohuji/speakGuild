import { notifyStatisticsChanged } from './storage-events'
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
import type { NotebookExpressionPage, NotebookExpressionPageQuery, PageFilter, PageQuery } from './sqlite/sqlite-json-store'
import { Capacitor } from '@capacitor/core'

// ── Storage interface (shared by all backends) ──────────

export interface ILocalDb {
  applyStatisticsRuns(runs: any[]): Promise<void>
  saveDailyPracticeOutbox(entityId: string, operation: string, payload: any): Promise<void>
  patchOutbox(id: string, revision: number, status: 'synced' | 'failed', error?: string, retryAt?: string): Promise<boolean>
  saveRunFacts(run: any, payload: any, warmup?: any): Promise<void>
  saveLearningActivity(record: { date: string; sourceId: string; scope: string; activeSeconds: number }): Promise<void>
  readLearningStatistics(start: string, end: string, today: string): Promise<import('./statistics-types').LearningStatistics>
  pruneSyncedOutbox(before: string): Promise<void>
  listDueOutbox(now: string, limit: number, types?: string[]): Promise<any[]>
  get<T>(storeName: TableName, id: string): Promise<T | null>
  put<T>(storeName: TableName, value: T & { id: string }): Promise<void>
  putMany<T>(storeName: TableName, values: (T & { id: string })[]): Promise<void>
  delete(storeName: TableName, id: string): Promise<void>
  list<T>(storeName: TableName): Promise<T[]>
  findByIndex<T>(storeName: TableName, columnName: string, value: string | number | null): Promise<T[]>
  findByIndexIn<T>(storeName: TableName, columnName: string, values: Array<string | number>): Promise<T[]>
  count(storeName: TableName): Promise<number>
  listPage<T>(storeName: TableName, query: PageQuery): Promise<T[]>
  countWhere(storeName: TableName, filters?: PageFilter[]): Promise<number>
  listContentRefPage(params: {
    packId?: string
    topicId?: string
    kind: 'vocab' | 'chunk' | 'pattern'
    limit: number
    offset?: number
  }): Promise<{ contentIds: string[]; total: number }>
  listNotebookExpressionPage(query: NotebookExpressionPageQuery): Promise<NotebookExpressionPage>
  clear(storeName: TableName): Promise<void>
  deleteByIndex(storeName: TableName, columnName: string, value: string | number | null): Promise<void>
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
  async applyStatisticsRuns(runs) { if (!runs.length) return; await (await getBackend()).applyStatisticsRuns(runs); notifyStatisticsChanged('daily_activity') },
  async saveDailyPracticeOutbox(entityId, operation, payload) { await (await getBackend()).saveDailyPracticeOutbox(entityId, operation, payload); notifyStatisticsChanged('outbox') },
  async patchOutbox(id, revision, status, error, retryAt) { const result = await (await getBackend()).patchOutbox(id, revision, status, error, retryAt); notifyStatisticsChanged('outbox'); return result },
  async saveRunFacts(run, payload, warmup) { await (await getBackend()).saveRunFacts(run, payload, warmup); notifyStatisticsChanged('daily_practice_runs'); notifyStatisticsChanged('outbox') },
  async saveLearningActivity(record) { await (await getBackend()).saveLearningActivity(record); notifyStatisticsChanged('daily_activity'); notifyStatisticsChanged('outbox') },
  async readLearningStatistics(start, end, today) { return (await getBackend()).readLearningStatistics(start, end, today) },
  async pruneSyncedOutbox(before) { await (await getBackend()).pruneSyncedOutbox(before) },
  async listDueOutbox(now, limit, types) { return (await getBackend()).listDueOutbox(now, limit, types) },

  async get<T>(storeName: TableName, id: string): Promise<T | null> {
    return (await getBackend()).get<T>(storeName, id)
  },

  async put<T>(storeName: TableName, value: T & { id: string }): Promise<void> {
    await (await getBackend()).put(storeName, value)
    notifyStatisticsChanged(storeName)
  },

  async putMany<T>(storeName: TableName, values: (T & { id: string })[]): Promise<void> {
    await (await getBackend()).putMany(storeName, values)
    notifyStatisticsChanged(storeName)
  },

  async delete(storeName: TableName, id: string): Promise<void> {
    await (await getBackend()).delete(storeName, id)
    notifyStatisticsChanged(storeName)
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

  async findByIndexIn<T>(
    storeName: TableName,
    columnName: string,
    values: Array<string | number>,
  ): Promise<T[]> {
    return (await getBackend()).findByIndexIn<T>(storeName, columnName, values)
  },

  async count(storeName: TableName): Promise<number> {
    return (await getBackend()).count(storeName)
  },

  async listPage<T>(storeName: TableName, query: PageQuery): Promise<T[]> {
    return (await getBackend()).listPage<T>(storeName, query)
  },

  async countWhere(storeName: TableName, filters: PageFilter[] = []): Promise<number> {
    return (await getBackend()).countWhere(storeName, filters)
  },

  async listContentRefPage(params) {
    return (await getBackend()).listContentRefPage(params)
  },

  async listNotebookExpressionPage(query) {
    return (await getBackend()).listNotebookExpressionPage(query)
  },

  async clear(storeName: TableName): Promise<void> {
    await (await getBackend()).clear(storeName)
    notifyStatisticsChanged(storeName)
  },

  async deleteByIndex(storeName: TableName, columnName: string, value: string | number | null): Promise<void> {
    await (await getBackend()).deleteByIndex(storeName, columnName, value)
    notifyStatisticsChanged(storeName)
  },

  async deleteWhere<T>(
    storeName: TableName,
    predicate: (value: T & { id: string }) => boolean,
  ): Promise<void> {
    await (await getBackend()).deleteWhere(storeName, predicate)
    notifyStatisticsChanged(storeName)
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
