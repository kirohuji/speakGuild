/** DeepSeek 官方价格，核对日期 2026-11-05。https://api-docs.deepseek.com/zh-cn/quick_start/pricing */

export const DEEPSEEK_PRICING_CHECKED_AT = '2026-11-05';
export const DEEPSEEK_PRICING_SOURCE = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing';

export interface DeepSeekTokenRates {
  /** 缓存未命中输入，元 / 百万 token */
  input: number;
  /** 输出，元 / 百万 token */
  output: number;
}

export interface DeepSeekPrice {
  tier: 'flash' | 'pro';
  billedAs: string;
  version: string;
  /** 当前模型名不是官方现用名，请求仍按 billedAs 计费 */
  legacy: boolean;
  offPeak: DeepSeekTokenRates;
  peak: DeepSeekTokenRates;
  /** 缓存命中输入，元 / 百万 token */
  cacheHit: { offPeak: number; peak: number };
}

const FLASH: Omit<DeepSeekPrice, 'legacy'> = {
  tier: 'flash',
  billedAs: 'deepseek-flash',
  version: 'DeepSeek-V4.1-Flash-1017',
  offPeak: { input: 1, output: 4 },
  peak: { input: 2, output: 8 },
  cacheHit: { offPeak: 0.02, peak: 0.04 },
};

const PRO: Omit<DeepSeekPrice, 'legacy'> = {
  tier: 'pro',
  billedAs: 'deepseek-v4-pro',
  version: 'DeepSeek-V4-Pro-0813',
  offPeak: { input: 4.5, output: 13.5 },
  peak: { input: 9, output: 27 },
  cacheHit: { offPeak: 0.15, peak: 0.3 },
};

const FLASH_MODELS = new Set([
  'deepseek-flash',
  'deepseek-v4-flash',
  'deepseek-v4-flash-vision-exp',
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-v4',
]);

export function resolveDeepSeekPrice(model: string | null | undefined): DeepSeekPrice | null {
  const name = (model || '').trim().toLowerCase();
  if (name === 'deepseek-v4-pro') return { ...PRO, legacy: false };
  if (FLASH_MODELS.has(name)) return { ...FLASH, legacy: name !== 'deepseek-flash' };
  return null;
}

/** 北京时间周一至周五 9:00–12:00、14:00–18:00 为高峰。未扣除法定节假日。 */
export function isDeepSeekPeakHour(at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  if (!weekday || weekday === 'Sat' || weekday === 'Sun' || Number.isNaN(hour)) return false;
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
}

export function estimateDeepSeekCost(
  usage: { promptTokens?: number; completionTokens?: number },
  model: string | null | undefined,
  at?: string | null,
) {
  const price = resolveDeepSeekPrice(model);
  if (!price) return null;
  const peak = isDeepSeekPeakHour(new Date(at || Date.now()));
  const rate = peak ? price.peak : price.offPeak;
  const input = usage.promptTokens ?? 0;
  const output = usage.completionTokens ?? 0;
  return {
    peak,
    price,
    rate,
    cost: (input / 1e6) * rate.input + (output / 1e6) * rate.output,
  };
}

export function deepseekPriceSummary(model: string | null | undefined) {
  const price = resolveDeepSeekPrice(model);
  if (!price) return '';
  const tier = price.tier === 'flash' ? 'Flash' : 'Pro';
  return `${tier} · 缓存未命中 空闲 ¥${price.offPeak.input}/¥${price.offPeak.output} · 高峰 ¥${price.peak.input}/¥${price.peak.output}`;
}

/** 写入 ai_provider.config.pricing，供大模型配置页展示与核对 */
export function deepseekPricingConfig(model: string) {
  const price = resolveDeepSeekPrice(model);
  if (!price) return null;
  const legacyNote = price.legacy
    ? `当前模型名 ${model} 是旧名，请求由 ${price.version} 提供，按 ${price.billedAs} 价格计费。`
    : `当前模型 ${model}（${price.version}）。`;
  return {
    source: DEEPSEEK_PRICING_SOURCE,
    checkedAt: DEEPSEEK_PRICING_CHECKED_AT,
    model,
    billedAs: price.billedAs,
    version: price.version,
    currency: 'CNY',
    unit: '每百万 token',
    peakHours: '北京时间周一至周五 9:00-12:00、14:00-18:00（不含法定节假日）；其余时间为空闲，价格为高峰的一半',
    cacheHitInput: price.cacheHit,
    cacheMissInput: { offPeak: price.offPeak.input, peak: price.peak.input },
    output: { offPeak: price.offPeak.output, peak: price.peak.output },
    estimateBasis: '任务中心只记录输入/输出 token，未区分缓存命中，费用按缓存未命中估算；实际账单在命中缓存时更低',
    note: `${legacyNote}每百万 token：缓存命中输入 空闲 ${price.cacheHit.offPeak} 元 / 高峰 ${price.cacheHit.peak} 元；缓存未命中输入 空闲 ${price.offPeak.input} 元 / 高峰 ${price.peak.input} 元；输出 空闲 ${price.offPeak.output} 元 / 高峰 ${price.peak.output} 元。`,
  };
}
