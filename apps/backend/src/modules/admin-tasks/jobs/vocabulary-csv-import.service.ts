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

  /**
   * 全量检查词汇表。中文释义可能是空字符串，也可能被错误写成纯英文；
   * 两种情况都视为缺失，避免只凭空值漏掉需要补全的数据。
   */
  async runMissingChineseMeaningEnrich(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'scan')) return;

    const candidates: Array<{ id: string; word: string }> = [];
    let cursor: string | undefined;
    let scanned = 0;
    const totalToScan = await this.prisma.vocabulary.count();

    await this.adminTasksService.log(taskId, 'info', `开始检查全部 ${totalToScan} 个词汇的中文释义`, { step: 'scan' });

    do {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const rows = await this.prisma.vocabulary.findMany({
        select: { id: true, word: true, meaning: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;

      for (const vocabulary of rows) {
        scanned++;
        if (!/[\u3400-\u9fff]/.test(vocabulary.meaning ?? '')) {
          candidates.push({ id: vocabulary.id, word: vocabulary.word });
        }
      }
      cursor = rows.at(-1)?.id;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'scan', totalItems: totalToScan, processedItems: scanned, successItems: scanned,
      });
    } while (cursor);

    await this.adminTasksService.log(taskId, 'info', `检查完成：共检查 ${scanned} 个词汇，发现 ${candidates.length} 个缺失中文释义`, {
      step: 'scan', meta: { scanned, missingChineseMeaning: candidates.length },
    });

    let enriched = 0;
    let failed = 0;
    const errors: Array<{ id: string; word: string; message: string }> = [];

    // Scan-only is a successful no-op, while still leaving a useful audit result.
    if (candidates.length > 0) {
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'enrich', totalItems: candidates.length, processedItems: 0, successItems: 0, failedItems: 0,
      });
      await this.adminTasksService.log(taskId, 'info', `开始 AI 富化 ${candidates.length} 个词汇`, {
        step: 'enrich', meta: { count: candidates.length },
      });

      for (let index = 0; index < candidates.length; index++) {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        const vocabulary = candidates[index];
        try {
          const result = await this.dictionaryService.enrichVocabulary(vocabulary.id);
          if (!result || !/[\u3400-\u9fff]/.test(result.meaning ?? '')) {
            throw new Error('未能获取中文释义');
          }
          enriched++;
        } catch (error: any) {
          failed++;
          const message = error?.message ?? 'unknown error';
          errors.push({ id: vocabulary.id, word: vocabulary.word, message });
          await this.adminTasksService.log(taskId, 'error', `词汇 "${vocabulary.word}" AI 富化失败：${message}`, {
            step: 'enrich', meta: { id: vocabulary.id, word: vocabulary.word },
          });
        } finally {
          const processed = index + 1;
          if (processed % 10 === 0 || processed === candidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: 'enrich', totalItems: candidates.length, processedItems: processed,
              successItems: enriched, failedItems: failed,
            });
          }
        }
      }
    }

    const summary = {
      scanned,
      missingChineseMeaning: candidates.length,
      enriched,
      failed,
      errors: errors.slice(0, 20),
    };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `检查完成：检查 ${scanned}，需补全 ${candidates.length}，已富化 ${enriched}，失败 ${failed}`, {
      step: 'completed', meta: summary,
    });
  }

}
