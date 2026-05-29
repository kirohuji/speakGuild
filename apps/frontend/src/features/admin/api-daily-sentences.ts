import { get, post, put, del } from '@/lib/request';

export interface DailySentence {
  id: string;
  date: string;
  quote: string;
  translation: string;
  author: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDailySentenceInput {
  date: string;
  quote: string;
  translation: string;
  author?: string;
  sortOrder?: number;
}

export type UpdateDailySentenceInput = Partial<CreateDailySentenceInput>;

/** 获取所有每日句子（管理端） */
export async function getAllDailySentences(): Promise<DailySentence[]> {
  return get('/admin/daily-sentences');
}

/** 获取单个句子 */
export async function getDailySentence(id: string): Promise<DailySentence> {
  return get(`/admin/daily-sentences/${id}`);
}

/** 创建句子 */
export async function createDailySentence(data: CreateDailySentenceInput): Promise<DailySentence> {
  return post('/admin/daily-sentences', data);
}

/** 更新句子 */
export async function updateDailySentence(id: string, data: UpdateDailySentenceInput): Promise<DailySentence> {
  return put(`/admin/daily-sentences/${id}`, data);
}

/** 删除句子 */
export async function deleteDailySentence(id: string): Promise<void> {
  return del(`/admin/daily-sentences/${id}`);
}
