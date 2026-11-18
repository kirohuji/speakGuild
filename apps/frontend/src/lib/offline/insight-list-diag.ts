/**
 * Lean insight / immersive playlist diagnostics.
 *
 * Safari / WebView console filter: MANYU_INSIGHT_LIST
 * Enabled only in Capacitor live-reload (CAP_LIVE_RELOAD_URL / isDevHost).
 */

import { isDevHost } from '@/lib/dev-host'

export const INSIGHT_LIST_DIAG_PREFIX = '[MANYU_INSIGHT_LIST]'

export function isInsightListDiagEnabled(): boolean {
  return isDevHost
}

export function insightListDiag(step: string, data?: Record<string, unknown>) {
  if (!isInsightListDiagEnabled()) return
  if (data === undefined) console.log(`${INSIGHT_LIST_DIAG_PREFIX} ${step}`)
  else console.log(`${INSIGHT_LIST_DIAG_PREFIX} ${step}`, data)
}
