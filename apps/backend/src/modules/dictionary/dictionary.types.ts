// ──── FreeDictionaryAPI Raw Response Types ────

export interface FreeDictApiResponse {
  word: string;
  entries: FreeDictEntry[];
  source: {
    url: string;
    license: { name: string; url: string };
  };
}

export interface FreeDictEntry {
  language: { code: string; name: string };
  partOfSpeech: string;
  pronunciations: FreeDictPronunciation[];
  forms: FreeDictForm[];
  senses: FreeDictSense[];
  synonyms: string[];
  antonyms: string[];
}

export interface FreeDictPronunciation {
  type: string;
  text: string;
  tags: string[];
}

export interface FreeDictForm {
  word: string;
  tags: string[];
}

export interface FreeDictSense {
  definition: string;
  tags: string[];
  examples: string[];
  quotes: FreeDictQuote[];
  synonyms: string[];
  antonyms: string[];
  translations: FreeDictTranslation[];
  subsenses: FreeDictSense[];
}

export interface FreeDictQuote {
  text: string;
  reference: string;
}

export interface FreeDictTranslation {
  language: { code: string; name: string };
  word: string;
}

// ──── Pipeline Intermediate Types ────

/** Raw sense after flattening subsenses, before cleaning */
export interface RawSense {
  definition: string;
  partOfSpeech: string;
  tags: string[];
  examples: string[];
  quotes: FreeDictQuote[];
  synonyms: string[];
  antonyms: string[];
  translations: FreeDictTranslation[];
  /** Source entry index for traceability */
  entryIndex: number;
  /** Original position within the entry's sense list (Wiktionary order = commonness order) */
  senseIndex: number;
}

/** POS-bucketed output from Stage 1 Rule Filter */
export interface SenseBuckets {
  noun: RawSense[];
  verb: RawSense[];
  adj: RawSense[];
  other: RawSense[];
}

// ──── Final Cleaned Types (stored as JSON on DictionaryEntry) ────

export type NormalizedPOS =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'adv'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'interjection'
  | 'determiner'
  | 'article'
  | 'other';

export interface CleanedExample {
  en: string;
  zh: string;
  source: 'wiktionary' | 'ai_generated';
  relevance: 'high' | 'medium' | 'low';
}

export interface CleanedPronunciation {
  type: 'uk' | 'us';
  ipa: string;
  audioUrl?: string;
  isPreferred: boolean;
}

export interface CleanedSense {
  id: string;
  clusterId: string;
  definition: string;
  partOfSpeech: NormalizedPOS;
  examples: CleanedExample[];
  synonyms: string[];
  antonyms: string[];
  translations: { zh: string };
  intraClusterRank: number;
  tags: string[];
  subsenses: CleanedSense[];
  embedding?: number[];
  /** 常用度标记：common = 常用，uncommon = 不常用（默认隐藏） */
  frequency?: 'common' | 'uncommon';
}

export interface SenseCluster {
  id: string;
  label: string;
  posBucket: NormalizedPOS;
  senses: CleanedSense[];
  rank: number;
}

// ──── Raw cluster before labeling/ranking ────

export interface RawCluster {
  id: string;
  senseIndices: number[];
  centroidIndex: number;
}

// ──── AI Review Types ────

export interface AiReviewPatch {
  reassignments?: { senseId: string; fromClusterId: string; toClusterId: string }[];
  missingDefinitions?: { definition: string; suggestedCluster: string }[];
  posFixes?: { senseId: string; correctedPOS: NormalizedPOS }[];
  translationFixes?: { senseId: string; field: string; corrected: string }[];
  labelFixes?: { clusterId: string; correctedLabel: string }[];
  frequencyMarks?: { senseId: string; frequency: 'common' | 'uncommon' }[];
  senseReorderings?: { clusterId: string; orderedSenseIds: string[] }[];
}

export interface AiReviewMeta {
  reviewedAt: string;
  issuesFound: number;
  fixesApplied: number;
  modelUsed: string;
}
