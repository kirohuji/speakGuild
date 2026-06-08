import { create } from 'zustand'
import type { TopicDetail } from '@/features/practice/api/english-practice-api'
import { practiceRepository } from '@/lib/offline'

interface PracticeStore {
  topicDetail: TopicDetail | null
  topicDetailLoading: boolean

  fetchTopicDetail: (topicId: string) => Promise<void>
}

export const usePracticeStore = create<PracticeStore>()((set) => ({
  topicDetail: null,
  topicDetailLoading: false,

  async fetchTopicDetail(topicId) {
    set({ topicDetailLoading: true })
    try {
      const data = await practiceRepository.getTopicDetail(topicId)
      set({ topicDetail: data, topicDetailLoading: false })
    } catch {
      set({ topicDetail: null, topicDetailLoading: false })
    }
  },
}))
