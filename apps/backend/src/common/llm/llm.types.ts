export type ThinkingMode = 'enabled' | 'disabled';

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface LlmRequestOptions {
  /** 统一语义；各 Adapter 自行映射到厂商字段 */
  thinking?: ThinkingMode;
}

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatRequest {
  config: LlmConfig;
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens: number;
  thinking?: ThinkingMode;
  /** 要求返回可解析的 JSON 对象（OpenAI response_format） */
  jsonObject?: boolean;
}

export interface LlmChatResult {
  text: string;
  finishReason: string;
  reasoningChars: number;
  raw: unknown;
}
