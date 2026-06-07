import { Injectable, Logger } from '@nestjs/common';
import type {
  RawSense,
  SenseBuckets,
  CleanedSense,
  SenseCluster,
  NormalizedPOS,
  RawCluster,
} from './dictionary.types';

// ──── Local embedding: Bag-of-words with TF weighting ────

/** English stop words to filter out */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'shall', 'you', 'your',
  'he', 'she', 'it', 'they', 'we', 'his', 'her', 'its', 'their', 'our',
  'this', 'that', 'these', 'those', 'not', 'no', 'nor', 'so', 'as',
  'if', 'then', 'than', 'too', 'very', 'just', 'about', 'also',
]);

/** Tokenize definition text into meaningful word tokens */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')  // Replace punctuation with space
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/** Build vocabulary from all sense definitions and create TF vectors */
function buildLexicalEmbeddings(
  allSenses: { key: string; text: string }[],
): Map<string, number[]> {
  const embeddingMap = new Map<string, number[]>();

  if (allSenses.length === 0) return embeddingMap;

  // Build vocabulary from all definitions
  const vocabSet = new Set<string>();
  const docTokens: string[][] = [];

  for (const s of allSenses) {
    const tokens = tokenize(s.text);
    docTokens.push(tokens);
    for (const t of tokens) vocabSet.add(t);
  }

  const vocab = [...vocabSet];
  const vocabSize = vocab.length;
  const wordToIndex = new Map<string, number>();
  vocab.forEach((w, i) => wordToIndex.set(w, i));

  // Create TF-IDF-like vectors (TF only for simplicity)
  const df = new Array(vocabSize).fill(0); // Document frequency
  for (const tokens of docTokens) {
    const uniqueTokens = new Set(tokens);
    for (const t of uniqueTokens) {
      df[wordToIndex.get(t)!]++;
    }
  }

  const N = allSenses.length;

  for (let i = 0; i < allSenses.length; i++) {
    const vec = new Array(vocabSize).fill(0);
    const tokens = docTokens[i];
    const termFreq = new Map<string, number>();
    for (const t of tokens) {
      termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
    }

    // TF-IDF
    for (const [term, tf] of termFreq) {
      const idx = wordToIndex.get(term);
      if (idx === undefined) continue;
      const idf = Math.log((N + 1) / (df[idx] + 1)) + 1; // Smooth IDF
      vec[idx] = tf * idf;
    }

    // Normalize to unit vector
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let j = 0; j < vec.length; j++) vec[j] /= norm;
    }

    embeddingMap.set(allSenses[i].key, vec);
  }

  return embeddingMap;
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Generate a short UUID */
function shortId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/** Simple DBSCAN implementation (cosine distance, Node.js native) */
function dbscanCosine(
  embeddings: number[][],
  eps: number,
  minPts: number,
): number[] {
  const n = embeddings.length;
  const labels = new Array(n).fill(-1); // -1 = noise
  let clusterId = 0;

  // Precompute distance matrix (1 - cosine similarity)
  const distMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = 1 - cosineSimilarity(embeddings[i], embeddings[j]);
      distMatrix[i][j] = dist;
      distMatrix[j][i] = dist;
    }
  }

  // Get neighbors within eps
  const getNeighbors = (p: number): number[] => {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i++) {
      if (i !== p && distMatrix[p][i] <= eps) {
        neighbors.push(i);
      }
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue; // Already assigned
    const neighbors = getNeighbors(i);
    if (neighbors.length < minPts) {
      labels[i] = -1; // Noise
      continue;
    }
    // Start a new cluster
    const cid = clusterId++;
    labels[i] = cid;
    const seeds = [...neighbors];
    while (seeds.length > 0) {
      const q = seeds.pop()!;
      if (labels[q] === -1) {
        labels[q] = cid;
        const qNeighbors = getNeighbors(q);
        if (qNeighbors.length >= minPts) {
          for (const n of qNeighbors) {
            if (labels[n] === -1) {
              seeds.push(n);
            }
          }
        }
      }
    }
  }

  return labels;
}

@Injectable()
export class DictionaryClusteringService {
  private readonly logger = new Logger(DictionaryClusteringService.name);

  // ════════════════════════════════════════════════════════════
  // Stage 4: Embedding Generation (local TF-IDF — zero API cost)
  // ════════════════════════════════════════════════════════════

  async generateEmbeddings(
    buckets: SenseBuckets,
  ): Promise<Map<string, number[]>> {
    const allSenses: { key: string; text: string }[] = [];

    const collect = (senses: RawSense[], pos: string) => {
      for (let i = 0; i < senses.length; i++) {
        const s = senses[i];
        const exampleText = (s as any)._cleanedExamples?.[0]?.en ?? '';
        const text = `[${pos}] ${s.definition}${exampleText ? ` (e.g. ${exampleText})` : ''}`;
        const key = `${pos}:${i}`;
        allSenses.push({ key, text });
      }
    };

    collect(buckets.noun, 'noun');
    collect(buckets.verb, 'verb');
    collect(buckets.adj, 'adj');
    collect(buckets.other, 'other');

    if (allSenses.length === 0) return new Map();

    // Local TF-IDF embedding — no API call needed
    const embeddingMap = buildLexicalEmbeddings(allSenses);
    this.logger.debug(`Local embeddings: ${embeddingMap.size} senses, vocabulary built from definitions`);
    return embeddingMap;
  }

  // ════════════════════════════════════════════════════════════
  // Stage 5: Clustering (DBSCAN per POS bucket)
  // ════════════════════════════════════════════════════════════

  clusterSenses(
    buckets: SenseBuckets,
    embeddingMap: Map<string, number[]>,
  ): Map<string, RawCluster[]> {
    const allClusters = new Map<string, RawCluster[]>();

    const clusterBucket = (senses: RawSense[], bucketName: string) => {
      if (senses.length <= 1) {
        // Single sense → own cluster
        allClusters.set(bucketName, [
          { id: shortId(), senseIndices: [0], centroidIndex: 0 },
        ]);
        return;
      }

      const embeddings: number[][] = [];
      const validIndices: number[] = [];
      for (let i = 0; i < senses.length; i++) {
        const emb = embeddingMap.get(`${bucketName}:${i}`);
        if (emb && emb.some((v) => v !== 0)) {
          embeddings.push(emb);
          validIndices.push(i);
        }
      }

      if (embeddings.length === 0) {
        // No embeddings → all as singletons
        allClusters.set(
          bucketName,
          senses.map((_, i) => ({ id: shortId(), senseIndices: [i], centroidIndex: 0 })),
        );
        return;
      }

      // DBSCAN with cosine distance on lexical embeddings
      // eps=0.45: tighter threshold = more clusters; prevents cross-POS merging
      const labels = dbscanCosine(embeddings, 0.45, 2);

      // Group by label
      const groups = new Map<number, number[]>();
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label)!.push(validIndices[i]);
      }

      const clusters: RawCluster[] = [];
      for (const [label, indices] of groups) {
        // Find centroid (most central embedding)
        let centroidIdx = 0;
        let maxSim = -1;
        for (let i = 0; i < indices.length; i++) {
          let meanSim = 0;
          const embI = embeddingMap.get(`${bucketName}:${indices[i]}`);
          if (!embI) continue;
          for (let j = 0; j < indices.length; j++) {
            if (i === j) continue;
            const embJ = embeddingMap.get(`${bucketName}:${indices[j]}`);
            if (!embJ) continue;
            meanSim += cosineSimilarity(embI, embJ);
          }
          meanSim /= indices.length - 1;
          if (meanSim > maxSim) {
            maxSim = meanSim;
            centroidIdx = i;
          }
        }

        clusters.push({
          id: shortId(),
          senseIndices: indices,
          centroidIndex: centroidIdx,
        });
      }

      allClusters.set(bucketName, clusters);
    };

    clusterBucket(buckets.noun, 'noun');
    clusterBucket(buckets.verb, 'verb');
    clusterBucket(buckets.adj, 'adj');
    clusterBucket(buckets.other, 'other');

    return allClusters;
  }

  // ════════════════════════════════════════════════════════════
  // Stage 6: Cluster Refinement (Lightweight)
  // ════════════════════════════════════════════════════════════

  refineClusters(
    allClusters: Map<string, RawCluster[]>,
    buckets: SenseBuckets,
    embeddingMap: Map<string, number[]>,
  ): Map<string, RawCluster[]> {
    const refined = new Map<string, RawCluster[]>();

    for (const [bucketName, clusters] of allClusters) {
      if (clusters.length <= 1) {
        refined.set(bucketName, clusters);
        continue;
      }

      const senses = (buckets as any)[bucketName] as RawSense[];
      const merged = [...clusters];

      // Merge tiny clusters (1-2 senses) into nearest large cluster
      for (let i = merged.length - 1; i >= 0; i--) {
        if (merged[i].senseIndices.length > 2) continue;

        const tinyEmb = embeddingMap.get(`${bucketName}:${merged[i].senseIndices[merged[i].centroidIndex]}`);
        if (!tinyEmb) continue;

        let bestLargeIdx = -1;
        let bestSim = -1;

        for (let j = 0; j < merged.length; j++) {
          if (i === j || merged[j].senseIndices.length <= 2) continue;
          const largeEmb = embeddingMap.get(`${bucketName}:${merged[j].senseIndices[merged[j].centroidIndex]}`);
          if (!largeEmb) continue;
          const sim = cosineSimilarity(tinyEmb, largeEmb);
          if (sim > bestSim && sim > 0.85) {
            bestSim = sim;
            bestLargeIdx = j;
          }
        }

        if (bestLargeIdx >= 0) {
          merged[bestLargeIdx].senseIndices.push(...merged[i].senseIndices);
          merged.splice(i, 1);
        }
      }

      refined.set(bucketName, merged);
    }

    return refined;
  }

  // ════════════════════════════════════════════════════════════
  // Stage 7: Label & Rank
  // ════════════════════════════════════════════════════════════

  labelAndRank(
    allClusters: Map<string, RawCluster[]>,
    buckets: SenseBuckets,
    embeddingMap: Map<string, number[]>,
  ): SenseCluster[] {
    const result: SenseCluster[] = [];

    const posMap: Record<string, NormalizedPOS> = {
      noun: 'noun',
      verb: 'verb',
      adj: 'adj',
      other: 'other',
    };

    for (const [bucketName, clusters] of allClusters) {
      const senses = (buckets as any)[bucketName] as RawSense[];
      const pos = posMap[bucketName] ?? 'other';

      for (const rc of clusters) {
        // Build CleanedSense[] for this cluster
        const cleanedSenses: (CleanedSense & { _senseIndex: number })[] = rc.senseIndices
          .filter((si) => si >= 0 && si < senses.length && senses[si])
          .map((si, idx) => {
            const raw = senses[si];
            const examples = (Array.isArray((raw as any)?._cleanedExamples)
              ? (raw as any)._cleanedExamples
              : []) as any[];
            const emb = embeddingMap.get(`${bucketName}:${si}`);
            return {
              id: shortId(),
              clusterId: rc.id,
              definition: raw?.definition ?? '',
              partOfSpeech: pos,
              examples: examples.map((e: any) => ({
                en: e.en ?? '',
                zh: e.zh ?? '',
                source: (e.source ?? 'wiktionary') as 'wiktionary' | 'ai_generated',
                relevance: (e.relevance ?? 'medium') as 'high' | 'medium' | 'low',
              })),
              synonyms: raw?.synonyms ?? [],
              antonyms: raw?.antonyms ?? [],
              translations: { zh: '' },
              intraClusterRank: idx + 1,
              tags: raw?.tags ?? [],
              subsenses: [],
              frequency: 'common',
              embedding: emb,
              _senseIndex: (raw as any)?.senseIndex ?? si,
            } as CleanedSense & { _senseIndex: number };
          });

        // Skip empty clusters (shouldn't happen, but guard)
        if (cleanedSenses.length === 0) continue;

        // Cluster label — use first (primary) sense's definition
        // AI Review will replace with concise Chinese category if needed
        const labelSense = cleanedSenses[0];
        const label = labelSense?.definition
          ? (labelSense.definition.length > 60
            ? labelSense.definition.substring(0, 57) + '...'
            : labelSense.definition)
          : '(empty)';

        result.push({
          id: rc.id,
          label,
          posBucket: pos,
          senses: cleanedSenses,
          rank: 0, // Set after sorting
        });
      }
    }

    // Rank clusters by size descending
    result.sort((a, b) => b.senses.length - a.senses.length);
    result.forEach((c, i) => (c.rank = i + 1));

    // Rank senses within each cluster — preserve Wiktionary order (primary first)
    // Wiktionary already orders senses by commonness; we just push uncommon to bottom
    for (const c of result) {
      const senses = c.senses as (CleanedSense & { _senseIndex: number })[];
      senses.sort((a, b) => {
        // Uncommon always at bottom
        if (a.frequency === 'uncommon' && b.frequency !== 'uncommon') return 1;
        if (b.frequency === 'uncommon' && a.frequency !== 'uncommon') return -1;
        // Within same frequency, preserve Wiktionary order
        return (a._senseIndex ?? 0) - (b._senseIndex ?? 0);
      });
      // Strip _senseIndex before storing
      senses.forEach((s: any) => delete s._senseIndex);
      c.senses = senses;
      c.senses.forEach((s, i) => (s.intraClusterRank = i + 1));
    }

    this.logger.debug(
      `Labeled & ranked: ${result.length} clusters, ${result.reduce((sum, c) => sum + c.senses.length, 0)} senses`,
    );

    return result;
  }
}
