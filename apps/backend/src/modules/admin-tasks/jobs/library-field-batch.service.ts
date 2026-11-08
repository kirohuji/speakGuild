import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { alignDescriptionLayout, descriptionHasCanonicalLayout } from '../../admin/description-layout';
import {
  buildPronunciationPatch,
  definitionNeedsWork,
  descriptionNeedsWork,
  difficultyNeedsWork,
  examplesNeedWork,
  meaningNeedsWork,
} from './library-field-rules';
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

const hasChinese = (value?: string | null) => /[\u3400-\u9fff]/.test(value ?? '');
/** 同步材料时写入的占位释义，不算已有中文。 */
const isPlaceholderMeaning = (value?: string | null) => /^待补充[\s.。…]*$/.test((value ?? '').trim());
const meaningForPrompt = (value?: string | null) => (isPlaceholderMeaning(value) ? '' : (value ?? '').trim());

type ExampleRow = { id?: string; en?: string; zh?: string; level?: string; note?: string; audioUrl?: string | null };

type FilterFieldStat = { key: LibraryBatchField; label: string; passed: number; needsWork: number };
type FilterSnapshot = { scanned: number; passed: number; needsWork: number; fields: FilterFieldStat[] };

function emptyFilter(fields: LibraryBatchField[]): FilterSnapshot {
  return {
    scanned: 0,
    passed: 0,
    needsWork: 0,
    fields: fields.map((field) => ({ key: field, label: LIBRARY_FIELD_LABEL[field], passed: 0, needsWork: 0 })),
  };
}

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
      targetIds?: string[];
      applyScreenedSet?: boolean;
    };
    const kind = payload.kind ?? 'vocabulary';
    const mode = payload.mode === 'regenerate' ? 'regenerate' : 'fill';
    const fields = new Set((payload.fields ?? []).filter((field): field is LibraryBatchField => field in LIBRARY_FIELD_LABEL));
    const screenedIds = payload.applyScreenedSet
      ? (payload.targetIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)
      : null;
    const ids = screenedIds
      ?? (kind === 'chunk'
        ? await listChunkIds(this.prisma, payload.libraryFilter)
        : kind === 'pattern'
          ? await listPatternIds(this.prisma, payload.libraryFilter)
          : await listVocabularyIds(this.prisma, payload.libraryFilter));

    const usage = createUsageStats();
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; label: string; message: string }> = [];
    const selectedFields = [...fields];
    const filter = emptyFilter(selectedFields);
    const needsWorkIds: string[] = [];
    if (screenedIds) {
      needsWorkIds.push(...ids);
      filter.scanned = ids.length;
      filter.needsWork = ids.length;
      filter.fields.forEach((field) => { field.needsWork = ids.length; });
      await this.adminTasksService.log(taskId, 'info', `沿用筛查结果 ${ids.length} 条，直接处理已选字段，不再重新过滤。`, { step: 'filter' });
      await this.adminTasksService.setProgress(taskId, {
        currentStep: `filter:${ids.length}/${ids.length}`,
        totalItems: ids.length,
        processedItems: 0,
        successItems: 0,
        failedItems: 0,
      });
    } else {
      await this.adminTasksService.log(taskId, 'info', `开始过滤 ${ids.length} 条。先用规则检查已选字段，已符合的不送去生成。`, { step: 'filter' });
      for (let index = 0; index < ids.length; index += 200) {
        if (await this.adminTasksService.isCanceled(taskId)) return;
        const slice = ids.slice(index, index + 200);
        const classified = kind === 'vocabulary'
          ? await this.classifyVocabularies(slice, mode, fields)
          : kind === 'chunk'
            ? await this.classifyChunks(slice, mode, fields)
            : await this.classifyPatterns(slice, mode, fields);
        for (const item of classified) {
          filter.scanned += 1;
          if (item.needsWork) {
            filter.needsWork += 1;
            needsWorkIds.push(item.id);
          } else {
            filter.passed += 1;
          }
          filter.fields.forEach((field) => {
            if (item.fields[field.key]) field.needsWork += 1;
            else field.passed += 1;
          });
        }
        const scanned = Math.min(index + slice.length, ids.length);
        await this.adminTasksService.setProgress(taskId, {
          currentStep: `filter:${scanned}/${ids.length}`,
          totalItems: ids.length,
          processedItems: scanned,
          successItems: 0,
          failedItems: 0,
        });
        await this.adminTasksService.saveRunningSummary(taskId, { filter });
      }
      const fieldText = filter.fields.map((field) => `${field.label}需处理 ${field.needsWork}`).join('，');
      await this.adminTasksService.log(taskId, 'info', `过滤完成：已检查 ${filter.scanned}，已符合 ${filter.passed}，需要处理 ${filter.needsWork}。${fieldText}`, { step: 'filter' });
    }

    for (let index = 0; index < needsWorkIds.length; index += 100) {
      if (await this.adminTasksService.isCanceled(taskId)) return;
      const slice = needsWorkIds.slice(index, index + 100);
      const outcome = kind === 'vocabulary'
        ? await this.processVocabularies(taskId, slice, mode, fields, usage, errors, Boolean(screenedIds))
        : kind === 'chunk'
          ? await this.processChunks(taskId, slice, mode, fields, usage, errors, Boolean(screenedIds))
          : await this.processPatterns(taskId, slice, mode, fields, usage, errors, Boolean(screenedIds));
      updated += outcome.updated;
      skipped += outcome.skipped;
      failed += outcome.failed;
      const done = Math.min(index + slice.length, needsWorkIds.length);
      await this.adminTasksService.setProgress(taskId, {
        currentStep: `generate:${done}/${needsWorkIds.length}`,
        totalItems: ids.length,
        processedItems: filter.passed + done,
        successItems: updated,
        failedItems: failed,
      });
    }

    const summary = { total: ids.length, updated, skipped, failed, filter, errors: errors.slice(0, 30), usage, mode, fields: selectedFields };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `字段批量处理完成：更新 ${updated}，跳过 ${skipped}，失败 ${failed}`, {
      step: 'completed',
      meta: summary,
    });
    return summary;
  }

  private noteFields(needs: Partial<Record<LibraryBatchField, boolean>>) {
    const fields = {} as Record<LibraryBatchField, boolean>;
    (Object.keys(needs) as LibraryBatchField[]).forEach((field) => {
      fields[field] = Boolean(needs[field]);
    });
    return { needsWork: Object.values(fields).some(Boolean), fields };
  }

  private async classifyVocabularies(ids: string[], mode: LibraryBatchMode, fields: Set<LibraryBatchField>) {
    const rows = await this.prisma.vocabulary.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, word: true, meaning: true, description: true, examples: true,
        definitionEn: true, phoneticUs: true, phoneticUk: true, audioUsUrl: true, audioUkUrl: true, difficulty: true,
      },
    });
    const dictionary = fields.has('pronunciation') ? await this.dictionaryByWord(rows.map((row) => row.word)) : new Map();
    return rows.map((row) => {
      const needs: Partial<Record<LibraryBatchField, boolean>> = {};
      if (fields.has('meaning')) needs.meaning = meaningNeedsWork(row.meaning, mode, 'vocabulary');
      if (fields.has('description')) needs.description = descriptionNeedsWork(row.description, mode, 'vocabulary');
      if (fields.has('examples')) needs.examples = examplesNeedWork(row.examples, mode);
      if (fields.has('definition')) needs.definition = definitionNeedsWork(row.definitionEn, mode);
      if (fields.has('difficulty')) needs.difficulty = difficultyNeedsWork(row.difficulty, mode);
      if (fields.has('pronunciation')) {
        needs.pronunciation = Object.keys(buildPronunciationPatch(row, dictionary.get(row.word.trim().toLowerCase()), mode)).length > 0;
      }
      return { id: row.id, ...this.noteFields(needs) };
    });
  }

  private async classifyChunks(ids: string[], mode: LibraryBatchMode, fields: Set<LibraryBatchField>) {
    const rows = await this.prisma.chunk.findMany({
      where: { id: { in: ids } },
      select: { id: true, meaning: true, description: true, examples: { select: { zh: true } } },
    });
    return rows.map((row) => ({ id: row.id, ...this.noteFields(this.textFieldNeeds(row.meaning, row.description, row.examples, mode, fields)) }));
  }

  private async classifyPatterns(ids: string[], mode: LibraryBatchMode, fields: Set<LibraryBatchField>) {
    const rows = await this.prisma.sentencePattern.findMany({
      where: { id: { in: ids } },
      select: { id: true, meaning: true, description: true, examples: true },
    });
    return rows.map((row) => ({
      id: row.id,
      ...this.noteFields(this.textFieldNeeds(row.meaning, row.description, Array.isArray(row.examples) ? row.examples as ExampleRow[] : [], mode, fields)),
    }));
  }

  private textFieldNeeds(
    meaning: string | null,
    description: string | null,
    examples: ExampleRow[],
    mode: LibraryBatchMode,
    fields: Set<LibraryBatchField>,
  ) {
    const needs: Partial<Record<LibraryBatchField, boolean>> = {};
    if (fields.has('meaning')) needs.meaning = meaningNeedsWork(meaning, mode, 'text');
    if (fields.has('description')) needs.description = descriptionNeedsWork(description, mode, 'text');
    if (fields.has('examples')) needs.examples = examplesNeedWork(examples, mode);
    return needs;
  }

  private async processVocabularies(
    taskId: string,
    ids: string[],
    mode: LibraryBatchMode,
    fields: Set<LibraryBatchField>,
    usage: ReturnType<typeof createUsageStats>,
    errors: Array<{ id: string; label: string; message: string }>,
    applyAll = false,
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
        const selected = (field: LibraryBatchField, needs: boolean) => fields.has(field) && (applyAll || needs);
        if (selected('description', descriptionNeedsWork(row.description, mode, 'vocabulary')) && mode === 'regenerate') {
          const next = alignDescriptionLayout(row.description ?? '');
          if (next && next !== row.description?.trim()) data.description = next;
        }
        if (fields.has('pronunciation')) {
          Object.assign(data, buildPronunciationPatch(row, dictionary.get(row.word.trim().toLowerCase()), mode));
        }
        const touchMeaning = selected('meaning', meaningNeedsWork(row.meaning, mode, 'vocabulary'));
        const touchDescription = selected('description', descriptionNeedsWork(row.description, mode, 'vocabulary')) && mode === 'fill';
        const touchExamples = selected('examples', examplesNeedWork(row.examples, mode));
        const touchDefinition = selected('definition', definitionNeedsWork(row.definitionEn, mode));
        const touchDifficulty = selected('difficulty', difficultyNeedsWork(row.difficulty, mode));
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
            descriptionDraft: touchDescription ? row.description ?? '' : '',
            difficultyExists: !touchDifficulty,
            forceLearnerRewrite: mode === 'regenerate' && (touchMeaning || touchDefinition || touchExamples),
          }, usageCallback(usage));
          if (touchMeaning && generated.meaning.trim() && !isPlaceholderMeaning(generated.meaning)) data.meaning = generated.meaning.trim();
          if (touchDescription && descriptionHasCanonicalLayout(generated.description)) data.description = generated.description.trim();
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
    applyAll = false,
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
    })), mode, fields, usage, errors, 'chunk', applyAll);
  }

  private async processPatterns(
    taskId: string,
    ids: string[],
    mode: LibraryBatchMode,
    fields: Set<LibraryBatchField>,
    usage: ReturnType<typeof createUsageStats>,
    errors: Array<{ id: string; label: string; message: string }>,
    applyAll = false,
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
    })), mode, fields, usage, errors, 'pattern', applyAll);
  }

  private async processTextRows(
    taskId: string,
    rows: Array<{ id: string; label: string; meaning: string | null; description: string | null; examples: ExampleRow[] }>,
    mode: LibraryBatchMode,
    fields: Set<LibraryBatchField>,
    usage: ReturnType<typeof createUsageStats>,
    errors: Array<{ id: string; label: string; message: string }>,
    kind: 'chunk' | 'pattern',
    applyAll = false,
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
        const selected = (field: LibraryBatchField, needs: boolean) => fields.has(field) && (applyAll || needs);
        if (selected('description', descriptionNeedsWork(row.description, mode, 'text')) && mode === 'regenerate') {
          const next = alignDescriptionLayout(row.description ?? '');
          if (next && next !== row.description?.trim()) data.description = next;
        }
        const touchMeaning = selected('meaning', meaningNeedsWork(row.meaning, mode, 'text'));
        const touchDescription = selected('description', descriptionNeedsWork(row.description, mode, 'text')) && mode === 'fill';
        const touchExamples = selected('examples', examplesNeedWork(row.examples, mode));
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
}
