import { get, post } from '@/lib/request'

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
  getAll: () => get<AchievementItem[]>('/achievements'),
  getUnlocked: () => get<AchievementItem[]>('/achievements/unlocked'),
  markSeen: (id: string) => post(`/achievements/${id}/seen`),
}

export default achievementApi
