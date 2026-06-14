import * as Sentry from '@sentry/capacitor'
import {
  browserTracingIntegration,
  consoleLoggingIntegration,
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

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (dsn) {
    Sentry.init(
      {
        dsn,
        environment: import.meta.env.MODE,
        enableAutoSessionTracking: true,
        enableLogs: true,
        integrations: (defaultIntegrations) => [
          ...defaultIntegrations,
          browserTracingIntegration(),
          consoleLoggingIntegration({ levels: ['warn', 'error'] }),
        ],
        sendDefaultPii: false,
        tracesSampleRate: 1,
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
