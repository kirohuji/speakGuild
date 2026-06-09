import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface OutboxItem {
  id?: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload: any;
  clientMutationId?: string;
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════
  // PUSH: 批量处理客户端离线变更
  // ══════════════════════════════════════════════════

  async push(userId: string, items: OutboxItem[]) {
    const results: {
      clientMutationId?: string;
      status: 'synced' | 'failed' | 'skipped';
      error?: string;
      remoteId?: string;
      remoteItem?: any;
    }[] = [];

    for (const item of items) {
      try {
        const result = await this.pushItem(userId, item);
        results.push({
          clientMutationId: item.clientMutationId,
          status: result.handled ? 'synced' : 'skipped',
          remoteId: result.remoteId,
          remoteItem: result.remoteItem,
        });
      } catch (error: any) {
        results.push({
          clientMutationId: item.clientMutationId,
          status: 'failed',
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return { results };
  }

  private async pushItem(
    userId: string,
    item: OutboxItem,
  ): Promise<{ handled: boolean; remoteId?: string; remoteItem?: any }> {
    const { entityType, entityId, operation, payload } = item;

    // ---- 学习单元 ----
    if (entityType === 'my_unit') {
      if (operation === 'create') {
        await this.prisma.userSceneProgress.upsert({
          where: { userId_sceneId: { userId, sceneId: entityId } },
          create: {
            userId,
            sceneId: entityId,
            vocabLearned: 0,
            chunkMastered: 0,
            completedPracticeCount: 0,
            completedScriptCount: 0,
            readiness: 0,
            mastery: 0,
          },
          update: {},
        });
        return { handled: true };
      }
      if (operation === 'delete') {
        await this.prisma.userSceneProgress.deleteMany({
          where: { userId, sceneId: entityId },
        });
        return { handled: true };
      }
    }

    // ---- 生词本 ----
    if (entityType === 'word_entry') {
      const word = payload?.word ?? entityId;

      if (operation === 'create') {
        const existing = await this.prisma.expressionItem.findFirst({
          where: { userId, type: 'word', original: word },
          select: { id: true },
        });
        const created = existing
          ? await this.prisma.expressionItem.update({
              where: { id: existing.id },
              data: { deletedAt: null },
            })
          : await this.prisma.expressionItem.create({
              data: { userId, type: 'word', original: word, chunkText: '' },
            });
        return { handled: true, remoteId: created.id, remoteItem: created };
      }
      if (operation === 'delete') {
        const match = await this.prisma.expressionItem.findFirst({
          where: { userId, original: word, type: 'word' },
          select: { id: true },
        });
        if (match) {
          await this.prisma.expressionItem.update({
            where: { id: match.id },
            data: { deletedAt: new Date() },
          });
        }
        return { handled: true };
      }
      if (operation === 'update') {
        const updated = await this.prisma.expressionItem.findFirst({
          where: { userId, original: word, type: 'word' },
          select: { id: true },
        });
        if (!updated) return { handled: true };
        const remoteItem = await this.prisma.expressionItem.update({
          where: { id: updated.id },
          data: {
            masteryStatus: payload?.masteryStatus,
            reviewCount: payload?.reviewCount,
            lastReviewedAt: payload?.lastReviewedAt ? new Date(payload.lastReviewedAt) : undefined,
            nextReviewAt: payload?.nextReviewAt ? new Date(payload.nextReviewAt) : undefined,
          },
        });
        return { handled: true, remoteId: remoteItem.id, remoteItem };
      }
    }

    // ---- 句块 ----
    if (entityType === 'chunk_entry') {
      const text = payload?.chunkText ?? payload?.original ?? entityId;

      if (operation === 'create') {
        const existing = await this.prisma.expressionItem.findFirst({
          where: { userId, type: 'chunk', chunkText: text },
          select: { id: true },
        });
        const created = existing
          ? await this.prisma.expressionItem.update({
              where: { id: existing.id },
              data: {
                deletedAt: null,
                original: payload?.original ?? '',
                sceneName: payload?.sceneName,
              },
            })
          : await this.prisma.expressionItem.create({
              data: {
                userId,
                type: 'chunk',
                original: payload?.original ?? '',
                chunkText: text,
                sceneName: payload?.sceneName,
              },
            });
        return { handled: true, remoteId: created.id, remoteItem: created };
      }
      if (operation === 'delete') {
        const match = await this.prisma.expressionItem.findFirst({
          where: { userId, chunkText: text, type: 'chunk' },
          select: { id: true },
        });
        if (match) {
          await this.prisma.expressionItem.update({
            where: { id: match.id },
            data: { deletedAt: new Date() },
          });
        }
        return { handled: true };
      }
      if (operation === 'update') {
        const updated = await this.prisma.expressionItem.findFirst({
          where: { userId, chunkText: text, type: 'chunk' },
          select: { id: true },
        });
        if (!updated) return { handled: true };
        const remoteItem = await this.prisma.expressionItem.update({
          where: { id: updated.id },
          data: {
            masteryStatus: payload?.masteryStatus,
            reviewCount: payload?.reviewCount,
            lastReviewedAt: payload?.lastReviewedAt ? new Date(payload.lastReviewedAt) : undefined,
            nextReviewAt: payload?.nextReviewAt ? new Date(payload.nextReviewAt) : undefined,
          },
        });
        return { handled: true, remoteId: remoteItem.id, remoteItem };
      }
    }

    // ---- 句型 ----
    if (entityType === 'pattern_entry') {
      const pattern = payload?.pattern ?? entityId;

      if (operation === 'create') {
        const existing = await this.prisma.expressionItem.findFirst({
          where: { userId, type: 'scene_phrase', chunkText: pattern },
          select: { id: true },
        });
        const created = existing
          ? await this.prisma.expressionItem.update({
              where: { id: existing.id },
              data: {
                deletedAt: null,
                original: payload?.meaning ?? '',
                corrected: payload?.example ?? pattern,
                sceneName: payload?.sceneName,
              },
            })
          : await this.prisma.expressionItem.create({
              data: {
                userId,
                type: 'scene_phrase',
                original: payload?.meaning ?? '',
                chunkText: pattern,
                corrected: payload?.example ?? pattern,
                sceneName: payload?.sceneName,
              },
            });
        return { handled: true, remoteId: created.id, remoteItem: created };
      }
      if (operation === 'delete') {
        const match = await this.prisma.expressionItem.findFirst({
          where: { userId, chunkText: pattern, type: 'scene_phrase' },
          select: { id: true },
        });
        if (match) {
          await this.prisma.expressionItem.update({
            where: { id: match.id },
            data: { deletedAt: new Date() },
          });
        }
        return { handled: true };
      }
      if (operation === 'update') {
        const updated = await this.prisma.expressionItem.findFirst({
          where: { userId, chunkText: pattern, type: 'scene_phrase' },
          select: { id: true },
        });
        if (!updated) return { handled: true };
        const remoteItem = await this.prisma.expressionItem.update({
          where: { id: updated.id },
          data: {
            masteryStatus: payload?.masteryStatus,
            reviewCount: payload?.reviewCount,
            lastReviewedAt: payload?.lastReviewedAt ? new Date(payload.lastReviewedAt) : undefined,
            nextReviewAt: payload?.nextReviewAt ? new Date(payload.nextReviewAt) : undefined,
          },
        });
        return { handled: true, remoteId: remoteItem.id, remoteItem };
      }
    }

    // ---- 练习会话 ----
    if (entityType === 'practice_session') {
      if (operation === 'create') {
        const topicId = payload?.topicId ?? entityId;
        const topic = await this.prisma.trainingTopic.findUnique({
          where: { id: topicId },
          include: {
            scene: true,
            activeChunks: { include: { chunk: true } },
            topicVocabs: { include: { vocab: true } },
            topicPatterns: { include: { pattern: true } },
          },
        });
        if (!topic) return { handled: false };

        const created = await this.prisma.practiceSession.create({
          data: {
            userId,
            topicId: topic.id,
            sceneId: topic.sceneId,
            status: 'active',
            topicSnapshot: {
              id: topic.id,
              title: topic.title,
              description: topic.description,
              difficulty: topic.difficulty,
              suggestedDurationSec: topic.suggestedDurationSec,
            },
            sceneSnapshot: {
              id: topic.scene.id,
              title: topic.scene.title,
              location: topic.scene.location,
            },
            objectivesSnapshot: [],
            chunksSnapshot: topic.activeChunks.map((tc) => ({
              id: tc.chunk.id,
              text: tc.chunk.text,
              meaning: tc.chunk.meaning,
            })),
            vocabSnapshot: topic.topicVocabs.map((tv) => ({
              id: tv.vocab.id,
              word: tv.vocab.word,
              meaning: tv.vocab.meaning,
            })),
            sentencePatternsSnapshot: topic.topicPatterns.map((tp) => ({
              id: tp.pattern.id,
              pattern: tp.pattern.pattern,
              meaning: tp.pattern.meaning,
            })),
            turnCount: 0,
          },
          select: { id: true },
        });
        return { handled: true, remoteId: created.id };
      }
      if (operation === 'update' && payload?.status === 'completed') {
        await this.prisma.practiceSession.updateMany({
          where: { id: entityId, userId },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });
        return { handled: true };
      }
    }

    // ---- 练习轮次 ----
    if (entityType === 'practice_turn') {
      if (operation === 'create') {
        const data = (payload?.data ?? payload) as any;
        const sessionId = data?.sessionId ?? payload?.sessionId;
        if (!sessionId) return { handled: false };

        // 检查 session 是否存在
        const session = await this.prisma.practiceSession.findFirst({
          where: { id: sessionId, userId },
          select: { id: true },
        });
        if (!session) return { handled: false };

        const lastTurn = await this.prisma.practiceTurn.findFirst({
          where: { sessionId },
          orderBy: { round: 'desc' },
          select: { round: true },
        });
        const nextRound = (lastTurn?.round ?? 0) + 1;

        const created = await this.prisma.practiceTurn.create({
          data: {
            sessionId,
            round: data?.round ?? nextRound,
            npcText: data?.npcText ?? '',
            userText: data?.userText ?? '',
            userAudioUrl: data?.userAudioUrl,
            inputNodeId: data?.inputNodeId,
            tags: data?.tags ?? [],
            judgement: data?.judgement ?? null,
            objectivesCompleted: data?.objectivesCompleted ?? [],
            chunksUsed: data?.chunksUsed ?? [],
          },
          select: { id: true },
        });

        await this.prisma.practiceSession.update({
          where: { id: sessionId },
          data: { turnCount: { increment: 1 } },
        });

        return { handled: true, remoteId: created.id };
      }
    }

    // recording 暂不处理（走客户端单个上传 API）
    return { handled: false };
  }

  // ══════════════════════════════════════════════════
  // PULL: 增量拉取用户数据（分页，每页最多 500 条）
  // ══════════════════════════════════════════════════

  private static readonly PULL_PAGE_SIZE = 500;

  async pull(userId: string, cursor: string | null) {
    const since = cursor ? new Date(cursor) : new Date(0);

    const [
      expressionItems,
      sceneProgresses,
      chunkProgresses,
      practiceSessions,
    ] = await Promise.all([
      this.prisma.expressionItem.findMany({
        where: { userId, updatedAt: { gt: since }, deletedAt: null },
        orderBy: { updatedAt: 'asc' },
        take: SyncService.PULL_PAGE_SIZE,
      }),
      this.prisma.userSceneProgress.findMany({
        where: { userId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
        take: SyncService.PULL_PAGE_SIZE,
      }),
      this.prisma.userChunkProgress.findMany({
        where: { userId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
        take: SyncService.PULL_PAGE_SIZE,
      }),
      this.prisma.practiceSession.findMany({
        where: { userId, updatedAt: { gt: since }, status: 'analyzed' },
        orderBy: { updatedAt: 'asc' },
        take: SyncService.PULL_PAGE_SIZE,
        select: {
          id: true,
          topicId: true,
          sceneId: true,
          inkScriptId: true,
          status: true,
          turnCount: true,
          analysisResult: true,
          analysisRaw: true,
          analysisError: true,
          startedAt: true,
          completedAt: true,
          analyzedAt: true,
          updatedAt: true,
        },
      }),
    ]);

    // PracticeTurn 没有直接 userId，通过 session 关联
    // const practiceTurns = await this.prisma.practiceTurn.findMany({
    //   where: { session: { userId }, createdAt: { gt: since } },
    //   orderBy: { createdAt: 'asc' },
    //   take: SyncService.PULL_PAGE_SIZE,
    // });

    const deletedExpressionItems = await this.prisma.expressionItem.findMany({
      where: { userId, deletedAt: { gt: since } },
      orderBy: { deletedAt: 'asc' },
      take: SyncService.PULL_PAGE_SIZE,
      select: { id: true, deletedAt: true },
    });

    // 计算下一页 cursor：取所有返回记录中最大的时间戳
    const timestamps: number[] = [];
    for (const e of expressionItems) timestamps.push(e.updatedAt.getTime());
    for (const s of sceneProgresses) timestamps.push(s.updatedAt.getTime());
    for (const c of chunkProgresses) timestamps.push(c.updatedAt.getTime());
    for (const s of practiceSessions) timestamps.push(s.updatedAt.getTime());
    // for (const t of practiceTurns) timestamps.push(t.createdAt.getTime());
    for (const e of deletedExpressionItems) {
      if (e.deletedAt) timestamps.push(e.deletedAt.getTime());
    }

    const nextCursor = timestamps.length > 0
      ? new Date(Math.max(...timestamps)).toISOString()
      : new Date().toISOString();

    // 任意一个结果集达到 pageSize 上限，说明还有更多数据
    const hasMore = [
      expressionItems, sceneProgresses, chunkProgresses,
      practiceSessions, deletedExpressionItems,
    ].some((arr) => arr.length >= SyncService.PULL_PAGE_SIZE);

    return {
      cursor: nextCursor,
      hasMore,
      changed: {
        expressionItems,
        sceneProgresses,
        chunkProgresses,
        practiceSessions,
        // practiceTurns,
      },
      deleted: {
        expressionItems: deletedExpressionItems.map((item) => item.id),
        sceneProgresses: [] as string[],
        chunkProgresses: [] as string[],
      },
    };
  }

  // ══════════════════════════════════════════════════
  // CONTENT MANIFEST: 公共内容增量
  // ══════════════════════════════════════════════════

  async getContentManifest(since: string | null) {
    const sinceDate = since ? new Date(since) : new Date(0);
    const version = Date.now();

    // 各模型时间戳情况不同：
    // - DictionaryEntry/SentencePattern/Vocabulary 有 updatedAt → 用 updatedAt
    // - Scene/Chunk/TrainingTopic/ScriptEpisode 只有 createdAt → 用 createdAt
    const [
      dictionaries,
      vocabularies,
      chunks,
      sentencePatterns,
      scenes,
      topics,
      scriptEpisodes,
    ] = await Promise.all([
      this.prisma.dictionaryEntry.findMany({
        where: { updatedAt: { gt: sinceDate } },
        select: { word: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
      }),
      // Vocabulary 有 updatedAt，按时间戳增量
      this.prisma.vocabulary.findMany({
        where: { updatedAt: { gt: sinceDate } },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.chunk.findMany({
        where: { createdAt: { gt: sinceDate } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.sentencePattern.findMany({
        where: { updatedAt: { gt: sinceDate } },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.scene.findMany({
        where: { createdAt: { gt: sinceDate } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.trainingTopic.findMany({
        where: { createdAt: { gt: sinceDate } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.scriptEpisode.findMany({
        where: { createdAt: { gt: sinceDate } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // 统一输出格式：{ id, updatedAt }
    return {
      version,
      generatedAt: new Date().toISOString(),
      changed: {
        dictionaries: dictionaries.map((d) => ({ id: d.word, updatedAt: d.updatedAt.toISOString() })),
        vocabularies: vocabularies.map((v) => ({ id: v.id, updatedAt: v.updatedAt.toISOString() })),
        chunks: chunks.map((c) => ({ id: c.id, updatedAt: c.createdAt.toISOString() })),
        sentencePatterns: sentencePatterns.map((s) => ({ id: s.id, updatedAt: s.updatedAt.toISOString() })),
        scenes: scenes.map((s) => ({ id: s.id, updatedAt: s.createdAt.toISOString() })),
        topics: topics.map((t) => ({ id: t.id, updatedAt: t.createdAt.toISOString() })),
        scriptEpisodes: scriptEpisodes.map((e) => ({ id: e.id, updatedAt: e.createdAt.toISOString() })),
      },
      deleted: {
        dictionaries: [] as string[],
        vocabularies: [] as string[],
        chunks: [] as string[],
        sentencePatterns: [] as string[],
        scenes: [] as string[],
        topics: [] as string[],
        scriptEpisodes: [] as string[],
      },
    };
  }
}
