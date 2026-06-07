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

@Controller('admin/content')
export class ContentAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practiceAiService: EnglishPracticeAiService,
    private readonly dictionaryService: DictionaryService,
  ) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
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
        _count: { select: { trainingTopics: true } },
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
          include: { chunk: { select: { id: true, text: true } } },
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
            example: sp.example || null,
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
              example: sp.example || null,
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

  // ════════════════════════════════════════════════════════════
  // GAME CHARACTERS (角色管理)
  // ════════════════════════════════════════════════════════════

  @Get('characters')
  async listCharacters(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.gameCharacter.findMany({
      orderBy: { createdAt: 'asc' },
      include: { locationNpcs: { include: { location: { select: { id: true, displayName: true } } } } },
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
  // GAME MAPS + LOCATIONS (地图/地点管理)
  // ════════════════════════════════════════════════════════════

  @Get('maps')
  async listMaps(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.gameMap.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { locations: { orderBy: { sortOrder: 'asc' }, include: { npcs: { include: { character: true } } } } },
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
        npcs: { include: { character: true } },
        exits: { include: { to: { select: { id: true, displayName: true } } } },
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

  // ════════════════════════════════════════════════════════════
  // STORIES / INK SCRIPTS (故事管理)
  // ════════════════════════════════════════════════════════════

  @Get('stories')
  async listStories(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('scriptType') scriptType?: string,
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
      ]
    }
    if (scriptType && scriptType !== 'all') where.scriptType = scriptType
    if (categoryId) {
      where.trainingTopic = { scene: { categoryId } }
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
          trainingTopic: { select: { id: true, title: true } },
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
        where: {
          scenes: { some: { trainingTopics: { some: { inkScriptId: { not: null } } } } },
        },
      }),
    ])
    return {
      scriptTypes: scriptTypes.map((s) => s.scriptType),
      categories,
    }
  }

  @Get('stories/:id')
  async getStory(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    const story = await this.prisma.inkScript.findUnique({
      where: { id },
      include: {
        trainingTopic: { select: { id: true, title: true, teachingMarkdown: true } },
      },
    });
    if (!story || story.trainingTopic || !story.topicId) return story;
    const legacyTopic = await this.prisma.trainingTopic.findUnique({
      where: { id: story.topicId },
      select: { id: true, title: true, teachingMarkdown: true },
    });
    return { ...story, trainingTopic: legacyTopic };
  }

  @Post('stories')
  async createStory(@Req() req: Request, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.inkScript.create({
      data: dto,
      include: {
        trainingTopic: { select: { id: true, title: true, teachingMarkdown: true } },
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
        trainingTopic: { select: { id: true, title: true, teachingMarkdown: true } },
      },
    });
  }

  @Delete('stories/:id')
  async deleteStory(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.inkScript.delete({ where: { id } });
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
