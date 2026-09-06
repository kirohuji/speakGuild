// This is intentionally narrower than "any Unicode IPA-looking character".
// We store learner-facing broad English IPA, not narrow transcriptions or
// pronunciations copied from another language.
const BROAD_ENGLISH_IPA_BODY = /^[pbtdkɡfvθðszʃʒhmnŋlrjwɪieɛæɑɒɔʊuʌɜəaoːˈˌ.() ‿-]+$/u;

/**
 * Accept broad IPA from heterogeneous dictionary providers and return the
 * canonical representation stored by the dictionary module.
 */
export function normalizeBroadIpa(value: string): string | null {
  const trimmed = value.trim().normalize('NFC');
  if (!trimmed || trimmed.startsWith('[') || trimmed.endsWith(']') || /[\[\]]/.test(trimmed)) return null;

  const inner = trimmed
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\s+/g, ' ')
    // Equivalent typography used by heterogeneous dictionary providers.
    .replace(/[·‧]/gu, '.')
    .replace(/'/gu, 'ˈ')
    .replace(/:/gu, 'ː')
    // Narrow/provider-specific consonants reduced to broad English spelling.
    .replace(/t̬/gu, 't')
    .replace(/[ʈɾ]/gu, 't')
    .replace(/ɵ/gu, 'ə')
    // Oxford/Cambridge learner notation uses e for the DRESS vowel. This also
    // canonicalizes AIR spellings ɛə -> eə and ɛr -> er.
    .replace(/ɛ/gu, 'e')
    // Canonical broad-English symbols used by this dictionary.
    .replace(/ɹ/gu, 'r')
    .replace(/g/gu, 'ɡ')
    .replace(/ɫ/gu, 'l')
    // Keep the learner-facing transcription simple and consistent.
    .replace(/n̩/gu, 'ən')
    .replace(/l̩/gu, 'əl')
    .replace(/m̩/gu, 'əm')
    .replace(/[rɹ]̩/gu, 'ər')
    .replace(/ɝ/gu, 'ɜːr')
    .replace(/ɚ/gu, 'ər')
    // Affricate tie bars and non-syllabic marks are optional in broad English IPA.
    .replace(/[͜͡]/gu, '')
    .replace(/̯/gu, '')
    // Stress marks already identify a syllable boundary. Keep meaningful
    // unstressed boundaries, but remove duplicate punctuation around stress.
    .replace(/\.([ˈˌ])/gu, '$1')
    .replace(/([ˈˌ])\./gu, '$1')
    .replace(/\.{2,}/gu, '.')
    .replace(/^\.|\.$/gu, '')
    .normalize('NFC');

  if (!inner || !BROAD_ENGLISH_IPA_BODY.test(inner)) return null;
  return `/${inner}/`;
}

export function isStandardBroadIpa(value?: string): boolean {
  if (!value || !value.startsWith('/') || !value.endsWith('/')) return false;
  return normalizeBroadIpa(value) !== null;
}

export function isCanonicalBroadIpa(value?: string): boolean {
  if (!value) return false;
  return normalizeBroadIpa(value) === value;
}
