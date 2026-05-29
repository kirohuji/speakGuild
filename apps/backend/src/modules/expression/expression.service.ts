import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ExpressionType, Prisma } from '@prisma/client';

export interface ListExpressionsParams {
  type?: ExpressionType;
  sceneName?: string;
  reviewState?: 'reviewing' | 'done' | 'mastered';
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ExpressionService {
  constructor(private readonly prisma: PrismaService) {}

  async listExpressions(userId: string, params?: ListExpressionsParams) {
    const { type, sceneName, reviewState, page = 1, pageSize = 30 } = params ?? {};

    const where: Prisma.ExpressionItemWhereInput = { userId };

    if (type) where.type = type;
    if (sceneName) where.sceneName = sceneName;

    // reviewState 过滤
    const now = new Date();
    if (reviewState === 'reviewing') {
      // 复习中：已至少复习过一次，且已到/超过下次复习时间
      where.AND = [
        { reviewCount: { gt: 0 } },
        { nextReviewAt: { lte: now } },
      ];
    } else if (reviewState === 'done') {
      // 学习中：尚未掌握，包括新加入（未复习过）和已复习但未到下次复习时间的
      where.masteryStatus = { not: 'mastered' };
      where.OR = [
        { reviewCount: 0 },
        { reviewCount: { gt: 0 }, nextReviewAt: { gt: now } },
      ];
    } else if (reviewState === 'mastered') {
      where.masteryStatus = 'mastered';
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

    return {
      items,
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
    return this.prisma.expressionItem.create({
      data: { userId, ...data },
    });
  }

  async deleteExpression(userId: string, id: string) {
    return this.prisma.expressionItem.deleteMany({
      where: { id, userId },
    });
  }

  async getReviewList(userId: string) {
    const now = new Date();
    return this.prisma.expressionItem.findMany({
      where: {
        userId,
        reviewCount: { gt: 0 },
        nextReviewAt: { lte: now },
      },
      orderBy: [
        { nextReviewAt: { sort: 'asc', nulls: 'first' } },
      ],
    });
  }

  async completeReview(userId: string, id: string) {
    const item = await this.prisma.expressionItem.findFirst({
      where: { id, userId },
    });
    if (!item) return null;

    // Simple spaced repetition: next review in (reviewCount + 1) days
    const intervalDays = (item.reviewCount + 1) * 1;
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

    return this.prisma.expressionItem.update({
      where: { id },
      data: {
        reviewCount: { increment: 1 },
        lastReviewedAt: new Date(),
        nextReviewAt,
      },
    });
  }
}
