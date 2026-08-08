import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AdminContentAiService, VocabularyAiEnrichResult } from '../../admin/admin-content-ai.service';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { AdminTasksService } from '../admin-tasks.service';

/** 词典条目（dictionary_entry）中与语料库词汇映射相关的字段 */
interface DictionaryEntryData {
  word: string;
  pronunciations?: Array<{
    type: 'uk' | 'us';
    ipa: string;
    audioUrl?: string;
    isPreferred: boolean;
  }>;
  senseClusters?: Array<{
    id: string;
    label: string;
    posBucket: string;
    rank: number;
    senses: Array<{
      id: string;
      definition: string;
      partOfSpeech: string;
      translations?: { zh?: string };
      examples?: Array<{ en: string; zh?: string; source?: string; relevance?: string }>;
      frequency?: string;
    }>;
  }>;
  senses?: Array<{
    definition: string;
    partOfSpeech: string;
    translations?: { zh?: string };
  }>;
  entrySynonyms?: string[];
}

interface PrepareSummary {
  vocabChecked: number;
  vocabEnriched: number;
  vocabSkipped: number;
  chunkChecked: number;
  chunkEnriched: number;
  chunkSkipped: number;
  patternChecked: number;
  patternEnriched: number;
  patternSkipped: number;
  errors: Array<{ type: 'vocabulary' | 'chunk' | 'pattern'; id: string; key: string; message: string }>;
}

interface RetryItems {
  vocabulary?: string[];
  chunk?: string[];
  pattern?: string[];
}

/** AI 富化并发度（环境变量可调，默认 10） */
export const AI_ENRICH_CONCURRENCY = (() => {
  const n = Number(process.env.AI_ENRICH_CONCURRENCY ?? '10');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
})();

/** 固定 worker 池并发执行：空闲 worker 立即取下一个任务，单个任务异常不拖垮整批 */
export async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const limit = Math.min(Math.max(1, concurrency), items.length);
  await Promise.allSettled(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index], index);
      }
    }),
  );
}

/** AI 调用累计统计（任务级） */
export interface AiUsageStats {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export function createUsageStats(): AiUsageStats {
  return { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export function usageCallback(stats: AiUsageStats) {
  return (usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => {
    stats.calls++;
    stats.promptTokens += usage.promptTokens ?? 0;
    stats.completionTokens += usage.completionTokens ?? 0;
    stats.totalTokens += usage.totalTokens ?? 0;
  };
}

@Injectable()
export class ContentPrepareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminTasksService: AdminTasksService,
    private readonly adminContentAiService: AdminContentAiService,
    private readonly dictionaryService: DictionaryService,
  ) {}

  async run(taskId: string, sceneId: string, options?: {
    reportProgress?: (progress: number) => Promise<void> | void;
    retryItems?: RetryItems;
  }) {
    await this.adminTasksService.markRunning(taskId, 'scan');
    await this.adminTasksService.log(taskId, 'info', '开始扫描学习包内容', { step: 'scan', meta: { sceneId } });

    const collected = await this.collectSceneContent(sceneId);
    const { vocabs, chunks, patterns } = this.applyRetryFilter(collected, options?.retryItems);
    const totalItems = vocabs.length * 2 + chunks.length + patterns.length;
    const summary: PrepareSummary = {
      vocabChecked: 0,
      vocabEnriched: 0,
      vocabSkipped: 0,
      chunkChecked: 0,
      chunkEnriched: 0,
      chunkSkipped: 0,
      patternChecked: 0,
      patternEnriched: 0,
      patternSkipped: 0,
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
      const progress = totalItems > 0 ? Math.floor((processedItems / totalItems) * 100) : 0;
      await options?.reportProgress?.(progress);
    };

    await updateProgress('scan');
    await this.adminTasksService.log(taskId, 'info', '扫描完成，开始逐项准备内容', {
      step: 'scan',
      meta: {
        vocabulary: vocabs.length,
        chunk: chunks.length,
        pattern: patterns.length,
        totalItems,
        retryItems: options?.retryItems ?? null,
      },
    });

    // ── 阶段一：词典字段填充（并发 AI_ENRICH_CONCURRENCY） ──
    await runConcurrent(vocabs, AI_ENRICH_CONCURRENCY, async (vocab) => {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      summary.vocabChecked++;
      try {
        const result = await this.prepareVocabularyDictionary(vocab.id, usageStats);
        if (result !== 'updated') summary.vocabSkipped++;
        await this.adminTasksService.log(taskId, 'info', `词汇 "${vocab.word}" 词典字段已填充`, {
          step: 'vocabulary-dictionary',
          meta: { vocabId: vocab.id, word: vocab.word, result },
        });
        successItems++;
      } catch (error: any) {
        failedItems++;
        const message = error?.message ?? 'unknown error';
        summary.errors.push({ type: 'vocabulary', id: vocab.id, key: vocab.word ?? vocab.id, message });
        await this.adminTasksService.log(taskId, 'error', `词汇 "${vocab.word}" 词典填充失败，已跳过：${message}`, {
          step: 'vocabulary-dictionary',
          meta: { vocabId: vocab.id, word: vocab.word },
        });
      } finally {
        processedItems++;
        await updateProgress('vocabulary-dictionary');
        if (processedItems % 50 === 0) {
          await this.adminTasksService.log(taskId, 'info', `AI 用量（处理 ${processedItems} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
            step: 'ai-usage',
            meta: { ...usageStats, processedItems },
          });
        }
      }
    });

    // ── 阶段二：AI 富化补漏（并发 AI_ENRICH_CONCURRENCY） ──
    await runConcurrent(vocabs, AI_ENRICH_CONCURRENCY, async (vocab) => {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      try {
        const result = await this.prepareVocabularyAi(vocab.id, usageStats);
        if (result === 'updated') {
          summary.vocabEnriched++;
          await this.adminTasksService.log(taskId, 'info', `词汇 "${vocab.word}" 已补全`, {
            step: 'vocabulary',
            meta: { vocabId: vocab.id, word: vocab.word, result },
          });
        } else {
          summary.vocabSkipped++;
        }
        successItems++;
      } catch (error: any) {
        failedItems++;
        const message = error?.message ?? 'unknown error';
        summary.errors.push({ type: 'vocabulary', id: vocab.id, key: vocab.word ?? vocab.id, message });
        await this.adminTasksService.log(taskId, 'error', `词汇 "${vocab.word}" 富化失败，已跳过：${message}`, {
          step: 'vocabulary',
          meta: { vocabId: vocab.id, word: vocab.word },
        });
      } finally {
        processedItems++;
        await updateProgress('vocabulary-ai');
        if (processedItems % 50 === 0) {
          await this.adminTasksService.log(taskId, 'info', `AI 用量（处理 ${processedItems} 项）：${usageStats.calls} 次调用，输入 ${usageStats.promptTokens} / 输出 ${usageStats.completionTokens} / 合计 ${usageStats.totalTokens} tokens`, {
            step: 'ai-usage',
            meta: { ...usageStats, processedItems },
          });
        }
      }
    });

    for (const chunk of chunks) {
      summary.chunkChecked++;
      try {
        const result = await this.prepareChunk(chunk.id, usageStats);
        if (result === 'updated') {
          summary.chunkEnriched++;
          await this.adminTasksService.log(taskId, 'info', `句块 "${chunk.text}" 已补全`, {
            step: 'chunk',
            meta: { chunkId: chunk.id, text: chunk.text, result },
          });
        } else {
          summary.chunkSkipped++;
        }
        successItems++;
      } catch (error: any) {
        failedItems++;
        const message = error?.message ?? 'unknown error';
        summary.errors.push({ type: 'chunk', id: chunk.id, key: chunk.text ?? chunk.id, message });
        await this.adminTasksService.log(taskId, 'error', `句块 "${chunk.text}" 准备失败，已跳过：${message}`, {
          step: 'chunk',
          meta: { chunkId: chunk.id, text: chunk.text },
        });
      } finally {
        processedItems++;
        await updateProgress('chunk');
      }
    }

    for (const pattern of patterns) {
      summary.patternChecked++;
      try {
        const result = await this.preparePattern(pattern.id, usageStats);
        if (result === 'updated') {
          summary.patternEnriched++;
          await this.adminTasksService.log(taskId, 'info', `句型 "${pattern.pattern}" 已补全`, {
            step: 'pattern',
            meta: { patternId: pattern.id, pattern: pattern.pattern, result },
          });
        } else {
          summary.patternSkipped++;
        }
        successItems++;
      } catch (error: any) {
        failedItems++;
        const message = error?.message ?? 'unknown error';
        summary.errors.push({ type: 'pattern', id: pattern.id, key: pattern.pattern ?? pattern.id, message });
        await this.adminTasksService.log(taskId, 'error', `句型 "${pattern.pattern}" 准备失败，已跳过：${message}`, {
          step: 'pattern',
          meta: { patternId: pattern.id, pattern: pattern.pattern },
        });
      } finally {
        processedItems++;
        await updateProgress('pattern');
      }
    }

    await this.adminTasksService.log(taskId, summary.errors.length ? 'warn' : 'info', '学习包内容准备完成', {
      step: 'completed',
      meta: summary,
    });
    await this.adminTasksService.markCompleted(taskId, { ...summary, usage: usageStats });
    await options?.reportProgress?.(100);
    return summary;
  }

  private async collectSceneContent(sceneId: string) {
    const topics = await this.prisma.trainingTopic.findMany({
      where: { sceneId },
      include: {
        topicVocabs: { include: { vocab: true } },
        activeChunks: { include: { chunk: { include: { examples: true } } } },
        topicPatterns: { include: { pattern: true } },
      },
    });

    const vocabById = new Map<string, any>();
    const chunkById = new Map<string, any>();
    const patternById = new Map<string, any>();
    for (const topic of topics) {
      for (const item of topic.topicVocabs) {
        if (item.vocab?.id) vocabById.set(item.vocab.id, item.vocab);
      }
      for (const item of topic.activeChunks) {
        if (item.chunk?.id) chunkById.set(item.chunk.id, item.chunk);
      }
      for (const item of topic.topicPatterns) {
        if (item.pattern?.id) patternById.set(item.pattern.id, item.pattern);
      }
    }
    return {
      vocabs: [...vocabById.values()],
      chunks: [...chunkById.values()],
      patterns: [...patternById.values()],
    };
  }

  private applyRetryFilter<T extends { vocabs: any[]; chunks: any[]; patterns: any[] }>(collected: T, retryItems?: RetryItems) {
    if (!retryItems) return collected;
    const vocabIds = new Set(retryItems.vocabulary ?? []);
    const chunkIds = new Set(retryItems.chunk ?? []);
    const patternIds = new Set(retryItems.pattern ?? []);
    return {
      vocabs: vocabIds.size ? collected.vocabs.filter((item) => vocabIds.has(item.id)) : [],
      chunks: chunkIds.size ? collected.chunks.filter((item) => chunkIds.has(item.id)) : [],
      patterns: patternIds.size ? collected.patterns.filter((item) => patternIds.has(item.id)) : [],
    };
  }

  private hasExamples(value: unknown) {
    return Array.isArray(value) && value.length > 0;
  }

  private hasChinese(value?: string | null) {
    return /[\u3400-\u9fff]/.test(value ?? '');
  }

  private static readonly VALID_DIFFICULTIES = ['L1', 'L2', 'L3', 'L4', 'L5'];

  /**
   * 阶段一：词典字段填充。以词典（dictionary_entry）为唯一数据源，
   * 词典缺失时先跑词典流水线生成。落库：音标/音频/词性/英文释义/同义词/词典例句/中文释义（词典翻译）。
   * 返回 'missing' 表示词典未收录，不进入 AI 富化阶段。
   */
  async prepareVocabularyDictionary(
    vocabId: string,
    usageStats?: AiUsageStats,
  ): Promise<'updated' | 'skipped' | 'missing'> {
    const vocab = await this.prisma.vocabulary.findUnique({ where: { id: vocabId } });
    const word = vocab?.word?.trim();
    if (!word) return 'skipped';
    const key = word.toLowerCase().trim();

    // 1) 统一数据源：dictionary_entry（缓存 miss 则跑完整流水线生成）
    let entry = (await this.prisma.dictionaryEntry.findUnique({
      where: { word: key },
    })) as unknown as DictionaryEntryData | null;
    if (!entry) {
      entry = (await this.dictionaryService.runFullPipeline(key, usageStats ? usageCallback(usageStats) : undefined)) as unknown as DictionaryEntryData | null;
    }
    if (!entry) return 'missing'; // 词典未收录该词

    const pronunciations = entry.pronunciations ?? [];
    const clusters = entry.senseClusters ?? [];
    const allSenses = clusters.flatMap((c) => c.senses);
    const primaryCluster = clusters.find((c) => c.rank === 1) ?? clusters[0];

    // 2) 音标/音频：以词典为准（isPreferred 优先）
    const us = pronunciations.find((p) => p.type === 'us' && p.isPreferred) ?? pronunciations.find((p) => p.type === 'us');
    const uk = pronunciations.find((p) => p.type === 'uk' && p.isPreferred) ?? pronunciations.find((p) => p.type === 'uk');
    const phoneticUs = us?.ipa ?? '';
    const phoneticUk = uk?.ipa ?? '';
    const audioUsUrl = us?.audioUrl ?? '';
    const audioUkUrl = uk?.audioUrl ?? '';

    // 3) 英文释义（含词典流水线翻译的中文，格式与语料库既有规范一致）
    const partOfSpeech = primaryCluster?.posBucket ?? allSenses[0]?.partOfSpeech ?? '';
    const definitionEn = allSenses
      .map((s) => `${s.partOfSpeech}: ${s.definition}${s.translations?.zh ? `  [${s.translations.zh}]` : ''}`)
      .join('; ');

    // 4) 例句：优先词典中英对照例句（按簇 rank 顺序，取前 5）
    const dictExamples: { en: string; zh: string; level: string; source: string }[] = [];
    const seenExamples = new Set<string>();
    for (const cluster of clusters) {
      for (const sense of cluster.senses) {
        for (const example of sense.examples ?? []) {
          const en = example.en?.trim();
          if (!en || seenExamples.has(en.toLowerCase())) continue;
          seenExamples.add(en.toLowerCase());
          dictExamples.push({
            en,
            zh: example.zh ?? '',
            level: 'intermediate',
            source: example.source ?? 'dictionary',
          });
        }
      }
    }
    const examples = dictExamples.slice(0, 5);
    const entrySynonyms = entry.entrySynonyms ?? [];

    // 5) 词典字段落库（AI 部分由 prepareVocabularyAi 补漏）
    // 例句：词典例句仅在已有例句为空时写入，避免重跑任务时覆盖 AI 阶段生成的例句
    const existingExamples = Array.isArray(vocab.examples) ? (vocab.examples as any[]) : [];
    const examplesForStore = existingExamples.length > 0 ? existingExamples : examples;
    await this.prisma.vocabulary.update({
      where: { id: vocabId },
      data: {
        phoneticUs: phoneticUs || (vocab.phoneticUs ?? ''),
        phoneticUk: phoneticUk || (vocab.phoneticUk ?? ''),
        audioUsUrl: audioUsUrl || (vocab.audioUsUrl ?? ''),
        audioUkUrl: audioUkUrl || (vocab.audioUkUrl ?? ''),
        partOfSpeech: partOfSpeech || (vocab.partOfSpeech ?? ''),
        definitionEn: definitionEn || vocab.definitionEn || '',
        synonyms: entrySynonyms.length ? entrySynonyms : (vocab.synonyms ?? []),
        examples: examplesForStore as Prisma.InputJsonValue,
        // 中文释义：词典翻译按词性分组拼接优先，AI 兜底在阶段二
        meaning: this.buildMeaningFromClusters(clusters) || vocab.meaning || '',
      },
    });
    return 'updated';
  }

  /**
   * 单次完整富化（词典字段 + AI 补漏），供管理后台"富化"按钮使用。
   */
  async prepareVocabularyFull(
    vocabId: string,
    usageStats?: AiUsageStats,
  ): Promise<'updated' | 'skipped'> {
    const dict = await this.prepareVocabularyDictionary(vocabId, usageStats);
    if (dict === 'missing') return 'skipped';
    return this.prepareVocabularyAi(vocabId, usageStats);
  }

  /**
   * 阶段二：AI 富化补漏。基于已落库的词典字段，补全：讲解（description）、
   * 例句不足 3 条时用 AI 原创例句、难度、音标缺失，中文释义 AI 兜底。
   * 词典未收录（definitionEn 为空）直接跳过。
   */
  async prepareVocabularyAi(
    vocabId: string,
    usageStats?: AiUsageStats,
  ): Promise<'updated' | 'skipped'> {
    const vocab = await this.prisma.vocabulary.findUnique({ where: { id: vocabId } });
    const word = vocab?.word?.trim();
    if (!word) return 'skipped';
    if (!vocab.definitionEn?.trim()) return 'skipped'; // 词典未收录，无基础数据

    // 从落库的 definitionEn 解析英文释义（保留末尾的中文翻译 [xxx]，避免 AI 重复翻译）
    const defs = (vocab.definitionEn ?? '')
      .split('; ')
      .map((d) => d.trim())
      .filter(Boolean);
    const examples: { en: string }[] = ((vocab.examples as any[]) ?? []).map((e: any) => ({ en: e.en })).filter((e) => e.en);

    // 字段完整性检查：中文释义 / 讲解 / 例句不足 3 条 / 音标缺失 / 难度无效 → 触发 AI 补漏
    const validDifficulty = ContentPrepareService.VALID_DIFFICULTIES.includes(vocab.difficulty ?? '');
    const needsAi =
      !this.hasChinese(vocab.meaning) ||
      !vocab.description?.trim() ||
      examples.length < 3 ||
      !vocab.phoneticUs ||
      !vocab.phoneticUk ||
      !validDifficulty;

    let aiResult: VocabularyAiEnrichResult | null = null;
    if (needsAi) {
      try {
        aiResult = await this.adminContentAiService.enrichVocabulary(
          {
            word,
            definitions: defs,
            examples,
            phoneticUs: vocab.phoneticUs || undefined,
            phoneticUk: vocab.phoneticUk || undefined,
            meaningExists: this.hasChinese(vocab.meaning),
            descriptionExists: !!vocab.description?.trim(),
            difficultyExists: validDifficulty,
          },
          usageStats ? usageCallback(usageStats) : undefined,
        );
      } catch {
        // AI 失败不阻塞词典字段落库
      }
    }

    // 例句：词典例句不足 3 条时用 AI 生成的原创例句补齐
    const examplesForStore = examples.length >= 3
      ? (vocab.examples as Prisma.InputJsonValue)
      : (aiResult?.generatedExamples?.length ? aiResult.generatedExamples as Prisma.InputJsonValue : (vocab.examples as Prisma.InputJsonValue));

    await this.prisma.vocabulary.update({
      where: { id: vocabId },
      data: {
        phoneticUs: vocab.phoneticUs || aiResult?.phoneticUs || '',
        phoneticUk: vocab.phoneticUk || aiResult?.phoneticUk || '',
        examples: examplesForStore,
        meaning: this.hasChinese(vocab.meaning) ? vocab.meaning : (aiResult?.meaning || vocab.meaning || ''),
        description: aiResult?.description || vocab.description || '',
        // 难度：已有有效值保留；缺失/无效时用 AI 判定值补齐
        difficulty: validDifficulty ? (vocab.difficulty ?? 'L3') : (aiResult?.difficulty || vocab.difficulty || 'L3'),
      },
    });
    return 'updated';
  }

  /** 从词典义项的中文翻译按词性分组拼接出简洁中文释义（n. 接收；接待 / v. 介绍） */
  private buildMeaningFromClusters(clusters: DictionaryEntryData['senseClusters']): string {
    const zhByPos: Record<string, string[]> = {};
    for (const cluster of clusters ?? []) {
      for (const sense of cluster.senses) {
        const zh = sense.translations?.zh?.trim();
        if (!zh) continue;
        const posKey =
          sense.partOfSpeech === 'noun' ? 'n.' :
          sense.partOfSpeech === 'verb' ? 'v.' :
          sense.partOfSpeech === 'adj' ? 'adj.' :
          sense.partOfSpeech === 'adv' ? 'adv.' :
          sense.partOfSpeech;
        if (!posKey) continue;
        if (!zhByPos[posKey]) zhByPos[posKey] = [];
        const clean = zh
          .replace(/[（(][^)）]*[)）]/g, '')
          .replace(/^[。，,、\s]+|[。，,、\s]+$/g, '');
        if (clean && !zhByPos[posKey].includes(clean)) zhByPos[posKey].push(clean);
      }
    }
    if (Object.keys(zhByPos).length === 0) return '';
    return Object.entries(zhByPos)
      .map(([pos, zhs]) => `${pos} ${zhs.join('；')}`)
      .join(' / ');
  }

  private async prepareChunk(
    chunkId: string,
    usageStats?: AiUsageStats,
  ): Promise<'updated' | 'skipped'> {
    const chunk = await this.prisma.chunk.findUnique({
      where: { id: chunkId },
      include: { examples: true },
    });
    if (!chunk) return 'skipped';
    if (chunk.description?.trim() && chunk.examples.length > 0) return 'skipped';

    const generated = await this.adminContentAiService.enrichChunk(
      {
        text: chunk.text,
        meaning: chunk.meaning ?? '',
      },
      usageStats ? usageCallback(usageStats) : undefined,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.chunkExample.deleteMany({ where: { chunkId } });
      await tx.chunk.update({
        where: { id: chunkId },
        data: {
          description: generated.description || chunk.description,
          examples: generated.examples.length
            ? { create: generated.examples.map((example, index) => ({ ...example, sortOrder: index })) }
            : undefined,
        },
      });
    });
    return 'updated';
  }

  private async preparePattern(
    patternId: string,
    usageStats?: AiUsageStats,
  ): Promise<'updated' | 'skipped'> {
    const pattern = await this.prisma.sentencePattern.findUnique({ where: { id: patternId } });
    if (!pattern) return 'skipped';
    if (pattern.description?.trim() && this.hasExamples(pattern.examples)) return 'skipped';

    const generated = await this.adminContentAiService.enrichPattern(
      {
        pattern: pattern.pattern,
        meaning: pattern.meaning ?? '',
      },
      usageStats ? usageCallback(usageStats) : undefined,
    );

    await this.prisma.sentencePattern.update({
      where: { id: patternId },
      data: {
        description: generated.description || pattern.description,
        examples: generated.examples.length ? generated.examples as Prisma.InputJsonValue : pattern.examples as Prisma.InputJsonValue,
      },
    });
    return 'updated';
  }
}
