import { alignDescriptionLayout, descriptionHasCanonicalLayout } from '../../admin/description-layout';
import { vocabularyMeaningMissingPosPrefix } from '../../admin/vocabulary-meaning.util';

export const VOCABULARY_SCREEN_FIELDS = ['meaning', 'description', 'examples', 'definition', 'pronunciation', 'difficulty'] as const;
export const TEXT_SCREEN_FIELDS = ['meaning', 'description', 'examples'] as const;
export type ScreenField = typeof VOCABULARY_SCREEN_FIELDS[number];
export type ScreenMode = 'fill' | 'regenerate';

const DIFFICULTIES = new Set(['L1', 'L2', 'L3', 'L4', 'L5']);
const hasChinese = (value?: string | null) => /[\u3400-\u9fff]/.test(value ?? '');
const isPlaceholderMeaning = (value?: string | null) => /^待补充[\s.。…]*$/.test((value ?? '').trim());

type ExampleLike = { zh?: string | null };

export function parseScreenFields(value: unknown, allowed: readonly ScreenField[]): ScreenField[] {
  const raw = Array.isArray(value) ? value.join(',') : typeof value === 'string' ? value : '';
  const allowedSet = new Set<string>(allowed);
  const fields: ScreenField[] = [];
  for (const part of raw.split(',')) {
    const field = part.trim();
    if (allowedSet.has(field) && !fields.includes(field as ScreenField)) fields.push(field as ScreenField);
  }
  return fields;
}

export function meaningNeedsWork(meaning: string | null | undefined, mode: ScreenMode, kind: 'vocabulary' | 'text'): boolean {
  const text = meaning ?? '';
  const placeholder = isPlaceholderMeaning(text);
  if (kind === 'text') {
    return mode === 'fill' ? !hasChinese(text) || placeholder : hasChinese(text) && !placeholder;
  }
  const missing = !hasChinese(text) || placeholder || /other/i.test(text) || vocabularyMeaningMissingPosPrefix(text);
  return mode === 'fill' ? missing : hasChinese(text) && !placeholder;
}

/** 已经写成四个标准小节的讲解，补全和重新生成都不再动。 */
export function descriptionNeedsWork(description: string | null | undefined, mode: ScreenMode, kind: 'vocabulary' | 'text'): boolean {
  const text = description?.trim() ?? '';
  if (kind === 'text') {
    if (mode === 'fill') return !text;
    if (!text || descriptionHasCanonicalLayout(text)) return false;
    return alignDescriptionLayout(text) !== text;
  }
  if (mode === 'fill') return !descriptionHasCanonicalLayout(text);
  if (!text || descriptionHasCanonicalLayout(text)) return false;
  return alignDescriptionLayout(text) !== text;
}

export function examplesNeedWork(value: unknown, mode: ScreenMode): boolean {
  const examples = Array.isArray(value) ? value as ExampleLike[] : [];
  const missing = examples.length === 0 || examples.some((example) => !example?.zh?.trim());
  return mode === 'fill' ? missing : examples.length > 0;
}

export function definitionNeedsWork(definitionEn: string | null | undefined, mode: ScreenMode): boolean {
  const text = definitionEn?.trim() ?? '';
  if (!text) return false;
  return mode === 'fill' ? !hasChinese(text) : true;
}

export function difficultyNeedsWork(difficulty: string | null | undefined, mode: ScreenMode): boolean {
  const valid = DIFFICULTIES.has(difficulty ?? '');
  return mode === 'fill' ? !valid : valid;
}

export function pronunciationNeedsWork(
  row: { phoneticUs?: string | null; phoneticUk?: string | null; audioUsUrl?: string | null; audioUkUrl?: string | null },
  pronunciations: unknown,
  mode: ScreenMode,
): boolean {
  return Object.keys(buildPronunciationPatch(row, pronunciations, mode)).length > 0;
}

export function buildPronunciationPatch(
  row: { phoneticUs?: string | null; phoneticUk?: string | null; audioUsUrl?: string | null; audioUkUrl?: string | null },
  pronunciations: unknown,
  mode: ScreenMode,
): Partial<Record<'phoneticUs' | 'phoneticUk' | 'audioUsUrl' | 'audioUkUrl', string>> {
  const list = Array.isArray(pronunciations) ? pronunciations as Array<{ type?: string; isPreferred?: boolean; ipa?: string; audioUrl?: string }> : [];
  const pick = (type: 'us' | 'uk') => list.find((item) => item?.type === type && item?.isPreferred) ?? list.find((item) => item?.type === type);
  const us = pick('us');
  const uk = pick('uk');
  const data: Partial<Record<'phoneticUs' | 'phoneticUk' | 'audioUsUrl' | 'audioUkUrl', string>> = {};
  const assign = (current: string | null | undefined, next: string | undefined, key: 'phoneticUs' | 'phoneticUk' | 'audioUsUrl' | 'audioUkUrl') => {
    const value = next?.trim();
    if (!value) return;
    if (mode === 'fill' && current?.trim()) return;
    if (current?.trim() === value) return;
    data[key] = value;
  };
  assign(row.phoneticUs, us?.ipa, 'phoneticUs');
  assign(row.phoneticUk, uk?.ipa, 'phoneticUk');
  assign(row.audioUsUrl, us?.audioUrl, 'audioUsUrl');
  assign(row.audioUkUrl, uk?.audioUrl, 'audioUkUrl');
  const missing = !row.phoneticUs?.trim() || !row.phoneticUk?.trim() || !row.audioUsUrl?.trim() || !row.audioUkUrl?.trim();
  if (mode === 'fill' && !missing) return {};
  if (mode === 'regenerate' && !row.phoneticUs && !row.phoneticUk && !row.audioUsUrl && !row.audioUkUrl && !us && !uk) return {};
  return data;
}

export function vocabularyMatchesScreen(
  row: {
    meaning?: string | null;
    description?: string | null;
    examples?: unknown;
    definitionEn?: string | null;
    phoneticUs?: string | null;
    phoneticUk?: string | null;
    audioUsUrl?: string | null;
    audioUkUrl?: string | null;
    difficulty?: string | null;
  },
  mode: ScreenMode,
  fields: ScreenField[],
  pronunciations?: unknown,
): boolean {
  return fields.some((field) => {
    if (field === 'meaning') return meaningNeedsWork(row.meaning, mode, 'vocabulary');
    if (field === 'description') return descriptionNeedsWork(row.description, mode, 'vocabulary');
    if (field === 'examples') return examplesNeedWork(row.examples, mode);
    if (field === 'definition') return definitionNeedsWork(row.definitionEn, mode);
    if (field === 'difficulty') return difficultyNeedsWork(row.difficulty, mode);
    return pronunciationNeedsWork(row, pronunciations, mode);
  });
}

export function textMatchesScreen(
  row: { meaning?: string | null; description?: string | null; examples?: unknown },
  mode: ScreenMode,
  fields: ScreenField[],
): boolean {
  return fields.some((field) => {
    if (field === 'meaning') return meaningNeedsWork(row.meaning, mode, 'text');
    if (field === 'description') return descriptionNeedsWork(row.description, mode, 'text');
    if (field === 'examples') return examplesNeedWork(row.examples, mode);
    return false;
  });
}
