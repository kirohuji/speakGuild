import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createId, errorMessage } from '@/lib/offline/utils'

export type OfflineSyncLogStatus = 'success' | 'failed' | 'running'

export interface OfflineSyncLogEntry {
  id: string
  startedAt: string
  finishedAt?: string
  status: OfflineSyncLogStatus
  summary: string
  detail?: unknown
  error?: string | null
}

interface OfflineSyncState {
  isSyncing: boolean
  /**
   * Login/session restore is flushing outbox + pulling remote progress in the
   * background. Today-task must not create a new local run until this clears.
   * Memory-only; not persisted.
   */
  loginRestorePending: boolean
  currentLogId: string | null
  lastSyncedAt: string | null
  /** 当前这次成功 pull 实际包含的今日任务 run；仅内存态，用于避免把无关同步当成任务更新。 */
  lastPulledDailyPracticeRunIds: string[]
  lastError: string | null
  logs: OfflineSyncLogEntry[]
  begin: (summary: string) => string
  finish: (id: string, input: {
    status: 'success' | 'failed'
    summary: string
    detail?: unknown
    error?: unknown
    pulledDailyPracticeRunIds?: string[]
  }) => void
  setLoginRestorePending: (pending: boolean) => void
  clearLogs: () => void
  reset: () => void
}

const MAX_LOG_COUNT = 50

/** 自动清理：保留最近 50 条 + 全部错误日志，其余定期删除 */
function autoCleanLogs(logs: OfflineSyncLogEntry[]): OfflineSyncLogEntry[] {
  const maxKeep = 50
  if (logs.length <= maxKeep) return logs
  const errors = logs.filter((l) => l.status === 'failed' || l.error)
  const nonErrors = logs.filter((l) => l.status !== 'failed' && !l.error)
  const keptNonErrors = nonErrors.slice(0, maxKeep - errors.length)
  return [...errors, ...keptNonErrors].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )
}

export const useOfflineSyncStore = create<OfflineSyncState>()(
  persist(
    (set) => ({
      isSyncing: false,
      loginRestorePending: false,
      currentLogId: null,
      lastSyncedAt: null,
      lastPulledDailyPracticeRunIds: [],
      lastError: null,
      logs: [],

      begin(summary) {
        const id = createId()
        const startedAt = new Date().toISOString()
        set((state) => ({
          isSyncing: true,
          currentLogId: id,
          lastError: null,
          logs: autoCleanLogs([
            { id, startedAt, status: 'running' as const, summary },
            ...state.logs.filter((item) => item.status !== 'running'),
          ]),
        }))
        return id
      },

      finish(id, input) {
        const finishedAt = new Date().toISOString()
        const lastError = input.status === 'failed' ? errorMessage(input.error) : null
        set((state) => ({
          isSyncing: state.currentLogId === id ? false : state.isSyncing,
          currentLogId: state.currentLogId === id ? null : state.currentLogId,
          lastSyncedAt: input.status === 'success' ? finishedAt : state.lastSyncedAt,
          lastPulledDailyPracticeRunIds: input.status === 'success'
            ? [...new Set(input.pulledDailyPracticeRunIds ?? [])]
            : state.lastPulledDailyPracticeRunIds,
          lastError,
          logs: autoCleanLogs(state.logs.map((item) =>
            item.id === id
              ? {
                  ...item,
                  finishedAt,
                  status: input.status,
                  summary: input.summary,
                  detail: input.detail,
                  error: lastError,
                }
              : item,
          )),
        }))
      },

      setLoginRestorePending(pending) {
        set({ loginRestorePending: pending })
      },

      clearLogs() {
        set({ logs: [], lastError: null })
      },

      reset() {
        set({
          isSyncing: false,
          loginRestorePending: false,
          currentLogId: null,
          lastSyncedAt: null,
          lastPulledDailyPracticeRunIds: [],
          lastError: null,
          logs: [],
        })
      },
    }),
    {
      name: 'manyu-offline-sync',
      partialize: (state) => ({
        lastSyncedAt: state.lastSyncedAt,
        lastError: state.lastError,
        logs: state.logs,
      }),
    },
  ),
)
