import { expect, it } from 'vitest'
import { sentenceBuildingPrompts } from '../../lib/warmup-reference'
it('uses the existing group answer for its only unanswered child without mutating content', () => {
  const pattern = { answer: 'Second answer.', items: [{ zh: '第一题', answer: 'First answer.' }, { zh: '第二题', answer: '' }] }
  expect(sentenceBuildingPrompts(pattern)).toEqual([{ zh: '第一题', answer: 'First answer.' }, { zh: '第二题', answer: 'Second answer.' }])
  expect(pattern.items[1].answer).toBe('')
})
it('does not guess which of several missing children owns the answer', () => {
  const pattern = { answer: 'One answer.', items: [{ answer: '' }, { answer: '' }] }
  expect(sentenceBuildingPrompts(pattern)).toBe(pattern.items)
})
