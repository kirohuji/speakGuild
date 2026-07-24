import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SubmitPracticeTurnDto, SubmitRecordingDto } from './dto/english-practice.dto';

@Injectable()
export class EnglishPracticeService {
  private readonly logger = new Logger(EnglishPracticeService.name);

  constructor(private readonly prisma: PrismaService) {}

  private buildObjectives(topic: {
    title: string;
    topicPatterns?: any;
  }) {
    const objectives: string[] = [];
    const patterns = Array.isArray(topic.topicPatterns) ? topic.topicPatterns : [];
    patterns.forEach((tp: any) => {
      if (tp?.pattern?.pattern) objectives.push(`使用句型: ${tp.pattern.pattern}`);
    });
    objectives.push(`围绕话题 "${topic.title}" 展开对话`);
    return objectives;
  }

  /** 获取场景下的训练话题列表 */
  async getTopicsByScene(sceneId: string) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: { id: true, title: true, location: true },
    });
    if (!scene) throw new NotFoundException('场景不存在');

    const topics = await this.prisma.trainingTopic.findMany({
      where: { sceneId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        promptZh: true,
        difficulty: true,
        suggestedDurationSec: true,
      },
    });

    return { scene, topics };
  }

  async getTopicTeachingMarkdown(topicId: string) {
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      select: { teachingMarkdown: true },
    });
    if (!topic) throw new NotFoundException('话题不存在');
    return { teachingMarkdown: topic.teachingMarkdown };
  }

  /** 话题详情 — 练习准备页 */
  async getTopicDetail(topicId: string, userId: string) {
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      include: {
        scene: {
          include: {
            category: true,
          },
        },
        topicPatterns: { include: { pattern: true }, orderBy: { sortOrder: 'asc' } },
        topicVocabs: {
          include: { vocab: true },
          orderBy: { sortOrder: 'asc' },
          take: 10,
        },
        activeChunks: {
          include: {
            chunk: {
              include: {
                examples: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!topic) throw new NotFoundException('话题不存在');

    // Get user chunk progress for displayed chunks
    const chunkIds = topic.activeChunks.map((tc) => tc.chunkId);
    const chunkProgresses = chunkIds.length > 0
      ? await this.prisma.userChunkProgress.findMany({
          where: { userId, chunkId: { in: chunkIds } },
        })
      : [];
    const progressMap = new Map(chunkProgresses.map((p) => [p.chunkId, p]));

    // Fetch ink script if linked
    let inkScript = null;
    if (topic.inkScriptId) {
      inkScript = await this.prisma.inkScript.findUnique({
        where: { id: topic.inkScriptId },
        select: { id: true, inkJson: true, inkSource: true, key: true, title: true },
      });
    }

    // Fetch scene visual assets from GameLocation (NPCs now live on Rooms)
    const gameLocation = await this.prisma.gameLocation.findFirst({
      where: { sceneId: topic.scene.id },
      select: {
        backgroundUrl: true,
        rooms: {
          select: {
            npcs: {
              include: {
                character: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    avatarUrl: true,
                    spriteBaseUrl: true,
                    expressions: true,
                    defaultPosition: true,
                  },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    const allNpcs = gameLocation?.rooms.flatMap((r) => r.npcs) ?? [];
    const fallbackCharacters = allNpcs.length
      ? []
      : await this.prisma.gameCharacter.findMany({
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            spriteBaseUrl: true,
            expressions: true,
            defaultPosition: true,
          },
          orderBy: { name: 'asc' },
        });
    const sceneCharacters = allNpcs.length
      ? allNpcs.map((npc) => npc.character)
      : fallbackCharacters;

    return {
      topic: {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        knowledgePoints: topic.knowledgePoints,
        teachingMarkdown: topic.teachingMarkdown,
        promptEn: topic.promptEn,
        promptZh: topic.promptZh,
        suggestedDurationSec: topic.suggestedDurationSec,
        difficulty: topic.difficulty,
        metadata: topic.metadata,
        sentencePatterns: topic.topicPatterns.map((tp) => tp.pattern),
        inkScriptId: topic.inkScriptId,
      },
      inkScript: inkScript
        ? { id: inkScript.id, inkJson: inkScript.inkJson, inkSource: inkScript.inkSource, key: inkScript.key, title: inkScript.title }
        : null,
      scene: {
        id: topic.scene.id,
        title: topic.scene.title,
        location: topic.scene.location,
        category: topic.scene.category.name,
        backgroundUrl: gameLocation?.backgroundUrl ?? null,
        characters: sceneCharacters.map((character) => ({
          id: character.id,
          name: character.name,
          displayName: character.displayName,
          avatarUrl: character.avatarUrl,
          spriteBaseUrl: character.spriteBaseUrl,
          expressions: character.expressions,
          defaultPosition: (character.defaultPosition as 'left' | 'center' | 'right') ?? 'center',
        })),
      },
      vocabularies: topic.topicVocabs.map((tv) => ({
        id: tv.vocab.id,
        word: tv.vocab.word,
        meaning: tv.vocab.meaning,
        partOfSpeech: tv.vocab.partOfSpeech,
        phoneticUs: tv.vocab.phoneticUs,
        phoneticUk: tv.vocab.phoneticUk,
        audioUsUrl: tv.vocab.audioUsUrl,
        audioUkUrl: tv.vocab.audioUkUrl,
        definitionEn: tv.vocab.definitionEn,
        synonyms: tv.vocab.synonyms,
        examples: tv.vocab.examples,
        description: tv.vocab.description,
        difficulty: tv.vocab.difficulty,
        outputPriority: tv.vocab.outputPriority,
        collocations: tv.vocab.collocations,
      })),
      activeChunks: topic.activeChunks.map((tc) => {
        const progress = progressMap.get(tc.chunkId);
        return {
          id: tc.chunk.id,
          text: tc.chunk.text,
          meaning: tc.chunk.meaning,
          description: tc.chunk.description,
          examples: tc.chunk.examples,
          masteryStatus: (progress as any)?.status ?? 'not_learned',
        };
      }),
    };
  }

  async createPracticeSession(userId: string, topicId: string) {
    // 只查创建 session 所需的最少字段，不拉取冗余的 examples/description
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        title: true,
        description: true,
        knowledgePoints: true,
        teachingMarkdown: true,
        promptEn: true,
        promptZh: true,
        difficulty: true,
        suggestedDurationSec: true,
        sceneId: true,
        inkScriptId: true,
        scene: {
          select: {
            id: true,
            title: true,
            location: true,
            description: true,
            category: { select: { name: true } },
          },
        },
        topicPatterns: {
          select: { pattern: { select: { pattern: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        activeChunks: {
          select: {
            chunk: {
              select: { id: true, text: true, meaning: true, difficulty: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        topicVocabs: {
          select: {
            vocab: {
              select: { id: true, word: true, meaning: true, partOfSpeech: true, difficulty: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!topic) throw new NotFoundException('练习话题不存在');

    // 快照仅保留核心标识字段，用于历史回顾/分析时追溯
    const topicSnapshot = {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      knowledgePoints: topic.knowledgePoints,
      teachingMarkdown: topic.teachingMarkdown,
      promptEn: topic.promptEn,
      promptZh: topic.promptZh,
      difficulty: topic.difficulty,
      suggestedDurationSec: topic.suggestedDurationSec,
    };
    const sceneSnapshot = {
      id: topic.scene.id,
      title: topic.scene.title,
      location: topic.scene.location,
      description: topic.scene.description,
      category: topic.scene.category.name,
    };
    const chunksSnapshot = topic.activeChunks.map((item) => ({
      id: item.chunk.id,
      text: item.chunk.text,
      meaning: item.chunk.meaning,
      difficulty: item.chunk.difficulty,
    }));
    const vocabSnapshot = topic.topicVocabs.map((tv) => ({
      id: tv.vocab.id,
      word: tv.vocab.word,
      meaning: tv.vocab.meaning,
      partOfSpeech: tv.vocab.partOfSpeech,
      difficulty: tv.vocab.difficulty,
    }));
    const objectivesSnapshot = this.buildObjectives(topic);

    // select 只返回前端实际需要的字段（前端只用 id）
    return this.prisma.practiceSession.create({
      data: {
        userId,
        topicId: topic.id,
        sceneId: topic.sceneId,
        inkScriptId: topic.inkScriptId,
        topicSnapshot,
        sceneSnapshot,
        objectivesSnapshot,
        chunksSnapshot,
        vocabSnapshot,
        sentencePatternsSnapshot: topic.topicPatterns.map((tp) => tp.pattern) ?? null,
      },
      select: {
        id: true,
        userId: true,
        topicId: true,
        sceneId: true,
        inkScriptId: true,
        status: true,
        turnCount: true,
        startedAt: true,
        completedAt: true,
        analyzedAt: true,
      },
    });
  }

  async submitPracticeTurn(userId: string, sessionId: string, dto: SubmitPracticeTurnDto) {
    this.logger.log(`[submitTurn] 收到 | sessionId=${sessionId} | round=${dto.round} | userText="${dto.userText?.slice(0, 40)}..."`);
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, turnCount: true },
    });
    if (!session) {
      this.logger.warn(`[submitTurn] ❌ 会话不存在 | sessionId=${sessionId} | userId=${userId}`);
      throw new NotFoundException('练习会话不存在');
    }

    const round = dto.round ?? session.turnCount + 1;
    const turn = await this.prisma.practiceTurn.create({
      data: {
        sessionId,
        round,
        npcText: dto.npcText,
        userText: dto.userText,
        userAudioUrl: dto.userAudioUrl,
        inputNodeId: dto.inputNodeId,
        tags: dto.tags ?? undefined,
        judgement: dto.judgement ?? undefined,
        objectivesCompleted: dto.objectivesCompleted ?? [],
        chunksUsed: dto.chunksUsed ?? [],
        isRetry: dto.isRetry ?? false,
        parentTurnId: dto.parentTurnId,
      },
    });

    this.logger.log(`[submitTurn] ✅ 已存储 | turn.id=${turn.id} | round=${round} | 原turnCount=${session.turnCount}`);

    await this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        turnCount: { increment: 1 },
        status: 'active',
      },
    });

    return turn;
  }

  async completePracticeSession(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('练习会话不存在');

    if (session.status === 'analyzed') return session;

    const updated = await this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        status: session.status === 'analyzing' ? 'analyzing' : 'completed',
        completedAt: session.completedAt ?? new Date(),
      },
    });

    if (!session.completedAt) {
      await this.prisma.dailyActivity.upsert({
        where: {
          userId_date: {
            userId,
            date: new Date(),
          },
        },
        create: { userId, date: new Date(), count: 1 },
        update: { count: { increment: 1 } },
      });
    }

    return updated;
  }

  async getPracticeSession(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      include: { turns: { orderBy: { round: 'asc' } } },
    });
    if (!session) throw new NotFoundException('练习会话不存在');
    this.logger.log(`[getPracticeSession] sessionId=${sessionId} | turnCount=${session.turnCount} | turns数组长度=${session.turns.length}`);
    session.turns.forEach((t) => {
      this.logger.log(`  → round=${t.round} | userText="${t.userText?.slice(0, 40)}..." | createdAt=${t.createdAt}`);
    });
    return session;
  }

  async getPracticeSessionForAnalysis(userId: string, sessionId: string) {
    return this.getPracticeSession(userId, sessionId);
  }

  async markPracticeSessionAnalyzing(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('练习会话不存在');
    return this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: { status: 'analyzing', analysisError: null },
    });
  }

  async savePracticeSessionAnalysis(userId: string, sessionId: string, analysis: any, raw?: string | null) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('练习会话不存在');
    return this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        status: 'analyzed',
        analysisResult: analysis ?? undefined,
        analysisRaw: raw ?? undefined,
        analysisError: null,
        analyzedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  async savePracticeSessionAnalysisError(userId: string, sessionId: string, error: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('练习会话不存在');
    return this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        status: 'failed',
        analysisError: error,
      },
    });
  }

  /** 提交录音转写 — 记录练习行为 */
  async submitRecording(userId: string, dto: SubmitRecordingDto) {
    // Create practice record (reuse existing table or create new)
    // For now, we'll track via daily activity and chunk activation
    return this.prisma.dailyActivity.upsert({
      where: {
        userId_date: {
          userId,
          date: new Date(),
        },
      },
      create: {
        userId,
        date: new Date(),
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });
  }

  /** 获取话题关联的 Ink 脚本 */
  async getTopicInkScript(topicId: string) {
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      select: { inkScriptId: true },
    });
    if (!topic?.inkScriptId) return null;

    return this.prisma.inkScript.findUnique({
      where: { id: topic.inkScriptId },
      select: { id: true, inkJson: true, inkSource: true, key: true, title: true },
    });
  }

  /** 提交练习对话记录 */
  async submitPracticeDialogue(userId: string, topicId: string, dto: {
    round?: number;
    npcText: string;
    userText?: string;
    isOnTopic?: boolean;
    objectivesCompleted?: string[];
    chunksUsed?: string[];
    grammarIssues?: any;
  }) {
    // Find the matching StoryEpisode via the topic's scene
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      select: { sceneId: true, inkScriptId: true },
    });
    if (!topic) return null;

    const episode = await this.prisma.storyEpisode.findFirst({
      where: {
        sceneId: topic.sceneId,
        ...(topic.inkScriptId ? { inkScriptId: topic.inkScriptId } : {}),
      },
      select: { id: true },
    });
    if (!episode) return null;

    return this.prisma.storyTurn.create({
      data: {
        userId,
        episodeId: episode.id,
        round: dto.round ?? 1,
        npcText: dto.npcText,
        userText: dto.userText ?? '',
        isOnTopic: dto.isOnTopic,
        objectivesCompleted: dto.objectivesCompleted ?? [],
        chunksUsed: dto.chunksUsed ?? [],
        grammarIssues: dto.grammarIssues ?? null,
      },
    });
  }

  /** 获取话题的所有对话记录（用于汇总分析） */
  async getTopicDialogues(topicId: string, userId: string) {
    // Find the matching StoryEpisode via the topic's scene
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      select: { sceneId: true, inkScriptId: true },
    });
    if (!topic) return [];

    const episode = await this.prisma.storyEpisode.findFirst({
      where: {
        sceneId: topic.sceneId,
        ...(topic.inkScriptId ? { inkScriptId: topic.inkScriptId } : {}),
      },
      select: { id: true },
    });
    if (!episode) return [];

    const turns = await this.prisma.storyTurn.findMany({
      where: { episodeId: episode.id, userId },
      orderBy: { round: 'asc' },
      select: {
        round: true,
        npcText: true,
        userText: true,
        isOnTopic: true,
        objectivesCompleted: true,
        chunksUsed: true,
        grammarIssues: true,
      },
    });
    return turns.map((turn) => ({
      ...turn,
      objectiveCompleted: turn.objectivesCompleted,
    }));
  }

  // ── Warmup Records ──

  /** 获取用户的全部热身记录 */
  async getWarmupRecords(userId: string, topicId?: string) {
    const where: any = { userId };
    if (topicId) where.topicId = topicId;
    return this.prisma.practiceWarmupRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        score: true,
        feedback: true,
        items: true,
        topicId: true,
        createdAt: true,
      },
    });
  }

  /** 保存热身练习记录 */
  async saveWarmupRecord(userId: string, topicId: string, items: any[]) {
    const record = await this.prisma.practiceWarmupRecord.create({
      data: {
        userId,
        topicId,
        items,
      },
      select: { id: true },
    });

    // Track daily activity
    await this.prisma.dailyActivity.upsert({
      where: {
        userId_date: { userId, date: new Date() },
      },
      create: { userId, date: new Date(), count: 1 },
      update: { count: { increment: 1 } },
    });

    return record;
  }

  /** AI 综合评估热身表现 */
  async assessWarmup(userId: string, topicId: string, topicTitle: string, items: any[]) {
    const record = await this.prisma.practiceWarmupRecord.create({
      data: {
        userId,
        topicId,
        score: 0, // Placeholder — AI assessment would compute this
        feedback: `已完成"${topicTitle}"的 ${items.length} 道热身练习`,
        items,
      },
      select: { id: true, score: true, feedback: true },
    });

    // Track daily activity
    await this.prisma.dailyActivity.upsert({
      where: {
        userId_date: { userId, date: new Date() },
      },
      create: { userId, date: new Date(), count: items.length },
      update: { count: { increment: items.length } },
    });

    return record;
  }
}
