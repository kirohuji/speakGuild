import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ScriptService {
  constructor(private readonly prisma: PrismaService) {}

  async getChapters(userId: string) {
    const episodes = await this.prisma.storyEpisode.findMany({
      orderBy: [{ chapterKey: 'asc' }, { sortOrder: 'asc' }],
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
      if (!chapterMap.has(ep.chapterKey)) {
        chapterMap.set(ep.chapterKey, {
          chapterId: ep.chapterKey,
          chapterTitle: ep.chapterName,
          episodes: [],
        });
      }
      const userPassed = ep.records.length > 0 && ep.records[0].passed;
      chapterMap.get(ep.chapterKey).episodes.push({
        id: ep.id,
        title: ep.title,
        episodeOrder: ep.sortOrder,
        requiredOutputLevel: ep.requiredOutputLevel,
        requiredUserLevel: ep.requiredUserLevel,
        isPreview: ep.isPreview,
        passed: userPassed,
      });
    }

    return Array.from(chapterMap.values());
  }

  async getEpisodeDetail(episodeId: string, userId: string) {
    const episode = await this.prisma.storyEpisode.findUnique({
      where: { id: episodeId },
      include: {
        scene: { select: { id: true, title: true, location: true } },
        vocabularies: {
          include: { vocabulary: true },
          orderBy: { sortOrder: 'asc' },
        },
        chunks: {
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
    if (!episode) return null;
    return {
      ...episode,
      chapterId: episode.chapterKey,
      chapterTitle: episode.chapterName,
      episodeOrder: episode.sortOrder,
      npcName: episode.characterName,
      npcRole: episode.characterRole,
      npcPersonality: episode.characterPersona,
      vocabRequiredCount: episode.requiredVocabularyCount,
      vocabTotalCount: episode.totalVocabularyCount,
      chunkRequiredCount: episode.requiredChunkCount,
      chunkTotalCount: episode.totalChunkCount,
      prerequisiteEpisodes: episode.prerequisiteEpisodeIds,
      passObjectiveCount: episode.requiredObjectiveCount,
      passChunkCount: episode.requiredUsedChunkCount,
      passRetellRequired: episode.requiresRetell,
      passMinDialogues: episode.minimumTurnCount,
      coreVocabularies: episode.vocabularies.map((item) => ({ ...item, vocab: item.vocabulary })),
      coreChunks: episode.chunks,
    };
  }

  async getInkScript(episodeId: string) {
    const episode = await this.prisma.storyEpisode.findUnique({
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
    const episode = await this.prisma.storyEpisode.findUnique({
      where: { id: episodeId },
      select: {
        requiredOutputLevel: true,
        requiredVocabularyCount: true,
        requiredChunkCount: true,
        sceneId: true,
        prerequisiteEpisodeIds: true,
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
    const prereqEpisodes = (episode.prerequisiteEpisodeIds ?? []) as string[];
    if (prereqEpisodes.length > 0) {
      const passedCount = await this.prisma.storyRecord.count({
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
      vocabRequired: episode.requiredVocabularyCount,
      chunkMastered: sceneProgress?.chunkMastered ?? 0,
      chunkRequired: episode.requiredChunkCount,
      readiness: sceneProgress?.readiness ?? 0,
    };
  }

  async getEpisodeForJudge(episodeId: string) {
    return this.prisma.storyEpisode.findUnique({
      where: { id: episodeId },
      select: {
        id: true,
        scene: { select: { title: true } },
        characterName: true,
        characterRole: true,
        characterPersona: true,
        objectives: true,
        chunks: {
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
    return this.prisma.storyTurn.create({
      data: {
        userId,
        episodeId,
        npcText: data.npcText,
        userText: data.userText,
        round: data.round,
        chunksUsed: data.chunksUsed ?? [],
        objectivesCompleted: data.objectiveCompleted ?? [],
      },
    });
  }

  async submitRetell(userId: string, episodeId: string, body: { userTranscript: string; targetText: string }) {
    // Save retell attempt and mark retellCompleted on the record
    await this.prisma.storyRecord.upsert({
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
      objectivesDone?: number;
      chunksUsed?: number;
      dialogueRounds?: number;
      completedObjectiveCount?: number;
      usedChunkCount?: number;
      turnCount?: number;
      retellCompleted: boolean;
      aiFeedback?: any;
    },
  ) {
    const normalized = {
      passed: data.passed,
      completedObjectiveCount: data.completedObjectiveCount ?? data.objectivesDone ?? 0,
      usedChunkCount: data.usedChunkCount ?? data.chunksUsed ?? 0,
      turnCount: data.turnCount ?? data.dialogueRounds ?? 0,
      retellCompleted: data.retellCompleted,
      aiFeedback: data.aiFeedback,
    };
    const record = await this.prisma.storyRecord.upsert({
      where: { userId_episodeId: { userId, episodeId } },
      create: {
        userId,
        episodeId,
        ...normalized,
        xpEarned: data.passed ? 30 : 0,
        completedAt: data.passed ? new Date() : null,
      },
      update: {
        ...normalized,
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
    const records = await this.prisma.storyRecord.findMany({
      where: { userId },
      include: {
        episode: {
          select: { id: true, title: true, chapterKey: true, chapterName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => ({
      ...record,
      objectivesDone: record.completedObjectiveCount,
      chunksUsed: record.usedChunkCount,
      dialogueRounds: record.turnCount,
      episode: {
        ...record.episode,
        chapterId: record.episode.chapterKey,
        chapterTitle: record.episode.chapterName,
      },
    }));
  }
}
