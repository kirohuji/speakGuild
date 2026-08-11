import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req, ForbiddenException, BadRequestException, NotFoundException,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { parse } from 'csv-parse/sync';
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

/** 统计训练话题 pipeline 中的练习题数（与 warmup-pipeline-generate.service 口径一致） */
function countPipelineExercises(pipeline: any[] | undefined): number {
  if (!Array.isArray(pipeline)) return 0;
  return pipeline.reduce((sum, item: any) => {
    if (item?.type === 'sentence_decomposition') {
      return sum + (Array.isArray(item.levels) ? item.levels.length : 0);
    }
    if (item?.type === 'vocab_sentence_building') {
      return sum + (Array.isArray(item.patterns)
        ? item.patterns.reduce((inner: number, pattern: any) => inner + (Array.isArray(pattern?.items) ? pattern.items.length : 0), 0)
        : 0);
    }
    return sum + (Array.isArray(item?.items) ? item.items.length : 0);
  }, 0);
}
import { EnglishPracticeAiService } from '../practice-ai/english-practice-ai.service';
import { DialogueTurnJudgeDto } from '../practice-ai/dto/english-feedback.dto';
import { DictionaryService } from '../dictionary/dictionary.service';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { TtsService } from '../tts/tts.service';
import { TtsProvider } from '@prisma/client';
import { AdminContentAiService } from './admin-content-ai.service';
import { AiModelService } from '../ai-model/ai-model.service';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { AdminTasksService } from '../admin-tasks/admin-tasks.service';
import { ContentPrepareService } from '../admin-tasks/jobs/content-prepare.service';
import { TopicTeachingGenerateService } from '../admin-tasks/jobs/topic-teaching-generate.service';
import { ListeningPipelineTextDto } from './dto/listening-pipeline.dto';
import { ListeningTranscriptSegment } from '../tts/tts.service';
import { MaterialConstraintService, type MaterialKind, type GroupSceneInfo } from '../content-experiences/material-constraint.service';
import { SuggestTopicSupportsDto, SuggestTopicVocabsDto } from './dto/scene-admin.dto';

/** 语法功能词（代词/介词/冠词/连词/助动词/虚副词/限定词等），无实际学习价值，不进入推荐 */
const FUNCTION_WORDS = new Set([
  // 代词
  'i','me','my','mine','myself','you','your','yours','yourself','yourselves',
  'he','him','his','himself','she','her','hers','herself','it','its','itself',
  'we','us','our','ours','ourselves','they','them','their','theirs','themselves',
  'this','that','these','those','who','whom','whose','which','what','whoever','whatever',
  // 冠词
  'a','an','the',
  // 介词
  'at','on','in','to','for','with','by','of','from','about','into','onto','over','under',
  'up','down','out','off','through','during','before','after','between','among','against',
  'across','along','around','behind','below','beneath','beside','beyond','inside','outside',
  'near','past','since','till','until','upon','within','without','per','via','towards','toward',
  'throughout','despite',
  // 连词
  'and','or','but','so','because','if','unless','though','although','while','than','whether','nor','yet',
  // 疑问词
  'when','where','why','how',
  // be / 助动词 / 情态动词
  'be','am','is','are','was','were','been','being',
  'do','does','did','doing','done','have','has','had','having',
  'can','could','may','might','must','shall','should','will','would','ought',
  // 否定 / 应答
  'not','no','yes',
  // 虚副词（无实义的程度/时间副词）
  'very','too','also','just','only','even','still','already','yet','now','then','here','there',
  'again','always','never','often','sometimes','usually','really','quite','almost','soon','ago',
  'ever','once','twice',
  // 限定词
  'some','any','all','both','each','every','either','neither','other','another','few','little',
  'many','much','more','most','several','such','same','own','enough','none',
]);

/** 词性黑名单：词库标注为这些词性的一律视为功能词 */
const FUNCTION_POS_RE = /^(pronoun|prep(osition)?|conj(unction)?|article|det(erminer)?|aux(iliary)?|interjection)$/i;

function isFunctionWord(word: string, partOfSpeech?: string | null): boolean {
  return FUNCTION_WORDS.has(word.toLowerCase().trim())
    || (!!partOfSpeech && FUNCTION_POS_RE.test(partOfSpeech.trim()));
}

function validateListeningTranscript(value: unknown) {
  if (value == null) return;
  if (!Array.isArray(value)) throw new BadRequestException('听力字幕必须是数组');
  let previousStart = -1;
  for (const segment of value as any[]) {
    if (typeof segment?.text !== 'string' || !Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs)) {
      throw new BadRequestException('每句字幕必须包含 text、startMs 和 endMs');
    }
    if (segment.startMs < previousStart || segment.endMs <= segment.startMs) {
      throw new BadRequestException(`字幕“${segment.text}”时间戳乱序或区间无效`);
    }
    previousStart = segment.startMs;
    for (const word of segment.words ?? []) {
      if (typeof word?.token !== 'string' || !Number.isFinite(word.startMs) || !Number.isFinite(word.endMs)
        || word.startMs < segment.startMs || word.endMs > segment.endMs || word.endMs <= word.startMs) {
        throw new BadRequestException(`字幕“${segment.text}”存在越界或无效的词时间戳`);
      }
    }
  }
}

function normalizeOptionalForeignKey(value: string | null | undefined) {
  if (value == null) return value;
  const normalized = value.trim();
  return normalized || null;
}

/** 从 AI 输出中提取 JSON 对象（容忍代码围栏与前后缀文本） */
function extractJsonObject(text: string): any {
  const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

@Controller('admin/content')
export class ContentAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practiceAiService: EnglishPracticeAiService,
    private readonly dictionaryService: DictionaryService,
    private readonly ttsService: TtsService,
    private readonly adminContentAiService: AdminContentAiService,
    private readonly aiModelService: AiModelService,
    private readonly fileAssetsService: FileAssetsService,
    private readonly adminTasksService: AdminTasksService,
    private readonly contentPrepareService: ContentPrepareService,
    private readonly materialConstraints: MaterialConstraintService,
    private readonly topicTeachingGenerateService: TopicTeachingGenerateService,
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
  async listCategories(
    @Req() req: Request,
    @Query('packageType') packageType?: string,
    @Query('excludePackageType') excludePackageType?: string,
  ) {
    await this.requireAdmin(req);
    const sceneTypeWhere = packageType
      ? { packageType: packageType as any }
      : excludePackageType
        ? { packageType: { not: excludePackageType as any } }
        : undefined;
    return this.prisma.sceneCategory.findMany({
      where: sceneTypeWhere ? { scenes: { some: sceneTypeWhere } } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            scenes: sceneTypeWhere ? { where: sceneTypeWhere } : true,
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
    @Query('excludePackageType') excludePackageType?: string,
  ) {
    await this.requireAdmin(req);
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (packageType) where.packageType = packageType;
    else if (excludePackageType) where.packageType = { not: excludePackageType };
    const scenes = await this.prisma.scene.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { trainingTopics: true, storyEpisodes: true } },
      },
    });
    if (scenes.length === 0) return scenes;

    // 内容量统计：词汇/句块/句型按包内去重，练习题数按 pipeline 口径（与 warmup-pipeline-generate 一致）
    const topicRows = await this.prisma.trainingTopic.findMany({
      where: { sceneId: { in: scenes.map((s) => s.id) } },
      select: {
        sceneId: true,
        metadata: true,
        topicVocabs: { select: { vocabId: true } },
        activeChunks: { select: { chunkId: true } },
        topicPatterns: { select: { patternId: true } },
      },
    });

    const statsMap = new Map<string, { vocabs: Set<string>; chunks: Set<string>; patterns: Set<string>; exercises: number }>();
    for (const row of topicRows) {
      let entry = statsMap.get(row.sceneId);
      if (!entry) {
        entry = { vocabs: new Set(), chunks: new Set(), patterns: new Set(), exercises: 0 };
        statsMap.set(row.sceneId, entry);
      }
      for (const v of row.topicVocabs) entry.vocabs.add(v.vocabId);
      for (const c of row.activeChunks) entry.chunks.add(c.chunkId);
      for (const p of row.topicPatterns) entry.patterns.add(p.patternId);
      entry.exercises += countPipelineExercises((row.metadata as any)?.outputTraining?.pipeline);
    }

    return scenes.map((scene) => {
      const entry = statsMap.get(scene.id);
      return {
        ...scene,
        contentStats: entry
          ? {
              vocabCount: entry.vocabs.size,
              chunkCount: entry.chunks.size,
              patternCount: entry.patterns.size,
              exerciseCount: entry.exercises,
            }
          : { vocabCount: 0, chunkCount: 0, patternCount: 0, exerciseCount: 0 },
      };
    });
  }

  @Get('scenes/:id')
  async getScene(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.scene.findUnique({
      where: { id },
      include: {
        category: true,
        group: { select: { id: true, name: true } },
        // 话题列表由 GET /training-topics?sceneId= 分页提供，这里不再全量展开（避免每次进详情页拉取全部话题+材料）
        _count: { select: { trainingTopics: true, storyEpisodes: true } },
      },
    });
  }

  /**
   * 学习包材料引用上下文：当前包在组内的顺序、前序包/后序包及其认领材料。
   * 前端用于材料池展示（已排除/可复习）、词汇推荐与冲突提示。
   */
  @Get('scenes/:id/material-context')
  async getSceneMaterialContext(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    const context = await this.materialConstraints.getGroupContext(id);
    const allClaims = [...context.earlierScenes, ...context.laterScenes].flatMap((scene) => scene.claims);
    const texts = await this.materialConstraints.resolveMaterialTexts(
      allClaims.map((claim) => ({ kind: claim.kind, materialId: claim.materialId })),
    );
    const decorate = (scenes: GroupSceneInfo[]) =>
      scenes.map((scene) => ({
        sceneId: scene.sceneId,
        title: scene.title,
        sortOrder: scene.sortOrder,
        claims: scene.claims.map((claim) => ({
          kind: claim.kind,
          materialId: claim.materialId,
          role: claim.role,
          topicId: claim.topicId,
          text: texts.get(`${claim.kind}:${claim.materialId}`) ?? '',
        })),
      }));
    return {
      groupId: context.groupId,
      groupName: context.groupName,
      sortOrder: context.sortOrder,
      earlierScenes: decorate(context.earlierScenes),
      laterScenes: decorate(context.laterScenes),
    };
  }

  @Post('scenes')
  async createScene(@Req() req: Request, @Body() dto: CreateSceneDto) {
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls({
        ...dto,
        contentMode: dto.contentMode ?? (dto.packageType === 'story' ? 'story' : 'practice'),
    });
    return this.prisma.$transaction(async (tx) => {
      const scene = await tx.scene.create({ data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'scene_asset', scene.id, scene,
      );
      return scene;
    });
  }

  @Patch('scenes/:id')
  async updateScene(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateSceneDto) {
    const session = await this.requireAdmin(req);
    const nextContentMode = dto.contentMode ?? (dto.packageType === 'story' ? 'story' : undefined);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls({
      ...dto,
      ...(nextContentMode ? { contentMode: nextContentMode } : {}),
    });
    return this.prisma.$transaction(async (tx) => {
      const scene = await tx.scene.update({
        where: { id },
        data,
      });
      if (scene.contentMode !== 'novel') {
        await Promise.all([
          tx.sceneVocabulary.deleteMany({ where: { sceneId: id } }),
          tx.sceneChunk.deleteMany({ where: { sceneId: id } }),
          tx.sceneSentencePattern.deleteMany({ where: { sceneId: id } }),
          // 包级材料认领一并释放（话题级引用保留）
          tx.sceneMaterialReference.deleteMany({ where: { sceneId: id, topicId: null } }),
        ]);
      }
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'scene_asset', id, scene,
      );
      return scene;
    });
  }

  @Delete('scenes/:id')
  async deleteScene(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    const scene = await this.prisma.scene.findUnique({
      where: { id },
      select: { id: true, packageType: true },
    });
    if (!scene) throw new NotFoundException('内容包不存在');

    // A story package owns its episodes and the user data produced from them.
    // Delete that graph atomically, while only detaching shared map assets.
    if (scene.packageType === 'story') {
      const episodes = await this.prisma.storyEpisode.findMany({
        where: { sceneId: id },
        select: { id: true },
      });
      const episodeIds = episodes.map((episode) => episode.id);
      const works = episodeIds.length > 0
        ? await this.prisma.scriptWork.findMany({
          where: { episodeId: { in: episodeIds } },
          select: { id: true },
        })
        : [];
      const workIds = works.map((work) => work.id);
      const relatedTaskWhere = {
        OR: [
          { targetType: 'scene', targetId: id },
          ...(workIds.length > 0
            ? [{ targetType: 'script_work', targetId: { in: workIds } }]
            : []),
        ],
      };

      // Remove waiting jobs and persist cancellation before deleting their
      // content. Active workers use this status as their final safety guard.
      const activeTasks = await this.prisma.adminTask.findMany({
        where: {
          ...relatedTaskWhere,
          status: { in: ['queued', 'running'] },
        },
        select: { id: true },
      });
      for (const task of activeTasks) {
        await this.adminTasksService.cancel(task.id);
      }

      return this.prisma.$transaction(async (tx) => {
        await this.fileAssetsService.syncPersistentAssetReferences(
          tx, session.user.id, 'scene_asset', id, null,
        );
        if (episodeIds.length > 0) {
          await tx.inkScript.deleteMany({ where: { episodeId: { in: episodeIds } } });
          await tx.storyTurn.deleteMany({ where: { episodeId: { in: episodeIds } } });
          await tx.storyRecord.deleteMany({ where: { episodeId: { in: episodeIds } } });
          await tx.storyEpisodeVocabulary.deleteMany({ where: { episodeId: { in: episodeIds } } });
          await tx.storyEpisodeChunk.deleteMany({ where: { episodeId: { in: episodeIds } } });
          await tx.storyEpisodeSentencePattern.deleteMany({ where: { episodeId: { in: episodeIds } } });
          // ScriptPracticeRecord and ScriptWork cascade from StoryEpisode.
          await tx.storyEpisode.deleteMany({ where: { id: { in: episodeIds } } });
        }

        // Keep task logs as an audit trail and keep canceled rows available to
        // any in-flight worker, but detach them from content being removed.
        await tx.adminTask.updateMany({
          where: relatedTaskWhere,
          data: { targetId: null },
        });
        await tx.scenePrerequisite.deleteMany({
          where: { OR: [{ sceneId: id }, { prerequisiteId: id }] },
        });
        await tx.userSceneProgress.deleteMany({ where: { sceneId: id } });
        await tx.gameLocation.updateMany({ where: { sceneId: id }, data: { sceneId: null } });
        return tx.scene.delete({ where: { id } });
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'scene_asset', id, null,
      );
      return tx.scene.delete({ where: { id } });
    });
  }

  // ════════════════════════════════════════════════════════════
  // VOCABULARY
  // ════════════════════════════════════════════════════════════

  @Get('vocabularies')
  async listVocabularies(@Req() req: Request, @Query('search') search?: string) {
    await this.requireAdmin(req);
    // 轻量字段 + 搜索 + 上限：词汇库上万条，全量返回（含 examples/collocations 等大字段）
    // 会产生 40MB+ 响应导致话题编辑器卡顿。选择器改为服务端搜索，按需拉取。
    const keyword = search?.trim();
    return this.prisma.vocabulary.findMany({
      where: keyword
        ? {
            OR: [
              { word: { contains: keyword, mode: 'insensitive' } },
              { meaning: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { sortOrder: 'asc' },
      take: 100,
      select: {
        id: true,
        word: true,
        meaning: true,
        description: true,
        difficulty: true,
        sortOrder: true,
      },
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
  async listTrainingTopics(
    @Req() req: Request,
    @Query('sceneId') sceneId?: string,
    @Query('detail') detail?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);
    const where: any = {};
    if (sceneId) where.sceneId = sceneId;
    const hasPagination = page !== undefined || pageSize !== undefined;
    const p = Math.max(1, parseInt(page || '1'));
    const ps = Math.min(100, Math.max(1, parseInt(pageSize || '20')));
    const pagination = hasPagination ? { skip: (p - 1) * ps, take: ps } : undefined;
    if (detail === 'full') {
      const query = {
        where,
        orderBy: { sortOrder: 'asc' as const },
        include: {
          scene: { select: { id: true, title: true } },
          topicPatterns: { include: { pattern: true }, orderBy: { sortOrder: 'asc' as const } },
          topicVocabs: { include: { vocab: true }, orderBy: { sortOrder: 'asc' as const } },
          activeChunks: {
            include: { chunk: { include: { examples: { orderBy: { sortOrder: 'asc' as const } } } } },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
        ...(pagination ?? {}),
      };
      if (!hasPagination) return this.prisma.trainingTopic.findMany(query);
      const [items, total] = await Promise.all([
        this.prisma.trainingTopic.findMany(query),
        this.prisma.trainingTopic.count({ where }),
      ]);
      return { items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) };
    }

    const query = {
      where,
      orderBy: { sortOrder: 'asc' as const },
      select: {
        id: true,
        sceneId: true,
        type: true,
        title: true,
        promptEn: true,
        promptZh: true,
        suggestedDurationSec: true,
        difficulty: true,
        inkScriptId: true,
        sortOrder: true,
        scene: { select: { id: true, title: true } },
        topicPatterns: {
          select: {
            id: true,
            sortOrder: true,
            pattern: { select: { id: true, pattern: true, meaning: true } },
          },
          orderBy: { sortOrder: 'asc' as const },
        },
        topicVocabs: {
          select: {
            id: true,
            sortOrder: true,
            vocab: { select: { id: true, word: true, meaning: true, sortOrder: true } },
          },
          orderBy: { sortOrder: 'asc' as const },
        },
        activeChunks: {
          select: {
            id: true,
            sortOrder: true,
            chunk: { select: { id: true, text: true, meaning: true } },
          },
          orderBy: { sortOrder: 'asc' as const },
        },
      },
      ...(pagination ?? {}),
    };
    if (!hasPagination) return this.prisma.trainingTopic.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.trainingTopic.findMany(query),
      this.prisma.trainingTopic.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) };
  }

  @Get('training-topics/teaching-documents')
  async listTopicTeachingDocuments(@Req() req: Request, @Query('sceneId') sceneId?: string) {
    await this.requireAdmin(req);
    if (!sceneId) throw new BadRequestException('sceneId 不能为空');
    return this.prisma.trainingTopic.findMany({
      where: { sceneId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        difficulty: true,
        sortOrder: true,
        teachingMarkdown: true,
        createdAt: true,
      },
    });
  }

  @Get('training-topics/:id')
  async getTrainingTopic(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.prisma.trainingTopic.findUnique({
      where: { id },
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

  /**
   * 根据已绑句型/句块推荐搭配词汇（M3）
   * 规则预筛（引用表约束 + 难度 + 搭配启发式）→ AI 排序并给出推荐理由。
   */
  @Post('training-topics/:id/suggest-vocabs')
  async suggestTopicVocabs(@Req() req: Request, @Param('id') id: string, @Body() dto: SuggestTopicVocabsDto) {
    await this.requireAdmin(req);

    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id },
      include: {
        scene: { select: { id: true, requiredOutputLevel: true } },
        topicPatterns: { include: { pattern: true } },
        activeChunks: { include: { chunk: { include: { examples: { select: { en: true } } } } } },
        topicVocabs: { include: { vocab: true } },
      },
    });
    if (!topic) throw new NotFoundException('学习话题不存在');

    const patternIds = dto.patternIds ?? topic.topicPatterns.map((tp) => tp.pattern.id);
    const chunkIds = dto.chunkIds ?? topic.activeChunks.map((ac) => ac.chunk.id);
    const difficulty = dto.difficulty ?? topic.difficulty ?? topic.scene.requiredOutputLevel;
    const count = Math.min(Math.max(dto.count ?? 12, 1), 20);
    const extensionCount = Math.min(Math.max(dto.extensionCount ?? 6, 0), 20);

    const [patterns, chunks] = await Promise.all([
      patternIds.length ? this.prisma.sentencePattern.findMany({ where: { id: { in: patternIds } } }) : [],
      chunkIds.length
        ? this.prisma.chunk.findMany({ where: { id: { in: chunkIds } }, include: { examples: { select: { en: true } } } })
        : [],
    ]);

    // ── 引用表约束 ──
    // excluded：后序包 learn 认领 + 本包其他话题已认领（learn）
    // earlier：前序包认领（learn + review），可作复习候选（带标记）
    const context = await this.materialConstraints.getGroupContext(topic.sceneId);
    const laterClaimed = new Set<string>();
    const earlierClaimed = new Set<string>();
    for (const scene of context.laterScenes) {
      for (const claim of scene.claims) {
        if (claim.role === 'learn') laterClaimed.add(`${claim.kind}:${claim.materialId}`);
      }
    }
    for (const scene of context.earlierScenes) {
      for (const claim of scene.claims) earlierClaimed.add(`${claim.kind}:${claim.materialId}`);
    }
    const packRefs = await this.prisma.sceneMaterialReference.findMany({
      where: { sceneId: topic.sceneId, topicId: { not: null }, role: 'learn' },
      select: { materialType: true, materialId: true },
    });
    for (const ref of packRefs) laterClaimed.add(`${ref.materialType}:${ref.materialId}`);
    const boundIds = new Set(topic.topicVocabs.map((tv) => tv.vocab.id));

    // ── 难度过滤：目标 L(n)，候选限 L(n-1)..L(n+1)（clamp 到 L1-L5） ──
    const targetLevel = /^L([1-9])$/i.test(difficulty) ? Number(difficulty.slice(1)) : null;
    const levelOf = (value?: string | null) => (/^L([1-9])$/i.test(value ?? '') ? Number((value ?? '').slice(1)) : null);

    // ── 搭配启发式打分 ──
    const posHints = new Set<string>();
    for (const p of patterns) {
      const text = `${p.pattern} ${p.meaning ?? ''}`.toLowerCase();
      if (/\bverb\b|\bdo\b|\bdoes\b|\bcan\b|\bwill\b|\bshould\b|\bwould\b|\bplease\b|\blet\b|动词/.test(text)) posHints.add('verb');
      if (/\badj\b|\badjective\b|形容词/.test(text)) posHints.add('adj');
      if (/\bnoun\b|名词/.test(text)) posHints.add('noun');
    }
    const chunkExamples = chunks.flatMap((c) => c.examples.map((e) => e.en.toLowerCase()));
    const patternTexts = patterns.map((p) => `${p.pattern} ${p.meaning ?? ''}`.toLowerCase());
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const library = await this.prisma.vocabulary.findMany({
      orderBy: [{ outputPriority: 'desc' }, { sortOrder: 'asc' }],
    });
    const scored: Array<{ vocabulary: (typeof library)[number]; score: number }> = [];
    for (const vocabulary of library) {
      if (boundIds.has(vocabulary.id)) continue;
      if (isFunctionWord(vocabulary.word, vocabulary.partOfSpeech)) continue;
      if (laterClaimed.has(`vocab:${vocabulary.id}`)) continue;
      if (targetLevel != null) {
        const level = levelOf(vocabulary.difficulty);
        if (level != null && Math.abs(level - targetLevel) > 1) continue;
      }
      let score = 0;
      const word = vocabulary.word.toLowerCase();
      const pos = (vocabulary.partOfSpeech ?? '').toLowerCase();
      if (posHints.has(pos)) score += 2;
      const wordPattern = new RegExp(`(^|[^a-z])${escapeRegExp(word)}([^a-z]|$)`);
      if (chunkExamples.some((example) => wordPattern.test(example))) score += 3;
      if (patternTexts.some((text) => text.includes(word))) score += 2;
      const level = levelOf(vocabulary.difficulty);
      if (targetLevel != null && level != null) score += Math.max(0, 3 - Math.abs(level - targetLevel));
      if (vocabulary.outputPriority === 'high') score += 1;
      scored.push({ vocabulary, score });
    }
    scored.sort((a, b) => b.score - a.score);
    // 新词与前序复习词分池，避免后期话题中高分复习词挤占整个候选窗口。
    const freshPool = scored.filter((entry) => !earlierClaimed.has(`vocab:${entry.vocabulary.id}`));
    const reviewPool = scored.filter((entry) => earlierClaimed.has(`vocab:${entry.vocabulary.id}`));
    const candidates = [
      ...freshPool.slice(0, 80),
      ...reviewPool.slice(0, 20),
    ];
    const minimumFreshCore = Math.min(10, count, freshPool.length);

    // ── AI 排序与推荐理由（失败时回退到规则排序） ──
    let ranked = [
      ...freshPool.slice(0, count),
      ...reviewPool.slice(0, Math.max(0, count - freshPool.length)),
    ].slice(0, count);
    let extended = [...freshPool, ...reviewPool]
      .filter((entry) => !ranked.some((core) => core.vocabulary.id === entry.vocabulary.id) && entry.score > 0)
      .slice(0, extensionCount);
    const reasons = new Map<string, string>();
    try {
      const llmConfig = await this.aiModelService.getLlmConfig();
      if (llmConfig.apiKey && candidates.length) {
        const client = createOpenAI({ apiKey: llmConfig.apiKey, baseURL: llmConfig.baseUrl });
        const model = client.chat(llmConfig.model);
        const candidateLines = candidates
          .map(({ vocabulary }) => `- ${vocabulary.id} | ${vocabulary.word} | ${vocabulary.meaning} | ${vocabulary.partOfSpeech ?? ''} | ${vocabulary.difficulty} | ${earlierClaimed.has(`vocab:${vocabulary.id}`) ? 'review（前序已学）' : 'fresh（未学）'}`)
          .join('\n');
        const patternLines = patterns.map((p) => `- ${p.pattern}${p.meaning ? ` — ${p.meaning}` : ''}`).join('\n') || '- (无)';
        const chunkLines = chunks.map((c) => `- ${c.text}${c.meaning ? ` — ${c.meaning}` : ''}`).join('\n') || '- (无)';
        const teaching = (dto.teachingMarkdown ?? '').slice(0, 1500);
        const { text } = await generateText({
          model,
          prompt: `你是英语教学设计助手，为话题挑选最合适的练习词汇。\n\n话题目标难度：${difficulty}\n\n已绑定句型：\n${patternLines}\n\n已绑定句块：\n${chunkLines}\n\n教学文档（参考）：\n${teaching || '(无)'}\n\n候选词（id | 单词 | 中文释义 | 词性 | 难度 | 学习状态）：\n${candidateLines}\n\n请从中选出最适合本话题练习的 ${count} 个核心词和 ${extensionCount} 个扩展词（扩展词不足可少于 ${extensionCount} 个，但不能与核心词重复）：\n1. 核心词中至少选择 ${minimumFreshCore} 个标记为 fresh（未学）的词；review 只能用于必要复习和补位，不能挤占新词配额。\n2. 语义/搭配与已绑句型、句块自然契合。\n3. 难度符合目标难度；核心词优先选搭配度最高的，扩展词可略高一级、作为进阶拓展。\n4. 与话题场景相关优先。\n5. 只选有实际学习价值的实义词（名词/动词/形容词/副词/短语），绝不选择代词、介词、冠词、助动词、连词等语法功能词（如 you、at、I、what、on）。\n\n只输出 JSON：{"core":[{"vocabularyId":"候选词id","reason":"一句话中文理由（说明与哪个句型/句块搭配，为什么适合）"}],"extension":[{"vocabularyId":"候选词id","reason":"一句话中文理由"}]}，不要输出其他内容。`,
          temperature: 0.4,
          maxOutputTokens: 2400,
          abortSignal: AbortSignal.timeout(230_000),
        });
        const parsed = extractJsonObject(text);
        const byId = new Map(candidates.map((item) => [item.vocabulary.id, item]));
        const resolveGroup = (items: any): typeof ranked => {
          if (!Array.isArray(items)) return [];
          return items
            .map((item: any) => byId.get(String(item?.vocabularyId)))
            .filter((item): item is (typeof candidates)[number] => Boolean(item));
        };
        const coreSelected = resolveGroup(parsed?.core).slice(0, count);
        const extSelected = resolveGroup(parsed?.extension).slice(0, extensionCount);
        if (coreSelected.length) {
          ranked = coreSelected;
          extended = extSelected;
          for (const item of [...(parsed?.core ?? []), ...(parsed?.extension ?? [])]) {
            reasons.set(String(item?.vocabularyId), String(item?.reason ?? ''));
          }
        }
      }
    } catch (error: any) {
      console.warn(`[suggest-vocabs] AI 排序失败，回退规则排序: ${error.message}`);
    }

    // 不信任模型完全遵守配额：回收结果时再次强制补足 fresh，并优先替换 review。
    ranked = ranked.filter((entry, index, items) =>
      items.findIndex((candidate) => candidate.vocabulary.id === entry.vocabulary.id) === index,
    ).slice(0, count);
    const coreIds = new Set(ranked.map((entry) => entry.vocabulary.id));
    let freshCoreCount = ranked.filter((entry) => !earlierClaimed.has(`vocab:${entry.vocabulary.id}`)).length;
    for (const fresh of freshPool) {
      if (freshCoreCount >= minimumFreshCore) break;
      if (coreIds.has(fresh.vocabulary.id)) continue;
      if (ranked.length < count) {
        ranked.push(fresh);
      } else {
        let reviewIndex = -1;
        for (let index = ranked.length - 1; index >= 0; index -= 1) {
          if (earlierClaimed.has(`vocab:${ranked[index].vocabulary.id}`)) {
            reviewIndex = index;
            break;
          }
        }
        if (reviewIndex < 0) break;
        coreIds.delete(ranked[reviewIndex].vocabulary.id);
        ranked[reviewIndex] = fresh;
      }
      coreIds.add(fresh.vocabulary.id);
      freshCoreCount += 1;
    }
    for (const entry of [...freshPool, ...reviewPool]) {
      if (ranked.length >= count) break;
      if (coreIds.has(entry.vocabulary.id)) continue;
      ranked.push(entry);
      coreIds.add(entry.vocabulary.id);
    }
    const extensionIds = new Set<string>();
    extended = extended.filter((entry) => {
      const id = entry.vocabulary.id;
      if (coreIds.has(id) || extensionIds.has(id)) return false;
      extensionIds.add(id);
      return true;
    }).slice(0, extensionCount);

    const toItem = (entry: { vocabulary: (typeof library)[number]; score: number }, group: 'core' | 'extension') => ({
      vocabularyId: entry.vocabulary.id,
      word: entry.vocabulary.word,
      meaning: entry.vocabulary.meaning,
      partOfSpeech: entry.vocabulary.partOfSpeech ?? '',
      difficulty: entry.vocabulary.difficulty,
      status: earlierClaimed.has(`vocab:${entry.vocabulary.id}`) ? 'earlier' : 'available',
      reason: reasons.get(entry.vocabulary.id) ?? (entry.score > 0 ? '与已绑句型/句块搭配度高' : '难度匹配'),
      score: entry.score,
      group,
    });

    return {
      code: 200,
      message: 'success',
      data: {
        items: [
          ...ranked.map((entry) => toItem(entry, 'core')),
          ...extended.map((entry) => toItem(entry, 'extension')),
        ],
      },
    };
  }

  /**
   * 根据教学文档、当前已选材料和未选材料库，判断是否需要补充句型或 Chunk。
   * 仅返回尚未选择且不与后序/同包其他话题认领冲突的候选。
   */
  @Post('training-topics/:id/suggest-supports')
  async suggestTopicSupports(@Req() req: Request, @Param('id') id: string, @Body() dto: SuggestTopicSupportsDto) {
    await this.requireAdmin(req);

    const topic = await this.prisma.trainingTopic.findUnique({
      where: { id },
      include: {
        scene: { select: { id: true, title: true, requiredOutputLevel: true } },
        topicPatterns: { include: { pattern: true } },
        activeChunks: { include: { chunk: { include: { examples: { select: { en: true } } } } } },
        topicVocabs: { include: { vocab: true } },
      },
    });
    if (!topic) throw new NotFoundException('学习话题不存在');

    const patternIds = dto.patternIds ?? topic.topicPatterns.map((item) => item.pattern.id);
    const chunkIds = dto.chunkIds ?? topic.activeChunks.map((item) => item.chunk.id);
    const vocabIds = dto.vocabIds ?? topic.topicVocabs.map((item) => item.vocab.id);
    const difficulty = dto.difficulty ?? topic.difficulty ?? topic.scene.requiredOutputLevel;
    const count = Math.min(Math.max(dto.count ?? 6, 1), 12);
    const selectedIds = new Set(dto.kind === 'pattern' ? patternIds : chunkIds);

    const [selectedPatterns, selectedChunks, selectedVocabs] = await Promise.all([
      patternIds.length
        ? this.prisma.sentencePattern.findMany({ where: { id: { in: patternIds } } })
        : [],
      chunkIds.length
        ? this.prisma.chunk.findMany({
            where: { id: { in: chunkIds } },
            include: { examples: { select: { en: true }, take: 3, orderBy: { sortOrder: 'asc' } } },
          })
        : [],
      vocabIds.length
        ? this.prisma.vocabulary.findMany({ where: { id: { in: vocabIds } } })
        : [],
    ]);

    const context = await this.materialConstraints.getGroupContext(topic.sceneId);
    const blocked = new Set<string>();
    const earlier = new Set<string>();
    for (const scene of context.laterScenes) {
      for (const claim of scene.claims) {
        if (claim.role === 'learn') blocked.add(`${claim.kind}:${claim.materialId}`);
      }
    }
    for (const scene of context.earlierScenes) {
      for (const claim of scene.claims) earlier.add(`${claim.kind}:${claim.materialId}`);
    }
    const currentPackClaims = await this.prisma.sceneMaterialReference.findMany({
      where: {
        sceneId: topic.sceneId,
        role: 'learn',
        OR: [{ topicId: null }, { topicId: { not: id } }],
      },
      select: { materialType: true, materialId: true },
    });
    for (const claim of currentPackClaims) blocked.add(`${claim.materialType}:${claim.materialId}`);

    type SupportCandidate = {
      id: string;
      text: string;
      meaning: string;
      description: string;
      category: string;
      difficulty: string;
      examples: string;
      score: number;
    };
    const library: SupportCandidate[] = dto.kind === 'pattern'
      ? (await this.prisma.sentencePattern.findMany({ orderBy: { updatedAt: 'desc' } })).map((item) => ({
          id: item.id,
          text: item.pattern,
          meaning: item.meaning ?? '',
          description: item.description ?? '',
          category: item.category ?? '',
          difficulty: item.difficulty,
          examples: JSON.stringify(item.examples ?? []),
          score: 0,
        }))
      : (await this.prisma.chunk.findMany({
          include: { examples: { select: { en: true }, take: 3, orderBy: { sortOrder: 'asc' } } },
          orderBy: { updatedAt: 'desc' },
        })).map((item) => ({
          id: item.id,
          text: item.text,
          meaning: item.meaning,
          description: item.description ?? '',
          category: item.category ?? '',
          difficulty: item.difficulty,
          examples: item.examples.map((example) => example.en).join(' | '),
          score: 0,
        }));

    const contextText = [
      topic.scene.title,
      topic.title,
      topic.description ?? '',
      topic.promptEn,
      topic.promptZh,
      (dto.teachingMarkdown ?? topic.teachingMarkdown ?? '').slice(0, 6000),
      ...selectedPatterns.flatMap((item) => [item.pattern, item.meaning ?? '', item.description ?? '', JSON.stringify(item.examples ?? [])]),
      ...selectedChunks.flatMap((item) => [item.text, item.meaning, item.description ?? '', ...item.examples.map((example) => example.en)]),
      ...selectedVocabs.flatMap((item) => [item.word, item.meaning, item.definitionEn ?? '', item.description ?? '']),
    ].join('\n').toLowerCase();
    const tokensOf = (value: string) => new Set(value.toLowerCase().match(/[a-z][a-z'-]{2,}|[\u4e00-\u9fff]{2,}/gu) ?? []);
    const contextTokens = tokensOf(contextText);
    const levelOf = (value?: string | null) => (/^L([1-9])$/i.test(value ?? '') ? Number((value ?? '').slice(1)) : null);
    const targetLevel = levelOf(difficulty);
    const kindKey = dto.kind;

    const candidates = library
      .filter((item) => !selectedIds.has(item.id) && !blocked.has(`${kindKey}:${item.id}`))
      .filter((item) => {
        const level = levelOf(item.difficulty);
        return targetLevel == null || level == null || Math.abs(level - targetLevel) <= 1;
      })
      .map((item) => {
        const candidateText = `${item.text} ${item.meaning} ${item.description} ${item.category} ${item.examples}`.toLowerCase();
        const overlap = [...tokensOf(candidateText)].filter((token) => contextTokens.has(token)).length;
        const level = levelOf(item.difficulty);
        const exactMention = contextText.includes(item.text.toLowerCase()) ? 5 : 0;
        const categoryMatch = item.category && contextText.includes(item.category.toLowerCase()) ? 2 : 0;
        const difficultyScore = targetLevel != null && level != null ? Math.max(0, 3 - Math.abs(level - targetLevel)) : 1;
        return { ...item, score: exactMention + categoryMatch + difficultyScore + Math.min(overlap, 6) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);

    let ranked = candidates.filter((item) => item.score >= 3).slice(0, count);
    let summary = ranked.length
      ? `规则检查发现 ${ranked.length} 个可补充的${dto.kind === 'pattern' ? '句型' : 'Chunk'}`
      : `当前材料已基本覆盖教学目标，暂不需要补充${dto.kind === 'pattern' ? '句型' : 'Chunk'}`;
    const reasons = new Map<string, string>();
    const newSuggestions: Array<{
      materialId: string;
      text: string;
      meaning: string;
      description: string;
      category: string;
      difficulty: string;
      examples: Array<{ en: string; zh: string }>;
      reason: string;
    }> = [];

    try {
      const llmConfig = await this.aiModelService.getLlmConfig();
      if (llmConfig.apiKey) {
        const client = createOpenAI({ apiKey: llmConfig.apiKey, baseURL: llmConfig.baseUrl });
        const model = client.chat(llmConfig.model);
        const selectedPatternLines = selectedPatterns.map((item) => `- ${item.pattern} — ${item.meaning ?? ''}`).join('\n') || '- (无)';
        const selectedChunkLines = selectedChunks.map((item) => `- ${item.text} — ${item.meaning}`).join('\n') || '- (无)';
        const selectedVocabLines = selectedVocabs.map((item) => `- ${item.word} — ${item.meaning}`).join('\n') || '- (无)';
        const candidateLines = candidates.map((item) =>
          `- ${item.id} | ${item.text} | ${item.meaning} | ${item.category} | ${item.difficulty} | ${item.description.slice(0, 160)}`,
        ).join('\n') || '- (候选库中没有合适项目，可建议新建)';
        const kindLabel = dto.kind === 'pattern' ? '句型骨架' : 'Chunk';
        const { text } = await generateText({
          model,
          prompt: `你是英语课程教学设计审查员。请判断当前话题的${kindLabel}是否足够；只有确实能补足教学目标、表达功能或练习覆盖时才推荐，可以推荐 0 个，最多 ${count} 个。优先复用候选库；如果教学文档明确需要某个表达、候选库确实没有对应或近义互补项，则建议新建。

话题：${topic.title}
场景：${topic.scene.title}
目标难度：${difficulty}
英文任务：${topic.promptEn}
中文任务：${topic.promptZh}

教学文档：
${(dto.teachingMarkdown ?? topic.teachingMarkdown ?? '').slice(0, 6000) || '(无)'}

已经添加的句型：
${selectedPatternLines}

已经添加的 Chunk：
${selectedChunkLines}

已经添加的词汇：
${selectedVocabLines}

尚未添加且允许推荐的${kindLabel}候选（id | 内容 | 含义 | 分类 | 难度 | 说明）：
${candidateLines}

要求：
1. 先评估已添加材料是否已覆盖教学文档；足够时不要为了凑数量推荐。
2. 推荐项必须与当前材料互补，避免语义和表达功能重复。
3. 难度要匹配。优先选择 action="existing" 并填写候选 materialId；只有候选库无合适项目时才用 action="create"。
4. reason 用一句中文明确说明补足了教学文档中的哪个目标，以及与现有哪项材料互补。
5. create 项必须给出可直接入库的 text、meaning、category、difficulty、description 和 1-3 个中英例句；不要创建与现有材料同文或仅有大小写/标点差异的项目。
6. ${dto.kind === 'pattern' ? '句型骨架应体现可替换结构，不能只写一个孤立短语。' : 'Chunk 应是可直接复用的固定或半固定表达，不要伪装成抽象句型。'}
7. 只输出 JSON：{"summary":"中文审查结论","items":[{"action":"existing","materialId":"候选id","reason":"中文理由"},{"action":"create","text":"内容","meaning":"中文含义","category":"分类","difficulty":"L2","description":"中文说明","examples":[{"en":"英文例句","zh":"中文例句"}],"reason":"中文理由"}]}。`,
          temperature: 0.25,
          maxOutputTokens: 1800,
        });
        const parsed = extractJsonObject(text);
        if (parsed && Array.isArray(parsed.items)) {
          const byId = new Map(candidates.map((item) => [item.id, item]));
          const selected: SupportCandidate[] = [];
          for (const item of parsed.items) {
            const candidate = byId.get(String(item?.materialId));
            if (candidate) {
              if (selected.some((entry) => entry.id === candidate.id)) continue;
              selected.push(candidate);
              reasons.set(candidate.id, String(item?.reason ?? '').slice(0, 240));
            } else if (String(item?.action).toLowerCase() === 'create') {
              const text = String(item?.text ?? '').trim().slice(0, 240);
              const meaning = String(item?.meaning ?? '').trim().slice(0, 240);
              const normalizeText = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
              const normalizedText = normalizeText(text);
              const duplicate = !normalizedText
                || library.some((entry) => normalizeText(entry.text) === normalizedText)
                || newSuggestions.some((entry) => normalizeText(entry.text) === normalizedText);
              if (!meaning || duplicate) continue;
              const examples = Array.isArray(item?.examples)
                ? item.examples.slice(0, 3).map((example: any) => ({
                    en: String(example?.en ?? '').trim().slice(0, 500),
                    zh: String(example?.zh ?? '').trim().slice(0, 500),
                  })).filter((example: { en: string; zh: string }) => example.en && example.zh)
                : [];
              const suggestedDifficulty = /^L[1-5]$/i.test(String(item?.difficulty ?? ''))
                ? String(item.difficulty).toUpperCase()
                : difficulty;
              newSuggestions.push({
                materialId: `new:${dto.kind}:${newSuggestions.length + 1}`,
                text,
                meaning,
                category: String(item?.category ?? 'general').trim().slice(0, 80) || 'general',
                difficulty: suggestedDifficulty,
                description: String(item?.description ?? '').trim().slice(0, 500),
                examples,
                reason: String(item?.reason ?? '').trim().slice(0, 240),
              });
            }
            if (selected.length + newSuggestions.length >= count) break;
          }
          ranked = selected;
          summary = String(parsed.summary ?? summary).slice(0, 300);
        }
      }
    } catch (error: any) {
      console.warn(`[suggest-supports] AI 审查失败，回退规则推荐: ${error.message}`);
    }

    return {
      code: 200,
      message: 'success',
      data: {
        kind: dto.kind,
        summary,
        items: [...ranked.map((item) => ({
          materialId: item.id,
          text: item.text,
          meaning: item.meaning,
          category: item.category,
          difficulty: item.difficulty,
          status: earlier.has(`${kindKey}:${item.id}`) ? 'earlier' : 'available',
          reason: reasons.get(item.id) || '与教学目标相关，并可补充当前语言支架',
          score: item.score,
          source: 'library' as const,
        })), ...newSuggestions.map((item) => ({
          ...item,
          status: 'new' as const,
          score: 0,
          source: 'generated' as const,
        }))],
      },
    };
  }

  @Post('training-topics')
  async createTrainingTopic(@Req() req: Request, @Body() dto: CreateTrainingTopicDto) {
    await this.requireAdmin(req);
    const { chunkIds, vocabIds, patternIds, sentencePatterns, forceReview, ...data } = dto;
    const scene = await this.prisma.scene.findUnique({ where: { id: dto.sceneId }, select: { contentMode: true } });
    if (!scene) throw new NotFoundException('学习包不存在');
    if (['novel', 'story'].includes(scene.contentMode)) throw new BadRequestException('小说包和剧情包不使用训练话题');
    validateListeningTranscript(data.transcript);
    const activityType = ['writing', 'reading', 'listening'].includes(scene.contentMode) ? scene.contentMode : 'practice';

    // 行内 sentencePatterns 优先入库为共享句型（即使后续因冲突中止，句型库本身可复用）
    let resolvedPatternIds = patternIds ?? [];
    if (!patternIds && sentencePatterns?.length) {
      resolvedPatternIds = [];
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
        resolvedPatternIds.push(patternRecord.id);
      }
    }

    // 顺序约束校验（层 1 前序包 + 层 2 同包话题/包级认领）
    const claims = { vocabIds, chunkIds, patternIds: resolvedPatternIds };
    const conflicts = await this.materialConstraints.computeTopicClaimConflicts({
      sceneId: dto.sceneId,
      topicId: null,
      topicSortOrder: data.sortOrder ?? 0,
      claims,
    });
    if (conflicts.length && !forceReview) {
      return { code: 409, message: '存在材料引用冲突：部分单词/句块/句型已被前序内容认领', data: { conflicts } } as any;
    }
    // 同包话题冲突无法降级：唯一约束限制同一包内一个材料只能被认领一次，forceReview 只对跨包（前序包）冲突生效
    const topicConflicts = conflicts.filter((conflict) => conflict.sourceType === 'topic');
    if (topicConflicts.length) {
      return {
        code: 409,
        message: '存在材料引用冲突：部分单词/句块/句型已被本包其他话题认领，同一包内不可重复绑定',
        data: { conflicts: topicConflicts },
      } as any;
    }
    const conflictMaterialIds = conflicts.map((conflict) => conflict.materialId);

    const topic = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trainingTopic.create({
        data: {
          ...data,
          activityType: activityType as any,
          inkScriptId: activityType === 'practice' ? normalizeOptionalForeignKey(data.inkScriptId) : null,
          mediaAssetId: normalizeOptionalForeignKey(data.mediaAssetId),
        },
      });
      if (chunkIds?.length) {
        await tx.trainingTopicChunk.createMany({
          data: chunkIds.map((chunkId, i) => ({ topicId: created.id, chunkId, sortOrder: i })),
        });
      }
      if (vocabIds?.length) {
        await tx.trainingTopicVocab.createMany({
          data: vocabIds.map((vocabId, i) => ({ topicId: created.id, vocabId, sortOrder: i })),
        });
      }
      if (resolvedPatternIds.length) {
        await tx.trainingTopicSentencePattern.createMany({
          data: resolvedPatternIds.map((patternId, i) => ({ topicId: created.id, patternId, sortOrder: i })),
        });
      }
      // 引用表同步：冲突材料降级为 review（复习复用），其余为 learn（新学）
      await this.materialConstraints.syncTopicReferences(tx, dto.sceneId, created.id, claims, conflictMaterialIds);
      return created;
    });

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
    const { chunkIds, vocabIds, patternIds, sentencePatterns, forceReview, ...data } = dto;
    const current = await this.prisma.trainingTopic.findUnique({ where: { id }, select: { sceneId: true, sortOrder: true } });
    if (!current) throw new NotFoundException('学习话题不存在');
    const sceneId = data.sceneId ?? current.sceneId;
    const scene = await this.prisma.scene.findUnique({ where: { id: sceneId }, select: { contentMode: true } });
    if (!scene || ['novel', 'story'].includes(scene.contentMode)) throw new BadRequestException('当前学习包不使用训练话题');
    validateListeningTranscript(data.transcript);
    const activityType = ['writing', 'reading', 'listening'].includes(scene.contentMode) ? scene.contentMode : 'practice';
    const normalizedData: Record<string, any> = { ...data, activityType };
    if (activityType !== 'practice') normalizedData.inkScriptId = null;
    else if (data.inkScriptId !== undefined) normalizedData.inkScriptId = normalizeOptionalForeignKey(data.inkScriptId);
    if (data.mediaAssetId !== undefined) normalizedData.mediaAssetId = normalizeOptionalForeignKey(data.mediaAssetId);

    // 行内 sentencePatterns 优先入库为共享句型
    let resolvedPatternIds = patternIds;
    if (patternIds === undefined && sentencePatterns) {
      resolvedPatternIds = [];
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
        resolvedPatternIds.push(patternRecord.id);
      }
    }

    // 只有本次请求真正修改了材料绑定（chunkIds/vocabIds/patternIds/sentencePatterns）才做约束校验与引用同步；
    // 纯字段更新（如只保存 teachingMarkdown）不应触碰引用表。
    const bindingChanged = chunkIds !== undefined || vocabIds !== undefined || patternIds !== undefined || sentencePatterns !== undefined;

    // 顺序约束校验（层 1 前序包 + 层 2 前序话题），排除自身引用
    const claims: { vocabIds?: string[]; chunkIds?: string[]; patternIds?: string[] } = {};
    if (vocabIds !== undefined) claims.vocabIds = vocabIds;
    if (chunkIds !== undefined) claims.chunkIds = chunkIds;
    if (resolvedPatternIds !== undefined) claims.patternIds = resolvedPatternIds;
    const conflicts = bindingChanged
      ? await this.materialConstraints.computeTopicClaimConflicts({
          sceneId,
          topicId: id,
          topicSortOrder: data.sortOrder ?? current.sortOrder,
          claims,
        })
      : [];
    if (conflicts.length && !forceReview) {
      return { code: 409, message: '存在材料引用冲突：部分单词/句块/句型已被前序内容认领', data: { conflicts } } as any;
    }
    // 同包话题冲突无法降级：唯一约束限制同一包内一个材料只能被认领一次，forceReview 只对跨包（前序包）冲突生效
    const topicConflicts = conflicts.filter((conflict) => conflict.sourceType === 'topic');
    if (topicConflicts.length) {
      return {
        code: 409,
        message: '存在材料引用冲突：部分单词/句块/句型已被本包其他话题认领，同一包内不可重复绑定',
        data: { conflicts: topicConflicts },
      } as any;
    }
    const conflictMaterialIds = conflicts.map((conflict) => conflict.materialId);

    await this.prisma.$transaction(async (tx) => {
      await tx.trainingTopic.update({ where: { id }, data: normalizedData });
      if (chunkIds) {
        await tx.trainingTopicChunk.deleteMany({ where: { topicId: id } });
        if (chunkIds.length > 0) {
          await tx.trainingTopicChunk.createMany({
            data: chunkIds.map((chunkId, i) => ({ topicId: id, chunkId, sortOrder: i })),
          });
        }
      }
      if (vocabIds) {
        await tx.trainingTopicVocab.deleteMany({ where: { topicId: id } });
        if (vocabIds.length > 0) {
          await tx.trainingTopicVocab.createMany({
            data: vocabIds.map((vocabId, i) => ({ topicId: id, vocabId, sortOrder: i })),
          });
        }
      }
      if (resolvedPatternIds !== undefined) {
        await tx.trainingTopicSentencePattern.deleteMany({ where: { topicId: id } });
        if (resolvedPatternIds.length > 0) {
          await tx.trainingTopicSentencePattern.createMany({
            data: resolvedPatternIds.map((patternId, i) => ({ topicId: id, patternId, sortOrder: i })),
          });
        }
      }
      // 引用表同步：冲突材料降级为 review，其余为 learn
      if (bindingChanged) {
        await this.materialConstraints.syncTopicReferences(tx, sceneId, id, claims, conflictMaterialIds);
      }
    });
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
    return this.prisma.$transaction(async (tx) => {
      await tx.inkScript.updateMany({ where: { topicId: id }, data: { topicId: null } });
      await tx.practiceWarmupRecord.deleteMany({ where: { topicId: id } });
      await tx.userWarmupItemProgress.deleteMany({ where: { topicId: id } });
      await tx.userDailyPracticeAttempt.deleteMany({ where: { topicId: id } });
      await tx.practiceSession.deleteMany({ where: { topicId: id } });
      await tx.trainingTopicChunk.deleteMany({ where: { topicId: id } });
      await tx.trainingTopicVocab.deleteMany({ where: { topicId: id } });
      await tx.trainingTopicSentencePattern.deleteMany({ where: { topicId: id } });
      await tx.sceneMaterialReference.deleteMany({ where: { topicId: id } }); // 释放材料认领
      return tx.trainingTopic.delete({ where: { id } });
    });
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
      include: {
        roomNpcs: { include: { room: { select: { id: true, displayName: true, location: { select: { id: true, displayName: true } } } } } },
        voiceBindings: { include: { voiceAsset: { include: { provider: { select: { id: true, provider: true, label: true, model: true, isActive: true } } } } } },
      },
    });
  }

  @Post('characters')
  async createCharacter(@Req() req: Request, @Body() dto: any) {
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const character = await tx.gameCharacter.create({ data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_character_asset', character.id, character,
      );
      return character;
    });
  }

  @Patch('characters/:id')
  async updateCharacter(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const character = await tx.gameCharacter.update({ where: { id }, data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_character_asset', id, character,
      );
      return character;
    });
  }

  @Delete('characters/:id')
  async deleteCharacter(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.prisma.$transaction(async (tx) => {
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_character_asset', id, null,
      );
      return tx.gameCharacter.delete({ where: { id } });
    });
  }

  // ─── TTS voice assets + character references ──────────────

  @Get('tts-voices')
  async listTtsVoices(@Req() req: Request, @Query('providerId') providerId?: string) {
    await this.requireAdmin(req);
    return this.prisma.ttsVoiceAsset.findMany({
      where: providerId ? { providerId } : undefined,
      orderBy: [{ isAvailable: 'desc' }, { displayName: 'asc' }],
      include: {
        provider: { select: { id: true, provider: true, label: true, model: true, isActive: true } },
        _count: { select: { characterBindings: true } },
      },
    });
  }

  @Post('tts-voices')
  async createTtsVoice(@Req() req: Request, @Body() dto: any) {
    await this.requireAdmin(req);
    return this.prisma.ttsVoiceAsset.create({
      data: {
        providerId: dto.providerId,
        externalVoiceId: String(dto.externalVoiceId || '').trim(),
        displayName: String(dto.displayName || '').trim(),
        category: dto.category || 'custom',
        language: dto.language || null,
        gender: dto.gender || null,
        description: dto.description || null,
        previewUrl: dto.previewUrl || null,
        metadata: dto.metadata || undefined,
        isAvailable: dto.isAvailable !== false,
      },
      include: { provider: { select: { id: true, provider: true, label: true, model: true, isActive: true } } },
    });
  }

  @Post('tts-voices/sync/:providerId')
  async syncTtsVoices(@Req() req: Request, @Param('providerId') providerId: string) {
    await this.requireAdmin(req);
    const provider = await this.prisma.aiProvider.findUnique({ where: { id: providerId } });
    if (!provider || provider.type !== 'tts') throw new BadRequestException('TTS 厂商不存在');
    if (!provider.apiKey) throw new BadRequestException('请先在 AI Models 配置厂商 API Key');

    let rows: Array<{ externalVoiceId: string; displayName: string; category: string; language?: string; gender?: string; description?: string; previewUrl?: string; metadata?: any }> = [];
    if (provider.provider === 'minimax') {
      const response = await fetch(`${provider.baseUrl || 'https://api.minimax.io'}/v1/get_voice`, {
        method: 'POST', headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ voice_type: 'all' }),
      });
      if (!response.ok) throw new BadRequestException(`MiniMax 音色同步失败 (${response.status})`);
      const payload: any = await response.json();
      const groups = [['system_voice', 'system'], ['voice_cloning', 'cloned'], ['voice_generation', 'designed']] as const;
      rows = groups.flatMap(([key, category]) => (payload[key] || payload.data?.[key] || []).map((voice: any) => ({
        externalVoiceId: voice.voice_id, displayName: voice.voice_name || voice.voice_id, category,
        description: Array.isArray(voice.description) ? voice.description.join(' ') : voice.description,
        metadata: voice,
      })));
    } else if (provider.provider === 'elevenlabs') {
      const response = await fetch(`${(provider.baseUrl || 'https://api.elevenlabs.io').replace(/\/$/, '')}/v2/voices?page_size=100`, { headers: { 'xi-api-key': provider.apiKey } });
      if (!response.ok) throw new BadRequestException(`ElevenLabs 音色同步失败 (${response.status})`);
      const payload: any = await response.json();
      rows = (payload.voices || []).map((voice: any) => ({ externalVoiceId: voice.voice_id, displayName: voice.name || voice.voice_id, category: voice.category || 'system', language: voice.labels?.language, gender: voice.labels?.gender, description: voice.description, previewUrl: voice.preview_url, metadata: voice }));
    } else if (provider.provider === 'cartesia') {
      const response = await fetch(`${(provider.baseUrl || 'https://api.cartesia.ai').replace(/\/$/, '')}/voices`, { headers: { 'X-API-Key': provider.apiKey, 'Cartesia-Version': '2025-04-16' } });
      if (!response.ok) throw new BadRequestException(`Cartesia 音色同步失败 (${response.status})`);
      const payload: any = await response.json();
      const voices = Array.isArray(payload) ? payload : payload.data || [];
      rows = voices.map((voice: any) => ({ externalVoiceId: voice.id, displayName: voice.name || voice.id, category: voice.is_owner ? 'custom' : 'system', language: voice.language, description: voice.description, previewUrl: voice.preview_url, metadata: voice }));
    } else {
      throw new BadRequestException('该厂商暂不支持自动同步，请手动添加音色资产');
    }

    const validRows = rows.filter((row) => row.externalVoiceId && row.displayName);
    await this.prisma.$transaction(validRows.map((row) => this.prisma.ttsVoiceAsset.upsert({
      where: { providerId_externalVoiceId: { providerId, externalVoiceId: row.externalVoiceId } },
      create: { providerId, ...row, syncedAt: new Date(), isAvailable: true },
      update: { ...row, syncedAt: new Date(), isAvailable: true },
    })));
    return { synced: validRows.length };
  }

  @Patch('tts-voices/:id')
  async updateTtsVoice(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    await this.requireAdmin(req);
    const { provider, characterBindings, _count, ...data } = dto;
    return this.prisma.ttsVoiceAsset.update({ where: { id }, data });
  }

  @Delete('tts-voices/:id')
  async deleteTtsVoice(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    const references = await this.prisma.characterVoiceBinding.count({ where: { voiceAssetId: id } });
    if (references) throw new ForbiddenException(`该音色仍被 ${references} 个角色引用，请先解除引用`);
    return this.prisma.ttsVoiceAsset.delete({ where: { id } });
  }

  @Post('characters/:characterId/voice-bindings')
  async saveCharacterVoiceBinding(
    @Req() req: Request,
    @Param('characterId') characterId: string,
    @Body() dto: any,
  ) {
    await this.requireAdmin(req);
    const voiceAsset = await this.prisma.ttsVoiceAsset.findUnique({ where: { id: dto.voiceAssetId } });
    if (!voiceAsset) throw new ForbiddenException('音色资产不存在');
    if (dto.isDefault) {
      await this.prisma.characterVoiceBinding.updateMany({ where: { characterId }, data: { isDefault: false } });
    }
    return this.prisma.characterVoiceBinding.upsert({
      where: { characterId_voiceAssetId: { characterId, voiceAssetId: dto.voiceAssetId } },
      create: { characterId, voiceAssetId: dto.voiceAssetId, model: dto.model || null, params: dto.params || undefined, isDefault: Boolean(dto.isDefault) },
      update: { model: dto.model || null, params: dto.params || undefined, isDefault: Boolean(dto.isDefault) },
      include: { voiceAsset: { include: { provider: { select: { id: true, provider: true, label: true, model: true, isActive: true } } } } },
    });
  }

  @Delete('characters/:characterId/voice-bindings/:bindingId')
  async deleteCharacterVoiceBinding(@Req() req: Request, @Param('characterId') characterId: string, @Param('bindingId') bindingId: string) {
    await this.requireAdmin(req);
    return this.prisma.characterVoiceBinding.delete({ where: { id: bindingId, characterId } });
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
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const map = await tx.gameMap.create({ data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_map_asset', map.id, map,
      );
      return map;
    });
  }

  @Patch('maps/:id')
  async updateMap(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const map = await tx.gameMap.update({ where: { id }, data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_map_asset', id, map,
      );
      return map;
    });
  }

  @Delete('maps/:id')
  async deleteMap(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.prisma.$transaction(async (tx) => {
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_map_asset', id, null,
      );
      return tx.gameMap.delete({ where: { id } });
    });
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
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const location = await tx.gameLocation.create({ data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_location_asset', location.id, location,
      );
      return location;
    });
  }

  @Patch('locations/:id')
  async updateLocation(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const location = await tx.gameLocation.update({ where: { id }, data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_location_asset', id, location,
      );
      return location;
    });
  }

  @Delete('locations/:id')
  async deleteLocation(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.prisma.$transaction(async (tx) => {
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_location_asset', id, null,
      );
      return tx.gameLocation.delete({ where: { id } });
    });
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
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.gameRoom.create({ data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_room_asset', room.id, room,
      );
      return room;
    });
  }

  @Patch('rooms/:id')
  async updateRoom(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.gameRoom.update({ where: { id }, data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_room_asset', id, room,
      );
      return room;
    });
  }

  @Delete('rooms/:id')
  async deleteRoom(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.prisma.$transaction(async (tx) => {
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'game_room_asset', id, null,
      );
      return tx.gameRoom.delete({ where: { id } });
    });
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
    @Query('scope') scope?: 'practice' | 'narrative',
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
    else if (scope === 'practice') where.scriptType = 'practice'
    else if (scope === 'narrative') where.scriptType = { not: 'practice' }
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
    const session = await this.requireAdmin(req);
    if (dto?.assetMap !== undefined) {
      throw new BadRequestException('assetMap 必须通过故事资源接口维护');
    }
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const story = await tx.inkScript.create({
        data,
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
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'story_content_asset', story.id, story,
      );
      return story;
    });
  }

  @Patch('stories/:id')
  async updateStory(@Req() req: Request, @Param('id') id: string, @Body() dto: any) {
    const session = await this.requireAdmin(req);
    if (dto?.assetMap !== undefined) {
      throw new BadRequestException('assetMap 必须通过故事资源接口维护');
    }
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const story = await tx.inkScript.update({
        where: { id },
        data,
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
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'story_content_asset', id, story,
      );
      return story;
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
    await this.prisma.$transaction(async (tx) => {
      await tx.fileReference.deleteMany({
        where: {
          OR: [
            { bizType: 'story_content_asset', bizId: { in: inkIds } },
            { bizType: 'story_asset', OR: inkIds.map((id) => ({ bizId: { startsWith: `${id}:` } })) },
          ],
        },
      });
      await tx.inkScript.deleteMany({ where: { id: { in: inkIds } } });
    });
    return { success: true, count: inkIds.length };
  }

  @Delete('stories/:id')
  async deleteStory(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    await this.detachInkScript(id);
    return this.prisma.$transaction(async (tx) => {
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'story_content_asset', id, null,
      );
      await tx.fileReference.deleteMany({ where: { bizType: 'story_asset', bizId: { startsWith: `${id}:` } } });
      return tx.inkScript.delete({ where: { id } });
    });
  }

  // ════════════════════════════════════════════════════════════
  // STORY ASSET REGISTRY (assetMap CRUD)
  // ════════════════════════════════════════════════════════════

  /** 获取故事的 assetMap，并附上每个资产的可访问签名 URL */
  @Get('stories/:id/assets')
  async getStoryAssets(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    const story = await this.prisma.inkScript.findUnique({
      where: { id },
      select: { id: true, assetMap: true },
    });
    if (!story) throw new NotFoundException('故事不存在');

    const assetMap = (story.assetMap as Record<string, any>) || {};
    const resolved: Record<string, any> = {};

    for (const [alias, entry] of Object.entries(assetMap)) {
      let signedUrl: string | null = null;
      try {
        if (entry.fileAssetId) {
          const result = await this.fileAssetsService.getAssetLongLivedUrl(entry.fileAssetId);
          signedUrl = result.url;
        }
      } catch { /* 签名失败不阻塞 */ }
      resolved[alias] = { ...entry, signedUrl };
    }

    return { storyId: id, assets: resolved };
  }

  /** 添加资产到 assetMap，并在同一事务中登记资源引用。 */
  @Post('stories/:id/assets')
  async addStoryAsset(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { alias: string; fileAssetId: string; type: 'image' | 'audio' },
  ) {
    const session = await this.requireAdmin(req);

    const story = await this.prisma.inkScript.findUnique({
      where: { id },
      select: { id: true, assetMap: true },
    });
    if (!story) throw new NotFoundException('故事不存在');

    const assetMap = (story.assetMap as Record<string, any>) || {};

    const fileAsset = await this.prisma.fileAsset.findUnique({
      where: { id: dto.fileAssetId },
      select: { mimeType: true },
    });
    if (!fileAsset) throw new NotFoundException('文件资源不存在');
    assetMap[dto.alias] = {
      fileAssetId: dto.fileAssetId,
      type: dto.type,
      mimeType: fileAsset.mimeType,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.fileReference.deleteMany({
        where: { bizType: 'story_asset', bizId: `${id}:${dto.alias}` },
      });
      await tx.fileReference.create({
        data: {
          assetId: dto.fileAssetId,
          bizType: 'story_asset',
          bizId: `${id}:${dto.alias}`,
          createdById: session.user.id,
        },
      });
      await tx.inkScript.update({ where: { id }, data: { assetMap } });
    });

    return { storyId: id, alias: dto.alias, entry: assetMap[dto.alias] };
  }

  /** 从 assetMap 移除资产，并在同一事务中移除资源引用。 */
  @Delete('stories/:id/assets/:alias')
  async removeStoryAsset(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('alias') alias: string,
  ) {
    await this.requireAdmin(req);

    const story = await this.prisma.inkScript.findUnique({
      where: { id },
      select: { id: true, assetMap: true },
    });
    if (!story) throw new NotFoundException('故事不存在');

    const assetMap = (story.assetMap as Record<string, any>) || {};
    const entry = assetMap[alias];
    if (!entry) throw new NotFoundException(`别名 "${alias}" 不存在`);

    delete assetMap[alias];
    await this.prisma.$transaction(async (tx) => {
      await tx.inkScript.update({ where: { id }, data: { assetMap } });
      await tx.fileReference.deleteMany({
        where: { bizType: 'story_asset', bizId: `${id}:${alias}` },
      });
    });

    return { storyId: id, alias, removed: true };
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
      const llmConfig = await this.aiModelService.getLlmConfig();
      if (!llmConfig.apiKey) throw new Error('LLM API Key 未配置');

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
      const client = createOpenAI({ apiKey: llmConfig.apiKey, baseURL: llmConfig.baseUrl });
      const model = client.chat(llmConfig.model);

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

      const activeTtsConfig = await this.aiModelService.getTtsConfig();
      const activeTtsProvider = Object.values(TtsProvider).includes(activeTtsConfig.provider as TtsProvider)
        ? activeTtsConfig.provider as TtsProvider
        : TtsProvider.minimax;

      // 只读取当前激活厂商的角色音色引用，不再从角色字段猜测厂商。
      const characters = await this.prisma.gameCharacter.findMany({
        where: { voiceBindings: { some: { voiceAsset: { provider: { provider: activeTtsProvider }, isAvailable: true } } } },
        include: {
          voiceBindings: {
            where: { voiceAsset: { provider: { provider: activeTtsProvider }, isAvailable: true } },
            include: { voiceAsset: true },
            orderBy: { isDefault: 'desc' },
          },
        },
      });

      // 构建角色名 -> TTS 配置映射。每个角色在当前厂商下优先使用默认绑定。
      const charTtsMap = new Map<string, { voice: string; model: string | null; params: any; provider: TtsProvider }>();
      for (const char of characters) {
        const binding = char.voiceBindings[0];
        if (!binding) continue;
        const key = char.name.toLowerCase();
        const displayKey = char.displayName.toLowerCase();
        const config = {
          voice: binding.voiceAsset.externalVoiceId,
          model: binding.model || activeTtsConfig.model,
          params: binding.params || {},
          provider: activeTtsProvider,
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
      const llmConfig = await this.aiModelService.getLlmConfig();
      if (!llmConfig.apiKey) throw new Error('LLM API Key 未配置');

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

      const client = createOpenAI({ apiKey: llmConfig.apiKey, baseURL: llmConfig.baseUrl });
      const model = client.chat(llmConfig.model);

      // 清洗输出：DeepSeek 偶发返回空内容，自动重试一次
      let md = '';
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { text } = await generateText({
          model,
          prompt: `你是一名英语学习教学设计专家。请根据以下话题信息和故事对话，为面向中国英语学习者的「练习助手」撰写一份教学文档（Markdown 格式）。

这份文档会展示在练习页顶部，是学习者开始练习前的**老师讲课**，而不是知识点清单。

## 最重要的一条原则（务必理解）

学习者在本页的其他区域已经能看到本话题绑定的**单词、句型、句块完整列表**，所以教学文档绝不能再罗列一遍：

- 禁止出现「核心词汇」「实用表达」这类纯清单小节，禁止只写 \`word — 释义\` 这种条目式内容；
- 你的任务是**把这些知识点讲懂、讲透**：每个知识点讲清楚「是什么 → 怎么用（结构/搭配）→ 什么时候用（场景）→ 例句 → 容易错在哪」；
- 例句必须结合本话题场景来造，是对话里真实会说的话，不要写与场景无关的例句；
- 学习者读完这篇文档，应该能直接开口——知道接下来该说什么、怎么说、为什么这么说。

## 写作要求

1. 语言：**全部用中文写**（仅英文例句保留英文）
2. 语气：亲切、鼓励，像老师在课前做 briefing，讲人话、不端着
3. 长度：500-900 字
4. 排版：规范的 Markdown，可以用 ## 小标题帮助分段，但**不要套固定模板**

## 怎么写（自由发挥，不要固定结构）

不要用固定的章节标题和顺序，像老师上课一样把知识点自然地讲出来，怎么讲清楚就怎么组织。几点建议（不是强制）：

- 可以先用一两句话把场景/故事带出来，让学习者进入情境，再顺势引出要学的知识点；
- 每个知识点讲清楚：意思 → 怎么用（结构/搭配）→ 什么时候用（场景）→ 结合场景的例句 → 容易错在哪；
- 至少给出 1 组「易混辨析」：把两个容易混淆的词/表达放在一起，讲清区别和各自的使用场合；
- 用生活化的类比或记忆提示，帮助学习者记住用法；
- 篇幅上保证「讲透」为主，不要为了凑结构堆内容，也不要只列条目不解释。

---

## 输入信息

${contextBlock}

## 输出

直接输出 Markdown 文档，不要任何额外说明。`,
          temperature: 0.5,
          maxOutputTokens: 3000,
        });
        md = text
          .replace(/```markdown\s*/gi, '')
          .replace(/```md\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();
        if (md) break;
      }
      if (!md) throw new Error('AI 生成教学文档失败：模型返回内容为空，请重试');

      return {
        code: 200,
        message: 'success',
        data: { markdown: md },
      };
    } catch (err: any) {
      return { code: 500, message: err.message, data: null };
    }
  }

  /**
   * AI 生成话题教学文档（Markdown）
   * 用于「学习内容 / 编辑话题 / 知识点练习」中的话题级教学说明。
   * 遵守学习包组顺序约束：不得出现后序包知识点，难度与话题/学习包对齐。
   */
  @Post('training-topics/:id/generate-warmup-task')
  async generateWarmupPipelineTask(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.adminTasksService.enqueueWarmupPipelineGenerate(id, session.user.id);
  }

  /**
   * 场景批量生成任务：为该场景下所有话题补齐「教学文档 + 知识点训练」。
   * 在任务中心执行并展示进度。
   */
  @Post('scenes/:id/generate-topic-batch')
  async generateSceneTopicBatch(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.adminTasksService.enqueueSceneTopicBatchGenerate(id, session.user.id);
  }

  @Post('training-topics/:id/generate-teaching')
  async generateTopicTeachingMarkdown(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);

    try {
      const markdown = await this.topicTeachingGenerateService.generateForTopic(id);
      return {
        code: 200,
        message: 'success',
        data: { markdown },
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
    @Query('matchType') matchType?: string,
    @Query('difficulty') difficulty?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);
    const where: any = {};
    if (search) {
      if (matchType === 'exact') {
        // 精确查询：单词或释义完全匹配（忽略大小写）
        where.OR = [
          { word: { equals: search, mode: 'insensitive' } },
          { meaning: { equals: search, mode: 'insensitive' } },
        ];
      } else {
        // 默认模糊查询：单词或释义包含关键字
        where.OR = [
          { word: { contains: search, mode: 'insensitive' } },
          { meaning: { contains: search, mode: 'insensitive' } },
        ];
      }
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
    const session = await this.requireAdmin(req);
    const normalized = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const vocabulary = await tx.vocabulary.create({
          data: { ...normalized, examples: normalized.examples as any },
        });
        await this.fileAssetsService.syncPersistentAssetReferences(
          tx, session.user.id, 'vocabulary_asset', vocabulary.id, vocabulary,
        );
        return vocabulary;
      });
    } catch (err: any) {
      if (err.code === 'P2002') throw new ForbiddenException(`词汇 "${dto.word}" 已存在，请勿重复添加`);
      throw err;
    }
  }

  /** CSV 批量导入词汇（异步任务） */
  @Post('library/vocabularies/import-csv')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async importVocabularyCsv(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.requireAdmin(req);
    if (!file) throw new BadRequestException('上传请求中没有找到 file 文件字段');

    let rows: string[][];
    try {
      rows = parse(file.buffer, {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as string[][];
    } catch {
      throw new BadRequestException('CSV 格式无效，请检查引号和分隔符');
    }

    const firstRowIsHeader = rows[0]?.[0]?.trim().toLowerCase() === 'word';
    const words = rows
      .slice(firstRowIsHeader ? 1 : 0)
      // Oxford lists occasional alternatives such as "a, an" in one cell.
      // They are separate words, never a single dictionary lookup key.
      .flatMap((row) => row[0]?.split(',').map((word) => word.trim().toLowerCase()) ?? [])
      .filter((word): word is string => Boolean(word));

    if (words.length > 20_000) {
      throw new BadRequestException('单次最多导入 20,000 个词汇');
    }

    if (words.length === 0) {
      throw new BadRequestException('CSV 中没有找到有效的词汇（需要 "word" 列）');
    }

    const session = await requireAuthSession(req);
    const task = await this.adminTasksService.enqueueVocabularyCsvImport(
      words,
      (session.user as any)?.id,
    );

    return {
      code: 200,
      message: 'success',
      data: { taskId: task.id, wordCount: words.length },
    };
  }

  /** 检查词汇表中缺失中文释义的记录，并创建后台 AI 富化任务。 */
  @Post('library/vocabularies/enrich-missing-chinese')
  async enrichVocabulariesMissingChinese(@Req() req: Request) {
    await this.requireAdmin(req);
    const session = await requireAuthSession(req);
    const task = await this.adminTasksService.enqueueVocabularyMissingMeaningEnrich((session.user as any)?.id);
    return { code: 200, message: 'success', data: { taskId: task.id } };
  }

  /** 词汇轻量修补：例句缺中文翻译补翻译 + 中文释义过长精简（后台任务）。 */
  @Post('library/vocabularies/polish')
  async polishVocabularies(@Req() req: Request) {
    await this.requireAdmin(req);
    const session = await requireAuthSession(req);
    const task = await this.adminTasksService.enqueueVocabularyPolish((session.user as any)?.id);
    return { code: 200, message: 'success', data: { taskId: task.id } };
  }

  @Patch('library/vocabularies/:id')
  async updateLibraryVocabulary(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateFullVocabularyDto) {
    const session = await this.requireAdmin(req);
    const normalized = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const vocabulary = await tx.vocabulary.update({
        where: { id },
        data: { ...normalized, examples: normalized.examples as any },
      });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'vocabulary_asset', id, vocabulary,
      );
      return vocabulary;
    });
  }

  @Delete('library/vocabularies/:id')
  async deleteLibraryVocabulary(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.prisma.$transaction(async (tx) => {
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'vocabulary_asset', id, null,
      );
      return tx.vocabulary.delete({ where: { id } });
    });
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
  }

  /** 检查句块表中缺失中文释义的记录，并创建后台 AI 富化任务。 */
  @Post('library/chunks/enrich-missing-chinese')
  async enrichChunksMissingChinese(@Req() req: Request) {
    await this.requireAdmin(req);
    const session = await requireAuthSession(req);
    const task = await this.adminTasksService.enqueueChunkMissingMeaningEnrich((session.user as any)?.id);
    return { code: 200, message: 'success', data: { taskId: task.id } };
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
  }

  /** 触发单词富化：FreeDictionary 词典字段 + AI 讲解/描述与例句 */
  @Post('library/vocabularies/:id/enrich')
  async enrichVocabulary(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.contentPrepareService.prepareVocabularyFull(id);
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
    const session = await this.requireAdmin(req);
    const normalized = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    const { examples, ...data } = normalized;
    const payload: any = { ...data, category: data.category || 'general' };
    if (examples?.length) {
      payload.examples = { create: examples.map((ex, i) => ({ ...ex, sortOrder: i })) };
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const chunk = await tx.chunk.create({
          data: payload,
          include: { examples: { orderBy: { sortOrder: 'asc' } } },
        });
        await this.fileAssetsService.syncPersistentAssetReferences(
          tx, session.user.id, 'chunk_asset', chunk.id, chunk,
        );
        return chunk;
      });
    } catch (err: any) {
      if (err.code === 'P2002') throw new ForbiddenException(`句块 "${dto.text}" 已存在，请勿重复添加`);
      throw err;
    }
  }

  @Patch('library/chunks/:id')
  async updateLibraryChunk(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateFullChunkDto) {
    const session = await this.requireAdmin(req);
    const normalized = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    const { examples, ...data } = normalized;
    const payload: any = { ...data };
    if (examples !== undefined) {
      payload.examples = { create: examples.map((ex, i) => ({ ...ex, sortOrder: i })) };
    }
    return this.prisma.$transaction(async (tx) => {
      if (examples !== undefined) {
        await tx.chunkExample.deleteMany({ where: { chunkId: id } });
      }
      const chunk = await tx.chunk.update({
        where: { id },
        data: payload,
        include: { examples: { orderBy: { sortOrder: 'asc' } } },
      });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'chunk_asset', id, chunk,
      );
      return chunk;
    });
  }

  @Delete('library/chunks/:id')
  async deleteLibraryChunk(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.prisma.$transaction(async (tx) => {
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'chunk_asset', id, null,
      );
      await tx.chunkExample.deleteMany({ where: { chunkId: id } });
      return tx.chunk.delete({ where: { id } });
    });
  }

  // ════════════════════════════════════════════════════════════
  // CONTENT LIBRARY: Sentence Pattern Management
  // ════════════════════════════════════════════════════════════

  /** 检查句型表中缺失中文释义的记录，并创建后台 AI 富化任务。 */
  @Post('library/patterns/enrich-missing-chinese')
  async enrichPatternsMissingChinese(@Req() req: Request) {
    await this.requireAdmin(req);
    const session = await requireAuthSession(req);
    const task = await this.adminTasksService.enqueuePatternMissingMeaningEnrich((session.user as any)?.id);
    return { code: 200, message: 'success', data: { taskId: task.id } };
  }

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
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const pattern = await tx.sentencePattern.create({ data });
        await this.fileAssetsService.syncPersistentAssetReferences(
          tx, session.user.id, 'sentence_pattern_asset', pattern.id, pattern,
        );
        return pattern;
      });
    } catch (err: any) {
      if (err.code === 'P2002') throw new ForbiddenException(`句式 "${dto.pattern}" 已存在，请勿重复添加`);
      throw err;
    }
  }

  @Patch('library/patterns/:id')
  async updateLibraryPattern(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateSentencePatternDto) {
    const session = await this.requireAdmin(req);
    const data = await this.fileAssetsService.normalizePersistentAssetUrls(dto);
    return this.prisma.$transaction(async (tx) => {
      const pattern = await tx.sentencePattern.update({ where: { id }, data });
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'sentence_pattern_asset', id, pattern,
      );
      return pattern;
    });
  }

  @Delete('library/patterns/:id')
  async deleteLibraryPattern(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.prisma.$transaction(async (tx) => {
      await this.fileAssetsService.syncPersistentAssetReferences(
        tx, session.user.id, 'sentence_pattern_asset', id, null,
      );
      return tx.sentencePattern.delete({ where: { id } });
    });
  }

  // ════════════════════════════════════════════════════════════
  // LISTENING PIPELINE
  // ════════════════════════════════════════════════════════════

  /**
   * Flow A: 上传英文文章 → TTS 合成音频 → (无词时间戳时) Whisper 提取 → 句子分段
   * Returns: COS audio asset + sentence-level transcript
   */
  @Post('listening/pipeline/text')
  async listeningPipelineFromText(@Req() req: Request, @Body() dto: ListeningPipelineTextDto) {
    await this.requireAdmin(req);
    const result = await this.ttsService.processListeningFromText({
      text: dto.text,
      provider: dto.provider,
      model: dto.model,
      voiceId: dto.voiceId,
      ttsParams: dto.params,
      forceWhisperTimestamps: dto.forceWhisperTimestamps,
    });
    return result;
  }

  /**
   * Flow B: 上传音频文件 → Whisper STT → 句子分段
   * Audio is saved to COS and transcript is returned.
   */
  @Post('listening/pipeline/audio')
  @UseInterceptors(FileInterceptor('audio', {
    storage: memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 50 }, // 50 MB
  }))
  async listeningPipelineFromAudio(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body('language') language?: string,
  ) {
    await this.requireAdmin(req);
    if (!file) throw new BadRequestException('未收到音频文件');
    const result = await this.ttsService.processListeningFromAudio({
      audioBuffer: file.buffer,
      fileName: file.originalname || 'audio.mp3',
      language,
    });
    return result;
  }
}
