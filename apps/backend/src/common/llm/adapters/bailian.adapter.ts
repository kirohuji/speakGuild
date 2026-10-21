import type { ThinkingMode } from '../llm.types';
import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';

/**
 * 阿里云百炼（DashScope OpenAI 兼容）：
 * enable_thinking: boolean
 * @see https://help.aliyun.com/zh/model-studio/deep-thinking
 */
export class BailianAdapter extends OpenAiCompatibleAdapter {
  constructor() {
    super({
      id: 'bailian',
      prefersNativeJsonMode: true,
      defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
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
      enable_thinking: mode === 'enabled',
    };
  }
}
