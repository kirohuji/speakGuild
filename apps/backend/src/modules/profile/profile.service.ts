import { LearningStatisticsService } from '../../common/learning-statistics/learning-statistics.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, toPageResult } from '../../common/dto/pagination.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService, private readonly learningStatistics: LearningStatisticsService) {}

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
    const [statistics, favoriteCount, wordCount] = await Promise.all([
      this.learningStatistics.get(userId),
      this.prisma.expressionItem.count({ where: { userId, deletedAt: null } }),
      this.prisma.expressionItem.count({ where: { userId, type: 'word', deletedAt: null } }),
    ]);
    return { userId, stats: { ...statistics, favoriteCount, wordCount } };
  }

  async getActivityHeatmap(userId: string, year?: number) {
    const targetYear = Number.isInteger(year) && year! >= 2020 && year! <= new Date().getFullYear() ? year! : new Date().getFullYear();
    const statistics = await this.learningStatistics.get(userId, `${targetYear}-01-01`, `${targetYear}-12-31`);
    return { activities: statistics.dailyStats.filter(day => day.date.startsWith(`${targetYear}-`)).map(day => ({ ...day, count: day.questionCount || (day.active ? 1 : 0) })) };
  }

  async getPracticeRecords(userId: string, pagination: PaginationDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;
    const where = { userId, status: 'analyzed' };

    const [sessions, topicSessions] = await Promise.all([
      this.prisma.practiceSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
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
      this.prisma.topicSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        include: {
          topic: { select: { title: true, activityType: true, sceneId: true, scene: { select: { title: true } } } },
          submissions: { orderBy: { revision: 'desc' }, take: 1, select: { response: true } },
        },
      }),
    ]);

    const dialogueRecords = sessions.map((session) => {
          const analysis = session.analysisResult as any;
          const topicSnapshot = session.topicSnapshot as any;
          const sceneSnapshot = session.sceneSnapshot as any;
          return {
            recordId: session.id,
            sessionId: session.id,
            topicId: session.topicId,
            // Same pack id as reading/writing records — needed for offline media replay gates.
            unitId: session.sceneId,
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
            recordType: 'dialogue',
          };
        });
    const topicRecords = topicSessions.filter((session) => session.topic.activityType === 'reading' || session.topic.activityType === 'writing').map((session) => {
      const analysis = session.analysisResult as any;
      const response = session.submissions[0]?.response as any;
      return {
        recordId: session.id, sessionId: session.id, topicId: session.topicId,
        unitId: session.topic.sceneId,
        topicName: session.topic.scene?.title || '学习包练习', questionId: session.topicId, questionText: session.topic.title,
        practiceCount: session.topic.activityType === 'reading' ? Object.keys(response?.answers ?? {}).length : 1,
        lastPracticeAt: session.startedAt.toISOString(), status: session.analysisResult ? 'analyzed' : 'failed',
        score: analysis?.overallScore ?? null, summary: analysis?.summary ?? session.analysisError ?? null,
        completedAt: session.completedAt?.toISOString() ?? null, analyzedAt: session.analyzedAt?.toISOString() ?? null,
        recordType: session.topic.activityType,
      };
    });
    const records = [...dialogueRecords, ...topicRecords].sort((a, b) => b.lastPracticeAt.localeCompare(a.lastPracticeAt));
    return { list: records.slice(skip, skip + pageSize), total: records.length, page, pageSize };
  }
}
