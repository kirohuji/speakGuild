import { learningApi } from '@/features/learning/api/learning-api'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'

type ReadingAnswers = Record<string, string>

type ReadingDraft = {
  id: string
  topicId: string
  sessionId: string
  response: { answers: ReadingAnswers }
  status: 'draft'
  syncStatus: 'pending' | 'synced'
  updatedAt: string
}

const draftId = (sessionId: string) => `reading-draft:${sessionId}`
const sessionRecordId = (sessionId: string) => `session:${sessionId}`

/** Persist an active reading session so an interrupted native app can resume it. */
export async function cacheReadingSession(topicId: string, sessionId: string) {
  await localDb.put('topic_sessions', {
    id: sessionRecordId(sessionId),
    remoteId: sessionId,
    topicId,
    status: 'active',
    syncStatus: 'synced',
    updatedAt: new Date().toISOString(),
  })
}

export async function getCachedReadingSession(topicId: string): Promise<{ sessionId: string; answers: ReadingAnswers } | null> {
  const sessions = await localDb.list<{ remoteId?: string; topicId?: string; status?: string; updatedAt?: string }>('topic_sessions')
  const session = sessions
    .filter((item) => item.topicId === topicId && item.status === 'active' && item.remoteId)
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))[0]
  if (!session?.remoteId) return null
  const draft = await localDb.get<ReadingDraft>('topic_submissions', draftId(session.remoteId))
  return { sessionId: session.remoteId, answers: draft?.response?.answers ?? {} }
}

/**
 * Local-first draft save. A failed foreground request remains in the outbox and
 * is retried by the normal offline sync cycle.
 */
export async function saveReadingDraft(topicId: string, sessionId: string, answers: ReadingAnswers) {
  const now = new Date().toISOString()
  const id = draftId(sessionId)
  const draft: ReadingDraft = {
    id,
    topicId,
    sessionId,
    response: { answers },
    status: 'draft',
    syncStatus: 'pending',
    updatedAt: now,
  }
  await localDb.put('topic_submissions', draft)
  const outboxItem = await syncOutbox.enqueue({
    entityType: 'topic_submission',
    entityId: id,
    operation: 'create',
    payload: { topicId, sessionId, response: draft.response, status: 'draft' },
  })

  try {
    const saved = await learningApi.saveTopicSubmission(topicId, {
      response: draft.response,
      status: 'draft',
      sessionId,
    })
    await localDb.put('topic_submissions', {
      ...draft,
      remoteId: saved.id,
      revision: saved.revision,
      syncStatus: 'synced',
      updatedAt: saved.updatedAt,
    })
    await syncOutbox.markSynced(outboxItem.id)
  } catch {
    // The draft is already durable locally; normal sync will retry it later.
  }
}

export async function getReadingDraft(sessionId: string): Promise<ReadingAnswers | null> {
  const draft = await localDb.get<ReadingDraft>('topic_submissions', draftId(sessionId))
  return draft?.response?.answers ?? null
}

/** Final submission supersedes the draft, so it must never be replayed later. */
export async function clearReadingDraft(sessionId: string) {
  const id = draftId(sessionId)
  await Promise.all([
    localDb.delete('topic_submissions', id),
    localDb.deleteWhere<any>('outbox', (item) => item.entityType === 'topic_submission' && item.entityId === id),
  ])
}

export async function finalizeCachedReadingSession(sessionId: string) {
  const id = sessionRecordId(sessionId)
  const session = await localDb.get<any>('topic_sessions', id)
  if (!session) return
  await localDb.put('topic_sessions', {
    ...session,
    status: 'analyzed',
    updatedAt: new Date().toISOString(),
  })
}
