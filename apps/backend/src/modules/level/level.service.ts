import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { XpCalculatorService } from './xp-calculator.service';
import { OutputLevelService } from './output-level.service';
import { SceneReadinessService } from './scene-readiness.service';

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

    return {
      userLevel: user.userLevel,
      totalXp: user.totalXp,
      xpForNextLevel: xpForNext,
      outputLevel: user.outputLevel,
      outputLevelDescription: this.outputLevel.LEVEL_DESCRIPTIONS[user.outputLevel] ?? '',
      totalChunks: chunkStats._count,
      masteredChunks,
      sceneProgresses,
    };
  }

  async addXp(userId: string, amount: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totalXp: { increment: amount } },
    });
    // Recalculate level
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
