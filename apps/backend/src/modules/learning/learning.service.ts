import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取全部「教材」（即 Scene）列表，附带用户进度
   */
  async getLearningUnits(userId: string) {
    const categories = await this.prisma.sceneCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        scenes: {
          orderBy: { createdAt: 'asc' },
          include: {
            _count: { select: { vocabularies: true, chunks: true, trainingTopics: true, scriptEpisodes: true } },
          },
        },
      },
    });

    // 批量查询用户场景进度
    const allSceneIds = categories.flatMap((c) => c.scenes.map((s) => s.id));
    const progresses = await this.prisma.userSceneProgress.findMany({
      where: { userId, sceneId: { in: allSceneIds } },
    });
    const progressMap = new Map(progresses.map((p) => [p.sceneId, p]));

    // 查询用户等级/输出级别
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userLevel: true, outputLevel: true },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      units: cat.scenes.map((scene) => {
        const prog = progressMap.get(scene.id);
        const totalItems =
          scene._count.vocabularies + scene._count.chunks + scene._count.trainingTopics;
        const completedItems =
          (prog?.vocabLearned ?? 0) +
          (prog?.chunkMastered ?? 0) +
          (prog?.completedPracticeCount ?? 0);

        const isUnlocked =
          (user?.userLevel ?? 1) >= scene.requiredUserLevel;

        return {
          id: scene.id,
          title: scene.title,
          location: scene.location,
          requiredOutputLevel: scene.requiredOutputLevel,
          requiredUserLevel: scene.requiredUserLevel,
          isUnlocked,
          vocabCount: scene._count.vocabularies,
          chunkCount: scene._count.chunks,
          topicCount: scene._count.trainingTopics,
          scriptCount: scene._count.scriptEpisodes,
          progress: prog
            ? {
                readiness: prog.readiness,
                mastery: prog.mastery,
                vocabLearned: prog.vocabLearned,
                vocabTotal: scene._count.vocabularies,
                chunkMastered: prog.chunkMastered,
                chunkTotal: scene._count.chunks,
                completedPracticeCount: prog.completedPracticeCount,
                completedScriptCount: prog.completedScriptCount,
              }
            : null,
          completionPercent:
            totalItems > 0
              ? Math.round((completedItems / totalItems) * 100)
              : 0,
        };
      }),
    }));
  }

  /**
   * 获取某个学习单元的完整顺序内容
   */
  async getLearningUnitDetail(userId: string, unitId: string) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: unitId },
      include: {
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
        scriptEpisodes: {
          orderBy: { episodeOrder: 'asc' },
          take: 1,
          select: {
            id: true,
            title: true,
            chapterTitle: true,
            episodeOrder: true,
            description: true,
            requiredOutputLevel: true,
          },
        },
        prerequisiteScenes: {
          include: { prerequisite: true },
        },
        userProgresses: {
          where: { userId },
          take: 1,
        },
        category: true,
      },
    });

    if (!scene) return null;

    // 提取句型骨架
    const sentencePatterns = scene.trainingTopics
      .filter((t) => t.sentencePatterns)
      .flatMap((t) => {
        const patterns = t.sentencePatterns as any[];
        return (patterns ?? []).map((p: any) => ({
          ...p,
          topicId: t.id,
          topicTitle: t.title,
        }));
      });

    // 用户 chunk 进度
    const chunkIds = scene.chunks.map((c) => c.id);
    const chunkProgresses = await this.prisma.userChunkProgress.findMany({
      where: { userId, chunkId: { in: chunkIds } },
    });
    const chunkProgressMap = new Map(chunkProgresses.map((p) => [p.chunkId, p]));

    // 场景掌握度
    const progress = scene.userProgresses[0] ?? null;

    return {
      id: scene.id,
      title: scene.title,
      location: scene.location,
      description: scene.description,
      category: scene.category.name,
      requiredOutputLevel: scene.requiredOutputLevel,
      requiredUserLevel: scene.requiredUserLevel,
      prerequisites: scene.prerequisiteScenes.map((ps) => ({
        id: ps.prerequisite.id,
        title: ps.prerequisite.title,
      })),

      progress: progress
        ? {
            readiness: progress.readiness,
            mastery: progress.mastery,
            vocabLearned: progress.vocabLearned,
            vocabTotal: progress.vocabTotal,
            chunkMastered: progress.chunkMastered,
            chunkTotal: progress.chunkTotal,
            completedPracticeCount: progress.completedPracticeCount,
            completedScriptCount: progress.completedScriptCount,
          }
        : null,

      // 顺序学习内容
      vocabularies: scene.vocabularies.map((v) => ({
        id: v.id,
        word: v.word,
        meaning: v.meaning,
        description: v.description,
      })),

      chunks: scene.chunks.map((c) => {
        const cp = chunkProgressMap.get(c.id);
        return {
          id: c.id,
          text: c.text,
          meaning: c.meaning,
          description: c.description,
          category: c.category,
          difficulty: c.difficulty,
          masteryStatus: cp?.status ?? 'not_learned',
          examples: c.examples.map((e) => ({
            en: e.en,
            zh: e.zh,
            note: e.note,
            level: e.level,
          })),
        };
      }),

      sentencePatterns,

      trainingTopics: scene.trainingTopics.map((t) => ({
        id: t.id,
        title: t.title,
        promptEn: t.promptEn,
        promptZh: t.promptZh,
        difficulty: t.difficulty,
        suggestedDurationSec: t.suggestedDurationSec,
        sentenceSkeleton: t.sentenceSkeleton,
        activeChunks: t.activeChunks.map((ac) => ({
          id: ac.chunk.id,
          text: ac.chunk.text,
          meaning: ac.chunk.meaning,
        })),
      })),

      // 关联的剧本入口
      firstEpisode: scene.scriptEpisodes[0] ?? null,

      // 元信息
      vocabCount: scene.vocabularies.length,
      chunkCount: scene.chunks.length,
      topicCount: scene.trainingTopics.length,
      scriptCount: scene.scriptEpisodes.length,
    };
  }

  /**
   * 生成今日任务
   */
  async getTodayTasks(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userLevel: true, outputLevel: true },
    });

    // 找到用户当前正在学习的场景（有进度但未完成的）
    const activeProgress = await this.prisma.userSceneProgress.findFirst({
      where: { userId, mastery: { lt: 100 } },
      orderBy: { updatedAt: 'desc' },
      include: { scene: true },
    });

    // 如果没有进行中的，取第一个可解锁的场景
    let currentScene;
    if (activeProgress) {
      currentScene = activeProgress.scene;
    } else {
      currentScene = await this.prisma.scene.findFirst({
        where: { requiredUserLevel: { lte: user?.userLevel ?? 1 } },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!currentScene) {
      return { tasks: [], currentUnit: null };
    }

    // 获取场景完整数据
    const sceneDetail = await this.prisma.scene.findUnique({
      where: { id: currentScene.id },
      include: {
        vocabularies: { orderBy: { sortOrder: 'asc' } },
        chunks: { orderBy: { createdAt: 'asc' } },
        trainingTopics: { orderBy: { sortOrder: 'asc' }, take: 3 },
        scriptEpisodes: { orderBy: { episodeOrder: 'asc' }, take: 1 },
      },
    });

    if (!sceneDetail) return { tasks: [], currentUnit: null };

    // 获取用户在该场景的进度
    const progress = await this.prisma.userSceneProgress.findUnique({
      where: { userId_sceneId: { userId, sceneId: currentScene.id } },
    });

    // 获取词汇学习状态（检查 ExpressionItem 中有没有这些词）
    const vocabWords = sceneDetail.vocabularies.map((v) => v.word);
    const learnedVocabs = await this.prisma.expressionItem.findMany({
      where: { userId, type: 'chunk', chunkText: { in: vocabWords } },
      select: { chunkText: true },
    });
    const learnedVocabSet = new Set(learnedVocabs.map((v) => v.chunkText));

    // Chunk 进度
    const chunkIds = sceneDetail.chunks.map((c) => c.id);
    const chunkProgresses = await this.prisma.userChunkProgress.findMany({
      where: { userId, chunkId: { in: chunkIds } },
    });
    const chunkProgressMap = new Map(chunkProgresses.map((p) => [p.chunkId, p]));

    const vocabLearned = progress?.vocabLearned ?? 0;
    const chunkMastered = progress?.chunkMastered ?? 0;
    const completedPractice = progress?.completedPracticeCount ?? 0;

    // ---- 构建任务列表 ----
    const tasks: any[] = [];

    // 任务1: 学习词汇
    const unlearnedVocabs = sceneDetail.vocabularies.filter(
      (v) => !learnedVocabSet.has(v.word),
    );
    if (unlearnedVocabs.length > 0) {
      tasks.push({
        id: `vocab-${currentScene.id}`,
        type: 'vocab',
        title: '学习场景词汇',
        description: `还有 ${unlearnedVocabs.length} 个词汇未学习`,
        count: unlearnedVocabs.length,
        done: sceneDetail.vocabularies.length - unlearnedVocabs.length,
        total: sceneDetail.vocabularies.length,
        unitId: currentScene.id,
        unitTitle: currentScene.title,
        data: unlearnedVocabs.slice(0, 8),
      });
    }

    // 任务2: 学习 Chunk
    const unlearnedChunks = sceneDetail.chunks.filter((c) => {
      const cp = chunkProgressMap.get(c.id);
      return !cp || cp.status === 'not_learned';
    });
    if (unlearnedChunks.length > 0 || chunkMastered < sceneDetail.chunks.length) {
      const mastered = sceneDetail.chunks.filter((c) => {
        const cp = chunkProgressMap.get(c.id);
        return cp?.status === 'mastered' || cp?.status === 'can_output';
      }).length;
      tasks.push({
        id: `chunk-${currentScene.id}`,
        type: 'chunk',
        title: '掌握核心表达',
        description: unlearnedChunks.length > 0
          ? `还有 ${unlearnedChunks.length} 个 Chunk 待学习`
          : '复习已学 Chunk，提升掌握度',
        count: unlearnedChunks.length,
        done: mastered,
        total: sceneDetail.chunks.length,
        unitId: currentScene.id,
        unitTitle: currentScene.title,
        data: unlearnedChunks.slice(0, 5).map((c) => ({
          id: c.id,
          text: c.text,
          meaning: c.meaning,
        })),
      });
    }

    // 任务3: 开口练习
    const uncompletedTopics = sceneDetail.trainingTopics.filter(
      (_, i) => i >= completedPractice,
    );
    if (uncompletedTopics.length > 0) {
      const nextTopic = uncompletedTopics[0];
      tasks.push({
        id: `practice-${nextTopic.id}`,
        type: 'practice',
        title: '开口练习',
        description: nextTopic.title,
        durationSec: nextTopic.suggestedDurationSec,
        unitId: currentScene.id,
        unitTitle: currentScene.title,
        topicId: nextTopic.id,
        topicTitle: nextTopic.title,
        promptZh: nextTopic.promptZh,
      });
    }

    // 任务4: 剧本挑战（如果词汇和 chunk 掌握足够）
    if (
      sceneDetail.scriptEpisodes.length > 0 &&
      vocabLearned >= sceneDetail.vocabularies.length * 0.7
    ) {
      const ep = sceneDetail.scriptEpisodes[0];
      tasks.push({
        id: `script-${ep.id}`,
        type: 'script',
        title: '剧本挑战',
        description: `${ep.chapterTitle} — ${ep.title}`,
        unitId: currentScene.id,
        unitTitle: currentScene.title,
        episodeId: ep.id,
        episodeTitle: ep.title,
      });
    }

    return {
      currentUnit: {
        id: currentScene.id,
        title: currentScene.title,
        location: currentScene.location,
        progress: progress
          ? {
              vocabLearned,
              vocabTotal: sceneDetail.vocabularies.length,
              chunkMastered,
              chunkTotal: sceneDetail.chunks.length,
              completedPractice,
              practiceTotal: sceneDetail.trainingTopics.length,
            }
          : null,
      },
      tasks,
    };
  }

  /**
   * 更新学习单元进度
   */
  async updateUnitProgress(
    userId: string,
    unitId: string,
    data: {
      vocabLearned?: number;
      chunkMastered?: number;
      completedPractice?: boolean;
      completedScript?: boolean;
    },
  ) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: unitId },
      include: { _count: { select: { vocabularies: true, chunks: true, trainingTopics: true, scriptEpisodes: true } } },
    });
    if (!scene) return null;

    const updateData: any = {};
    if (data.vocabLearned !== undefined) updateData.vocabLearned = data.vocabLearned;
    if (data.chunkMastered !== undefined) updateData.chunkMastered = data.chunkMastered;
    if (data.completedPractice) updateData.completedPracticeCount = { increment: 1 };
    if (data.completedScript) updateData.completedScriptCount = { increment: 1 };

    // 重新计算 readiness 和 mastery
    const totalVocab = scene._count.vocabularies || 1;
    const totalChunks = scene._count.chunks || 1;
    const totalPractices = scene._count.trainingTopics || 1;
    const totalScripts = scene._count.scriptEpisodes || 1;

    const finalVocab = data.vocabLearned ?? (await this.getCurrentVocabLearned(userId, unitId));
    const finalChunk = data.chunkMastered ?? (await this.getCurrentChunkMastered(userId, unitId));

    const progressRecord = await this.prisma.userSceneProgress.upsert({
      where: { userId_sceneId: { userId, sceneId: unitId } },
      create: {
        userId,
        sceneId: unitId,
        ...updateData,
        readiness: Math.round((finalVocab / totalVocab) * 30 + (finalChunk / totalChunks) * 30),
        mastery: Math.round(
          (finalVocab / totalVocab) * 25 +
          (finalChunk / totalChunks) * 25 +
          ((data.completedPractice ? 1 : 0) / totalPractices) * 25 +
          ((data.completedScript ? 1 : 0) / totalScripts) * 25
        ),
      },
      update: {
        ...updateData,
        readiness: Math.round((finalVocab / totalVocab) * 30 + (finalChunk / totalChunks) * 30),
        mastery: Math.round(
          (finalVocab / totalVocab) * 25 +
          (finalChunk / totalChunks) * 25 +
          (1 / totalPractices) * 25 +
          (1 / totalScripts) * 25
        ),
      },
    });

    return progressRecord;
  }

  private async getCurrentVocabLearned(userId: string, sceneId: string): Promise<number> {
    const progress = await this.prisma.userSceneProgress.findUnique({
      where: { userId_sceneId: { userId, sceneId } },
    });
    return progress?.vocabLearned ?? 0;
  }

  private async getCurrentChunkMastered(userId: string, sceneId: string): Promise<number> {
    const progress = await this.prisma.userSceneProgress.findUnique({
      where: { userId_sceneId: { userId, sceneId } },
    });
    return progress?.chunkMastered ?? 0;
  }
}
