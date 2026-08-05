/**
 * Unified logger for offline modules.
 *
 * Previously every file had its own console prefix style:
 *   [learning-pack]  [offline-sync]  [practiceRepo]  [learning-store]  ...
 * with no level control. This wrapper centralises the prefix and lets
 * production builds suppress noisy debug/info output.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

// Dev builds keep info+ logs; production only shows warnings and errors.
const CURRENT_LEVEL: LogLevel =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV ? 'info' : 'warn'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[CURRENT_LEVEL]
}

export function createLogger(scope: string) {
  const prefix = `[${scope}]`
  return {
    debug: (message: string, data?: unknown) => {
      if (shouldLog('debug')) console.debug(prefix, message, data ?? '')
    },
    info: (message: string, data?: unknown) => {
      if (shouldLog('info')) console.log(prefix, message, data ?? '')
    },
    warn: (message: string, data?: unknown) => {
      if (shouldLog('warn')) console.warn(prefix, message, data ?? '')
    },
    error: (message: string, data?: unknown) => {
      if (shouldLog('error')) console.error(prefix, message, data ?? '')
    },
  }
}
