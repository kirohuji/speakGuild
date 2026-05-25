import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

const DEFAULT_ACHIEVEMENTS = [
  { key: 'first_practice', name: '初次练习', description: '完成第一次练习', icon: 'Play', category: 'practice', condition: { type: 'practice_count', threshold: 1 }, sortOrder: 1 },
  { key: 'practice_10', name: '学有所成', description: '累计完成 10 次练习', icon: 'BookOpen', category: 'practice', condition: { type: 'practice_count', threshold: 10 }, sortOrder: 2 },
  { key: 'practice_50', name: '勤奋刻苦', description: '累计完成 50 次练习', icon: 'PenLine', category: 'practice', condition: { type: 'practice_count', threshold: 50 }, sortOrder: 3 },
  { key: 'practice_100', name: '百题斩', description: '累计完成 100 次练习', icon: 'Zap', category: 'practice', condition: { type: 'practice_count', threshold: 100 }, sortOrder: 4 },
  { key: 'practice_500', name: '学神降临', description: '累计完成 500 次练习', icon: 'Crown', category: 'practice', condition: { type: 'practice_count', threshold: 500 }, sortOrder: 5 },
  { key: 'streak_3', name: '三日之约', description: '连续 3 天打卡学习', icon: 'Flame', category: 'streak', condition: { type: 'streak_days', threshold: 3 }, sortOrder: 6 },
  { key: 'streak_7', name: '周而复始', description: '连续 7 天打卡学习', icon: 'Flame', category: 'streak', condition: { type: 'streak_days', threshold: 7 }, sortOrder: 7 },
  { key: 'streak_30', name: '月度达人', description: '连续 30 天打卡学习', icon: 'Flame', category: 'streak', condition: { type: 'streak_days', threshold: 30 }, sortOrder: 8 },
  { key: 'first_mock', name: '初试锋芒', description: '完成第一次模拟考试', icon: 'GraduationCap', category: 'mock', condition: { type: 'mock_count', threshold: 1 }, sortOrder: 9 },
  { key: 'mock_5', name: '身经百战', description: '完成 5 次模拟考试', icon: 'Trophy', category: 'mock', condition: { type: 'mock_count', threshold: 5 }, sortOrder: 10 },
  { key: 'mock_90', name: '九十分先生', description: '模拟考试得分 90 分以上', icon: 'Star', category: 'mock', condition: { type: 'mock_score', threshold: 90 }, sortOrder: 11 },
  { key: 'mock_100', name: '满分达人', description: '模拟考试满分 100 分', icon: 'Sparkles', category: 'mock', condition: { type: 'mock_score', threshold: 100 }, sortOrder: 12 },
  { key: 'favorite_10', name: '收藏达人', description: '收藏 10 道题目', icon: 'Heart', category: 'collection', condition: { type: 'favorite_count', threshold: 10 }, sortOrder: 13 },
  { key: 'word_20', name: '词汇大师', description: '生词本收集 20 个单词', icon: 'BookMarked', category: 'collection', condition: { type: 'word_count', threshold: 20 }, sortOrder: 14 },
]

@Injectable()
export class AchievementService {
  constructor(private readonly prisma: PrismaService) {}

  async seedDefaults() {
    for (const a of DEFAULT_ACHIEVEMENTS) {
      await this.prisma.achievement.upsert({
        where: { key: a.key },
        create: a,
        update: {},
      })
    }
  }

  async getAll() {
    await this.seedDefaults()
    return this.prisma.achievement.findMany({ orderBy: { sortOrder: 'asc' } })
  }

  async getUserAchievements(userId: string) {
    await this.seedDefaults()
    const [all, unlocked] = await Promise.all([
      this.prisma.achievement.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
      }),
    ])
    const unlockedKeys = new Set(unlocked.map((u) => u.achievementId))
    return all.map((a) => ({
      ...a,
      unlocked: unlockedKeys.has(a.id),
      unlockedAt: unlocked.find((u) => u.achievementId === a.id)?.unlockedAt || null,
    }))
  }

  async checkAndUnlock(userId: string) {
    await this.seedDefaults()
    const stats = await this.getUserStats(userId)
    const achievements = await this.prisma.achievement.findMany()
    const unlocked = await this.prisma.userAchievement.findMany({ where: { userId } })
    const unlockedIds = new Set(unlocked.map((u) => u.achievementId))

    const newlyUnlocked: string[] = []
    for (const a of achievements) {
      if (unlockedIds.has(a.id)) continue
      const cond = a.condition as any
      if (this.checkCondition(cond, stats)) {
        await this.prisma.userAchievement.create({
          data: { userId, achievementId: a.id },
        })
        newlyUnlocked.push(a.key)
      }
    }
    return newlyUnlocked
  }

  private checkCondition(cond: any, stats: Record<string, number>) {
    const { type, threshold } = cond
    return (stats[type] || 0) >= threshold
  }

  private async getUserStats(userId: string) {
    const [practiceCount, mockRecords, favorites, words, activities] = await Promise.all([
      this.prisma.practiceRecord.count({ where: { userId } }),
      this.prisma.mockExamRecord.findMany({
        where: { userId },
        select: { score: true },
      }),
      this.prisma.favoriteQuestion.count({ where: { userId } }),
      this.prisma.vocabularyWord.count({ where: { userId } }),
      this.prisma.dailyActivity.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ])

    const maxMockScore = mockRecords.reduce((max, r) => Math.max(max, r.score), 0)
    const mockCount = mockRecords.length

    let streakDays = 0
    const dates = activities.map((a) => new Date(a.date).toISOString().split('T')[0]).sort().reverse()
    if (dates.length > 0) {
      streakDays = 1
      for (let i = 1; i < dates.length; i++) {
        const diff = Math.round(
          (new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime()) / 86400000,
        )
        if (diff === 1) streakDays++
        else break
      }
    }

    return {
      practice_count: practiceCount,
      mock_count: mockCount,
      mock_score: maxMockScore,
      favorite_count: favorites,
      word_count: words,
      streak_days: streakDays,
    }
  }
}
