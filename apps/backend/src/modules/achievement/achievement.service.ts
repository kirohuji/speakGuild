import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

const DEFAULT_ACHIEVEMENTS = [
  { key: 'first_practice', name: '初次练习', description: '完成第一次场景练习', icon: 'Play', category: 'practice', condition: { type: 'session_count', threshold: 1 }, sortOrder: 1 },
  { key: 'practice_10', name: '学有所成', description: '累计完成 10 次场景练习', icon: 'BookOpen', category: 'practice', condition: { type: 'session_count', threshold: 10 }, sortOrder: 2 },
  { key: 'practice_50', name: '勤奋刻苦', description: '累计完成 50 次场景练习', icon: 'PenLine', category: 'practice', condition: { type: 'session_count', threshold: 50 }, sortOrder: 3 },
  { key: 'practice_100', name: '百炼成钢', description: '累计完成 100 次场景练习', icon: 'Zap', category: 'practice', condition: { type: 'session_count', threshold: 100 }, sortOrder: 4 },
  { key: 'practice_500', name: '学神降临', description: '累计完成 500 次场景练习', icon: 'Crown', category: 'practice', condition: { type: 'session_count', threshold: 500 }, sortOrder: 5 },
  { key: 'streak_3', name: '三日之约', description: '连续 3 天打卡学习', icon: 'Flame', category: 'streak', condition: { type: 'streak_days', threshold: 3 }, sortOrder: 6 },
  { key: 'streak_7', name: '周而复始', description: '连续 7 天打卡学习', icon: 'Flame', category: 'streak', condition: { type: 'streak_days', threshold: 7 }, sortOrder: 7 },
  { key: 'streak_30', name: '月度达人', description: '连续 30 天打卡学习', icon: 'Flame', category: 'streak', condition: { type: 'streak_days', threshold: 30 }, sortOrder: 8 },
  { key: 'word_20', name: '词汇大师', description: '生词本收集 20 个单词', icon: 'BookMarked', category: 'collection', condition: { type: 'word_count', threshold: 20 }, sortOrder: 9 },
  { key: 'chunk_10', name: '表达达人', description: '掌握 10 个 Chunk 表达块', icon: 'MessageSquare', category: 'collection', condition: { type: 'chunk_count', threshold: 10 }, sortOrder: 10 },
  { key: 'script_1', name: '初入剧本', description: '通关第一个剧本剧集', icon: 'Clapperboard', category: 'script', condition: { type: 'script_count', threshold: 1 }, sortOrder: 11 },
  { key: 'script_10', name: '剧本达人', description: '通关 10 个剧本剧集', icon: 'Trophy', category: 'script', condition: { type: 'script_count', threshold: 10 }, sortOrder: 12 },
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
    const [sessionCount, scriptCount, chunkCount, words, activities] = await Promise.all([
      this.prisma.practiceSession.count({ where: { userId } }),
      this.prisma.scriptRecord.count({ where: { userId, passed: true } }),
      this.prisma.userChunkProgress.count({
        where: { userId, status: { in: ['can_output', 'mastered'] } },
      }),
      this.prisma.expressionItem.count({ where: { userId } }),
      this.prisma.dailyActivity.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ])

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
      session_count: sessionCount,
      script_count: scriptCount,
      chunk_count: chunkCount,
      word_count: words,
      streak_days: streakDays,
    }
  }
}
