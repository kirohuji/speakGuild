import { describe, expect, it } from 'vitest'
import { resolveSyncScope } from '../sync-scope'

describe('resolveSyncScope', () => {
  it('leaves filters empty for full sync', () => {
    expect(resolveSyncScope()).toEqual({})
    expect(resolveSyncScope('all')).toEqual({})
  })

  it('scopes today / notebook / script outbox and pull types separately', () => {
    const today = resolveSyncScope('today')
    expect([...today.outboxTypes!].sort()).toEqual(['daily_practice', 'learning_activity', 'user_recording'])
    expect(today.pullTypes).toEqual(['dailyPracticeRuns', 'practiceWarmupRecords'])

    const notebook = resolveSyncScope('notebook')
    expect([...notebook.outboxTypes!].sort()).toEqual([
      'chunk_entry',
      'notebook',
      'notebook_item',
      'pattern_entry',
      'word_entry',
    ])
    expect(notebook.pullTypes).toEqual(['expressionItems', 'learningNotebooks', 'learningNotebookItems'])

    const script = resolveSyncScope('script')
    expect([...script.outboxTypes!].sort()).toEqual(['nqtr_save', 'script_practice_record'])
    expect(script.pullTypes).toEqual([])
  })

  it('does not let script scope pull today-task or notebook types', () => {
    const script = resolveSyncScope('script')
    expect(script.pullTypes).not.toContain('dailyPracticeRuns')
    expect(script.pullTypes).not.toContain('learningNotebookItems')
    expect(script.outboxTypes!.has('daily_practice')).toBe(false)
    expect(script.outboxTypes!.has('notebook_item')).toBe(false)
  })
})
