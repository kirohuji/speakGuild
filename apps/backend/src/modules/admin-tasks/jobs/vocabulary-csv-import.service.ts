import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AdminTasksService } from '../admin-tasks.service';
import { DictionaryService } from '../../dictionary/dictionary.service';

interface CsvImportSummary {
  created: number;
  updated: number;
  skipped: number;
  enriched: number;
  total: number;
  errors: Array<{ word: string; message: string }>;
}

@Injectable()
export class VocabularyCsvImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminTasksService: AdminTasksService,
    private readonly dictionaryService: DictionaryService,
  ) {}

  async run(taskId: string, words: string[]) {
    if (!await this.adminTasksService.markRunning(taskId, 'write')) return;

    const uniqueWords = [...new Set(words.map(w => w.trim()).filter(Boolean))];
    let totalItems = uniqueWords.length;

    const summary: CsvImportSummary = {
      created: 0,
      updated: 0,
      skipped: 0,
      enriched: 0,
      total: totalItems,
      errors: [],
    };

    let processedItems = 0;
    let successItems = 0;
    let failedItems = 0;

    const updateProgress = async (currentStep: string) => {
      await this.adminTasksService.setProgress(taskId, {
        currentStep,
        totalItems,
        processedItems,
        successItems,
        failedItems,
      });
    };

    await this.adminTasksService.log(taskId, 'info', `开始导入 ${totalItems} 个词汇（阶段一：写入）`, {
      step: 'write',
      meta: { totalItems },
    });

    const vocabulariesToEnrich: string[] = [];

    // ---- Phase 1: Write ----
    for (const word of uniqueWords) {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      try {
        const existing = await this.prisma.vocabulary.findUnique({
          where: { word },
          select: { id: true, meaning: true },
        });

        if (existing) {
          if (existing.meaning && existing.meaning.trim()) {
            // Has meaning → skip
            summary.skipped++;
          } else {
            // Existing but incomplete records should be enriched as well.
            summary.updated++;
            vocabulariesToEnrich.push(word);
          }
        } else {
          // New word → create
          await this.prisma.vocabulary.create({
            data: { word, meaning: '', difficulty: 'L1' },
          });
          vocabulariesToEnrich.push(word);
          summary.created++;
        }

        successItems++;
      } catch (error: any) {
        failedItems++;
        const message = error?.message ?? 'unknown error';
        summary.errors.push({ word, message });
        await this.adminTasksService.log(taskId, 'error', `词汇 "${word}" 写入失败：${message}`, {
          step: 'write',
          meta: { word },
        });
      } finally {
        processedItems++;
        if (processedItems % 100 === 0) {
          await updateProgress('write');
        }
      }
    }

    await updateProgress('write');
    await this.adminTasksService.log(taskId, 'info', `阶段一完成：新建 ${summary.created}，跳过 ${summary.skipped}，已存在无释义 ${summary.updated}`, {
      step: 'write',
      meta: { created: summary.created, skipped: summary.skipped, updated: summary.updated },
    });

    // ---- Phase 2: AI Enrich newly created and incomplete words ----
    if (vocabulariesToEnrich.length > 0) {
      totalItems += vocabulariesToEnrich.length;
      await this.adminTasksService.log(taskId, 'info', `开始 AI 富化 ${vocabulariesToEnrich.length} 个词汇（阶段二）`, {
        step: 'enrich',
        meta: { count: vocabulariesToEnrich.length },
      });

      let enrichedCount = 0;
      for (let i = 0; i < vocabulariesToEnrich.length; i++) {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        const word = vocabulariesToEnrich[i];
        try {
          // DictionaryService first reads the fully enriched internal dictionary
          // cache; only a miss triggers the dictionary pipeline. It is the
          // canonical dictionary-to-vocabulary mapping used by the admin UI.
          const vocab = await this.prisma.vocabulary.findUnique({
            where: { word },
            select: { id: true, word: true },
          });
          if (!vocab) continue;

          const result = await this.dictionaryService.enrichVocabulary(vocab.id);
          if (result) {
            enrichedCount++;
            summary.enriched++;
          }

          successItems++;
        } catch (error: any) {
          failedItems++;
          const message = error?.message ?? 'unknown error';
          summary.errors.push({ word, message: `enrich: ${message}` });
          await this.adminTasksService.log(taskId, 'error', `词汇 "${word}" AI 富化失败：${message}`, {
            step: 'enrich',
            meta: { word },
          });
        } finally {
          processedItems++;
          if (processedItems % 10 === 0) {
            await updateProgress(`enrich: ${word} (${i + 1}/${vocabulariesToEnrich.length})`);
          }
        }
      }

      await updateProgress('enrich');
      await this.adminTasksService.log(taskId, 'info', `阶段二完成：富化成功 ${enrichedCount}/${vocabulariesToEnrich.length}`, {
        step: 'enrich',
        meta: { enriched: enrichedCount, total: vocabulariesToEnrich.length },
      });
    }

    await this.adminTasksService.markCompleted(taskId, {
      created: summary.created,
      updated: summary.updated,
      skipped: summary.skipped,
      enriched: summary.enriched,
      total: summary.total,
      errors: summary.errors.length > 0 ? summary.errors.slice(0, 20) : [],
    });

    await this.adminTasksService.log(taskId, 'info', `导入完成：新建 ${summary.created}，富化 ${summary.enriched}，跳过 ${summary.skipped}，更新 ${summary.updated}`, {
      step: 'completed',
      meta: summary,
    });
  }

}
