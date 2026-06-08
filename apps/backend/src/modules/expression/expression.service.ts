import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ExpressionType, Prisma } from '@prisma/client';

export type MasteryStatus = 'learning' | 'reviewing' | 'mastered';

export interface ListExpressionsParams {
  type?: ExpressionType;
  sceneName?: string;
  reviewState?: MasteryStatus;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ExpressionService {
  constructor(private readonly prisma: PrismaService) {}

  async listExpressions(userId: string, params?: ListExpressionsParams) {
    const { type, sceneName, reviewState, page = 1, pageSize = 30 } = params ?? {};

    const where: Prisma.ExpressionItemWhereInput = { userId, deletedAt: null };

    if (type) where.type = type;
    if (sceneName) where.sceneName = sceneName;

    // 直接按 masteryStatus 过滤
    // 兼容旧数据：'activated' 视为 'learning'
    if (reviewState === 'learning') {
      where.masteryStatus = { in: ['learning', 'activated'] };
    } else if (reviewState) {
      where.masteryStatus = reviewState;
    }

    const [items, total] = await Promise.all([
      this.prisma.expressionItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expressionItem.count({ where }),
    ]);

    const wordItems = type === 'word' ? items.filter((item) => item.original?.trim()) : [];
    const vocabularies = wordItems.length
      ? await this.prisma.vocabulary.findMany({
          where: {
            OR: wordItems.map((item) => ({
              word: { equals: item.original!.trim(), mode: 'insensitive' },
            })),
          },
        })
      : [];
    const vocabularyByWord = new Map(vocabularies.map((vocab) => [vocab.word.toLowerCase(), vocab]));
    const mergedItems = wordItems.length
      ? items.map((item) => ({
          ...item,
          vocabulary: item.original ? vocabularyByWord.get(item.original.trim().toLowerCase()) ?? null : null,
        }))
      : items;

    return {
      items: mergedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createExpression(userId: string, data: {
    type: ExpressionType;
    original?: string;
    corrected?: string;
    chunkText?: string;
    sceneName?: string;
  }) {
    const uniqueText = data.type === 'word' ? data.original : data.chunkText;
    if (uniqueText) {
      const existing = await this.prisma.expressionItem.findFirst({
        where: {
          userId,
          type: data.type,
          ...(data.type === 'word' ? { original: uniqueText } : { chunkText: uniqueText }),
        },
        select: { id: true },
      });
      if (existing) {
        return this.prisma.expressionItem.update({
          where: { id: existing.id },
          data: {
            ...data,
            deletedAt: null,
            masteryStatus: 'learning',
          },
        });
      }
    }

    return this.prisma.expressionItem.create({
      data: { userId, ...data, masteryStatus: 'learning' },
    });
  }

  async deleteExpression(userId: string, id: string) {
    return this.prisma.expressionItem.updateMany({
      where: { id, userId },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async updateStatus(userId: string, id: string, status: MasteryStatus, quality = 3) {
    const item = await this.prisma.expressionItem.findFirst({
      where: { id, userId },
      select: { reviewCount: true, easeFactor: true },
    });
    if (!item) return null;

    // SM-2 spaced repetition
    const { interval, nextReview, easeFactor, newReviewCount } = calcSm2(
      item.reviewCount,
      item.easeFactor,
      quality,
    )

    return this.prisma.expressionItem.update({
      where: { id },
      data: {
        masteryStatus: status,
        reviewCount: status === 'reviewing' ? newReviewCount : item.reviewCount,
        easeFactor,
        lastReviewedAt: new Date(),
        nextReviewAt: nextReview,
      },
    });
  }
}

/** SM-2 algorithm: returns new interval (days), next review date, new EF, new count */
function calcSm2(
  n: number,
  ef: number,
  q: number,
): { interval: number; nextReview: Date; easeFactor: number; newReviewCount: number } {
  // Clamp quality
  q = Math.max(0, Math.min(5, q))

  if (q >= 3) {
    // Correct response
    let interval: number
    if (n === 0) interval = 1
    else if (n === 1) interval = 6
    else interval = Math.round((n - 1) * ef)

    // Update ease factor
    const newEf = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    ef = Math.max(1.3, newEf)

    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + interval)

    return { interval, nextReview, easeFactor: ef, newReviewCount: n + 1 }
  } else {
    // Incorrect — reset
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + 1)

    return { interval: 1, nextReview, easeFactor: ef, newReviewCount: 0 }
  }
}
