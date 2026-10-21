import { Injectable, Logger } from '@nestjs/common';
import type { LanguageModel } from 'ai';
import { LlmAdapterRegistry } from './llm-adapter.registry';
import type { LlmConfig, LlmRequestOptions } from './llm.types';

export type { LlmConfig, LlmRequestOptions } from './llm.types';

/**
 * 对外工厂：业务通过 create(config) 拿到 AI SDK LanguageModel。
 * 协议差异全部委托给 LlmVendorAdapter。
 */
@Injectable()
export class LlmProviderFactory {
  private readonly logger = new Logger(LlmProviderFactory.name);

  constructor(private readonly registry: LlmAdapterRegistry) {}

  create(config: LlmConfig, options?: LlmRequestOptions): LanguageModel {
    if (!config.apiKey) {
      throw new Error(`[LlmFactory] LLM API key not configured (provider: ${config.provider})`);
    }

    const adapter = this.registry.resolve(config.provider);
    const thinking = options?.thinking ?? adapter.defaultThinkingMode();
    this.logger.log(
      `Creating LLM provider: ${adapter.id} model=${config.model} baseUrl=${config.baseUrl}`
      + (thinking ? ` thinking=${thinking}` : ''),
    );

    return adapter.createLanguageModel(config, {
      ...options,
      thinking,
    });
  }

  adapterFor(provider?: string | null) {
    return this.registry.resolve(provider);
  }
}
