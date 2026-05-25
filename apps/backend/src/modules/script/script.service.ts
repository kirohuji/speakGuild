import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ScriptService {
  constructor(private readonly prisma: PrismaService) {}

  async getChapters(userId: string) {
    const episodes = await this.prisma.scriptEpisode.findMany({
      orderBy: [{ chapterId: 'asc' }, { episodeOrder: 'asc' }],
      include: {
        records: {
          where: { userId },
          select: { passed: true },
        },
      },
    });

    // Group by chapter
    const chapterMap = new Map<string, any>();
    for (const ep of episodes) {
      if (!chapterMap.has(ep.chapterId)) {
        chapterMap.set(ep.chapterId, {
          chapterId: ep.chapterId,
          chapterTitle: ep.chapterTitle,
          episodes: [],
        });
      }
      const userPassed = ep.records.length > 0 && ep.records[0].passed;
      chapterMap.get(ep.chapterId).episodes.push({
        id: ep.id,
        title: ep.title,
        episodeOrder: ep.episodeOrder,
        requiredOutputLevel: ep.requiredOutputLevel,
        requiredUserLevel: ep.requiredUserLevel,
        isPreview: ep.isPreview,
        passed: userPassed,
      });
    }

    return Array.from(chapterMap.values());
  }

  async getEpisodeDetail(episodeId: string, userId: string) {
    const episode = await this.prisma.scriptEpisode.findUnique({
      where: { id: episodeId },
      include: {
        scene: { select: { id: true, title: true, location: true } },
        coreVocabularies: {
          include: { vocab: true },
          orderBy: { sortOrder: 'asc' },
        },
        coreChunks: {
          include: {
            chunk: {
              include: {
                examples: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        records: {
          where: { userId },
          select: { passed: true },
        },
      },
    });
    return episode;
  }

  async getInkScript(episodeId: string) {
    const episode = await this.prisma.scriptEpisode.findUnique({
      where: { id: episodeId },
      select: { inkScriptId: true },
    });
    if (!episode?.inkScriptId) return null;

    return this.prisma.inkScript.findUnique({
      where: { id: episode.inkScriptId },
      select: { inkJson: true, key: true, title: true },
    });
  }

  async getEpisodeReadiness(episodeId: string, userId: string) {
    const episode = await this.prisma.scriptEpisode.findUnique({
      where: { id: episodeId },
      select: {
        requiredOutputLevel: true,
        vocabRequiredCount: true,
        chunkRequiredCount: true,
        sceneId: true,
        prerequisiteEpisodes: true,
      },
    });
    if (!episode) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { outputLevel: true },
    });

    const userLevel = parseInt(user?.outputLevel?.replace('L', '') ?? '0');
    const requiredLevel = parseInt((episode.requiredOutputLevel ?? 'L1').replace('L', ''));

    // Check prerequisites
    let prerequisiteCompleted = true;
    const prereqEpisodes = (episode.prerequisiteEpisodes ?? []) as string[];
    if (prereqEpisodes.length > 0) {
      const passedCount = await this.prisma.scriptRecord.count({
        where: {
          userId,
          episodeId: { in: prereqEpisodes },
          passed: true,
        },
      });
      prerequisiteCompleted = passedCount >= prereqEpisodes.length;
    }

    // Scene progress
    const sceneProgress = episode.sceneId
      ? await this.prisma.userSceneProgress.findUnique({
          where: { userId_sceneId: { userId, sceneId: episode.sceneId } },
        })
      : null;

    return {
      outputLevelSatisfied: userLevel >= requiredLevel,
      prerequisiteCompleted,
      vocabLearned: sceneProgress?.vocabLearned ?? 0,
      vocabRequired: episode.vocabRequiredCount,
      chunkMastered: sceneProgress?.chunkMastered ?? 0,
      chunkRequired: episode.chunkRequiredCount,
      readiness: sceneProgress?.readiness ?? 0,
    };
  }

  async getEpisodeForJudge(episodeId: string) {
    return this.prisma.scriptEpisode.findUnique({
      where: { id: episodeId },
      select: {
        id: true,
        scene: { select: { title: true } },
        npcName: true,
        npcRole: true,
        npcPersonality: true,
        objectives: true,
        coreChunks: {
          include: { chunk: { select: { text: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async saveDialogue(userId: string, episodeId: string, data: {
    npcText: string;
    userText: string;
    round: number;
    chunksUsed?: string[];
    objectiveCompleted?: string[];
  }) {
    return this.prisma.scriptDialogue.create({
      data: {
        userId,
        episodeId,
        npcText: data.npcText,
        userText: data.userText,
        round: data.round,
        chunksUsed: data.chunksUsed ?? [],
        objectiveCompleted: data.objectiveCompleted ?? [],
      },
    });
  }

  async submitRetell(userId: string, episodeId: string, body: { userTranscript: string; targetText: string }) {
    // Save retell attempt and mark retellCompleted on the record
    await this.prisma.scriptRecord.upsert({
      where: { userId_episodeId: { userId, episodeId } },
      create: {
        userId,
        episodeId,
        passed: false,
        retellCompleted: true,
      },
      update: {
        retellCompleted: true,
      },
    });
    return { success: true };
  }

  async completeEpisode(
    userId: string,
    episodeId: string,
    data: {
      passed: boolean;
      objectivesDone: number;
      chunksUsed: number;
      dialogueRounds: number;
      retellCompleted: boolean;
      aiFeedback?: any;
    },
  ) {
    const record = await this.prisma.scriptRecord.upsert({
      where: { userId_episodeId: { userId, episodeId } },
      create: {
        userId,
        episodeId,
        ...data,
        xpEarned: data.passed ? 30 : 0,
        completedAt: data.passed ? new Date() : null,
      },
      update: {
        ...data,
        xpEarned: data.passed ? 30 : 0,
        completedAt: data.passed ? new Date() : null,
      },
    });

    // Add XP if passed
    if (data.passed) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { totalXp: { increment: 30 } },
      });
    }

    return record;
  }

  async getRecords(userId: string) {
    return this.prisma.scriptRecord.findMany({
      where: { userId },
      include: {
        episode: {
          select: { id: true, title: true, chapterId: true, chapterTitle: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
