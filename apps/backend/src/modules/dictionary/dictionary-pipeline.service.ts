import { Injectable, Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  FreeDictApiResponse,
  RawSense,
  SenseBuckets,
  CleanedPronunciation,
  CleanedExample,
  CleanedSense,
  SenseCluster,
  AiReviewPatch,
  AiReviewMeta,
  NormalizedPOS,
} from './dictionary.types';

// ──── Utility ────

/** Simple Levenshtein distance for deduplication */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]) + 1;
    }
  }
  return d[m][n];
}

/** Generate a short UUID */
function shortId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/** Delay helper */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ──── Constants ────

const FREEDICT_BASE = 'https://freedictionaryapi.com/api/v1/entries';
const MAX_SENSES = 20;
const MAX_EXAMPLES_PER_SENSE = 3;
const EXAMPLE_MAX_LENGTH = 200;
const CITATION_CUTOFF_YEAR = 1950;

/** Map arbitrary FreeDictionaryAPI POS strings to normalized POS */
const POS_MAP: Record<string, NormalizedPOS> = {
  noun: 'noun',
  'proper noun': 'noun',
  'common noun': 'noun',
  'countable noun': 'noun',
  'uncountable noun': 'noun',
  'collective noun': 'noun',
  'verbal noun': 'noun',
  verb: 'verb',
  'transitive verb': 'verb',
  'intransitive verb': 'verb',
  'auxiliary verb': 'verb',
  'phrasal verb': 'verb',
  'linking verb': 'verb',
  'modal verb': 'verb',
  adjective: 'adj',
  'comparative adjective': 'adj',
  'superlative adjective': 'adj',
  'proper adjective': 'adj',
  adverb: 'adv',
  'comparative adverb': 'adv',
  'superlative adverb': 'adv',
  pronoun: 'pronoun',
  'personal pronoun': 'pronoun',
  'possessive pronoun': 'pronoun',
  'reflexive pronoun': 'pronoun',
  'demonstrative pronoun': 'pronoun',
  'interrogative pronoun': 'pronoun',
  'relative pronoun': 'pronoun',
  'indefinite pronoun': 'pronoun',
  preposition: 'preposition',
  conjunction: 'conjunction',
  'coordinating conjunction': 'conjunction',
  'subordinating conjunction': 'conjunction',
  'correlative conjunction': 'conjunction',
  interjection: 'interjection',
  determiner: 'determiner',
  'definite article': 'article',
  'indefinite article': 'article',
  article: 'article',
};

function normalizePOS(rawPOS: string): NormalizedPOS {
  const key = rawPOS.toLowerCase().trim();
  return POS_MAP[key] ?? 'other';
}

// ──── Academic jargon markers ────

const ACADEMIC_JARGON = /\b(thesis|dissertation|monograph|treatise|corpus|lexicography|philology|etymology|morphology|phonology|syntax|semantics|pragmatics)\b/i;

@Injectable()
export class DictionaryPipelineService {
  private readonly logger = new Logger(DictionaryPipelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ════════════════════════════════════════════════════════════
  // Stage 0: Fetch
  // ════════════════════════════════════════════════════════════

  async fetchRawEntry(word: string): Promise<FreeDictApiResponse | null> {
    const key = word.toLowerCase().trim();
    try {
      const url = `${FREEDICT_BASE}/en/${encodeURIComponent(key)}?translations=true`;
      this.logger.debug(`Fetching: ${url}`);
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        this.logger.warn(`Rate limited, waiting ${waitMs}ms`);
        await delay(waitMs);
        const retryRes = await fetch(url);
        if (!retryRes.ok) return null;
        return (await retryRes.json()) as FreeDictApiResponse;
      }
      if (!res.ok) {
        this.logger.warn(`FreeDictionaryAPI returned ${res.status} for "${key}"`);
        return null;
      }
      return (await res.json()) as FreeDictApiResponse;
    } catch (err: any) {
      this.logger.error(`Fetch error for "${key}": ${err.message}`);
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════
  // Extract entry-level meta: synonyms, word forms
  // ════════════════════════════════════════════════════════════

  extractEntryMeta(raw: FreeDictApiResponse): {
    entrySynonyms: string[];
    wordForms: { word: string; tags: string[] }[];
  } {
    const entrySynonyms: string[] = [];
    const wordForms: { word: string; tags: string[] }[] = [];
    const seenSyns = new Set<string>();
    const seenForms = new Set<string>();

    for (const entry of raw.entries) {
      for (const s of entry.synonyms ?? []) {
        const key = s.toLowerCase();
        if (!seenSyns.has(key)) { seenSyns.add(key); entrySynonyms.push(s); }
      }
      for (const f of entry.forms ?? []) {
        const key = f.word.toLowerCase();
        if (!seenForms.has(key)) { seenForms.add(key); wordForms.push(f); }
      }
    }

    // Cap synonyms at 30
    return {
      entrySynonyms: entrySynonyms.slice(0, 30),
      wordForms: wordForms.slice(0, 20),
    };
  }

  // ════════════════════════════════════════════════════════════
  // Stage 1: Rule Filter (降噪 + POS 预分桶)
  // ════════════════════════════════════════════════════════════

  ruleFilter(raw: FreeDictApiResponse): SenseBuckets {
    const rawSenses: RawSense[] = [];

    // Flatten all entries → senses + subsenses
    for (let ei = 0; ei < raw.entries.length; ei++) {
      const entry = raw.entries[ei];
      const flatten = (senses: typeof entry.senses, baseIdx: number = 0) => {
        let idx = baseIdx;
        for (const s of senses) {
          if (!s.definition || s.definition.trim().length === 0) continue;
          rawSenses.push({
            definition: s.definition.trim(),
            partOfSpeech: entry.partOfSpeech,
            tags: s.tags ?? [],
            examples: s.examples ?? [],
            quotes: s.quotes ?? [],
            synonyms: s.synonyms ?? [],
            antonyms: s.antonyms ?? [],
            translations: s.translations ?? [],
            entryIndex: ei,
            senseIndex: idx,
          });
          idx++;
          if (s.subsenses?.length) idx = flatten(s.subsenses, idx);
        }
        return idx;
      };
      flatten(entry.senses);
    }

    // Garbage removal
    const garbageTags = /^(archaic|obsolete|rare|dated)$/i;
    const filtered = rawSenses.filter((s) => {
      // Remove archaic/obsolete
      if (s.tags.some((t) => garbageTags.test(t))) return false;
      // Remove ultra-long definitions
      if (s.definition.length > 300) return false;
      return true;
    });

    // Deduplicate by Levenshtein
    const deduped: RawSense[] = [];
    for (const s of filtered) {
      const isDup = deduped.some(
        (d) => levenshtein(s.definition.toLowerCase(), d.definition.toLowerCase()) < 5,
      );
      if (!isDup) {
        deduped.push(s);
      } else {
        // Merge: keep the richer one
        const existing = deduped.find(
          (d) => levenshtein(s.definition.toLowerCase(), d.definition.toLowerCase()) < 5,
        )!;
        if (s.examples.length > existing.examples.length) {
          existing.examples = s.examples;
          existing.synonyms = [...new Set([...existing.synonyms, ...s.synonyms])];
        }
      }
    }

    // Cap at MAX_SENSES — preserve original Wiktionary order (primary meanings first)
    const capped = deduped.slice(0, MAX_SENSES);

    // POS pre-bucketing
    const buckets: SenseBuckets = { noun: [], verb: [], adj: [], other: [] };
    for (const s of capped) {
      const pos = normalizePOS(s.partOfSpeech);
      if (pos === 'noun') buckets.noun.push(s);
      else if (pos === 'verb') buckets.verb.push(s);
      else if (pos === 'adj') buckets.adj.push(s);
      else buckets.other.push(s);
    }

    this.logger.debug(
      `Rule filter: ${rawSenses.length} raw → ${capped.length} cleaned (noun:${buckets.noun.length} verb:${buckets.verb.length} adj:${buckets.adj.length} other:${buckets.other.length})`,
    );

    return buckets;
  }

  // ════════════════════════════════════════════════════════════
  // Stage 2: Pronunciation Normalization
  // ════════════════════════════════════════════════════════════

  normalizePronunciations(raw: FreeDictApiResponse): CleanedPronunciation[] {
    const all: CleanedPronunciation[] = [];

    for (const entry of raw.entries) {
      for (const p of entry.pronunciations ?? []) {
        if (!p.text) continue;
        // Classify UK/US — check tags first (FreeDictionaryAPI uses tags for region)
        let type: 'uk' | 'us' = 'us';
        const tagsLower = (p.tags ?? []).map((t) => t.toLowerCase());
        const allText = [...tagsLower, (p.type ?? '').toLowerCase()].join(' ');

        // Tag-based: "Received Pronunciation" / "RP" → UK, "General American" / "GA" → US
        if (
          allText.includes('received pronunciation') ||
          allText.includes(' rp ') ||
          allText.includes('uk') ||
          allText.includes('gb') ||
          allText.includes('british')
        ) {
          type = 'uk';
        } else if (
          allText.includes('general american') ||
          allText.includes(' ga ') ||
          allText.includes('us') ||
          allText.includes('american')
        ) {
          type = 'us';
        } else {
          // Fallback: IPA pattern heuristics
          if (p.text.includes('ɑː') || p.text.includes('ɒ') || p.text.includes('əʊ')) {
            type = 'uk';
          } else if (p.text.includes('ɝ') || p.text.includes('ɚ')) {
            type = 'us';
          }
        }

        // Normalize IPA
        let ipa = p.text.replace(/\s+/g, '').replace(/\/$/, '').replace(/^\//, '');
        // Convert /r/ to /ɹ/ for consistency
        ipa = ipa.replace(/\/r\//g, '/ɹ/').replace(/(?<![ɹ])r(?![a-z])/g, 'ɹ');

        // Extract audio URL from tags (some providers put audio URLs in tags)
        let audioUrl: string | undefined;
        const audioTag = p.tags?.find((t) => t.startsWith('http') && t.includes('audio'));
        if (audioTag) audioUrl = audioTag;

        all.push({ type, ipa: `/${ipa}/`, audioUrl, isPreferred: false });
      }
    }

    // Pick one preferred per region (first with audio, or first overall)
    const uk = all.filter((p) => p.type === 'uk');
    const us = all.filter((p) => p.type === 'us');

    const result: CleanedPronunciation[] = [];
    if (uk.length > 0) {
      const withAudio = uk.find((p) => p.audioUrl);
      (withAudio ?? uk[0]).isPreferred = true;
      result.push(withAudio ?? uk[0]);
      // Deduplicate rest
      for (const p of uk) {
        if (p !== (withAudio ?? uk[0]) && !result.some((r) => r.ipa === p.ipa)) {
          result.push(p);
        }
      }
    }
    if (us.length > 0) {
      const withAudio = us.find((p) => p.audioUrl);
      (withAudio ?? us[0]).isPreferred = true;
      result.push(withAudio ?? us[0]);
      for (const p of us) {
        if (p !== (withAudio ?? us[0]) && !result.some((r) => r.ipa === p.ipa)) {
          result.push(p);
        }
      }
    }

    // Fill missing: if UK missing but US present, derive from US
    if (uk.length === 0 && us.length > 0) {
      const usIPA = us[0].ipa.replace(/ɝ/g, 'ɜː').replace(/ɚ/g, 'ə');
      result.push({ type: 'uk', ipa: usIPA, audioUrl: us[0].audioUrl, isPreferred: false });
    }
    if (us.length === 0 && uk.length > 0) {
      const ukIPA = uk[0].ipa.replace(/ɑː/g, 'æ').replace(/ɒ/g, 'ɑ');
      result.push({ type: 'us', ipa: ukIPA, audioUrl: uk[0].audioUrl, isPreferred: false });
    }

    return result;
  }

  // ════════════════════════════════════════════════════════════
  // Stage 3: Example Cleaning
  // ════════════════════════════════════════════════════════════

  cleanExamples(buckets: SenseBuckets): void {
    const pre1950Regex = /\b(1[5-9]\d{2})\b/;
    const authorLineRegex = /^[A-Z][a-z]+,\s+[A-Z]/;

    const clean = (senses: RawSense[]) => {
      for (const s of senses) {
        // Collect from examples + quotes
        const rawExamples = [
          ...s.examples,
          ...s.quotes.map((q) => q.text),
        ];

        const cleaned: CleanedExample[] = [];
        const seen = new Set<string>();

        for (const ex of rawExamples) {
          if (!ex || ex.trim().length === 0) continue;
          // Filter pre-1950 citations
          if (pre1950Regex.test(ex)) continue;
          // Filter author-name lines
          if (authorLineRegex.test(ex)) continue;
          // Filter too long
          if (ex.length > EXAMPLE_MAX_LENGTH) continue;
          // Filter academic jargon
          if (ACADEMIC_JARGON.test(ex)) continue;
          // Deduplicate
          const normalized = ex.trim().toLowerCase();
          if (seen.has(normalized)) continue;
          const isSimilar = cleaned.some((c) => levenshtein(normalized, c.en.toLowerCase()) < 10);
          if (isSimilar) continue;

          seen.add(normalized);

          const relevance: 'high' | 'medium' | 'low' =
            ex.length < 100 && !ex.includes('(') && !ex.includes('[') ? 'high' : 'medium';

          cleaned.push({
            en: ex.trim(),
            zh: '',
            source: 'wiktionary',
            relevance,
          });
        }

        // Cap at MAX_EXAMPLES_PER_SENSE, sort by relevance
        cleaned.sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.relevance] - order[b.relevance];
        });

        // Store cleaned examples back (mutate the sense's auxiliary field)
        (s as any)._cleanedExamples = cleaned.slice(0, MAX_EXAMPLES_PER_SENSE);
      }
    };

    clean(buckets.noun);
    clean(buckets.verb);
    clean(buckets.adj);
    clean(buckets.other);
  }

  // ════════════════════════════════════════════════════════════
  // Stage 8: Chinese Translation
  // ════════════════════════════════════════════════════════════

  async translateToChinese(
    clusters: SenseCluster[],
  ): Promise<void> {
    const allSenses = clusters.flatMap((c) => c.senses);
    if (allSenses.length === 0) return;

    // Build batched requests (max 20 senses per call)
    const batchSize = 20;
    for (let i = 0; i < allSenses.length; i += batchSize) {
      const batch = allSenses.slice(i, i + batchSize);
      const items = batch.map((s, idx) => {
        const examplesText = s.examples.map((e, ei) => `  ex${ei + 1}: ${e.en}`).join('\n');
        return `[${idx}] definition: ${s.definition}\n${examplesText}`;
      }).join('\n\n');

      try {
        const provider = this.getDeepSeekProvider();
        const { text } = await generateText({
          model: provider('deepseek-chat'),
          prompt: `Translate the following English dictionary senses and examples to Simplified Chinese (zh-CN).

${items}

Return ONLY a JSON object (no markdown):
{
  "translations": {
    "0": { "definitionZh": "中文释义", "examplesZh": ["例句1中文", "例句2中文"] },
    "1": { "definitionZh": "中文释义", "examplesZh": ["例句1中文"] }
  }
}`,
          temperature: 0,
          maxOutputTokens: 2000,
        });

        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const translations = parsed.translations ?? {};

        for (const [idx, trans] of Object.entries(translations)) {
          const t = trans as any;
          const senseIdx = parseInt(idx, 10);
          if (batch[senseIdx]) {
            batch[senseIdx].translations.zh = String(t.definitionZh ?? '');
            const examplesZh: string[] = Array.isArray(t.examplesZh) ? t.examplesZh : [];
            batch[senseIdx].examples.forEach((ex, ei) => {
              ex.zh = String(examplesZh[ei] ?? '');
            });
          }
        }

        if (i + batchSize < allSenses.length) {
          await delay(500); // Rate limit between batches
        }
      } catch (err: any) {
        this.logger.warn(`Translation batch failed: ${err.message}`);
      }
    }

    // Update cluster labels to use first sense's zh translation
    for (const c of clusters) {
      const firstZh = c.senses[0]?.translations?.zh;
      if (firstZh && firstZh.length <= 12) {
        c.label = firstZh;
      } else if (firstZh) {
        c.label = firstZh.substring(0, 10) + '…';
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  // Stage 9: AI Review
  // ════════════════════════════════════════════════════════════

  async aiReview(
    clusters: SenseCluster[],
    sourceUrl: string,
  ): Promise<{ clusters: SenseCluster[]; meta: AiReviewMeta }> {
    const provider = this.getDeepSeekProvider();

    // Build a compact representation for the AI to review
    const clusterSummary = clusters.map((c) => ({
      id: c.id,
      label: c.label,
      posBucket: c.posBucket,
      rank: c.rank,
      senses: c.senses.map((s) => ({
        id: s.id,
        definition: s.definition,
        pos: s.partOfSpeech,
        examples: s.examples.map((e) => e.en),
        translationZh: s.translations.zh,
        tags: s.tags,
      })),
    }));

    const prompt = `Review this English dictionary entry (source: ${sourceUrl}) for quality and classify sense frequency.

## Current clustered senses:
${JSON.stringify(clusterSummary, null, 2)}

## Review checklist:
1. Missing primary/common definitions?
2. Senses placed in wrong cluster?
3. Wrong POS assignment?
4. Unnatural or archaic example sentences?
5. Missing or inaccurate zh-CN translations?
6. **Cluster label quality**: The cluster label MUST be a short (1-4 Chinese characters) category name that represents the PRIMARY/COMMON meaning of the group. Examples: "动物", "金融", "动作", "食物", "工具", "情感". If the current label is wrong, too long, or represents an obscure meaning, provide a corrected label via labelFixes.
7. **Frequency classification**: Mark each sense as "common" (everyday usage, learners should know) or "uncommon" (rare, archaic, specialized, dialectal, or extremely niche). Most senses should be "common" — only mark truly obscure ones as "uncommon".
8. **Sense ordering**: Within each cluster, common, primary meanings should come FIRST. Reorder sense IDs so that the most important/everyday meanings are at the top, and obscure/slang/derogatory senses are pushed down. The "orderedSenseIds" array should list ALL sense IDs in the cluster in the correct order.

Return ONLY a JSON object (no markdown):
{
  "reassignments": [{ "senseId": "...", "fromClusterId": "...", "toClusterId": "..." }],
  "missingDefinitions": [{ "definition": "new definition text", "pos": "noun", "suggestedCluster": "cluster-id", "exampleEn": "example sentence" }],
  "posFixes": [{ "senseId": "...", "correctedPOS": "noun" }],
  "translationFixes": [{ "senseId": "...", "field": "definitionZh", "corrected": "修正后的中文" }],
  "labelFixes": [{ "clusterId": "...", "correctedLabel": "BETTER_LABEL" }],
  "frequencyMarks": [{ "senseId": "...", "frequency": "uncommon" }],
  "senseReorderings": [{ "clusterId": "...", "orderedSenseIds": ["id1", "id2", ...] }],
  "issuesFound": 0
}`;

    try {
      const { text } = await generateText({
        model: provider('deepseek-chat'),
        prompt,
        temperature: 0.1,
        maxOutputTokens: 3000,
      });

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const patch: AiReviewPatch & { issuesFound?: number } = JSON.parse(cleaned);

      const fixesApplied = this.applyAiPatch(clusters, patch);

      return {
        clusters,
        meta: {
          reviewedAt: new Date().toISOString(),
          issuesFound: patch.issuesFound ?? fixesApplied,
          fixesApplied,
          modelUsed: 'deepseek-chat',
        },
      };
    } catch (err: any) {
      this.logger.warn(`AI review failed: ${err.message}`);
      return {
        clusters,
        meta: {
          reviewedAt: new Date().toISOString(),
          issuesFound: 0,
          fixesApplied: 0,
          modelUsed: 'deepseek-chat',
        },
      };
    }
  }

  /** Apply AI corrections to clusters (merge strategy) */
  private applyAiPatch(clusters: SenseCluster[], patch: AiReviewPatch): number {
    let count = 0;
    const allSenses = new Map<string, { sense: CleanedSense; cluster: SenseCluster }>();
    for (const c of clusters) {
      for (const s of c.senses) {
        allSenses.set(s.id, { sense: s, cluster: c });
      }
    }

    // Reassignments
    for (const r of patch.reassignments ?? []) {
      const entry = allSenses.get(r.senseId);
      if (!entry) continue;
      const targetCluster = clusters.find((c) => c.id === r.toClusterId);
      if (!targetCluster) continue;
      // Remove from old cluster
      entry.cluster.senses = entry.cluster.senses.filter((s) => s.id !== r.senseId);
      // Add to new cluster
      entry.sense.clusterId = r.toClusterId;
      entry.sense.partOfSpeech = targetCluster.posBucket;
      targetCluster.senses.push(entry.sense);
      count++;
    }

    // POS fixes
    const posValues: NormalizedPOS[] = [
      'noun', 'verb', 'adj', 'adv', 'pronoun', 'preposition',
      'conjunction', 'interjection', 'determiner', 'article', 'other',
    ];
    for (const f of patch.posFixes ?? []) {
      const entry = allSenses.get(f.senseId);
      if (!entry || !posValues.includes(f.correctedPOS)) continue;
      entry.sense.partOfSpeech = f.correctedPOS;
      count++;
    }

    // Translation fixes
    for (const f of patch.translationFixes ?? []) {
      const entry = allSenses.get(f.senseId);
      if (!entry) continue;
      if (f.field === 'definitionZh') {
        entry.sense.translations.zh = f.corrected;
        count++;
      } else if (f.field.startsWith('exampleZh')) {
        const exIdx = parseInt(f.field.replace('exampleZh', ''), 10);
        if (entry.sense.examples[exIdx]) {
          entry.sense.examples[exIdx].zh = f.corrected;
          count++;
        }
      }
    }

    // Label fixes
    for (const f of patch.labelFixes ?? []) {
      const cluster = clusters.find((c) => c.id === f.clusterId);
      if (!cluster) continue;
      cluster.label = f.correctedLabel;
      count++;
    }

    // Frequency marks
    for (const f of patch.frequencyMarks ?? []) {
      const entry = allSenses.get(f.senseId);
      if (!entry) continue;
      entry.sense.frequency = f.frequency;
      count++;
    }

    // Sense reorderings (AI decides the correct order within each cluster)
    for (const r of patch.senseReorderings ?? []) {
      const cluster = clusters.find((c) => c.id === r.clusterId);
      if (!cluster || !r.orderedSenseIds?.length) continue;
      const orderMap = new Map(r.orderedSenseIds.map((id, i) => [id, i]));
      cluster.senses.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
      cluster.senses.forEach((s, i) => (s.intraClusterRank = i + 1));
      count++;
    }

    // Re-rank: common senses first, then uncommon; within each group by example quality
    clusters.sort((a, b) => b.senses.length - a.senses.length);
    clusters.forEach((c, i) => (c.rank = i + 1));
    for (const c of clusters) {
      c.senses.sort((a, b) => {
        const aCommon = a.frequency !== 'uncommon' ? 0 : 1;
        const bCommon = b.frequency !== 'uncommon' ? 0 : 1;
        if (aCommon !== bCommon) return aCommon - bCommon;
        const aHasHigh = a.examples.some((e) => e.relevance === 'high') ? 1 : 0;
        const bHasHigh = b.examples.some((e) => e.relevance === 'high') ? 1 : 0;
        return bHasHigh - aHasHigh;
      });
      c.senses.forEach((s, i) => (s.intraClusterRank = i + 1));
    }

    return count;
  }

  // ════════════════════════════════════════════════════════════
  // DeepSeek provider factory
  // ════════════════════════════════════════════════════════════

  private getDeepSeekProvider() {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');
    const client = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
    return (model: string) => client.chat(model);
  }
}
