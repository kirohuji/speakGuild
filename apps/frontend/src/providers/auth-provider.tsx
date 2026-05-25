import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authClient, clearBearerToken } from '@/features/auth/client'
import { getBootstrap } from '@/features/question-bank/api'
import { useConfigStore } from '@/stores/config.store'

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

  const fetchSession = async (): Promise<Session | null> => {
    try {
      const raw = await authClient.getSession()
      const nextSession = normalizeSessionResponse(raw)
      setSession(nextSession)

      if (nextSession?.user?.id) {
        try {
          const boot = await getBootstrap()
          useConfigStore.getState().hydrateFromBootstrap(boot)
        } catch {
          useConfigStore.getState().clearConfig()
        }
      } else {
        useConfigStore.getState().clearConfig()
      }

      return nextSession
    } catch {
      setSession(null)
      useConfigStore.getState().clearConfig()
      return null
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()
  }, [])

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
    setSession(null)
    useConfigStore.getState().clearConfig()
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