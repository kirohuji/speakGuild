import { useEffect, useState } from 'react'

export function useDelayedLoading(loading: boolean, delay = 300) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!loading) {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timer)
  }, [delay, loading])

  return visible
}
