import { Injectable } from '@nestjs/common';
import type { CleanedPronunciation } from './dictionary.types';

const WIKTIONARY_API = 'https://en.wiktionary.org/w/api.php';
const DATAMUSE_API = 'https://api.datamuse.com/words';

type Accent = 'uk' | 'us';

export interface WiktionaryPronunciationEvidence {
  pronunciations: CleanedPronunciation[];
  ambiguousIpas: string[];
  audioUrls: Partial<Record<Accent, string>>;
}

@Injectable()
export class DictionaryPronunciationProviderService {
  async fetchWiktionary(word: string): Promise<CleanedPronunciation[]> {
    const evidence = await this.fetchWiktionaryEvidence(word);
    return evidence.pronunciations;
  }

  async fetchWiktionaryEvidence(word: string): Promise<WiktionaryPronunciationEvidence> {
    const url = new URL(WIKTIONARY_API);
    url.search = new URLSearchParams({
      action: 'parse',
      page: word.toLowerCase().trim(),
      prop: 'wikitext',
      redirects: '1',
      format: 'json',
      formatversion: '2',
      origin: '*',
    }).toString();

    const response = await fetch(url);
    if (response.status === 404) return this.emptyWiktionaryEvidence();
    if (!response.ok) throw new Error(`Wiktionary Action API returned ${response.status}`);

    const payload = await response.json() as {
      error?: { code?: string };
      parse?: { wikitext?: string };
    };
    if (payload.error?.code === 'missingtitle' || !payload.parse?.wikitext) {
      return this.emptyWiktionaryEvidence();
    }

    return this.parseWiktionaryWikitext(payload.parse.wikitext);
  }

  async fetchDatamuse(word: string): Promise<CleanedPronunciation[]> {
    const key = word.toLowerCase().trim();
    const url = new URL(DATAMUSE_API);
    url.search = new URLSearchParams({ sp: key, qe: 'sp', md: 'r', ipa: '1', max: '10' }).toString();

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Datamuse returned ${response.status}`);
    const entries = await response.json() as Array<{ word?: string; tags?: string[] }>;
    const exact = entries.find((entry) => entry.word?.toLowerCase() === key);
    const rawIpa = exact?.tags?.find((tag) => tag.startsWith('ipa_pron:'))?.slice('ipa_pron:'.length);
    const ipa = this.normalizeBroadIpa(rawIpa ?? '');
    if (!ipa) return [];

    return [{
      type: 'us',
      ipa,
      isPreferred: true,
      notation: 'IPA',
      source: 'Datamuse / CMUdict',
      needsReview: true,
    }];
  }

  private parseWiktionaryWikitext(wikitext: string): WiktionaryPronunciationEvidence {
    const english = this.extractEnglishSection(wikitext);
    if (!english) return this.emptyWiktionaryEvidence();

    const collected: CleanedPronunciation[] = [];
    const ambiguousIpas = new Set<string>();
    const ipaTemplates = english.matchAll(/\{\{IPA\|en\|([\s\S]*?)\}\}/gi);
    for (const match of ipaTemplates) {
      const args = match[1].split('|').map((part) => part.trim()).filter(Boolean);
      const namedAccents = new Map<number, string>();
      let globalAccent = '';

      for (const arg of args) {
        const named = arg.match(/^a(\d*)=(.+)$/i);
        if (!named) continue;
        if (named[1]) namedAccents.set(Number(named[1]), named[2]);
        else globalAccent = named[2];
      }

      let pronunciationIndex = 0;
      for (const arg of args) {
        if (/^[a-z][a-z\d_]*=/i.test(arg)) continue;
        pronunciationIndex += 1;
        const inlineAccent = arg.match(/<a:([^>]+)>/i)?.[1];
        const types = this.detectAccents(inlineAccent ?? namedAccents.get(pronunciationIndex) ?? globalAccent);
        const ipa = this.normalizeBroadIpa(arg.replace(/<[^>]+>/g, ''));
        if (!ipa) continue;
        if (types.length === 0) {
          ambiguousIpas.add(ipa);
          continue;
        }
        for (const type of types) {
          collected.push({
            type,
            ipa,
            isPreferred: false,
            notation: 'IPA',
            source: 'Wiktionary Action API',
          });
        }
      }
    }

    const audioByAccent = new Map<Accent, string>();
    const audioTemplates = english.matchAll(/\{\{audio\|en\|([^|}]+)\|([\s\S]*?)\}\}/gi);
    for (const match of audioTemplates) {
      const fileName = match[1].trim();
      const args = match[2].split('|').map((part) => part.trim());
      const accentText = args.find((arg) => /^a=/i.test(arg))?.replace(/^a=/i, '')
        ?? args.join(' ');
      const type = this.detectAccent(accentText);
      if (!type || audioByAccent.has(type) || !fileName) continue;
      audioByAccent.set(type, this.commonsAudioUrl(fileName));
    }

    const result: CleanedPronunciation[] = [];
    for (const type of ['uk', 'us'] as const) {
      const variants = collected.filter((item) => item.type === type);
      if (variants.length === 0) continue;
      const preferred = variants[0];
      preferred.isPreferred = true;
      preferred.audioUrl = audioByAccent.get(type);
      result.push(preferred);
      for (const variant of variants.slice(1)) {
        if (!result.some((item) => item.type === type && item.ipa === variant.ipa)) result.push(variant);
      }
    }
    return {
      pronunciations: result,
      ambiguousIpas: [...ambiguousIpas],
      audioUrls: Object.fromEntries(audioByAccent) as Partial<Record<Accent, string>>,
    };
  }

  private emptyWiktionaryEvidence(): WiktionaryPronunciationEvidence {
    return { pronunciations: [], ambiguousIpas: [], audioUrls: {} };
  }

  private extractEnglishSection(wikitext: string): string | null {
    const heading = /^==English==\s*$/m.exec(wikitext);
    if (!heading) return null;
    const remainder = wikitext.slice(heading.index + heading[0].length);
    const nextLanguage = /^==[^=\n]+==\s*$/m.exec(remainder);
    return nextLanguage ? remainder.slice(0, nextLanguage.index) : remainder;
  }

  private detectAccent(value: string): Accent | null {
    return this.detectAccents(value)[0] ?? null;
  }

  private detectAccents(value: string): Accent[] {
    const accents = value
      .replace(/\[\[|\]\]/g, '')
      .split(/[,;]/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const result: Accent[] = [];
    if (accents.some((accent) => [
      'rp',
      'received pronunciation',
      'standard british',
      'standard southern british',
      'ssb',
      'uk',
    ].includes(accent))) result.push('uk');
    if (accents.some((accent) => ['ga', 'general american', 'us'].includes(accent))) result.push('us');
    return result;
  }

  private normalizeBroadIpa(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('[') || trimmed.endsWith(']') || /[\[\]]/.test(trimmed)) return null;
    const inner = trimmed.replace(/^\//, '').replace(/\/$/, '').replace(/\s+/g, ' ');
    if (!inner || !/^[\p{Ll}\p{M}\u02b0-\u02ff.()‿ -]+$/u.test(inner)) return null;
    return `/${inner}/`;
  }

  private commonsAudioUrl(fileName: string): string {
    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileName.replace(/ /g, '_'))}`;
  }
}
