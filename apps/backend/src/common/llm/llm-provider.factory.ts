import { Injectable, Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

/**
 * LLM Provider Factory
 *
 * 统一管理大语言模型供应商，通过配置动态切换。
 * 当前支持：deepseek, openai（以及兼容 OpenAI API 的供应商）。
 *
 * 使用方式：
 *   const model = llmFactory.create(config);
 *   const result = await generateText({ model, prompt: '...' });
 */
@Injectable()
export class LlmProviderFactory {
  private readonly logger = new Logger(LlmProviderFactory.name);

  /**
   * 根据配置创建 AI SDK LanguageModel 实例。
   */
  create(config: LlmConfig): LanguageModel {
    const { apiKey, model, baseUrl } = config;

    if (!apiKey) {
      throw new Error(`[LlmFactory] LLM API key not configured (provider: ${config.provider})`);
    }

    this.logger.log(`Creating LLM provider: ${config.provider} model=${model} baseUrl=${baseUrl}`);

    const client = createOpenAI({
      apiKey,
      baseURL: baseUrl || undefined,
    });

    return client(model);
  }
}
