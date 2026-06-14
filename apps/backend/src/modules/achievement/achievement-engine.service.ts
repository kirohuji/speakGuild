import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * 成就检测引擎 (V2)
 *
 * 事件驱动模式：在关键用户行为发生后自动检测成就。
 * 成就系统负责庆祝里程碑，等级系统负责量化成长，两者互补。
 *
 * 成就稀有度:
 * - common 普通（灰色）
 * - rare 稀有（蓝色）
 * - epic 史诗（紫色）
 * - legendary 传说（金色）
 */
@Injectable()
export class AchievementEngineService {
  private readonly logger = new Logger(AchievementEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 事件 → 成就映射表
   * 每个事件触发时检查关联的成就条件
   */
  private readonly eventChecks: Record<string, AchievementCheck[]> = {
    'recording.completed': [
      { achievementKey: 'first_recording', type: 'count', threshold: 1 },
      { achievementKey: 'recording_10', type: 'count', threshold: 10 },
      { achievementKey: 'recording_50', type: 'count', threshold: 50 },
      { achievementKey: 'recording_100', type: 'count', threshold: 100 },
      { achievementKey: 'recording_500', type: 'count', threshold: 500 },
    ],
    'chunk.mastered': [
      { achievementKey: 'chunk_learn_20', type: 'count', threshold: 20 },
      { achievementKey: 'chunk_learn_50', type: 'count', threshold: 50 },
      { achievementKey: 'chunk_learn_100', type: 'count', threshold: 100 },
      { achievementKey: 'chunk_learn_300', type: 'count', threshold: 300 },
    ],
    'script.completed': [
      { achievementKey: 'first_script_clear', type: 'count', threshold: 1 },
      { achievementKey: 'chapter_1_all', type: 'chapter_complete', chapterId: 'chapter_1' },
      { achievementKey: 'chapter_2_all', type: 'chapter_complete', chapterId: 'chapter_2' },
      { achievementKey: 'perfect_script', type: 'perfect_clear' },
      { achievementKey: 'one_take', type: 'streak', threshold: 3 },
    ],
    'streak.updated': [
      { achievementKey: 'streak_7', type: 'threshold', threshold: 7 },
      { achievementKey: 'streak_30', type: 'threshold', threshold: 30 },
      { achievementKey: 'streak_100', type: 'threshold', threshold: 100 },
    ],
    'level.output_changed': [
      { achievementKey: 'level_l3', type: 'threshold', threshold: 'L3' },
      { achievementKey: 'level_l5', type: 'threshold', threshold: 'L5' },
    ],
    'retell.completed': [
      { achievementKey: 'first_retell', type: 'count', threshold: 1 },
      { achievementKey: 'retell_master', type: 'streak', threshold: 10 },
    ],
    'scene.mastery_updated': [
      { achievementKey: 'scene_dorm_80', type: 'scene_threshold', sceneId: 'dorm_checkin', threshold: 80 },
      { achievementKey: 'scene_campus_all', type: 'category_threshold', categoryId: 'campus', threshold: 70 },
    ],
    'practice.completed': [
      { achievementKey: 'first_practice', type: 'count', threshold: 1 },
      { achievementKey: 'practice_10', type: 'count', threshold: 10 },
      { achievementKey: 'practice_50', type: 'count', threshold: 50 },
      { achievementKey: 'practice_100', type: 'count', threshold: 100 },
    ],
    'daily.login': [
      { achievementKey: 'hidden_night_owl', type: 'time_range', startHour: 0, endHour: 5 },
    ],
  };

  /**
   * 事件触发入口
   * 由各业务模块在关键操作完成后调用
   */
  async onEvent(
    eventType: string,
    userId: string,
    payload: any = {},
  ): Promise<string[]> {
    const checks = this.eventChecks[eventType];
    if (!checks || checks.length === 0) return [];

    const newlyUnlocked: string[] = [];
    for (const check of checks) {
      try {
        const unlocked = await this.evaluateAndUnlock(userId, check, payload);
        if (unlocked) {
          newlyUnlocked.push(check.achievementKey);
        }
      } catch (err) {
        this.logger.warn(
          `Achievement check failed: ${check.achievementKey} for user ${userId}`,
          (err as Error).message,
        );
      }
    }

    if (newlyUnlocked.length > 0) {
      this.logger.log(
        `User ${userId} unlocked achievements: ${newlyUnlocked.join(', ')}`,
      );
    }

    return newlyUnlocked;
  }

  /**
   * 评估单个成就条件并解锁
   */
  private async evaluateAndUnlock(
    userId: string,
    check: AchievementCheck,
    payload: any,
  ): Promise<boolean> {
    // 1. 查找成就定义
    const def = await this.prisma.achievementDef.findUnique({
      where: { key: check.achievementKey },
    });
    if (!def) {
      // Achievement not seeded yet, skip
      return false;
    }

    // 2. 检查是否已解锁
    const existing = await this.prisma.userAchievementV2.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId: def.id,
        },
      },
    });
    if (existing && existing.status !== 'locked') {
      return false; // Already unlocked
    }

    // 3. 计算进度
    const { progress, target } = await this.calculateProgress(
      userId,
      check,
      payload,
    );

    // 4. 判断是否达标
    const isUnlocked = progress >= target;

    // 5. 更新或创建进度
    await this.prisma.userAchievementV2.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId: def.id,
        },
      },
      create: {
        userId,
        achievementId: def.id,
        status: isUnlocked ? 'unlocked' : 'locked',
        progress,
        progressTarget: target,
        unlockedAt: isUnlocked ? new Date() : null,
      },
      update: {
        progress: Math.max(progress, existing?.progress ?? 0),
        progressTarget: target,
        ...(isUnlocked && { status: 'unlocked', unlockedAt: new Date() }),
      },
    });

    // 6. 发放 XP 奖励
    if (isUnlocked && def.rewardXp > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { totalXp: { increment: def.rewardXp } },
      });
    }

    return isUnlocked;
  }

  /**
   * 计算成就进度
   */
  private async calculateProgress(
    userId: string,
    check: AchievementCheck,
    payload: any,
  ): Promise<{ progress: number; target: number }> {
    const rawTarget = check.threshold ?? 1;
    const target: number =
      typeof rawTarget === 'string'
        ? parseInt((rawTarget as string).replace('L', ''))
        : (rawTarget as number);

    switch (check.type) {
      case 'count':
        // payload 中应包含当前累计值
        return { progress: payload.currentCount ?? 0, target };

      case 'threshold':
        // For level thresholds, compare as string levels
        if (typeof check.threshold === 'string' && (check.threshold as string).startsWith('L')) {
          const currentLevel = parseInt((payload.currentValue as string)?.replace('L', '') ?? '0');
          const targetLevel = parseInt((check.threshold as string).replace('L', ''));
          return { progress: currentLevel, target: targetLevel };
        }
        return { progress: payload.currentValue ?? 0, target };

      case 'streak':
        // 连续成功次数
        return { progress: payload.streakCount ?? 0, target };

      case 'chapter_complete': {
        const count = await this.prisma.storyRecord.count({
          where: {
            userId,
            passed: true,
            episode: { chapterKey: check.chapterId! },
          },
        });
        const total = await this.prisma.storyEpisode.count({
          where: { chapterKey: check.chapterId! },
        });
        return { progress: count, target: total };
      }

      case 'perfect_clear': {
        // payload 中 shouldPerfect=true 表示本次达成了完美通关
        const perfectCount = await this.prisma.storyRecord.count({
          where: {
            userId,
            passed: true,
            AND: [
              { completedObjectiveCount: { gte: 4 } },
              { usedChunkCount: { gte: 3 } },
              { retellCompleted: true },
            ],
          },
        });
        return { progress: perfectCount, target: 1 };
      }

      case 'scene_threshold': {
        if (!check.sceneId) return { progress: 0, target };
        const sp = await this.prisma.userSceneProgress.findUnique({
          where: {
            userId_sceneId: { userId, sceneId: check.sceneId },
          },
        });
        return { progress: sp?.mastery ?? 0, target };
      }

      case 'category_threshold': {
        if (!check.categoryId) return { progress: 0, target };
        const progresses = await this.prisma.userSceneProgress.findMany({
          where: {
            userId,
            scene: { categoryId: check.categoryId },
          },
        });
        const avgMastery =
          progresses.length > 0
            ? progresses.reduce((sum, p) => sum + p.mastery, 0) / progresses.length
            : 0;
        return { progress: Math.round(avgMastery), target };
      }

      case 'time_range': {
        const hour = new Date().getHours();
        const inRange =
          hour >= (check.startHour ?? 0) && hour <= (check.endHour ?? 24);
        return { progress: inRange ? 1 : 0, target: 1 };
      }

      default:
        return { progress: 0, target: 1 };
    }
  }

  /**
   * 获取用户所有成就状态（用于成就殿堂展示）
   */
  async getAllWithUserStatus(userId: string) {
    const [defs, userAchievements] = await Promise.all([
      this.prisma.achievementDef.findMany({
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.userAchievementV2.findMany({
        where: { userId },
      }),
    ]);

    const userMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua]),
    );

    return defs.map((def) => {
      const ua = userMap.get(def.id);
      return {
        ...def,
        userStatus: ua?.status ?? 'locked',
        progress: ua?.progress ?? 0,
        progressTarget: ua?.progressTarget ?? 0,
        unlockedAt: ua?.unlockedAt ?? null,
        // 隐藏成就：未解锁时不暴露详情
        ...(def.isHidden &&
          (!ua || ua.status === 'locked') && {
            title: '???',
            description: def.hintText ?? '神秘的成就，等待你去发现…',
            icon: null,
          }),
      };
    });
  }

  /**
   * 标记成就为已查看
   */
  async markSeen(userId: string, achievementId: string) {
    return this.prisma.userAchievementV2.update({
      where: { userId_achievementId: { userId, achievementId } },
      data: { status: 'seen', seenAt: new Date() },
    });
  }
}

interface AchievementCheck {
  achievementKey: string;
  type:
    | 'count'
    | 'threshold'
    | 'streak'
    | 'chapter_complete'
    | 'perfect_clear'
    | 'scene_threshold'
    | 'category_threshold'
    | 'time_range';
  threshold?: number | string;
  chapterId?: string;
  sceneId?: string;
  categoryId?: string;
  startHour?: number;
  endHour?: number;
}
