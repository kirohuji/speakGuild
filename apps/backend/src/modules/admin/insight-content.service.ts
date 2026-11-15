import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminContentAiService } from './admin-content-ai.service';
import { FileAssetsService } from '../file-assets/file-assets.service';

@Injectable()
export class InsightContentService {
  constructor(private readonly prisma: PrismaService, private readonly ai: AdminContentAiService, private readonly assets: FileAssetsService) {}

  async regenerate(kind: string, id: string, field: string, userId: string) {
    if (!['word', 'chunk', 'pattern'].includes(kind) || !['description', 'examples'].includes(field)) {
      throw new BadRequestException('仅支持重新生成单词、句块、句型的讲解或例句');
    }
    const model = kind === 'word' ? this.prisma.vocabulary : kind === 'chunk' ? this.prisma.chunk : this.prisma.sentencePattern;
    const row: any = await (model as any).findUnique({ where: { id }, ...(kind === 'chunk' ? { include: { examples: true } } : {}) });
    if (!row) throw new NotFoundException('对应的内容不存在，请刷新后重试');
    const generated = await this.ai.regenerateLearningFields({
      kind: kind as 'word' | 'chunk' | 'pattern', text: row.word ?? row.text ?? row.pattern,
      meaning: row.meaning, description: row.description, examples: row.examples,
      definitions: (row.definitionEn ?? '').split('; ').filter(Boolean),
      fields: [field as 'description' | 'examples'],
    });
    let value: any = generated[field];
    return this.prisma.$transaction(async tx => {
      const delegate = kind === 'word' ? tx.vocabulary : kind === 'chunk' ? tx.chunk : tx.sentencePattern;
      const result = await (delegate as any).updateMany({ where: { id, updatedAt: row.updatedAt },
        data: kind === 'chunk' && field === 'examples' ? { updatedAt: new Date() } : { [field]: value },
      });
      if (!result.count) throw new ConflictException('内容已被其他操作修改，请刷新后重试');
      if (kind === 'chunk' && field === 'examples') {
        await tx.chunkExample.deleteMany({ where: { chunkId: id } });
        await tx.chunkExample.createMany({ data: value.map((e: any, sortOrder: number) => ({ ...e, chunkId: id, sortOrder })) });
        value = await tx.chunkExample.findMany({ where: { chunkId: id }, orderBy: { sortOrder: 'asc' } });
      }
      const saved: any = await (delegate as any).findUnique({ where: { id }, ...(kind === 'chunk' ? { include: { examples: true } } : {}) });
      await this.assets.syncPersistentAssetReferences(tx, userId,
        kind === 'word' ? 'vocabulary_asset' : kind === 'chunk' ? 'chunk_asset' : 'sentence_pattern_asset', id, saved);
      return { kind, id, field, updatedAt: saved.updatedAt, patch: { [field]: value } };
    });
  }
}
