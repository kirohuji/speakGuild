import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, toPageResult } from '../../common/dto/pagination.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        image: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        emailVerified: true,
      },
    });
    return user;
  }

  async updateUserProfile(userId: string, dto: UpdateUserProfileDto) {
    const data: { name?: string; username?: string } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.username !== undefined) {
      data.username = dto.username.trim();
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        image: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        emailVerified: true,
      },
    });

    return user;
  }

  async getOverview(userId: string) {
    const config = await this.prisma.userBindingConfig.findUnique({
      where: { userId },
      include: { bank: true },
    });

    const totalPracticed = await this.prisma.practiceProgress.count({
      where: { userId, seenAt: { not: null } },
    });

    const masteredCount = await this.prisma.practiceProgress.count({
      where: { userId, masteryScore: { gte: 60 } },
    });

    const favoritesCount = await this.prisma.favoriteQuestion.count({
      where: { userId },
    });

    const wordsCount = await this.prisma.vocabularyWord.count({
      where: { userId },
    });

    const mockExamCount = await this.prisma.mockExamRecord.count({
      where: { userId },
    });

    const latestExam = await this.prisma.mockExamRecord.findFirst({
      where: { userId },
      orderBy: { takenAt: 'desc' },
      include: {
        paper: { select: { title: true } },
      },
    });

    const avgScoreResult = await this.prisma.mockExamRecord.aggregate({
      where: { userId },
      _avg: { score: true },
    });

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentActivity = await this.prisma.dailyActivity.findMany({
      where: {
        userId,
        date: { gte: sevenDaysAgo },
      },
      orderBy: { date: 'desc' },
    });

    const streakDays = this.calculateStreak(recentActivity);

    return {
      userId,
      bank: config?.bank ?? null,
      stats: {
        totalPracticed,
        masteredCount,
        favoritesCount,
        wordsCount,
        mockExamCount,
        averageExamScore: avgScoreResult._avg.score
          ? Math.round(avgScoreResult._avg.score)
          : null,
        streakDays,
      },
      latestExam: latestExam
        ? {
            score: latestExam.score,
            paperTitle: latestExam.paper.title,
            takenAt: latestExam.takenAt,
          }
        : null,
    };
  }

  private calculateStreak(activities: { date: Date; count: number }[]): number {
    if (activities.length === 0) return 0;

    const dates = activities.map((a) => {
      const d = new Date(a.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let streak = 0;
    let currentDate = new Date(today);

    while (true) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      if (dates.includes(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  async getActivityHeatmap(userId: string) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const activities = await this.prisma.dailyActivity.findMany({
      where: {
        userId,
        date: { gte: oneYearAgo },
      },
      orderBy: { date: 'asc' },
    });

    return {
      activities: activities.map((a) => ({
        date: a.date,
        count: a.count,
      })),
    };
  }

  async getPracticeRecords(userId: string, pagination: PaginationDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    // Aggregate by question: count practices + last practice date per question
    const records = await this.prisma.practiceRecord.groupBy({
      by: ['questionId'],
      where: { userId },
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      skip,
      take: pageSize,
    });

    const totalResult = await this.prisma.practiceRecord.groupBy({
      by: ['questionId'],
      where: { userId },
    });
    const total = totalResult.length;

    // Fetch question details
    const questionIds = records.map((r) => r.questionId);
    const questions = await this.prisma.questionItem.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        title: true,
        topic: { select: { id: true, name: true } },
      },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const list = records.map((r) => {
      const q = questionMap.get(r.questionId);
      return {
        recordId: r.questionId,
        topicId: q?.topic?.id || '',
        topicName: q?.topic?.name || '未知专题',
        questionId: r.questionId,
        questionText: q?.title || '未知题目',
        practiceCount: r._count.id,
        lastPracticeAt: r._max.createdAt?.toISOString() || '',
      };
    });

    return { list, total, page, pageSize };
  }
}
