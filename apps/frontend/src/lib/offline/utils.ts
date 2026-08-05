/**
 * Shared utility functions used across offline modules.
 *
 * Previously these were duplicated in 4+ files with subtle differences.
 * Centralising them ensures consistent behaviour and avoids drift.
 */
import type { ILocalDb } from './unified-storage'

export function toIsoString(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return null
}

export function createId(prefix?: string): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return prefix ? `${prefix}_${id}` : id
}

export function errorMessage(error: unknown): string {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  const maybe = error as any
  return maybe?.response?.data?.message ?? maybe?.message ?? String(error)
}

/**
 * Resolve a local session ID to its remote counterpart.
 *
 * Returns `null` when the session has not yet been synced — callers MUST
 * handle this case instead of passing `local_session_xxx` to remote APIs.
 */
export async function resolveSessionId(
  localDb: ILocalDb,
  sessionId: string,
): Promise<string | null> {
  if (!sessionId.startsWith('local_session_')) return sessionId
  const mapped = await localDb.get<{ value: string }>('kv', `session-map:${sessionId}`)
  return mapped?.value ?? null
}
