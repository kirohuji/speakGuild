import axios, { type AxiosRequestConfig, type Method } from 'axios'
import { clearBearerToken, getBearerToken } from '@/features/auth/client'

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
  original?: unknown

  constructor(kind: ApiErrorKind, message: string, options?: { status?: number; original?: unknown }) {
    super(message)
    this.name = 'ApiRequestError'
    this.kind = kind
    this.status = options?.status
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

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1/manyu',
  timeout: 15000,
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
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    '请求失败'

  if (status === 401) return new ApiRequestError('unauthorized', message, { status, original: error })
  if (error?.code === 'ECONNABORTED') return new ApiRequestError('timeout', message, { status, original: error })
  if (!error?.response) return new ApiRequestError('network', message, { status, original: error })
  return new ApiRequestError('server', message, { status, original: error })
}

instance.interceptors.request.use((config) => {
  if (isOffline()) {
    throw new ApiRequestError('offline', '当前处于离线状态')
  }

  const token = getBearerToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data && typeof data === 'object' && 'data' in data) {
      return data.data
    }
    return data
  },
  (error) => {
    if (error?.response?.status === 401) {
      clearBearerToken()
    }
    const normalized = normalizeError(error)
    console.error('[API Error]', normalized.message, error)
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
    return Promise.reject(new ApiRequestError('cooldown', '请求刚刚失败过，稍后再试'))
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
    if (cooldownMs > 0 && normalized.kind !== 'cooldown') {
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
