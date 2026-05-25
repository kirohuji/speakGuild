import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { XpCalculatorService } from './xp-calculator.service';
import { OutputLevelService } from './output-level.service';
import { SceneReadinessService } from './scene-readiness.service';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class LevelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xpCalc: XpCalculatorService,
    private readonly outputLevel: OutputLevelService,
    private readonly sceneReadiness: SceneReadinessService,
  ) {}

  async getOverview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        outputLevel: true,
        totalXp: true,
        userLevel: true,
      },
    });

    if (!user) return null;

    const xpForNext = this.xpCalc.xpForLevel(user.userLevel);
    const sceneProgresses = await this.prisma.userSceneProgress.findMany({
      where: { userId },
      include: { scene: { select: { id: true, title: true } } },
    });

    const chunkStats = await this.prisma.userChunkProgress.aggregate({
      where: { userId },
      _count: true,
    });
    const masteredChunks = await this.prisma.userChunkProgress.count({
      where: { userId, status: { in: ['can_output', 'mastered'] } },
    });
    const outputLevelDetail = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { outputLevelDetail: true },
    });

    return {
      userLevel: user.userLevel,
      totalXp: user.totalXp,
      xpForNextLevel: xpForNext,
      outputLevel: user.outputLevel,
      outputLevelDescription: this.outputLevel.LEVEL_DESCRIPTIONS[user.outputLevel] ?? '',
      outputLevelDetail: outputLevelDetail?.outputLevelDetail ?? null,
      totalChunks: chunkStats._count,
      masteredChunks,
      sceneProgresses,
    };
  }

  async getWeeklyStats(userId: string) {
    const weekAgo = new Date(Date.now() - WEEK_MS);
    const [recordings, topicsCompleted, chunksMastered, streak] = await Promise.all([
      this.prisma.practiceRecord.count({
        where: { userId, actionType: 'record', createdAt: { gte: weekAgo } },
      }),
      this.prisma.practiceRecord.count({
        where: { userId, actionType: 'retell', createdAt: { gte: weekAgo } },
      }),
      this.prisma.userChunkProgress.count({
        where: {
          userId,
          status: { in: ['can_output', 'mastered'] },
          updatedAt: { gte: weekAgo },
        },
      }),
      this.getStreak(userId),
    ]);
    // Total practice time estimate: assume avg 60s per recording
    const totalPracticeMinutes = Math.round((recordings * 60 + topicsCompleted * 120) / 60);

    return { recordings, topicsCompleted, chunksMastered, totalPracticeMinutes, streakDays: streak };
  }

  async getCommonErrors(userId: string) {
    // Group error_sentence expressions by the error text pattern
    const errors = await this.prisma.expressionItem.findMany({
      where: { userId, type: 'error_sentence' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Count frequency of similar errors by keyword extraction
    const errorMap = new Map<string, { count: number; example: string; type: string }>();
    const errorPatterns = [
      { pattern: /very\s+\w+/i, label: '副词使用 (very + adj)', type: 'grammar' },
      { pattern: /listen\s+music|hear\s+music/i, label: '搭配错误 (listen to)', type: 'collocation' },
      { pattern: /make\s+(me|him|her)\s+(relax|happy)/i, label: '表达习惯 (make sb + adj)', type: 'chinglish' },
      { pattern: /play\s+(phone|game|computer)/i, label: '中式表达 (play phone)', type: 'chinglish' },
      { pattern: /I\s+(very|so)\s+/i, label: '副词位置 (I very like)', type: 'grammar' },
      { pattern: /there\s+(is|are)\s+have/i, label: '存在句结构 (there have)', type: 'grammar' },
      { pattern: /although\s+.*\s+but/i, label: '连词重复 (although...but)', type: 'grammar' },
    ];

    for (const err of errors) {
      if (!err.original) continue;
      for (const { pattern, label, type } of errorPatterns) {
        if (pattern.test(err.original)) {
          const existing = errorMap.get(label);
          if (existing) {
            existing.count++;
          } else {
            errorMap.set(label, { count: 1, example: err.original, type });
          }
          break;
        }
      }
    }

    return Array.from(errorMap.entries())
      .map(([error, data]) => ({ error, count: data.count, example: data.example, type: data.type }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  async getRecommendedPath(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { outputLevel: true },
    });
    if (!user) return null;

    const scenes = await this.prisma.scene.findMany({
      take: 5,
      orderBy: { requiredOutputLevel: 'asc' },
      select: { id: true, title: true, requiredOutputLevel: true },
    });

    const userProgress = await this.prisma.userSceneProgress.findMany({
      where: { userId },
    });
    const progressMap = new Map(userProgress.map((p) => [p.sceneId, p]));

    const currentLevelNum = parseInt(user.outputLevel.replace('L', '') || '1');
    const recommended = scenes
      .filter((s) => {
        const lvl = parseInt(s.requiredOutputLevel.replace('L', '') || '1');
        return lvl >= currentLevelNum && lvl <= currentLevelNum + 1;
      })
      .map((s) => {
        const p = progressMap.get(s.id);
        return {
          sceneId: s.id,
          sceneTitle: s.title,
          readiness: p?.readiness ?? 0,
          mastery: p?.mastery ?? 0,
        };
      })
      .sort((a, b) => a.readiness - b.readiness)
      .slice(0, 3);

    return {
      currentLevel: user.outputLevel,
      description: this.outputLevel.LEVEL_DESCRIPTIONS[user.outputLevel] ?? '',
      recommendedScenes: recommended,
      overallAdvice: this.outputLevel.getAdvice(user.outputLevel),
    };
  }

  private async getStreak(userId: string): Promise<number> {
    const activities = await this.prisma.dailyActivity.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 365,
      select: { date: true },
    });
    if (activities.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < activities.length; i++) {
      const expected = new Date(today.getTime() - i * 86400000);
      const actual = new Date(activities[i].date);
      if (actual.toDateString() === expected.toDateString()) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  async addXp(userId: string, amount: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totalXp: { increment: amount } },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalXp: true, userLevel: true },
    });
    if (user) {
      const newLevel = this.xpCalc.calculateLevel(user.totalXp);
      if (newLevel !== user.userLevel) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { userLevel: newLevel },
        });
      }
    }
  }
}
