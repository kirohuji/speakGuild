import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import {
  initTransitions,
  setupPage,
  setupRouterOutlet,
} from '@capgo/capacitor-transitions/react'
import '@capgo/capacitor-transitions'
import { isNative } from '@/lib/native'

let transitionsInitialized = false

function ensureTransitionsInitialized() {
  if (transitionsInitialized || typeof window === 'undefined') return
  initTransitions({ platform: 'auto' })
  transitionsInitialized = true
}

export function MobileTransitionOutlet({ children }: { children: ReactNode }) {
  const location = useLocation()
  const outletRef = useRef<HTMLElement | null>(null)
  const pageRef = useRef<HTMLElement | null>(null)
  const enabled = isNative()

  useEffect(() => {
    if (!enabled) return
    ensureTransitionsInitialized()
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const outlet = outletRef.current
    if (!outlet) return

    setupRouterOutlet(outlet, {
      platform: 'auto',
      keepInDom: true,
      maxCached: 8,
      swipeGesture: 'auto',
    })
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const page = pageRef.current
    if (!page) return
    return setupPage(page)
  }, [enabled, location.key])

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <cap-router-outlet ref={outletRef} className="block h-full w-full">
      <cap-page key={location.key} ref={pageRef} className="h-full w-full">
        <cap-content slot="content" fullscreen scroll-x="false" scroll-y="false" className="h-full w-full">
          {children}
        </cap-content>
      </cap-page>
    </cap-router-outlet>
  )
}
