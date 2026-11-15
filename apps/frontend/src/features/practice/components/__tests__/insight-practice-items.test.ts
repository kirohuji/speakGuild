import { expect, it } from 'vitest'
import { filterInsightPracticeItems } from '../../lib/insight-practice-items'
import { createWarmupPracticeItemId } from '@/lib/offline/warmup-practice-item-id'

it('keeps only associated questions while preserving canonical question IDs', () => {
  const item = { id: 'group', type: 'vocab_drill', title: '练习', vocabs: [
    { vocabId: 'other', promptZh: '另一词' }, { vocabId: 'word-id', promptZh: '当前词', suggestedAnswer: 'A test.' },
  ] }
  const [filtered] = filterInsightPracticeItems([item], { kind: 'word', id: 'word:word-id', word: 'test' })
  expect(filtered.vocabs).toEqual([item.vocabs[1]])
  const id = (group: any) => createWarmupPracticeItemId({ packId: 'pack', topicId: 'original-topic', type: item.type, item: group, prompt: item.vocabs[1] })
  expect(id(filtered)).toBe(id(item))
})
it('matches English usage without matching a substring or a Chinese translation', () => {
  const pipeline = [{ type: 'chunk_substitution', chunk: 'other', items: [
    { en: 'We start early.', zh: 'art' }, { answer: 'I study art.' }, { zh: 'art', answer: 'No.' },
  ] }]
  expect(filterInsightPracticeItems(pipeline, { kind: 'word', id: 'art', word: 'art' })[0].items).toEqual([pipeline[0].items[1]])
})
it('supports patterns in sentence building, chunks and whole decomposition questions', () => {
  const items = [
    { type: 'vocab_sentence_building', vocabWord: 'help', patterns: [{ chunk: 'It is __ to __', items: [{ answer: 'It is easy to learn.' }] }, { chunk: 'other', items: [{ answer: 'No.' }] }] },
    { type: 'sentence_decomposition', levels: [{ en: 'It is fun to learn.' }] },
    { type: 'pattern_drill', patternId: 'target', items: [{ answer: 'No.' }] },
  ]
  const selected = filterInsightPracticeItems(items, { kind: 'pattern', id: 'target', pattern: 'It is __ to __' })
  expect(selected).toHaveLength(3)
  expect(selected[0].patterns).toHaveLength(1)
  expect(filterInsightPracticeItems([{ type: 'chunk_substitution', chunk: 'take care', items: [{ zh: '保重' }] }], { kind: 'chunk', id: 'chunk', text: 'take care' })).toHaveLength(1)
})
it('treats punctuation as literal text rather than regular expression syntax', () => {
  expect(() => filterInsightPracticeItems([{ type: 'vocab_drill', vocabs: [{ suggestedAnswer: 'Use C++ today.' }] }], { kind: 'word', id: 'cpp', word: 'C++' })).not.toThrow()
})
