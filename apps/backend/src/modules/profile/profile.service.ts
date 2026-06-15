import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, toPageResult } from '../../common/dto/pagination.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeLearningGoals(goals?: string[]) {
    const aliases: Record<string, string> = {
      arrival_roots: 'daily_scenes',
      daily_hustle: 'daily_scenes',
      people: 'daily_scenes',
      work_study: 'course_system',
      crisis_mode: 'daily_scenes',
      out_about: 'daily_scenes',
    };
    const valid = new Set(['foundation_start', 'daily_scenes', 'exam_ielts', 'story_roleplay', 'course_system']);
    return [...new Set((goals ?? [])
      .map((goal) => aliases[goal.trim()] ?? goal.trim())
      .filter((goal) => valid.has(goal)))]
      .slice(0, 3);
  }

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
        hasCompletedOnboarding: true,
        learningGoals: true,
        outputLevel: true,
        outputLevelDetail: true,
      },
    });
    return user;
  }

  async updateUserProfile(userId: string, dto: UpdateUserProfileDto) {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.username !== undefined) {
      data.username = dto.username.trim();
    }
    if (dto.hasCompletedOnboarding !== undefined) {
      data.hasCompletedOnboarding = dto.hasCompletedOnboarding;
    }
    if (dto.learningGoals !== undefined) {
      data.learningGoals = this.normalizeLearningGoals(dto.learningGoals);
    }
    if (dto.outputLevel !== undefined) {
      data.outputLevel = dto.outputLevel;
    }
    if (dto.outputLevelDetail !== undefined) {
      data.outputLevelDetail = dto.outputLevelDetail;
    } else if (dto.outputLevel !== undefined || dto.learningGoals !== undefined) {
      data.outputLevelDetail = {
        source: 'self_assessment',
        assessedAt: new Date().toISOString(),
      };
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
        hasCompletedOnboarding: true,
        learningGoals: true,
        outputLevel: true,
        outputLevelDetail: true,
      },
    });

    return user;
  }

  async getOverview(userId: string) {
    const sessionCount = await this.prisma.practiceSession.count({
      where: { userId },
    });

    const wordsCount = await this.prisma.expressionItem.count({
      where: { userId },
    });

    const expressionCount = await this.prisma.expressionItem.count({
      where: { userId },
    });

    const chunkProgressCount = await this.prisma.userChunkProgress.count({
      where: { userId, status: { in: ['can_output', 'mastered'] } },
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
      stats: {
        totalSessions: sessionCount,
        wordsCount,
        expressionCount,
        chunkMastered: chunkProgressCount,
        streakDays,
      },
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
    const where = { userId, status: 'analyzed' };

    const [sessions, sessionTotal] = await Promise.all([
      this.prisma.practiceSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          topic: {
            select: {
              id: true,
              title: true,
              scene: { select: { id: true, title: true } },
            },
          },
        },
      }),
      this.prisma.practiceSession.count({ where }),
    ]);

    if (sessionTotal > 0) {
      return {
        list: sessions.map((session) => {
          const analysis = session.analysisResult as any;
          const topicSnapshot = session.topicSnapshot as any;
          const sceneSnapshot = session.sceneSnapshot as any;
          return {
            recordId: session.id,
            sessionId: session.id,
            topicId: session.topicId,
            topicName: sceneSnapshot?.title || session.topic.scene?.title || '英语输出训练',
            questionId: session.topicId,
            questionText: topicSnapshot?.title || session.topic.title,
            practiceCount: session.turnCount,
            lastPracticeAt: session.startedAt.toISOString(),
            status: session.status,
            score: analysis?.overallScore ?? null,
            summary: analysis?.summary ?? null,
            completedAt: session.completedAt?.toISOString() ?? null,
            analyzedAt: session.analyzedAt?.toISOString() ?? null,
          };
        }),
        total: sessionTotal,
        page,
        pageSize,
      };
    }

    return { list: [], total: sessionTotal, page, pageSize };
  }
}
