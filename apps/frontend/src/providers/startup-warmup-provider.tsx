import { useEffect, useRef, type ReactNode } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useLearningStore } from '@/stores/learning.store'
import { useDailyPracticeStore } from '@/stores/daily-practice.store'
import { localDb } from '@/lib/offline/unified-storage'

function scheduleIdleWork(task: () => void, timeout = 2_000) {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(task, { timeout })
    return
  }
  window.setTimeout(task, timeout)
}

export function StartupWarmupProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const warmedUserIdRef = useRef<string | null>(null)
  const sessionUserIdRef = useRef<string | undefined>(session?.user?.id)

  useEffect(() => {
    sessionUserIdRef.current = session?.user?.id
  }, [session?.user?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || warmedUserIdRef.current === userId) return
    warmedUserIdRef.current = userId

    scheduleIdleWork(() => {
      if (sessionUserIdRef.current !== userId) return

      void localDb.count('kv').catch((error) => {
        console.warn('[startup-warmup] offline db warmup failed:', error)
      })

      const learningStore = useLearningStore.getState()
      if (learningStore.myUnits.length === 0) {
        void learningStore.fetchMyLearning().catch((error) => {
          console.warn('[startup-warmup] learning plan warmup failed:', error)
        })
      }
      void learningStore.fetchDownloadedPacks().catch((error) => {
        console.warn('[startup-warmup] downloaded packs warmup failed:', error)
      })

      const dailyStore = useDailyPracticeStore.getState()
      if (!dailyStore.plan && !dailyStore.loading) {
        void dailyStore.loadToday().catch((error) => {
          console.warn('[startup-warmup] today plan warmup failed:', error)
        })
      }
    }, 1_000)
  }, [session?.user?.id])

  return <>{children}</>
}
