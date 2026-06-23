import { get, put } from '@/lib/request';

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
  config?: string;
  isActive?: boolean;
}

/** 获取按类型分组的所有供应商 */
export async function listAiProviders(): Promise<Record<string, AiProviderItem[]>> {
  return get('/admin/ai-models');
}

/** 更新供应商配置 */
export async function updateAiProvider(id: string, dto: UpdateAiProviderDto): Promise<AiProviderItem> {
  return put(`/admin/ai-models/${id}`, dto);
}

/** 激活某个供应商 */
export async function activateAiProvider(id: string): Promise<AiProviderItem> {
  return put(`/admin/ai-models/${id}/activate`, {});
}
