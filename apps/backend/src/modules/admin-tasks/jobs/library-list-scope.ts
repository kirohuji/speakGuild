import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { vocabularyMeaningMissingPosPrefix } from '../../admin/vocabulary-meaning.util';
import {
  parseScreenFields,
  textMatchesScreen,
  vocabularyMatchesScreen,
  TEXT_SCREEN_FIELDS,
  VOCABULARY_SCREEN_FIELDS,
  type ScreenField,
  type ScreenMode,
} from './library-field-rules';

export type VocabularyLibraryFilter = {
  search?: string;
  matchType?: 'fuzzy' | 'exact';
  difficulty?: string;
  pronunciationStatus?: 'missing-phonetic' | 'missing-audio' | 'incomplete';
  qualityIssue?: 'meaning-other' | 'english-only-definition' | 'missing-pos-prefix';
  tag?: string;
  sceneId?: string;
  topicId?: string;
  screenMode?: ScreenMode;
  screenFields?: ScreenField[];
};

export type TextLibraryFilter = {
  search?: string;
  difficulty?: string;
  sceneId?: string;
  topicId?: string;
  screenMode?: ScreenMode;
  screenFields?: ScreenField[];
};

export type LibraryPageParams = {
  page?: number;
  pageSize?: number;
};

const PRONUNCIATION_STATUSES = new Set<VocabularyLibraryFilter['pronunciationStatus']>([
  'missing-phonetic',
  'missing-audio',
  'incomplete',
]);
const QUALITY_ISSUES = new Set<VocabularyLibraryFilter['qualityIssue']>([
  'meaning-other',
  'english-only-definition',
  'missing-pos-prefix',
]);

const QUALITY_LABEL: Record<NonNullable<VocabularyLibraryFilter['qualityIssue']>, string> = {
  'meaning-other': '中文释义含 other',
  'english-only-definition': '英文释义未双语',
  'missing-pos-prefix': '释义缺词性前缀',
};

const PRONUNCIATION_LABEL: Record<NonNullable<VocabularyLibraryFilter['pronunciationStatus']>, string> = {
  incomplete: '音标或发音缺失',
  'missing-phonetic': '缺音标',
  'missing-audio': '缺发音',
};

function trimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text || undefined;
}

function topicBinding(sceneId?: string, topicId?: string) {
  if (!sceneId && !topicId) return undefined;
  return {
    some: {
      ...(topicId ? { topicId } : {}),
      ...(sceneId ? { topic: { sceneId } } : {}),
    },
  };
}

export function normalizeVocabularyFilter(raw?: Partial<VocabularyLibraryFilter> | null): VocabularyLibraryFilter {
  const source = raw && typeof raw === 'object' ? raw : {};
  const filter: VocabularyLibraryFilter = {};
  const search = trimmed(source.search);
  if (search) {
    filter.search = search;
    filter.matchType = source.matchType === 'exact' ? 'exact' : 'fuzzy';
  }
  const difficulty = trimmed(source.difficulty);
  if (difficulty) filter.difficulty = difficulty;
  if (source.pronunciationStatus && PRONUNCIATION_STATUSES.has(source.pronunciationStatus)) {
    filter.pronunciationStatus = source.pronunciationStatus;
  }
  if (source.qualityIssue && QUALITY_ISSUES.has(source.qualityIssue)) {
    filter.qualityIssue = source.qualityIssue;
  }
  const tag = trimmed(source.tag);
  if (tag) filter.tag = tag;
  const sceneId = trimmed(source.sceneId);
  if (sceneId) filter.sceneId = sceneId;
  const topicId = trimmed(source.topicId);
  if (topicId) filter.topicId = topicId;
  const screenFields = parseScreenFields(source.screenFields, VOCABULARY_SCREEN_FIELDS);
  if (screenFields.length) {
    filter.screenFields = screenFields;
    filter.screenMode = source.screenMode === 'regenerate' ? 'regenerate' : source.screenMode === 'normalize' ? 'normalize' : 'fill';
  }
  return filter;
}

export function normalizeTextFilter(raw?: Partial<TextLibraryFilter> | null): TextLibraryFilter {
  const source = raw && typeof raw === 'object' ? raw : {};
  const filter: TextLibraryFilter = {};
  const search = trimmed(source.search);
  if (search) filter.search = search;
  const difficulty = trimmed(source.difficulty);
  if (difficulty) filter.difficulty = difficulty;
  const sceneId = trimmed(source.sceneId);
  if (sceneId) filter.sceneId = sceneId;
  const topicId = trimmed(source.topicId);
  if (topicId) filter.topicId = topicId;
  const screenFields = parseScreenFields(source.screenFields, TEXT_SCREEN_FIELDS);
  if (screenFields.length) {
    filter.screenFields = screenFields;
    filter.screenMode = source.screenMode === 'regenerate' ? 'regenerate' : source.screenMode === 'normalize' ? 'normalize' : 'fill';
  }
  return filter;
}

export function vocabularyFilterKey(raw?: Partial<VocabularyLibraryFilter> | null): string {
  return JSON.stringify(normalizeVocabularyFilter(raw));
}

export function textFilterKey(raw?: Partial<TextLibraryFilter> | null): string {
  return JSON.stringify(normalizeTextFilter(raw));
}

export function buildVocabularyWhere(raw?: Partial<VocabularyLibraryFilter> | null): Prisma.VocabularyWhereInput {
  const filter = normalizeVocabularyFilter(raw);
  const where: Prisma.VocabularyWhereInput = {};
  if (filter.search) {
    const match = filter.matchType === 'exact'
      ? { equals: filter.search, mode: 'insensitive' as const }
      : { contains: filter.search, mode: 'insensitive' as const };
    where.OR = [{ word: match }, { meaning: match }];
  }
  if (filter.difficulty) where.difficulty = filter.difficulty;

  const missingPhonetic: Prisma.VocabularyWhereInput = {
    OR: [
      { phoneticUs: null }, { phoneticUs: '' },
      { phoneticUk: null }, { phoneticUk: '' },
    ],
  };
  const missingAudio: Prisma.VocabularyWhereInput = {
    OR: [
      { audioUsUrl: null }, { audioUsUrl: '' },
      { audioUkUrl: null }, { audioUkUrl: '' },
    ],
  };
  const andFilters: Prisma.VocabularyWhereInput[] = [];
  if (filter.pronunciationStatus === 'missing-phonetic') andFilters.push(missingPhonetic);
  if (filter.pronunciationStatus === 'missing-audio') andFilters.push(missingAudio);
  if (filter.pronunciationStatus === 'incomplete') andFilters.push({ OR: [missingPhonetic, missingAudio] });
  if (filter.qualityIssue === 'meaning-other') {
    andFilters.push({ meaning: { contains: 'other', mode: 'insensitive' } });
  }
  if (filter.qualityIssue === 'english-only-definition') {
    andFilters.push({ definitionEn: { not: null } });
    andFilters.push({ NOT: { definitionEn: '' } });
  }
  if (filter.qualityIssue === 'missing-pos-prefix') {
    andFilters.push({ NOT: { meaning: '' } });
  }
  if (filter.tag) andFilters.push({ tags: { has: filter.tag } });
  const binding = topicBinding(filter.sceneId, filter.topicId);
  if (binding) andFilters.push({ topicVocabs: binding });
  if (andFilters.length) where.AND = andFilters;
  return where;
}

export function buildChunkWhere(raw?: Partial<TextLibraryFilter> | null): Prisma.ChunkWhereInput {
  const filter = normalizeTextFilter(raw);
  const where: Prisma.ChunkWhereInput = {};
  if (filter.search) {
    where.OR = [
      { text: { contains: filter.search, mode: 'insensitive' } },
      { meaning: { contains: filter.search, mode: 'insensitive' } },
    ];
  }
  if (filter.difficulty) where.difficulty = filter.difficulty;
  const binding = topicBinding(filter.sceneId, filter.topicId);
  if (binding) where.topicChunks = binding;
  return where;
}

export function buildPatternWhere(raw?: Partial<TextLibraryFilter> | null): Prisma.SentencePatternWhereInput {
  const filter = normalizeTextFilter(raw);
  const where: Prisma.SentencePatternWhereInput = {};
  if (filter.search) {
    where.OR = [
      { pattern: { contains: filter.search, mode: 'insensitive' } },
      { meaning: { contains: filter.search, mode: 'insensitive' } },
    ];
  }
  if (filter.difficulty) where.difficulty = filter.difficulty;
  const binding = topicBinding(filter.sceneId, filter.topicId);
  if (binding) where.topicPatterns = binding;
  return where;
}

const SCREEN_FIELD_LABEL: Record<ScreenField, string> = {
  meaning: '中文释义',
  description: '讲解',
  examples: '例句',
  definition: '英文释义',
  pronunciation: '音标与发音',
  difficulty: '难度',
};

function screenModeOf(mode: VocabularyLibraryFilter['screenMode']): ScreenMode {
  if (mode === 'regenerate' || mode === 'normalize') return mode;
  return 'fill';
}

function vocabularyScreen(filter: VocabularyLibraryFilter) {
  if (!filter.screenFields?.length) return null;
  return {
    mode: screenModeOf(filter.screenMode),
    fields: filter.screenFields,
  };
}

function textScreen(filter: TextLibraryFilter) {
  if (!filter.screenFields?.length) return null;
  return {
    mode: screenModeOf(filter.screenMode),
    fields: filter.screenFields,
  };
}

async function pronunciationByWord(prisma: PrismaService, words: string[]) {
  const keys = [...new Set(words.map((word) => word.trim().toLowerCase()).filter(Boolean))];
  const entries: Array<{ word: string; pronunciations: unknown }> = [];
  for (let index = 0; index < keys.length; index += 500) {
    entries.push(...await prisma.dictionaryEntry.findMany({
      where: { word: { in: keys.slice(index, index + 500) } },
      select: { word: true, pronunciations: true },
    }));
  }
  return new Map(entries.map((entry) => [entry.word.toLowerCase(), entry.pronunciations]));
}

function matchesMemoryQuality(
  row: { definitionEn?: string | null; meaning?: string | null },
  qualityIssue?: VocabularyLibraryFilter['qualityIssue'],
): boolean {
  if (qualityIssue === 'english-only-definition') {
    return !!(row.definitionEn && !/[\u3400-\u9fff]/.test(row.definitionEn));
  }
  if (qualityIssue === 'missing-pos-prefix') {
    return vocabularyMeaningMissingPosPrefix(row.meaning);
  }
  return true;
}

function pageWindow(params?: LibraryPageParams) {
  const page = Math.max(1, Number(params?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize) || 20));
  return { page, pageSize };
}

async function collectIds(
  load: (cursor?: string) => Promise<Array<{ id: string }>>,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const rows = await load(cursor);
    if (!rows.length) break;
    ids.push(...rows.map((row) => row.id));
    cursor = rows.at(-1)?.id;
  } while (cursor);
  return ids;
}

export async function listVocabularyIds(
  prisma: PrismaService,
  raw?: Partial<VocabularyLibraryFilter> | null,
): Promise<string[]> {
  const filter = normalizeVocabularyFilter(raw);
  const where = buildVocabularyWhere(filter);
  const screen = vocabularyScreen(filter);
  const needsMemory = filter.qualityIssue === 'english-only-definition' || filter.qualityIssue === 'missing-pos-prefix';
  if (!needsMemory && !screen) {
    return collectIds((cursor) => prisma.vocabulary.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }));
  }
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const rows = await prisma.vocabulary.findMany({
      where,
      select: {
        id: true, word: true, meaning: true, description: true, examples: true, definitionEn: true,
        phoneticUs: true, phoneticUk: true, audioUsUrl: true, audioUkUrl: true, difficulty: true,
      },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    const pronunciations = screen?.fields.includes('pronunciation')
      ? await pronunciationByWord(prisma, rows.map((row) => row.word))
      : new Map<string, unknown>();
    for (const row of rows) {
      if (!matchesMemoryQuality(row, filter.qualityIssue)) continue;
      if (screen && !vocabularyMatchesScreen(row, screen.mode, screen.fields, pronunciations.get(row.word.trim().toLowerCase()))) continue;
      ids.push(row.id);
    }
    cursor = rows.at(-1)?.id;
  } while (cursor);
  return ids;
}

export async function listChunkIds(prisma: PrismaService, raw?: Partial<TextLibraryFilter> | null): Promise<string[]> {
  const filter = normalizeTextFilter(raw);
  const where = buildChunkWhere(filter);
  const screen = textScreen(filter);
  if (!screen) {
    return collectIds((cursor) => prisma.chunk.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }));
  }
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const rows = await prisma.chunk.findMany({
      where,
      select: { id: true, meaning: true, description: true, examples: { select: { zh: true } } },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const row of rows) {
      if (textMatchesScreen(row, screen.mode, screen.fields)) ids.push(row.id);
    }
    cursor = rows.at(-1)?.id;
  } while (cursor);
  return ids;
}

export async function listPatternIds(prisma: PrismaService, raw?: Partial<TextLibraryFilter> | null): Promise<string[]> {
  const filter = normalizeTextFilter(raw);
  const where = buildPatternWhere(filter);
  const screen = textScreen(filter);
  if (!screen) {
    return collectIds((cursor) => prisma.sentencePattern.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }));
  }
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const rows = await prisma.sentencePattern.findMany({
      where,
      select: { id: true, meaning: true, description: true, examples: true },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const row of rows) {
      if (textMatchesScreen(row, screen.mode, screen.fields)) ids.push(row.id);
    }
    cursor = rows.at(-1)?.id;
  } while (cursor);
  return ids;
}

export async function countVocabularyMatches(
  prisma: PrismaService,
  raw?: Partial<VocabularyLibraryFilter> | null,
): Promise<number> {
  const filter = normalizeVocabularyFilter(raw);
  if (filter.screenFields?.length || filter.qualityIssue === 'english-only-definition' || filter.qualityIssue === 'missing-pos-prefix') {
    return (await listVocabularyIds(prisma, filter)).length;
  }
  return prisma.vocabulary.count({ where: buildVocabularyWhere(filter) });
}

export async function countChunkMatches(prisma: PrismaService, raw?: Partial<TextLibraryFilter> | null): Promise<number> {
  const filter = normalizeTextFilter(raw);
  if (filter.screenFields?.length) return (await listChunkIds(prisma, filter)).length;
  return prisma.chunk.count({ where: buildChunkWhere(filter) });
}

export async function countPatternMatches(prisma: PrismaService, raw?: Partial<TextLibraryFilter> | null): Promise<number> {
  const filter = normalizeTextFilter(raw);
  if (filter.screenFields?.length) return (await listPatternIds(prisma, filter)).length;
  return prisma.sentencePattern.count({ where: buildPatternWhere(filter) });
}

export async function countVocabularyInIds(
  prisma: PrismaService,
  ids: string[],
  extra: Prisma.VocabularyWhereInput,
): Promise<number> {
  let total = 0;
  for (let index = 0; index < ids.length; index += 500) {
    total += await prisma.vocabulary.count({
      where: { AND: [{ id: { in: ids.slice(index, index + 500) } }, extra] },
    });
  }
  return total;
}

async function scopeNames(prisma: PrismaService, sceneId?: string, topicId?: string): Promise<string[]> {
  const parts: string[] = [];
  if (sceneId) {
    const scene = await prisma.scene.findUnique({ where: { id: sceneId }, select: { title: true } });
    parts.push(`学习包「${scene?.title || sceneId}」`);
  }
  if (topicId) {
    const topic = await prisma.trainingTopic.findUnique({ where: { id: topicId }, select: { title: true } });
    parts.push(`话题「${topic?.title || topicId}」`);
  }
  return parts;
}

export async function describeVocabularyFilter(
  prisma: PrismaService,
  raw?: Partial<VocabularyLibraryFilter> | null,
): Promise<string> {
  const filter = normalizeVocabularyFilter(raw);
  const parts: string[] = [];
  if (filter.search) parts.push(`${filter.matchType === 'exact' ? '精确' : '模糊'}搜索「${filter.search}」`);
  if (filter.difficulty) parts.push(`难度 ${filter.difficulty}`);
  if (filter.tag) parts.push(`标签 ${filter.tag}`);
  if (filter.pronunciationStatus) parts.push(PRONUNCIATION_LABEL[filter.pronunciationStatus]);
  if (filter.qualityIssue) parts.push(QUALITY_LABEL[filter.qualityIssue]);
  if (filter.screenFields?.length) {
    const names = filter.screenFields.map((field) => SCREEN_FIELD_LABEL[field]).join('、');
    parts.push(filter.screenMode === 'regenerate' ? `筛出可重新生成：${names}` : filter.screenMode === 'normalize' ? `筛出不规范：${names}` : `筛出缺失：${names}`);
  }
  parts.push(...await scopeNames(prisma, filter.sceneId, filter.topicId));
  return parts.length ? parts.join('，') : '未筛选（全部）';
}

export async function describeTextFilter(
  prisma: PrismaService,
  raw?: Partial<TextLibraryFilter> | null,
  kind: '句块' | '句式' = '句块',
): Promise<string> {
  const filter = normalizeTextFilter(raw);
  const parts: string[] = [];
  if (filter.search) parts.push(`搜索「${filter.search}」`);
  if (filter.difficulty) parts.push(`难度 ${filter.difficulty}`);
  if (filter.screenFields?.length) {
    const names = filter.screenFields.map((field) => SCREEN_FIELD_LABEL[field]).join('、');
    parts.push(filter.screenMode === 'regenerate' ? `筛出可重新生成：${names}` : filter.screenMode === 'normalize' ? `筛出不规范：${names}` : `筛出缺失：${names}`);
  }
  parts.push(...await scopeNames(prisma, filter.sceneId, filter.topicId));
  return parts.length ? parts.join('，') : `未筛选（全部${kind}）`;
}

export async function queryVocabularyPage(
  prisma: PrismaService,
  params?: Partial<VocabularyLibraryFilter> & LibraryPageParams,
) {
  const { page, pageSize } = pageWindow(params);
  const filter = normalizeVocabularyFilter(params);
  const where = buildVocabularyWhere(filter);
  const screen = vocabularyScreen(filter);
  const memoryQuality = filter.qualityIssue === 'english-only-definition' || filter.qualityIssue === 'missing-pos-prefix';
  if (screen || memoryQuality) {
    const candidates = await prisma.vocabulary.findMany({
      where,
      select: {
        id: true, word: true, meaning: true, description: true, examples: true, definitionEn: true,
        phoneticUs: true, phoneticUk: true, audioUsUrl: true, audioUkUrl: true, difficulty: true,
      },
      orderBy: { word: 'asc' },
    });
    const pronunciations = screen?.fields.includes('pronunciation')
      ? await pronunciationByWord(prisma, candidates.map((row) => row.word))
      : new Map<string, unknown>();
    const matchedIds = candidates
      .filter((row) => matchesMemoryQuality(row, filter.qualityIssue))
      .filter((row) => !screen || vocabularyMatchesScreen(row, screen.mode, screen.fields, pronunciations.get(row.word.trim().toLowerCase())))
      .map((row) => row.id);
    const total = matchedIds.length;
    const pageIds = matchedIds.slice((page - 1) * pageSize, page * pageSize);
    const unordered = pageIds.length
      ? await prisma.vocabulary.findMany({ where: { id: { in: pageIds } } })
      : [];
    const byId = new Map(unordered.map((item) => [item.id, item]));
    const items = pageIds.map((id) => byId.get(id)!).filter(Boolean);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
  const [items, total] = await Promise.all([
    prisma.vocabulary.findMany({
      where,
      orderBy: { word: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vocabulary.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function queryChunkPage(
  prisma: PrismaService,
  params?: Partial<TextLibraryFilter> & LibraryPageParams,
) {
  const { page, pageSize } = pageWindow(params);
  const filter = normalizeTextFilter(params);
  const where = buildChunkWhere(filter);
  const screen = textScreen(filter);
  if (screen) {
    const candidates = await prisma.chunk.findMany({
      where,
      include: { examples: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    const matched = candidates.filter((row) => textMatchesScreen(row, screen.mode, screen.fields));
    const items = matched.slice((page - 1) * pageSize, page * pageSize);
    return { items, total: matched.length, page, pageSize, totalPages: Math.ceil(matched.length / pageSize) };
  }
  const [items, total] = await Promise.all([
    prisma.chunk.findMany({
      where,
      include: { examples: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.chunk.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function queryPatternPage(
  prisma: PrismaService,
  params?: Partial<TextLibraryFilter> & LibraryPageParams,
) {
  const { page, pageSize } = pageWindow(params);
  const filter = normalizeTextFilter(params);
  const where = buildPatternWhere(filter);
  const screen = textScreen(filter);
  if (screen) {
    const candidates = await prisma.sentencePattern.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    const matched = candidates.filter((row) => textMatchesScreen(row, screen.mode, screen.fields));
    const items = matched.slice((page - 1) * pageSize, page * pageSize);
    return { items, total: matched.length, page, pageSize, totalPages: Math.ceil(matched.length / pageSize) };
  }
  const [items, total] = await Promise.all([
    prisma.sentencePattern.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sentencePattern.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
