import * as React from "react"

const MOBILE_BREAKPOINT = 1024
// iPad Pro 13-inch is 1376 CSS px wide in landscape. Keep a small buffer for
// browser chrome / future iPad sizes, without classifying a regular desktop as mobile.
const TABLET_MOBILE_MAX_VIEWPORT = 1440

function isIPad() {
  if (typeof navigator === 'undefined') return false

  // iPadOS may report itself as macOS when requesting desktop-class websites.
  return /iPad/i.test(navigator.userAgent)
    || /iPad/i.test(navigator.platform)
    || ((navigator.platform === 'MacIntel' || /Macintosh/i.test(navigator.userAgent)) && navigator.maxTouchPoints > 1)
}

function isTouchTablet() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false

  // This is the fallback for iPadOS browser variants that expose neither an
  // iPad UA nor the usual platform value. A desktop without touch input does
  // not match, while iPad Pro works in both portrait and landscape.
  const hasTouchInput = navigator.maxTouchPoints > 1 || window.matchMedia('(any-pointer: coarse)').matches
  const viewportLongestSide = Math.max(window.innerWidth, window.innerHeight)

  return hasTouchInput && viewportLongestSide <= TABLET_MOBILE_MAX_VIEWPORT
}

function usesMobileExperience() {
  if (typeof window === 'undefined') return false
  return isIPad() || isTouchTablet() || window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(usesMobileExperience)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(usesMobileExperience())
    }
    mql.addEventListener("change", onChange)
    window.addEventListener("resize", onChange)
    setIsMobile(usesMobileExperience())
    return () => {
      mql.removeEventListener("change", onChange)
      window.removeEventListener("resize", onChange)
    }
  }, [])

  return isMobile
}
