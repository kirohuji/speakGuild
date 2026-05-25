import { get, post, del } from '@/lib/request'

export interface FavoriteItem {
  questionId: string
  topicId: string
  topicName: string
  questionText: string
  createdAt: string
}

export interface FavoritesResult {
  list: FavoriteItem[]
  total: number
  page: number
  pageSize: number
}

export interface WordItem {
  term: string
  definition?: string
  createdAt: string
}

export interface WordsResult {
  list: WordItem[]
  total: number
  page: number
  pageSize: number
}

export const getFavorites = (params?: { page?: number; pageSize?: number }): Promise<FavoritesResult> =>
  get<any>('/assets/favorites', params).then((res) => ({
    ...res,
    list: (res.list || []).map((item: any) => ({
      questionId: item.questionId,
      topicId: item.question?.topic?.id || '',
      topicName: item.question?.topic?.name || '未知专题',
      questionText: item.question?.title || '未知题目',
      createdAt: item.createdAt,
    })),
  }))

export const addFavorite = (questionId: string): Promise<void> =>
  post(`/assets/favorites/${questionId}`)

export const removeFavorite = (questionId: string): Promise<void> =>
  del(`/assets/favorites/${questionId}`)

export const getWords = (params?: { page?: number; pageSize?: number }): Promise<WordsResult> =>
  get('/assets/words', params)

export const addWord = (term: string, definition?: string): Promise<void> =>
  post('/assets/words', { term, definition })

export const removeWord = (term: string): Promise<void> =>
  del(`/assets/words/${encodeURIComponent(term)}`)
