import { get, post, patch, del } from '@/lib/request';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface QuestionBankItem {
  id: string;
  name: string;
  province: string;
  language: string;
  examType: string;
  interviewForm: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { topics: number };
}

export interface QuestionBankDetail extends QuestionBankItem {
  topics: TopicItem[];
}

export interface TopicItem {
  id: string;
  bankId: string;
  code: string;
  name: string;
  sortOrder: number;
  _count: { items: number };
  bank?: { id: string; name: string; province: string };
}

export interface QuestionContentData {
  id: string;
  questionId: string;
  promptEn: string;
  promptZh: string;
  answerEn: string;
  answerZh: string;
  summary: string;
}

export interface QuestionItemData {
  id: string;
  topicId: string;
  title: string;
  difficulty: number;
  suggestedDurationSec: number;
  keywords: string[];
  focusWords: string[];
  masteryScore: number;
  createdAt: string;
  updatedAt: string;
  topic: {
    id: string;
    code: string;
    name: string;
    bank?: { id: string; name: string; province: string };
  };
  content: QuestionContentData | null;
}

export interface QuestionListItem {
  id: string;
  topicId: string;
  title: string;
  difficulty: number;
  suggestedDurationSec: number;
  keywords: string[];
  focusWords: string[];
  createdAt: string;
  updatedAt: string;
  topic: {
    id: string;
    code: string;
    name: string;
  };
  content: {
    summary: string;
  } | null;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ═══════════════════════════════════════════════════════════
// DTOs
// ═══════════════════════════════════════════════════════════

export interface CreateBankPayload {
  name: string;
  province: string;
  language: string;
  examType: string;
  interviewForm: string;
  status?: string;
}

export interface UpdateBankPayload {
  name?: string;
  province?: string;
  language?: string;
  examType?: string;
  interviewForm?: string;
  status?: string;
}

export interface CreateTopicPayload {
  bankId: string;
  code: string;
  name: string;
  sortOrder?: number;
}

export interface UpdateTopicPayload {
  code?: string;
  name?: string;
  sortOrder?: number;
}

export interface CreateQuestionPayload {
  topicId: string;
  title: string;
  difficulty?: number;
  suggestedDurationSec?: number;
  keywords?: string[];
  focusWords?: string[];
  promptEn?: string;
  promptZh?: string;
  answerEn?: string;
  answerZh?: string;
  summary?: string;
}

export interface UpdateQuestionPayload {
  title?: string;
  difficulty?: number;
  suggestedDurationSec?: number;
  keywords?: string[];
  focusWords?: string[];
  promptEn?: string;
  promptZh?: string;
  answerEn?: string;
  answerZh?: string;
  summary?: string;
}

export interface QuestionQueryParams {
  bankId?: string;
  topicId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

// ═══════════════════════════════════════════════════════════
// API Methods — Banks
// ═══════════════════════════════════════════════════════════

const BASE = '/admin/question-bank';

export async function getBanks() {
  return get<QuestionBankItem[]>(`${BASE}/banks`);
}

export async function getBank(id: string) {
  return get<QuestionBankDetail>(`${BASE}/banks/${id}`);
}

export async function createBank(data: CreateBankPayload) {
  return post<QuestionBankItem>(`${BASE}/banks`, data);
}

export async function updateBank(id: string, data: UpdateBankPayload) {
  return patch<QuestionBankItem>(`${BASE}/banks/${id}`, data);
}

export async function deleteBank(id: string) {
  return del(`${BASE}/banks/${id}`);
}

export async function getProvinces() {
  return get<string[]>(`${BASE}/provinces`);
}

// ═══════════════════════════════════════════════════════════
// API Methods — Topics
// ═══════════════════════════════════════════════════════════

export async function getTopics(bankId: string) {
  return get<TopicItem[]>(`${BASE}/topics`, { bankId });
}

export async function createTopic(data: CreateTopicPayload) {
  return post<TopicItem>(`${BASE}/topics`, data);
}

export async function updateTopic(id: string, data: UpdateTopicPayload) {
  return patch<TopicItem>(`${BASE}/topics/${id}`, data);
}

export async function deleteTopic(id: string) {
  return del(`${BASE}/topics/${id}`);
}

// ═══════════════════════════════════════════════════════════
// API Methods — Questions
// ═══════════════════════════════════════════════════════════

export async function getQuestions(params?: QuestionQueryParams) {
  return get<PaginatedResult<QuestionListItem>>(`${BASE}/items`, params);
}

export async function getQuestion(id: string) {
  return get<QuestionItemData>(`${BASE}/items/${id}`);
}

export async function createQuestion(data: CreateQuestionPayload) {
  return post<QuestionItemData>(`${BASE}/items`, data);
}

export async function updateQuestion(id: string, data: UpdateQuestionPayload) {
  return patch<QuestionItemData>(`${BASE}/items/${id}`, data);
}

export async function deleteQuestion(id: string) {
  return del(`${BASE}/items/${id}`);
}
