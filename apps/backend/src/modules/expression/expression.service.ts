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

    const where: Prisma.ExpressionItemWhereInput = { userId };

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
      data: { userId, ...data, masteryStatus: 'learning' },
    });
  }

  async deleteExpression(userId: string, id: string) {
    return this.prisma.expressionItem.deleteMany({
      where: { id, userId },
    });
  }

  async updateStatus(userId: string, id: string, status: MasteryStatus) {
    const item = await this.prisma.expressionItem.findFirst({
      where: { id, userId },
    });
    if (!item) return null;

    return this.prisma.expressionItem.update({
      where: { id },
      data: {
        masteryStatus: status,
        ...(status === 'reviewing' ? { reviewCount: { increment: 1 }, lastReviewedAt: new Date() } : {}),
      },
    });
  }
}
