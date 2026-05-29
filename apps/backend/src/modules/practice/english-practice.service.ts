import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SaveExpressionDto, SubmitPracticeTurnDto, SubmitRecordingDto } from './dto/english-practice.dto';

@Injectable()
export class EnglishPracticeService {
  constructor(private readonly prisma: PrismaService) {}

  private buildObjectives(topic: {
    title: string;
    sentencePatterns?: any;
  }) {
    const objectives: string[] = [];
    const patterns = Array.isArray(topic.sentencePatterns) ? topic.sentencePatterns : [];
    patterns.forEach((pattern) => {
      if (pattern?.pattern) objectives.push(`使用句型: ${pattern.pattern}`);
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

  /** 话题详情 — 练习准备页 */
  async getTopicDetail(topicId: string, userId: string) {
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      include: {
        scene: {
          include: {
            category: true,
            vocabularies: { orderBy: { sortOrder: 'asc' }, take: 10 },
          },
        },
        sentencePatterns: { orderBy: { sortOrder: 'asc' } },
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

    // Fetch scene visual assets from GameLocation
    const gameLocation = await this.prisma.gameLocation.findFirst({
      where: { sceneId: topic.scene.id },
      select: {
        backgroundUrl: true,
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
    });
    const fallbackCharacters = gameLocation?.npcs.length
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
    const sceneCharacters = gameLocation?.npcs.length
      ? gameLocation.npcs.map((npc) => npc.character)
      : fallbackCharacters;

    return {
      topic: {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        knowledgePoints: topic.knowledgePoints,
        promptEn: topic.promptEn,
        promptZh: topic.promptZh,
        suggestedDurationSec: topic.suggestedDurationSec,
        difficulty: topic.difficulty,
        sentencePatterns: topic.sentencePatterns,
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
      vocabularies: topic.scene.vocabularies.map((v) => ({
        id: v.id,
        word: v.word,
        meaning: v.meaning,
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
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      include: {
        scene: {
          include: {
            category: true,
            vocabularies: { orderBy: { sortOrder: 'asc' } },
          },
        },
        sentencePatterns: { orderBy: { sortOrder: 'asc' } },
        activeChunks: {
          include: {
            chunk: {
              include: {
                examples: { orderBy: { sortOrder: 'asc' }, take: 3 },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!topic) throw new NotFoundException('练习话题不存在');

    const topicSnapshot = {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      knowledgePoints: topic.knowledgePoints,
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
      description: item.chunk.description,
      difficulty: item.chunk.difficulty,
      examples: item.chunk.examples,
    }));
    const vocabSnapshot = topic.scene.vocabularies.map((item) => ({
      id: item.id,
      word: item.word,
      meaning: item.meaning,
      partOfSpeech: item.partOfSpeech,
      difficulty: item.difficulty,
      examples: item.examples,
      description: item.description,
    }));
    const objectivesSnapshot = this.buildObjectives(topic);

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
        sentencePatternsSnapshot: topic.sentencePatterns ?? null,
      },
    });
  }

  async submitPracticeTurn(userId: string, sessionId: string, dto: SubmitPracticeTurnDto) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, turnCount: true },
    });
    if (!session) throw new NotFoundException('练习会话不存在');

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
      },
    });

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

  /** 保存表达 */
  async saveExpression(userId: string, dto: SaveExpressionDto) {
    return this.prisma.expressionItem.create({
      data: {
        userId,
        type: dto.type,
        original: dto.original,
        corrected: dto.corrected,
        chunkText: dto.chunkText,
        sceneName: dto.sceneName,
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
    return this.prisma.scriptDialogue.create({
      data: {
        userId,
        episodeId: topicId,
        round: dto.round ?? 1,
        npcText: dto.npcText,
        userText: dto.userText ?? '',
        isOnTopic: dto.isOnTopic,
        objectiveCompleted: dto.objectivesCompleted ?? [],
        chunksUsed: dto.chunksUsed ?? [],
        grammarIssues: dto.grammarIssues ?? null,
      },
    });
  }

  /** 获取话题的所有对话记录（用于汇总分析） */
  async getTopicDialogues(topicId: string, userId: string) {
    return this.prisma.scriptDialogue.findMany({
      where: { episodeId: topicId, userId },
      orderBy: { round: 'asc' },
      select: {
        round: true,
        npcText: true,
        userText: true,
        isOnTopic: true,
        objectiveCompleted: true,
        chunksUsed: true,
        grammarIssues: true,
      },
    });
  }
}
