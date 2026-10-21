import { Injectable } from '@nestjs/common';
import { BailianAdapter } from './adapters/bailian.adapter';
import { DeepSeekAdapter } from './adapters/deepseek.adapter';
import {
  normalizeProviderId,
  type LlmVendorAdapter,
} from './adapters/llm-vendor.adapter';
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible.adapter';

/**
 * 按 provider 名称解析适配器。
 * 未知供应商回退到通用 OpenAI 兼容实现，便于后台「自定义 LLM」扩展。
 */
@Injectable()
export class LlmAdapterRegistry {
  private readonly adapters = new Map<string, LlmVendorAdapter>();
  private readonly fallback = new OpenAiCompatibleAdapter({ id: 'openai-compatible' });

  constructor() {
    this.register(new DeepSeekAdapter());
    this.register(new BailianAdapter());
    this.register(new OpenAiCompatibleAdapter({
      id: 'openai',
      defaultBaseUrl: 'https://api.openai.com/v1',
    }));
  }

  register(adapter: LlmVendorAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  resolve(provider?: string | null): LlmVendorAdapter {
    const id = normalizeProviderId(provider);
    if (!id) return this.fallback;
    return this.adapters.get(id) ?? new OpenAiCompatibleAdapter({ id });
  }
}
