import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AdminContentAiService } from '../../admin/admin-content-ai.service';
import { AdminTasksService } from '../admin-tasks.service';

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
    private readonly adminContentAiService: AdminContentAiService,
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
        const word = vocabulariesToEnrich[i];
        try {
          // Look up the vocabulary record first (it has an ID now)
          const vocab = await this.prisma.vocabulary.findUnique({
            where: { word },
            select: { id: true, word: true },
          });
          if (!vocab) continue;

          // Use the content-prepare enrichment pattern (FreeDictionaryAPI + DeepSeek fallback)
          const enriched = await this.enrichOneVocabulary(vocab.id, vocab.word);
          if (enriched) {
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
   * Enrich a single vocabulary using FreeDictionaryAPI first,
   * then DeepSeek AI for additional content if needed.
   * Follows the same pattern as ContentPrepareService.prepareVocabulary().
   */
  private async enrichOneVocabulary(vocabId: string, word: string): Promise<boolean> {
    const vocab = await this.prisma.vocabulary.findUnique({ where: { id: vocabId } });
    if (!vocab) return false;

    // Skip if already has rich data
    if (
      vocab.definitionEn?.trim() &&
      vocab.description?.trim() &&
      Array.isArray(vocab.examples) && vocab.examples.length > 0 &&
      (vocab.phoneticUs?.trim() || vocab.phoneticUk?.trim())
    ) {
      return false;
    }

    // Step 1: Try FreeDictionaryAPI
    const entry = await this.lookupFreeDictionaryEntry(word);
    let phoneticUs = vocab.phoneticUs ?? '';
    let phoneticUk = vocab.phoneticUk ?? '';
    let definitionEn = vocab.definitionEn ?? '';
    let meaning = vocab.meaning ?? '';

    if (entry) {
      phoneticUs = this.getBestPhonetic(entry) || phoneticUs;
      definitionEn = this.buildDefinitionEn(entry) || definitionEn;
      meaning = this.deriveMeaning(definitionEn) || meaning;
    }

    // Step 2: Try DeepSeek AI enrichment for richer data
    try {
      const aiResult = await this.adminContentAiService.enrichVocabulary({
        word,
        definitions: definitionEn ? [definitionEn] : [],
        examples: [],
        phoneticUs: phoneticUs || undefined,
        phoneticUk: phoneticUk || undefined,
      });

      if (aiResult.phoneticUs) phoneticUs = aiResult.phoneticUs;
      if (aiResult.phoneticUk) phoneticUk = aiResult.phoneticUk;
      if (aiResult.meaning) meaning = aiResult.meaning;
      if (aiResult.description) {
        // Use AI-generated description
      }
      // Build examples from AI result
      const examples = aiResult.generatedExamples?.length
        ? aiResult.generatedExamples.map(e => ({ en: e.en, zh: e.zh, level: e.level }))
        : (Array.isArray(vocab.examples) ? vocab.examples : []);

      await this.prisma.vocabulary.update({
        where: { id: vocabId },
        data: {
          phoneticUs: phoneticUs || null,
          phoneticUk: phoneticUk || null,
          definitionEn: definitionEn || null,
          meaning: meaning || null,
          description: aiResult.description || vocab.description,
          examples: examples as any,
          partOfSpeech: definitionEn?.split(';')[0]?.split(':')[0]?.trim() || vocab.partOfSpeech,
        },
      });

      return true;
    } catch (aiError: any) {
      // If DeepSeek fails, at least save what we got from FreeDictionary
      if (phoneticUs || phoneticUk || definitionEn || meaning) {
        await this.prisma.vocabulary.update({
          where: { id: vocabId },
          data: {
            phoneticUs: phoneticUs || null,
            phoneticUk: phoneticUk || null,
            definitionEn: definitionEn || null,
            meaning: meaning || null,
          },
        });
        return true;
      }
      return false;
    }
  }

  private async lookupFreeDictionaryEntry(word: string): Promise<any | null> {
    const key = word.toLowerCase().trim();
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
      if (!response.ok) return null;
      const entries = (await response.json()) as any[];
      return entries?.[0] ?? null;
    } catch {
      return null;
    }
  }

  private getBestPhonetic(entry: any) {
    if (entry.phonetic) return entry.phonetic;
    return entry.phonetics?.find((p: any) => p.text)?.text ?? '';
  }

  private buildDefinitionEn(entry: any): string {
    if (!entry.meanings?.length) return '';
    return entry.meanings
      .map((m: any) => `${m.partOfSpeech}: ${m.definitions.map((d: any) => d.definition).join('; ')}`)
      .join('; ');
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
}
