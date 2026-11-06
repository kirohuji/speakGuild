import { describe, expect, it, vi } from 'vitest'

vi.mock('../unified-storage', () => ({ localDb: {} }))
vi.mock('../learning-content.repository', () => ({ learningContentRepository: {} }))

import { buildPackReadModel, topicPipelineId, topicTeachingId, unitSummaryId } from '../learning-pack-read-model'
import { buildWarmupPracticeItemIds } from '../warmup-practice-item-id'

describe('buildPackReadModel', () => {
  it('stores teaching markdown and the exercise pipeline in separate rows', () => {
    const pipeline = [{ id: 'drill-1', type: 'pattern_drill', items: [{ id: 'prompt-1', zh: '你好' }] }]
    const model = buildPackReadModel(
      { id: 'pack-1', title: '问候', contentMode: 'practice', vocabularies: [], chunks: [], sentencePatterns: [] },
      [{
        topic: {
          id: 'topic-1',
          title: '见面',
          metadata: { outputTraining: { enabled: true, pipeline } },
          contentConfig: { writing: { genre: 'essay' } },
        },
        vocabularies: [{ id: 'word-1' }, { id: 'word-2' }],
        activeChunks: [{ id: 'chunk-1' }],
        sentencePatterns: [{ id: 'pattern-1' }],
        teachingMarkdown: '# 教学',
      }],
    )

    const teaching = model.rows.find((row) => row.id === topicTeachingId('topic-1'))
    const runtime = model.rows.find((row) => row.id === topicPipelineId('topic-1'))
    const summary = model.rows.find((row) => row.id === unitSummaryId('pack-1'))

    expect(model.rows.some((row) => row.id === 'pack-1')).toBe(false)
    expect(teaching).toMatchObject({ teachingMarkdown: '# 教学', rowKind: 'teaching' })
    expect(teaching).not.toHaveProperty('metadata')
    expect(runtime).toMatchObject({ rowKind: 'pipeline' })
    expect(runtime?.metadata.outputTraining.pipeline).toEqual(pipeline)
    expect(JSON.stringify(runtime)).not.toContain('# 教学')
    expect(summary?.practiceItemIds).toEqual(buildWarmupPracticeItemIds('pack-1', [{
      id: 'topic-1',
      metadata: { outputTraining: { enabled: true, pipeline } },
    }]))
    expect(summary?.practiceItemIds.length).toBeGreaterThan(0)
  })
})
