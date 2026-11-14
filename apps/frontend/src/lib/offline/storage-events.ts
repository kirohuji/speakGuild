import type { TableName } from './sqlite/schema'
const listeners = new Set<() => void>()
const statisticsTables = new Set<TableName>(['daily_activity', 'daily_practice_runs', 'expression_entries'])
let depth = 0
let changed = false
export function notifyStatisticsChanged(table: TableName) {
  if (table === 'outbox') { outboxVersion++; for (const listener of outboxListeners) listener() }
  if (!statisticsTables.has(table)) return
  if (depth) { changed = true; return }
  for (const listener of listeners) listener()
}
export async function batchStatisticsNotifications<T>(operation: () => Promise<T>) {
  depth++
  try { return await operation() }
  finally {
    if (--depth === 0 && changed) { changed = false; for (const listener of listeners) listener() }
  }
}
export function subscribeStatisticsChanged(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }

const outboxListeners = new Set<() => void>()
let outboxVersion = 0
export function getOutboxVersion() { return outboxVersion }
export function subscribeOutboxChanged(listener: () => void) { outboxListeners.add(listener); return () => { outboxListeners.delete(listener) } }
