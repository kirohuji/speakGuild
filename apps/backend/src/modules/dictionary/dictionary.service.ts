import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DictionaryPipelineService } from './dictionary-pipeline.service';
import { DictionaryClusteringService } from './dictionary-clustering.service';
import type { SenseCluster, CleanedPronunciation } from './dictionary.types';

@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: DictionaryPipelineService,
    private readonly clustering: DictionaryClusteringService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // Public: Lookup a word (cache → pipeline → store → return)
  // ════════════════════════════════════════════════════════════

  async lookupWord(word: string) {
    const key = word.toLowerCase().trim();
    if (!key) return null;

    // Check cache
    const cached = await this.prisma.dictionaryEntry.findUnique({ where: { word: key } });
    if (cached) {
      this.logger.debug(`Dictionary cache HIT: "${key}"`);
      return {
        word: cached.word,
        language: cached.language,
        sourceUrl: cached.sourceUrl,
        pronunciations: cached.pronunciations,
        senseClusters: cached.senseClusters,
        senses: cached.senses,
        aiReviewed: cached.aiReviewed,
      };
    }

    // Run full pipeline
    return this.runFullPipeline(key);
  }

  // ════════════════════════════════════════════════════════════
  // Full Pipeline Orchestrator
  // ════════════════════════════════════════════════════════════

  async runFullPipeline(word: string) {
    const key = word.toLowerCase().trim();
    this.logger.log(`Starting pipeline for "${key}"`);

    // ── Stage 0: Fetch ──
    const raw = await this.pipeline.fetchRawEntry(key);
    if (!raw) {
      this.logger.warn(`Word "${key}" not found in FreeDictionaryAPI`);
      return null;
    }

    const sourceUrl = raw.source?.url ?? '';

    // ── Stage 1: Rule Filter ──
    const buckets = this.pipeline.ruleFilter(raw);

    // ── Stage 2: Pronunciation ──
    const pronunciations = this.pipeline.normalizePronunciations(raw);

    // ── Stage 3: Example Cleaning ──
    this.pipeline.cleanExamples(buckets);

    // ── Stage 4: Embedding ──
    const embeddingMap = await this.clustering.generateEmbeddings(buckets);

    // ── Stage 5: Clustering ──
    const rawClusters = this.clustering.clusterSenses(buckets, embeddingMap);

    // ── Stage 6: Refine ──
    const refinedClusters = this.clustering.refineClusters(rawClusters, buckets, embeddingMap);

    // ── Stage 7: Label & Rank ──
    let clusters = this.clustering.labelAndRank(refinedClusters, buckets, embeddingMap);

    // ── Stage 8: Translate ──
    await this.pipeline.translateToChinese(clusters);

    // ── Stage 9: AI Review ──
    const reviewResult = await this.pipeline.aiReview(clusters, sourceUrl);
    clusters = reviewResult.clusters;

    // Flatten senses from clusters for the `senses` column
    const allSenses = clusters.flatMap((c) => c.senses);

    // ── Store ──
    const entry = await this.prisma.dictionaryEntry.upsert({
      where: { word: key },
      create: {
        word: key,
        language: 'en',
        sourceUrl,
        pronunciations: pronunciations as any,
        senseClusters: clusters as any,
        senses: allSenses as any,
        rawEntry: raw as any,
        pipelineVersion: '1.0',
        aiReviewed: true,
        aiReviewMeta: reviewResult.meta as any,
      },
      update: {
        sourceUrl,
        pronunciations: pronunciations as any,
        senseClusters: clusters as any,
        senses: allSenses as any,
        rawEntry: raw as any,
        pipelineVersion: '1.0',
        aiReviewed: true,
        aiReviewMeta: reviewResult.meta as any,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Pipeline complete for "${key}": ${clusters.length} clusters, ${allSenses.length} senses`,
    );

    return {
      word: entry.word,
      language: entry.language,
      sourceUrl: entry.sourceUrl,
      pronunciations: entry.pronunciations,
      senseClusters: entry.senseClusters,
      senses: entry.senses,
      aiReviewed: entry.aiReviewed,
    };
  }

  // ════════════════════════════════════════════════════════════
  // Admin: Batch enrich multiple words
  // ════════════════════════════════════════════════════════════

  async batchEnrich(words: string[]) {
    const results: { word: string; success: boolean; error?: string }[] = [];
    for (const word of words) {
      try {
        const result = await this.runFullPipeline(word);
        results.push({ word, success: !!result });
      } catch (err: any) {
        results.push({ word, success: false, error: err.message });
      }
    }
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    return { total: words.length, succeeded, failed, errors: results.filter((r) => !r.success) };
  }

  // ════════════════════════════════════════════════════════════
  // Search: Prefix search on stored words
  // ════════════════════════════════════════════════════════════

  async search(q: string) {
    if (!q || q.trim().length < 1) return [];
    const results = await this.prisma.dictionaryEntry.findMany({
      where: { word: { startsWith: q.toLowerCase().trim(), mode: 'insensitive' } },
      select: { word: true, senseClusters: true },
      take: 20,
      orderBy: { word: 'asc' },
    });

    return results.map((r) => {
      const clusters = (r.senseClusters as unknown as SenseCluster[]) ?? [];
      const primaryCluster = clusters.find((c) => c.rank === 1);
      return {
        word: r.word,
        primaryDefinition: primaryCluster?.label ?? '',
        primaryPOS: primaryCluster?.posBucket ?? 'other',
        clusterCount: clusters.length,
      };
    });
  }

  // ════════════════════════════════════════════════════════════
  // Integration: Enrich existing Vocabulary record
  // ════════════════════════════════════════════════════════════

  async enrichVocabulary(vocabId: string) {
    const vocab = await this.prisma.vocabulary.findUnique({ where: { id: vocabId } });
    if (!vocab) return null;

    const entry = await this.lookupWord(vocab.word);
    if (!entry) return null;

    const clusters = entry.senseClusters as unknown as SenseCluster[];
    const primaryCluster = clusters.find((c) => c.rank === 1);
    const pronunciations = entry.pronunciations as unknown as CleanedPronunciation[];

    const uk =
      pronunciations.find((p) => p.type === 'uk' && p.isPreferred) ??
      pronunciations.find((p) => p.type === 'uk');
    const us =
      pronunciations.find((p) => p.type === 'us' && p.isPreferred) ??
      pronunciations.find((p) => p.type === 'us');

    const allSenses = clusters.flatMap((c) => c.senses);
    const primarySense = primaryCluster?.senses[0];

    return this.prisma.vocabulary.update({
      where: { id: vocabId },
      data: {
        meaning: primarySense?.translations?.zh || vocab.meaning,
        phoneticUk: uk?.ipa ?? vocab.phoneticUk,
        phoneticUs: us?.ipa ?? vocab.phoneticUs,
        audioUsUrl: us?.audioUrl ?? vocab.audioUsUrl,
        audioUkUrl: uk?.audioUrl ?? vocab.audioUkUrl,
        definitionEn: primarySense?.definition ?? vocab.definitionEn,
        synonyms: primarySense?.synonyms ?? vocab.synonyms,
        examples: allSenses.flatMap((s) =>
          s.examples.map((e) => ({ en: e.en, zh: e.zh, level: e.relevance })),
        ) as any,
      },
    });
  }
}
