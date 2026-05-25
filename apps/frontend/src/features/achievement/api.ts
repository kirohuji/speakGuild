import { get, post } from '@/lib/request'

export interface AchievementItem {
  id: string
  key: string
  name: string
  description: string
  icon: string
  category: string
  condition: any
  sortOrder: number
  unlocked: boolean
  unlockedAt: string | null
}

export function getAllAchievements() {
  return get<AchievementItem[]>('/achievements')
}

export function getMyAchievements() {
  return get<AchievementItem[]>('/achievements/mine')
}

export function checkAchievements() {
  return post<{ unlocked: string[] }>('/achievements/check')
}
