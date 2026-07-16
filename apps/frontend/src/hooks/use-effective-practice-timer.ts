import { useCallback, useEffect, useRef } from 'react'
import { dailyPracticeApi } from '@/features/practice/api/english-practice-api'
import { usePracticeActivityStore, type PracticeActivityScope } from '@/stores/practice-activity.store'

const IDLE_PAUSE_MS = 60_000
const FLUSH_INTERVAL_MS = 30_000

function localDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * 只累计用户在前台且持续操作中的练习时间：无交互 60 秒或切到后台即暂停。
 * 本地持久化总秒数，服务端以 sourceId 的最大值去重，因此断网和重复请求不会重复累计。
 */
export function useEffectivePracticeTimer({
  enabled,
  sourceId,
  scope,
  questionCount = 0,
}: {
  enabled: boolean
  sourceId: string | null
  scope: PracticeActivityScope
  questionCount?: number
}) {
  const addActiveSeconds = usePracticeActivityStore((s) => s.addActiveSeconds)
  const getRecord = usePracticeActivityStore((s) => s.getRecord)
  const lastInteractionAt = useRef(Date.now())
  const lastTickAt = useRef(Date.now())
  const lastFlushAt = useRef(0)
  const questionCountRef = useRef(questionCount)
  const sourceIdRef = useRef(sourceId)
  const scopeRef = useRef(scope)

  questionCountRef.current = questionCount
  sourceIdRef.current = sourceId
  scopeRef.current = scope

  const flush = useCallback(() => {
    const activeSourceId = sourceIdRef.current
    if (!activeSourceId) return
    const date = localDateKey()
    const record = getRecord(date, activeSourceId)
    if (!record || record.activeSeconds === 0) return
    lastFlushAt.current = Date.now()
    void dailyPracticeApi.recordActivity({
      date,
      sourceId: activeSourceId,
      scope: scopeRef.current,
      activeSeconds: record.activeSeconds,
      questionCount: Math.max(0, Math.floor(questionCountRef.current)),
    }).catch(() => {
      // 保留本地累计值，下一次用户练习或重新进入页面时自动补传。
    })
  }, [getRecord])

  const touch = useCallback(() => {
    lastInteractionAt.current = Date.now()
  }, [])

  useEffect(() => {
    if (!enabled || !sourceId) return
    lastInteractionAt.current = Date.now()
    lastTickAt.current = Date.now()

    const onActivity = () => { lastInteractionAt.current = Date.now() }
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') flush()
      else {
        lastInteractionAt.current = Date.now()
        lastTickAt.current = Date.now()
      }
    }
    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart', 'input']
    events.forEach((event) => document.addEventListener(event, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisibilityChange)

    const timer = window.setInterval(() => {
      const now = Date.now()
      const elapsed = Math.floor((now - lastTickAt.current) / 1000)
      lastTickAt.current = now
      if (document.visibilityState === 'visible' && now - lastInteractionAt.current <= IDLE_PAUSE_MS) {
        addActiveSeconds({ date: localDateKey(), sourceId, scope, seconds: elapsed })
      }
      if (now - lastFlushAt.current >= FLUSH_INTERVAL_MS) flush()
    }, 5_000)

    return () => {
      window.clearInterval(timer)
      events.forEach((event) => document.removeEventListener(event, onActivity))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      flush()
    }
  }, [addActiveSeconds, enabled, flush, scope, sourceId])

  useEffect(() => {
    if (enabled && sourceId && questionCount > 0) flush()
  }, [enabled, flush, questionCount, sourceId])

  return { touch, flush }
}
