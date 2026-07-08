import { useEffect, useRef, type ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { splashScreen } from '@/lib/native/splash-screen'
import { isNative } from '@/lib/native/platform'

function GuardLoading() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground"
      role="status"
      aria-live="polite"
      aria-label="正在检查登录状态"
    >
      <img src="/logo.png" alt="" className="size-16 object-contain dark:invert" />
      <span className="sr-only">正在检查登录状态...</span>
    </div>
  )
}

function useHideNativeSplashWhenReady(ready: boolean) {
  const hiddenRef = useRef(false)

  useEffect(() => {
    if (!isNative() || !ready || hiddenRef.current) return
    hiddenRef.current = true

    let secondFrame: number | null = null
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        void splashScreen.hide({ fadeOutDuration: 180 }).catch((error) => {
          console.warn('[auth-route] hide splash failed:', error)
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame)
    }
  }, [ready])
}

export function RequireAuth({ children }: { children: ReactElement }) {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <GuardLoading />
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export function GuestOnly({ children }: { children: ReactElement }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <GuardLoading />
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return children
}

export function AuthRouteGate({ children }: { children: ReactElement }) {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()
  const isAuthPage = location.pathname === '/auth/login' || location.pathname === '/auth/register' || location.pathname === '/auth/forgot-password'
  const isPublicPage =
    location.pathname === '/portal' ||
    location.pathname === '/marketing' ||
    location.pathname === '/company' ||
    location.pathname === '/support' ||
    location.pathname === '/feedback' ||
    location.pathname.startsWith('/system/') ||
    isAuthPage

  useHideNativeSplashWhenReady(isAuthPage || !isLoading)

  // Keep auth pages stable while auth state refreshes (e.g. during sign-in attempt).
  // This avoids full-page flicker on login failures.
  if (isAuthPage) {
    if (!isLoading && isAuthenticated) {
      return <Navigate to="/" replace />
    }
    return children
  }

  if (isLoading) return isNative() ? null : <GuardLoading />

  if (!isAuthenticated && !isPublicPage) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  }

  return children
}
