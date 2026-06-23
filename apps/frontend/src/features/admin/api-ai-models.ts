import { del, get, post, put } from '@/lib/request';

export interface AiProviderItem {
  id: string;
  type: 'stt' | 'tts' | 'llm';
  provider: string;
  label: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  config?: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
}

export interface UpdateAiProviderDto {
  label?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export interface CreateAiProviderDto {
  type?: 'stt' | 'tts' | 'llm';
  provider: string;
  label: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  config?: Record<string, unknown>;
}

/** 获取按类型分组的所有供应商 */
export async function listAiProviders(): Promise<Record<string, AiProviderItem[]>> {
  return get('/admin/ai-models');
}

/** 更新供应商配置 */
export async function updateAiProvider(id: string, dto: UpdateAiProviderDto): Promise<AiProviderItem> {
  return put(`/admin/ai-models/${id}`, dto);
}

export async function createAiProvider(dto: CreateAiProviderDto): Promise<AiProviderItem> {
  return post('/admin/ai-models', dto);
}

export async function deleteAiProvider(id: string): Promise<{ success: true }> {
  return del(`/admin/ai-models/${id}`);
}

/** 激活某个供应商 */
export async function activateAiProvider(id: string): Promise<AiProviderItem> {
  return put(`/admin/ai-models/${id}/activate`, {});
}

export interface AiWordTimestamp {
  text: string;
  start_time: number;
  end_time?: number;
}

export interface SttTestResult {
  audioBase64: string;
  mimeType: string;
  text: string | null;
  wordTimestamps: AiWordTimestamp[] | null;
  audioUrl: string | null;
}

export interface TtsTestResult {
  mimeType: string;
  audioBase64: string;
  wordTimestamps: AiWordTimestamp[] | null;
}

export interface LlmTestResult {
  text: string;
  elapsedMs: number;
  provider: string;
  model: string;
  usage?: unknown;
}

export async function testSttProvider(
  item: AiProviderItem,
  file: File,
  options: { language?: string; temperature?: number; enableTimestamps?: boolean },
): Promise<SttTestResult> {
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('provider', item.provider);
  if (item.provider === 'whisper' && item.baseUrl) formData.append('inferenceUrl', item.baseUrl);
  const timeoutMs = (item.config as Record<string, unknown> | undefined)?.timeoutMs;
  if (item.provider === 'whisper' && typeof timeoutMs === 'number') formData.append('timeoutMs', String(timeoutMs));
  if (item.provider === 'tencent') {
    if (item.baseUrl) formData.append('tencentSecretId', item.baseUrl);
    if (item.apiKey) formData.append('tencentSecretKey', item.apiKey);
    const region = (item.config as Record<string, unknown> | undefined)?.region;
    if (typeof region === 'string' && region) formData.append('tencentRegion', region);
  }
  if (options.language) formData.append('language', options.language);
  if (options.temperature !== undefined) formData.append('temperature', String(options.temperature));
  if (options.enableTimestamps !== undefined) formData.append('enableTimestamps', String(options.enableTimestamps));
  return post('/tts/transcribe-recording', formData, {
    timeout: 300000,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function testTtsProvider(
  item: AiProviderItem,
  payload: { text: string; voiceId?: string; params?: Record<string, unknown> },
): Promise<TtsTestResult> {
  return post('/tts/synthesize-text', {
    text: payload.text,
    provider: item.provider,
    model: item.model,
    voiceId: payload.voiceId || undefined,
    params: payload.params,
    apiKey: item.apiKey || undefined,
    baseUrl: item.provider === 'minimax' ? undefined : item.baseUrl || undefined,
    groupId: typeof item.config?.groupId === 'string' ? item.config.groupId : undefined,
  }, { timeout: 300000 });
}

export async function testLlmProvider(id: string, prompt: string): Promise<LlmTestResult> {
  return post(`/admin/ai-models/${id}/test-llm`, { prompt }, { timeout: 120000 });
}
