import axios from 'axios'
import { clearBearerToken, getBearerToken } from '@/features/auth/client'

if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('guide-exam-device-id')
  } catch {
    /* ignore */
  }
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1/guide-exam',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

instance.interceptors.request.use((config) => {
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
    if (error.response?.status === 401) {
      clearBearerToken()
    }
    const msg =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      '请求失败'
    console.error('[API Error]', msg, error)
    return Promise.reject(error)
  }
)

export const get = <T = any>(url: string, params?: Record<string, any>): Promise<T> =>
  instance.get(url, { params }) as any

export const post = <T = any>(url: string, data?: any): Promise<T> =>
  instance.post(url, data) as any

export const put = <T = any>(url: string, data?: any): Promise<T> =>
  instance.put(url, data) as any

export const patch = <T = any>(url: string, data?: any): Promise<T> =>
  instance.patch(url, data) as any

export const del = <T = any>(url: string): Promise<T> =>
  instance.delete(url) as any

export default instance
