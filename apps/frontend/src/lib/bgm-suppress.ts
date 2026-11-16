import { useEffect } from 'react'

const reasons = new Set<string>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

export function setBgmSuppressed(reason: string, suppressed: boolean) {
  const before = reasons.size
  if (suppressed) reasons.add(reason)
  else reasons.delete(reason)
  if (reasons.size !== before) notify()
}

export function isBgmSuppressed() {
  return reasons.size > 0
}

export function subscribeBgmSuppress(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Pause ambient BGM while a practice surface is active. */
export function useBgmSuppress(reason: string, active: boolean) {
  useEffect(() => {
    setBgmSuppressed(reason, active)
    return () => setBgmSuppressed(reason, false)
  }, [reason, active])
}

const PRACTICE_ROUTE_RE = /^\/(practice\/session|learning\/(writing|reading|listening)|scripts\/(player|nqtr))\b/

export function isPracticeBgmRoute(pathname: string) {
  return PRACTICE_ROUTE_RE.test(pathname)
}
