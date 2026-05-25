import axios from 'axios'
import { getBearerToken } from '@/features/auth/client'

const api = axios.create({ baseURL: '/api/v1', timeout: 15000, headers: { 'Content-Type': 'application/json' } })
api.interceptors.request.use((c) => { const t = getBearerToken(); if (t) c.headers.Authorization = `Bearer ${t}`; return c })
api.interceptors.response.use(
  (r) => (r.data && typeof r.data === 'object' && 'data' in r.data ? r.data.data : r.data),
  (e) => Promise.reject(e),
)

export interface AchievementItem {
  id: string; key: string; title: string; description: string
  category: 'milestone' | 'streak' | 'challenge' | 'mastery' | 'hidden' | 'first_time'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  icon: string | null; rewardXp: number; rewardTitle: string | null
  isHidden: boolean; hintText: string | null
  userStatus: 'locked' | 'unlocked' | 'seen'
  progress: number; progressTarget: number
  unlockedAt: string | null
}

export const achievementApi = {
  getAll: () => api.get<any, AchievementItem[]>('/achievements'),
  getUnlocked: () => api.get<any, AchievementItem[]>('/achievements/unlocked'),
  markSeen: (id: string) => api.post(`/achievements/${id}/seen`),
}

export default api
