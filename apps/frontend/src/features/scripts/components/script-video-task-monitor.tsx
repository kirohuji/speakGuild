import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useGlobalTaskStore } from '@/stores/global-task.store'
import {
  refreshRunningScriptVideoTasks,
  refreshScriptVideoTask,
  type ScriptVideoTaskCopy,
} from '@/features/scripts/lib/refresh-script-video-task'

const MINUTE = 60_000

function pollIntervalMs(ageMs: number): number | null {
  if (ageMs < MINUTE) return 5_000
  if (ageMs < 2 * MINUTE) return 12_000
  if (ageMs < 3 * MINUTE) return 20_000
  return null
}

/**
 * Headless monitor: while any script_video task is running, stepped-poll
 * renderStatus in the background (drawer no longer owns the loop).
 */
export function ScriptVideoTaskMonitor() {
  const { t } = useTranslation()
  const runningIds = useGlobalTaskStore((state) => state.tasks
    .filter((task) => task.kind === 'script_video' && task.status === 'running')
    .map((task) => task.id)
    .sort()
    .join(','))
  const finalCheckedRef = useRef(new Set<string>())
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const copy: ScriptVideoTaskCopy = {
      ready: t('learning.videoTaskReady'),
      canceled: t('learning.videoTaskCanceled'),
      failed: t('scripts.videoGenerateFailed'),
      generating: t('learning.videoTaskGenerating'),
      timedOut: t('learning.videoTaskTimedOut'),
    }

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    if (!runningIds) {
      clearTimer()
      finalCheckedRef.current.clear()
      return clearTimer
    }

    let alive = true

    const schedule = (delayMs: number) => {
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        void tick()
      }, delayMs)
    }

    const tick = async () => {
      if (!alive) return
      if (document.visibilityState === 'hidden') {
        schedule(5_000)
        return
      }

      const running = useGlobalTaskStore.getState().tasks.filter(
        (task) => task.kind === 'script_video' && task.status === 'running',
      )
      if (running.length === 0) {
        clearTimer()
        return
      }

      const now = Date.now()
      let nextDelay = Number.POSITIVE_INFINITY

      await Promise.all(running.map(async (task) => {
        const startedAt = task.startedAt || now
        const ageMs = Math.max(0, now - startedAt)
        const interval = pollIntervalMs(ageMs)
        if (interval == null) {
          if (!finalCheckedRef.current.has(task.id)) {
            finalCheckedRef.current.add(task.id)
            await refreshScriptVideoTask(task.id, copy, {
              progressFallback: task.progress,
              markTimedOutIfStillRunning: true,
            })
          }
          return
        }
        await refreshScriptVideoTask(task.id, copy, { progressFallback: task.progress })
        nextDelay = Math.min(nextDelay, interval)
      }))

      if (!alive) return
      const stillRunning = useGlobalTaskStore.getState().tasks.some(
        (task) => task.kind === 'script_video' && task.status === 'running'
          && !finalCheckedRef.current.has(task.id)
          && pollIntervalMs(Math.max(0, Date.now() - (task.startedAt || Date.now()))) != null,
      )
      if (stillRunning && Number.isFinite(nextDelay)) {
        schedule(nextDelay)
      } else {
        // Only timed-out-but-still-marked-running leftovers: no more polling.
        clearTimer()
      }
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || !alive) return
      void (async () => {
        await refreshRunningScriptVideoTasks(copy)
        if (!alive) return
        // Re-enter schedule from the youngest still-running task.
        const running = useGlobalTaskStore.getState().tasks.filter(
          (task) => task.kind === 'script_video' && task.status === 'running',
        )
        let nextDelay = Number.POSITIVE_INFINITY
        for (const task of running) {
          if (finalCheckedRef.current.has(task.id)) continue
          const interval = pollIntervalMs(Math.max(0, Date.now() - (task.startedAt || Date.now())))
          if (interval != null) nextDelay = Math.min(nextDelay, interval)
        }
        if (Number.isFinite(nextDelay)) schedule(nextDelay)
      })()
    }

    // Immediate first check, then stepped schedule.
    void tick()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive = false
      clearTimer()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [runningIds, t])

  return null
}
