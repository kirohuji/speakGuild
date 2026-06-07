import { get, post } from '@/lib/request';

// ─── Types ───────────────────────────────────────────────────

export interface DictionaryPronunciation {
  type: 'uk' | 'us';
  ipa: string;
  audioUrl?: string;
  isPreferred: boolean;
}

export interface DictionaryExample {
  en: string;
  zh: string;
  source: 'wiktionary' | 'ai_generated';
  relevance: 'high' | 'medium' | 'low';
}

export interface DictionarySense {
  id: string;
  clusterId: string;
  definition: string;
  partOfSpeech: string;
  examples: DictionaryExample[];
  synonyms: string[];
  antonyms: string[];
  translations: { zh: string };
  intraClusterRank: number;
  tags: string[];
  subsenses: DictionarySense[];
}

export interface DictionaryCluster {
  id: string;
  label: string;
  posBucket: string;
  senses: DictionarySense[];
  rank: number;
}

export interface DictionaryEntry {
  word: string;
  language: string;
  sourceUrl?: string;
  pronunciations: DictionaryPronunciation[];
  senseClusters: DictionaryCluster[];
  senses: DictionarySense[];
  aiReviewed: boolean;
  aiReviewMeta?: {
    reviewedAt: string;
    issuesFound: number;
    fixesApplied: number;
    modelUsed: string;
  };
  pipelineVersion?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DictionarySearchResult {
  word: string;
  primaryDefinition: string;
  primaryPOS: string;
  clusterCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── API ─────────────────────────────────────────────────────

/** Search dictionary entries (prefix) */
export async function searchDictionary(q: string): Promise<DictionarySearchResult[]> {
  return get('/dictionary/search/suggestions', { q });
}

/** List all dictionary entries with pagination */
export async function listDictionary(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<DictionaryEntry>> {
  return get('/dictionary/list', params);
}

/** Get single dictionary entry */
export async function getDictionaryEntry(word: string): Promise<DictionaryEntry> {
  return get(`/dictionary/${encodeURIComponent(word)}`);
}

/** Batch enrich (trigger pipeline for words) */
export async function batchEnrichDictionary(words: string[]): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  errors: { word: string; success: boolean; error?: string }[];
}> {
  return post('/dictionary/batch-enrich', { words });
}

/** Delete a dictionary entry */
export async function deleteDictionaryEntry(word: string): Promise<void> {
  return (await import('@/lib/request')).del(`/dictionary/${encodeURIComponent(word)}`);
}
