import { type TouchEvent, useCallback, useRef } from 'react'

/** Finger double-tap is slower / less precise than mouse. */
const DOUBLE_TAP_MS = 450
/** Max distance between the two tap centers (finger pad variance). */
const MAX_TAP_GAP_PX = 56
/** Max movement within a single tap; beyond this treat as scroll/drag. */
const MAX_TAP_TRAVEL_PX = 28

const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="tab"], [role="button"], [data-insight-practice]'

type TapPoint = {
  x: number
  y: number
  time: number
}

/**
 * Double-tap left half → previous tab; right half → next tab.
 * Clamps at edges (no wrap). Ignores taps on interactive controls.
 */
export function useDoubleTapTabSwitch(
  tabs: string[],
  activeTab: string,
  onChangeTab: (next: string) => void,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastTapRef = useRef<TapPoint | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab

  const onTouchStart = useCallback((event: TouchEvent) => {
    if (event.touches.length !== 1) {
      touchStartRef.current = null
      return
    }
    touchStartRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    }
  }, [])

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (event.changedTouches.length !== 1) {
        lastTapRef.current = null
        touchStartRef.current = null
        return
      }

      const target = event.target
      if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) {
        lastTapRef.current = null
        touchStartRef.current = null
        return
      }

      const touch = event.changedTouches[0]
      const start = touchStartRef.current
      touchStartRef.current = null

      // Finger dragged → scroll/swipe, not a tap.
      if (
        start
        && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > MAX_TAP_TRAVEL_PX
      ) {
        lastTapRef.current = null
        return
      }

      const now = Date.now()
      const last = lastTapRef.current

      if (
        last
        && now - last.time <= DOUBLE_TAP_MS
        && Math.hypot(touch.clientX - last.x, touch.clientY - last.y) <= MAX_TAP_GAP_PX
      ) {
        lastTapRef.current = null

        const el = containerRef.current
        if (!el || tabs.length === 0) return

        const rect = el.getBoundingClientRect()
        if (rect.width <= 0) return

        // Use midpoint of the two taps so a slight drift doesn't flip side.
        const midX = (last.x + touch.clientX) / 2
        const goNext = midX >= rect.left + rect.width / 2
        const currentIndex = tabs.indexOf(activeTabRef.current)
        if (currentIndex < 0) return

        const nextIndex = goNext
          ? Math.min(currentIndex + 1, tabs.length - 1)
          : Math.max(currentIndex - 1, 0)

        if (nextIndex !== currentIndex) {
          onChangeTab(tabs[nextIndex]!)
        }
        return
      }

      lastTapRef.current = { x: touch.clientX, y: touch.clientY, time: now }
    },
    [onChangeTab, tabs],
  )

  return { containerRef, onTouchStart, onTouchEnd }
}
