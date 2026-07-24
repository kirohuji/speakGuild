import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const NOTEBOOK_COLORS = ['ocean', 'forest', 'amber', 'rose', 'violet', 'slate'] as const;

@Injectable()
export class LearningNotebookService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureUncategorized(userId: string) {
    const existing = await this.prisma.learningNotebook.findFirst({
      where: { userId, kind: 'uncategorized', deletedAt: null },
    });
    if (existing) return existing;

    return this.prisma.learningNotebook.create({
      data: {
        userId,
        name: '未分类',
        kind: 'uncategorized',
        color: 'slate',
        sortOrder: -1,
      },
    });
  }

  async list(userId: string) {
    await this.ensureUncategorized(userId);
    const notebooks = await this.prisma.learningNotebook.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: {
          where: { deletedAt: null, expressionItem: { deletedAt: null } },
          select: { expressionItem: { select: { type: true } } },
        },
      },
    });

    const allCounts = { total: 0, word: 0, chunk: 0, pattern: 0 };
    const items = notebooks.map(({ items: notebookItems, ...notebook }) => {
      const counts = { total: notebookItems.length, word: 0, chunk: 0, pattern: 0 };
      for (const item of notebookItems) {
        if (item.expressionItem.type === 'word') counts.word += 1;
        else if (item.expressionItem.type === 'chunk') counts.chunk += 1;
        else counts.pattern += 1;
      }
      allCounts.total += counts.total;
      allCounts.word += counts.word;
      allCounts.chunk += counts.chunk;
      allCounts.pattern += counts.pattern;
      return { ...notebook, counts };
    });

    return { items, allCounts };
  }

  async create(userId: string, rawName: string) {
    const name = this.normalizeName(rawName);
    await this.assertNameAvailable(userId, name);
    const count = await this.prisma.learningNotebook.count({
      where: { userId, kind: 'custom', deletedAt: null },
    });
    return this.prisma.learningNotebook.create({
      data: {
        userId,
        name,
        sortOrder: count,
        color: NOTEBOOK_COLORS[count % NOTEBOOK_COLORS.length],
      },
    });
  }

  async rename(userId: string, id: string, rawName: string) {
    const notebook = await this.getOwned(userId, id);
    if (notebook.kind !== 'custom') throw new BadRequestException('系统学习本不能修改名称');
    const name = this.normalizeName(rawName);
    await this.assertNameAvailable(userId, name, id);
    return this.prisma.learningNotebook.update({ where: { id }, data: { name } });
  }

  async remove(userId: string, id: string) {
    const notebook = await this.getOwned(userId, id);
    if (notebook.kind !== 'custom') throw new BadRequestException('系统学习本不能删除');
    return this.prisma.$transaction(async (tx) => {
      await tx.learningNotebookItem.updateMany({
        where: { notebookId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return tx.learningNotebook.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  async setExpressionNotebooks(userId: string, expressionItemId: string, notebookIds: string[]) {
    const expression = await this.prisma.expressionItem.findFirst({
      where: { id: expressionItemId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!expression) throw new NotFoundException('学习内容不存在');

    const targetIds = [...new Set(notebookIds)];
    if (targetIds.length === 0) {
      targetIds.push((await this.ensureUncategorized(userId)).id);
    }
    const ownedCount = await this.prisma.learningNotebook.count({
      where: { id: { in: targetIds }, userId, deletedAt: null },
    });
    if (ownedCount !== targetIds.length) throw new BadRequestException('包含无效的学习本');

    const existing = await this.prisma.learningNotebookItem.findMany({
      where: { expressionItemId, notebook: { userId } },
    });
    const existingByNotebook = new Map(existing.map((item) => [item.notebookId, item]));

    await this.prisma.$transaction([
      this.prisma.learningNotebookItem.updateMany({
        where: {
          expressionItemId,
          notebook: { userId },
          notebookId: { notIn: targetIds },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      }),
      ...targetIds.map((notebookId) => {
        const previous = existingByNotebook.get(notebookId);
        if (!previous) {
          return this.prisma.learningNotebookItem.create({
            data: { notebookId, expressionItemId },
          });
        }
        return this.prisma.learningNotebookItem.update({
          where: { id: previous.id },
          data: previous.deletedAt
            ? {
                deletedAt: null,
                masteryStatus: 'learning',
                reviewCount: 0,
                easeFactor: 2.5,
                lastReviewedAt: null,
                nextReviewAt: null,
              }
            : { deletedAt: null },
        });
      }),
    ]);
    return this.getExpressionNotebookIds(userId, expressionItemId);
  }

  async getExpressionNotebookIds(userId: string, expressionItemId: string) {
    const items = await this.prisma.learningNotebookItem.findMany({
      where: { expressionItemId, notebook: { userId, deletedAt: null }, deletedAt: null },
      select: { notebookId: true },
    });
    return { notebookIds: items.map((item) => item.notebookId) };
  }

  async getOwned(userId: string, id: string) {
    const notebook = await this.prisma.learningNotebook.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!notebook) throw new NotFoundException('学习本不存在');
    return notebook;
  }

  private normalizeName(value: string) {
    const name = String(value ?? '').trim();
    if (!name) throw new BadRequestException('学习本名称不能为空');
    if (name.length > 30) throw new BadRequestException('学习本名称不能超过 30 个字符');
    return name;
  }

  private async assertNameAvailable(userId: string, name: string, excludeId?: string) {
    const duplicate = await this.prisma.learningNotebook.findFirst({
      where: {
        userId,
        kind: 'custom',
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('已经有同名学习本');
  }
}
