import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import AdmZip = require('adm-zip');
import { createHash } from 'crypto';
import { FileAssetsService } from '../file-assets/file-assets.service';

function sha256Buffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function jsonBuffer(value: unknown) {
  return Buffer.from(JSON.stringify(value, null, 2), 'utf8');
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'file';
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]{1,8})$/);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    const match = url.match(/\.([a-zA-Z0-9]{1,8})(?:\?|#|$)/);
    return match?.[1]?.toLowerCase() ?? null;
  }
}

function extensionFromMime(mime?: string | null) {
  if (!mime) return null;
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('json')) return 'json';
  return null;
}

function stableStringify(value: any): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function stableHash(value: any): string {
  const input = stableStringify(value);
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function compactKey(value: any, fallback: string) {
  if (value == null) return fallback;
  return String(value).trim() || fallback;
}

function warmupItemIdentity(item: any) {
  return {
    type: item?.type,
    title: item?.title,
    kind: item?.kind,
    direction: item?.direction,
    chunk: item?.chunk,
    chunkMeaning: item?.chunkMeaning,
    pattern: item?.pattern,
    patternMeaning: item?.patternMeaning,
    vocabWord: item?.vocabWord,
    vocabMeaning: item?.vocabMeaning,
    fullSentence: item?.fullSentence,
    levels: item?.levels,
  };
}

function createWarmupPracticeItemId(params: {
  packId: string;
  topicId: string;
  type: string;
  item: any;
  prompt: any;
  pattern?: any;
}) {
  const itemKey = compactKey(params.item?.id, `item-${stableHash(warmupItemIdentity(params.item))}`);
  const patternPart = params.pattern
    ? `:p-${compactKey(params.pattern.id, stableHash({
      chunk: params.pattern.chunk,
      meaning: params.pattern.meaning,
      chunkMeaning: params.pattern.chunkMeaning,
      pattern: params.pattern.pattern,
    }))}`
    : '';
  const promptKey = compactKey(
    params.prompt?.id ?? params.prompt?.vocabId,
    `prompt-${stableHash({
      zh: params.prompt?.zh,
      answer: params.prompt?.answer,
      promptZh: params.prompt?.promptZh,
      suggestedAnswer: params.prompt?.suggestedAnswer,
      targetWords: params.prompt?.targetWords,
      fullSentence: params.prompt?.fullSentence,
      levels: params.prompt?.levels,
    })}`,
  );
  return `${params.packId}:${params.topicId}:${itemKey}:${params.type}${patternPart}:i-${promptKey}`;
}

type WarmupTopicForProgress = {
  id: string;
  metadata: any;
};

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileAssets: FileAssetsService,
  ) {}

  private pushAsset(assets: any[], url?: string | null, role?: string) {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;
    if (assets.some((asset) => asset.url === url)) return;
    assets.push({ url, role });
  }

  private isPackagedAsset(asset: any) {
    const role = String(asset?.role ?? '').toLowerCase();
    return !['voice', 'audio', 'bgm', 'sfx'].includes(role);
  }

  private async isLearningPackFreeDownloadsEnabled() {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'learning_pack_free_downloads_enabled' },
      select: { value: true },
    });
    return config?.value === 'true' || config?.value === '1';
  }

  private async canAccessLearningPack(userId: string, unitId: string, options: { allowExistingProgress?: boolean } = {}) {
    const [scene, user, membership, freeDownloadsEnabled, existingProgress] = await Promise.all([
      this.prisma.scene.findUnique({
        where: { id: unitId },
        select: { id: true, isFree: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
      this.prisma.userMembership.findUnique({
        where: { userId },
      }),
      this.isLearningPackFreeDownloadsEnabled(),
      options.allowExistingProgress
        ? this.prisma.userSceneProgress.findUnique({
            where: { userId_sceneId: { userId, sceneId: unitId } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!scene) return false;
    if (freeDownloadsEnabled || scene.isFree || user?.role === 'admin') return true;
    if (membership?.status === 'active' && membership.expiredAt > new Date()) return true;
    if (options.allowExistingProgress && existingProgress) return true;
    return false;
  }

  async assertLearningPackAccess(userId: string, unitId: string, options: { allowExistingProgress?: boolean } = {}) {
    // 先检查学习单元是否存在（避免将"不存在"误报为"权限不足"）
    const sceneExists = await this.prisma.scene.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!sceneExists) {
      throw new NotFoundException('学习单元不存在');
    }
    if (await this.canAccessLearningPack(userId, unitId, options)) return;
    throw new ForbiddenException('该学习包需要会员权限');
  }

  private async getPassedPracticeTopicIdsByScene(userId: string) {
    const sessions = await this.prisma.practiceSession.findMany({
      where: { userId, status: 'analyzed' },
      select: { sceneId: true, topicId: true, analysisResult: true },
    });
    const passedByScene = new Map<string, Set<string>>();
    for (const session of sessions) {
      const score = Number((session.analysisResult as any)?.overallScore ?? 0);
      if (score <= 70) continue;
      const topicIds = passedByScene.get(session.sceneId) ?? new Set<string>();
      topicIds.add(session.topicId);
      passedByScene.set(session.sceneId, topicIds);
    }
    return passedByScene;
  }

  private getWarmupPipeline(topic: WarmupTopicForProgress) {
    const metadata = topic.metadata ?? {};
    if (metadata.outputTraining?.enabled === false) return [];
    if (Array.isArray(metadata.outputTraining?.pipeline)) return metadata.outputTraining.pipeline;
    if (metadata.enabled === false) return [];
    if (Array.isArray(metadata.pipeline)) return metadata.pipeline;
    return [];
  }

  private buildWarmupPracticeItemIds(sceneId: string, topics: WarmupTopicForProgress[]) {
    const itemIds: string[] = [];
    for (const topic of topics) {
      const pipeline = this.getWarmupPipeline(topic);
      for (const item of pipeline) {
        const type = item?.type;
        if (!type) continue;
        const push = (prompt: any, pattern?: any) => {
          itemIds.push(createWarmupPracticeItemId({
            packId: sceneId,
            topicId: topic.id,
            type,
            item,
            prompt,
            pattern,
          }));
        };

        if (type === 'chunk_substitution' || type === 'pattern_drill') {
          (Array.isArray(item.items) ? item.items : []).forEach((prompt: any) => push(prompt));
        } else if (type === 'vocab_drill') {
          (Array.isArray(item.vocabs) ? item.vocabs : []).forEach((prompt: any) => push(prompt));
        } else if (type === 'vocab_sentence_building') {
          (Array.isArray(item.patterns) ? item.patterns : []).forEach((pattern: any) => {
            (Array.isArray(pattern?.items) ? pattern.items : []).forEach((prompt: any) => push({ ...prompt, pattern }, pattern));
          });
        } else if (type === 'sentence_decomposition') {
          push({ levels: item.levels, fullSentence: item.fullSentence });
        }
      }
    }
    return itemIds;
  }

  private async getCompletedWarmupItemIdsByScene(userId: string, sceneIds: string[]) {
    if (!sceneIds.length) return new Map<string, Set<string>>();
    const progresses = await (this.prisma as any).userWarmupItemProgress.findMany({
      where: {
        userId,
        packId: { in: sceneIds },
        bestScoreRank: { gte: 2 },
      },
      select: {
        packId: true,
        itemId: true,
      },
    });

    const byScene = new Map<string, Set<string>>();
    for (const progress of progresses) {
      const itemIds = byScene.get(progress.packId) ?? new Set<string>();
      itemIds.add(progress.itemId);
      byScene.set(progress.packId, itemIds);
    }
    return byScene;
  }

  /**
   * 获取全部教材分类标签列表（供筛选下拉使用）
   */
  async getTags(packageType?: string) {
    const categories = await this.prisma.sceneCategory.findMany({
      where: packageType
        ? {
            scenes: {
              some: { packageType: packageType as any },
            },
          }
        : undefined,
      orderBy: { sortOrder: 'asc' },
      select: { name: true, icon: true },
    });
    return categories;
  }

  /**
   * 获取全部「教材」（即 Scene）列表，附带用户进度。
   * 免费用户看到全部单元，但非免费单元标记为锁定。
   * @param params.tag 按主题分类名称过滤（可选）
   * @param params.packageType 按一级学习包类型过滤（可选）
   * @param params.search 按单元标题模糊搜索（可选）
   */
  async getLearningUnits(userId: string, params: {
    tag?: string;
    packageType?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const { tag, packageType, search, page = 1, pageSize = 20 } = params;
    // 管理员拥有全部权限
    const adminCheck = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = adminCheck?.role === 'admin';

    // 检查会员状态
    const membership = await this.prisma.userMembership.findUnique({
      where: { userId },
    });
    const isMember =
      isAdmin || (membership?.status === 'active' && membership.expiredAt > new Date());
    const freeDownloadsEnabled = await this.isLearningPackFreeDownloadsEnabled();

    // 查询条件
    const sceneWhere: any = {};
    if (packageType) {
      sceneWhere.packageType = packageType;
    }
    if (search) {
      sceneWhere.title = { contains: search, mode: 'insensitive' };
    }

    const categoryWhere: any = {};
    if (tag) {
      categoryWhere.name = tag;
    }

    // 先查总数
    const total = await this.prisma.scene.count({
      where: {
        ...sceneWhere,
        category: categoryWhere,
      },
    });

    // 查全部场景（不分页，排序在 JS 中完成）
    const allScenes = await this.prisma.scene.findMany({
      where: {
        ...sceneWhere,
        category: categoryWhere,
      },
      include: {
        category: { select: { id: true, name: true, icon: true } },
        _count: { select: { trainingTopics: true, storyEpisodes: true } },
        trainingTopics: {
          select: {
            id: true,
            type: true,
            title: true,
            difficulty: true,
            metadata: true,
            suggestedDurationSec: true,
            _count: { select: { activeChunks: true, topicVocabs: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // 批量查询用户场景进度
    const sceneIds = allScenes.map((s) => s.id);
    const progresses = await this.prisma.userSceneProgress.findMany({
      where: { userId, sceneId: { in: sceneIds } },
    });
    const progressMap = new Map(progresses.map((p) => [p.sceneId, p]));
    const completedWarmupItemIdsByScene = await this.getCompletedWarmupItemIdsByScene(userId, sceneIds);

    // 查询用户等级/输出级别
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userLevel: true, outputLevel: true },
    });

    const fullList = allScenes.map((scene) => {
      const prog = progressMap.get(scene.id);
      // Compute totals from topics
      let vocabCount = 0;
      let chunkCount = 0;
      for (const t of scene.trainingTopics) {
        vocabCount += (t as any)._count?.topicVocabs ?? 0;
        chunkCount += (t as any)._count?.activeChunks ?? 0;
      }
      const warmupItemIds = this.buildWarmupPracticeItemIds(scene.id, scene.trainingTopics);
      const completedWarmupItemIds = completedWarmupItemIdsByScene.get(scene.id) ?? new Set<string>();
      const completedPracticeCount = warmupItemIds.filter((itemId) => completedWarmupItemIds.has(itemId)).length;
      const totalPracticeItems = warmupItemIds.length;

      const isUnlocked =
        freeDownloadsEnabled || (user?.userLevel ?? 1) >= scene.requiredUserLevel;

      return {
        id: scene.id,
        packageType: scene.packageType,
        title: scene.title,
        location: scene.location,
        description: scene.description,
        categoryId: scene.category.id,
        categoryName: scene.category.name,
        categoryIcon: scene.category.icon,
        topics: scene.trainingTopics.map((t: any) => ({
          id: t.id,
          type: t.type,
          title: t.title,
          difficulty: t.difficulty,
          metadata: t.metadata,
          suggestedDurationSec: t.suggestedDurationSec,
        })),
        requiredOutputLevel: scene.requiredOutputLevel,
        requiredUserLevel: scene.requiredUserLevel,
        isFree: scene.isFree,
        isLocked: !freeDownloadsEnabled && !isMember && !scene.isFree,
        isUnlocked,
        vocabCount,
        chunkCount,
        topicCount: scene._count.trainingTopics,
        scriptCount: scene._count.storyEpisodes,
        progress: prog
          ? {
              readiness: prog.readiness,
              mastery: prog.mastery,
              vocabLearned: prog.vocabLearned,
              vocabTotal: vocabCount,
              chunkMastered: prog.chunkMastered,
              chunkTotal: chunkCount,
              completedPracticeCount,
              totalPracticeCount: totalPracticeItems,
              completedScriptCount: prog.completedScriptCount,
            }
          : null,
        completionPercent:
          totalPracticeItems > 0
            ? Math.round((completedPracticeCount / totalPracticeItems) * 100)
            : 0,
      };
    });

    // 🔢 Sort: "宿舍入住" pinned first, then unlocked, then locked
    fullList.sort((a, b) => {
      // "宿舍入住" always first
      const aIsDorm = a.title === '宿舍入住' ? 0 : 1
      const bIsDorm = b.title === '宿舍入住' ? 0 : 1
      if (aIsDorm !== bIsDorm) return aIsDorm - bIsDorm
      // Unlocked (not locked) before locked
      const aLocked = a.isLocked ? 1 : 0
      const bLocked = b.isLocked ? 1 : 0
      if (aLocked !== bLocked) return aLocked - bLocked
      return 0
    })

    // Paginate
    const list = fullList.slice((page - 1) * pageSize, page * pageSize)

    return {
      list,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取用户正在学习/已完成的单元列表（有进度记录的）
   */
  async getMyLearningUnits(userId: string) {
    const progresses = await this.prisma.userSceneProgress.findMany({
      where: { userId },
      include: {
        scene: {
          include: {
            category: { select: { name: true } },
            _count: { select: { trainingTopics: true, storyEpisodes: true } },
            trainingTopics: {
              select: {
                id: true,
                type: true,
                title: true,
                difficulty: true,
                metadata: true,
                suggestedDurationSec: true,
                _count: { select: { activeChunks: true, topicVocabs: true } },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const sceneIds = progresses.map((progress) => progress.sceneId);
    const completedWarmupItemIdsByScene = await this.getCompletedWarmupItemIdsByScene(userId, sceneIds);

    return progresses.map((p) => {
      const scene = p.scene;
      // Compute totals from topics
      let vocabCount = 0;
      let chunkCount = 0;
      for (const t of scene.trainingTopics) {
        vocabCount += (t as any)._count?.topicVocabs ?? 0;
        chunkCount += (t as any)._count?.activeChunks ?? 0;
      }
      const warmupItemIds = this.buildWarmupPracticeItemIds(scene.id, scene.trainingTopics);
      const completedWarmupItemIds = completedWarmupItemIdsByScene.get(scene.id) ?? new Set<string>();
      const completedPracticeCount = warmupItemIds.filter((itemId) => completedWarmupItemIds.has(itemId)).length;
      const totalPracticeItems = warmupItemIds.length;
      const completionPercent = totalPracticeItems > 0 ? Math.round((completedPracticeCount / totalPracticeItems) * 100) : 0;

      return {
        id: scene.id,
        packageType: scene.packageType,
        title: scene.title,
        location: scene.location,
        description: scene.description,
        categoryName: scene.category.name,
        topics: scene.trainingTopics.map((t) => ({
          id: t.id,
          type: t.type,
          title: t.title,
          difficulty: t.difficulty,
          metadata: t.metadata,
          suggestedDurationSec: t.suggestedDurationSec,
        })),
        vocabCount,
        chunkCount,
        topicCount: scene._count.trainingTopics,
        scriptCount: scene._count.storyEpisodes,
        progress: {
          readiness: p.readiness,
          mastery: p.mastery,
          vocabLearned: p.vocabLearned,
          vocabTotal: vocabCount,
          chunkMastered: p.chunkMastered,
          chunkTotal: chunkCount,
          completedPracticeCount,
          totalPracticeCount: totalPracticeItems,
          completedScriptCount: p.completedScriptCount,
        },
        completionPercent,
      };
    });
  }

  /**
   * 获取某个学习单元的完整顺序内容
   */
  async getLearningUnitDetail(userId: string, unitId: string) {
    await this.assertLearningPackAccess(userId, unitId, { allowExistingProgress: true });
    const scene = await this.prisma.scene.findUnique({
      where: { id: unitId },
      include: {
        trainingTopics: {
          orderBy: { sortOrder: 'asc' },
          include: {
            topicPatterns: {
              include: { pattern: true },
              orderBy: { sortOrder: 'asc' },
            },
            topicVocabs: {
              include: { vocab: true },
              orderBy: { sortOrder: 'asc' },
            },
            activeChunks: {
              include: {
                chunk: {
                  include: { examples: { orderBy: { sortOrder: 'asc' } } },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        storyEpisodes: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: {
            id: true,
            title: true,
            chapterName: true,
            sortOrder: true,
            description: true,
            requiredOutputLevel: true,
          },
        },
        prerequisiteScenes: {
          include: { prerequisite: true },
        },
        userProgresses: {
          where: { userId },
          take: 1,
        },
        category: true,
      },
    });

    if (!scene) return null;

    // 从 topics 中提取所有词汇（去重）
    const vocabMap = new Map<string, any>();
    const chunkMap = new Map<string, any>();
    const sentencePatterns: any[] = [];

    for (const topic of scene.trainingTopics) {
      for (const tv of topic.topicVocabs) {
        const v = tv.vocab;
        if (!vocabMap.has(v.id)) {
          vocabMap.set(v.id, {
            id: v.id,
            word: v.word,
            meaning: v.meaning,
            partOfSpeech: v.partOfSpeech,
            phoneticUs: v.phoneticUs,
            phoneticUk: v.phoneticUk,
            audioUsUrl: v.audioUsUrl,
            audioUkUrl: v.audioUkUrl,
            definitionEn: v.definitionEn,
            synonyms: v.synonyms,
            examples: v.examples,
            description: v.description,
            difficulty: v.difficulty,
          });
        }
      }
      for (const ac of topic.activeChunks) {
        const c = ac.chunk;
        if (!chunkMap.has(c.id)) {
          chunkMap.set(c.id, {
            id: c.id,
            text: c.text,
            meaning: c.meaning,
            description: c.description,
            category: c.category,
            difficulty: c.difficulty,
            examples: c.examples,
          });
        }
      }
      for (const tp of topic.topicPatterns) {
        sentencePatterns.push({
          ...tp.pattern,
          topicId: topic.id,
          topicTitle: topic.title,
        });
      }
    }

    const vocabularies = [...vocabMap.values()];
    const chunks = [...chunkMap.values()];

    // 用户 chunk 进度
    const chunkIds = chunks.map((c) => c.id);
    const chunkProgresses = chunkIds.length > 0
      ? await this.prisma.userChunkProgress.findMany({
          where: { userId, chunkId: { in: chunkIds } },
        })
      : [];
    const chunkProgressMap = new Map(chunkProgresses.map((p) => [p.chunkId, p]));

    // 场景掌握度
    const progress = scene.userProgresses[0] ?? null;
    const warmupItemIds = this.buildWarmupPracticeItemIds(scene.id, scene.trainingTopics);
    const completedWarmupItemIdsByScene = await this.getCompletedWarmupItemIdsByScene(userId, [scene.id]);
    const completedWarmupItemIds = completedWarmupItemIdsByScene.get(scene.id) ?? new Set<string>();
    const completedPracticeCount = warmupItemIds.filter((itemId) => completedWarmupItemIds.has(itemId)).length;
    const totalPracticeCount = warmupItemIds.length;

    return {
      id: scene.id,
      packageType: scene.packageType,
      title: scene.title,
      location: scene.location,
      description: scene.description,
      category: scene.category.name,
      requiredOutputLevel: scene.requiredOutputLevel,
      requiredUserLevel: scene.requiredUserLevel,
      prerequisites: scene.prerequisiteScenes.map((ps) => ({
        id: ps.prerequisite.id,
        title: ps.prerequisite.title,
      })),

      progress: progress
        ? {
            readiness: progress.readiness,
            mastery: progress.mastery,
            vocabLearned: progress.vocabLearned,
            vocabTotal: progress.vocabTotal,
            chunkMastered: progress.chunkMastered,
            chunkTotal: progress.chunkTotal,
            completedPracticeCount,
            totalPracticeCount,
            completedScriptCount: progress.completedScriptCount,
          }
        : null,

      // 顺序学习内容
      vocabularies: vocabularies.map((v) => ({
        id: v.id,
        word: v.word,
        meaning: v.meaning,
        partOfSpeech: v.partOfSpeech,
        phoneticUs: v.phoneticUs,
        phoneticUk: v.phoneticUk,
        audioUsUrl: v.audioUsUrl,
        audioUkUrl: v.audioUkUrl,
        definitionEn: v.definitionEn,
        synonyms: v.synonyms,
        examples: v.examples,
        description: v.description,
        difficulty: v.difficulty,
      })),

      chunks: chunks.map((c) => {
        const cp = chunkProgressMap.get(c.id);
        return {
          id: c.id,
          text: c.text,
          meaning: c.meaning,
          description: c.description,
          category: c.category,
          difficulty: c.difficulty,
          masteryStatus: cp?.status ?? 'not_learned',
          examples: c.examples.map((e: any) => ({
            en: e.en,
            zh: e.zh,
            note: e.note,
            level: e.level,
          })),
        };
      }),

      sentencePatterns,

      trainingTopics: scene.trainingTopics.map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        promptEn: t.promptEn,
        promptZh: t.promptZh,
        difficulty: t.difficulty,
        metadata: t.metadata,
        suggestedDurationSec: t.suggestedDurationSec,
        activeChunks: t.activeChunks.map((ac) => ({
          id: ac.chunk.id,
          text: ac.chunk.text,
          meaning: ac.chunk.meaning,
        })),
      })),

      // 关联的剧本入口
      firstEpisode: scene.storyEpisodes[0]
        ? {
            ...scene.storyEpisodes[0],
            chapterTitle: scene.storyEpisodes[0].chapterName,
            episodeOrder: scene.storyEpisodes[0].sortOrder,
          }
        : null,

      // 元信息
      vocabCount: vocabularies.length,
      chunkCount: chunks.length,
      topicCount: scene.trainingTopics.length,
      scriptCount: scene.storyEpisodes.length,
    };
  }

  async getOfflineManifest(userId: string, unitId: string) {
    await this.assertLearningPackAccess(userId, unitId, { allowExistingProgress: true });
    const unitDetail = await this.getLearningUnitDetail(userId, unitId);
    if (!unitDetail) return null;

    const topics = await this.prisma.trainingTopic.findMany({
      where: { sceneId: unitId },
      orderBy: { sortOrder: 'asc' },
      include: {
        inkScript: {
          select: { id: true, key: true, title: true, inkJson: true, inkSource: true, version: true, updatedAt: true },
        },
        topicPatterns: { include: { pattern: true }, orderBy: { sortOrder: 'asc' } },
        topicVocabs: { include: { vocab: true }, orderBy: { sortOrder: 'asc' } },
        activeChunks: {
          include: {
            chunk: { include: { examples: { orderBy: { sortOrder: 'asc' } } } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // ── Scene visual assets (shared across all topics, store once at unit level) ──
    const gameLocation = await this.prisma.gameLocation.findFirst({
      where: { sceneId: unitId },
      select: {
        backgroundUrl: true,
        bgmUrl: true,
        ambientUrl: true,
        rooms: {
          select: {
            npcs: {
              include: {
                character: {
                  select: {
                    id: true, name: true, displayName: true,
                    avatarUrl: true, spriteBaseUrl: true,
                    expressions: true, defaultPosition: true,
                  },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    const allNpcs = gameLocation?.rooms.flatMap((r) => r.npcs) ?? [];
    const fallbackCharacters = allNpcs.length
      ? []
      : await this.prisma.gameCharacter.findMany({
          select: {
            id: true, name: true, displayName: true,
            avatarUrl: true, spriteBaseUrl: true,
            expressions: true, defaultPosition: true,
          },
          orderBy: { name: 'asc' },
        });
    const sceneCharacters = allNpcs.length
      ? allNpcs.map((npc) => npc.character)
      : fallbackCharacters;

    // Attach scene to unitDetail (one copy, not repeated per topic)
    (unitDetail as any).scene = {
      id: unitDetail.id,
      title: unitDetail.title,
      location: unitDetail.location,
      category: unitDetail.category,
      backgroundUrl: gameLocation?.backgroundUrl ?? null,
      characters: sceneCharacters.map((c) => ({
        id: c.id,
        name: c.name,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
        spriteBaseUrl: c.spriteBaseUrl,
        expressions: c.expressions,
        defaultPosition: (c.defaultPosition as 'left' | 'center' | 'right') ?? 'center',
      })),
    };

    // ── Collect asset URLs from per-topic data (vocabs audio) + unit-level (scene/characters) ──
    const assets: any[] = [];
    this.pushAsset(assets, gameLocation?.backgroundUrl, 'background');
    this.pushAsset(assets, gameLocation?.bgmUrl, 'bgm');
    this.pushAsset(assets, gameLocation?.ambientUrl, 'sfx');
    for (const character of sceneCharacters) {
      this.pushAsset(assets, character.avatarUrl, 'thumbnail');
      this.pushAsset(assets, character.spriteBaseUrl, 'sprite');
      const exps = character.expressions && typeof character.expressions === 'object'
        ? Object.values(character.expressions as Record<string, unknown>)
        : [];
      for (const expr of exps) {
        if (typeof expr === 'string') this.pushAsset(assets, expr, 'sprite');
      }
    }

    // ── topicDetails: per-topic data (each topic has its own vocabs & activeChunks) ──
    const topicDetails = topics.map((topic) => {
      // ── Collect warmup pipeline image assets; audio URLs are cached lazily on first play. ──
      const outputTraining = (topic.metadata as any)?.outputTraining;
      if (outputTraining?.pipeline && Array.isArray(outputTraining.pipeline)) {
        for (const step of outputTraining.pipeline) {
          // Collect per-item audioUrl + imageUrl from chunk_substitution / pattern_drill
          if (step.items && Array.isArray(step.items)) {
            for (const item of step.items) {
              if (typeof item.imageUrl === 'string') this.pushAsset(assets, item.imageUrl, 'warmup_image');
            }
          }
          // Collect per-pattern-item audioUrl + imageUrl from vocab_sentence_building
          if (step.patterns && Array.isArray(step.patterns)) {
            for (const pattern of step.patterns) {
              if (pattern.items && Array.isArray(pattern.items)) {
                for (const item of pattern.items) {
                  if (typeof item.imageUrl === 'string') this.pushAsset(assets, item.imageUrl, 'warmup_image');
                }
              }
            }
          }
        }
      }
      return {
        topic: {
          id: topic.id,
          title: topic.title,
          promptEn: topic.promptEn,
          promptZh: topic.promptZh,
          difficulty: topic.difficulty,
          suggestedDurationSec: topic.suggestedDurationSec,
          description: topic.description,
          knowledgePoints: topic.knowledgePoints,
          teachingMarkdown: topic.teachingMarkdown,
          inkScriptId: topic.inkScriptId,
          metadata: topic.metadata,
        },
        inkScript: topic.inkScript
          ? {
              id: topic.inkScript.id,
              key: topic.inkScript.key,
              title: topic.inkScript.title,
              inkJson: topic.inkScript.inkJson,
              inkSource: topic.inkScript.inkSource,
              version: topic.inkScript.version,
            }
          : null,
        sentencePatterns: topic.topicPatterns.map((tp) => tp.pattern),
        vocabularies: topic.topicVocabs.map((tv) => tv.vocab),
        activeChunks: topic.activeChunks.map((tc) => ({
          id: tc.chunk.id,
          text: tc.chunk.text,
          meaning: tc.chunk.meaning,
          description: tc.chunk.description,
          examples: tc.chunk.examples,
          masteryStatus: 'not_learned' as const,
        })),
      };
    });

    // Strip derived data from unitDetail — frontend collects from topicDetails
    const { vocabularies: _v, chunks: _c, sentencePatterns: _sp, trainingTopics: _tt, ...leanUnitDetail } = unitDetail as any;

    const totalVocabs = topicDetails.reduce((sum, td) => sum + (td.vocabularies?.length ?? 0), 0);
    const totalChunks = topicDetails.reduce((sum, td) => sum + (td.activeChunks?.length ?? 0), 0);
    const versions = [
      ...topics.map((t) => t.inkScript?.version ?? 1),
      totalVocabs,
      totalChunks,
      unitDetail.sentencePatterns?.length ?? 0,
    ];
    const version = versions.reduce((sum, v) => sum + Number(v || 0), 1);

    // manifest IDs from per-topic data
    const allVocabIds = new Set<string>();
    const allChunkIds = new Set<string>();
    for (const td of topicDetails) {
      for (const v of td.vocabularies ?? []) allVocabIds.add(v.id);
      for (const c of td.activeChunks ?? []) allChunkIds.add(c.id);
    }

    return {
      manifest: {
        packId: unitDetail.id,
        version,
        title: unitDetail.title,
        updatedAt: new Date().toISOString(),
        units: [unitDetail.id],
        topics: topics.map((t) => t.id),
        vocabularies: [...allVocabIds],
        chunks: [...allChunkIds],
        sentencePatterns: unitDetail.sentencePatterns.map((item: any) => item.pattern),
        storyEpisodes: unitDetail.firstEpisode ? [unitDetail.firstEpisode.id] : [],
        inkScripts: topics.map((t) => t.inkScript?.id).filter(Boolean),
        assets,
      },
      unitDetail: leanUnitDetail,
      topicDetails,
    };
  }

  async buildLearningPackZip(userId: string, unitId: string, overrides?: { version?: number; title?: string }) {
    await this.assertLearningPackAccess(userId, unitId, { allowExistingProgress: true });
    const source = await this.getOfflineManifest(userId, unitId);
    if (!source) throw new NotFoundException('学习包不存在或已被删除，请刷新页面');
    const baseManifest = {
      ...source.manifest,
      version: overrides?.version ?? source.manifest.version,
      title: overrides?.title ?? source.manifest.title,
    };
    const zip = new AdmZip();
    const checksums: Record<string, string> = {};

    const addJson = (path: string, value: unknown) => {
      const buffer = jsonBuffer(value);
      zip.addFile(path, buffer);
      checksums[path] = sha256Buffer(buffer);
    };

    addJson('content/scene.json', source.unitDetail);

    const vocabIndex = new Map<string, any>();
    const chunkIndex = new Map<string, any>();
    const patternIndex = new Map<string, any>();

    for (const topicDetail of source.topicDetails ?? []) {
      const topicId = topicDetail?.topic?.id;
      if (!topicId) continue;
      addJson(`content/topics/${safeFilePart(topicId)}.json`, topicDetail);

      if (topicDetail.inkScript) {
        const key = topicDetail.inkScript.key || topicDetail.inkScript.id;
        addJson(`content/inks/${safeFilePart(key)}.json`, topicDetail.inkScript);
      }

      for (const vocab of topicDetail.vocabularies ?? []) {
        if (vocab?.id && !vocabIndex.has(vocab.id)) vocabIndex.set(vocab.id, vocab);
      }
      for (const chunk of (topicDetail as any).activeChunks ?? (topicDetail as any).chunks ?? []) {
        if (chunk?.id && !chunkIndex.has(chunk.id)) chunkIndex.set(chunk.id, chunk);
      }
      for (const pattern of topicDetail.sentencePatterns ?? []) {
        const key = pattern?.id ?? pattern?.pattern;
        if (key && !patternIndex.has(key)) patternIndex.set(key, pattern);
      }
    }

    addJson('content/indexes/vocab.json', [...vocabIndex.values()]);
    addJson('content/indexes/chunks.json', [...chunkIndex.values()]);
    addJson('content/indexes/patterns.json', [...patternIndex.values()]);

    const packagedAssets: any[] = [];
    const failedAssets: Array<{ url: string; reason: string }> = [];
    const assetPathBySha = new Map<string, string>();

    const assetList = (source.manifest.assets ?? []).filter((a: any) => a?.url && this.isPackagedAsset(a));
    const CONCURRENCY = 10;

    for (let i = 0; i < assetList.length; i += CONCURRENCY) {
      const batch = assetList.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (asset: any) => {
          const response = await fetch(asset.url);
          if (!response.ok) {
            return { asset, ok: false as const, reason: `HTTP ${response.status}` };
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const sha256 = sha256Buffer(buffer);
          const mimeType = response.headers.get('content-type')?.split(';')[0] ?? asset.mimeType ?? null;
          const ext = extensionFromUrl(asset.url) ?? extensionFromMime(mimeType) ?? 'bin';
          const role = safeFilePart(asset.role ?? 'misc');
          const path = `assets/${role}/${sha256}.${ext}`;

          return {
            asset,
            ok: true as const,
            buffer,
            sha256,
            mimeType,
            ext,
            role,
            path,
            size: buffer.byteLength,
          };
        }),
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          const err = result.reason;
          failedAssets.push({
            url: '',
            reason: err instanceof Error ? err.message : String(err),
          });
          continue;
        }

        const r = result.value;
        if (!r.ok) {
          failedAssets.push({ url: r.asset.url, reason: r.reason });
          continue;
        }

        const dedupPath = assetPathBySha.get(r.sha256) ?? r.path;
        if (!assetPathBySha.has(r.sha256)) {
          zip.addFile(dedupPath, r.buffer);
          checksums[dedupPath] = r.sha256;
          assetPathBySha.set(r.sha256, dedupPath);
        }

        packagedAssets.push({
          ...r.asset,
          path: dedupPath,
          sha256: r.sha256,
          mimeType: r.mimeType,
          size: r.size,
        });
      }
    }

    const manifest = {
      ...baseManifest,
      formatVersion: 1,
      contentRoot: 'content',
      generatedAt: new Date().toISOString(),
      assets: packagedAssets,
      failedAssets,
      files: checksums,
    };
    addJson('pack-manifest.json', manifest);
    addJson('checksums.json', checksums);

    const zipBuffer = zip.toBuffer();
    return {
      fileName: `${safeFilePart(baseManifest.packId)}-${baseManifest.version}.zip`,
      checksum: sha256Buffer(zipBuffer),
      manifest,
      buffer: zipBuffer,
    };
  }

  async getPublishedLearningPackage(unitId: string) {
    return (this.prisma as any).learningPackage.findFirst({
      where: {
        sceneId: unitId,
        status: 'published',
        fileAssetId: { not: null },
      },
      include: {
        fileAsset: true,
      },
      orderBy: { version: 'desc' },
    });
  }

  async getPublishedLearningPackageDownload(unitId: string) {
    const pack = await this.getPublishedLearningPackage(unitId);
    if (!pack?.fileAssetId) return null;
    const signed = await this.fileAssets.getPrivateUrlByAssetId(pack.fileAssetId);
    return {
      pack,
      url: signed.url,
      expiresInSeconds: signed.expiresInSeconds,
    };
  }

  async checkLearningPacks(userId: string, installed: Array<{ packId: string; version?: number }>) {
    console.log(`[learning-pack/check] checking ${installed.length} installed packs for user ${userId}`)
    const updates: any[] = [];
    for (const pack of installed ?? []) {
      if (!pack?.packId) continue;
      try {
        const published = await this.getPublishedLearningPackage(pack.packId);
        if (!published) {
          console.log(`[learning-pack/check]   ${pack.packId.slice(-8)}: no published version, skip`)
          continue;
        }

        const latestVersion = published.version;
        const currentVersion = Number(pack.version ?? 0);
        if (latestVersion <= currentVersion) {
          console.log(`[learning-pack/check]   ${pack.packId.slice(-8)}: up to date (v${currentVersion})`)
          continue;
        }

        const versionSpan = latestVersion - currentVersion;

        // V2: 检查是否有直接 delta（当前版本 → 最新版本）
        const delta = versionSpan === 1
          ? await (this.prisma as any).deltaPackage.findUnique({
              where: { packId_fromVersion_toVersion: { packId: published.id, fromVersion: currentVersion, toVersion: latestVersion } },
              include: { fileAsset: { select: { id: true, size: true } } },
            })
          : null;

        // 降级判断
        const manifestSnapshot = published.manifestSnapshot as any;
        const totalFiles = Object.keys(manifestSnapshot?.files ?? {}).length;

        // 如果跨度 <= 3 且有 delta，走增量
        const canDelta = delta && versionSpan <= 3;

        const update: any = {
          packId: pack.packId,
          fromVersion: currentVersion,
          toVersion: latestVersion,
          updateType: canDelta ? 'delta' : 'full',
          title: published.title,
          updatedAt: published.updatedAt?.toISOString(),
        };

        if (canDelta) {
          const signedUrl = await this.fileAssets.getPrivateUrlByAssetId(delta.fileAsset.id);
          update.deltaSize = delta.fileAsset.size;
          update.deltaSizeHuman = `${(delta.fileAsset.size / 1024 / 1024).toFixed(1)} MB`;
          update.deltaDownloadUrl = signedUrl.url;
          update.deltaChecksum = delta.deltaChecksum;
          update.savingPercent = totalFiles > 0
            ? Math.round((1 - (delta.addedCount + delta.modifiedCount) / totalFiles) * 100)
            : 0;
          console.log(`[learning-pack/check]   ${pack.packId.slice(-8)}: DELTA available v${currentVersion}→v${latestVersion}, ${update.deltaSizeHuman}, save ${update.savingPercent}%`)
        } else {
          const signedUrl = await this.fileAssets.getPrivateUrlByAssetId(published.fileAssetId!);
          update.fullDownloadUrl = signedUrl.url;
          update.fullSize = published.zipSize;
          update.fullSizeHuman = published.zipSize
            ? `${(published.zipSize / 1024 / 1024).toFixed(1)} MB`
            : null;
          update.zipChecksum = published.zipChecksum;
          if (versionSpan > 3) update.fallbackReason = 'version_gap_too_large';
          console.log(`[learning-pack/check]   ${pack.packId.slice(-8)}: FULL update v${currentVersion}→v${latestVersion}, span=${versionSpan}${versionSpan > 3 ? ' (fallback: too far)' : ''}`)
        }

        updates.push(update);
      } catch {
        // Ignore packs the user can no longer access or that no longer exist.
      }
    }
    console.log(`[learning-pack/check] result: ${updates.length} updates (${updates.filter(u => u.updateType === 'delta').length} delta)`)
    return { updates };
  }

  /** V2: 获取 delta 包下载信息 */
  async getDeltaPackage(unitId: string, fromVersion: number, toVersion: number) {
    const published = await this.getPublishedLearningPackage(unitId);
    if (!published) return null;

    const delta = await (this.prisma as any).deltaPackage.findUnique({
      where: {
        packId_fromVersion_toVersion: {
          packId: published.id,
          fromVersion,
          toVersion,
        },
      },
      include: { fileAsset: { select: { id: true, size: true } } },
    });
    if (!delta) return null;

    const signedUrl = await this.fileAssets.getPrivateUrlByAssetId(delta.fileAsset.id);
    return {
      url: signedUrl.url,
      checksum: delta.deltaChecksum,
      size: delta.fileAsset.size,
    };
  }

  /**
   * 更新学习单元进度
   */
  async updateUnitProgress(
    userId: string,
    unitId: string,
    data: {
      vocabLearned?: number;
      chunkMastered?: number;
      completedPractice?: boolean;
      completedScript?: boolean;
    },
  ) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: unitId },
      include: {
        _count: { select: { trainingTopics: true, storyEpisodes: true } },
        trainingTopics: {
          select: {
            _count: { select: { topicVocabs: true, activeChunks: true } },
          },
        },
      },
    });
    if (!scene) return null;

    const updateData: any = {};
    if (data.vocabLearned !== undefined) updateData.vocabLearned = data.vocabLearned;
    if (data.chunkMastered !== undefined) updateData.chunkMastered = data.chunkMastered;
    if (data.completedPractice) updateData.completedPracticeCount = { increment: 1 };
    if (data.completedScript) updateData.completedScriptCount = { increment: 1 };

    // Compute vocab/chunk totals from topics
    let totalVocab = 0;
    let totalChunks = 0;
    for (const t of scene.trainingTopics) {
      totalVocab += (t as any)._count?.topicVocabs ?? 0;
      totalChunks += (t as any)._count?.activeChunks ?? 0;
    }
    totalVocab = totalVocab || 1;
    totalChunks = totalChunks || 1;
    const totalPractices = scene._count.trainingTopics || 1;
    const totalScripts = scene._count.storyEpisodes || 1;

    const finalVocab = data.vocabLearned ?? (await this.getCurrentVocabLearned(userId, unitId));
    const finalChunk = data.chunkMastered ?? (await this.getCurrentChunkMastered(userId, unitId));

    const progressRecord = await this.prisma.userSceneProgress.upsert({
      where: { userId_sceneId: { userId, sceneId: unitId } },
      create: {
        userId,
        sceneId: unitId,
        ...updateData,
        readiness: Math.round((finalVocab / totalVocab) * 30 + (finalChunk / totalChunks) * 30),
        mastery: Math.round(
          (finalVocab / totalVocab) * 25 +
          (finalChunk / totalChunks) * 25 +
          ((data.completedPractice ? 1 : 0) / totalPractices) * 25 +
          ((data.completedScript ? 1 : 0) / totalScripts) * 25
        ),
      },
      update: {
        ...updateData,
        readiness: Math.round((finalVocab / totalVocab) * 30 + (finalChunk / totalChunks) * 30),
        mastery: Math.round(
          (finalVocab / totalVocab) * 25 +
          (finalChunk / totalChunks) * 25 +
          (1 / totalPractices) * 25 +
          (1 / totalScripts) * 25
        ),
      },
    });

    return progressRecord;
  }

  /**
   * 开始学习一个单元——创建进度记录（如果不存在），将其设为当前学习
   * 限制同时最多学习 MAX_CONCURRENT_UNITS 个单元
   */
  private readonly MAX_CONCURRENT_UNITS = 3;

  async startUnit(userId: string, unitId: string) {
    await this.assertLearningPackAccess(userId, unitId, { allowExistingProgress: true });
    const scene = await this.prisma.scene.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!scene) return null;

    // 检查是否已达到最大并行学习数
    const existingCount = await this.prisma.userSceneProgress.count({
      where: {
        userId,
        mastery: { lt: 100 },
      },
    });

    // 检查该单元是否已有进度（已学过的允许继续）
    const existing = await this.prisma.userSceneProgress.findUnique({
      where: { userId_sceneId: { userId, sceneId: unitId } },
    });

    if (!existing && existingCount >= this.MAX_CONCURRENT_UNITS) {
      throw new Error(`最多同时学习 ${this.MAX_CONCURRENT_UNITS} 个单元，请先完成当前单元`);
    }

    const record = await this.prisma.userSceneProgress.upsert({
      where: { userId_sceneId: { userId, sceneId: unitId } },
      create: {
        userId,
        sceneId: unitId,
        vocabLearned: 0,
        chunkMastered: 0,
        completedPracticeCount: 0,
        completedScriptCount: 0,
        readiness: 0,
        mastery: 0,
      },
      update: {},
    });

    return record;
  }

  /**
   * 退出学习——删除用户在该单元的进度记录
   */
  async quitUnit(userId: string, unitId: string) {
    await this.prisma.userSceneProgress.deleteMany({
      where: { userId, sceneId: unitId },
    });
    return { success: true };
  }

  private async getCurrentVocabLearned(userId: string, sceneId: string): Promise<number> {
    const progress = await this.prisma.userSceneProgress.findUnique({
      where: { userId_sceneId: { userId, sceneId } },
    });
    return progress?.vocabLearned ?? 0;
  }

  private async getCurrentChunkMastered(userId: string, sceneId: string): Promise<number> {
    const progress = await this.prisma.userSceneProgress.findUnique({
      where: { userId_sceneId: { userId, sceneId } },
    });
    return progress?.chunkMastered ?? 0;
  }
}
