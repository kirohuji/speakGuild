import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { LlmConfig, LlmRequestOptions, ThinkingMode } from '../llm.types';
import {
  joinChatCompletionsUrl,
  type LlmVendorAdapter,
} from './llm-vendor.adapter';

/**
 * 通用 OpenAI 兼容适配器：无额外思考字段。
 * DeepSeek / 百炼继承此类，只覆盖协议差异。
 */
export class OpenAiCompatibleAdapter implements LlmVendorAdapter {
  readonly id: string;
  readonly prefersNativeJsonMode: boolean;
  protected readonly defaultBaseUrl: string;

  constructor(options: {
    id: string;
    prefersNativeJsonMode?: boolean;
    defaultBaseUrl?: string;
  }) {
    this.id = options.id;
    this.prefersNativeJsonMode = options.prefersNativeJsonMode ?? false;
    this.defaultBaseUrl = options.defaultBaseUrl ?? 'https://api.openai.com/v1';
  }

  defaultThinkingMode(): ThinkingMode | undefined {
    return undefined;
  }

  chatCompletionsUrl(baseUrl: string) {
    return joinChatCompletionsUrl(baseUrl, this.defaultBaseUrl);
  }

  adaptRequestBody(
    body: Record<string, unknown>,
    _thinking?: ThinkingMode,
  ): Record<string, unknown> {
    return body;
  }

  createLanguageModel(config: LlmConfig, options?: LlmRequestOptions): LanguageModel {
    const thinking = options?.thinking ?? this.defaultThinkingMode();
    const client = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
      name: this.id,
      fetch: thinking
        ? async (input, init) => {
            if (typeof init?.body !== 'string') return fetch(input, init);
            try {
              const body = JSON.parse(init.body) as Record<string, unknown>;
              return fetch(input, {
                ...init,
                body: JSON.stringify(this.adaptRequestBody(body, thinking)),
              });
            } catch {
              return fetch(input, init);
            }
          }
        : undefined,
    });

    // 非官方 OpenAI 端点统一走 chat completions 路径，兼容更多网关
    if (this.id !== 'openai') {
      return client.chat(config.model as any);
    }
    return client(config.model);
  }
}
