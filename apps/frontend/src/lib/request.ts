import i18next from 'i18next'
import axios, { type AxiosRequestConfig, type Method } from 'axios'
import { clearBearerToken, getBearerToken } from '@/features/auth/client'
import { reportClientError } from '@/lib/monitoring'
import { resolveFileAssetReferences, serializeFileAssetReferences } from '@/lib/file-asset-reference'

if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('manyu-device-id')
  } catch {
    /* ignore */
  }
}

export type ApiErrorKind = 'offline' | 'cooldown' | 'unauthorized' | 'timeout' | 'network' | 'server'

export class ApiRequestError extends Error {
  kind: ApiErrorKind
  status?: number
  apiCode?: string
  original?: unknown

  constructor(kind: ApiErrorKind, message: string, options?: { status?: number; apiCode?: string; original?: unknown }) {
    super(message)
    this.name = 'ApiRequestError'
    this.kind = kind
    this.status = options?.status
    this.apiCode = options?.apiCode
    this.original = options?.original
  }
}

export type RequestOptions = AxiosRequestConfig & {
  dedupe?: boolean
  failureCooldownMs?: number
}

const DEFAULT_GET_FAILURE_COOLDOWN_MS = 30_000
const inflightRequests = new Map<string, Promise<unknown>>()
const failedUntil = new Map<string, number>()
if (typeof window !== 'undefined') window.addEventListener('online', () => failedUntil.clear())

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1/manyu',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function stableStringify(value: unknown): string {
  if (!value) return ''
  try {
    return JSON.stringify(value, (_key, current) => {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return current
      return Object.keys(current as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (current as Record<string, unknown>)[key]
          return acc
        }, {})
    })
  } catch {
    return String(value)
  }
}

function requestKey(method: Method, url: string, params?: unknown, data?: unknown) {
  return [
    method.toUpperCase(),
    url,
    stableStringify(params),
    stableStringify(data),
  ].join('|')
}

function normalizeError(error: any): ApiRequestError {
  if (error instanceof ApiRequestError) return error

  const status = error?.response?.status
  const apiCode = typeof error?.response?.data?.code === 'string' ? error.response.data.code : undefined
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    '请求失败'

  if (status >= 500) return new ApiRequestError('server', i18next.t('network.unavailable'), { status, apiCode, original: error })
  if (status === 401) return new ApiRequestError('unauthorized', message, { status, apiCode, original: error })
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return new ApiRequestError('timeout', i18next.t('network.unavailable'), { status, apiCode, original: error })
  if (!error?.response) return new ApiRequestError(isOffline() ? 'offline' : 'network', i18next.t(isOffline() ? 'network.offline' : 'network.unavailable'), { status, apiCode, original: error })
  return new ApiRequestError('server', message, { status, apiCode, original: error })
}

instance.interceptors.request.use((config) => {
  if (isOffline()) {
    throw new ApiRequestError('offline', i18next.t('network.offline'))
  }

  const token = getBearerToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (timeZone) config.headers['X-Client-Time-Zone'] = timeZone
  } catch {
    /* The backend has a stable fallback for runtimes without Intl timezone data. */
  }
  config.data = serializeFileAssetReferences(config.data)
  config.params = serializeFileAssetReferences(config.params)
  return config
})

instance.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data && typeof data === 'object' && 'data' in data) {
      return resolveFileAssetReferences(data.data)
    }
    return resolveFileAssetReferences(data)
  },
  (error) => {
    if (error?.response?.status === 401) {
      clearBearerToken()
      // Notify auth system so it can redirect to login page
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    const normalized = normalizeError(error)
    if (!['offline', 'network', 'timeout', 'cooldown'].includes(normalized.kind)) console.error('[API Error]', normalized.message, error)
    if (normalized.status && normalized.status >= 500) {
      reportClientError(normalized, 'api.5xx')
    }
    return Promise.reject(normalized)
  },
)

export function request<T = any>(
  method: Method,
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { dedupe, failureCooldownMs, params, data, ...axiosConfig } = options
  const normalizedMethod = method.toLowerCase() as Method
  const key = requestKey(normalizedMethod, url, params, data)
  const cooldownMs = failureCooldownMs ?? (normalizedMethod === 'get' ? DEFAULT_GET_FAILURE_COOLDOWN_MS : 0)
  const cooldownUntil = failedUntil.get(key) ?? 0

  if (cooldownMs > 0 && cooldownUntil > Date.now()) {
    return Promise.reject(new ApiRequestError('cooldown', i18next.t('network.unavailable')))
  }

  const shouldDedupe = dedupe ?? normalizedMethod === 'get'
  if (shouldDedupe && inflightRequests.has(key)) {
    return inflightRequests.get(key)! as Promise<T>
  }

  const promise = instance.request<any, T>({
    ...axiosConfig,
    method: normalizedMethod,
    url,
    params,
    data,
  }).catch((error) => {
    const normalized = normalizeError(error)
    if (cooldownMs > 0 && normalized.kind !== 'cooldown' && normalized.kind !== 'offline') {
      failedUntil.set(key, Date.now() + cooldownMs)
    }
    throw normalized
  }).finally(() => {
    inflightRequests.delete(key)
  })

  if (shouldDedupe) {
    inflightRequests.set(key, promise)
  }

  return promise
}

export const get = <T = any>(url: string, params?: Record<string, any>, options?: RequestOptions): Promise<T> =>
  request<T>('get', url, { ...options, params })

export const post = <T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> =>
  request<T>('post', url, { ...options, data })

export const put = <T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> =>
  request<T>('put', url, { ...options, data })

export const patch = <T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> =>
  request<T>('patch', url, { ...options, data })

export const del = <T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> =>
  request<T>('delete', url, { ...options, data })

export default instance
