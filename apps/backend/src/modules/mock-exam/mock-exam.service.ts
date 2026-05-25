import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, toPageResult } from '../../common/dto/pagination.dto';
import { StartExamDto, SubmitExamDto } from './dto/submit-exam.dto';

@Injectable()
export class MockExamService {
  constructor(private readonly prisma: PrismaService) {}

  async getPapers(userId: string) {
    const config = await this.prisma.userBindingConfig.findUnique({
      where: { userId },
    });

    const where: Record<string, unknown> = {};
    if (config?.bankId) {
      where.bankId = config.bankId;
    }

    const papers = await this.prisma.mockPaper.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true } },
        bank: { select: { name: true, language: true } },
      },
    });

    const records = await this.prisma.mockExamRecord.findMany({
      where: {
        userId,
        paperId: { in: papers.map((p) => p.id) },
      },
      orderBy: { takenAt: 'desc' },
    });

    const recordMap = new Map<string, number>();
    for (const r of records) {
      if (!recordMap.has(r.paperId)) {
        recordMap.set(r.paperId, r.score);
      }
    }

    return papers.map((paper) => ({
      id: paper.id,
      title: paper.title,
      paperType: paper.paperType,
      suggestedMinutes: paper.suggestedMinutes,
      focus: paper.focus,
      questionCount: paper._count.questions,
      bank: paper.bank,
      lastScore: recordMap.get(paper.id) ?? null,
    }));
  }

  async getRecentScores(userId: string, pagination: PaginationDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [list, total] = await this.prisma.$transaction([
      this.prisma.mockExamRecord.findMany({
        where: { userId },
        orderBy: { takenAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          paper: {
            select: { title: true, paperType: true, suggestedMinutes: true },
          },
        },
      }),
      this.prisma.mockExamRecord.count({ where: { userId } }),
    ]);

    return toPageResult(list, total, pagination);
  }

  async getScores(userId: string, limit: number) {
    const records = await this.prisma.mockExamRecord.findMany({
      where: { userId },
      orderBy: { takenAt: 'desc' },
      take: limit,
      include: {
        paper: { select: { title: true, paperType: true } },
      },
    });

    const PASS_SCORE = 60;
    return records.map((r) => ({
      mockId: r.id,
      paperId: r.paperId,
      paperName: r.paper.title,
      score: r.score,
      totalScore: 100,
      passScore: PASS_SCORE,
      passed: r.score >= PASS_SCORE,
      durationSeconds: 0,
      completedAt: r.takenAt.toISOString(),
    }));
  }

  async getDashboard(userId: string) {
    const records = await this.prisma.mockExamRecord.findMany({
      where: { userId },
      select: { score: true },
    });

    if (records.length === 0) {
      return { avgScore: 0, totalMocks: 0, passRate: 0, bestScore: 0 };
    }

    const PASS_SCORE = 60;
    const totalMocks = records.length;
    const avgScore = Math.round(records.reduce((s, r) => s + r.score, 0) / totalMocks);
    const passRate = Math.round((records.filter((r) => r.score >= PASS_SCORE).length / totalMocks) * 100);
    const bestScore = Math.max(...records.map((r) => r.score));

    return { avgScore, totalMocks, passRate, bestScore };
  }

  async startExam(_userId: string, dto: StartExamDto) {
    const paper = await this.prisma.mockPaper.findUnique({
      where: { id: dto.paperId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              include: { content: true },
            },
          },
        },
        bank: { select: { name: true, language: true } },
      },
    });

    if (!paper) {
      throw new NotFoundException('Mock paper not found');
    }

    return {
      paperId: paper.id,
      title: paper.title,
      paperType: paper.paperType,
      suggestedMinutes: paper.suggestedMinutes,
      focus: paper.focus,
      bank: paper.bank,
      questions: paper.questions.map((pq) => ({
        sortOrder: pq.sortOrder,
        question: {
          id: pq.question.id,
          title: pq.question.title,
          difficulty: pq.question.difficulty,
          suggestedDurationSec: pq.question.suggestedDurationSec,
          keywords: pq.question.keywords,
          focusWords: pq.question.focusWords,
          content: pq.question.content,
        },
      })),
    };
  }

  async submitExam(userId: string, dto: SubmitExamDto) {
    const paper = await this.prisma.mockPaper.findUnique({
      where: { id: dto.paperId },
    });

    if (!paper) {
      throw new NotFoundException('Mock paper not found');
    }

    const record = await this.prisma.mockExamRecord.create({
      data: {
        userId,
        paperId: dto.paperId,
        score: dto.score,
        weakness: dto.weakness ?? [],
      },
    });

    await this.prisma.dailyActivity.upsert({
      where: {
        userId_date: {
          userId,
          date: new Date(new Date().toISOString().split('T')[0]),
        },
      },
      create: {
        userId,
        date: new Date(new Date().toISOString().split('T')[0]),
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });

    const allScores = await this.prisma.mockExamRecord.findMany({
      where: { userId, paperId: dto.paperId },
      orderBy: { takenAt: 'desc' },
      take: 10,
      select: { score: true, takenAt: true },
    });

    const avgScore =
      allScores.length > 0
        ? Math.round(allScores.reduce((sum, r) => sum + r.score, 0) / allScores.length)
        : dto.score;

    return {
      record,
      stats: {
        latestScore: dto.score,
        averageScore: avgScore,
        totalAttempts: allScores.length,
      },
    };
  }
}
