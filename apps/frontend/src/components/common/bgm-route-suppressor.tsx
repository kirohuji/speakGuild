import { useLocation } from 'react-router-dom'
import { isPracticeBgmRoute, useBgmSuppress } from '@/lib/bgm-suppress'

/** Suppress ambient BGM on practice routes (provider sits outside the router). */
export function BgmRouteSuppressor() {
  const { pathname } = useLocation()
  useBgmSuppress('practice-route', isPracticeBgmRoute(pathname))
  return null
}
