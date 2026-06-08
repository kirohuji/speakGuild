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
    }[] = [];

    for (const item of items) {
      try {
        const result = await this.pushItem(userId, item);
        results.push({
          clientMutationId: item.clientMutationId,
          status: result.handled ? 'synced' : 'skipped',
          remoteId: result.remoteId,
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
  ): Promise<{ handled: boolean; remoteId?: string }> {
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
        const created = await this.prisma.expressionItem.create({
          data: {
            userId,
            type: 'word',
            original: word,
            chunkText: '',
          },
          select: { id: true },
        });
        return { handled: true, remoteId: created.id };
      }
      if (operation === 'delete') {
        const match = await this.prisma.expressionItem.findFirst({
          where: { userId, original: word, type: 'word' },
          select: { id: true },
        });
        if (match) {
          await this.prisma.expressionItem.delete({ where: { id: match.id } });
        }
        return { handled: true };
      }
    }

    // ---- 句块 ----
    if (entityType === 'chunk_entry') {
      const text = payload?.chunkText ?? payload?.original ?? entityId;

      if (operation === 'create') {
        const created = await this.prisma.expressionItem.create({
          data: {
            userId,
            type: 'chunk',
            original: payload?.original ?? '',
            chunkText: text,
            sceneName: payload?.sceneName,
          },
          select: { id: true },
        });
        return { handled: true, remoteId: created.id };
      }
      if (operation === 'delete') {
        const match = await this.prisma.expressionItem.findFirst({
          where: { userId, chunkText: text, type: 'chunk' },
          select: { id: true },
        });
        if (match) {
          await this.prisma.expressionItem.delete({ where: { id: match.id } });
        }
        return { handled: true };
      }
    }

    // ---- 句型 ----
    if (entityType === 'pattern_entry') {
      const pattern = payload?.pattern ?? entityId;

      if (operation === 'create') {
        const created = await this.prisma.expressionItem.create({
          data: {
            userId,
            type: 'scene_phrase',
            original: payload?.meaning ?? '',
            chunkText: pattern,
            corrected: payload?.example ?? pattern,
            sceneName: payload?.sceneName,
          },
          select: { id: true },
        });
        return { handled: true, remoteId: created.id };
      }
      if (operation === 'delete') {
        const match = await this.prisma.expressionItem.findFirst({
          where: { userId, chunkText: pattern, type: 'scene_phrase' },
          select: { id: true },
        });
        if (match) {
          await this.prisma.expressionItem.delete({ where: { id: match.id } });
        }
        return { handled: true };
      }
    }

    // practice_session / practice_turn / recording 走客户端单个 API，
    // 批量 push 暂不处理（需要填充 topicSnapshot 等必需字段）
    return { handled: false };
  }

  // ══════════════════════════════════════════════════
  // PULL: 增量拉取用户数据
  // ══════════════════════════════════════════════════

  async pull(userId: string, cursor: string | null) {
    const since = cursor ? new Date(cursor) : new Date(0);
    const newCursor = new Date().toISOString();

    const [
      expressionItems,
      sceneProgresses,
      chunkProgresses,
      practiceSessions,
    ] = await Promise.all([
      // ExpressionItem 只有 createdAt
      this.prisma.expressionItem.findMany({
        where: { userId, createdAt: { gt: since } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.userSceneProgress.findMany({
        where: { userId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.userChunkProgress.findMany({
        where: { userId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.practiceSession.findMany({
        where: { userId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
      }),
    ]);

    // PracticeTurn 没有直接 userId，通过 session 关联
    const practiceTurns = await this.prisma.practiceTurn.findMany({
      where: { session: { userId }, createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      cursor: newCursor,
      changed: {
        expressionItems,
        sceneProgresses,
        chunkProgresses,
        practiceSessions,
        practiceTurns,
      },
      deleted: {
        expressionItems: [] as string[],
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
    // - DictionaryEntry/SentencePattern 有 updatedAt → 用 updatedAt
    // - Scene/Chunk/TrainingTopic/ScriptEpisode 只有 createdAt → 用 createdAt
    // - Vocabulary 无时间戳 → 返回全量 ID（内容量可控）
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
      // Vocabulary 无时间戳，返回全量
      this.prisma.vocabulary.findMany({
        select: { id: true },
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
        vocabularies: vocabularies.map((v) => ({ id: v.id })),
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
