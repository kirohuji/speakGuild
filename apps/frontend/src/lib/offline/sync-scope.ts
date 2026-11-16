import type { SyncEntityType } from './sync-outbox'

export type SyncScope = 'all' | 'today' | 'notebook' | 'script'

const SCOPE_OUTBOX_TYPES: Record<Exclude<SyncScope, 'all'>, ReadonlySet<SyncEntityType>> = {
  today: new Set<SyncEntityType>(['daily_practice', 'learning_activity', 'user_recording']),
  notebook: new Set<SyncEntityType>(['notebook', 'notebook_item', 'word_entry', 'chunk_entry', 'pattern_entry']),
  script: new Set<SyncEntityType>(['script_practice_record', 'nqtr_save']),
}

const SCOPE_PULL_TYPES: Record<Exclude<SyncScope, 'all'>, string[]> = {
  today: ['dailyPracticeRuns', 'practiceWarmupRecords'],
  notebook: ['expressionItems', 'learningNotebooks', 'learningNotebookItems'],
  // 剧本「我的」进度目前以 outbox push + 本地缓存为主；pull 类型随后端扩展再补。
  script: [],
}

/** Resolve scoped sync filters; `all`/undefined means full sync. */
export function resolveSyncScope(scope?: SyncScope): {
  outboxTypes?: ReadonlySet<SyncEntityType>
  pullTypes?: string[]
} {
  if (!scope || scope === 'all') return {}
  return {
    outboxTypes: SCOPE_OUTBOX_TYPES[scope],
    pullTypes: SCOPE_PULL_TYPES[scope],
  }
}
