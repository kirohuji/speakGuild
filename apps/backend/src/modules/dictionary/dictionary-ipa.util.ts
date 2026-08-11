const BROAD_IPA_BODY = /^[\p{Ll}\p{M}\u02b0-\u02ff.()‿ -]+$/u;

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
    // Canonical broad-English symbols used by this dictionary.
    .replace(/ɹ/gu, 'r')
    .replace(/g/gu, 'ɡ')
    .replace(/ɫ/gu, 'l')
    // Affricate tie bars and non-syllabic marks are optional in broad English IPA.
    .replace(/[͜͡]/gu, '')
    .replace(/̯/gu, '')
    // A stress mark already identifies the adjacent syllable boundary.
    .replace(/\.([ˈˌ])/gu, '$1')
    .replace(/([ˈˌ])\./gu, '$1')
    .replace(/\.{2,}/gu, '.')
    .normalize('NFC');

  if (!inner || !BROAD_IPA_BODY.test(inner)) return null;
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
