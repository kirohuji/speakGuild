import { get, post, put } from '@/lib/request';

// ─── Types ───────────────────────────────────────────────────

export interface DictionaryPronunciation {
  type: 'uk' | 'us';
  ipa: string;
  audioUrl?: string;
  isPreferred: boolean;
  notation?: 'IPA';
  source?: string;
  needsReview?: boolean;
  aiConfidence?: number;
  aiReason?: string;
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
  frequency?: 'common' | 'uncommon';
}

export interface DictionaryCluster {
  id: string;
  label: string;
  posBucket: string;
  senses: DictionarySense[];
  rank: number;
}

export interface DictionaryWordForm {
  word: string;
  tags: string[];
}

export interface DictionaryEntry {
  word: string;
  language: string;
  sourceUrl?: string;
  pronunciations: DictionaryPronunciation[];
  senseClusters: DictionaryCluster[];
  senses: DictionarySense[];
  entrySynonyms: string[];
  wordForms: DictionaryWordForm[];
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

export type PronunciationProvider = 'auto' | 'wiktionary' | 'freedictionaryapi' | 'dictionaryapi.dev' | 'datamuse' | 'ai_verify';
export type PronunciationScope = 'all' | 'uk' | 'us';
export type PronunciationAuditFilter = 'all' | 'missing' | 'unreviewed' | 'noncanonical' | 'invalid';

export interface PronunciationAuditAccent {
  ipa: string | null;
  normalizedIpa: string | null;
  source: string;
  audioUrl: string | null;
  hasAudio: boolean;
  isIpa: boolean;
  isTrusted: boolean;
  aiConfidence: number | null;
  aiReason: string | null;
  invalidVariantIpa: string | null;
  issues: string[];
}

export interface PronunciationAuditItem {
  word: string;
  sourceUrl: string | null;
  uk: PronunciationAuditAccent;
  us: PronunciationAuditAccent;
  status: 'passed' | 'attention' | 'missing';
  locked: boolean;
  /** UK 与 US 均由 AI 选择可信来源，且均记录了置信度。 */
  aiReviewed: boolean;
}

export interface PronunciationAuditResult {
  items: PronunciationAuditItem[];
  total: number;
  page: number;
  pageSize: 100;
  totalPages: number;
  pageStats: {
    passed: number;
    attention: number;
    missing: number;
    withAudio: number;
  };
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

/** Audit dictionary pronunciations in fixed batches of 100. */
export async function getPronunciationAudit(params?: {
  search?: string;
  page?: number;
  filter?: PronunciationAuditFilter;
}): Promise<PronunciationAuditResult> {
  return get('/dictionary/pronunciation-audit', params);
}

/** Lock complete high-confidence UK/US pairs from the visible audit page. */
export async function lockHighConfidencePronunciations(words: string[]): Promise<{
  scanned: number;
  eligible: number;
  locked: number;
  alreadyLocked: number;
}> {
  return post('/dictionary/pronunciation/lock-high-confidence-current-page', { words });
}

/** Normalize all non-canonical IPA spellings without changing other dictionary data. */
export async function normalizeNoncanonicalPronunciations(): Promise<{
  scanned: number;
  wordsUpdated: number;
  pronunciationsUpdated: number;
  pronunciationsRemoved: number;
}> {
  return post('/dictionary/pronunciation/normalize-noncanonical');
}

/** Replace one word's pronunciation data from a selected provider. */
export async function refreshDictionaryPronunciation(
  word: string,
  provider: PronunciationProvider,
  scope: PronunciationScope,
): Promise<PronunciationAuditItem> {
  return post(`/dictionary/${encodeURIComponent(word)}/pronunciation/refresh`, { provider, scope });
}

/** 人工确认整词 UK / US 音标无误，并控制是否跳过后续批量检查。 */
export async function setDictionaryPronunciationLocked(word: string, locked: boolean): Promise<PronunciationAuditItem> {
  return post(`/dictionary/${encodeURIComponent(word)}/pronunciation/lock`, { locked });
}

/** Generate and persist one missing UK/US pronunciation audio asset. */
export async function generateDictionaryPronunciationAudio(
  word: string,
  type: 'uk' | 'us',
  gender: 'female' | 'male' = 'female',
): Promise<PronunciationAuditItem> {
  return post(`/dictionary/${encodeURIComponent(word)}/pronunciation/audio/generate`, { type, gender });
}

/** Manually replace one accent's IPA. Slashes are optional. */
export async function saveManualDictionaryPronunciation(
  word: string,
  type: 'uk' | 'us',
  ipa: string,
): Promise<PronunciationAuditItem> {
  return put(`/dictionary/${encodeURIComponent(word)}/pronunciation/manual`, { type, ipa });
}

/** Apply canonical broad-IPA formatting to one accent without changing its source metadata. */
export async function normalizeDictionaryPronunciation(
  word: string,
  type: 'uk' | 'us',
): Promise<PronunciationAuditItem> {
  return put(`/dictionary/${encodeURIComponent(word)}/pronunciation/normalize`, { type });
}

/** Clear only one word's pronunciation data. */
export async function clearDictionaryPronunciation(
  word: string,
  scope: PronunciationScope,
): Promise<PronunciationAuditItem> {
  return (await import('@/lib/request')).del(
    `/dictionary/${encodeURIComponent(word)}/pronunciation?scope=${scope}`,
  );
}

/** 将音标审查页当前的最多 100 个单词交由任务中心自动更新。 */
export async function enqueuePronunciationRefreshCurrentPage(params: {
  page: number;
  search?: string;
  filter?: PronunciationAuditFilter;
}): Promise<{ id: string }> {
  return post('/admin/tasks/dictionary-pronunciations/refresh-current-page', undefined, { params });
}

/** Generate every missing UK/US audio asset on the current 100-row audit page. */
export async function enqueuePronunciationAudioCurrentPage(params: {
  page: number;
  search?: string;
  filter?: PronunciationAuditFilter;
}): Promise<{ id: string; totalItems: number }> {
  return post('/admin/tasks/dictionary-pronunciations/generate-current-page-audio', undefined, { params });
}
