import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { alignDescriptionLayout } from '../../admin/description-layout';
import { vocabularyMeaningMissingPosPrefix } from '../../admin/vocabulary-meaning.util';
import { AdminTasksService } from '../admin-tasks.service';
import { AdminContentAiService } from '../../admin/admin-content-ai.service';
import {
  AI_ENRICH_CONCURRENCY,
  createUsageStats,
  runConcurrent,
  usageCallback,
} from './content-prepare.service';
import {
  listChunkIds,
  listPatternIds,
  listVocabularyIds,
  type TextLibraryFilter,
  type VocabularyLibraryFilter,
} from './library-list-scope';

export const VOCABULARY_BATCH_FIELDS = ['meaning', 'description', 'examples', 'definition', 'pronunciation', 'difficulty'] as const;
export const TEXT_BATCH_FIELDS = ['meaning', 'description', 'examples'] as const;
export type LibraryBatchField = typeof VOCABULARY_BATCH_FIELDS[number];
export type LibraryBatchMode = 'fill' | 'regenerate';
export type LibraryBatchKind = 'vocabulary' | 'chunk' | 'pattern';

export const LIBRARY_FIELD_LABEL: Record<LibraryBatchField, string> = {
  meaning: '中文释义',
  description: '讲解',
  examples: '例句',
  definition: '英文释义',
  pronunciation: '音标与发音',
  difficulty: '难度',
};

const DIFFICULTIES = new Set(['L1', 'L2', 'L3', 'L4', 'L5']);
const hasChinese = (value?: string | null) => /[\u3400-\u9fff]/.test(value ?? '');
/** 同步材料时写入的占位释义，不算已有中文。 */
const isPlaceholderMeaning = (value?: string | null) => /^待补充[\s.。…]*$/.test((value ?? '').trim());
const meaningForPrompt = (value?: string | null) => (isPlaceholderMeaning(value) ? '' : (value ?? '').trim());

type ExampleRow = { id?: string; en?: string; zh?: string; level?: string; note?: string; audioUrl?: string | null };

@Injectable()
export class LibraryFieldBatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminTasksService: AdminTasksService,
    private readonly adminContentAiService: AdminContentAiService,
  ) {}

  async run(taskId: string) {
    if (!await this.adminTasksService.markRunning(taskId, 'scan')) return;
    const task = await this.prisma.adminTask.findUnique({ where: { id: taskId }, select: { payload: true } });
    const payload = (task?.payload ?? {}) as {
      kind?: LibraryBatchKind;
      mode?: LibraryBatchMode;
      fields?: LibraryBatchField[];
      libraryFilter?: VocabularyLibraryFilter & TextLibraryFilter;
    };
    const kind = payload.kind ?? 'vocabulary';
    const mode = payload.mode === 'regenerate' ? 'regenerate' : 'fill';
    const fields = new Set((payload.fields ?? []).filter((field): field is LibraryBatchField => field in LIBRARY_FIELD_LABEL));
    const ids = kind === 'chunk'
      ? await listChunkIds(this.prisma, payload.libraryFilter)
      : kind === 'pattern'
        ? await listPatternIds(this.prisma, payload.libraryFilter)
        : await listVocabularyIds(this.prisma, payload.libraryFilter);

    const usage = createUsageStats();
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; label: string; message: string }> = [];
    await this.adminTasksService.log(taskId, 'info', `按筛选结果处理 ${ids.length} 条，模式 ${mode === 'fill' ? '补全缺失' : '重新生成'}，字段 ${[...fields].map((field) => LIBRARY_FIELD_LABEL[field]).join('、')}`, {
      step: 'scope',
      meta: { matchedCount: ids.length, mode, fields: [...fields] },
    });

    for (let index = 0; index < ids.length; index += 100) {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const slice = ids.slice(index, index + 100);
      const outcome = kind === 'vocabulary'
        ? await this.processVocabularies(taskId, slice, mode, fields, usage, errors)
        : kind === 'chunk'
          ? await this.processChunks(taskId, slice, mode, fields, usage, errors)
          : await this.processPatterns(taskId, slice, mode, fields, usage, errors);
      updated += outcome.updated;
      skipped += outcome.skipped;
      failed += outcome.failed;
      await this.adminTasksService.setProgress(taskId, {
        currentStep: `${mode} ${Math.min(index + slice.length, ids.length)}/${ids.length}`,
        totalItems: ids.length,
        processedItems: Math.min(index + slice.length, ids.length),
        successItems: updated,
        failedItems: failed,
      });
    }

    const summary = { total: ids.length, updated, skipped, failed, errors: errors.slice(0, 30), usage, mode, fields: [...fields] };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `字段批量处理完成：更新 ${updated}，跳过 ${skipped}，失败 ${failed}`, {
      step: 'completed',
      meta: summary,
    });
    return summary;
  }

  private async processVocabularies(
    taskId: string,
    ids: string[],
    mode: LibraryBatchMode,
    fields: Set<LibraryBatchField>,
    usage: ReturnType<typeof createUsageStats>,
    errors: Array<{ id: string; label: string; message: string }>,
  ) {
    const rows = await this.prisma.vocabulary.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, word: true, meaning: true, description: true, examples: true,
        definitionEn: true, phoneticUs: true, phoneticUk: true, audioUsUrl: true, audioUkUrl: true, difficulty: true,
      },
    });
    const dictionary = fields.has('pronunciation') ? await this.dictionaryByWord(rows.map((row) => row.word)) : new Map();
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    await runConcurrent(rows, AI_ENRICH_CONCURRENCY, async (row) => {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      try {
        const data: Prisma.VocabularyUpdateInput = {};
        if (fields.has('description') && mode === 'regenerate' && row.description?.trim()) {
          const next = alignDescriptionLayout(row.description);
          if (next && next !== row.description.trim()) data.description = next;
        }
        if (fields.has('pronunciation')) {
          Object.assign(data, this.pronunciationPatch(row, dictionary.get(row.word.trim().toLowerCase()), mode));
        }
        const touchMeaning = fields.has('meaning') && this.needsMeaning(row.meaning, mode);
        const touchDescription = fields.has('description') && mode === 'fill' && !row.description?.trim();
        const touchExamples = fields.has('examples') && this.needsExamples(row.examples, mode);
        const touchDefinition = fields.has('definition') && this.needsDefinition(row.definitionEn, mode);
        const touchDifficulty = fields.has('difficulty') && this.needsDifficulty(row.difficulty, mode);
        if (touchMeaning || touchDescription || touchExamples || (touchDefinition && mode === 'regenerate') || touchDifficulty) {
          const definitions = (row.definitionEn ?? '').split('; ').map((item) => item.trim()).filter(Boolean);
          const generated = await this.adminContentAiService.enrichVocabulary({
            word: row.word,
            definitions,
            examples: this.exampleEns(row.examples),
            phoneticUs: row.phoneticUs || '(preserve)',
            phoneticUk: row.phoneticUk || '(preserve)',
            meaningExists: !touchMeaning,
            descriptionExists: !touchDescription,
            difficultyExists: !touchDifficulty,
            forceLearnerRewrite: mode === 'regenerate' && (touchMeaning || touchDefinition || touchExamples),
          }, usageCallback(usage));
          if (touchMeaning && generated.meaning.trim() && !isPlaceholderMeaning(generated.meaning)) data.meaning = generated.meaning.trim();
          if (touchDescription && generated.description.trim()) data.description = generated.description.trim();
          if (touchExamples && generated.generatedExamples.length) data.examples = generated.generatedExamples as Prisma.InputJsonValue;
          if (touchDefinition && generated.learnerDefinitions.length) data.definitionEn = generated.learnerDefinitions.join('; ');
          if (touchDifficulty && generated.difficulty) data.difficulty = generated.difficulty;
        }
        if (touchDefinition && mode === 'fill') {
          const review = await this.adminContentAiService.reviewVocabularyDefinitionAndDifficulty({
            word: row.word,
            definitions: (row.definitionEn ?? '').split('; ').map((item) => item.trim()).filter(Boolean),
            meaning: row.meaning ?? '',
            translateMissingDefinitions: true,
          }, usageCallback(usage));
          const bilingual = this.bilingualDefinitions(row.definitionEn ?? '', review.definitionTranslations);
          if (bilingual && hasChinese(bilingual)) data.definitionEn = bilingual;
          if (touchDifficulty && review.difficulty) data.difficulty = review.difficulty;
        }
        if (!Object.keys(data).length) {
          skipped++;
          return;
        }
        await this.prisma.vocabulary.update({ where: { id: row.id }, data });
        updated++;
      } catch (error: any) {
        failed++;
        errors.push({ id: row.id, label: row.word, message: error?.message ?? 'unknown error' });
      }
    });
    return { updated, skipped, failed };
  }

  private async processChunks(
    taskId: string,
    ids: string[],
    mode: LibraryBatchMode,
    fields: Set<LibraryBatchField>,
    usage: ReturnType<typeof createUsageStats>,
    errors: Array<{ id: string; label: string; message: string }>,
  ) {
    const rows = await this.prisma.chunk.findMany({
      where: { id: { in: ids } },
      select: { id: true, text: true, meaning: true, description: true, examples: { select: { id: true, en: true, zh: true, level: true, sortOrder: true } } },
    });
    return this.processTextRows(taskId, rows.map((row) => ({
      id: row.id,
      label: row.text,
      meaning: row.meaning,
      description: row.description,
      examples: row.examples,
    })), mode, fields, usage, errors, 'chunk');
  }

  private async processPatterns(
    taskId: string,
    ids: string[],
    mode: LibraryBatchMode,
    fields: Set<LibraryBatchField>,
    usage: ReturnType<typeof createUsageStats>,
    errors: Array<{ id: string; label: string; message: string }>,
  ) {
    const rows = await this.prisma.sentencePattern.findMany({
      where: { id: { in: ids } },
      select: { id: true, pattern: true, meaning: true, description: true, examples: true },
    });
    return this.processTextRows(taskId, rows.map((row) => ({
      id: row.id,
      label: row.pattern,
      meaning: row.meaning,
      description: row.description,
      examples: Array.isArray(row.examples) ? row.examples as ExampleRow[] : [],
    })), mode, fields, usage, errors, 'pattern');
  }

  private async processTextRows(
    taskId: string,
    rows: Array<{ id: string; label: string; meaning: string | null; description: string | null; examples: ExampleRow[] }>,
    mode: LibraryBatchMode,
    fields: Set<LibraryBatchField>,
    usage: ReturnType<typeof createUsageStats>,
    errors: Array<{ id: string; label: string; message: string }>,
    kind: 'chunk' | 'pattern',
  ) {
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    await runConcurrent(rows, AI_ENRICH_CONCURRENCY, async (row) => {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      try {
        const data: { meaning?: string; description?: string } = {};
        let replaceExamples: Array<{ en: string; zh: string; level: string }> | null = null;
        let patchedExamples: ExampleRow[] | null = null;
        if (fields.has('description') && mode === 'regenerate' && row.description?.trim()) {
          const next = alignDescriptionLayout(row.description);
          if (next && next !== row.description.trim()) data.description = next;
        }
        const placeholderMeaning = isPlaceholderMeaning(row.meaning);
        const touchMeaning = fields.has('meaning') && (mode === 'fill'
          ? !hasChinese(row.meaning) || placeholderMeaning
          : hasChinese(row.meaning) && !placeholderMeaning);
        const touchDescription = fields.has('description') && mode === 'fill' && !row.description?.trim();
        const touchExamples = fields.has('examples') && this.needsExamples(row.examples, mode);
        if (touchMeaning || touchDescription || touchExamples) {
          const generated = kind === 'chunk'
            ? await this.adminContentAiService.enrichChunk({ text: row.label, meaning: meaningForPrompt(row.meaning) }, usageCallback(usage))
            : await this.adminContentAiService.enrichPattern({ pattern: row.label, meaning: meaningForPrompt(row.meaning) }, usageCallback(usage));
          if (touchMeaning && generated.meaning.trim() && !isPlaceholderMeaning(generated.meaning)) data.meaning = generated.meaning.trim();
          if (touchDescription && generated.description.trim()) data.description = generated.description.trim();
          if (touchExamples && generated.examples.length) {
            const next = generated.examples
              .map((example) => ({ en: example.en, zh: example.zh, level: example.level || 'intermediate' }))
              .filter((example) => example.en && example.zh);
            if (mode === 'regenerate' || row.examples.length === 0) replaceExamples = next;
            else {
              patchedExamples = row.examples.map((example, index) => (
                example.zh?.trim() ? example : { ...example, zh: next[index]?.zh || example.zh || '' }
              ));
            }
          }
        }
        const examplesChanged = !!replaceExamples || !!patchedExamples?.some((example, index) => example.zh !== row.examples[index]?.zh);
        if (!data.meaning && !data.description && !examplesChanged) {
          skipped++;
          return;
        }
        if (kind === 'chunk') {
          if (data.meaning || data.description) await this.prisma.chunk.update({ where: { id: row.id }, data });
          if (replaceExamples) {
            await this.prisma.chunkExample.deleteMany({ where: { chunkId: row.id } });
            await this.prisma.chunkExample.createMany({
              data: replaceExamples.map((example, sortOrder) => ({ chunkId: row.id, ...example, sortOrder })),
            });
          } else if (patchedExamples) {
            await Promise.all(patchedExamples.map((example) => (
              example.id
                ? this.prisma.chunkExample.update({ where: { id: example.id }, data: { zh: example.zh ?? '' } })
                : Promise.resolve()
            )));
          }
        } else {
          await this.prisma.sentencePattern.update({
            where: { id: row.id },
            data: {
              ...data,
              ...(replaceExamples
                ? { examples: replaceExamples as Prisma.InputJsonValue }
                : patchedExamples
                  ? { examples: patchedExamples as Prisma.InputJsonValue }
                  : {}),
            },
          });
        }
        updated++;
      } catch (error: any) {
        failed++;
        errors.push({ id: row.id, label: row.label, message: error?.message ?? 'unknown error' });
      }
    });
    return { updated, skipped, failed };
  }

  private needsMeaning(meaning: string | null, mode: LibraryBatchMode) {
    const text = meaning ?? '';
    const missing = !hasChinese(text) || isPlaceholderMeaning(text) || /other/i.test(text) || vocabularyMeaningMissingPosPrefix(text);
    return mode === 'fill' ? missing : hasChinese(text) && !isPlaceholderMeaning(text);
  }

  private needsExamples(value: unknown, mode: LibraryBatchMode) {
    const examples = Array.isArray(value) ? value as ExampleRow[] : [];
    const missing = examples.length === 0 || examples.some((example) => !example?.zh?.trim());
    return mode === 'fill' ? missing : examples.length > 0;
  }

  private needsDefinition(definitionEn: string | null, mode: LibraryBatchMode) {
    const text = definitionEn?.trim() ?? '';
    if (!text) return false;
    return mode === 'fill' ? !hasChinese(text) : true;
  }

  private needsDifficulty(difficulty: string | null, mode: LibraryBatchMode) {
    const valid = DIFFICULTIES.has(difficulty ?? '');
    return mode === 'fill' ? !valid : valid;
  }

  private exampleEns(value: unknown) {
    return (Array.isArray(value) ? value as ExampleRow[] : [])
      .map((example) => ({ en: String(example?.en ?? '').trim() }))
      .filter((example) => example.en);
  }

  private bilingualDefinitions(definitionEn: string, translations: string[]) {
    return definitionEn.split('; ').map((definition, index) => {
      const text = definition.trim();
      if (!text || hasChinese(text)) return text;
      const translation = translations[index]?.replace(/^\[|\]$/g, '').trim();
      return translation ? `${text}  [${translation}]` : text;
    }).filter(Boolean).join('; ');
  }

  private async dictionaryByWord(words: string[]) {
    const keys = [...new Set(words.map((word) => word.trim().toLowerCase()).filter(Boolean))];
    const entries = keys.length
      ? await this.prisma.dictionaryEntry.findMany({
        where: { word: { in: keys } },
        select: { word: true, pronunciations: true },
      })
      : [];
    return new Map(entries.map((entry) => [entry.word.toLowerCase(), entry.pronunciations]));
  }

  private pronunciationPatch(
    row: { phoneticUs: string | null; phoneticUk: string | null; audioUsUrl: string | null; audioUkUrl: string | null },
    pronunciations: unknown,
    mode: LibraryBatchMode,
  ): Prisma.VocabularyUpdateInput {
    const list = Array.isArray(pronunciations) ? pronunciations as Array<{ type?: string; isPreferred?: boolean; ipa?: string; audioUrl?: string }> : [];
    const pick = (type: 'us' | 'uk') => list.find((item) => item?.type === type && item?.isPreferred) ?? list.find((item) => item?.type === type);
    const us = pick('us');
    const uk = pick('uk');
    const data: Prisma.VocabularyUpdateInput = {};
    const assign = (current: string | null, next: string | undefined, key: 'phoneticUs' | 'phoneticUk' | 'audioUsUrl' | 'audioUkUrl') => {
      const value = next?.trim();
      if (!value) return;
      if (mode === 'fill' && current?.trim()) return;
      if (current?.trim() === value) return;
      data[key] = value;
    };
    assign(row.phoneticUs, us?.ipa, 'phoneticUs');
    assign(row.phoneticUk, uk?.ipa, 'phoneticUk');
    assign(row.audioUsUrl, us?.audioUrl, 'audioUsUrl');
    assign(row.audioUkUrl, uk?.audioUrl, 'audioUkUrl');
    const missing = !row.phoneticUs?.trim() || !row.phoneticUk?.trim() || !row.audioUsUrl?.trim() || !row.audioUkUrl?.trim();
    if (mode === 'fill' && !missing) return {};
    if (mode === 'regenerate' && !row.phoneticUs && !row.phoneticUk && !row.audioUsUrl && !row.audioUkUrl && !us && !uk) return {};
    return data;
  }
}
