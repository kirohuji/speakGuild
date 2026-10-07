import { learningApi, type TopicSession } from '@/features/learning/api/learning-api'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'

const idFor = (sessionId: string) => `topic-draft:${sessionId}`
const sessionIdFor = (sessionId: string) => `topic-session:${sessionId}`
const syncedSessionIdFor = (sessionId: string) => `session:${sessionId}`

function toTopicSession(local: any, sessionId: string): TopicSession {
  return {
    id: String(local.remoteId ?? sessionId),
    status: (local.status ?? 'analyzed') as TopicSession['status'],
    analysisResult: local.analysisResult ?? null,
    analysisError: local.analysisError ?? null,
    startedAt: String(local.startedAt ?? ''),
    completedAt: local.completedAt ?? null,
    analyzedAt: local.analyzedAt ?? null,
    createdAt: String(local.createdAt ?? local.startedAt ?? ''),
    submissions: local.submissions ?? [],
  }
}

async function readLocalTopicSession(sessionId: string): Promise<(TopicSession & { sceneId?: string }) | null> {
  const local =
    (await localDb.get<any>('topic_sessions', syncedSessionIdFor(sessionId)))
    ?? (await localDb.get<any>('topic_sessions', sessionIdFor(sessionId)))
  if (!local) return null

  let submissions = local.submissions
  if (!Array.isArray(submissions) || submissions.length === 0) {
    const draft = await loadTopicSessionDraft(sessionId)
    if (draft) submissions = [{ id: idFor(sessionId), response: draft, revision: 0, status: 'submitted', updatedAt: local.updatedAt }]
  }

  const hasPayload = Boolean(local.analysisResult || local.analysisError || (Array.isArray(submissions) && submissions.length > 0))
  if (!hasPayload && local.status !== 'analyzed') return null

  return { ...toTopicSession({ ...local, submissions }, sessionId), sceneId: local.sceneId }
}

async function cacheReviewedTopicSession(topicId: string, session: TopicSession, sceneId?: string | null) {
  await localDb.put('topic_sessions', {
    id: syncedSessionIdFor(session.id),
    remoteId: session.id,
    topicId,
    sceneId: sceneId ?? undefined,
    status: session.status,
    analysisResult: session.analysisResult ?? null,
    analysisError: session.analysisError ?? null,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    analyzedAt: session.analyzedAt ?? null,
    submissions: session.submissions ?? [],
    updatedAt: new Date().toISOString(),
    syncStatus: 'synced',
  })
}

/** 离线优先：sync/本地草稿 → 再拉远端并写回。 */
export async function getTopicSessionForReview(sessionId: string, topicId: string): Promise<(TopicSession & { sceneId?: string }) | null> {
  const cached = await readLocalTopicSession(sessionId)
  if (cached?.analysisResult || cached?.submissions?.length) return cached

  try {
    const sessions = await learningApi.listTopicSessions(topicId)
    const matched = sessions.find((item) => item.id === sessionId) ?? null
    if (matched) {
      await cacheReviewedTopicSession(topicId, matched, cached?.sceneId)
      return matched
    }
  } catch {
    /* fall through */
  }

  return cached
}

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
