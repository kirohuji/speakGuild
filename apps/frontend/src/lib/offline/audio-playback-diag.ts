/**
 * Temporary audio playback diagnostics for native pack / library debugging.
 *
 * Safari / WebView console filter: MANYU_AUDIO_DIAG
 * Enabled only in Capacitor live-reload (CAP_LIVE_RELOAD_URL / isDevHost).
 */

import { isDevHost } from '@/lib/dev-host'

export const AUDIO_DIAG_PREFIX = '[MANYU_AUDIO_DIAG]'

export function isAudioDiagEnabled(): boolean {
  return isDevHost
}

function shorten(url: string | null | undefined, max = 120): string | null {
  if (!url) return null
  if (url.length <= max) return url
  return `${url.slice(0, max)}…`
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    if (url.startsWith('asset://')) return 'asset://'
    if (url.startsWith('capacitor://') || url.startsWith('file:')) return 'local'
    return new URL(url.startsWith('//') ? `https:${url}` : url).host
  } catch {
    return 'unparsed'
  }
}

export function audioDiag(step: string, data?: Record<string, unknown>) {
  if (!isAudioDiagEnabled()) return
  const safe = data
    ? Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        if (typeof value === 'string' && (key.toLowerCase().includes('url') || key === 'resolved')) {
          return [key, shorten(value)]
        }
        return [key, value]
      }),
    )
    : undefined
  if (safe === undefined) console.log(`${AUDIO_DIAG_PREFIX} ${step}`)
  else console.log(`${AUDIO_DIAG_PREFIX} ${step}`, { ...safe, host: hostOf(typeof data?.url === 'string' ? data.url : typeof data?.requestedUrl === 'string' ? data.requestedUrl : null) })
}
