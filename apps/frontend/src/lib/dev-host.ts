/**
 * Dev-host (live reload) mode detection.
 *
 * In dev:host mode, the Capacitor WebView loads from a Vite dev server
 * (e.g. http://192.168.50.116:5173) instead of the bundled app. This
 * causes two known edge cases:
 *
 * 1. `crypto.subtle` is unavailable (non-secure origin)
 * 2. SQLite connections may be lost when the app backgrounds/resumes
 *
 * Use this module to guard workarounds that should ONLY apply in dev:host
 * and NEVER in production builds.
 */
import { isNative } from '@/lib/native/platform'

/** True when running in Capacitor live-reload (dev:host) mode. */
export const isDevHost: boolean = import.meta.env.DEV && isNative()

/** True when the Web Crypto API (`crypto.subtle`) is unavailable. */
export const isCryptoSubtleUnavailable: boolean =
  typeof crypto === 'undefined' || !crypto.subtle
