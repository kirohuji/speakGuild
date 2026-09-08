import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AdminTasksService } from '../admin-tasks.service';
import { ContentPrepareService, createUsageStats, usageCallback, runConcurrent, AI_ENRICH_CONCURRENCY, type AiUsageStats } from './content-prepare.service';
import { AdminContentAiService } from '../../admin/admin-content-ai.service';
import { vocabularyMeaningMissingPosPrefix } from '../../admin/vocabulary-meaning.util';

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
    private readonly contentPrepareService: ContentPrepareService,
    private readonly adminContentAiService: AdminContentAiService,
  ) {}

  /** Copy the preferred UK/US pronunciation from managed dictionary entries. */
  async runDictionaryPronunciationSync(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'load-dictionary')) return;

    const vocabularies = await this.prisma.vocabulary.findMany({ select: { id: true, word: true } });
    const dictionaryWords = [...new Set(vocabularies.map((item) => item.word.trim().toLowerCase()).filter(Boolean))];
    await this.adminTasksService.setProgress(taskId, { currentStep: 'load-dictionary', totalItems: vocabularies.length });
    await this.adminTasksService.log(taskId, 'info', `开始同步 ${vocabularies.length} 个词汇的美式/英式音标和发音`, { step: 'load-dictionary' });

    const entries = [] as Array<{ word: string; pronunciations: unknown }>;
    for (let index = 0; index < dictionaryWords.length; index += 1_000) {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      entries.push(...await this.prisma.dictionaryEntry.findMany({
        where: { word: { in: dictionaryWords.slice(index, index + 1_000) } },
        select: { word: true, pronunciations: true },
      }));
    }
    const entryByWord = new Map(entries.map((entry) => [entry.word.toLowerCase(), entry]));
    let matched = 0;
    let missing = 0;
    let processed = 0;

    for (let index = 0; index < vocabularies.length; index += 100) {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const batch = vocabularies.slice(index, index + 100);
      await this.prisma.$transaction(batch.map((vocabulary) => {
        const entry = entryByWord.get(vocabulary.word.trim().toLowerCase());
        const pronunciations = Array.isArray(entry?.pronunciations) ? entry.pronunciations as any[] : [];
        const selected = (type: 'us' | 'uk') => pronunciations.find((item) => item?.type === type && item?.isPreferred)
          ?? pronunciations.find((item) => item?.type === type);
        const us = selected('us');
        const uk = selected('uk');
        if (entry) matched += 1;
        else missing += 1;
        return this.prisma.vocabulary.update({
          where: { id: vocabulary.id },
          data: {
            phoneticUs: typeof us?.ipa === 'string' && us.ipa.trim() ? us.ipa.trim() : null,
            phoneticUk: typeof uk?.ipa === 'string' && uk.ipa.trim() ? uk.ipa.trim() : null,
            audioUsUrl: typeof us?.audioUrl === 'string' && us.audioUrl.trim() ? us.audioUrl.trim() : null,
            audioUkUrl: typeof uk?.audioUrl === 'string' && uk.audioUrl.trim() ? uk.audioUrl.trim() : null,
          },
        });
      }));
      processed += batch.length;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'sync', totalItems: vocabularies.length, processedItems: processed, successItems: processed,
      });
    }

    const summary = { total: vocabularies.length, matched, missing, updated: processed };
    await this.adminTasksService.log(taskId, 'info', `同步完成：词典匹配 ${matched} 个，未匹配 ${missing} 个（已清空音标和发音）`, { step: 'completed', meta: summary });
    await this.adminTasksService.markCompleted(taskId, summary);
    return summary;
  }

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
    const usageStats = createUsageStats();

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

    // ---- Phase 2: Dictionary fill then AI enrich (concurrent) ----
    if (vocabulariesToEnrich.length > 0) {
      totalItems += vocabulariesToEnrich.length * 2;
      await this.adminTasksService.log(taskId, 'info', `开始富化 ${vocabulariesToEnrich.length} 个词汇（阶段二·第一步：词典字段填充）`, {
        step: 'dictionary',
        meta: { count: vocabulariesToEnrich.length },
      });

      // 2-A) 词典字段填充（并发）
      await runConcurrent(vocabulariesToEnrich, AI_ENRICH_CONCURRENCY, async (word) => {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        try {
          const vocab = await this.prisma.vocabulary.findUnique({
            where: { word },
            select: { id: true, word: true },
          });
          if (!vocab) return;
          // 词典字段：音标/音频/英文释义/中文释义/例句/同义词（FreeDictionary 为唯一数据源）
          await this.contentPrepareService.prepareVocabularyDictionary(vocab.id, usageStats);
          successItems++;
        } catch (error: any) {
          failedItems++;
          const message = error?.message ?? 'unknown error';
          summary.errors.push({ word, message: `dictionary: ${message}` });
          await this.adminTasksService.log(taskId, 'error', `词汇 "${word}" 词典填充失败：${message}`, {
            step: 'dictionary',
            meta: { word },
          });
        } finally {
          processedItems++;
          if (processedItems % 10 === 0) {
            await updateProgress(`dictionary:${word}`);
          }
          if (processedItems % 100 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（已处理 ${processedItems} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems },
            });
          }
        }
      });

      await updateProgress('enrich');
      await this.adminTasksService.log(taskId, 'info', `开始 AI 富化 ${vocabulariesToEnrich.length} 个词汇（阶段二·第二步：讲解/例句/难度）`, {
        step: 'enrich',
        meta: { count: vocabulariesToEnrich.length },
      });

      // 2-B) AI 富化补漏（并发）
      let enrichedCount = 0;
      await runConcurrent(vocabulariesToEnrich, AI_ENRICH_CONCURRENCY, async (word) => {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        try {
          const vocab = await this.prisma.vocabulary.findUnique({
            where: { word },
            select: { id: true, word: true },
          });
          if (!vocab) return;
          await this.contentPrepareService.prepareVocabularyAi(vocab.id, usageStats);
          const updated = await this.prisma.vocabulary.findUnique({
            where: { id: vocab.id },
            select: { meaning: true },
          });
          if (!updated || !/[\u3400-\u9fff]/.test(updated.meaning ?? '')) {
            throw new Error('未能获取中文释义');
          }
          enrichedCount++;
          summary.enriched++;
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
            await updateProgress(`enrich:${word}`);
          }
          if (processedItems % 100 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（已处理 ${processedItems} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems },
            });
          }
        }
      });

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
      usage: usageStats,
    });

    await this.adminTasksService.log(taskId, 'info', `导入完成：新建 ${summary.created}，富化 ${summary.enriched}，跳过 ${summary.skipped}，更新 ${summary.updated}`, {
      step: 'completed',
      meta: summary,
    });
  }

  /**
   * 全量检查词汇表。以下情况视为需要 AI 富化：
   * - 中文释义为空或被错误写成纯英文（避免只凭空值漏掉需要补全的数据）；
   * - 讲解/描述（description）为空；
   * - 例句（examples）为空。
   */
  async runMissingChineseMeaningEnrich(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'scan')) return;

    const candidates: Array<{ id: string; word: string }> = [];
    let cursor: string | undefined;
    let scanned = 0;
    const totalToScan = await this.prisma.vocabulary.count();

    await this.adminTasksService.log(taskId, 'info', `开始检查全部 ${totalToScan} 个词汇的字段完整性（中文释义/讲解/例句/音标/难度）`, { step: 'scan' });

    do {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const rows = await this.prisma.vocabulary.findMany({
        select: {
          id: true, word: true, meaning: true, description: true, examples: true,
          phoneticUs: true, phoneticUk: true, difficulty: true,
        },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;

      const validDifficulty = (d?: string | null) => ['L1', 'L2', 'L3', 'L4', 'L5'].includes(d ?? '');
      for (const vocabulary of rows) {
        scanned++;
        // 任一字段缺失/无效即视为需要补全：
        // - 中文释义为空或被错误写成纯英文
        // - 讲解/描述为空
        // - 例句为空
        // - 美/英音标全部缺失
        // - 难度缺失或不在 L1~L5
        if (
          !/[\u3400-\u9fff]/.test(vocabulary.meaning ?? '') ||
          !vocabulary.description?.trim() ||
          !(Array.isArray(vocabulary.examples) && vocabulary.examples.length > 0) ||
          (!vocabulary.phoneticUs?.trim() && !vocabulary.phoneticUk?.trim()) ||
          !validDifficulty(vocabulary.difficulty)
        ) {
          candidates.push({ id: vocabulary.id, word: vocabulary.word });
        }
      }
      cursor = rows.at(-1)?.id;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'scan', totalItems: totalToScan, processedItems: scanned, successItems: scanned,
      });
    } while (cursor);

    await this.adminTasksService.log(taskId, 'info', `检查完成：共检查 ${scanned} 个词汇，发现 ${candidates.length} 个字段缺失，将走统一词典管道补全`, {
      step: 'scan', meta: { scanned, missingEnrich: candidates.length },
    });

    let enriched = 0;
    let failed = 0;
    const errors: Array<{ id: string; word: string; message: string }> = [];
    const usageStats = createUsageStats();

    // Scan-only is a successful no-op, while still leaving a useful audit result.
    if (candidates.length > 0) {
      const totalSteps = candidates.length * 2; // 词典填充 + AI 富化
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'dictionary', totalItems: totalSteps, processedItems: 0, successItems: 0, failedItems: 0,
      });
      await this.adminTasksService.log(taskId, 'info', `开始词典字段填充 ${candidates.length} 个词汇（第一步）`, {
        step: 'dictionary', meta: { count: candidates.length },
      });

      // 第一步：词典字段填充（并发）
      let dictDone = 0;
      await runConcurrent(candidates, AI_ENRICH_CONCURRENCY, async (vocabulary) => {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        try {
          await this.contentPrepareService.prepareVocabularyDictionary(vocabulary.id, usageStats);
        } catch (error: any) {
          failed++;
          const message = error?.message ?? 'unknown error';
          errors.push({ id: vocabulary.id, word: vocabulary.word, message: `dictionary: ${message}` });
          await this.adminTasksService.log(taskId, 'error', `词汇 "${vocabulary.word}" 词典填充失败：${message}`, {
            step: 'dictionary', meta: { id: vocabulary.id, word: vocabulary.word },
          });
        } finally {
          dictDone++;
          if (dictDone % 10 === 0 || dictDone === candidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: `dictionary (${dictDone}/${candidates.length})`, totalItems: totalSteps, processedItems: dictDone,
              successItems: enriched, failedItems: failed,
            });
          }
          if (dictDone % 50 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（词典阶段 ${dictDone} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems: dictDone },
            });
          }
        }
      });

      await this.adminTasksService.log(taskId, 'info', `开始 AI 富化 ${candidates.length} 个词汇（第二步）`, {
        step: 'enrich', meta: { count: candidates.length },
      });

      // 第二步：AI 富化补漏（并发）
      let aiDone = 0;
      await runConcurrent(candidates, AI_ENRICH_CONCURRENCY, async (vocabulary) => {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        try {
          await this.contentPrepareService.prepareVocabularyAi(vocabulary.id, usageStats);
          const updated = await this.prisma.vocabulary.findUnique({
            where: { id: vocabulary.id },
            select: { meaning: true },
          });
          if (!updated || !/[\u3400-\u9fff]/.test(updated.meaning ?? '')) {
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
          aiDone++;
          const processed = candidates.length + aiDone;
          if (aiDone % 10 === 0 || aiDone === candidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: `enrich (${aiDone}/${candidates.length})`, totalItems: totalSteps, processedItems: processed,
              successItems: enriched, failedItems: failed,
            });
          }
          if (aiDone % 50 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（富化阶段 ${aiDone} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems: processed },
            });
          }
        }
      });
    }

    const summary = {
      scanned,
      missingEnrich: candidates.length,
      enriched,
      failed,
      errors: errors.slice(0, 20),
      usage: usageStats,
    };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `检查完成：检查 ${scanned}，需补全 ${candidates.length}，已富化 ${enriched}，失败 ${failed}`, {
      step: 'completed', meta: summary,
    });
  }

  /**
   * 扫描全部句块，为缺失中文释义、讲解/描述或例句的记录调用 AI 富化（按缺补缺、批量调用），
   * 并为缺失中文翻译的例句批量补翻译。
   */
  async runChunkMissingMeaningEnrich(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'scan')) return;

    const candidates: Array<{
      id: string; text: string; meaning: string;
      missing: { meaning: boolean; description: boolean; examples: boolean };
    }> = [];
    const translationCandidates: Array<{ id: string; chunkId: string; en: string }> = [];
    let cursor: string | undefined;
    let scanned = 0;
    const totalToScan = await this.prisma.chunk.count();

    await this.adminTasksService.log(taskId, 'info', `开始检查全部 ${totalToScan} 个句块的中文释义、讲解/描述、例句及例句中文翻译`, { step: 'scan' });

    do {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const rows = await this.prisma.chunk.findMany({
        select: { id: true, text: true, meaning: true, description: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;

      // 批量取本页例句，检查数量与中文翻译
      const examples = await this.prisma.chunkExample.findMany({
        where: { chunkId: { in: rows.map(r => r.id) } },
        select: { id: true, chunkId: true, en: true, zh: true },
      });
      const examplesByChunk = new Map<string, typeof examples>();
      for (const ex of examples) {
        const list = examplesByChunk.get(ex.chunkId);
        if (list) list.push(ex);
        else examplesByChunk.set(ex.chunkId, [ex]);
      }

      for (const chunk of rows) {
        scanned++;
        const exs = examplesByChunk.get(chunk.id) ?? [];
        const missing = {
          meaning: !/[\u3400-\u9fff]/.test(chunk.meaning ?? ''),
          description: !chunk.description?.trim(),
          examples: exs.length === 0,
        };
        if (missing.meaning || missing.description || missing.examples) {
          candidates.push({ id: chunk.id, text: chunk.text, meaning: chunk.meaning ?? '', missing });
        }
        for (const ex of exs) {
          if (!ex.zh?.trim()) {
            translationCandidates.push({ id: ex.id, chunkId: ex.chunkId, en: ex.en });
          }
        }
      }
      cursor = rows.at(-1)?.id;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'scan', totalItems: totalToScan, processedItems: scanned, successItems: scanned,
      });
    } while (cursor);

    await this.adminTasksService.log(taskId, 'info', `检查完成：共检查 ${scanned} 个句块，发现 ${candidates.length} 个缺失中文释义/讲解/例句，${translationCandidates.length} 条例句缺中文翻译`, {
      step: 'scan', meta: { scanned, missingEnrich: candidates.length, missingTranslations: translationCandidates.length },
    });

    let enriched = 0;
    let translated = 0;
    let failed = 0;
    const errors: Array<{ id: string; text: string; message: string }> = [];
    const usageStats = createUsageStats();
    const totalItems = candidates.length + translationCandidates.length;

    // ── 富化阶段：批量按缺补缺（每批 5 条一次调用） ──
    if (candidates.length > 0) {
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'enrich', totalItems, processedItems: 0, successItems: 0, failedItems: 0,
      });

      const BATCH_SIZE = 5;
      let processed = 0;
      for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        const batch = candidates.slice(index, index + BATCH_SIZE);
        try {
          const results = await this.adminContentAiService.enrichChunksBatch(
            batch.map(c => ({ id: c.id, text: c.text, meaning: c.meaning, missing: c.missing })),
            usageCallback(usageStats),
          );
          for (const { id, result } of results) {
            const chunk = batch.find(c => c.id === id);
            if (!chunk) continue;
            const data: Prisma.ChunkUpdateInput = {};
            // 仅补缺失字段，不重写已有内容
            if (chunk.missing.meaning && result.meaning?.trim() && /[\u3400-\u9fff]/.test(result.meaning)) {
              data.meaning = result.meaning;
            }
            if (chunk.missing.description && result.description?.trim()) {
              data.description = result.description;
            }
            if (chunk.missing.examples && result.examples.length > 0) {
              await this.prisma.$transaction(async (tx) => {
                await tx.chunkExample.deleteMany({ where: { chunkId: id } });
                await tx.chunk.update({
                  where: { id },
                  data: { ...data, examples: { create: result.examples.map((example, i) => ({ ...example, sortOrder: i })) } },
                });
              });
            } else if (Object.keys(data).length > 0) {
              await this.prisma.chunk.update({ where: { id }, data });
            }
            if (Object.keys(data).length > 0 || (chunk.missing.examples && result.examples.length > 0)) {
              enriched++;
            }
          }
        } catch (error: any) {
          failed += batch.length;
          for (const c of batch) {
            errors.push({ id: c.id, text: c.text, message: error?.message ?? 'unknown error' });
          }
        } finally {
          processed += batch.length;
          if (processed % 10 === 0 || processed >= candidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: `enrich (${processed}/${candidates.length})`, totalItems, processedItems: processed,
              successItems: enriched, failedItems: failed,
            });
          }
          if (processed % 50 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（已处理 ${processed} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems: processed },
            });
          }
        }
      }
    }

    // ── 翻译阶段：批量补例句中文翻译（每批 30 条一次调用） ──
    if (translationCandidates.length > 0) {
      const BATCH_SIZE = 30;
      let processed = 0;
      for (let index = 0; index < translationCandidates.length; index += BATCH_SIZE) {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        const batch = translationCandidates.slice(index, index + BATCH_SIZE);
        try {
          const zhList = await this.adminContentAiService.translateSentencesBatch(
            batch.map(t => ({ en: t.en })),
            usageCallback(usageStats),
          );
          for (let k = 0; k < batch.length; k++) {
            const zh = zhList[k];
            if (!zh?.trim()) continue;
            await this.prisma.chunkExample.update({ where: { id: batch[k].id }, data: { zh } });
            translated++;
          }
        } catch (error: any) {
          failed += batch.length;
          for (const t of batch) {
            errors.push({ id: t.id, text: t.en, message: error?.message ?? 'unknown error' });
          }
        } finally {
          processed += batch.length;
          if (processed % 60 === 0 || processed >= translationCandidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: `translate (${processed}/${translationCandidates.length})`, totalItems, processedItems: candidates.length + processed,
              successItems: enriched + translated, failedItems: failed,
            });
          }
          if (processed % 150 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（翻译 ${processed} 条例句）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems: processed },
            });
          }
        }
      }
    }

    const summary = { scanned, missingEnrich: candidates.length, missingTranslations: translationCandidates.length, enriched, translated, failed, errors, usage: usageStats };
    await this.adminTasksService.markCompleted(taskId, summary);
  }

  /**
   * 扫描全部句型，为缺失中文释义、讲解/描述或例句的记录调用 AI 富化（按缺补缺、批量调用），
   * 并为缺失中文翻译的例句批量补翻译。
   */
  async runPatternMissingMeaningEnrich(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'scan')) return;

    const candidates: Array<{
      id: string; pattern: string; meaning: string;
      missing: { meaning: boolean; description: boolean; examples: boolean };
    }> = [];
    const translationCandidates: Array<{ patternId: string; index: number; en: string }> = [];
    let cursor: string | undefined;
    let scanned = 0;
    const totalToScan = await this.prisma.sentencePattern.count();

    await this.adminTasksService.log(taskId, 'info', `开始检查全部 ${totalToScan} 个句型的中文释义、讲解/描述、例句及例句中文翻译`, { step: 'scan' });

    do {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const rows = await this.prisma.sentencePattern.findMany({
        select: { id: true, pattern: true, meaning: true, description: true, examples: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;

      for (const sp of rows) {
        scanned++;
        const examples = Array.isArray(sp.examples) ? (sp.examples as any[]) : [];
        const missing = {
          meaning: !/[\u3400-\u9fff]/.test(sp.meaning ?? ''),
          description: !sp.description?.trim(),
          examples: examples.length === 0,
        };
        if (missing.meaning || missing.description || missing.examples) {
          candidates.push({ id: sp.id, pattern: sp.pattern, meaning: sp.meaning ?? '', missing });
        }
        examples.forEach((ex, idx) => {
          if (!ex?.zh?.trim()) {
            translationCandidates.push({ patternId: sp.id, index: idx, en: ex?.en ?? '' });
          }
        });
      }
      cursor = rows.at(-1)?.id;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'scan', totalItems: totalToScan, processedItems: scanned, successItems: scanned,
      });
    } while (cursor);

    await this.adminTasksService.log(taskId, 'info', `检查完成：共检查 ${scanned} 个句型，发现 ${candidates.length} 个缺失中文释义/讲解/例句，${translationCandidates.length} 条例句缺中文翻译`, {
      step: 'scan', meta: { scanned, missingEnrich: candidates.length, missingTranslations: translationCandidates.length },
    });

    let enriched = 0;
    let translated = 0;
    let failed = 0;
    const errors: Array<{ id: string; pattern: string; message: string }> = [];
    const usageStats = createUsageStats();
    const totalItems = candidates.length + translationCandidates.length;

    // ── 富化阶段：批量按缺补缺（每批 5 条一次调用） ──
    if (candidates.length > 0) {
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'enrich', totalItems, processedItems: 0, successItems: 0, failedItems: 0,
      });

      const BATCH_SIZE = 5;
      let processed = 0;
      for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        const batch = candidates.slice(index, index + BATCH_SIZE);
        try {
          const results = await this.adminContentAiService.enrichPatternsBatch(
            batch.map(c => ({ id: c.id, text: c.pattern, meaning: c.meaning, missing: c.missing })),
            usageCallback(usageStats),
          );
          for (const { id, result } of results) {
            const sp = batch.find(c => c.id === id);
            if (!sp) continue;
            const data: Prisma.SentencePatternUpdateInput = {};
            // 仅补缺失字段，不重写已有内容
            if (sp.missing.meaning && result.meaning?.trim() && /[\u3400-\u9fff]/.test(result.meaning)) {
              data.meaning = result.meaning;
            }
            if (sp.missing.description && result.description?.trim()) {
              data.description = result.description;
            }
            if (sp.missing.examples && result.examples.length > 0) {
              data.examples = result.examples.map(example => ({ en: example.en, zh: example.zh, level: example.level })) as Prisma.InputJsonValue;
            }
            if (Object.keys(data).length > 0) {
              await this.prisma.sentencePattern.update({ where: { id }, data });
              enriched++;
            }
          }
        } catch (error: any) {
          failed += batch.length;
          for (const c of batch) {
            errors.push({ id: c.id, pattern: c.pattern, message: error?.message ?? 'unknown error' });
          }
        } finally {
          processed += batch.length;
          if (processed % 10 === 0 || processed >= candidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: `enrich (${processed}/${candidates.length})`, totalItems, processedItems: processed,
              successItems: enriched, failedItems: failed,
            });
          }
          if (processed % 50 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（已处理 ${processed} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems: processed },
            });
          }
        }
      }
    }

    // ── 翻译阶段：批量补例句中文翻译（每批 30 条一次调用） ──
    if (translationCandidates.length > 0) {
      const BATCH_SIZE = 30;
      let processed = 0;
      for (let index = 0; index < translationCandidates.length; index += BATCH_SIZE) {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        const batch = translationCandidates.slice(index, index + BATCH_SIZE);
        try {
          const zhList = await this.adminContentAiService.translateSentencesBatch(
            batch.map(t => ({ en: t.en })),
            usageCallback(usageStats),
          );
          // 按 patternId 分组写回（同一句型的多条翻译只读一次 JSON）
          const byPattern = new Map<string, Array<{ index: number; zh: string }>>();
          for (let k = 0; k < batch.length; k++) {
            const zh = zhList[k];
            if (!zh?.trim()) continue;
            const t = batch[k];
            const list = byPattern.get(t.patternId);
            if (list) list.push({ index: t.index, zh });
            else byPattern.set(t.patternId, [{ index: t.index, zh }]);
          }
          for (const [patternId, updates] of byPattern) {
            const record = await this.prisma.sentencePattern.findUnique({ where: { id: patternId }, select: { examples: true } });
            if (!record || !Array.isArray(record.examples)) continue;
            const examples = [...(record.examples as any[])];
            let changed = false;
            for (const u of updates) {
              if (examples[u.index] && typeof examples[u.index] === 'object' && !examples[u.index]?.zh?.trim()) {
                examples[u.index] = { ...examples[u.index], zh: u.zh };
                changed = true;
              }
            }
            if (changed) {
              await this.prisma.sentencePattern.update({ where: { id: patternId }, data: { examples: examples as Prisma.InputJsonValue } });
              translated++;
            }
          }
        } catch (error: any) {
          failed += batch.length;
          for (const t of batch) {
            errors.push({ id: `${t.patternId}:${t.index}`, pattern: t.en, message: error?.message ?? 'unknown error' });
          }
        } finally {
          processed += batch.length;
          if (processed % 60 === 0 || processed >= translationCandidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: `translate (${processed}/${translationCandidates.length})`, totalItems, processedItems: candidates.length + processed,
              successItems: enriched + translated, failedItems: failed,
            });
          }
          if (processed % 150 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（翻译 ${processed} 条例句）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems: processed },
            });
          }
        }
      }
    }

    const summary = { scanned, missingEnrich: candidates.length, missingTranslations: translationCandidates.length, enriched, translated, failed, errors, usage: usageStats };
    await this.adminTasksService.markCompleted(taskId, summary);
  }

  /**
   * 词汇轻量修补：
   * 1) 例句缺少中文翻译（zh 为空）→ 补翻译
   * 2) 中文释义过长（超过 MEANING_MAX_LEN 字符）→ 精简
   * 输入极小：只需 word + 原释义 + 缺 zh 的例句，不走完整词典/AI 管道。
   */
  async runVocabularyPolish(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'scan')) return;

    const MEANING_MAX_LEN = 60; // 超过视为冗长，需要精简
    const candidates: Array<{ id: string; word: string }> = [];
    let cursor: string | undefined;
    let scanned = 0;
    const totalToScan = await this.prisma.vocabulary.count();

    await this.adminTasksService.log(taskId, 'info', `开始检查全部 ${totalToScan} 个词汇（例句缺中文翻译 / 释义过长）`, { step: 'scan' });

    do {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const rows = await this.prisma.vocabulary.findMany({
        select: { id: true, word: true, meaning: true, examples: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;

      for (const v of rows) {
        scanned++;
        const examples = Array.isArray(v.examples) ? (v.examples as any[]) : [];
        const hasMissingZh = examples.some((e) => !e?.zh || !String(e.zh).trim());
        const meaningTooLong = (v.meaning?.trim().length ?? 0) > MEANING_MAX_LEN;
        if (hasMissingZh || meaningTooLong) {
          candidates.push({ id: v.id, word: v.word });
        }
      }
      cursor = rows.at(-1)?.id;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'scan', totalItems: totalToScan, processedItems: scanned, successItems: scanned,
      });
    } while (cursor);

    await this.adminTasksService.log(taskId, 'info', `检查完成：共检查 ${scanned} 个词汇，发现 ${candidates.length} 个需修补（例句缺中文翻译或释义过长）`, {
      step: 'scan', meta: { scanned, missingEnrich: candidates.length },
    });

    let enriched = 0;
    let failed = 0;
    const errors: Array<{ id: string; word: string; message: string }> = [];
    const usageStats = createUsageStats();

    if (candidates.length > 0) {
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'polish', totalItems: candidates.length, processedItems: 0, successItems: 0, failedItems: 0,
      });

      let done = 0;
      await runConcurrent(candidates, AI_ENRICH_CONCURRENCY, async (candidate) => {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        try {
          const record = await this.prisma.vocabulary.findUnique({
            where: { id: candidate.id },
            select: { word: true, meaning: true, examples: true },
          });
          if (!record) { failed++; return; }

          const examples = Array.isArray(record.examples) ? (record.examples as any[]) : [];
          const missingZh = examples
            .map((e: any) => ({ en: String(e?.en ?? '').trim() }))
            .filter((e: { en: string }) => e.en);
          const meaningTooLong = (record.meaning?.trim().length ?? 0) > MEANING_MAX_LEN;

          // 完全没有例句或释义为空时跳过（无修补目标，交给完整富化任务处理）
          if (missingZh.length === 0 && !meaningTooLong) { return; }
          // 只有释义过长时也无需例句输入；都传也不贵（例句本身很短）

          const result = await this.adminContentAiService.polishVocabulary(
            {
              word: record.word,
              meaning: record.meaning ?? '',
              examples: missingZh,
            },
            usageCallback(usageStats),
          );
          if (!result) throw new Error('AI 未返回结果');

          const data: Prisma.VocabularyUpdateInput = {};
          // 1) 例句翻译回填（按 en 原文匹配）
          if (result.translations.length > 0) {
            const zhByEn = new Map(result.translations.map((t) => [t.en.toLowerCase(), t.zh]));
            const nextExamples = examples.map((e: any) => {
              const zh = zhByEn.get(String(e.en ?? '').toLowerCase());
              return zh ? { ...e, zh } : e;
            });
            data.examples = nextExamples as Prisma.InputJsonValue;
          }
          // 2) 释义精简（AI 返回、非空、含汉字且确实变短才替换）
          const newMeaning = result.meaning?.trim() ?? '';
          if (
            newMeaning &&
            newMeaning !== (record.meaning ?? '').trim() &&
            /[\u3400-\u9fff]/.test(newMeaning) &&
            newMeaning.length <= MEANING_MAX_LEN
          ) {
            data.meaning = newMeaning;
          }

          if (Object.keys(data).length > 0) {
            await this.prisma.vocabulary.update({ where: { id: candidate.id }, data });
          }
          enriched++;
        } catch (error: any) {
          failed++;
          const message = error?.message ?? 'unknown error';
          errors.push({ id: candidate.id, word: candidate.word, message });
          await this.adminTasksService.log(taskId, 'error', `词汇 "${candidate.word}" 修补失败：${message}`, {
            step: 'polish', meta: { id: candidate.id, word: candidate.word },
          });
        } finally {
          done++;
          if (done % 10 === 0 || done === candidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: `polish (${done}/${candidates.length})`, totalItems: candidates.length, processedItems: done,
              successItems: enriched, failedItems: failed,
            });
          }
          if (done % 50 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（已处理 ${done} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems: done },
            });
          }
        }
      });
    }

    const summary = { scanned, missingEnrich: candidates.length, enriched, failed, errors, usage: usageStats };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `修补完成：检查 ${scanned}，需修补 ${candidates.length}，已修补 ${enriched}，失败 ${failed}`, {
      step: 'completed', meta: summary,
    });
  }

  /**
   * 只重写中文释义：扫描 meaning 含 other 的词汇，用 AI 重写 meaning 字段（不改音标/例句/讲解等）。
   */
  async runMeaningOtherRewrite(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'scan')) return;

    const candidates: Array<{ id: string; word: string }> = [];
    let cursor: string | undefined;
    let scanned = 0;
    const totalToScan = await this.prisma.vocabulary.count({
      where: { meaning: { contains: 'other', mode: 'insensitive' } },
    });

    await this.adminTasksService.log(taskId, 'info', `开始扫描中文释义含 other 的词汇（约 ${totalToScan} 个候选）`, { step: 'scan' });

    do {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const rows = await this.prisma.vocabulary.findMany({
        where: { meaning: { contains: 'other', mode: 'insensitive' } },
        select: { id: true, word: true, meaning: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;

      for (const v of rows) {
        scanned++;
        candidates.push({ id: v.id, word: v.word });
      }
      cursor = rows.at(-1)?.id;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'scan', totalItems: totalToScan, processedItems: scanned, successItems: scanned,
      });
    } while (cursor);

    await this.adminTasksService.log(taskId, 'info', `扫描完成：发现 ${candidates.length} 个需重写中文释义`, {
      step: 'scan', meta: { scanned, missingEnrich: candidates.length },
    });

    let enriched = 0;
    let failed = 0;
    const errors: Array<{ id: string; word: string; message: string }> = [];
    const usageStats = createUsageStats();

    if (candidates.length > 0) {
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'rewrite-meaning', totalItems: candidates.length, processedItems: 0, successItems: 0, failedItems: 0,
      });

      let done = 0;
      await runConcurrent(candidates, AI_ENRICH_CONCURRENCY, async (candidate) => {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        try {
          const record = await this.prisma.vocabulary.findUnique({
            where: { id: candidate.id },
            select: { word: true, meaning: true, definitionEn: true },
          });
          if (!record) { failed++; return; }
          if (!/other/i.test(record.meaning ?? '')) return;

          const result = await this.adminContentAiService.rewriteVocabularyMeaning(
            {
              word: record.word,
              meaning: record.meaning ?? '',
              definitionEn: record.definitionEn ?? '',
            },
            usageCallback(usageStats),
          );

          const newMeaning = result.meaning?.trim() ?? '';
          if (
            !newMeaning ||
            !/[\u3400-\u9fff]/.test(newMeaning) ||
            /other/i.test(newMeaning)
          ) {
            throw new Error(newMeaning ? `AI 返回仍含 other 或无效：${newMeaning}` : 'AI 未返回有效中文释义');
          }

          await this.prisma.vocabulary.update({
            where: { id: candidate.id },
            data: { meaning: newMeaning },
          });
          enriched++;
        } catch (error: any) {
          failed++;
          const message = error?.message ?? 'unknown error';
          errors.push({ id: candidate.id, word: candidate.word, message });
          await this.adminTasksService.log(taskId, 'error', `词汇 "${candidate.word}" 释义重写失败：${message}`, {
            step: 'rewrite-meaning', meta: { id: candidate.id, word: candidate.word },
          });
        } finally {
          done++;
          if (done % 10 === 0 || done === candidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: `rewrite-meaning (${done}/${candidates.length})`,
              totalItems: candidates.length,
              processedItems: done,
              successItems: enriched,
              failedItems: failed,
            });
          }
          if (done % 50 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（已处理 ${done} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems: done },
            });
          }
        }
      });
    }

    const summary = { scanned, missingEnrich: candidates.length, enriched, failed, errors, usage: usageStats };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `释义重写完成：扫描 ${scanned}，已更新 ${enriched}，失败 ${failed}`, {
      step: 'completed', meta: summary,
    });
  }

  /**
   * 只重写中文释义：扫描有中文但缺 n./v./adj. 等词性前缀的词汇，轻量 AI 只更新 meaning。
   */
  async runMeaningMissingPosRewrite(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'scan')) return;

    const candidates: Array<{ id: string; word: string }> = [];
    let cursor: string | undefined;
    let scanned = 0;
    const totalToScan = await this.prisma.vocabulary.count({
      where: { NOT: { meaning: '' } },
    });

    await this.adminTasksService.log(taskId, 'info', `开始扫描缺词性前缀的中文释义（约 ${totalToScan} 个候选）`, { step: 'scan' });

    do {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const rows = await this.prisma.vocabulary.findMany({
        where: { NOT: { meaning: '' } },
        select: { id: true, word: true, meaning: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;

      for (const v of rows) {
        scanned++;
        if (vocabularyMeaningMissingPosPrefix(v.meaning)) {
          candidates.push({ id: v.id, word: v.word });
        }
      }
      cursor = rows.at(-1)?.id;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'scan', totalItems: totalToScan, processedItems: scanned, successItems: scanned,
      });
    } while (cursor);

    await this.adminTasksService.log(taskId, 'info', `扫描完成：发现 ${candidates.length} 个缺词性前缀的中文释义`, {
      step: 'scan', meta: { scanned, missingEnrich: candidates.length },
    });

    let enriched = 0;
    let failed = 0;
    const errors: Array<{ id: string; word: string; message: string }> = [];
    const usageStats = createUsageStats();

    if (candidates.length > 0) {
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'rewrite-meaning', totalItems: candidates.length, processedItems: 0, successItems: 0, failedItems: 0,
      });

      let done = 0;
      await runConcurrent(candidates, AI_ENRICH_CONCURRENCY, async (candidate) => {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        try {
          const record = await this.prisma.vocabulary.findUnique({
            where: { id: candidate.id },
            select: { word: true, meaning: true, definitionEn: true },
          });
          if (!record) { failed++; return; }
          if (!vocabularyMeaningMissingPosPrefix(record.meaning)) return;

          const result = await this.adminContentAiService.rewriteVocabularyMeaning(
            {
              word: record.word,
              meaning: record.meaning ?? '',
              definitionEn: record.definitionEn ?? '',
            },
            usageCallback(usageStats),
          );

          const newMeaning = result.meaning?.trim() ?? '';
          if (
            !newMeaning ||
            !/[\u3400-\u9fff]/.test(newMeaning) ||
            /other/i.test(newMeaning) ||
            vocabularyMeaningMissingPosPrefix(newMeaning)
          ) {
            throw new Error(newMeaning ? `AI 返回仍缺词性前缀或无效：${newMeaning}` : 'AI 未返回有效中文释义');
          }

          await this.prisma.vocabulary.update({
            where: { id: candidate.id },
            data: { meaning: newMeaning },
          });
          enriched++;
        } catch (error: any) {
          failed++;
          const message = error?.message ?? 'unknown error';
          errors.push({ id: candidate.id, word: candidate.word, message });
          await this.adminTasksService.log(taskId, 'error', `词汇 "${candidate.word}" 释义重写失败：${message}`, {
            step: 'rewrite-meaning', meta: { id: candidate.id, word: candidate.word },
          });
        } finally {
          done++;
          if (done % 10 === 0 || done === candidates.length) {
            await this.adminTasksService.setProgress(taskId, {
              currentStep: `rewrite-meaning (${done}/${candidates.length})`,
              totalItems: candidates.length,
              processedItems: done,
              successItems: enriched,
              failedItems: failed,
            });
          }
          if (done % 50 === 0) {
            await this.adminTasksService.log(taskId, 'info', `AI 用量（已处理 ${done} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
              step: 'ai-usage',
              meta: { ...usageStats, processedItems: done },
            });
          }
        }
      });
    }

    const summary = { scanned, missingEnrich: candidates.length, enriched, failed, errors, usage: usageStats };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `缺词性前缀释义重写完成：扫描 ${scanned}，已更新 ${enriched}，失败 ${failed}`, {
      step: 'completed', meta: summary,
    });
  }

  async runBilingualDefinitionEnrich(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'scan')) return;

    const candidates: Array<{ id: string; word: string; definitionEn: string; meaning: string }> = [];
    let cursor: string | undefined;
    let scanned = 0;
    const totalToScan = await this.prisma.vocabulary.count();

    do {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const rows = await this.prisma.vocabulary.findMany({
        select: { id: true, word: true, definitionEn: true, meaning: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!rows.length) break;
      for (const vocabulary of rows) {
        scanned++;
        if (vocabulary.definitionEn?.trim() && !/[\u3400-\u9fff]/.test(vocabulary.definitionEn)) {
          candidates.push({
            id: vocabulary.id,
            word: vocabulary.word,
            definitionEn: vocabulary.definitionEn,
            meaning: vocabulary.meaning ?? '',
          });
        }
      }
      cursor = rows.at(-1)?.id;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: 'scan', totalItems: totalToScan, processedItems: scanned, successItems: scanned,
      });
    } while (cursor);

    await this.adminTasksService.log(taskId, 'info', `扫描完成：共 ${scanned} 个词汇，发现 ${candidates.length} 个英文释义未双语`, {
      step: 'scan', meta: { scanned, candidates: candidates.length },
    });

    let updated = 0;
    let failed = 0;
    let unchanged = 0;
    const errors: Array<{ id: string; word: string; message: string }> = [];
    const usageStats = createUsageStats();
    let processed = 0;

    await this.adminTasksService.setProgress(taskId, {
      currentStep: 'definition-and-difficulty', totalItems: candidates.length, processedItems: 0,
      successItems: 0, failedItems: 0,
    });

    await runConcurrent(candidates, AI_ENRICH_CONCURRENCY, async (candidate) => {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      try {
        const dictionaryDefinitions = await this.contentPrepareService.getVocabularyDictionaryDefinitions(candidate.word, usageStats);
        const definitions = dictionaryDefinitions.length
          ? dictionaryDefinitions
          : candidate.definitionEn.split('; ').map((definition) => definition.trim()).filter(Boolean);
        if (!definitions.length) throw new Error('词典与现有记录均无可用英文释义');

        const review = await this.adminContentAiService.reviewVocabularyDefinitionAndDifficulty({
          word: candidate.word,
          definitions,
          meaning: candidate.meaning,
          translateMissingDefinitions: true,
        }, usageCallback(usageStats));
        if (!review.difficulty) throw new Error('AI 未返回有效难度');

        const bilingualDefinitions = definitions.map((definition, index) => {
          if (/[\u3400-\u9fff]/.test(definition)) return definition;
          const translation = review.definitionTranslations[index]?.replace(/^\[|\]$/g, '').trim();
          return translation ? `${definition}  [${translation}]` : definition;
        }).join('; ');
        if (!/[\u3400-\u9fff]/.test(bilingualDefinitions)) throw new Error('AI 未返回有效中文释义翻译');

        await this.prisma.vocabulary.update({
          where: { id: candidate.id },
          data: { definitionEn: bilingualDefinitions, difficulty: review.difficulty },
        });
        updated++;
      } catch (error: any) {
        failed++;
        const message = error?.message ?? 'unknown error';
        errors.push({ id: candidate.id, word: candidate.word, message });
        await this.adminTasksService.log(taskId, 'error', `词汇 "${candidate.word}" 双语释义富化失败：${message}`, {
          step: 'definition-and-difficulty', meta: { id: candidate.id, word: candidate.word },
        });
      } finally {
        processed++;
        unchanged = processed - updated - failed;
        if (processed % 10 === 0 || processed === candidates.length) {
          await this.adminTasksService.setProgress(taskId, {
            currentStep: `definition-and-difficulty (${processed}/${candidates.length})`,
            totalItems: candidates.length,
            processedItems: processed,
            successItems: updated,
            failedItems: failed,
          });
        }
        if (processed % 50 === 0) {
          await this.adminTasksService.log(taskId, 'info', `AI 用量（已处理 ${processed} 项）：${usageStats.calls} 次调用，合计 ${usageStats.totalTokens} tokens`, {
            step: 'ai-usage', meta: { ...usageStats, processedItems: processed },
          });
        }
      }
    });

    const summary = { scanned, candidates: candidates.length, updated, unchanged, failed, errors: errors.slice(0, 20), usage: usageStats };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `双语释义富化完成：更新 ${updated}，失败 ${failed}`, {
      step: 'completed', meta: summary,
    });
  }

  async runDifficultyReclassify(taskId: string) {
    const checkpoint = await this.adminTasksService.beginOrResume(taskId, 'scan');
    if (!checkpoint) return;
    const persisted = (checkpoint.summary as any)?.checkpoint ?? {};
    const isResume = persisted.scopeVersion === 1 && (
      checkpoint.currentStep?.startsWith('reclassify-difficulty')
      || checkpoint.currentStep?.startsWith('resume:')
    );

    const candidates: Array<{ id: string; word: string; definitionEn: string; meaning: string; difficulty: string }> = [];
    let cursor: string | undefined;
    do {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const rows = await this.prisma.vocabulary.findMany({
        where: { difficulty: 'L1', difficultyReviewedAt: null },
        select: { id: true, word: true, definitionEn: true, meaning: true, difficulty: true },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!rows.length) break;
      candidates.push(...rows.map((row) => ({
        id: row.id,
        word: row.word,
        definitionEn: row.definitionEn ?? '',
        meaning: row.meaning ?? '',
        difficulty: row.difficulty ?? '',
      })));
      cursor = rows.at(-1)?.id;
    } while (cursor);

    const processedBase = isResume ? checkpoint.successItems : 0;
    const totalItems = isResume
      ? Math.max(checkpoint.totalItems, processedBase + candidates.length)
      : candidates.length;
    let updated = isResume ? Number(persisted.updated ?? 0) : 0;
    let unchanged = isResume ? Number(persisted.unchanged ?? 0) : 0;
    let failed = 0;
    let processed = processedBase;
    const distribution: Record<string, number> = isResume && persisted.distribution
      ? { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, ...persisted.distribution }
      : { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
    const errors: Array<{ id: string; word: string; message: string }> = isResume && Array.isArray(persisted.errors)
      ? persisted.errors.slice(0, 20)
      : [];
    const usageStats = { ...createUsageStats(), ...(isResume ? persisted.usage : {}) };

    await this.adminTasksService.log(taskId, isResume ? 'warn' : 'info', isResume
      ? `恢复难度复核：已完成 ${processedBase} 个，继续处理剩余 ${candidates.length} 个未复核 L1 词汇`
      : `扫描完成：将重新判断 ${candidates.length} 个未复核 L1 词汇的难度`, {
      step: isResume ? 'resumed' : 'scan', meta: { totalItems, processedBase, remaining: candidates.length },
    });
    await this.adminTasksService.setProgress(taskId, {
      currentStep: 'reclassify-difficulty', totalItems, processedItems: processedBase,
      successItems: updated + unchanged, failedItems: failed,
    });

    const batchSize = 20;
    for (let index = 0; index < candidates.length; index += batchSize) {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const batch = candidates.slice(index, index + batchSize);
      try {
        const results = await this.adminContentAiService.reviewVocabularyDifficultiesBatch(
          batch.map((candidate) => ({
            id: candidate.id,
            word: candidate.word,
            meaning: candidate.meaning,
            definitions: candidate.definitionEn.split('; ').map((definition) => definition.trim()).filter(Boolean),
          })),
          usageCallback(usageStats),
        );
        const resultById = new Map(results.map((result) => [result.id, result.difficulty]));
        const updates = [];
        const missingResults: Array<{ id: string; word: string; message: string }> = [];
        let batchUpdated = 0;
        let batchUnchanged = 0;
        const reviewedAt = new Date();
        for (const candidate of batch) {
          const difficulty = resultById.get(candidate.id);
          if (!difficulty) {
            missingResults.push({ id: candidate.id, word: candidate.word, message: 'AI 未返回有效难度' });
            continue;
          }
          distribution[difficulty] = (distribution[difficulty] ?? 0) + 1;
          if (difficulty === candidate.difficulty) {
            batchUnchanged++;
          } else {
            batchUpdated++;
          }
          updates.push(this.prisma.vocabulary.update({
            where: { id: candidate.id },
            data: { difficulty, difficultyReviewedAt: reviewedAt },
          }));
        }
        if (updates.length) {
          await this.prisma.$transaction(updates);
        }
        updated += batchUpdated;
        unchanged += batchUnchanged;
        failed += missingResults.length;
        errors.push(...missingResults);
      } catch (error: any) {
        const message = error?.message ?? 'unknown error';
        failed += batch.length;
        errors.push(...batch.map((candidate) => ({ id: candidate.id, word: candidate.word, message })));
        await this.adminTasksService.log(taskId, 'error', `第 ${Math.floor(index / batchSize) + 1} 批难度复核失败：${message}`, {
          step: 'reclassify-difficulty', meta: { startIndex: index, count: batch.length },
        });
      }
      processed += batch.length;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: `reclassify-difficulty (${processed}/${totalItems})`,
        totalItems,
        processedItems: processed,
        successItems: updated + unchanged,
        failedItems: failed,
      });
      await this.prisma.adminTask.updateMany({
        where: { id: taskId, status: 'running' },
        data: {
          summary: {
            updated,
            unchanged,
            failed,
            distribution,
            errors: errors.slice(0, 20),
            usage: usageStats,
            checkpoint: {
              scopeVersion: 1,
              updated,
              unchanged,
              failed,
              distribution,
              errors: errors.slice(0, 20),
              usage: usageStats,
            },
          } as Prisma.InputJsonValue,
        },
      });
      if (processed % 100 === 0 || processed === totalItems) {
        await this.adminTasksService.log(taskId, 'info', `AI 用量（已处理 ${processed} 项）：${usageStats.calls} 次调用，合计 ${usageStats.totalTokens} tokens`, {
          step: 'ai-usage', meta: { ...usageStats, processedItems: processed },
        });
      }
    }

    const remaining = await this.prisma.vocabulary.count({
      where: { difficulty: 'L1', difficultyReviewedAt: null },
    });
    const finalDistributionRows = await this.prisma.vocabulary.groupBy({
      by: ['difficulty'],
      _count: { _all: true },
    });
    const finalDistribution = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
    for (const row of finalDistributionRows) {
      if (row.difficulty in finalDistribution) {
        finalDistribution[row.difficulty as keyof typeof finalDistribution] = row._count._all;
      }
    }
    const summary = { scanned: totalItems, reviewed: updated + unchanged, updated, unchanged, failed, remaining, distribution: finalDistribution, errors: errors.slice(0, 20), usage: usageStats };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `难度复核完成：变更 ${updated}，保持 ${unchanged}，失败 ${failed}`, {
      step: 'completed', meta: summary,
    });
  }

}
