import type { ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'

function GuardLoading() {
  return <div className="p-6 text-center text-sm text-muted-foreground">正在检查登录状态...</div>
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
    return <Navigate to="/profile" replace />
  }
  return children
}

export function AuthRouteGate({ children }: { children: ReactElement }) {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()
  const isAuthPage = location.pathname === '/auth/login' || location.pathname === '/auth/register' || location.pathname === '/auth/forgot-password'
  const isPublicPage = location.pathname === '/portal' || location.pathname.startsWith('/system/') || isAuthPage

  // Keep auth pages stable while auth state refreshes (e.g. during sign-in attempt).
  // This avoids full-page flicker on login failures.
  if (isAuthPage) {
    if (!isLoading && isAuthenticated) {
      return <Navigate to="/profile" replace />
    }
    return children
  }

  if (isLoading) return <GuardLoading />

  if (!isAuthenticated && !isPublicPage) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  }

  return children
}
