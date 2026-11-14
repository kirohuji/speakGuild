import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createId } from '@/lib/offline/utils'
import { localDateKey } from '@/lib/date/calendar-date'
import { claimPracticeTimer, ownsPracticeTimer, getPracticeActivityGeneration, flushPracticeActivityRecords, registerPracticeActivityCommitter, usePracticeActivityStore, type PracticeActivityScope } from '@/stores/practice-activity.store'
const IDLE_PAUSE_MS = 60_000
/** Only the active foreground learning timer accrues. Writes happen at five-second checkpoints. */
export function useEffectivePracticeTimer({ enabled, sourceId: inputSourceId, scope, idlePauseMs = IDLE_PAUSE_MS }: {
  enabled: boolean; sourceId: string | null; scope: PracticeActivityScope; questionCount?: number; idlePauseMs?: number
}) {
  const sourceId = useMemo(() => inputSourceId ? `timer:${createId()}` : null, [inputSourceId])
  const onInteraction = useRef<(() => void) | null>(null)
  const touch = useCallback(() => { onInteraction.current?.() }, [])
  const flush = useCallback(() => {
    void flushPracticeActivityRecords().catch(error => console.warn('[learning-activity] local persistence failed:', error))
  }, [])
  useEffect(() => {
    if (!enabled || !sourceId) return
    const generation = getPracticeActivityGeneration()
    const releaseOwnership = claimPracticeTimer(sourceId)
    let lastMonotonic = performance.now()
    let lastWall = Date.now()
    let lastInteraction = lastMonotonic
    let visible = document.visibilityState === 'visible'
    const pendingMilliseconds = new Map<string, number>()
    const advance = () => {
      const now = performance.now()
      const startMonotonic = lastMonotonic
      const startWall = lastWall
      lastMonotonic = now
      lastWall = Date.now()
      if (generation !== getPracticeActivityGeneration() || !visible || !ownsPracticeTimer(sourceId)) return
      // Intersect with the previous idle deadline before accepting a new interaction.
      const milliseconds = Math.max(0, Math.min(now, lastInteraction + idlePauseMs) - startMonotonic)
      let cursor = startWall
      const end = startWall + Math.min(milliseconds, 60_000)
      while (cursor < end) {
        const midnight = new Date(cursor)
        midnight.setHours(24, 0, 0, 0)
        const until = Math.min(end, midnight.getTime())
        const date = localDateKey(new Date(cursor))
        pendingMilliseconds.set(date, (pendingMilliseconds.get(date) ?? 0) + until - cursor)
        cursor = until
      }
    }
    const commit = () => {
      advance()
      if (generation !== getPracticeActivityGeneration()) return
      for (const [date, milliseconds] of pendingMilliseconds) {
        const seconds = Math.floor(milliseconds / 1000)
        if (seconds) usePracticeActivityStore.getState().addActiveSeconds({ date, sourceId, scope, seconds })
        pendingMilliseconds.set(date, milliseconds % 1000)
      }
      // At most the current and immediately preceding calendar day's fractional second is retained.
      if (pendingMilliseconds.size > 2) pendingMilliseconds.delete(pendingMilliseconds.keys().next().value!)
    }
    const interact = () => { advance(); lastInteraction = performance.now() }
    onInteraction.current = interact
    const unregister = registerPracticeActivityCommitter(commit)
    let timer: ReturnType<typeof setInterval> | undefined
    const stopTimer = () => { clearInterval(timer); timer = undefined }
    const startTimer = () => { if (!timer) timer = setInterval(commit, 5_000) }
    const onVisibilityChange = () => {
      commit()
      visible = document.visibilityState === 'visible'
      if (visible) {
        lastMonotonic = performance.now(); lastInteraction = lastMonotonic; lastWall = Date.now(); startTimer()
      } else { stopTimer(); flush() }
    }
    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart', 'input', 'scroll', 'wheel']
    events.forEach(event => document.addEventListener(event, touch, { passive: true }))
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (visible) startTimer()
    return () => {
      commit(); unregister(); stopTimer(); releaseOwnership()
      if (onInteraction.current === interact) onInteraction.current = null
      events.forEach(event => document.removeEventListener(event, touch))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      flush()
      usePracticeActivityStore.getState().releaseSource(sourceId)
    }
  }, [enabled, sourceId, scope, idlePauseMs, touch, flush])
  return { touch, flush }
}
