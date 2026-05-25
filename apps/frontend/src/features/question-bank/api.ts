import { get, post } from '@/lib/request'
import type { BootstrapPayload } from '@/stores/config.store'

export interface ConfigOptions {
  provinces: { label: string; value: string }[]
  languages: { label: string; value: string }[]
  examTypes: { label: string; value: string }[]
  interviewForms: { label: string; value: string }[]
}

export interface BindConfigData {
  province: string
  language: string
  examType: string
  interviewForm: string
}

export interface BindConfigResult {
  bankId: string
  bankName: string
  province: string
  language: string
  examType: string
  interviewForm: string
}

export interface QuestionBankHomeParams {
  mode?: string
  keyword?: string
}

export interface ScenicCard {
  id: string
  topicId: string
  questionId: string
  name: string
  coverImage?: string
  questionCount: number
  masteredCount: number
  masteryRate: number
  isFavorite?: boolean
}

export interface OtherTopic {
  topicId: string
  name: string
  category: string
  questionCount: number
  masteredCount: number
  masteryRate: number
}

export interface QuestionBankHome {
  bankName: string
  totalQuestions: number
  masteredQuestions: number
  practiceDays: number
  lastMockScore?: number
  lastMockDate?: string
  scenicCards: ScenicCard[]
  otherTopics: OtherTopic[]
}

export const getBootstrap = (): Promise<BootstrapPayload> => get('/bootstrap')

export const getConfigOptions = (): Promise<ConfigOptions> => get('/config/options')

export const bindConfig = (data: BindConfigData): Promise<BindConfigResult> =>
  post('/config/bind', data)

export const getCurrentConfig = (): Promise<BindConfigResult> => get('/config/current')

export const getQuestionBankHome = (params?: QuestionBankHomeParams): Promise<QuestionBankHome> =>
  get('/question-bank/home', params)
