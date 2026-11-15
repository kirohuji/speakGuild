// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ find: vi.fn(), get: vi.fn(), guided: vi.fn(), route: {} as any }))
vi.mock('react-router-dom', () => ({ useParams: () => state.route }))
vi.mock('@/lib/offline/unified-storage', () => ({ localDb: { findByIndex: state.find, get: state.get } }))
vi.mock('@/lib/offline/insight-content', () => ({ resolveInsightContentId: async () => 'word-id' }))
vi.mock('../guided-warmup-phase', () => ({ GuidedWarmupPhase: (props: any) => {
  state.guided(props)
  return <div>练习题目<button onClick={props.onBack}>返回讲解</button></div>
} }))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))
import { InsightPracticeButton } from '../insight-practice-button'
const point = { kind: 'word' as const, id: 'word-id', word: 'test' }
beforeEach(() => {
  vi.clearAllMocks(); state.route = {}; state.get.mockResolvedValue(null)
  state.find.mockImplementation(async (table, column, value) => {
    if (column === 'unit_id' && value === 'pack-a') return [
      { rowKind: 'pipeline', topicId: 'topic-one', metadata: { outputTraining: { enabled: true, pipeline: [{ id: 'one', type: 'vocab_drill', vocabs: [{ vocabId: 'word-id', promptZh: '题一' }, { vocabId: 'other' }] }] } } },
      { rowKind: 'pipeline', topicId: 'topic-two', metadata: { outputTraining: { pipeline: [{ id: 'two', type: 'vocab_drill', vocabs: [{ vocabId: 'word-id', promptZh: '题二' }] }] } } },
    ]
    return []
  })
})
afterEach(cleanup)
it('does no practice loading on mount and loads only the selected package when clicked', async () => {
  render(<><div>原来的讲解</div><InsightPracticeButton item={point} unitId="pack-a" /></>)
  expect(state.find).not.toHaveBeenCalled(); expect(state.get).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '知识点练习' }))
  await waitFor(() => expect(screen.getByText('练习题目')).toBeTruthy())
  const props = state.guided.mock.calls.at(-1)[0]
  expect(props.warmupItems).toHaveLength(2)
  expect(props.warmupItems[0].vocabs).toHaveLength(1)
  expect(props.warmupItems.map((item: any) => item.__practiceContext.topicId)).toEqual(['topic-one', 'topic-two'])
  expect(props.sessionId).toBe('insight:pack-a:word:word-id')
  expect(state.find).toHaveBeenCalledWith('downloaded_unit_details', 'unit_id', 'pack-a')
  fireEvent.click(screen.getByRole('button', { name: '返回讲解' }))
  await waitFor(() => expect(screen.queryByText('练习题目')).toBeNull())
  expect(screen.getByText('原来的讲解')).toBeTruthy()
})
it('never starts an empty session', async () => {
  state.find.mockResolvedValue([])
  render(<InsightPracticeButton item={point} unitId="empty-pack" />)
  fireEvent.click(screen.getByRole('button', { name: '知识点练习' }))
  await waitFor(() => expect(state.find).toHaveBeenCalled())
  expect(state.guided).not.toHaveBeenCalled()
})
