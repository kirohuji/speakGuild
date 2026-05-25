import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ExpressionType } from '@prisma/client';

@Injectable()
export class ExpressionService {
  constructor(private readonly prisma: PrismaService) {}

  async listExpressions(
    userId: string,
    filters?: { type?: ExpressionType; sceneName?: string },
  ) {
    return this.prisma.expressionItem.findMany({
      where: {
        userId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.sceneName && { sceneName: filters.sceneName }),
      },
      orderBy: { createdAt: 'desc' },
    });
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
        nextReviewAt: { lte: now },
      },
      orderBy: { nextReviewAt: 'asc' },
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
