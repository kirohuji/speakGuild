import { get, post } from '@/lib/request'

export interface Question {
  questionId: string
  topicId: string
  orderIndex: number
  questionText: string
  questionLang: string
  referenceAnswer?: string
  translation?: string
  keywords?: string[]
  vocabulary?: { word: string; meaning: string; phonetic?: string }[]
  difficulty?: string
  tags?: string[]
}

export interface TopicQuestionsResult {
  topicId: string
  topicName: string
  questions: Question[]
  total: number
}

export interface RecordActionData {
  questionId: string
  actionType: 'play' | 'answer_shown' | 'translation_shown' | 'favorite' | 'next' | 'prev'
  payload?: any
}

export interface DictionaryEntry {
  term: string
  phonetic?: string
  meanings: { partOfSpeech: string; definitions: string[] }[]
}

export const getTopicQuestions = (topicId: string): Promise<TopicQuestionsResult> =>
  get(`/practice/topic/${topicId}/questions`)

export const getQuestion = (questionId: string): Promise<Question> =>
  get(`/practice/question/${questionId}`)

export const recordAction = (data: RecordActionData): Promise<void> =>
  post('/practice/action', data)

export const lookupWord = (term: string): Promise<DictionaryEntry> =>
  get('/dictionary/lookup', { term })
