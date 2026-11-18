import * as Sentry from '@sentry/capacitor'
import {
  browserTracingIntegration,
  init as sentryReactInit,
} from '@sentry/react'

type ClientErrorPayload = {
  message: string
  stack?: string
  source: string
  route: string
  userAgent: string
}

let installed = false
let sentryEnabled = false
const sentRecently = new Map<string, number>()

function apiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || '/api/v1/manyu'
}

function shouldSend(key: string) {
  const now = Date.now()
  const last = sentRecently.get(key) ?? 0
  if (now - last < 60_000) return false
  sentRecently.set(key, now)
  return true
}

export function reportClientError(error: unknown, source = 'client') {
  const message = error instanceof Error ? error.message : String(error || 'Unknown client error')
  const stack = error instanceof Error ? error.stack : undefined
  const payload: ClientErrorPayload = {
    message,
    stack,
    source,
    route: window.location.hash || window.location.pathname,
    userAgent: navigator.userAgent,
  }

  const key = `${source}:${message}:${payload.route}`
  if (!shouldSend(key)) return

  void Promise.allSettled([
    fetch(`${apiBaseUrl()}/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }),
  ])

  if (sentryEnabled) {
    Sentry.withScope((scope) => {
      scope.setTag('source', payload.source)
      scope.setTag('route', payload.route)
      scope.setContext('client', {
        route: payload.route,
        userAgent: payload.userAgent,
        stack: payload.stack,
      })
      Sentry.captureException(error instanceof Error ? error : new Error(payload.message))
    })
  }
}

export function installMonitoring() {
  if (installed || typeof window === 'undefined') return
  installed = true

  // 仅当构建/环境注入了 DSN 时启用；本地不填即不上报。
  const dsn = String(import.meta.env.VITE_SENTRY_DSN || '').trim()
  if (dsn) {
    const isProd = import.meta.env.PROD
    Sentry.init(
      {
        dsn,
        environment: import.meta.env.MODE,
        enableAutoSessionTracking: true,
        enableLogs: false,
        integrations: (defaultIntegrations) => [
          ...defaultIntegrations,
          browserTracingIntegration(),
        ],
        sendDefaultPii: false,
        // 生产抽样；开发有 DSN 时也不打满量 tracing。
        tracesSampleRate: isProd ? 0.1 : 0,
      },
      sentryReactInit,
    )
    sentryEnabled = true
  }

  window.addEventListener('error', (event) => {
    reportClientError(event.error || event.message, 'window.error')
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, 'unhandledrejection')
  })
}
