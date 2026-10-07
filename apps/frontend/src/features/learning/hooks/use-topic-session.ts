import { useCallback, useEffect, useRef, useState } from 'react'
import { learningApi, type TopicSession } from '../api/learning-api'
import { cacheTopicSession, clearTopicSessionDraft, finalizeTopicSession, getCachedTopicSession, loadTopicSessionDraft, saveTopicSessionDraft } from '@/lib/offline/topic-session-draft.repository'

export type TopicSessionReviewSnapshot = {
  response: Record<string, unknown>
  analysis: Record<string, any> | null
  analysisError?: string | null
}

/**
 * The single lifecycle for all TopicSession based activities.  Editors own the
 * shape of their response, while this hook owns session recovery, local-first
 * drafts, finalisation and starting a new attempt.
 *
 * Pass `review` to bind a historical snapshot (read-only, no network/draft).
 */
export function useTopicSession(
  topicId: string,
  onRestore: (response: Record<string, unknown>) => void,
  options?: { review?: TopicSessionReviewSnapshot | null },
) {
  const review = options?.review
  const reviewFingerprint = review
    ? JSON.stringify({ response: review.response, analysis: review.analysis, error: review.analysisError ?? null })
    : null
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [completedSession, setCompletedSession] = useState<TopicSession | null>(null)
  const [ready, setReady] = useState(Boolean(review))
  const saving = useRef<Promise<void>>(Promise.resolve())
  const onRestoreRef = useRef(onRestore)
  const reviewRef = useRef(review)
  onRestoreRef.current = onRestore
  reviewRef.current = review

  useEffect(() => {
    if (reviewFingerprint && reviewRef.current) {
      const snapshot = reviewRef.current
      setReady(true)
      setSessionId(null)
      setCompletedSession({
        id: 'review',
        status: 'analyzed',
        analysisResult: snapshot.analysis,
        analysisError: snapshot.analysisError ?? null,
        startedAt: '',
        createdAt: '',
      })
      onRestoreRef.current(snapshot.response)
      return
    }

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
          onRestoreRef.current(local ?? latest.submissions?.[0]?.response ?? {})
        } else if (latest?.status === 'analyzed' || latest?.status === 'completed') {
          setCompletedSession(latest)
          onRestoreRef.current(latest.submissions?.[0]?.response ?? {})
        } else {
          const created = await learningApi.startTopicSession(topicId)
          await cacheTopicSession(topicId, created.id)
          if (!cancelled) setSessionId(created.id)
        }
      } catch {
        const cached = await getCachedTopicSession(topicId).catch(() => null)
        if (!cancelled && cached) {
          setSessionId(cached.sessionId)
          onRestoreRef.current(cached.response)
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [reviewFingerprint, topicId])

  const saveDraft = useCallback((response: Record<string, unknown>) => {
    if (review || !sessionId || completedSession) return Promise.resolve()
    saving.current = saving.current.then(() => saveTopicSessionDraft(topicId, sessionId, response))
    return saving.current
  }, [completedSession, review, sessionId, topicId])

  const submit = useCallback(async (response: Record<string, unknown>) => {
    if (review) throw new Error('历史回看不可提交')
    if (!sessionId) throw new Error('练习会话尚未准备好，请稍后重试')
    await saveDraft(response)
    await learningApi.saveTopicSubmission(topicId, { response, status: 'submitted', sessionId })
    await learningApi.completeTopicSession(topicId, sessionId)
    const result = await learningApi.analyzeTopicSession(topicId, sessionId)
    await clearTopicSessionDraft(sessionId)
    await finalizeTopicSession(sessionId)
    setCompletedSession({ id: sessionId, status: 'analyzed', analysisResult: result.analysis ?? null, analysisError: result.error ?? null, startedAt: '', createdAt: '' })
    return result
  }, [review, saveDraft, sessionId, topicId])

  const startNewAttempt = useCallback(async () => {
    if (review) throw new Error('历史回看不可重练')
    const created = await learningApi.startTopicSession(topicId)
    await cacheTopicSession(topicId, created.id)
    setCompletedSession(null)
    setSessionId(created.id)
    return created.id
  }, [review, topicId])

  return {
    sessionId,
    ready,
    analysis: completedSession?.analysisResult ?? null,
    analysisError: completedSession?.analysisError ?? null,
    readOnly: Boolean(completedSession) || Boolean(review),
    saveDraft,
    submit,
    startNewAttempt,
  }
}
