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
        trainingTopics: {
          orderBy: { sortOrder: 'asc' },
          include: {
            topicVocabs: {
              include: { vocab: true },
              orderBy: { sortOrder: 'asc' },
            },
            activeChunks: {
              include: {
                chunk: {
                  include: { examples: { orderBy: { sortOrder: 'asc' } } },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
            topicPatterns: {
              include: { pattern: true },
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
          trainingTopics: {
            select: {
              _count: { select: { topicVocabs: true, activeChunks: true } },
            },
          },
        },
      });

      if (!scene) return null;

      let vocabTotal = 0;
      let chunkTotal = 0;
      for (const t of scene.trainingTopics) {
        vocabTotal += (t as any)._count?.topicVocabs ?? 0;
        chunkTotal += (t as any)._count?.activeChunks ?? 0;
      }

      return {
        readiness: 0,
        mastery: 0,
        vocabLearned: 0,
        vocabTotal,
        chunkMastered: 0,
        chunkTotal,
        completedPracticeCount: 0,
        completedScriptCount: 0,
        prerequisiteCompleted: false,
      };
    }

    return progress;
  }
}
