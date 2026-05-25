import axios from 'axios'
import { getBearerToken } from '@/features/auth/client'

const api = axios.create({ baseURL: '/api/v1', timeout: 15000, headers: { 'Content-Type': 'application/json' } })
api.interceptors.request.use((c) => { const t = getBearerToken(); if (t) c.headers.Authorization = `Bearer ${t}`; return c })
api.interceptors.response.use(
  (r) => (r.data && typeof r.data === 'object' && 'data' in r.data ? r.data.data : r.data),
  (e) => Promise.reject(e),
)

export const onboardingApi = {
  getStatus: () => api.get('/onboarding/status'),
  selectGoals: (goals: string[]) => api.post('/onboarding/goals', { goals }),
  selectAbility: (outputLevel: string) => api.post('/onboarding/ability', { outputLevel }),
  submitDiagnostic: (result: any) => api.post('/onboarding/diagnostic/result', result),
}

export default api
