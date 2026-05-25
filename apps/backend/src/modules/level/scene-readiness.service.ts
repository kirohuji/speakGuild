import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * 场景准备度计算服务
 *
 * 权重分配:
 * - 输出等级满足: 25%
 * - 核心 Chunk 掌握度: 30%
 * - 场景词汇掌握度: 20%
 * - 前置任务完成: 15%
 * - 相关录音练习: 10%
 *
 * 准备度 >= 70% 可进入挑战
 */
@Injectable()
export class SceneReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  readonly WEIGHTS = {
    outputLevel: 0.25,
    chunkMastery: 0.30,
    vocabMastery: 0.20,
    prerequisite: 0.15,
    practice: 0.10,
  };

  readonly READINESS_THRESHOLD = 70;

  async calculateReadiness(userId: string, sceneId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { outputLevel: true },
    });

    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: {
        requiredOutputLevel: true,
        _count: { select: { vocabularies: true, chunks: true } },
      },
    });

    if (!user || !scene) return 0;

    const progress = await this.prisma.userSceneProgress.findUnique({
      where: { userId_sceneId: { userId, sceneId } },
    });

    const requiredLevel = parseInt(scene.requiredOutputLevel.replace('L', ''));
    const userLevel = parseInt(user.outputLevel.replace('L', ''));
    const outputLevelScore = userLevel >= requiredLevel ? 1 : 0;

    const vocabLearned = progress?.vocabLearned ?? 0;
    const vocabTotal = scene._count.vocabularies;
    const vocabScore = vocabTotal > 0 ? vocabLearned / vocabTotal : 0;

    const chunkMastered = progress?.chunkMastered ?? 0;
    const chunkTotal = scene._count.chunks;
    const chunkScore = chunkTotal > 0 ? chunkMastered / chunkTotal : 0;

    const prerequisiteScore = progress?.prerequisiteCompleted ? 1 : 0;

    const practiceCount = progress?.completedPracticeCount ?? 0;
    const practiceScore = Math.min(practiceCount / 3, 1);

    const readiness =
      outputLevelScore * this.WEIGHTS.outputLevel * 100 +
      chunkScore * this.WEIGHTS.chunkMastery * 100 +
      vocabScore * this.WEIGHTS.vocabMastery * 100 +
      prerequisiteScore * this.WEIGHTS.prerequisite * 100 +
      practiceScore * this.WEIGHTS.practice * 100;

    return Math.round(readiness);
  }
}
