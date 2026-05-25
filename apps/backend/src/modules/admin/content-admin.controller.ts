import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req, ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateSceneCategoryDto, UpdateSceneCategoryDto,
  CreateSceneDto, UpdateSceneDto,
  CreateVocabularyDto, UpdateVocabularyDto,
  CreateTrainingTopicDto, UpdateTrainingTopicDto,
} from './dto/scene-admin.dto';
import {
  CreateChunkDto, UpdateChunkDto,
  CreateScriptEpisodeDto, UpdateScriptEpisodeDto,
  CreateAchievementDefDto, UpdateAchievementDefDto,
} from './dto/content-admin.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('admin/content')
export class ContentAdminController {
  constructor(private readonly prisma: PrismaService) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  // ════════════════════════════════════════════════════════════
  // SCENE CATEGORIES
  // ════════════════════════════════════════════════════════════

  @Get('scene-categories')
  async listCategories(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.sceneCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { scenes: true } },
      },
    });
  }

  @Post('scene-categories')
  async createCategory(@Req() req: Request, @Body() dto: CreateSceneCategoryDto) {
    await this.requireAdmin(req);
    return this.prisma.sceneCategory.create({ data: dto });
  }

  @Patch('scene-categories/:id')
  async updateCategory(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateSceneCategoryDto) {
    await this.requireAdmin(req);
    return this.prisma.sceneCategory.update({ where: { id }, data: dto });
  }

  @Delete('scene-categories/:id')
  async deleteCategory(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    const count = await this.prisma.scene.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new ForbiddenException('该分类下还有场景，请先删除场景');
    }
    return this.prisma.sceneCategory.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // SCENES
  // ════════════════════════════════════════════════════════════

  @Get('scenes')
  async listScenes(@Req() req: Request, @Query('categoryId') categoryId?: string) {
    await this.requireAdmin(req);
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.scene.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { vocabularies: true, chunks: true, trainingTopics: true } },
      },
    });
  }

  @Get('scenes/:id')
  async getScene(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.scene.findUnique({
      where: { id },
      include: {
        category: true,
        vocabularies: { orderBy: { sortOrder: 'asc' } },
        chunks: { orderBy: { createdAt: 'asc' } },
        trainingTopics: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { activeChunks: true } },
          },
        },
      },
    });
  }

  @Post('scenes')
  async createScene(@Req() req: Request, @Body() dto: CreateSceneDto) {
    await this.requireAdmin(req);
    return this.prisma.scene.create({ data: dto });
  }

  @Patch('scenes/:id')
  async updateScene(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateSceneDto) {
    await this.requireAdmin(req);
    return this.prisma.scene.update({ where: { id }, data: dto });
  }

  @Delete('scenes/:id')
  async deleteScene(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.scene.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // VOCABULARY
  // ════════════════════════════════════════════════════════════

  @Get('vocabularies')
  async listVocabularies(@Req() req: Request, @Query('sceneId') sceneId?: string) {
    await this.requireAdmin(req);
    const where: any = {};
    if (sceneId) where.sceneId = sceneId;
    return this.prisma.sceneVocabulary.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { scene: { select: { id: true, title: true } } },
    });
  }

  @Post('vocabularies')
  async createVocabulary(@Req() req: Request, @Body() dto: CreateVocabularyDto) {
    await this.requireAdmin(req);
    return this.prisma.sceneVocabulary.create({ data: dto });
  }

  @Patch('vocabularies/:id')
  async updateVocabulary(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateVocabularyDto) {
    await this.requireAdmin(req);
    return this.prisma.sceneVocabulary.update({ where: { id }, data: dto });
  }

  @Delete('vocabularies/:id')
  async deleteVocabulary(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.sceneVocabulary.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // TRAINING TOPICS
  // ════════════════════════════════════════════════════════════

  @Get('training-topics')
  async listTrainingTopics(@Req() req: Request, @Query('sceneId') sceneId?: string) {
    await this.requireAdmin(req);
    const where: any = {};
    if (sceneId) where.sceneId = sceneId;
    return this.prisma.trainingTopic.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        scene: { select: { id: true, title: true } },
        activeChunks: {
          include: { chunk: { select: { id: true, text: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  @Post('training-topics')
  async createTrainingTopic(@Req() req: Request, @Body() dto: CreateTrainingTopicDto) {
    await this.requireAdmin(req);
    const { chunkIds, ...data } = dto;
    const topic = await this.prisma.trainingTopic.create({ data });
    if (chunkIds?.length) {
      await this.prisma.trainingTopicChunk.createMany({
        data: chunkIds.map((chunkId, i) => ({
          topicId: topic.id,
          chunkId,
          sortOrder: i,
        })),
      });
    }
    return this.prisma.trainingTopic.findUnique({
      where: { id: topic.id },
      include: {
        activeChunks: { include: { chunk: true } },
      },
    });
  }

  @Patch('training-topics/:id')
  async updateTrainingTopic(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTrainingTopicDto) {
    await this.requireAdmin(req);
    const { chunkIds, ...data } = dto;
    const topic = await this.prisma.trainingTopic.update({ where: { id }, data });
    if (chunkIds) {
      await this.prisma.trainingTopicChunk.deleteMany({ where: { topicId: id } });
      if (chunkIds.length > 0) {
        await this.prisma.trainingTopicChunk.createMany({
          data: chunkIds.map((chunkId, i) => ({
            topicId: id,
            chunkId,
            sortOrder: i,
          })),
        });
      }
    }
    return this.prisma.trainingTopic.findUnique({
      where: { id },
      include: {
        activeChunks: { include: { chunk: true } },
      },
    });
  }

  @Delete('training-topics/:id')
  async deleteTrainingTopic(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.trainingTopic.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // CHUNKS
  // ════════════════════════════════════════════════════════════

  @Get('chunks')
  async listChunks(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.chunk.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        scene: { select: { id: true, title: true } },
        examples: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { userProgresses: true } },
      },
    });
  }

  @Post('chunks')
  async createChunk(@Req() req: Request, @Body() dto: CreateChunkDto) {
    await this.requireAdmin(req);
    return this.prisma.chunk.create({
      data: {
        text: dto.text,
        meaning: dto.meaning,
        description: dto.description ?? null,
        category: dto.category ?? '',
        difficulty: dto.difficulty ?? 'L2',
        sceneId: dto.sceneId ?? null,
        applicableSceneIds: dto.applicableSceneIds ?? [],
        examples: dto.examples?.length
          ? {
              create: dto.examples.map((example, i) => ({
                en: example.en,
                zh: example.zh,
                note: example.note ?? null,
                level: example.level ?? 'basic',
                sceneId: example.sceneId ?? null,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: {
        scene: { select: { id: true, title: true } },
        examples: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { userProgresses: true } },
      },
    });
  }

  @Patch('chunks/:id')
  async updateChunk(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateChunkDto) {
    await this.requireAdmin(req);
    const data: any = {};
    if (dto.text !== undefined) data.text = dto.text;
    if (dto.meaning !== undefined) data.meaning = dto.meaning;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.sceneId !== undefined) data.sceneId = dto.sceneId;
    if (dto.applicableSceneIds !== undefined) data.applicableSceneIds = dto.applicableSceneIds;
    return this.prisma.$transaction(async (tx) => {
      const chunk = await tx.chunk.update({ where: { id }, data });
      if (dto.examples !== undefined) {
        await tx.chunkExample.deleteMany({ where: { chunkId: id } });
        if (dto.examples.length > 0) {
          await tx.chunkExample.createMany({
            data: dto.examples.map((example, i) => ({
              chunkId: id,
              en: example.en,
              zh: example.zh,
              note: example.note ?? null,
              level: example.level ?? 'basic',
              sceneId: example.sceneId ?? null,
              sortOrder: i,
            })),
          });
        }
      }
      return tx.chunk.findUnique({
        where: { id: chunk.id },
        include: {
          scene: { select: { id: true, title: true } },
          examples: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { userProgresses: true } },
        },
      });
    });
  }

  @Delete('chunks/:id')
  async deleteChunk(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.chunk.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // SCRIPT EPISODES
  // ════════════════════════════════════════════════════════════

  @Get('script-episodes')
  async listScriptEpisodes(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.scriptEpisode.findMany({
      orderBy: [{ chapterId: 'asc' }, { episodeOrder: 'asc' }],
      include: {
        scene: { select: { id: true, title: true } },
        _count: { select: { records: true, dialogues: true } },
      },
    });
  }

  @Get('script-episodes/:id')
  async getScriptEpisode(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.scriptEpisode.findUnique({
      where: { id },
      include: {
        scene: true,
        coreVocabularies: { include: { vocab: true } },
        coreChunks: { include: { chunk: true } },
      },
    });
  }

  @Post('script-episodes')
  async createScriptEpisode(@Req() req: Request, @Body() dto: CreateScriptEpisodeDto) {
    await this.requireAdmin(req);
    const { vocabIds, chunkIds, ...rest } = dto;
    const episode = await this.prisma.scriptEpisode.create({
      data: {
        chapterId: rest.chapterId,
        chapterTitle: rest.chapterTitle,
        episodeOrder: rest.episodeOrder,
        title: rest.title,
        description: rest.description ?? null,
        sceneId: rest.sceneId,
        requiredOutputLevel: rest.requiredOutputLevel ?? 'L1',
        requiredUserLevel: rest.requiredUserLevel ?? 1,
        vocabRequiredCount: rest.vocabRequiredCount ?? 6,
        vocabTotalCount: rest.vocabTotalCount ?? 10,
        chunkRequiredCount: rest.chunkRequiredCount ?? 6,
        chunkTotalCount: rest.chunkTotalCount ?? 10,
        prerequisiteEpisodes: rest.prerequisiteEpisodes ?? [],
        objectives: rest.objectives ?? [],
        passObjectiveCount: rest.passObjectiveCount ?? 3,
        passChunkCount: rest.passChunkCount ?? 3,
        passRetellRequired: rest.passRetellRequired ?? true,
        passMinDialogues: rest.passMinDialogues ?? 3,
        rewards: rest.rewards ?? {},
        npcName: rest.npcName ?? '',
        npcRole: rest.npcRole ?? '',
        npcPersonality: rest.npcPersonality ?? null,
        inkScriptId: rest.inkScriptId ?? null,
        isPreview: rest.isPreview ?? false,
      },
    });
    if (vocabIds?.length) {
      await this.prisma.scriptEpisodeVocab.createMany({
        data: vocabIds.map((vocabId) => ({ episodeId: episode.id, vocabId })),
      });
    }
    if (chunkIds?.length) {
      await this.prisma.scriptEpisodeChunk.createMany({
        data: chunkIds.map((chunkId) => ({ episodeId: episode.id, chunkId })),
      });
    }
    return episode;
  }

  @Patch('script-episodes/:id')
  async updateScriptEpisode(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateScriptEpisodeDto) {
    await this.requireAdmin(req);
    const { vocabIds, chunkIds, ...rest } = dto;
    const data: any = {};
    if (rest.chapterId !== undefined) data.chapterId = rest.chapterId;
    if (rest.chapterTitle !== undefined) data.chapterTitle = rest.chapterTitle;
    if (rest.episodeOrder !== undefined) data.episodeOrder = rest.episodeOrder;
    if (rest.title !== undefined) data.title = rest.title;
    if (rest.description !== undefined) data.description = rest.description;
    if (rest.sceneId !== undefined) data.sceneId = rest.sceneId;
    if (rest.requiredOutputLevel !== undefined) data.requiredOutputLevel = rest.requiredOutputLevel;
    if (rest.requiredUserLevel !== undefined) data.requiredUserLevel = rest.requiredUserLevel;
    if (rest.vocabRequiredCount !== undefined) data.vocabRequiredCount = rest.vocabRequiredCount;
    if (rest.vocabTotalCount !== undefined) data.vocabTotalCount = rest.vocabTotalCount;
    if (rest.chunkRequiredCount !== undefined) data.chunkRequiredCount = rest.chunkRequiredCount;
    if (rest.chunkTotalCount !== undefined) data.chunkTotalCount = rest.chunkTotalCount;
    if (rest.prerequisiteEpisodes !== undefined) data.prerequisiteEpisodes = rest.prerequisiteEpisodes;
    if (rest.objectives !== undefined) data.objectives = rest.objectives;
    if (rest.passObjectiveCount !== undefined) data.passObjectiveCount = rest.passObjectiveCount;
    if (rest.passChunkCount !== undefined) data.passChunkCount = rest.passChunkCount;
    if (rest.passRetellRequired !== undefined) data.passRetellRequired = rest.passRetellRequired;
    if (rest.passMinDialogues !== undefined) data.passMinDialogues = rest.passMinDialogues;
    if (rest.rewards !== undefined) data.rewards = rest.rewards;
    if (rest.npcName !== undefined) data.npcName = rest.npcName;
    if (rest.npcRole !== undefined) data.npcRole = rest.npcRole;
    if (rest.npcPersonality !== undefined) data.npcPersonality = rest.npcPersonality;
    if (rest.inkScriptId !== undefined) data.inkScriptId = rest.inkScriptId;
    if (rest.isPreview !== undefined) data.isPreview = rest.isPreview;
    const episode = await this.prisma.scriptEpisode.update({ where: { id }, data });
    if (vocabIds) {
      await this.prisma.scriptEpisodeVocab.deleteMany({ where: { episodeId: id } });
      if (vocabIds.length > 0) {
        await this.prisma.scriptEpisodeVocab.createMany({
          data: vocabIds.map((vocabId) => ({ episodeId: id, vocabId })),
        });
      }
    }
    if (chunkIds) {
      await this.prisma.scriptEpisodeChunk.deleteMany({ where: { episodeId: id } });
      if (chunkIds.length > 0) {
        await this.prisma.scriptEpisodeChunk.createMany({
          data: chunkIds.map((chunkId) => ({ episodeId: id, chunkId })),
        });
      }
    }
    return episode;
  }

  @Delete('script-episodes/:id')
  async deleteScriptEpisode(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.scriptEpisode.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // ACHIEVEMENT DEFINITIONS
  // ════════════════════════════════════════════════════════════

  @Get('achievements')
  async listAchievementDefs(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.achievementDef.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { userAchievements: true } },
      },
    });
  }

  @Post('achievements')
  async createAchievementDef(@Req() req: Request, @Body() dto: CreateAchievementDefDto) {
    await this.requireAdmin(req);
    const condition = dto.condition ?? { type: 'recording_count', threshold: 1 };
    return this.prisma.achievementDef.create({
      data: {
        key: dto.key,
        title: dto.title,
        description: dto.description,
        category: (dto.category as any) ?? 'milestone',
        rarity: (dto.rarity as any) ?? 'common',
        icon: dto.icon ?? null,
        condition,
        rewardXp: dto.rewardXp ?? 0,
        rewardTitle: dto.rewardTitle ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isHidden: dto.isHidden ?? false,
        hintText: dto.hintText ?? null,
      },
    });
  }

  @Patch('achievements/:id')
  async updateAchievementDef(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAchievementDefDto) {
    await this.requireAdmin(req);
    const data: any = {};
    if (dto.key !== undefined) data.key = dto.key;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.rarity !== undefined) data.rarity = dto.rarity;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.condition !== undefined) data.condition = dto.condition;
    if (dto.rewardXp !== undefined) data.rewardXp = dto.rewardXp;
    if (dto.rewardTitle !== undefined) data.rewardTitle = dto.rewardTitle;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isHidden !== undefined) data.isHidden = dto.isHidden;
    if (dto.hintText !== undefined) data.hintText = dto.hintText;
    return this.prisma.achievementDef.update({ where: { id }, data });
  }

  @Delete('achievements/:id')
  async deleteAchievementDef(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.achievementDef.delete({ where: { id } });
  }
}
