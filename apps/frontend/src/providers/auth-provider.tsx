import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { authClient, clearBearerToken } from '@/features/auth/client'
import { useConfigStore } from '@/stores/config.store'
import { useNotificationStore } from '@/features/notification/store'
import { useProfileCacheStore } from '@/features/profile/profile-cache.store'
import { offlineSyncService } from '@/lib/offline'

/**
 * App 前台同步 Hook
 *
 * 性能策略（针对 Capacitor 端卡顿）：
 *   - 首次同步延迟 8 秒，让首屏完全渲染后再执行
 *   - 使用 requestIdleCallback 确保不阻塞用户交互
 *   - visibility 切回前台时至少间隔 30 秒才再次同步
 *   - 学习包更新检查由 NativeBridgeProvider 统一管理，此处不再重复触发
 */
function useAppForegroundSync(userId: string | undefined) {
  const lastSyncRef = useRef(0)
  const initialSyncDoneRef = useRef(false)

  useEffect(() => {
    if (!userId) return

    const doSync = () => {
      const now = Date.now()
      // 30 秒内不重复同步
      if (now - lastSyncRef.current < 30_000) return
      lastSyncRef.current = now

      void offlineSyncService.sync(userId).catch((error) => {
        console.warn('[offline-sync] foreground sync failed:', error)
      })
    }

    // ★ 首次同步延迟 8 秒，使用 requestIdleCallback 降级
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true
      const scheduleInitialSync = () => {
        doSync()
      }
      if (typeof requestIdleCallback !== 'undefined') {
        const timeoutId = setTimeout(scheduleInitialSync, 13_000) // fallback 保底
        requestIdleCallback(() => {
          clearTimeout(timeoutId)
          scheduleInitialSync()
        }, { timeout: 8000 })
      } else {
        setTimeout(scheduleInitialSync, 8000)
      }
    }

    // 从后台切回前台时也同步（已有 30s 节流）
    const onVisible = () => {
      if (document.visibilityState === 'visible') doSync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId])
}

interface SessionUser {
  id: string
  email: string
  name: string
  image?: string
  username?: string
  phoneNumber?: string
  phoneNumberVerified?: boolean
  emailVerified?: boolean
  role?: 'user' | 'admin'
}

interface Session {
  user: SessionUser
  expiresAt: Date
  token: string
}

type SessionPayload = Session | null

function normalizeSessionResponse(raw: unknown): SessionPayload {
  if (!raw || typeof raw !== 'object') return null

  const direct = raw as Partial<Session>
  if (direct.user?.id) {
    return direct as Session
  }

  const wrapped = (raw as { data?: unknown }).data
  if (wrapped && typeof wrapped === 'object') {
    const maybeSession = wrapped as Partial<Session>
    if (maybeSession.user?.id) {
      return maybeSession as Session
    }
  }

  return null
}

interface AuthContextValue {
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  refreshSession: () => Promise<Session | null>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useAppForegroundSync(session?.user?.id)

  const fetchSession = async (): Promise<Session | null> => {
    try {
      const raw = await authClient.getSession()
      const nextSession = normalizeSessionResponse(raw)
      setSession(nextSession)

      if (nextSession?.user?.id) {
        // Session loaded successfully
      } else {
        // no session
        useProfileCacheStore.getState().reset()
      }

      return nextSession
    } catch {
      setSession(null)
      useConfigStore.getState().clearConfig()
      useProfileCacheStore.getState().reset()
      return null
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()

    // ⏱ 加载超时兜底：5 秒后无论是否完成都退出加载态
    // 防止 iOS 模拟器或弱网环境下 auth 请求卡住导致白屏
    const timeout = window.setTimeout(() => {
      setIsLoading(false)
    }, 5000)

    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const notifications = useNotificationStore.getState()
    if (session?.user?.id) {
      notifications.initSocket(session.user.id)
      void notifications.fetchUnreadCount()
    } else {
      notifications.disconnect()
    }

    return () => {
      useNotificationStore.getState().disconnect()
    }
  }, [session?.user?.id])

  const refreshSession = async () => {
    setIsLoading(true)
    return fetchSession()
  }

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      await authClient.signIn.email({ email, password })
      const nextSession = await refreshSession()
      if (!nextSession?.user?.id) {
        throw new Error('登录失败，请检查账号或密码')
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || '登录失败，请稍后重试'
      setIsLoading(false)
      throw new Error(msg)
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    setIsLoading(true)
    try {
      await authClient.signUp.email({ email, password, name })
      await refreshSession()
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || '注册失败，请稍后重试'
      setIsLoading(false)
      throw new Error(msg)
    }
  }

  const signOut = async () => {
    await authClient.signOut()
    clearBearerToken()
    useProfileCacheStore.getState().reset()
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isAuthenticated: !!session,
        refreshSession,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
