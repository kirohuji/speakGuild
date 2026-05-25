import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SubmitRecordingDto, SaveExpressionDto } from './dto/english-practice.dto';

@Injectable()
export class EnglishPracticeService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      topic: {
        id: topic.id,
        title: topic.title,
        promptEn: topic.promptEn,
        promptZh: topic.promptZh,
        suggestedDurationSec: topic.suggestedDurationSec,
        difficulty: topic.difficulty,
        sentenceSkeleton: topic.sentenceSkeleton,
        sentencePatterns: topic.sentencePatterns,
      },
      scene: {
        id: topic.scene.id,
        title: topic.scene.title,
        location: topic.scene.location,
        category: topic.scene.category.name,
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
}
