import { useCallback, useEffect, useRef, useState } from 'react'
import { learningApi, type TopicSession } from '../api/learning-api'
import { cacheTopicSession, clearTopicSessionDraft, finalizeTopicSession, getCachedTopicSession, loadTopicSessionDraft, saveTopicSessionDraft } from '@/lib/offline/topic-session-draft.repository'

/**
 * The single lifecycle for all TopicSession based activities.  Editors own the
 * shape of their response, while this hook owns session recovery, local-first
 * drafts, finalisation and starting a new attempt.
 */
export function useTopicSession(
  topicId: string,
  onRestore: (response: Record<string, unknown>) => void,
) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [completedSession, setCompletedSession] = useState<TopicSession | null>(null)
  const [ready, setReady] = useState(false)
  const saving = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setSessionId(null)
    setCompletedSession(null)
    void (async () => {
      try {
        const latest = await learningApi.getLatestTopicSession(topicId)
        if (cancelled) return
        if (latest?.status === 'active') {
          await cacheTopicSession(topicId, latest.id)
          const local = await loadTopicSessionDraft(latest.id)
          if (cancelled) return
          setSessionId(latest.id)
          onRestore(local ?? latest.submissions?.[0]?.response ?? {})
        } else if (latest?.status === 'analyzed' || latest?.status === 'completed') {
          setCompletedSession(latest)
          onRestore(latest.submissions?.[0]?.response ?? {})
        } else {
          const created = await learningApi.startTopicSession(topicId)
          await cacheTopicSession(topicId, created.id)
          if (!cancelled) setSessionId(created.id)
        }
      } catch {
        const cached = await getCachedTopicSession(topicId).catch(() => null)
        if (!cancelled && cached) {
          setSessionId(cached.sessionId)
          onRestore(cached.response)
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [onRestore, topicId])

  const saveDraft = useCallback((response: Record<string, unknown>) => {
    if (!sessionId || completedSession) return Promise.resolve()
    saving.current = saving.current.then(() => saveTopicSessionDraft(topicId, sessionId, response))
    return saving.current
  }, [completedSession, sessionId, topicId])

  const submit = useCallback(async (response: Record<string, unknown>) => {
    if (!sessionId) throw new Error('练习会话尚未准备好，请稍后重试')
    await saveDraft(response)
    await learningApi.saveTopicSubmission(topicId, { response, status: 'submitted', sessionId })
    await learningApi.completeTopicSession(topicId, sessionId)
    const result = await learningApi.analyzeTopicSession(topicId, sessionId)
    await clearTopicSessionDraft(sessionId)
    await finalizeTopicSession(sessionId)
    setCompletedSession({ id: sessionId, status: 'analyzed', analysisResult: result.analysis ?? null, analysisError: result.error ?? null, startedAt: '', createdAt: '' })
    return result
  }, [saveDraft, sessionId, topicId])

  const startNewAttempt = useCallback(async () => {
    const created = await learningApi.startTopicSession(topicId)
    await cacheTopicSession(topicId, created.id)
    setCompletedSession(null)
    setSessionId(created.id)
    return created.id
  }, [topicId])

  return {
    sessionId,
    ready,
    analysis: completedSession?.analysisResult ?? null,
    analysisError: completedSession?.analysisError ?? null,
    readOnly: Boolean(completedSession),
    saveDraft,
    submit,
    startNewAttempt,
  }
}
