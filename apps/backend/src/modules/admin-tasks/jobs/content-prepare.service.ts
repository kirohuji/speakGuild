import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AdminContentAiService } from '../../admin/admin-content-ai.service';
import { AdminTasksService } from '../admin-tasks.service';

interface FreeDictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
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

@Injectable()
export class ContentPrepareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminTasksService: AdminTasksService,
    private readonly adminContentAiService: AdminContentAiService,
  ) {}

  async run(taskId: string, sceneId: string, options?: {
    reportProgress?: (progress: number) => Promise<void> | void;
    retryItems?: RetryItems;
  }) {
    await this.adminTasksService.markRunning(taskId, 'scan');
    await this.adminTasksService.log(taskId, 'info', '开始扫描学习包内容', { step: 'scan', meta: { sceneId } });

    const collected = await this.collectSceneContent(sceneId);
    const { vocabs, chunks, patterns } = this.applyRetryFilter(collected, options?.retryItems);
    const totalItems = vocabs.length + chunks.length + patterns.length;
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

    for (const vocab of vocabs) {
      summary.vocabChecked++;
      try {
        const result = await this.prepareVocabulary(vocab.id);
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
        await this.adminTasksService.log(taskId, 'error', `词汇 "${vocab.word}" 准备失败，已跳过：${message}`, {
          step: 'vocabulary',
          meta: { vocabId: vocab.id, word: vocab.word },
        });
      } finally {
        processedItems++;
        await updateProgress('vocabulary');
      }
    }

    for (const chunk of chunks) {
      summary.chunkChecked++;
      try {
        const result = await this.prepareChunk(chunk.id);
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
        const result = await this.preparePattern(pattern.id);
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
    await this.adminTasksService.markCompleted(taskId, summary);
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

  private async prepareVocabulary(vocabId: string): Promise<'updated' | 'skipped'> {
    const vocab = await this.prisma.vocabulary.findUnique({ where: { id: vocabId } });
    if (!vocab?.word?.trim()) return 'skipped';
    if (
      vocab.definitionEn?.trim() &&
      vocab.description?.trim() &&
      this.hasExamples(vocab.examples) &&
      (vocab.phoneticUs?.trim() || vocab.phoneticUk?.trim()) &&
      (vocab.audioUsUrl?.trim() || vocab.audioUkUrl?.trim())
    ) {
      return 'skipped';
    }

    const entry = await this.lookupFreeDictionaryEntry(vocab.word);
    if (!entry) return 'skipped';

    const fields = await this.buildVocabularyFields(vocab.word.trim(), entry);
    await this.prisma.vocabulary.update({
      where: { id: vocabId },
      data: {
        ...fields,
        examples: fields.examples as Prisma.InputJsonValue,
      },
    });
    return 'updated';
  }

  private async lookupFreeDictionaryEntry(word: string): Promise<FreeDictionaryEntry | null> {
    const key = word.toLowerCase().trim();
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
    if (!response.ok) return null;
    const entries = (await response.json()) as FreeDictionaryEntry[];
    return entries?.[0] ?? null;
  }

  private getBestPhonetic(entry: FreeDictionaryEntry) {
    if (entry.phonetic) return entry.phonetic;
    return entry.phonetics?.find((p) => p.text)?.text ?? '';
  }

  private normalizeAudio(url?: string) {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    return url;
  }

  private deriveMeaning(definitionsEn: string): string {
    if (!definitionsEn?.includes('; ')) return '';
    const zhByPos: Record<string, string[]> = {};
    definitionsEn.split('; ').forEach((definition) => {
      const colonIdx = definition.indexOf(': ');
      const posRaw = colonIdx > 0 ? definition.slice(0, colonIdx) : '';
      const pos = posRaw === 'verb' ? 'v.' : posRaw === 'noun' ? 'n.' : posRaw === 'adj' ? 'adj.' : posRaw === 'adv' ? 'adv.' : posRaw;
      const zhMatch = definition.match(/\s\s\[(.+?)\]$/);
      if (zhMatch && pos) {
        if (!zhByPos[pos]) zhByPos[pos] = [];
        const zhClean = zhMatch[1]
          .replace(/[（(][^)）]*[)）]/g, '')
          .replace(/^[。，,、\s]+|[。，,、\s]+$/g, '');
        if (zhClean && !zhByPos[pos].includes(zhClean)) zhByPos[pos].push(zhClean);
      }
    });
    return Object.entries(zhByPos)
      .map(([pos, zhs]) => `${pos} ${zhs.join('；')}`)
      .join(' / ');
  }

  private async buildVocabularyFields(word: string, entry: FreeDictionaryEntry) {
    const phonetic = this.getBestPhonetic(entry);
    const phoneticsWithAudio = entry.phonetics?.filter((p) => p.audio) ?? [];
    const usAudio = this.normalizeAudio(phoneticsWithAudio[0]?.audio);
    const ukAudio = this.normalizeAudio(phoneticsWithAudio[1]?.audio);
    const pos = entry.meanings?.[0]?.partOfSpeech || '';
    const definitions = entry.meanings?.flatMap((meaning) =>
      meaning.definitions.map((definition) => `${meaning.partOfSpeech}: ${definition.definition}`),
    ) ?? [];

    const dictExamples: { en: string; zh: string; level: string }[] = [];
    const seenExamples = new Set<string>();
    entry.meanings?.forEach((meaning) => {
      meaning.definitions.forEach((definition) => {
        if (definition.example && !seenExamples.has(definition.example)) {
          seenExamples.add(definition.example);
          dictExamples.push({ en: definition.example, zh: '', level: 'intermediate' });
        }
      });
    });
    const examples = dictExamples.slice(0, 5);

    let aiResult: Awaited<ReturnType<AdminContentAiService['enrichVocabulary']>> | null = null;
    try {
      aiResult = await this.adminContentAiService.enrichVocabulary({
        word,
        definitions,
        examples: examples.map((example) => ({ en: example.en })),
        phoneticUs: phonetic || undefined,
        phoneticUk: (entry.phonetics?.length && entry.phonetics.length > 1 ? entry.phonetics[1]?.text : undefined) || undefined,
      });
    } catch (error: any) {
      // AI failure should not discard dictionary fields.
    }

    const defsWithZh = definitions.map((definition, index) => {
      const zh = aiResult?.definitionTranslations?.[index] ?? '';
      return zh ? `${definition}  [${zh}]` : definition;
    }).join('; ');

    const generatedExamples = aiResult?.generatedExamples?.length
      ? aiResult.generatedExamples
      : examples;
    const dictPhoneticUk = entry.phonetics?.[1]?.text ?? entry.phonetics?.[0]?.text ?? '';

    return {
      audioUsUrl: usAudio,
      audioUkUrl: ukAudio,
      phoneticUs: aiResult?.phoneticUs || phonetic || '',
      phoneticUk: aiResult?.phoneticUk || dictPhoneticUk || '',
      definitionEn: defsWithZh,
      partOfSpeech: pos,
      examples: generatedExamples,
      description: aiResult?.description || undefined,
      meaning: aiResult?.meaning || this.deriveMeaning(defsWithZh),
    };
  }

  private async prepareChunk(chunkId: string): Promise<'updated' | 'skipped'> {
    const chunk = await this.prisma.chunk.findUnique({
      where: { id: chunkId },
      include: { examples: true },
    });
    if (!chunk) return 'skipped';
    if (chunk.description?.trim() && chunk.examples.length > 0) return 'skipped';

    const generated = await this.adminContentAiService.enrichChunk({
      text: chunk.text,
      meaning: chunk.meaning ?? '',
    });

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

  private async preparePattern(patternId: string): Promise<'updated' | 'skipped'> {
    const pattern = await this.prisma.sentencePattern.findUnique({ where: { id: patternId } });
    if (!pattern) return 'skipped';
    if (pattern.description?.trim() && this.hasExamples(pattern.examples)) return 'skipped';

    const generated = await this.adminContentAiService.enrichPattern({
      pattern: pattern.pattern,
      meaning: pattern.meaning ?? '',
    });

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
