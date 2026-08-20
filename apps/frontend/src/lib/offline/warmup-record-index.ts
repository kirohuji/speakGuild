import type { WarmupRecordEntry } from '@/stores/warmup-session.store'
import { localDateKey, normalizeCalendarDate } from '@/lib/date/calendar-date'
import { localDb } from './unified-storage'

interface WarmupRecordForIndex {
  id: string
  topicId?: string | null
  topicTitle?: string | null
  items?: WarmupRecordEntry[]
  createdAt?: string | null
  updatedAt?: string | null
  /** Business date for a scheduled Today run; never infer it from UTC. */
  practicedDate?: string | null
}

function safeEntryId(recordId: string, stepId: string, index: number) {
  return `${recordId}::${stepId || index}`
}

export async function upsertWarmupRecordEntries(record: WarmupRecordForIndex): Promise<void> {
  const items = Array.isArray(record.items) ? record.items : []
  await localDb.deleteByIndex('warmup_record_entries', 'record_id', record.id)
  if (items.length === 0) return

  const recordUpdatedAt = record.updatedAt ?? record.createdAt ?? new Date().toISOString()
  // `updatedAt` is an ISO/UTC timestamp.  Slicing it shifts records created
  // after midnight in Asia/Shanghai into the previous business day.
  const practicedDate = normalizeCalendarDate(
    record.practicedDate,
    localDateKey(new Date(recordUpdatedAt)),
  )
  await localDb.putMany('warmup_record_entries', items.map((item, index) => ({
    id: safeEntryId(record.id, item.stepId, index),
    recordId: record.id,
    stepId: item.stepId,
    topicId: record.topicId ?? null,
    topicTitle: item.topicTitle ?? record.topicTitle ?? '',
    practicedDate,
    recordUpdatedAt,
    record: {
      ...item,
      topicTitle: item.topicTitle ?? record.topicTitle ?? '',
      recordId: record.id,
    },
  })))
}

export async function deleteWarmupRecordEntries(recordId: string): Promise<void> {
  await localDb.deleteByIndex('warmup_record_entries', 'record_id', recordId)
}
