import type { WarmupRecordEntry } from '@/stores/warmup-session.store'
import { localDb } from './unified-storage'

interface WarmupRecordForIndex {
  id: string
  topicId?: string | null
  topicTitle?: string | null
  items?: WarmupRecordEntry[]
  createdAt?: string | null
  updatedAt?: string | null
}

function safeEntryId(recordId: string, stepId: string, index: number) {
  return `${recordId}::${stepId || index}`
}

export async function upsertWarmupRecordEntries(record: WarmupRecordForIndex): Promise<void> {
  const items = Array.isArray(record.items) ? record.items : []
  await localDb.deleteByIndex('warmup_record_entries', 'record_id', record.id)
  if (items.length === 0) return

  const recordUpdatedAt = record.updatedAt ?? record.createdAt ?? new Date().toISOString()
  const practicedDate = recordUpdatedAt.slice(0, 10)
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
