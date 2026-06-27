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
import {
  CreateFullVocabularyDto, UpdateFullVocabularyDto,
  CreateFullChunkDto, UpdateFullChunkDto,
  CreateSentencePatternDto, UpdateSentencePatternDto,
} from './dto/content-library.dto';
import { requireAuthSession } from '../auth/session.util';
import { EnglishPracticeAiService } from '../practice-ai/english-practice-ai.service';
import { DialogueTurnJudgeDto } from '../practice-ai/dto/english-feedback.dto';
import { DictionaryService } from '../dictionary/dictionary.service';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { TtsService } from '../tts/tts.service';
import { TtsProvider } from '@prisma/client';
import { AdminContentAiService } from './admin-content-ai.service';
import { AiModelService } from '../ai-model/ai-model.service';

@Controller('admin/content')
export class ContentAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practiceAiService: EnglishPracticeAiService,
    private readonly dictionaryService: DictionaryService,
    private readonly ttsService: TtsService,
    private readonly adminContentAiService: AdminContentAiService,
    private readonly aiModelService: AiModelService,
  ) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  private async detachInkScript(id: string) {
    await this.prisma.trainingTopic.updateMany({
      where: { inkScriptId: id },
      data: { inkScriptId: null },
    });
    await this.prisma.inkScript.updateMany({
      where: { id },
      data: { topicId: null, episodeId: null },
    });
  }

  @Post('preview/dialogue-turn')
  async judgePreviewDialogueTurn(@Req() req: Request, @Body() dto: DialogueTurnJudgeDto) {
    await this.requireAdmin(req);
    return this.practiceAiService.judgeDialogueTurn(dto);
  }

  // ════════════════════════════════════════════════════════════
  // SCENE CATEGORIES
  // ════════════════════════════════════════════════════════════

  @Get('scene-categories')
  async listCategories(@Req() req: Request, @Query('packageType') packageType?: string) {
    await this.requireAdmin(req);
    return this.prisma.sceneCategory.findMany({
      where: packageType
        ? {
            scenes: {
              some: { packageType: packageType as any },
            },
          }
        : undefined,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            scenes: packageType ? { where: { packageType: packageType as any } } : true,
          },
        },
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
  async listScenes(
    @Req() req: Request,
    @Query('categoryId') categoryId?: string,
    @Query('packageType') packageType?: string,
  ) {
    await this.requireAdmin(req);
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (packageType) where.packageType = packageType;
    return this.prisma.scene.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { trainingTopics: true, storyEpisodes: true } },
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
        trainingTopics: {
          orderBy: { sortOrder: 'asc' },
          include: {
            topicPatterns: { include: { pattern: true }, orderBy: { sortOrder: 'asc' } },
            topicVocabs: { include: { vocab: true }, orderBy: { sortOrder: 'asc' } },
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
  async listVocabularies(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.vocabulary.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Post('vocabularies')
  async createVocabulary(@Req() req: Request, @Body() dto: CreateVocabularyDto) {
    await this.requireAdmin(req);
    return this.prisma.vocabulary.create({ data: dto });
  }

  @Patch('vocabularies/:id')
  async updateVocabulary(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateVocabularyDto) {
    await this.requireAdmin(req);
    return this.prisma.vocabulary.update({ where: { id }, data: dto });
  }

  @Delete('vocabularies/:id')
  async deleteVocabulary(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.vocabulary.delete({ where: { id } });
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
        topicPatterns: { include: { pattern: true }, orderBy: { sortOrder: 'asc' } },
        topicVocabs: { include: { vocab: true }, orderBy: { sortOrder: 'asc' } },
        activeChunks: {
          include: { chunk: { include: { examples: { orderBy: { sortOrder: 'asc' } } } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  @Post('training-topics')
  async createTrainingTopic(@Req() req: Request, @Body() dto: CreateTrainingTopicDto) {
    await this.requireAdmin(req);
    const { chunkIds, vocabIds, patternIds, sentencePatterns, ...data } = dto;
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
    if (vocabIds?.length) {
      await this.prisma.trainingTopicVocab.createMany({
        data: vocabIds.map((vocabId, i) => ({
          topicId: topic.id,
          vocabId,
          sortOrder: i,
        })),
      });
    }
    // Prefer patternIds (multi-select); fall back to inline sentencePatterns
    if (patternIds?.length) {
      await this.prisma.trainingTopicSentencePattern.createMany({
        data: patternIds.map((patternId, i) => ({
          topicId: topic.id,
          patternId,
          sortOrder: i,
        })),
      });
    } else if (sentencePatterns?.length) {
      // Upsert each pattern into SentencePattern, then create join records
      for (const sp of sentencePatterns) {
        const patternRecord = await this.prisma.sentencePattern.upsert({
          where: { pattern: sp.pattern },
          create: {
            pattern: sp.pattern,
            meaning: sp.meaning || null,
            slots: sp.slots || undefined,
            examples: undefined,
            difficulty: sp.difficulty || 'L1',
          },
          update: {},
        });
        await this.prisma.trainingTopicSentencePattern.create({
          data: {
            topicId: topic.id,
            patternId: patternRecord.id,
            sortOrder: sp.sortOrder ?? 0,
          },
        });
      }
    }
    return this.prisma.trainingTopic.findUnique({
      where: { id: topic.id },
      include: {
        topicPatterns: { include: { pattern: true }, orderBy: { sortOrder: 'asc' } },
        topicVocabs: { include: { vocab: true }, orderBy: { sortOrder: 'asc' } },
        activeChunks: { include: { chunk: true } },
      },
    });
  }

  @Patch('training-topics/:id')
  async updateTrainingTopic(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTrainingTopicDto) {
    await this.requireAdmin(req);
    const { chunkIds, vocabIds, patternIds, sentencePatterns, ...data } = dto;
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
    if (vocabIds) {
      await this.prisma.trainingTopicVocab.deleteMany({ where: { topicId: id } });
      if (vocabIds.length > 0) {
        await this.prisma.trainingTopicVocab.createMany({
          data: vocabIds.map((vocabId, i) => ({
            topicId: id,
            vocabId,
            sortOrder: i,
          })),
        });
      }
    }
    // Prefer patternIds (multi-select); fall back to inline sentencePatterns
    if (patternIds) {
      await this.prisma.trainingTopicSentencePattern.deleteMany({ where: { topicId: id } });
      if (patternIds.length > 0) {
        await this.prisma.trainingTopicSentencePattern.createMany({
          data: patternIds.map((patternId, i) => ({
            topicId: id,
            patternId,
            sortOrder: i,
          })),
        });
      }
    } else if (sentencePatterns) {
      await this.prisma.trainingTopicSentencePattern.deleteMany({ where: { topicId: id } });
      if (sentencePatterns.length > 0) {
        for (const sp of sentencePatterns) {
          const patternRecord = await this.prisma.sentencePattern.upsert({
            where: { pattern: sp.pattern },
            create: {
              pattern: sp.pattern,
              meaning: sp.meaning || null,
              slots: sp.slots || undefined,
              examples: undefined,
              difficulty: sp.difficulty || 'L1',
            },
            update: {},
          });
          await this.prisma.trainingTopicSentencePattern.create({
            data: {
              topicId: id,
              patternId: patternRecord.id,
              sortOrder: sp.sortOrder ?? 0,
            },
          });
        }
      }
    }
    return this.prisma.trainingTopic.findUnique({
      where: { id },
      include: {
        topicPatterns: { include: { pattern: true }, orderBy: { sortOrder: 'asc' } },
        topicVocabs: { include: { vocab: true }, orderBy: { sortOrder: 'asc' } },
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
        examples: dto.examples?.length
          ? {
              create: dto.examples.map((example, i) => ({
                en: example.en,
                zh: example.zh,
                note: example.note ?? null,
                level: example.level ?? 'basic',
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: {
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
              sortOrder: i,
            })),
          });
        }
      }
      return tx.chunk.findUnique({
        where: { id: chunk.id },
        include: {
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
  async listScriptEpisodes(@Req() req: Request, @Query('sceneId') sceneId?: string) {
    await this.requireAdmin(req);
    const episodes = await this.prisma.storyEpisode.findMany({
      where: sceneId ? { sceneId } : undefined,
      orderBy: [{ chapterKey: 'asc' }, { sortOrder: 'asc' }],
      include: {
        scene: { select: { id: true, title: true } },
        _count: { select: { records: true, turns: true } },
      },
    });
    return episodes.map((episode) => ({
      ...episode,
      chapterId: episode.chapterKey,
      chapterTitle: episode.chapterName,
      episodeOrder: episode.sortOrder,
      npcName: episode.characterName,
      npcRole: episode.characterRole,
      npcPersonality: episode.characterPersona,
      vocabRequiredCount: episode.requiredVocabularyCount,
      vocabTotalCount: episode.totalVocabularyCount,
      chunkRequiredCount: episode.requiredChunkCount,
      chunkTotalCount: episode.totalChunkCount,
      prerequisiteEpisodes: episode.prerequisiteEpisodeIds,
      passObjectiveCount: episode.requiredObjectiveCount,
      passChunkCount: episode.requiredUsedChunkCount,
      passRetellRequired: episode.requiresRetell,
      passMinDialogues: episode.minimumTurnCount,
      _count: { records: episode._count.records, dialogues: episode._count.turns },
    }));
  }

  @Get('script-episodes/:id')
  async getScriptEpisode(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    const episode = await this.prisma.storyEpisode.findUnique({
      where: { id },
      include: {
        scene: true,
        vocabularies: { include: { vocabulary: true } },
        chunks: { include: { chunk: true } },
      },
    });
    if (!episode) return null;
    return {
      ...episode,
      chapterId: episode.chapterKey,
      chapterTitle: episode.chapterName,
      episodeOrder: episode.sortOrder,
      npcName: episode.characterName,
      npcRole: episode.characterRole,
      npcPersonality: episode.characterPersona,
      vocabRequiredCount: episode.requiredVocabularyCount,
      vocabTotalCount: episode.totalVocabularyCount,
      chunkRequiredCount: episode.requiredChunkCount,
      chunkTotalCount: episode.totalChunkCount,
      prerequisiteEpisodes: episode.prerequisiteEpisodeIds,
      passObjectiveCount: episode.requiredObjectiveCount,
      passChunkCount: episode.requiredUsedChunkCount,
      passRetellRequired: episode.requiresRetell,
      passMinDialogues: episode.minimumTurnCount,
      coreVocabularies: episode.vocabularies.map((item) => ({ ...item, vocab: item.vocabulary })),
      coreChunks: episode.chunks,
    };
  }

  @Post('script-episodes')
  async createScriptEpisode(@Req() req: Request, @Body() dto: CreateScriptEpisodeDto) {
    await this.requireAdmin(req);
    const { vocabIds, chunkIds, ...rest } = dto;
    const episode = await this.prisma.storyEpisode.create({
      data: {
        chapterKey: rest.chapterId,
        chapterName: rest.chapterTitle,
        sortOrder: rest.episodeOrder,
        title: rest.title,
        description: rest.description ?? null,
        sceneId: rest.sceneId,
        requiredOutputLevel: rest.requiredOutputLevel ?? 'L1',
        requiredUserLevel: rest.requiredUserLevel ?? 1,
        requiredVocabularyCount: rest.vocabRequiredCount ?? 6,
        totalVocabularyCount: rest.vocabTotalCount ?? 10,
        requiredChunkCount: rest.chunkRequiredCount ?? 6,
        totalChunkCount: rest.chunkTotalCount ?? 10,
        prerequisiteEpisodeIds: rest.prerequisiteEpisodes ?? [],
        objectives: rest.objectives ?? [],
        requiredObjectiveCount: rest.passObjectiveCount ?? 3,
        requiredUsedChunkCount: rest.passChunkCount ?? 3,
        requiresRetell: rest.passRetellRequired ?? true,
        minimumTurnCount: rest.passMinDialogues ?? 3,
        rewards: rest.rewards ?? {},
        characterName: rest.npcName ?? '',
        characterRole: rest.npcRole ?? '',
        characterPersona: rest.npcPersonality ?? null,
        inkScriptId: rest.inkScriptId ?? null,
        isPreview: rest.isPreview ?? false,
      },
    });
    if (vocabIds?.length) {
      await this.prisma.storyEpisodeVocabulary.createMany({
        data: vocabIds.map((vocabId) => ({ episodeId: episode.id, vocabId })),
      });
    }
    if (chunkIds?.length) {
      await this.prisma.storyEpisodeChunk.createMany({
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
    if (rest.chapterId !== undefined) data.chapterKey = rest.chapterId;
    if (rest.chapterTitle !== undefined) data.chapterName = rest.chapterTitle;
    if (rest.episodeOrder !== undefined) data.sortOrder = rest.episodeOrder;
    if (rest.title !== undefined) data.title = rest.title;
    if (rest.description !== undefined) data.description = rest.description;
    if (rest.sceneId !== undefined) data.sceneId = rest.sceneId;
    if (rest.requiredOutputLevel !== undefined) data.requiredOutputLevel = rest.requiredOutputLevel;
    if (rest.requiredUserLevel !== undefined) data.requiredUserLevel = rest.requiredUserLevel;
    if (rest.vocabRequiredCount !== undefined) data.requiredVocabularyCount = rest.vocabRequiredCount;
    if (rest.vocabTotalCount !== undefined) data.totalVocabularyCount = rest.vocabTotalCount;
    if (rest.chunkRequiredCount !== undefined) data.requiredChunkCount = rest.chunkRequiredCount;
    if (rest.chunkTotalCount !== undefined) data.totalChunkCount = rest.chunkTotalCount;
    if (rest.prerequisiteEpisodes !== undefined) data.prerequisiteEpisodeIds = rest.prerequisiteEpisodes;
    if (rest.objectives !== undefined) data.objectives = rest.objectives;
    if (rest.passObjectiveCount !== undefined) data.requiredObjectiveCount = rest.passObjectiveCount;
    if (rest.passChunkCount !== undefined) data.requiredUsedChunkCount = rest.passChunkCount;
    if (rest.passRetellRequired !== undefined) data.requiresRetell = rest.passRetellRequired;
    if (rest.passMinDialogues !== undefined) data.minimumTurnCount = rest.passMinDialogues;
    if (rest.rewards !== undefined) data.rewards = rest.rewards;
    if (rest.npcName !== undefined) data.characterName = rest.npcName;
    if (rest.npcRole !== undefined) data.characterRole = rest.npcRole;
    if (rest.npcPersonality !== undefined) data.characterPersona = rest.npcPersonality;
    if (rest.inkScriptId !== undefined) data.inkScriptId = rest.inkScriptId;
    if (rest.isPreview !== undefined) data.isPreview = rest.isPreview;
    const episode = await this.prisma.storyEpisode.update({ where: { id }, data });
    if (vocabIds) {
      await this.prisma.storyEpisodeVocabulary.deleteMany({ where: { episodeId: id } });
      if (vocabIds.length > 0) {
        await this.prisma.storyEpisodeVocabulary.createMany({
          data: vocabIds.map((vocabId) => ({ episodeId: id, vocabId })),
        });
      }
    }
    if (chunkIds) {
      await this.prisma.storyEpisodeChunk.deleteMany({ where: { episodeId: id } });
      if (chunkIds.length > 0) {
        await this.prisma.storyEpisodeChunk.createMany({
          data: chunkIds.map((chunkId) => ({ episodeId: id, chunkId })),
        });
      }
    }
    return episode;
  }

  @Delete('script-episodes/:id')
  async deleteScriptEpisode(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.storyEpisode.delete({ where: { id } });
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

  // ════════════════════════════════════════════════════════════
  // GAME CHARACTERS (角色管理)
  // ════════════════════════════════════════════════════════════

  @Get('characters')
  async listCharacters(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.gameCharacter.findMany({
      orderBy: { createdAt: 'asc' },
      include: { roomNpcs: { include: { room: { select: { id: true, displayName: true, location: { select: { id: true, displayName: true } } } } } } },
    });
  }

  @Post('characters')
  async createCharacter(@Req() req: Request, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.gameCharacter.create({ data: dto });
  }

  @Patch('characters/:id')
  async updateCharacter(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.gameCharacter.update({ where: { id }, data: dto });
  }

  @Delete('characters/:id')
  async deleteCharacter(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.gameCharacter.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // GAME MAPS + LOCATIONS + ROOMS（NQTR Navigation: Map→Location→Room）
  // ════════════════════════════════════════════════════════════

  @Get('maps')
  async listMaps(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.gameMap.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        locations: {
          orderBy: { sortOrder: 'asc' },
          include: {
            rooms: {
              orderBy: { sortOrder: 'asc' },
              include: {
                npcs: { include: { character: true } },
              },
            },
          },
        },
      },
    });
  }

  @Post('maps')
  async createMap(@Req() req: Request, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.gameMap.create({ data: dto });
  }

  @Patch('maps/:id')
  async updateMap(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.gameMap.update({ where: { id }, data: dto });
  }

  @Delete('maps/:id')
  async deleteMap(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.gameMap.delete({ where: { id } });
  }

  @Get('locations')
  async listLocations(@Req() req: Request, @Query('mapId') mapId?: string) {
    await this.requireAdmin(req);
    const where: any = {};
    if (mapId) where.mapId = mapId;
    return this.prisma.gameLocation.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        map: { select: { id: true, displayName: true } },
        rooms: {
          orderBy: { sortOrder: 'asc' },
          include: {
            npcs: { include: { character: true } },
          },
        },
      },
    });
  }

  @Post('locations')
  async createLocation(@Req() req: Request, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.gameLocation.create({ data: dto });
  }

  @Patch('locations/:id')
  async updateLocation(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.gameLocation.update({ where: { id }, data: dto });
  }

  @Delete('locations/:id')
  async deleteLocation(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.gameLocation.delete({ where: { id } });
  }

  // ─── Rooms CRUD ─────────────────────────────────────────────

  @Get('rooms')
  async listRooms(@Req() req: Request, @Query('locationId') locationId?: string) {
    await this.requireAdmin(req);
    const where: any = {};
    if (locationId) where.locationId = locationId;
    return this.prisma.gameRoom.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        location: { select: { id: true, displayName: true, map: { select: { id: true, displayName: true } } } },
        npcs: { include: { character: true } },
      },
    });
  }

  @Post('rooms')
  async createRoom(@Req() req: Request, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.gameRoom.create({ data: dto });
  }

  @Patch('rooms/:id')
  async updateRoom(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.gameRoom.update({ where: { id }, data: dto });
  }

  @Delete('rooms/:id')
  async deleteRoom(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.gameRoom.delete({ where: { id } });
  }

  // ─── Room NPCs ──────────────────────────────────────────────

  @Post('room-npcs')
  async addRoomNpc(@Req() req: Request, @Body() dto: { roomId: string; characterId: string; sortOrder?: number }) {
    await this.requireAdmin(req);
    return this.prisma.gameRoomNpc.create({ data: dto, include: { character: true } });
  }

  @Delete('room-npcs/:id')
  async removeRoomNpc(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.gameRoomNpc.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // STORIES / INK SCRIPTS (故事管理)
  // ════════════════════════════════════════════════════════════

  @Get('stories')
  async listStories(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('scriptType') scriptType?: string,
    @Query('packageType') packageType?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);
    const where: any = {}
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } },
        { trainingTopic: { title: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (scriptType && scriptType !== 'all') where.scriptType = scriptType
    // 一级分类 (packageType) 和二级分类 (categoryId) 都通过 trainingTopic → scene 过滤
    const sceneWhere: any = {}
    if (packageType && packageType !== 'all') sceneWhere.packageType = packageType
    if (categoryId && categoryId !== 'all') sceneWhere.categoryId = categoryId
    if (Object.keys(sceneWhere).length > 0) {
      where.trainingTopic = { scene: sceneWhere }
    }

    const p = Math.max(1, parseInt(page || '1'))
    const ps = Math.min(50, Math.max(1, parseInt(pageSize || '12')))

    const [items, total] = await Promise.all([
      this.prisma.inkScript.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        select: {
          id: true, key: true, title: true, scriptType: true,
          episodeId: true, locationId: true, topicId: true,
          version: true, createdAt: true, updatedAt: true,
          trainingTopic: {
            select: {
              id: true,
              title: true,
              scene: {
                select: {
                  id: true,
                  title: true,
                  packageType: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.inkScript.count({ where }),
    ])

    return { items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) }
  }

  @Get('stories/filters')
  async getStoryFilters(@Req() req: Request) {
    await this.requireAdmin(req);
    const [scriptTypes, categories] = await Promise.all([
      this.prisma.inkScript.findMany({
        select: { scriptType: true },
        distinct: ['scriptType'],
      }),
      this.prisma.sceneCategory.findMany({
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ])
    return {
      scriptTypes: scriptTypes.map((s) => s.scriptType),
      // 一级分类使用枚举常量，与学习包管理完全一致
      packageTypes: ['daily', 'exam', 'story', 'course', 'foundation'],
      categories,
    }
  }

  @Get('stories/:id')
  async getStory(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    const story = await this.prisma.inkScript.findUnique({
      where: { id },
      include: {
        trainingTopic: {
          select: {
            id: true,
            title: true,
            teachingMarkdown: true,
            scene: {
              select: {
                id: true,
                title: true,
                packageType: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!story || story.trainingTopic || !story.topicId) return story;
    const legacyTopic = await this.prisma.trainingTopic.findUnique({
      where: { id: story.topicId },
      select: {
        id: true,
        title: true,
        teachingMarkdown: true,
        scene: {
          select: {
            id: true,
            title: true,
            packageType: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
    return { ...story, trainingTopic: legacyTopic };
  }

  @Post('stories')
  async createStory(@Req() req: Request, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.inkScript.create({
      data: dto,
      include: {
        trainingTopic: {
          select: {
            id: true,
            title: true,
            teachingMarkdown: true,
            scene: {
              select: {
                id: true,
                title: true,
                packageType: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  @Patch('stories/:id')
  async updateStory(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.inkScript.update({
      where: { id },
      data: dto,
      include: {
        trainingTopic: {
          select: {
            id: true,
            title: true,
            teachingMarkdown: true,
            scene: {
              select: {
                id: true,
                title: true,
                packageType: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  @Delete('stories/by-scene/:sceneId')
  async deleteStoriesByScene(@Req() req: Request, @Param('sceneId') sceneId: string) {
    await this.requireAdmin(req);
    const topics = await this.prisma.trainingTopic.findMany({
      where: { sceneId },
      select: { id: true, inkScriptId: true },
    });
    const topicIds = topics.map(t => t.id);
    const directInkIds = topics.map(t => t.inkScriptId).filter(Boolean) as string[];
    const legacyInk = topicIds.length
      ? await this.prisma.inkScript.findMany({
          where: { topicId: { in: topicIds } },
          select: { id: true },
        })
      : [];
    const inkIds = Array.from(new Set([...directInkIds, ...legacyInk.map(s => s.id)]));
    if (inkIds.length === 0) return { success: true, count: 0 };
    await this.prisma.trainingTopic.updateMany({
      where: { inkScriptId: { in: inkIds } },
      data: { inkScriptId: null },
    });
    await this.prisma.inkScript.deleteMany({ where: { id: { in: inkIds } } });
    return { success: true, count: inkIds.length };
  }

  @Delete('stories/:id')
  async deleteStory(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    await this.detachInkScript(id);
    return this.prisma.inkScript.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // STORY AI TOOLS: 生成 / 翻译 / 音频
  // ════════════════════════════════════════════════════════════

  /**
   * AI 生成 Ink 剧情脚本
   *
   * 工作流程：
   * 1. 先获取绑定的训练话题完整信息（目标、知识点、句块、词汇）
   * 2. 结合用户选定的角色（性格、身份）和场景地点
   * 3. 用 DeepSeek 分析话题教学目标 → 设计对话场景 → 生成完整 Ink 脚本
   */
  @Post('stories/ai-generate')
  async aiGenerateStory(
    @Req() req: Request,
    @Body() dto: {
      topicId: string;
      storyKey: string;
      title: string;
      goalPrompt?: string;
      characterNames?: string[];
      /** 选定角色的性格描述 */
      characterPersonality?: string;
      /** 选定角色的身份/角色类型 */
      characterRole?: string;
      /** 选定角色的显示名称 */
      characterDisplayName?: string;
      /** 故事发生的地点/场景名称 */
      locationName?: string;
      /** 场景的背景图片 URL（用于 # bg: 标签） */
      locationBackgroundUrl?: string;
    },
  ) {
    await this.requireAdmin(req);

    try {
      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置');

      // ── 1. 获取话题完整信息 ──
      const topic = await this.prisma.trainingTopic.findUnique({
        where: { id: dto.topicId },
        include: {
          activeChunks: { include: { chunk: { include: { examples: { take: 2, orderBy: { sortOrder: 'asc' } } } } } },
          topicVocabs: { include: { vocab: true } },
          scene: { select: { title: true, location: true } },
        },
      });

      if (!topic) throw new Error('话题不存在');

      // ── 2. 构建话题分析信息 ──
      const topicInfoParts: string[] = [];

      topicInfoParts.push(`**话题标题**: ${topic.title}`);
      if (topic.description) topicInfoParts.push(`**话题描述**: ${topic.description}`);
      if (topic.promptZh) topicInfoParts.push(`**训练目标（中文）**: ${topic.promptZh}`);
      if (topic.promptEn) topicInfoParts.push(`**训练目标（英文）**: ${topic.promptEn}`);
      if (topic.knowledgePoints) topicInfoParts.push(`**知识点**: ${topic.knowledgePoints}`);
      topicInfoParts.push(`**难度等级**: ${topic.difficulty}`);

      if (topic.activeChunks.length > 0) {
        topicInfoParts.push(`\n**需融入的英语句块**:`);
        for (const tc of topic.activeChunks) {
          const c = tc.chunk;
          topicInfoParts.push(`  - "${c.text}" → ${c.meaning}`);
          if (c.examples?.length) {
            for (const ex of c.examples.slice(0, 2)) {
              topicInfoParts.push(`    例: ${ex.en}`);
            }
          }
        }
      }

      if (topic.topicVocabs.length > 0) {
        topicInfoParts.push(`\n**需融入的词汇**:`);
        for (const tv of topic.topicVocabs) {
          topicInfoParts.push(`  - ${tv.vocab.word}: ${tv.vocab.meaning || ''}`);
        }
      }

      const topicInfoBlock = topicInfoParts.join('\n');

      // ── 3. 构建角色和场景信息 ──
      const roleBlockParts: string[] = [];

      if (dto.characterDisplayName || dto.characterNames?.length) {
        roleBlockParts.push(`\n## 角色信息`);
        if (dto.characterDisplayName) {
          roleBlockParts.push(`- 主角名称: ${dto.characterDisplayName}`);
        }
        if (dto.characterRole) {
          roleBlockParts.push(`- 主角身份: ${dto.characterRole}`);
        }
        if (dto.characterPersonality) {
          roleBlockParts.push(`- 主角性格: ${dto.characterPersonality}`);
        }
        if (dto.characterNames?.length && !dto.characterDisplayName) {
          roleBlockParts.push(`- 可用角色: ${dto.characterNames.join(', ')}`);
        }
      }

      if (dto.locationName) {
        roleBlockParts.push(`\n## 场景信息`);
        roleBlockParts.push(`- 故事发生地点: ${dto.locationName}`);
        roleBlockParts.push(`- 请围绕这个地点设计合理的对话场景`);
        if (dto.locationBackgroundUrl) {
          roleBlockParts.push(`- 该地点的背景图片 URL: ${dto.locationBackgroundUrl}`);
          roleBlockParts.push(`- **重要**: 故事第一个场景开头必须使用 \`# bg:${dto.locationBackgroundUrl}\` 标签设置背景`);
          roleBlockParts.push(`- 如果故事更换了场景地点，也可以用 \`# bg:新的URL\` 切换背景`);
        }
      }

      if (dto.goalPrompt) {
        roleBlockParts.push(`\n## 用户的额外创作要求（中文）`);
        roleBlockParts.push(dto.goalPrompt);
      }

      const roleBlock = roleBlockParts.join('\n');

      // ── 4. 调用 DeepSeek 生成 ──
      const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
      const model = client.chat('deepseek-chat');

      const { text } = await generateText({
        model,
        prompt: `你是一位资深的英语教学剧情设计师。你的任务是为中国英语学习者（B1-B2 CEFR 水平）创作沉浸式英语对话剧本。

---

## 第一步：分析教学话题

请先仔细阅读以下话题信息，理解**这个对话要教什么**：

${topicInfoBlock}

${roleBlock}

---

## 第二步：设计对话剧本（Ink 脚本格式）

基于你对话题教学目标的分析，创作一个完整的 Ink 对话脚本。

### 剧情设计原则
1. **教学目标驱动**: 对话内容必须紧扣话题的训练目标和知识点，确保学习者在对话中能自然接触到目标句块和词汇
2. **角色驱动**: 如果指定了主角，对话要体现该角色的性格特点和身份特征。NPC 对白要符合角色的性格
3. **场景合理**: 对话内容要符合所设定的地点场景，有真实的情境感。如果提供了背景图片 URL，故事开头必须使用 \`# bg:\` 标签设置背景
4. **难度匹配**: 英文对话难度要与话题等级（${topic.difficulty}）匹配，不宜过难或过易
5. **自然流畅**: 像真实场景中的自然交流，不要像课本对话
6. **融入知识点**: 自然地融入句块和词汇，不要生硬堆砌，每个句块至少出现一次
7. **多用口语练习**: ⭐ **重要** — 尽量多地使用 \`# wait:input\` 标签（至少 2-3 处），在 NPC 提问或引导后让学习者做语音输入练习。比如在 NPC 提问 "What do you think?"、"Can you tell me about...?"、"How would you respond?" 之后加上 \`# wait:input\`。**每个 \`# wait:input\` 必须配套 \`# objective:\`（中文练习目标）、\`# hint:\`（中文提示）、\`# chunks:\`（推荐句块，从话题提供的句块中选 1-3 个）**。这些节点是口语训练的核心！
8. **口语节点与选项分开**: \`# wait:input\` 和 \`* 选项\` **不能紧挨着**。在 \`# wait:input\` 和下一组选项之间必须插入至少一条 NPC 对白。顺序应该是：NPC 提问 → \`# wait:input\`（用户语音输入）→ NPC 回应 → \`* 选项\`（用户选择）。这样用户完成口语练习后，先看到 NPC 的回应，然后才看到选项。
9. **选项辅助**: 在非口语练习的决策节点设置 2-3 个选项，给学习者参与感
10. **长度适中**: 3-6 个场景，总对白 10-25 行

### Ink 脚本语法规则（严格遵守）

\`\`\`
---
key: ${dto.storyKey}
title: ${dto.title}
---

-> start

=== start ===
# bg: 背景图片URL（如果提供了场景背景）
# speaker: Alex
# expression: default
# translation: 此行对白的中文翻译
Alex: 英文对白内容

# wait:input
# objective: 练习目标（中文，告诉学员这个节点要练什么）
# hint: 练习提示（中文，给学员一点方向性提示）
# chunks: 推荐句块1, 推荐句块2

*   [英文选项文本] -> 目标场景名

=== scene_2 ===
# speaker: Alex
# expression: happy
# translation: 中文翻译
Alex: 更多英文对白

# wait

-> END
\`\`\`

### 标签说明
- \`# bg:背景图片URL\` — 设置当前场景的背景图片（如果有，放在场景的第一行）
- \`# speaker:角色名\` — 设置当前说话者（英文名）
- \`# expression:表情名\` — 立绘表情（default/happy/sad/angry/surprised/thinking）
- \`# position:位置\` — 立绘位置（left/center/right）
- \`# translation:中文翻译\` — 每条 NPC 对白的**中文翻译**（直接写中文，系统会自动编码）
- \`*   [选项文本] -> 目标场景\` — 分支选项（3个空格缩进）
- \`# wait\` — 暂停，等待用户点击继续
- \`# wait:input\` — 等待用户语音输入（口语练习节点）
  - **必须配套** \`# objective:\`、\`# hint:\`、\`# chunks:\` 三个标签
  - \`# objective:中文练习目标\` — 告诉学员这个口语练习要达成什么目标（如"用英语点一杯咖啡并说明口味偏好"）
  - \`# hint:中文提示\` — 给学员一点方向性提示（如"可以先问候，然后说想要什么，最后说明口味"）
  - \`# chunks:句块1, 句块2\` — 推荐学员使用的英语句块，用逗号分隔，从话题提供的句块中选取 1-3 个最相关的
- \`-> END\` — 结束故事
- 场景定义：\`=== 场景名 ===\`

### 重要规则
- **每条 NPC 对白行都必须有对应的 \`# translation:\` 标签**，内容是地道的中文翻译
- **每个 \`# wait:input\` 节点必须跟随 \`# objective:\`、\`# hint:\`、\`# chunks:\` 三个标签**
- \`# objective:\` 和 \`# hint:\` 用中文写，\`# chunks:\` 用英文句块原文，逗号分隔
- 角色名用英文（如 Alex, Emma, Teacher）
- **所有对白都是 NPC 说的**，不要出现玩家（You / Player / 你）作为说话者。学员通过 \`# wait:input\` 做语音输入来参与对话，不需要学员对白行
- **不要假设玩家姓名**：NPC 对白中不要使用任何具体的玩家名字或称呼（如 "Nice to meet you, Li Ming"、"Your name is Tom, right?"），也不要用"你叫什么名字"之类的句式。对话应适用于任何学习者，用 "you" 即可
- 所有对白和选项都用英文
- 如果指定了主角，该角色应作为主要 NPC 出现
- 场景名使用英文 snake_case（如 coffee_shop, payment_counter）

---

## 输出要求

直接输出完整的 Ink 脚本（从 \`---\` 开始），不要任何解释或 Markdown 代码块标记。确保格式完全正确，可以被 Ink 编译器直接编译。`,
        temperature: 0.7,
        maxOutputTokens: 4000,
      });

      // ── 5. 清洗和修正输出 ──
      let inkSource = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/```ink\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      if (!inkSource.startsWith('---')) {
        const yamlStart = inkSource.indexOf('---');
        if (yamlStart > 0) {
          inkSource = inkSource.slice(yamlStart);
        }
      }

      // 自动 URL-encode 翻译标签中未编码的中文内容
      inkSource = inkSource.replace(
        /^# translation:(.+)$/gm,
        (_match, value) => {
          const trimmed = value.trim();
          if (/[\u4e00-\u9fff]/.test(trimmed)) {
            return `# translation:${encodeURIComponent(trimmed)}`;
          }
          return `# translation:${trimmed}`;
        },
      );

      return {
        code: 200,
        message: 'success',
        data: { inkSource },
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
  }

  /**
   * 双语翻译生成：为故事中所有 NPC 对白行自动生成中文翻译。
   * 解析 Ink 源文件，找到每条对白，用 DeepSeek 生成中文翻译，
   * 然后在对应行前插入 # translation: 标签。
   */
  @Post('stories/:id/translate')
  async translateStory(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);

    try {
      const story = await this.prisma.inkScript.findUnique({ where: { id } });
      if (!story) throw new Error('故事不存在');

      const source = story.inkSource;
      if (!source) throw new Error('故事没有 Ink 源文件');

      // 解析出所有对白行（speaker: text 格式）
      const lines = source.split('\n');
      const dialogueLines: { index: number; speaker: string; text: string; hasTranslation: boolean }[] = [];

      let currentSpeaker = '';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 跳过空行和注释
        if (!line || line.startsWith('//') || line.startsWith('#')) continue;

        // 检查是否是 speaker 标签
        if (line.startsWith('#') && line.includes('speaker:')) {
          continue; // speaker 标签不影响当前收集
        }

        // 检查是否是对白行
        const spoken = line.match(/^([^:：]{1,32})[:：]\s*(.+)$/);
        if (spoken && !line.startsWith('*') && !line.startsWith('->') && !line.startsWith('===')) {
          const speakerName = spoken[1].trim();
          const dialogueText = spoken[2].trim();

          // 跳过元数据行和特殊标记
          if (['key', 'title', 'locationId', 'characterId'].includes(speakerName)) continue;

          // 检查此行上面是否已有 translation 标签
          let hasTranslation = false;
          for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
            if (lines[j].trim().startsWith('# translation:')) {
              hasTranslation = true;
              break;
            }
            if (lines[j].trim() && !lines[j].trim().startsWith('#')) break;
          }

          dialogueLines.push({ index: i, speaker: speakerName, text: dialogueText, hasTranslation });
        }
      }

      if (dialogueLines.length === 0) {
        return { code: 200, message: '没有找到需要翻译的对白行', data: { inkSource: source } };
      }

      // 过滤出没有翻译的行
      const untranslated = dialogueLines.filter((d) => !d.hasTranslation);

      if (untranslated.length === 0) {
        return { code: 200, message: '所有对白已有翻译', data: { inkSource: source } };
      }

      // 构建批量翻译请求
      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置');

      const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
      const model = client.chat('deepseek-chat');

      const dialogueTexts = untranslated.map((d, i) =>
        `[${i}] ${d.speaker}: ${d.text}`,
      ).join('\n');

      const { text: translationResult } = await generateText({
        model,
        prompt: `你是一个专业的中英翻译。请将以下英语教学对话翻译成自然流畅的中文。

## 要求
- 翻译要口语化、自然，符合中文表达习惯
- 保留说话者的语气和情感色彩
- 每条翻译独立、准确
- 返回 JSON 数组格式

## 对话内容
${dialogueTexts}

## 输出格式
只返回一个 JSON 数组，每个元素对应一条翻译的中文文本。不要加任何解释。
格式示例：["中文翻译1", "中文翻译2", ...]

共 ${untranslated.length} 条对话需要翻译。`,
        temperature: 0.3,
        maxOutputTokens: 2000,
      });

      // 解析翻译结果
      let cleaned = translationResult
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      let translations: string[] = [];
      try {
        translations = JSON.parse(cleaned);
      } catch {
        // 尝试逐行解析
        translations = cleaned
          .replace(/^\[|\]$/g, '')
          .split(/\"\s*,\s*\"/)
          .map((s) => s.replace(/^\"|\"$/g, '').trim());
      }

      if (!Array.isArray(translations) || translations.length === 0) {
        throw new Error('AI 翻译结果解析失败');
      }

      // 将翻译插入到源文件中
      const resultLines = [...lines];
      // 从后往前插入，避免索引偏移
      for (let t = untranslated.length - 1; t >= 0; t--) {
        const dialogue = untranslated[t];
        const translation = translations[t] || translations[0] || '';
        if (translation) {
          // 在对白行前面插入 translation 标签
          const encodedTranslation = encodeURIComponent(translation);
          resultLines.splice(dialogue.index, 0, `# translation:${encodedTranslation}`);
        }
      }

      const updatedSource = resultLines.join('\n');

      return {
        code: 200,
        message: `成功翻译 ${translations.length} 条对白`,
        data: { inkSource: updatedSource, translatedCount: translations.length },
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
  }

  /**
   * 批量音频生成：为故事中所有 NPC 对白行自动生成 TTS 音频。
   * 根据每条对白的说话者，查找对应角色的 TTS 音色配置，
   * 调用 TTS 服务批量生成音频，并将音频 URL 写入 # audio: 标签。
   */
  @Post('stories/:id/generate-audio')
  async generateStoryAudio(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);

    try {
      const story = await this.prisma.inkScript.findUnique({
        where: { id },
        include: {
          trainingTopic: { select: { id: true, title: true } },
        },
      });
      if (!story) throw new Error('故事不存在');

      const source = story.inkSource;
      if (!source) throw new Error('故事没有 Ink 源文件');

      // 获取所有角色及其 TTS 配置
      const characters = await this.prisma.gameCharacter.findMany({
        where: { ttsVoice: { not: null } },
      });

      const activeTtsConfig = await this.aiModelService.getTtsConfig();
      const activeTtsProvider = Object.values(TtsProvider).includes(activeTtsConfig.provider as TtsProvider)
        ? activeTtsConfig.provider as TtsProvider
        : TtsProvider.minimax;

      // 构建角色名 -> TTS 配置的映射
      // 优先使用 AI Models 里当前激活的 TTS provider；Cartesia UUID 音色保留自动识别。
      const charTtsMap = new Map<string, { voice: string; model: string | null; params: any; provider: TtsProvider }>();
      for (const char of characters) {
        const c = char as any;
        const key = c.name.toLowerCase();
        const displayKey = c.displayName.toLowerCase();
        const isCartesiaVoice = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.ttsVoice || '');
        const provider = isCartesiaVoice ? TtsProvider.cartesia : activeTtsProvider;
        const model = c.ttsModel || (isCartesiaVoice ? 'sonic-english' : activeTtsConfig.model || 'speech-2.8-hd');
        const config = {
          voice: c.ttsVoice!,
          model,
          params: c.ttsParams || {},
          provider,
        };
        charTtsMap.set(key, config);
        if (displayKey !== key) {
          charTtsMap.set(displayKey, config);
        }
      }

      // 解析对白行
      const lines = source.split('\n');
      const dialogueLines: { index: number; speaker: string; text: string; hasAudio: boolean }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('//') || line.startsWith('#')) continue;

        const spoken = line.match(/^([^:：]{1,32})[:：]\s*(.+)$/);
        if (spoken && !line.startsWith('*') && !line.startsWith('->') && !line.startsWith('===')) {
          const speakerName = spoken[1].trim();
          const dialogueText = spoken[2].trim();

          if (['key', 'title', 'locationId', 'characterId'].includes(speakerName)) continue;

          // 检查是否已有 audio 标签
          let hasAudio = false;
          for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
            if (lines[j].trim().startsWith('# audio:')) {
              hasAudio = true;
              break;
            }
            if (lines[j].trim() && !lines[j].trim().startsWith('#')) break;
          }

          dialogueLines.push({ index: i, speaker: speakerName, text: dialogueText, hasAudio });
        }
      }

      // 过滤出需要生成音频的行
      const toGenerate = dialogueLines.filter(
        (d) => !d.hasAudio && charTtsMap.has(d.speaker.toLowerCase()),
      );

      if (toGenerate.length === 0) {
        const missingVoices = dialogueLines.filter(
          (d) => !d.hasAudio && !charTtsMap.has(d.speaker.toLowerCase()),
        );
        const noVoiceNames = [...new Set(missingVoices.map((d) => d.speaker))];
        return {
          code: 200,
          message: noVoiceNames.length > 0
            ? `以下角色未配置 TTS 音色，已跳过: ${noVoiceNames.join(', ')}`
            : '所有对白已有音频或无需生成',
          data: { inkSource: source, generatedCount: 0, skippedSpeakers: noVoiceNames },
        };
      }

      // 批量生成音频
      const resultLines = [...lines];
      let generatedCount = 0;
      const errors: string[] = [];

      // 从后往前处理，避免索引偏移
      for (let d = toGenerate.length - 1; d >= 0; d--) {
        const dialogue = toGenerate[d];
        const ttsConfig = charTtsMap.get(dialogue.speaker.toLowerCase());
        if (!ttsConfig) continue;

        try {
          const result = await this.ttsService.synthesizeAsset({
            text: dialogue.text,
            provider: ttsConfig.provider,
            model: ttsConfig.model || 'speech-2.8-hd',
            voiceId: ttsConfig.voice,
            params: ttsConfig.params || {},
            bizType: 'tts_story_line',
            bizId: [story.key || story.id, dialogue.index.toString(), dialogue.text].join(':'),
          });

          const audioUrl = result.url;
          if (audioUrl) {
            resultLines.splice(dialogue.index, 0, `# audio:${encodeURIComponent(audioUrl)}`);
            generatedCount++;
          }
        } catch (err: any) {
          errors.push(`${dialogue.speaker}: ${err.message}`);
          console.warn(`音频生成失败 [${dialogue.speaker}]: ${err.message}`);
        }
      }

      const updatedSource = resultLines.join('\n');

      return {
        code: 200,
        message: `成功生成 ${generatedCount} 条音频` + (errors.length > 0 ? `，${errors.length} 条失败` : ''),
        data: {
          inkSource: updatedSource,
          generatedCount,
          errorCount: errors.length,
          errors: errors.slice(0, 5),
        },
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
  }

  /**
   * AI 生成教学文档（Markdown）
   * 根据绑定话题的教学目标、句块、词汇，以及已生成的故事剧本，
   * 用 DeepSeek 生成一份面向学员的练习助手教学文档。
   */
  @Post('stories/:id/generate-teaching')
  async generateTeachingMarkdown(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);

    try {
      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置');

      // 获取故事及话题完整信息
      const story = await this.prisma.inkScript.findUnique({
        where: { id },
        include: {
          trainingTopic: {
            include: {
              activeChunks: { include: { chunk: { include: { examples: { take: 2, orderBy: { sortOrder: 'asc' } } } } } },
              topicVocabs: { include: { vocab: true } },
              topicPatterns: { include: { pattern: true } },
              scene: true,
            },
          },
        },
      });

      if (!story) throw new Error('故事不存在');
      const topic = story.trainingTopic;
      if (!topic) throw new Error('故事未绑定训练话题');

      // 构建上下文
      const parts: string[] = [];

      parts.push(`## 话题信息`);
      parts.push(`- 标题: ${topic.title}`);
      if (topic.description) parts.push(`- 描述: ${topic.description}`);
      if (topic.promptZh) parts.push(`- 训练目标: ${topic.promptZh}`);
      if (topic.promptEn) parts.push(`- 训练目标（英文）: ${topic.promptEn}`);
      if (topic.knowledgePoints) parts.push(`- 知识点: ${topic.knowledgePoints}`);
      parts.push(`- 难度: ${topic.difficulty}`);

      if (topic.activeChunks?.length > 0) {
        parts.push(`\n## 句块（实用表达）`);
        for (const tc of topic.activeChunks) {
          parts.push(`- **${tc.chunk.text}** — ${tc.chunk.meaning}`);
          if (tc.chunk.examples?.length) {
            for (const ex of tc.chunk.examples) {
              parts.push(`  - 例: ${ex.en} → ${ex.zh || ''}`);
            }
          }
        }
      }

      if (topic.topicVocabs?.length > 0) {
        parts.push(`\n## 核心词汇`);
        for (const tv of topic.topicVocabs) {
          parts.push(`- **${tv.vocab.word}** — ${tv.vocab.meaning || ''}`);
        }
      }

      if (topic.topicPatterns?.length > 0) {
        parts.push(`\n## 句式`);
        for (const tp of topic.topicPatterns) {
          parts.push(`- \`${tp.pattern.pattern}\` — ${tp.pattern.meaning || ''}`);
        }
      }

      // 从故事中提取对白示例（取前几条有 speaker 的行）
      const dialogueExcerpts: string[] = [];
      if (story.inkSource) {
        const lines = story.inkSource.split('\n');
        let inDialogue = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (/^===/.test(trimmed)) {
            dialogueExcerpts.push(`\n**${trimmed}**`);
            inDialogue = true;
          } else if (trimmed.match(/^[A-Za-z]+[^:：]{0,20}[:：]/) && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
            dialogueExcerpts.push(`> ${trimmed}`);
          }
        }
      }
      if (dialogueExcerpts.length > 0) {
        parts.push(`\n## 故事对话节选`);
        parts.push(dialogueExcerpts.join('\n'));
      }

      const contextBlock = parts.join('\n');

      const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
      const model = client.chat('deepseek-chat');

      const { text } = await generateText({
        model,
        prompt: `你是一名英语学习教学设计专家。请根据以下话题信息和故事对话，生成一份面向中国英语学习者的**练习助手教学文档**（Markdown 格式）。

这份文档会在用户正式开始练习前展示在练习页顶部，帮助学习者快速把握要点。

## 写作要求

1. 语言：**全部用中文写**（仅英文例句保留英文）
2. 语气：亲切、鼓励，像老师在课前做 briefing
3. 长度：300-600 字
4. 排版：规范的 Markdown，用 ## 分节，用 - 列表，英文用反引号或加粗

## 文档结构（请严格按此顺序）

### 📖 场景简介
用 2-3 句话概括这个对话的设定（谁、在哪、什么场景），以及学员要达成什么目标。

### 🎯 核心词汇
列出 3-6 个最重要的词汇，每个格式：\`word\` — 中文释义（简短的记忆提示）

### 💬 实用表达
列出 3-5 个最常用的句块/表达，每个格式：**表达** — 中文释义 — 使用场景说明

### 📝 对话示例
从上面提供的故事对话中选取 1-2 个最具代表性的片段，展示英文和中文翻译。

### ✨ 学习提示
2-3 条实用建议，帮助用户更好地完成练习。比如：关于发音的注意点、常见的文化差异、容易犯的语法错误等。

---

## 输入信息

${contextBlock}

## 输出

直接输出 Markdown 文档，不要任何额外说明。`,
        temperature: 0.5,
        maxOutputTokens: 3000,
      });

      // 清洗输出
      let md = text
        .replace(/```markdown\s*/gi, '')
        .replace(/```md\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      return {
        code: 200,
        message: 'success',
        data: { markdown: md },
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
  }

  // ════════════════════════════════════════════════════════════
  // CONTENT LIBRARY: Full Vocabulary Management
  // ════════════════════════════════════════════════════════════

  @Get('library/vocabularies')
  async listLibraryVocabularies(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('difficulty') difficulty?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);
    const where: any = {};
    if (search) {
      where.OR = [
        { word: { contains: search, mode: 'insensitive' } },
        { meaning: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (difficulty) where.difficulty = difficulty;

    const p = Math.max(1, parseInt(page || '1'));
    const ps = Math.min(100, Math.max(1, parseInt(pageSize || '20')));

    const [items, total] = await Promise.all([
      this.prisma.vocabulary.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.vocabulary.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) };
  }

  @Post('library/vocabularies')
  async createLibraryVocabulary(@Req() req: Request, @Body() dto: CreateFullVocabularyDto) {
    await this.requireAdmin(req);
    try {
      return await this.prisma.vocabulary.create({ data: { ...dto, examples: dto.examples as any } });
    } catch (err: any) {
      if (err.code === 'P2002') throw new ForbiddenException(`词汇 "${dto.word}" 已存在，请勿重复添加`);
      throw err;
    }
  }

  @Patch('library/vocabularies/:id')
  async updateLibraryVocabulary(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateFullVocabularyDto) {
    await this.requireAdmin(req);
    return this.prisma.vocabulary.update({ where: { id }, data: { ...dto, examples: dto.examples as any } });
  }

  @Delete('library/vocabularies/:id')
  async deleteLibraryVocabulary(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.vocabulary.delete({ where: { id } });
  }

  /** AI 增强词汇：DeepSeek 翻译 + 例句生成 + 音标校核 + 讲解 */
  @Post('library/vocabularies/ai-enrich')
  async aiEnrichVocabulary(@Req() req: Request, @Body() dto: {
    word: string;
    definitions: string[];
    examples: { en: string }[];
    phoneticUs?: string;
    phoneticUk?: string;
  }) {
    await this.requireAdmin(req);
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.adminContentAiService.enrichVocabulary(dto),
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
      const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
      const model = client.chat('deepseek-chat');

      const defLines = dto.definitions.map((d, i) => `${i + 1}. ${d}`).join('\n');
      const dictExLines = dto.examples.map((e, i) => `${i + 1}. ${e.en}`).join('\n');
      const phoneticUsInput = dto.phoneticUs || '(未提供)';
      const phoneticUkInput = dto.phoneticUk || '(未提供)';

      // 查询数据库中与本词相关的句块和例句，作为 AI 生成例句的参考
      let chunkRefs = '';
      try {
        const relatedChunks = await this.prisma.chunk.findMany({
          where: {
            text: { contains: dto.word, mode: 'insensitive' },
          },
          include: { examples: { take: 2, orderBy: { sortOrder: 'asc' } } },
          take: 5,
        });
        if (relatedChunks.length > 0) {
          chunkRefs = '\n## Reference chunks from our learning platform (use as inspiration for example style — do NOT copy verbatim):\n';
          for (const c of relatedChunks) {
            chunkRefs += `- Chunk: "${c.text}" (${c.meaning})`;
            if (c.examples.length > 0) {
              chunkRefs += ` | Examples: ${c.examples.map(e => `"${e.en}"`).join(', ')}`;
            }
            chunkRefs += '\n';
          }
        }
      } catch { /* 查询失败不影响主流程 */ }

      const { text } = await generateText({
        model,
        prompt: `You are a senior bilingual lexicographer building a Chinese-English learner's dictionary. Your readers are Chinese speakers learning English at intermediate level (B1-B2 CEFR). Your work must be accurate, natural, and pedagogically useful.

## Task
Given an English word and its dictionary definitions, produce Chinese translations, generate NEW original example sentences, clean IPA phonetics, and learning notes.

## Input
Word: "${dto.word}"

Current US phonetic: ${phoneticUsInput}
Current UK phonetic: ${phoneticUkInput}

English definitions (one per line, format "POS: definition"):
${defLines || '(none)'}

Dictionary example sentences (for reference only — do NOT translate these, generate NEW ones):
${dictExLines || '(none)'}
${chunkRefs}
## Output Schema
Return exactly a JSON object with these fields — no markdown, no code fences, just the raw JSON:

{
  "phoneticUs": "标准美式IPA音标，带 / / 斜杠。如无输入则根据单词知识生成。例：/ˌɪntrəˈduːs/",
  "phoneticUk": "标准英式IPA音标，带 / / 斜杠。如无输入则根据单词知识生成。例：/ˌɪntrəˈdjuːs/",
  "definitionTranslations": ["数组，长度与 definitions 相同。每条英文释义的自然中文翻译。保留括号说明但需地道。"],
  "generatedExamples": [
    { "en": "原创英文例句（不要照抄词典例句或参考句块，要全新创作）", "zh": "自然地道的中文翻译", "level": "basic/intermediate/advanced" }
  ],
  "meaning": "按词性分组的简洁中文关键词。同一词性只写一个POS前缀，所有该词性义项用；连接。不同词性用 / 分隔。例（纯名词）：n. 接收；接待；招待会；前台；反应；待遇。例（多词性）：n. 介绍；引见；入门 / v. 介绍；引入；推行。每词2-8字。务必覆盖所有义项不合并。反面例（POS重复）：n. 接收 / n. 接待 / n. 前台 ← 错误，应该 n. 接收；接待；前台",
  "description": "中文学习笔记，轻量 Markdown。结构按需：**核心含义：**/**用法提示：**/**易错点：**/**常见搭配：**（- 列表）/**同义词辨析：**。英文用反引号。语气亲切。80-200字。无释义时返回空字符串"
}

## Example Generation Rules
- Generate 3-5 original example sentences that demonstrate the word's MAIN senses.
- Each example must be a NEW sentence you create — do NOT copy or translate the dictionary examples.
- If reference chunks are provided above, use them as style/level inspiration, but write completely different sentences.
- Vary difficulty: at least one basic (A2), one intermediate (B1), one advanced (B2).
- Examples should reflect real-life scenarios relevant to Chinese learners.
- Each example must have a natural Chinese translation.

## Phonetic Standards (欧路词典风格 — 严格遵守)
Use CLEAN standard IPA inside /slashes/. Even if the input phonetics look like IPA, you MUST normalize them to the convention below:

### Character-level corrections (MANDATORY):
- /ɹ/ → /r/ (English R is written as r in 欧路/牛津/朗文 style)
- Syllabic consonants → vowel+consonant: /n̩/→/ən/, /l̩/→/əl/, /m̩/→/əm/
- Remove syllable boundary dots: /ˈsɛp.ʃən/ → /ˈsepʃən/
- /ɝ/ → /ɜːr/ (US), /ɜː/ (UK)
- /ɚ/ → /ər/ (US), /ə/ (UK)
- /oʊ/ → /əʊ/ (UK only; US keeps /oʊ/)
- /ɛ/ → /e/ (欧路/牛津 use /e/ for the DRESS vowel, not /ɛ/)

### Stress marks
- Primary stress: ˈ BEFORE the stressed syllable (e.g., /rɪˈsepʃən/)
- Secondary stress: ˌ BEFORE the syllable (e.g., /ˌɪntrəˈdʌkʃən/)

### US vs UK specific rules
- US: rhotic — /r/ always pronounced after vowels. Write /ər/, /ɜːr/, /ɪr/, etc.
- UK: non-rhotic — /r/ only before vowels. Write /ə/, /ɜː/, /ɪə/, etc.
- US: /ɑ/ for the LOT vowel. UK: /ɒ/ for the LOT vowel.
- US: /æ/ for the BATH vowel. UK: /ɑː/ for the BATH vowel in words like "dance", "glass".
- US: /u/ after t/d/n. UK: /juː/ after t/d/n (e.g., UK /ˈtjuːn/, US /ˈtun/).

### Examples
- Input /ɹɪˈsɛp.ʃn̩/ → US /rɪˈsepʃən/, UK /rɪˈsepʃən/
- Input /ˈɪntɹəˌdus/ → US /ˈɪntrəˌdus/, UK /ˈɪntrəˌdjuːs/
- Input /hɛˈloʊ/ → US /heˈloʊ/, UK /heˈləʊ/
- Input /ˈwɔːtɚ/ → US /ˈwɔːtər/, UK /ˈwɔːtə/

### CRITICAL: Always output phonetics even if input is missing or malformed.
If input is non-IPA (e.g., respelling "in-truh-DOOS"), generate correct IPA from your knowledge.

## Quality Principles
1. Translations must sound like natural Chinese, not machine-translated English.
2. The meaning field must cover EVERY sense — no merging.
3. Description should focus on what's HARD for Chinese learners.
4. Generated examples must be DIVERSE — different sentence structures, contexts, and registers.`,
        temperature: 0.4,
        maxOutputTokens: 2500,
      });

      let cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      const result = JSON.parse(cleaned);
      return {
        code: 200,
        message: 'success',
        data: {
          phoneticUs: result.phoneticUs ?? '',
          phoneticUk: result.phoneticUk ?? '',
          definitionTranslations: result.definitionTranslations ?? [],
          generatedExamples: (result.generatedExamples ?? []).map((e: any) => ({
            en: e.en || '',
            zh: e.zh || '',
            level: e.level || 'intermediate',
          })),
          meaning: result.meaning ?? '',
          description: result.description ?? '',
        },
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
  }

  /** AI 增强句块：DeepSeek 讲解生成 + 例句生成 */
  @Post('library/chunks/ai-enrich')
  async aiEnrichChunk(@Req() req: Request, @Body() dto: {
    text: string;
    meaning: string;
  }) {
    await this.requireAdmin(req);
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.adminContentAiService.enrichChunk(dto),
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
      const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
      const model = client.chat('deepseek-chat');

      const { text } = await generateText({
        model,
        prompt: `You are a senior English teacher creating learning materials for Chinese speakers at B1-B2 level.

## Task
Given an English chunk (a reusable expression unit), generate a Chinese explanation and example sentences.

## Input
Chunk: "${dto.text}"
Chinese meaning: ${dto.meaning || '(未提供)'}

## Output Schema
Return exactly a JSON object — no markdown, no code fences:

{
  "description": "中文学习笔记，轻量 Markdown。结构按需：**核心含义：** 一句话概括这个表达的核心意思。**用法提示：** 什么场景用、语体正式/非正式、常见搭配。**易错点：** 中国学习者容易犯的错误。**类似表达：** 意思相近的其他说法（可选）。英文单词用反引号。小节之间空行分隔。80-150字。语气亲切如老师。",
  "examples": [
    { "en": "原创英文例句，展示该句块在不同场景的自然用法", "zh": "自然地道的中文翻译", "level": "basic/intermediate/advanced" }
  ]
}

## Example Generation Rules
- Generate 3-4 original example sentences that demonstrate the chunk in different contexts.
- Vary difficulty: at least one basic (A2), one intermediate (B1).
- Show different sentence positions (beginning, middle, end) and variations (past tense, questions, etc.).
- Each example must have a natural Chinese translation.

## Quality Principles
1. Description must be practical — focus on what Chinese learners find confusing.
2. Examples should sound like real conversations, not textbook drills.
3. If the chunk has multiple meanings, cover the most common one.`,
        temperature: 0.4,
        maxOutputTokens: 1500,
      });

      let cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      const result = JSON.parse(cleaned);
      return {
        code: 200,
        message: 'success',
        data: {
          description: result.description ?? '',
          examples: (result.examples ?? []).map((e: any) => ({
            en: e.en || '',
            zh: e.zh || '',
            level: e.level || 'intermediate',
          })),
        },
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
  }

  /** AI 增强句式：DeepSeek 例句生成 + 讲解 */
  @Post('library/patterns/ai-enrich')
  async aiEnrichPattern(@Req() req: Request, @Body() dto: {
    pattern: string;
    meaning: string;
  }) {
    await this.requireAdmin(req);
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.adminContentAiService.enrichPattern(dto),
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
      if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
      const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
      const model = client.chat('deepseek-chat');

      const { text } = await generateText({
        model,
        prompt: `You are a senior English teacher creating learning materials for Chinese speakers at B1-B2 level.

## Task
Given an English sentence pattern with blanks (marked as __), generate example sentences and a Chinese explanation.

## Input
Pattern: "${dto.pattern}"
Chinese meaning: ${dto.meaning || '(未提供)'}

## Output Schema
Return exactly a JSON object — no markdown, no code fences:

{
  "examples": [
    { "en": "将每个 __ 替换成具体、有趣的单词。句子自然地道，像真人说的话。", "zh": "自然的中文翻译", "level": "basic/intermediate/advanced" }
  ],
  "description": "中文讲解，轻量 Markdown 排版。结构：\\n\\n**句式解析：** 这个句型表达什么逻辑关系。\\n\\n**使用场景：** 口语/书面、正式/随意。\\n\\n**易错点：** 中国学习者常见错误。\\n\\n**替换练习：** 2-3个可填入 __ 的单词/短语，用 - 列表。\\n\\n小节间空行分隔。英文单词用反引号。语气亲切。120-200字。"
}

## Rules for Examples
- Generate 3-4 examples of varying difficulty (basic → intermediate → advanced).
- Vary the vocabulary and context across examples — don't use the same words.
- Use vivid, specific vocabulary. Avoid generic words like "good", "bad", "nice".
- Each example should sound like something a native speaker would actually say.
- Examples should get progressively more complex (longer, more sophisticated vocabulary).

## Quality Standards
1. Examples MUST sound natural, not like textbook drills.
2. Description should teach something the learner didn't already know.
3. Include at least one common mistake Chinese learners make.`,
        temperature: 0.5,
        maxOutputTokens: 1500,
      });

      let cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      const result = JSON.parse(cleaned);
      return {
        code: 200,
        message: 'success',
        data: {
          examples: (result.examples ?? []).map((e: any) => ({
            en: e.en || '',
            zh: e.zh || '',
            level: e.level || 'intermediate',
          })),
          description: result.description ?? '',
        },
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
  }

  /** 触发单词富化：FreeDictionaryAPI pipeline → DB 缓存 → Vocabulary */
  @Post('library/vocabularies/:id/enrich')
  async enrichVocabulary(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.dictionaryService.enrichVocabulary(id);
  }

  // ════════════════════════════════════════════════════════════
  // CONTENT LIBRARY: Full Chunk Management
  // ════════════════════════════════════════════════════════════

  @Get('library/chunks')
  async listLibraryChunks(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('difficulty') difficulty?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);
    const where: any = {};
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { meaning: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (difficulty) where.difficulty = difficulty;

    const p = Math.max(1, parseInt(page || '1'));
    const ps = Math.min(100, Math.max(1, parseInt(pageSize || '20')));

    const [items, total] = await Promise.all([
      this.prisma.chunk.findMany({
        where,
        include: { examples: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.chunk.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) };
  }

  /** 获取所有已有的句块分类（去重） */
  @Get('library/chunks/categories')
  async listChunkCategories(@Req() req: Request) {
    await this.requireAdmin(req);
    const rows = await this.prisma.chunk.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map(r => r.category).filter(Boolean);
  }

  @Post('library/chunks')
  async createLibraryChunk(@Req() req: Request, @Body() dto: CreateFullChunkDto) {
    await this.requireAdmin(req);
    const { examples, ...data } = dto;
    const payload: any = { ...data, category: data.category || 'general' };
    if (examples?.length) {
      payload.examples = { create: examples.map((ex, i) => ({ ...ex, sortOrder: i })) };
    }
    try {
      return await this.prisma.chunk.create({
        data: payload,
        include: { examples: { orderBy: { sortOrder: 'asc' } } },
      });
    } catch (err: any) {
      if (err.code === 'P2002') throw new ForbiddenException(`句块 "${dto.text}" 已存在，请勿重复添加`);
      throw err;
    }
  }

  @Patch('library/chunks/:id')
  async updateLibraryChunk(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateFullChunkDto) {
    await this.requireAdmin(req);
    const { examples, ...data } = dto;
    const payload: any = { ...data };
    if (examples !== undefined) {
      await this.prisma.chunkExample.deleteMany({ where: { chunkId: id } });
      payload.examples = { create: examples.map((ex, i) => ({ ...ex, sortOrder: i })) };
    }
    return this.prisma.chunk.update({
      where: { id },
      data: payload,
      include: { examples: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  @Delete('library/chunks/:id')
  async deleteLibraryChunk(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    await this.prisma.chunkExample.deleteMany({ where: { chunkId: id } });
    return this.prisma.chunk.delete({ where: { id } });
  }

  // ════════════════════════════════════════════════════════════
  // CONTENT LIBRARY: Sentence Pattern Management
  // ════════════════════════════════════════════════════════════

  @Get('library/patterns')
  async listLibraryPatterns(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('difficulty') difficulty?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);
    const where: any = {};
    if (search) {
      where.OR = [
        { pattern: { contains: search, mode: 'insensitive' } },
        { meaning: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (difficulty) where.difficulty = difficulty;

    const p = Math.max(1, parseInt(page || '1'));
    const ps = Math.min(100, Math.max(1, parseInt(pageSize || '20')));

    const [items, total] = await Promise.all([
      this.prisma.sentencePattern.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.sentencePattern.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) };
  }

  /** 获取所有已有的句式分类（去重） */
  @Get('library/patterns/categories')
  async listPatternCategories(@Req() req: Request) {
    await this.requireAdmin(req);
    const rows = await this.prisma.sentencePattern.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map(r => r.category).filter(Boolean);
  }

  @Post('library/patterns')
  async createLibraryPattern(@Req() req: Request, @Body() dto: CreateSentencePatternDto) {
    await this.requireAdmin(req);
    try {
      return await this.prisma.sentencePattern.create({ data: dto });
    } catch (err: any) {
      if (err.code === 'P2002') throw new ForbiddenException(`句式 "${dto.pattern}" 已存在，请勿重复添加`);
      throw err;
    }
  }

  @Patch('library/patterns/:id')
  async updateLibraryPattern(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateSentencePatternDto) {
    await this.requireAdmin(req);
    return this.prisma.sentencePattern.update({ where: { id }, data: dto });
  }

  @Delete('library/patterns/:id')
  async deleteLibraryPattern(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.sentencePattern.delete({ where: { id } });
  }
}
