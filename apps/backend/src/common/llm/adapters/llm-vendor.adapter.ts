import type { LanguageModel } from 'ai';
import type { LlmConfig, LlmRequestOptions, ThinkingMode } from '../llm.types';

/**
 * 厂商适配器：把统一请求语义映射到各家协议差异。
 * 业务代码只依赖此接口，不写 provider === 'xxx' 分支。
 */
export interface LlmVendorAdapter {
  /** 供应商标识，如 deepseek / bailian / openai */
  readonly id: string;

  /**
   * 长 JSON / 结构化输出是否优先走原生 chat/completions。
   * hybrid 思考模型在 SDK 路径下容易把预算耗在 reasoning 上。
   */
  readonly prefersNativeJsonMode: boolean;

  /** 未显式指定 thinking 时的默认值 */
  defaultThinkingMode(): ThinkingMode | undefined;

  chatCompletionsUrl(baseUrl: string): string;

  /** 将统一 body + thinking 语义改写为厂商实际字段 */
  adaptRequestBody(
    body: Record<string, unknown>,
    thinking?: ThinkingMode,
  ): Record<string, unknown>;

  /** 创建 Vercel AI SDK LanguageModel（含 fetch 拦截注入厂商参数） */
  createLanguageModel(config: LlmConfig, options?: LlmRequestOptions): LanguageModel;
}

export function normalizeProviderId(provider?: string | null) {
  return (provider || '').trim().toLowerCase();
}

export function joinChatCompletionsUrl(baseUrl: string, fallback: string) {
  const normalized = (baseUrl || fallback).replace(/\/+$/, '');
  return normalized.endsWith('/chat/completions')
    ? normalized
    : `${normalized}/chat/completions`;
}
