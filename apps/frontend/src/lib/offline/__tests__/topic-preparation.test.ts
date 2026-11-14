import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ metadata: { outputTraining: { enabled: true, pipeline: [{ id: 'knowledge', type: 'vocab_drill' }] } } }))
vi.mock('../user-recordings', () => ({ prepareRecordingPayload: async (value: any) => value }))
vi.mock('../unified-storage', () => ({ localDb: {} }))
vi.mock('../learning-pack-read-model', () => ({
  readTopicPrep: async () => ({ topic: { id: 'topic', metadata: {} }, __offlineProjection: true }),
  readTopicPipeline: async () => ({ metadata: state.metadata }), readTopicTeaching: vi.fn(),
}))
vi.mock('@/features/practice/api/english-practice-api', () => ({ practiceApi: {}, practiceAiApi: {} }))
vi.mock('@/features/profile/api', () => ({ getPracticeRecords: vi.fn() }))
import { practiceRepository } from '../practice.repository'
it('returns the knowledge pipeline on the first topic read, before starting any VN practice', async () => {
  const topic = await practiceRepository.getTopicDetail('topic')
  expect(topic?.topic.metadata.outputTraining.pipeline).toEqual([{ id: 'knowledge', type: 'vocab_drill' }])
})
