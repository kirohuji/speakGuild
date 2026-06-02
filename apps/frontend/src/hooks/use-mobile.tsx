import * as React from "react"

const MOBILE_BREAKPOINT = 1024

function isIPad() {
  if (typeof navigator === 'undefined') return false

  // iPadOS may report itself as macOS when requesting desktop-class websites.
  return /iPad/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function usesMobileExperience() {
  if (typeof window === 'undefined') return false
  return isIPad() || window.innerWidth < MOBILE_BREAKPOINT
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
