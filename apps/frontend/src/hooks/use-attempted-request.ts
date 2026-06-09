import { useCallback, useRef } from 'react'

export function useAttemptedRequest() {
  const attemptedRef = useRef(new Set<string>())

  const hasAttempted = useCallback((key: string) => attemptedRef.current.has(key), [])

  const markAttempted = useCallback((key: string) => {
    attemptedRef.current.add(key)
  }, [])

  const resetAttempted = useCallback((prefix?: string) => {
    if (!prefix) {
      attemptedRef.current.clear()
      return
    }

    for (const key of attemptedRef.current) {
      if (key.startsWith(prefix)) {
        attemptedRef.current.delete(key)
      }
    }
  }, [])

  const runOnce = useCallback(async <T,>(key: string, task: () => Promise<T>): Promise<T | undefined> => {
    if (attemptedRef.current.has(key)) return undefined
    attemptedRef.current.add(key)
    return task()
  }, [])

  return {
    hasAttempted,
    markAttempted,
    resetAttempted,
    runOnce,
  }
}
