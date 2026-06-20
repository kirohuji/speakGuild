import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isNative } from '@/lib/native'

type SwipeDirection = 'left' | 'right'

const PRIMARY_ROUTES = ['/', '/learning', '/expressions'] as const
const MIN_SWIPE_DISTANCE = 70
const MAX_VERTICAL_DRIFT = 90
const EDGE_GUARD = 12

function normalizePath(pathname: string) {
  if (pathname !== '/' && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

function isPrimaryRoute(pathname: string) {
  return (PRIMARY_ROUTES as readonly string[]).includes(normalizePath(pathname))
}

function isGestureBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  const explicitBlock = target.closest(
    [
      'input',
      'textarea',
      'select',
      '[role="dialog"]',
      '[data-mobile-gesture-block]',
      '[data-horizontal-scroll]',
      '.overflow-x-auto',
      '.scrollbar-hide',
    ].join(','),
  )
  if (explicitBlock) return true

  if (target.closest('[data-mobile-gesture-allow]')) return false

  const interactive = target.closest(
    [
      'button',
      'a',
      '[role="button"]',
    ].join(','),
  )
  if (interactive) return true
  return false
}

function hasOpenOverlay() {
  return Boolean(
    document.querySelector(
      [
        '[role="dialog"][data-state="open"]',
        '[data-radix-popper-content-wrapper]',
        '[data-mobile-gesture-block="true"]',
      ].join(','),
    ),
  )
}

function getPrimaryNavigation(pathname: string, direction: SwipeDirection) {
  const current = normalizePath(pathname)
  const index = PRIMARY_ROUTES.indexOf(current as (typeof PRIMARY_ROUTES)[number])
  if (index < 0) return null

  const nextIndex = direction === 'left' ? index + 1 : index - 1
  return PRIMARY_ROUTES[nextIndex] ?? null
}

function shouldLetExpressionTabsHandle(pathname: string) {
  return normalizePath(pathname) === '/expressions'
    && document.body.dataset.mobileExpressionTab
    && document.body.dataset.mobileExpressionTab !== 'words'
}

function shouldBackInsteadOfPrimary(pathname: string) {
  const current = normalizePath(pathname)
  if (current.startsWith('/admin') || current.startsWith('/auth') || current === '/portal' || current === '/company') {
    return false
  }
  return !isPrimaryRoute(current)
}

export function MobileGestureProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isNative()) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let blocked = false

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return

      startX = touch.clientX
      startY = touch.clientY
      startTime = Date.now()
      blocked = isGestureBlockedTarget(event.target) || hasOpenOverlay()

      if (startX < EDGE_GUARD || startX > window.innerWidth - EDGE_GUARD) {
        blocked = true
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (blocked) return

      const touch = event.changedTouches[0]
      if (!touch) return

      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      if (absX < MIN_SWIPE_DISTANCE || absY > MAX_VERTICAL_DRIFT || absX < absY * 1.4) return

      const direction: SwipeDirection = dx < 0 ? 'left' : 'right'
      const elapsed = Date.now() - startTime
      if (elapsed > 850 && absX < 120) return

      if (direction === 'right' && shouldBackInsteadOfPrimary(location.pathname)) {
        navigate(-1)
        return
      }

      if (shouldLetExpressionTabsHandle(location.pathname)) {
        return
      }

      const nextPath = getPrimaryNavigation(location.pathname, direction)
      if (nextPath) {
        navigate(nextPath)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [location.pathname, navigate])

  return <>{children}</>
}
