import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateText } from 'ai';
import { Prisma, TopicActivityType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmProviderFactory } from '../../common/llm/llm-provider.factory';
import { AiModelService } from '../ai-model/ai-model.service';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { LearningService } from '../learning/learning.service';
import {
  AssignPackageGroupDto,
  CreatePackageGroupDto,
  SaveNovelProgressDto,
  SaveTopicSubmissionDto,
  UpdatePackageGroupDto,
  UpdateSceneKnowledgeDto,
} from './dto/content-experience.dto';
import { EpubAnalysisService } from './epub-analysis.service';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseJsonResponse(text: string) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI response is not JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

@Injectable()
export class ContentExperienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly epubAnalysis: EpubAnalysisService,
    private readonly fileAssets: FileAssetsService,
    private readonly learning: LearningService,
    private readonly llmFactory: LlmProviderFactory,
    private readonly aiModels: AiModelService,
  ) {}

  listGroups() {
    return this.prisma.packageGroup.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { scene: { select: { id: true, title: true, contentMode: true, coverImage: true } } },
        },
      },
    });
  }

  createGroup(dto: CreatePackageGroupDto) {
    return this.prisma.packageGroup.create({ data: dto });
  }

  updateGroup(id: string, dto: UpdatePackageGroupDto) {
    return this.prisma.packageGroup.update({ where: { id }, data: dto });
  }

  async deleteGroup(id: string) {
    const group = await this.prisma.packageGroup.findUnique({ where: { id }, select: { id: true } });
    if (!group) throw new NotFoundException('内容系列不存在');
    return this.prisma.packageGroup.delete({ where: { id } });
  }

  async assignSceneGroup(sceneId: string, dto: AssignPackageGroupDto) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: { id: true, contentMode: true, groupItem: { select: { groupId: true } } },
    });
    if (!scene) throw new NotFoundException('学习包不存在');
    if (!dto.groupId) {
      await this.prisma.packageGroupItem.deleteMany({ where: { sceneId } });
      return { groupItem: null };
    }
    const group = await this.prisma.packageGroup.findUnique({
      where: { id: dto.groupId },
      include: { items: { orderBy: { sortOrder: 'asc' }, select: { sceneId: true } } },
    });
    if (!group) throw new NotFoundException('内容系列不存在');
    if (group.contentMode && group.contentMode !== scene.contentMode) {
      throw new BadRequestException(`该系列只允许 ${group.contentMode} 类型学习包`);
    }

    const orderedSceneIds = group.items.map((item) => item.sceneId).filter((id) => id !== sceneId);
    const insertAt = Math.min(dto.sortOrder ?? orderedSceneIds.length, orderedSceneIds.length);
    orderedSceneIds.splice(insertAt, 0, sceneId);
    await this.prisma.$transaction(async (tx) => {
      await tx.packageGroupItem.deleteMany({ where: { sceneId } });
      // Avoid the unique (groupId, sortOrder) constraint while reordering.
      await tx.packageGroupItem.updateMany({
        where: { groupId: group.id },
        data: { sortOrder: { increment: 100_000 } },
      });
      for (let index = 0; index < orderedSceneIds.length; index += 1) {
        const memberSceneId = orderedSceneIds[index];
        if (memberSceneId === sceneId) {
          await tx.packageGroupItem.create({
            data: {
              groupId: group.id,
              sceneId,
              sortOrder: index,
              volumeLabel: dto.volumeLabel?.trim() || null,
              requiredPrevious: dto.requiredPrevious ?? false,
            },
          });
        } else {
          await tx.packageGroupItem.update({
            where: { sceneId: memberSceneId },
            data: { sortOrder: index },
          });
        }
      }
    });
    return this.getSceneExperienceAdmin(sceneId);
  }

  async updateSceneKnowledge(sceneId: string, dto: UpdateSceneKnowledgeDto) {
    const scene = await this.prisma.scene.findUnique({ where: { id: sceneId }, select: { id: true } });
    if (!scene) throw new NotFoundException('学习包不存在');
    const vocabularyIds = [...new Set(dto.vocabularyIds)];
    const chunkIds = [...new Set(dto.chunkIds)];
    const patternIds = [...new Set(dto.patternIds)];
    await this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.sceneVocabulary.deleteMany({ where: { sceneId } }),
        tx.sceneChunk.deleteMany({ where: { sceneId } }),
        tx.sceneSentencePattern.deleteMany({ where: { sceneId } }),
      ]);
      if (vocabularyIds.length) await tx.sceneVocabulary.createMany({
        data: vocabularyIds.map((vocabularyId, sortOrder) => ({ sceneId, vocabularyId, sortOrder })),
      });
      if (chunkIds.length) await tx.sceneChunk.createMany({
        data: chunkIds.map((chunkId, sortOrder) => ({ sceneId, chunkId, sortOrder })),
      });
      if (patternIds.length) await tx.sceneSentencePattern.createMany({
        data: patternIds.map((patternId, sortOrder) => ({ sceneId, patternId, sortOrder })),
      });
    });
    return this.getSceneExperienceAdmin(sceneId);
  }

  async attachEpub(sceneId: string, assetId: string) {
    const scene = await this.prisma.scene.findUnique({ where: { id: sceneId }, select: { id: true } });
    if (!scene) throw new NotFoundException('学习包不存在');
    const analysis = await this.epubAnalysis.analyzeAsset(assetId);
    const novel = await this.prisma.$transaction(async (tx) => {
      await tx.scene.update({ where: { id: sceneId }, data: { contentMode: 'novel' } });
      return tx.novelPackage.upsert({
        where: { sceneId },
        create: {
          sceneId,
          epubAssetId: assetId,
          metadata: toJson({ ...analysis.metadata, warnings: analysis.warnings }),
          toc: toJson(analysis.toc),
        },
        update: {
          epubAssetId: assetId,
          metadata: toJson({ ...analysis.metadata, warnings: analysis.warnings }),
          toc: toJson(analysis.toc),
        },
      });
    });
    return { ...novel, analysis };
  }

  async getSceneExperienceAdmin(sceneId: string) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: {
        id: true,
        contentMode: true,
        groupItem: {
          include: { group: true },
        },
        sceneVocabularies: { orderBy: { sortOrder: 'asc' }, include: { vocabulary: true } },
        sceneChunks: { orderBy: { sortOrder: 'asc' }, include: { chunk: true } },
        scenePatterns: { orderBy: { sortOrder: 'asc' }, include: { pattern: true } },
        novelPackage: true,
      },
    });
    if (!scene) throw new NotFoundException('学习包不存在');
    const epubUrl = scene.novelPackage
      ? (await this.fileAssets.getPrivateUrlByAssetId(scene.novelPackage.epubAssetId)).url
      : null;
    return { ...scene, novelPackage: scene.novelPackage ? { ...scene.novelPackage, epubUrl } : null };
  }

  async getPublicSceneExperience(userId: string, sceneId: string) {
    await this.learning.assertLearningPackAccess(userId, sceneId, { allowExistingProgress: true });
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: {
        id: true,
        contentMode: true,
        groupItem: {
          include: {
            group: {
              include: {
                items: {
                  orderBy: { sortOrder: 'asc' },
                  include: { scene: { select: { id: true, title: true, coverImage: true, contentMode: true } } },
                },
              },
            },
          },
        },
        novelPackage: {
          include: { progresses: { where: { userId }, take: 1 } },
        },
      },
    });
    if (!scene) throw new NotFoundException('学习包不存在');
    const epubUrl = scene.novelPackage
      ? (await this.fileAssets.getPrivateUrlByAssetId(scene.novelPackage.epubAssetId)).url
      : null;
    return {
      ...scene,
      novelPackage: scene.novelPackage ? {
        id: scene.novelPackage.id,
        metadata: scene.novelPackage.metadata,
        toc: scene.novelPackage.toc,
        epubUrl,
        progress: scene.novelPackage.progresses[0] ?? null,
      } : null,
    };
  }

  async saveTopicSubmission(userId: string, topicId: string, dto: SaveTopicSubmissionDto) {
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      select: { id: true, sceneId: true, activityType: true },
    });
    if (!topic) throw new NotFoundException('学习话题不存在');
    if (topic.activityType === 'practice') throw new BadRequestException('普通练习继续使用现有练习记录接口');
    await this.learning.assertLearningPackAccess(userId, topic.sceneId, { allowExistingProgress: true });
    const latest = await this.prisma.trainingTopicSubmission.findFirst({
      where: { userId, topicId },
      orderBy: { revision: 'desc' },
    });
    const status = dto.status ?? 'draft';
    let saved;
    if (latest?.status === 'draft' && status === 'draft' && (!dto.revision || dto.revision === latest.revision)) {
      saved = await this.prisma.trainingTopicSubmission.update({
        where: { id: latest.id },
        data: { response: toJson(dto.response) },
      });
    } else {
      const revision = dto.revision ?? (latest?.revision ?? 0) + 1;
      saved = await this.prisma.trainingTopicSubmission.upsert({
        where: { userId_topicId_revision: { userId, topicId, revision } },
        create: { userId, topicId, revision, status, response: toJson(dto.response) },
        update: { status, response: toJson(dto.response) },
      });
    }
    if (saved.status === 'completed') await this.updateTopicExperienceProgress(userId, topic.sceneId);
    return saved;
  }

  async reviewLatestSubmission(userId: string, topicId: string) {
    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id: topicId },
      include: { scene: { select: { id: true, title: true } } },
    });
    if (!topic) throw new NotFoundException('学习话题不存在');
    if (!['writing', 'reading'].includes(topic.activityType)) {
      throw new BadRequestException('只有写作和阅读回答需要 AI 反馈');
    }
    await this.learning.assertLearningPackAccess(userId, topic.sceneId, { allowExistingProgress: true });
    const submission = await this.prisma.trainingTopicSubmission.findFirst({
      where: { userId, topicId },
      orderBy: { revision: 'desc' },
    });
    if (!submission) throw new BadRequestException('请先提交内容');

    const feedback = await this.generateFeedback(topic.activityType, {
      packageTitle: topic.scene.title,
      topicTitle: topic.title,
      promptEn: topic.promptEn,
      promptZh: topic.promptZh,
      config: topic.contentConfig,
      response: submission.response,
    });
    const reviewed = await this.prisma.trainingTopicSubmission.update({
      where: { id: submission.id },
      data: { status: 'reviewed', feedback: toJson(feedback) },
    });
    await this.updateTopicExperienceProgress(userId, topic.sceneId);
    return reviewed;
  }

  async saveNovelProgress(userId: string, sceneId: string, dto: SaveNovelProgressDto) {
    await this.learning.assertLearningPackAccess(userId, sceneId, { allowExistingProgress: true });
    const novel = await this.prisma.novelPackage.findUnique({ where: { sceneId } });
    if (!novel) throw new NotFoundException('小说内容不存在');
    const progress = await this.prisma.novelReadingProgress.upsert({
      where: { userId_novelPackageId: { userId, novelPackageId: novel.id } },
      create: {
        userId,
        novelPackageId: novel.id,
        locator: toJson(dto.locator),
        percentage: dto.percentage,
      },
      update: { locator: toJson(dto.locator), percentage: dto.percentage },
    });
    await this.prisma.userSceneProgress.upsert({
      where: { userId_sceneId: { userId, sceneId } },
      create: { userId, sceneId, readiness: Math.round(dto.percentage * 100), mastery: Math.round(dto.percentage * 100) },
      update: { readiness: Math.round(dto.percentage * 100), mastery: Math.round(dto.percentage * 100) },
    });
    return progress;
  }

  private async updateTopicExperienceProgress(userId: string, sceneId: string) {
    const [total, completed] = await Promise.all([
      this.prisma.trainingTopic.count({ where: { sceneId, activityType: { not: 'practice' } } }),
      this.prisma.trainingTopic.count({
        where: {
          sceneId,
          activityType: { not: 'practice' },
          submissions: { some: { userId, status: { in: ['reviewed', 'completed'] } } },
        },
      }),
    ]);
    const mastery = total > 0 ? Math.round((completed / total) * 100) : 0;
    await this.prisma.userSceneProgress.upsert({
      where: { userId_sceneId: { userId, sceneId } },
      create: { userId, sceneId, completedPracticeCount: completed, readiness: mastery, mastery },
      update: { completedPracticeCount: completed, readiness: mastery, mastery },
    });
  }

  private async generateFeedback(activityType: TopicActivityType, context: Record<string, unknown>) {
    const rawResponse = JSON.stringify(context.response);
    if (rawResponse.length > 20_000) throw new BadRequestException('提交内容过长');
    const fallback = activityType === 'writing'
      ? {
          score: null,
          summary: '内容已保存，但 AI 反馈暂时不可用。你可以先检查题目要求、段落结构和关键表达。',
          strengths: [],
          improvements: ['确认是否覆盖全部写作要点', '检查每段是否只有一个清晰中心'],
          evidence: [],
          nextRevisionFocus: '先完成一次自我修订',
        }
      : {
          score: null,
          summary: '回答已保存，但 AI 反馈暂时不可用。请回到原文核对每个答案的证据。',
          strengths: [],
          improvements: ['为每个答案找到对应原文依据'],
          evidence: [],
          nextRevisionFocus: '补充原文证据',
        };
    try {
      const config = await this.aiModels.getLlmConfig();
      const model = this.llmFactory.create(config);
      const { text } = await generateText({
        model,
        system: `You are an ESL ${activityType} coach. Evaluate the learner's own work, never replace it with a full model answer. Return JSON only with: score (0-100), summary (Chinese), strengths (Chinese string[]), improvements (Chinese string[]), evidence ({quote,comment}[] using exact short excerpts from the learner or reading passage), nextRevisionFocus (Chinese). Ground every claim in supplied content.`,
        prompt: JSON.stringify(context),
        temperature: 0.3,
        maxOutputTokens: 1200,
      });
      return parseJsonResponse(text);
    } catch {
      return fallback;
    }
  }
}
