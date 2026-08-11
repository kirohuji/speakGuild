const BROAD_IPA_BODY = /^[\p{Ll}\p{M}\u02b0-\u02ff.()‿ -]+$/u;

/**
 * Accept broad IPA from heterogeneous dictionary providers and return the
 * canonical representation stored by the dictionary module.
 */
export function normalizeBroadIpa(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('[') || trimmed.endsWith(']') || /[\[\]]/.test(trimmed)) return null;

  const inner = trimmed
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\s+/g, ' ')
    // A stress mark already identifies the following syllable boundary.
    .replace(/([ˈˌ])\./gu, '$1');

  if (!inner || !BROAD_IPA_BODY.test(inner)) return null;
  return `/${inner}/`;
}

export function isStandardBroadIpa(value?: string): boolean {
  if (!value || !value.startsWith('/') || !value.endsWith('/')) return false;
  return normalizeBroadIpa(value) !== null;
}
