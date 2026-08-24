import { useEffect, useState } from 'react'

export function isManagementHashRoute() {
  return typeof window !== 'undefined' && /^#\/admin(?:\/|$)/.test(window.location.hash)
}

export function useManagementHashRoute() {
  const [managementRoute, setManagementRoute] = useState(isManagementHashRoute)

  useEffect(() => {
    const update = () => setManagementRoute(isManagementHashRoute())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return managementRoute
}
