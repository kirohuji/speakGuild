import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChunkMasteryStatus } from '@prisma/client';

@Injectable()
export class ChunkService {
  constructor(private readonly prisma: PrismaService) {}

  async getChunksByScene(sceneId: string) {
    // Chunks are now linked via TrainingTopic -> TrainingTopicChunk
    const topics = await this.prisma.trainingTopic.findMany({
      where: { sceneId },
      select: {
        activeChunks: {
          include: { chunk: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    const chunkMap = new Map<string, any>();
    for (const topic of topics) {
      for (const ac of topic.activeChunks) {
        if (!chunkMap.has(ac.chunk.id)) {
          chunkMap.set(ac.chunk.id, ac.chunk);
        }
      }
    }
    return [...chunkMap.values()];
  }

  async getMyChunks(userId: string) {
    return this.prisma.userChunkProgress.findMany({
      where: { userId },
      include: { chunk: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async ensureProgress(userId: string, chunkId: string) {
    let progress = await this.prisma.userChunkProgress.findUnique({
      where: { userId_chunkId: { userId, chunkId } },
    });
    if (!progress) {
      progress = await this.prisma.userChunkProgress.create({
        data: { userId, chunkId },
      });
    }
    return progress;
  }

  async activateChunk(userId: string, chunkId: string) {
    await this.ensureProgress(userId, chunkId);
    return this.prisma.userChunkProgress.update({
      where: { userId_chunkId: { userId, chunkId } },
      data: {
        status: ChunkMasteryStatus.activated,
        seenCount: { increment: 1 },
        lastPracticedAt: new Date(),
      },
    });
  }

  async markRead(userId: string, chunkId: string) {
    await this.ensureProgress(userId, chunkId);
    return this.prisma.userChunkProgress.update({
      where: { userId_chunkId: { userId, chunkId } },
      data: {
        status: ChunkMasteryStatus.can_read,
        spokenCount: { increment: 1 },
        lastPracticedAt: new Date(),
      },
    });
  }

  async markOutput(userId: string, chunkId: string, sceneId?: string) {
    await this.ensureProgress(userId, chunkId);
    const data: any = {
      status: ChunkMasteryStatus.can_output,
      correctUseCount: { increment: 1 },
      lastPracticedAt: new Date(),
    };
    if (sceneId) {
      const progress = await this.prisma.userChunkProgress.findUnique({
        where: { userId_chunkId: { userId, chunkId } },
      });
      const existing = (progress?.usedSceneIds ?? []) as string[];
      if (!existing.includes(sceneId)) {
        data.usedSceneIds = [...existing, sceneId];
      }
    }
    return this.prisma.userChunkProgress.update({
      where: { userId_chunkId: { userId, chunkId } },
      data,
    });
  }

  async markMastered(userId: string, chunkId: string) {
    await this.ensureProgress(userId, chunkId);
    return this.prisma.userChunkProgress.update({
      where: { userId_chunkId: { userId, chunkId } },
      data: {
        status: ChunkMasteryStatus.mastered,
        lastPracticedAt: new Date(),
      },
    });
  }
}
