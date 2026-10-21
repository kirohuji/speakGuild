import { Injectable, Logger } from '@nestjs/common';
import { LlmAdapterRegistry } from './llm-adapter.registry';
import type { LlmChatRequest, LlmChatResult, LlmConfig, ThinkingMode } from './llm.types';

/**
 * 统一 chat/completions 客户端。
 * 业务只传统一参数；厂商字段差异由 Adapter 处理。
 */
@Injectable()
export class LlmChatClient {
  private readonly logger = new Logger(LlmChatClient.name);

  constructor(private readonly registry: LlmAdapterRegistry) {}

  adapterFor(config: LlmConfig) {
    return this.registry.resolve(config.provider);
  }

  prefersNativeJsonMode(config: LlmConfig) {
    return this.adapterFor(config).prefersNativeJsonMode;
  }

  async complete(request: LlmChatRequest): Promise<LlmChatResult> {
    const { config } = request;
    if (!config.apiKey) {
      throw new Error(`LLM API key is not configured (provider: ${config.provider})`);
    }

    const adapter = this.adapterFor(config);
    const thinking: ThinkingMode | undefined =
      request.thinking ?? adapter.defaultThinkingMode();
    const url = adapter.chatCompletionsUrl(config.baseUrl);

    const body = adapter.adaptRequestBody(
      {
        model: config.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens,
        ...(request.jsonObject ? { response_format: { type: 'json_object' } } : {}),
      },
      thinking,
    );

    this.logger.debug(
      `chat provider=${adapter.id} model=${config.model} thinking=${thinking ?? 'n/a'} json=${Boolean(request.jsonObject)} maxTokens=${request.maxTokens}`,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) {
      throw new Error(
        payload?.error?.message
        || payload?.message
        || `LLM request failed (${response.status})`,
      );
    }

    const choice = payload?.choices?.[0];
    return {
      text: String(choice?.message?.content ?? '').trim(),
      finishReason: String(choice?.finish_reason ?? 'unknown'),
      reasoningChars: String(choice?.message?.reasoning_content ?? '').length,
      raw: payload,
    };
  }

  /** JSON 任务便捷封装：自动 json_object + 默认关思考 */
  async completeJson(params: {
    config: LlmConfig;
    system?: string;
    prompt: string;
    temperature?: number;
    maxTokens: number;
    thinking?: ThinkingMode;
  }): Promise<LlmChatResult> {
    const messages = [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      { role: 'user' as const, content: params.prompt },
    ];
    return this.complete({
      config: params.config,
      messages,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      thinking: params.thinking ?? 'disabled',
      jsonObject: true,
    });
  }
}
