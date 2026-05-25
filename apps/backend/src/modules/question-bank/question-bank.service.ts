import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class QuestionBankService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(userId: string, mode?: string, keyword?: string) {
    const config = await this.findBindingConfig(userId);

    if (!config || !config.bankId || !config.bank) {
      return {
        bankName: '',
        totalQuestions: 0,
        masteredQuestions: 0,
        practiceDays: 0,
        scenicCards: [],
        otherTopics: [],
      };
    }

    // 所有题型
    const allTopics = await this.prisma.questionTopic.findMany({
      where: { bankId: config.bankId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { items: true } } },
    });

    // 景点介绍题型（code = scenic-intro）
    const scenicTopics = allTopics.filter((t) => t.code === 'scenic-intro');
    const otherTopics = allTopics.filter((t) => t.code !== 'scenic-intro');

    // 对景点介绍，查询其题目（支持 keyword 按 title 过滤）
    const scenicItems = await this.prisma.questionItem.findMany({
      where: {
        topicId: { in: scenicTopics.map((t) => t.id) },
        ...(keyword ? { title: { contains: keyword, mode: 'insensitive' } } : {}),
      },
      include: { content: { select: { summary: true } } },
    });

    // 统计掌握度
    const progresses = await this.prisma.practiceProgress.findMany({
      where: {
        userId,
        questionId: { in: scenicItems.map((i) => i.id) },
      },
    });
    const progressMap = new Map(progresses.map((p) => [p.questionId, p]));

    const scenicCards = scenicItems.map((item) => {
      const p = progressMap.get(item.id);
      return {
        id: item.id,
        topicId: item.topicId,
        questionId: item.id,
        name: item.title,
        questionCount: 1,
        masteredCount: p && p.masteryScore >= 60 ? 1 : 0,
        masteryRate: p?.masteryScore ?? 0,
        isFavorite: false,
      };
    });

    // 其他题型统计
    const otherTopicCards = await Promise.all(
      otherTopics.map(async (topic) => {
        const qids = await this.prisma.questionItem.findMany({
          where: { topicId: topic.id },
          select: { id: true },
        });
        const masteredInTopic = await this.prisma.practiceProgress.count({
          where: {
            userId,
            questionId: { in: qids.map((q) => q.id) },
            masteryScore: { gte: 60 },
          },
        });
        const total = topic._count.items;
        return {
          topicId: topic.id,
          name: topic.name,
          category: topic.code,
          questionCount: total,
          masteredCount: masteredInTopic,
          masteryRate: total > 0 ? Math.round((masteredInTopic / total) * 100) : 0,
        };
      }),
    );

    // 总体统计
    const totalItems = allTopics.reduce((acc, t) => acc + t._count.items, 0);
    const masteredTotal = await this.prisma.practiceProgress.count({
      where: {
        userId,
        masteryScore: { gte: 60 },
        question: { topic: { bankId: config.bankId } },
      },
    });

    const practiceDays = await this.prisma.dailyActivity.count({
      where: { userId },
    });

    const lastMock = await this.prisma.mockExamRecord.findFirst({
      where: { userId },
      orderBy: { takenAt: 'desc' },
    });

    return {
      bankName: config.bank.name,
      totalQuestions: totalItems,
      masteredQuestions: masteredTotal,
      practiceDays,
      lastMockScore: lastMock?.score,
      lastMockDate: lastMock?.takenAt?.toISOString(),
      scenicCards,
      otherTopics: otherTopicCards,
    };
  }

  private async findBindingConfig(userId: string) {
    return this.prisma.userBindingConfig.findUnique({
      where: { userId },
      include: { bank: true },
    });
  }
}
