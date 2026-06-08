import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type OfflineSyncLogStatus = 'success' | 'failed' | 'running'

export interface OfflineSyncLogEntry {
  id: string
  startedAt: string
  finishedAt?: string
  status: OfflineSyncLogStatus
  summary: string
  detail?: unknown
}

interface OfflineSyncState {
  isSyncing: boolean
  currentLogId: string | null
  lastSyncedAt: string | null
  lastError: string | null
  logs: OfflineSyncLogEntry[]
  begin: (summary: string) => string
  finish: (id: string, input: { status: 'success' | 'failed'; summary: string; detail?: unknown; error?: unknown }) => void
  clearLogs: () => void
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function errorMessage(error: unknown) {
  if (!error) return null
  return error instanceof Error ? error.message : String(error)
}

export const useOfflineSyncStore = create<OfflineSyncState>()(
  persist(
    (set) => ({
      isSyncing: false,
      currentLogId: null,
      lastSyncedAt: null,
      lastError: null,
      logs: [],

      begin(summary) {
        const id = createId()
        const startedAt = new Date().toISOString()
        set((state) => ({
          isSyncing: true,
          currentLogId: id,
          lastError: null,
          logs: [
            { id, startedAt, status: 'running' as const, summary },
            ...state.logs.filter((item) => item.status !== 'running'),
          ].slice(0, 20),
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
          lastError,
          logs: state.logs.map((item) =>
            item.id === id
              ? {
                  ...item,
                  finishedAt,
                  status: input.status,
                  summary: input.summary,
                  detail: input.detail,
                }
              : item,
          ).slice(0, 20),
        }))
      },

      clearLogs() {
        set({ logs: [], lastError: null })
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
