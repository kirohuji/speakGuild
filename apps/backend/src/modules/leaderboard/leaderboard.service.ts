import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getPracticeLeaderboard(bankId?: string, limit = 50) {
    const where: any = {}
    const items = await this.prisma.practiceRecord.groupBy({
      by: ['userId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    })
    const userIds = items.map((i) => i.userId)
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    return items.map((item, idx) => ({
      rank: idx + 1,
      userId: item.userId,
      userName: userMap.get(item.userId)?.name || '未知用户',
      userImage: userMap.get(item.userId)?.image,
      score: item._count.id,
    }))
  }

  async getMockExamLeaderboard(bankId?: string, limit = 50) {
    const items = await this.prisma.mockExamRecord.groupBy({
      by: ['userId'],
      _max: { score: true },
      orderBy: { _max: { score: 'desc' } },
      take: limit,
    })
    const userIds = items.map((i) => i.userId)
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    return items.map((item, idx) => ({
      rank: idx + 1,
      userId: item.userId,
      userName: userMap.get(item.userId)?.name || '未知用户',
      userImage: userMap.get(item.userId)?.image,
      score: item._max.score,
    }))
  }

  async getStreakLeaderboard(limit = 50) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const activities = await this.prisma.dailyActivity.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      orderBy: [{ userId: 'asc' }, { date: 'desc' }],
      select: { userId: true, date: true },
    })

    const streakMap = new Map<string, number>()
    for (const a of activities) {
      if (!streakMap.has(a.userId)) {
        let streak = 0
        const userDates = activities
          .filter((x) => x.userId === a.userId)
          .map((x) => new Date(x.date).toISOString().split('T')[0])
          .sort()
          .reverse()

        if (userDates.length > 0) {
          streak = 1
          for (let i = 1; i < userDates.length; i++) {
            const prev = new Date(userDates[i - 1])
            const curr = new Date(userDates[i])
            const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000)
            if (diffDays === 1) {
              streak++
            } else if (diffDays > 1) {
              break
            }
          }
        }
        streakMap.set(a.userId, streak)
      }
    }

    const sorted = [...streakMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    const userIds = sorted.map(([id]) => id)
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    return sorted.map(([userId, streak], idx) => ({
      rank: idx + 1,
      userId,
      userName: userMap.get(userId)?.name || '未知用户',
      userImage: userMap.get(userId)?.image,
      score: streak,
    }))
  }
}
