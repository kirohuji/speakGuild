import type { ThinkingMode } from '../llm.types';
import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';

/** DeepSeek：thinking: { type: 'enabled' | 'disabled' } */
export class DeepSeekAdapter extends OpenAiCompatibleAdapter {
  constructor() {
    super({
      id: 'deepseek',
      prefersNativeJsonMode: true,
      defaultBaseUrl: 'https://api.deepseek.com',
    });
  }

  override defaultThinkingMode(): ThinkingMode {
    return 'disabled';
  }

  override adaptRequestBody(
    body: Record<string, unknown>,
    thinking?: ThinkingMode,
  ): Record<string, unknown> {
    const mode = thinking ?? this.defaultThinkingMode();
    return {
      ...body,
      thinking: { type: mode },
    };
  }
}
