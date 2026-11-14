import { mergeContentSnapshots } from '../../common/content-snapshot';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Receipts and state changes share a transaction: a lost response is safe to retry.
export async function applyNotebookMutation(tx: Prisma.TransactionClient, userId: string, item: {
  entityType: string; entityId: string; payload: any; clientMutationId?: string;
}) {
  if (!item.clientMutationId) throw new BadRequestException('clientMutationId is required');
  const key = { userId_clientMutationId: { userId, clientMutationId: item.clientMutationId } };
  const receipt = await tx.notebookSyncReceipt.findUnique({ where: key });
  if (receipt) return receipt.result as any;
  const p = item.payload;
  if (p?.ownerId && p.ownerId !== userId) throw new BadRequestException('Account changed');
  if (!p || typeof p.deleted !== 'boolean') throw new BadRequestException('Invalid notebook mutation');
  const predecessor = p.predecessor ? await tx.notebookSyncReceipt.findUnique({
    where: { userId_clientMutationId: { userId, clientMutationId: p.predecessor } },
  }) : null;
  if (p.predecessor && !predecessor) throw new ConflictException('前置操作尚未同步');
  const previous = predecessor?.result as any;
  const expected = previous?.remoteItem?.updatedAt ?? p.baseUpdatedAt;
  const expectedVersion = previous?.remoteItem?.version ?? p.baseVersion;
  const assertVersion = (row: { updatedAt: Date; version: number }) => {
    if (expectedVersion != null && row.version !== expectedVersion) throw new ConflictException('其他设备已修改此数据，本地修改已保留');
    if (expected && row.updatedAt.toISOString() !== new Date(expected).toISOString()) {
      throw new ConflictException('其他设备已修改此数据，本地修改已保留');
    }
  };
  let remoteItem: any;
  if (item.entityType === 'notebook') {
    if (p.ownerId && p.ownerId !== userId) throw new BadRequestException('Account changed');
    const id = previous?.remoteId ?? p.remoteId ?? item.entityId;
    let notebook = await tx.learningNotebook.findFirst({ where: { id, userId } });
    if (!notebook && p.kind === 'uncategorized') {
      notebook = await tx.learningNotebook.findFirst({ where: { userId, kind: 'uncategorized', deletedAt: null } });
    }
    const name = String(p.name ?? '').trim();
    if (!name || name.length > 30) throw new BadRequestException('学习本名称需为 1–30 个字符');
    if (notebook) {
      if (notebook.kind === 'uncategorized' && p.deleted) throw new BadRequestException('系统学习本不能删除');
      if (notebook.deletedAt) {
        if (!p.deleted) throw new ConflictException('学习本已在其他设备删除');
        remoteItem = notebook;
      } else {
        assertVersion(notebook);
        if (!p.deleted && notebook.name !== name && await tx.learningNotebook.count({ where: {
          userId, id: { not: notebook.id }, kind: 'custom', name: { equals: name, mode: 'insensitive' }, deletedAt: null,
        } })) throw new ConflictException('已经有同名学习本，本地修改已保留');
        remoteItem = await tx.learningNotebook.update({ where: { id: notebook.id }, data: {
          name, version: { increment: 1 }, ...(p.deleted ? { deletedAt: new Date() } : {}),
        } });
        if (p.deleted) await tx.learningNotebookItem.updateMany({ where: { notebookId: notebook.id, deletedAt: null }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      }
    } else {
      if (p.remoteId || p.baseUpdatedAt) throw new NotFoundException('学习本不存在');
      if (await tx.learningNotebook.count({ where: { userId, name: { equals: name, mode: 'insensitive' }, deletedAt: null } })) {
        throw new ConflictException('已经有同名学习本，本地学习本已保留');
      }
      remoteItem = await tx.learningNotebook.create({ data: {
        id, userId, name, kind: p.kind === 'uncategorized' ? 'uncategorized' : 'custom',
        ...(p.deleted ? { deletedAt: new Date() } : {}),
      } });
    }
  } else {
    const notebook = await tx.learningNotebook.findFirst({ where: { id: p.notebookId, userId } });
    if (!notebook) throw new NotFoundException('学习本尚未同步');
    if (notebook.deletedAt) {
      const result = { handled: true, remoteId: item.entityId, remoteItem: { id: item.entityId,
        deletedAt: notebook.deletedAt.toISOString(), updatedAt: notebook.updatedAt.toISOString(), superseded: true } };
      await tx.notebookSyncReceipt.create({ data: { userId, clientMutationId: item.clientMutationId!, result } });
      return result;
    }
    const e = p.entry;
    if (!e || !['word', 'chunk', 'pattern'].includes(e.kind) || typeof e.text !== 'string' || !e.text.trim()) throw new BadRequestException('Invalid expression');
    const type = e.kind === 'pattern' ? 'scene_phrase' : e.kind;
    let expression = await tx.expressionItem.findFirst({ where: { userId, type, ...(e.kind === 'word' ? { original: e.text } : { chunkText: e.text }) } });
    if (!expression) expression = await tx.expressionItem.create({ data: {
      userId, type, original: e.kind === 'word' ? e.text : e.meaning ?? e.original ?? '',
      chunkText: e.kind === 'word' ? e.meaning ?? '' : e.text, corrected: e.example ?? null,
      sceneName: e.sceneName ?? null, sourceType: e.sourceType ?? null, sourceId: e.sourceId ?? null,
      sourceSnapshot: e.sourceSnapshot ?? Prisma.JsonNull,
    } });
    if (!p.deleted && (expression.deletedAt || e.sourceSnapshot)) expression = await tx.expressionItem.update({ where: { id: expression.id }, data: {
      deletedAt: null,
      ...(e.sourceSnapshot && typeof e.sourceSnapshot === 'object' ? { sourceSnapshot: mergeContentSnapshots(expression.sourceSnapshot, e.sourceSnapshot) as Prisma.InputJsonValue } : {}),
      ...(!expression.sourceType && e.sourceType ? { sourceType: e.sourceType } : {}),
      ...(!expression.sourceId && e.sourceId ? { sourceId: e.sourceId } : {}),
    } });
    const where = { notebookId_expressionItemId: { notebookId: notebook.id, expressionItemId: expression.id } };
    const existing = await tx.learningNotebookItem.findUnique({ where });
    if (existing) assertVersion(existing);
    if (!['learning', 'reviewing', 'mastered', 'activated'].includes(p.masteryStatus)) throw new BadRequestException('Invalid mastery status');
    const data = { masteryStatus: p.intent === 'join' && existing && !existing.deletedAt ? existing.masteryStatus : p.masteryStatus, deletedAt: p.deleted ? new Date() : null };
    remoteItem = await tx.learningNotebookItem.upsert({ where,
      create: { notebookId: notebook.id, expressionItemId: expression.id, ...data },
      update: { ...data, version: { increment: 1 }, ...(!p.deleted && existing?.deletedAt ? { reviewCount: 0, intervalDays: 0, easeFactor: 2.5, lapseCount: 0, lastReviewedAt: null, nextReviewAt: null } : {}) },
      include: { expressionItem: true },
    });
  }
  const result = JSON.parse(JSON.stringify({ handled: true, remoteId: remoteItem.id, remoteItem }));
  await tx.notebookSyncReceipt.create({ data: { userId, clientMutationId: item.clientMutationId, result } });
  return result;
}
