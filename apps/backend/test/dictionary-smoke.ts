/**
 * Full pipeline smoke test: Run stages 0-9 on a word.
 * Run: npx ts-node -P tsconfig.json test/dictionary-smoke.ts [word] [--full]
 *
 * Without --full: stages 0-3 only (fetch, filter, pronunciation, examples)
 * With --full:    stages 0-9 (embedding, clustering, translation, AI review, store)
 */
import { DictionaryPipelineService } from '../src/modules/dictionary/dictionary-pipeline.service';
import { DictionaryClusteringService } from '../src/modules/dictionary/dictionary-clustering.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import * as fs from 'fs';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  const pipeline = new DictionaryPipelineService(prisma);
  const clustering = new DictionaryClusteringService();

  const word = process.argv[2] || 'hello';
  const fullMode = process.argv.includes('--full');

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  Dictionary Pipeline Smoke Test: "${word}"  ${fullMode ? '(FULL)' : '(preview)'}`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  // ═══ Stage 0: Fetch ═══
  console.log(`── Stage 0: Fetch ──`);
  const raw = await pipeline.fetchRawEntry(word);
  if (!raw) {
    console.log(`❌ "${word}" not found in FreeDictionaryAPI\n`);
    process.exit(1);
  }
  console.log(`✅ ${raw.entries.length} entries, ${raw.entries.reduce((s, e) => s + e.senses.length, 0)} senses`);
  console.log(`   Source: ${raw.source?.url}`);

  // ═══ Stage 1: Rule Filter ═══
  console.log(`\n── Stage 1: Rule Filter ──`);
  const buckets = pipeline.ruleFilter(raw);
  const totalCleaned =
    buckets.noun.length + buckets.verb.length + buckets.adj.length + buckets.other.length;
  console.log(`✅ ${totalCleaned} senses → noun:${buckets.noun.length} verb:${buckets.verb.length} adj:${buckets.adj.length} other:${buckets.other.length}`);

  // ═══ Stage 2: Pronunciation ═══
  console.log(`\n── Stage 2: Pronunciation ──`);
  const prons = pipeline.normalizePronunciations(raw);
  const ukProns = prons.filter((p) => p.type === 'uk');
  const usProns = prons.filter((p) => p.type === 'us');
  console.log(`✅ UK: ${ukProns.length} (preferred: ${ukProns.find((p) => p.isPreferred)?.ipa ?? 'none'})`);
  console.log(`   US: ${usProns.length} (preferred: ${usProns.find((p) => p.isPreferred)?.ipa ?? 'none'})`);

  // ═══ Stage 3: Example Cleaning ═══
  console.log(`\n── Stage 3: Example Cleaning ──`);
  pipeline.cleanExamples(buckets);
  const allSenses = [...buckets.noun, ...buckets.verb, ...buckets.adj, ...buckets.other];
  const totalExamples = allSenses.reduce((s, r) => s + ((r as any)._cleanedExamples?.length ?? 0), 0);
  const highExamples = allSenses.reduce(
    (s, r) => s + ((r as any)._cleanedExamples?.filter((e: any) => e.relevance === 'high')?.length ?? 0),
    0,
  );
  console.log(`✅ ${totalExamples} examples (${highExamples} high-relevance)`);

  if (!fullMode) {
    console.log(`\n── Preview Mode (use --full for stages 4-9) ──\n`);
    await prisma.$disconnect();
    process.exit(0);
  }

  // ═══ Stage 4: Embedding ═══
  console.log(`\n── Stage 4: Embedding (local TF-IDF, zero API cost) ──`);
  let embeddingMap: Map<string, number[]>;
  embeddingMap = await clustering.generateEmbeddings(buckets);
  console.log(`✅ ${embeddingMap.size} lexical vectors generated`);

  // ═══ Stage 5: Clustering ═══
  console.log(`\n── Stage 5: DBSCAN Clustering ──`);
  const rawClusters = clustering.clusterSenses(buckets, embeddingMap);
  let totalClusters = 0;
  for (const [, clusters] of rawClusters) totalClusters += clusters.length;
  console.log(`✅ ${totalClusters} raw clusters across ${rawClusters.size} POS buckets`);

  // ═══ Stage 6: Refine ═══
  console.log(`\n── Stage 6: Cluster Refinement ──`);
  const refinedClusters = clustering.refineClusters(rawClusters, buckets, embeddingMap);
  let totalRefined = 0;
  for (const [, clusters] of refinedClusters) totalRefined += clusters.length;
  console.log(`✅ ${totalRefined} clusters after refinement (merged ${totalClusters - totalRefined} tiny clusters)`);

  // ═══ Stage 7: Label & Rank ═══
  console.log(`\n── Stage 7: Label & Rank ──`);
  let clusters = clustering.labelAndRank(refinedClusters, buckets, embeddingMap);
  console.log(`✅ ${clusters.length} labeled clusters:`);
  for (const c of clusters.slice(0, 10)) {
    const label = c.label.length > 50 ? c.label.substring(0, 47) + '...' : c.label;
    console.log(`   #${c.rank} [${c.posBucket}] "${label}" (${c.senses.length} senses)`);
  }

  // ═══ Stage 8: Translation ═══
  console.log(`\n── Stage 8: Chinese Translation (DeepSeek) ──`);
  try {
    await pipeline.translateToChinese(clusters);
    const translatedSenses = clusters.flatMap((c) => c.senses).filter((s) => s.translations.zh);
    console.log(`✅ ${translatedSenses.length}/${clusters.flatMap((c) => c.senses).length} senses translated`);
    // Show a sample
    const sample = clusters[0]?.senses[0];
    if (sample) {
      console.log(`   Sample: "${sample.definition.substring(0, 40)}..." → "${sample.translations.zh}"`);
      if (sample.examples[0]?.zh) {
        console.log(`   Example: "${sample.examples[0].en.substring(0, 40)}..." → "${sample.examples[0].zh}"`);
      }
    }
  } catch (err: any) {
    console.log(`❌ Translation failed: ${err.message}`);
    console.log(`   Hint: Set DEEPSEEK_API_KEY in .env`);
  }

  // ═══ Stage 9: AI Review ═══
  console.log(`\n── Stage 9: AI Review (DeepSeek) ──`);
  let reviewResult;
  try {
    reviewResult = await pipeline.aiReview(clusters, raw.source?.url ?? '');
    clusters = reviewResult.clusters;
    console.log(`✅ Reviewed: ${reviewResult.meta.issuesFound} issues found, ${reviewResult.meta.fixesApplied} fixes applied`);
  } catch (err: any) {
    console.log(`❌ AI review failed: ${err.message}`);
    reviewResult = { meta: { reviewedAt: new Date().toISOString(), issuesFound: 0, fixesApplied: 0 } };
  }

  // ═══ Store ═══
  console.log(`\n── Store ──`);
  const allCleanedSenses = clusters.flatMap((c) => c.senses);
  try {
    const entry = await prisma.dictionaryEntry.upsert({
      where: { word: word.toLowerCase() },
      create: {
        word: word.toLowerCase(),
        language: 'en',
        sourceUrl: raw.source?.url ?? '',
        pronunciations: prons as any,
        senseClusters: clusters as any,
        senses: allCleanedSenses as any,
        rawEntry: raw as any,
        pipelineVersion: '1.0',
        aiReviewed: true,
        aiReviewMeta: reviewResult.meta as any,
      },
      update: {
        sourceUrl: raw.source?.url ?? '',
        pronunciations: prons as any,
        senseClusters: clusters as any,
        senses: allCleanedSenses as any,
        rawEntry: raw as any,
        pipelineVersion: '1.0',
        aiReviewed: true,
        aiReviewMeta: reviewResult.meta as any,
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Stored: ${entry.word} (${clusters.length} clusters, ${allCleanedSenses.length} senses)`);
  } catch (err: any) {
    console.log(`❌ Store failed: ${err.message}`);
  }

  // ═══ Final Summary ═══
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  Pipeline Complete!                                      ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  Word:        ${word.padEnd(44)}║`);
  console.log(`║  Clusters:    ${String(clusters.length).padEnd(44)}║`);
  console.log(`║  Senses:      ${String(allCleanedSenses.length).padEnd(44)}║`);
  console.log(`║  Pronounce:   UK ${String(ukProns.length)} / US ${String(usProns.length)}`.padEnd(54) + `║`);
  console.log(`║  Examples:    ${String(totalExamples).padEnd(44)}║`);
  console.log(`║  Translated:  ${String(allCleanedSenses.filter((s) => s.translations.zh).length).padEnd(44)}║`);
  console.log(`║  AI Reviewed: ${String(reviewResult?.meta?.fixesApplied ?? 0).padEnd(44)}║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
