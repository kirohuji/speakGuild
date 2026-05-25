import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SceneService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.sceneCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        scenes: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            location: true,
            requiredOutputLevel: true,
            requiredUserLevel: true,
          },
        },
      },
    });
  }

  async getSceneDetail(sceneId: string) {
    return this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        category: true,
        vocabularies: { orderBy: { sortOrder: 'asc' } },
        chunks: {
          orderBy: { createdAt: 'asc' },
          include: { examples: { orderBy: { sortOrder: 'asc' } } },
        },
        trainingTopics: {
          orderBy: { sortOrder: 'asc' },
          include: {
            activeChunks: {
              include: { chunk: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        prerequisiteScenes: {
          include: { prerequisite: true },
        },
      },
    });
  }

  async getSceneReadiness(userId: string, sceneId: string) {
    const progress = await this.prisma.userSceneProgress.findUnique({
      where: { userId_sceneId: { userId, sceneId } },
    });

    if (!progress) {
      const scene = await this.prisma.scene.findUnique({
        where: { id: sceneId },
        select: {
          requiredOutputLevel: true,
          requiredUserLevel: true,
          _count: { select: { vocabularies: true, chunks: true } },
        },
      });

      if (!scene) return null;

      return {
        readiness: 0,
        mastery: 0,
        vocabLearned: 0,
        vocabTotal: scene._count.vocabularies,
        chunkMastered: 0,
        chunkTotal: scene._count.chunks,
        completedPracticeCount: 0,
        completedScriptCount: 0,
        prerequisiteCompleted: false,
      };
    }

    return progress;
  }
}
