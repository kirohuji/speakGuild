import { useState, useEffect } from 'react'

/**
 * 监听浏览器在线/离线状态。
 * 在 Capacitor 原生环境中回退到 navigator.onLine + online/offline 事件。
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
