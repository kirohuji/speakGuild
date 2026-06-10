import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  private pushAsset(assets: any[], url?: string | null, role?: string) {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;
    if (assets.some((asset) => asset.url === url)) return;
    assets.push({ url, role });
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

  /**
   * 获取全部教材分类标签列表（供筛选下拉使用）
   */
  async getTags() {
    const categories = await this.prisma.sceneCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { name: true, icon: true },
    });
    return categories;
  }

  /**
   * 获取全部「教材」（即 Scene）列表，附带用户进度。
   * 免费用户看到全部单元，但非免费单元标记为锁定。
   * @param tag    按分类名称过滤（可选）
   * @param search 按单元标题模糊搜索（可选）
   */
  async getLearningUnits(userId: string, tag?: string, search?: string, page = 1, pageSize = 20) {
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

    // 查询条件
    const sceneWhere: any = {};
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
        _count: { select: { trainingTopics: true, scriptEpisodes: true } },
        trainingTopics: {
          select: {
            id: true,
            title: true,
            difficulty: true,
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
    const passedPracticeTopicIdsByScene = await this.getPassedPracticeTopicIdsByScene(userId);

    // 查询用户等级/输出级别
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userLevel: true, outputLevel: true },
    });

    const fullList = allScenes.map((scene) => {
      const prog = progressMap.get(scene.id);
      const completedPracticeCount = passedPracticeTopicIdsByScene.get(scene.id)?.size ?? 0;
      // Compute totals from topics
      let vocabCount = 0;
      let chunkCount = 0;
      for (const t of scene.trainingTopics) {
        vocabCount += (t as any)._count?.topicVocabs ?? 0;
        chunkCount += (t as any)._count?.activeChunks ?? 0;
      }
      const totalItems =
        vocabCount + chunkCount + scene._count.trainingTopics;
      const completedItems =
        (prog?.vocabLearned ?? 0) +
        (prog?.chunkMastered ?? 0) +
        completedPracticeCount;

      const isUnlocked =
        (user?.userLevel ?? 1) >= scene.requiredUserLevel;

      return {
        id: scene.id,
        title: scene.title,
        location: scene.location,
        description: scene.description,
        categoryId: scene.category.id,
        categoryName: scene.category.name,
        categoryIcon: scene.category.icon,
        topics: scene.trainingTopics.map((t: any) => ({
          id: t.id,
          title: t.title,
          difficulty: t.difficulty,
          suggestedDurationSec: t.suggestedDurationSec,
        })),
        requiredOutputLevel: scene.requiredOutputLevel,
        requiredUserLevel: scene.requiredUserLevel,
        isFree: scene.isFree,
        isLocked: !isMember && !scene.isFree,
        isUnlocked,
        vocabCount,
        chunkCount,
        topicCount: scene._count.trainingTopics,
        scriptCount: scene._count.scriptEpisodes,
        progress: prog
          ? {
              readiness: prog.readiness,
              mastery: prog.mastery,
              vocabLearned: prog.vocabLearned,
              vocabTotal: vocabCount,
              chunkMastered: prog.chunkMastered,
              chunkTotal: chunkCount,
              completedPracticeCount,
              completedScriptCount: prog.completedScriptCount,
            }
          : null,
        completionPercent:
          totalItems > 0
            ? Math.round((completedItems / totalItems) * 100)
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
    const passedPracticeTopicIdsByScene = await this.getPassedPracticeTopicIdsByScene(userId);
    const progresses = await this.prisma.userSceneProgress.findMany({
      where: { userId },
      include: {
        scene: {
          include: {
            category: { select: { name: true } },
            _count: { select: { trainingTopics: true, scriptEpisodes: true } },
            trainingTopics: {
              select: {
                id: true,
                title: true,
                difficulty: true,
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

    return progresses.map((p) => {
      const scene = p.scene;
      const completedPracticeCount = passedPracticeTopicIdsByScene.get(scene.id)?.size ?? 0;
      // Compute totals from topics
      let vocabCount = 0;
      let chunkCount = 0;
      for (const t of scene.trainingTopics) {
        vocabCount += (t as any)._count?.topicVocabs ?? 0;
        chunkCount += (t as any)._count?.activeChunks ?? 0;
      }
      const totalItems =
        vocabCount + chunkCount + scene._count.trainingTopics;
      const completedItems = p.vocabLearned + p.chunkMastered + completedPracticeCount;
      const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      return {
        id: scene.id,
        title: scene.title,
        location: scene.location,
        description: scene.description,
        categoryName: scene.category.name,
        topics: scene.trainingTopics.map((t) => ({
          id: t.id,
          title: t.title,
          difficulty: t.difficulty,
          suggestedDurationSec: t.suggestedDurationSec,
        })),
        vocabCount,
        chunkCount,
        topicCount: scene._count.trainingTopics,
        scriptCount: scene._count.scriptEpisodes,
        progress: {
          readiness: p.readiness,
          mastery: p.mastery,
          vocabLearned: p.vocabLearned,
          vocabTotal: vocabCount,
          chunkMastered: p.chunkMastered,
          chunkTotal: chunkCount,
          completedPracticeCount,
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
        scriptEpisodes: {
          orderBy: { episodeOrder: 'asc' },
          take: 1,
          select: {
            id: true,
            title: true,
            chapterTitle: true,
            episodeOrder: true,
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
    const passedPracticeTopicIdsByScene = await this.getPassedPracticeTopicIdsByScene(userId);
    const completedPracticeCount = passedPracticeTopicIdsByScene.get(scene.id)?.size ?? 0;

    return {
      id: scene.id,
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
        title: t.title,
        promptEn: t.promptEn,
        promptZh: t.promptZh,
        difficulty: t.difficulty,
        suggestedDurationSec: t.suggestedDurationSec,
        activeChunks: t.activeChunks.map((ac) => ({
          id: ac.chunk.id,
          text: ac.chunk.text,
          meaning: ac.chunk.meaning,
        })),
      })),

      // 关联的剧本入口
      firstEpisode: scene.scriptEpisodes[0] ?? null,

      // 元信息
      vocabCount: vocabularies.length,
      chunkCount: chunks.length,
      topicCount: scene.trainingTopics.length,
      scriptCount: scene.scriptEpisodes.length,
    };
  }

  async getOfflineManifest(userId: string, unitId: string) {
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

    const gameLocation = await this.prisma.gameLocation.findFirst({
      where: { sceneId: unitId },
      select: {
        backgroundUrl: true,
        bgmUrl: true,
        ambientUrl: true,
        npcs: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
                spriteBaseUrl: true,
                expressions: true,
                defaultPosition: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Fallback: 如果 GameLocation 没有绑定 NPC，直接从 GameCharacter 表取全部角色
    const fallbackCharacters = gameLocation?.npcs.length
      ? []
      : await this.prisma.gameCharacter.findMany({
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            spriteBaseUrl: true,
            expressions: true,
            defaultPosition: true,
          },
          orderBy: { name: 'asc' },
        });
    const sceneCharacters = gameLocation?.npcs.length
      ? gameLocation.npcs.map((npc) => npc.character)
      : fallbackCharacters;

    const assets: any[] = [];
    this.pushAsset(assets, gameLocation?.backgroundUrl, 'background');
    this.pushAsset(assets, gameLocation?.bgmUrl, 'bgm');
    this.pushAsset(assets, gameLocation?.ambientUrl, 'sfx');

    for (const character of sceneCharacters) {
      this.pushAsset(assets, character.avatarUrl, 'thumbnail');
      this.pushAsset(assets, character.spriteBaseUrl, 'sprite');
      const expressions = character.expressions && typeof character.expressions === 'object'
        ? Object.values(character.expressions as Record<string, unknown>)
        : [];
      for (const expression of expressions) {
        if (typeof expression === 'string') this.pushAsset(assets, expression, 'sprite');
      }
    }

    for (const vocab of unitDetail.vocabularies ?? []) {
      this.pushAsset(assets, vocab.audioUsUrl, 'voice');
      this.pushAsset(assets, vocab.audioUkUrl, 'voice');
    }

    const topicDetails = topics.map((topic) => ({
      topic: {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        knowledgePoints: topic.knowledgePoints,
        teachingMarkdown: topic.teachingMarkdown,
        promptEn: topic.promptEn,
        promptZh: topic.promptZh,
        suggestedDurationSec: topic.suggestedDurationSec,
        difficulty: topic.difficulty,
        sentencePatterns: topic.topicPatterns.map((tp) => tp.pattern),
        inkScriptId: topic.inkScriptId,
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
      scene: {
        id: unitDetail.id,
        title: unitDetail.title,
        location: unitDetail.location,
        category: unitDetail.category,
        backgroundUrl: gameLocation?.backgroundUrl ?? null,
        characters: sceneCharacters.map((character) => ({
          id: character.id,
          name: character.name,
          displayName: character.displayName,
          avatarUrl: character.avatarUrl,
          spriteBaseUrl: character.spriteBaseUrl,
          expressions: character.expressions,
          defaultPosition: (character.defaultPosition as 'left' | 'center' | 'right') ?? 'center',
        })),
      },
      vocabularies: topic.topicVocabs.map((tv) => tv.vocab),
      activeChunks: topic.activeChunks.map((tc) => ({
        id: tc.chunk.id,
        text: tc.chunk.text,
        meaning: tc.chunk.meaning,
        description: tc.chunk.description,
        examples: tc.chunk.examples,
        masteryStatus: 'not_learned',
      })),
    }));

    const versions = [
      ...topics.map((topic) => topic.inkScript?.version ?? 1),
      unitDetail.vocabularies?.length ?? 0,
      unitDetail.chunks?.length ?? 0,
      unitDetail.sentencePatterns?.length ?? 0,
    ];
    const version = versions.reduce((sum, value) => sum + Number(value || 0), 1);

    return {
      manifest: {
        packId: unitDetail.id,
        version,
        title: unitDetail.title,
        updatedAt: new Date().toISOString(),
        units: [unitDetail.id],
        topics: topics.map((topic) => topic.id),
        vocabularies: unitDetail.vocabularies.map((item) => item.id),
        chunks: unitDetail.chunks.map((item) => item.id),
        sentencePatterns: unitDetail.sentencePatterns.map((item) => item.pattern),
        scriptEpisodes: unitDetail.firstEpisode ? [unitDetail.firstEpisode.id] : [],
        inkScripts: topics.map((topic) => topic.inkScript?.id).filter(Boolean),
        assets,
      },
      unitDetail,
      topicDetails,
    };
  }

  /**
   * 生成今日任务
   */
  async getTodayTasks(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userLevel: true, outputLevel: true },
    });

    // 找到用户当前正在学习的场景（有进度但未完成的）
    const activeProgress = await this.prisma.userSceneProgress.findFirst({
      where: { userId, mastery: { lt: 100 } },
      orderBy: { updatedAt: 'desc' },
      include: { scene: true },
    });

    // 如果没有进行中的，取第一个可解锁的场景
    let currentScene;
    if (activeProgress) {
      currentScene = activeProgress.scene;
    } else {
      currentScene = await this.prisma.scene.findFirst({
        where: { requiredUserLevel: { lte: user?.userLevel ?? 1 } },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!currentScene) {
      return { tasks: [], currentUnit: null };
    }

    // 获取场景完整数据（通过 topics 计算）
    const sceneDetail = await this.getLearningUnitDetail(userId, currentScene.id);

    if (!sceneDetail) return { tasks: [], currentUnit: null };

    // 获取用户在该场景的进度
    const progress = await this.prisma.userSceneProgress.findUnique({
      where: { userId_sceneId: { userId, sceneId: currentScene.id } },
    });
    const passedPracticeTopicIdsByScene = await this.getPassedPracticeTopicIdsByScene(userId);

    // 将 sceneDetail 的 vocabularies/chunks 用于后续计算
    const vocabWords = sceneDetail.vocabularies.map((v: any) => v.word);
    const learnedVocabs = await this.prisma.expressionItem.findMany({
      where: { userId, type: 'chunk', chunkText: { in: vocabWords } },
      select: { chunkText: true },
    });
    const learnedVocabSet = new Set(learnedVocabs.map((v) => v.chunkText));

    // Chunk 进度
    const chunkIds = sceneDetail.chunks.map((c: any) => c.id);
    const chunkProgresses = await this.prisma.userChunkProgress.findMany({
      where: { userId, chunkId: { in: chunkIds } },
    });
    const chunkProgressMap = new Map(chunkProgresses.map((p) => [p.chunkId, p]));

    const vocabLearned = progress?.vocabLearned ?? 0;
    const chunkMastered = progress?.chunkMastered ?? 0;
    const completedPractice = passedPracticeTopicIdsByScene.get(currentScene.id)?.size ?? 0;

    // ---- 构建任务列表 ----
    const tasks: any[] = [];

    // ---- 每日限额 ----（管理员无限制）
    const adminCheck = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = adminCheck?.role === 'admin';
    const DAILY_VOCAB_LIMIT = isAdmin ? 999 : 5;
    const DAILY_CHUNK_LIMIT = isAdmin ? 999 : 3;
    const DAILY_PRACTICE_LIMIT = isAdmin ? 999 : 3;

    // 任务1: 学习词汇（每日限额 5 个）
    const unlearnedVocabs = sceneDetail.vocabularies.filter(
      (v) => !learnedVocabSet.has(v.word),
    );
    const dailyVocabs = unlearnedVocabs.slice(0, DAILY_VOCAB_LIMIT);
    if (unlearnedVocabs.length > 0) {
      tasks.push({
        id: `vocab-${currentScene.id}`,
        type: 'vocab',
        title: '今日词汇',
        description: dailyVocabs.length < unlearnedVocabs.length
          ? `今日 ${dailyVocabs.length} 个 · 共 ${unlearnedVocabs.length} 个待学`
          : `${unlearnedVocabs.length} 个词汇`,
        count: unlearnedVocabs.length,
        dayCount: dailyVocabs.length,
        done: sceneDetail.vocabularies.length - unlearnedVocabs.length,
        total: sceneDetail.vocabularies.length,
        hasMore: unlearnedVocabs.length > DAILY_VOCAB_LIMIT,
        unitId: currentScene.id,
        unitTitle: currentScene.title,
        data: dailyVocabs,
      });
    }

    // 任务2: 学习 Chunk（每日限额 3 个）
    const unlearnedChunks = sceneDetail.chunks.filter((c) => {
      const cp = chunkProgressMap.get(c.id);
      return !cp || cp.status === 'not_learned';
    });
    const dailyChunks = unlearnedChunks.slice(0, DAILY_CHUNK_LIMIT);
    if (unlearnedChunks.length > 0 || chunkMastered < sceneDetail.chunks.length) {
      const mastered = sceneDetail.chunks.filter((c) => {
        const cp = chunkProgressMap.get(c.id);
        return cp?.status === 'mastered' || cp?.status === 'can_output';
      }).length;
      tasks.push({
        id: `chunk-${currentScene.id}`,
        type: 'chunk',
        title: '今日表达',
        description: dailyChunks.length < unlearnedChunks.length
          ? `今日 ${dailyChunks.length} 个 · 共 ${unlearnedChunks.length} 个待学`
          : unlearnedChunks.length > 0
            ? `${unlearnedChunks.length} 个 Chunk`
            : '全部 Chunk 已掌握，继续复习保持熟练度',
        count: unlearnedChunks.length,
        dayCount: dailyChunks.length,
        done: mastered,
        total: sceneDetail.chunks.length,
        hasMore: unlearnedChunks.length > DAILY_CHUNK_LIMIT,
        unitId: currentScene.id,
        unitTitle: currentScene.title,
        data: dailyChunks.map((c) => ({
          id: c.id,
          text: c.text,
          meaning: c.meaning,
        })),
      });
    }

    // 任务3: 开口练习（每日限额 3 个）
    const passedPracticeTopicIds = passedPracticeTopicIdsByScene.get(currentScene.id) ?? new Set<string>();
    const uncompletedTopics = sceneDetail.trainingTopics.filter(
      (topic) => !passedPracticeTopicIds.has(topic.id),
    );
    const dailyPractices = uncompletedTopics.slice(0, DAILY_PRACTICE_LIMIT);
    for (const topic of dailyPractices) {
      tasks.push({
        id: `practice-${topic.id}`,
        type: 'practice',
        title: topic.title,
        description: topic.promptZh.slice(0, 60),
        durationSec: topic.suggestedDurationSec,
        unitId: currentScene.id,
        unitTitle: currentScene.title,
        topicId: topic.id,
        topicTitle: topic.title,
        promptZh: topic.promptZh,
      });
    }

    // 任务4: 剧本挑战（如果词汇和 chunk 掌握足够）
    if (
      sceneDetail.firstEpisode &&
      vocabLearned >= sceneDetail.vocabularies.length * 0.7
    ) {
      const ep = sceneDetail.firstEpisode;
      tasks.push({
        id: `script-${ep.id}`,
        type: 'script',
        title: '剧本挑战',
        description: `${ep.chapterTitle} — ${ep.title}`,
        unitId: currentScene.id,
        unitTitle: currentScene.title,
        episodeId: ep.id,
        episodeTitle: ep.title,
      });
    }

    return {
      currentUnit: {
        id: currentScene.id,
        title: currentScene.title,
        location: currentScene.location,
        progress: progress
          ? {
              vocabLearned,
              vocabTotal: sceneDetail.vocabularies.length,
              chunkMastered,
              chunkTotal: sceneDetail.chunks.length,
              completedPractice,
              practiceTotal: sceneDetail.trainingTopics.length,
            }
          : null,
      },
      tasks,
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
        _count: { select: { trainingTopics: true, scriptEpisodes: true } },
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
    const totalScripts = scene._count.scriptEpisodes || 1;

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
