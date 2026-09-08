/** 标准词性前缀（与词典+AI / 重写 other 允许列表一致） */
export const VOCAB_POS_PREFIX_RE =
  /(^|[/\s])(?:n|v|adj|adv|pron|prep|conj|interj|num|det|art|phr|modal\s*v)\.\s*/i;

export function vocabularyMeaningHasPosPrefix(meaning: string | null | undefined): boolean {
  return VOCAB_POS_PREFIX_RE.test((meaning ?? '').trim());
}

/** 有中文内容，但没有任何 n./v./adj. 等词性前缀（纯中文释义） */
export function vocabularyMeaningMissingPosPrefix(meaning: string | null | undefined): boolean {
  const value = (meaning ?? '').trim();
  if (!value) return false;
  if (!/[\u3400-\u9fff]/.test(value)) return false;
  return !vocabularyMeaningHasPosPrefix(value);
}
