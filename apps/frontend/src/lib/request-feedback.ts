import { toast } from 'sonner'
import i18next from 'i18next'
import { ApiRequestError } from './request'

let lastNetworkNotice = 0
export function showRequestError(error: unknown, fallback: string, options?: { background?: boolean }) {
  const candidate = error as { status?: number; kind?: string; code?: string; message?: string; name?: string }
  const kind = error instanceof ApiRequestError ? error.kind : candidate?.kind
  const networkFailure = [502, 503, 504].includes(candidate?.status ?? 0) || ['offline', 'network', 'timeout', 'cooldown'].includes(kind ?? '') ||
    /^(ERR_NETWORK|ECONNABORTED|ETIMEDOUT)$/.test(candidate?.code ?? '') ||
    /^(Network Error|Failed to fetch|Load failed|Network request failed)$/i.test(candidate?.message ?? '')
  if (candidate?.name === 'AbortError' || candidate?.code === 'ERR_CANCELED') return
  if (networkFailure) {
    // Repeated background fetches and cooldown rejections are not new user actions.
    if (options?.background || kind === 'cooldown' || Date.now() - lastNetworkNotice < 15_000) return
    lastNetworkNotice = Date.now()
    const offline = kind === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine)
    toast.info(i18next.t(offline ? 'network.offline' : 'network.unavailable'), { id: 'network-feedback', duration: 3500 })
    return
  }
  toast.error(candidate?.message || fallback)
}
