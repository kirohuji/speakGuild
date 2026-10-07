import { learningApi } from '@/features/learning/api/learning-api'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'

const idFor = (sessionId: string) => `topic-draft:${sessionId}`
const sessionIdFor = (sessionId: string) => `topic-session:${sessionId}`

export async function cacheTopicSession(topicId: string, sessionId: string, status: 'active' | 'analyzed' = 'active') {
  await localDb.put('topic_sessions', {
    id: sessionIdFor(sessionId), remoteId: sessionId, topicId, status, syncStatus: 'synced', updatedAt: new Date().toISOString(),
  })
}

export async function getCachedTopicSession(topicId: string): Promise<{ sessionId: string; response: Record<string, unknown> } | null> {
  const sessions = await localDb.list<{ remoteId?: string; topicId?: string; status?: string; updatedAt?: string }>('topic_sessions')
  const session = sessions.filter((item) => item.topicId === topicId && item.status === 'active' && item.remoteId)
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))[0]
  if (!session?.remoteId) return null
  return { sessionId: session.remoteId, response: await loadTopicSessionDraft(session.remoteId) ?? {} }
}

export async function saveTopicSessionDraft(topicId: string, sessionId: string, response: Record<string, unknown>) {
  const id = idFor(sessionId)
  const updatedAt = new Date().toISOString()
  await localDb.put('topic_submissions', { id, topicId, sessionId, response, status: 'draft', syncStatus: 'pending', updatedAt })
  const item = await syncOutbox.enqueue({ entityType: 'topic_submission', entityId: id, operation: 'create', payload: { topicId, sessionId, response, status: 'draft' } })
  try {
    const saved = await learningApi.saveTopicSubmission(topicId, { response, status: 'draft', sessionId })
    await localDb.put('topic_submissions', { id, remoteId: saved.id, topicId, sessionId, response, status: 'draft', revision: saved.revision, syncStatus: 'synced', updatedAt: saved.updatedAt })
    await syncOutbox.markSynced(item.id)
  } catch { /* durable locally; standard sync retries */ }
}

export async function loadTopicSessionDraft(sessionId: string): Promise<Record<string, unknown> | null> {
  const draft = await localDb.get<any>('topic_submissions', idFor(sessionId))
  return draft?.response ?? null
}

export async function clearTopicSessionDraft(sessionId: string) {
  const id = idFor(sessionId)
  await localDb.delete('topic_submissions', id)
  await localDb.deleteWhere<any>('outbox', (item) => item.entityType === 'topic_submission' && item.entityId === id)
}

export async function finalizeTopicSession(sessionId: string) {
  const id = sessionIdFor(sessionId)
  const session = await localDb.get<any>('topic_sessions', id)
  if (session) await localDb.put('topic_sessions', { ...session, status: 'analyzed', updatedAt: new Date().toISOString() })
}
