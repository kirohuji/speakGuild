import { expect, it } from 'vitest'
import { meaningConflict, targetIsUsed } from '../warmup-answer-rules'
const input = (expectedAnswer: string, userAnswer: string, targetText?: string) => ({ stepType: 'pattern_drill' as const, expectedAnswer, userAnswer, targetText, prompt: '题干' })
it.each([
  ['get to [place]', 'I got to school yesterday.', true],
  ['get to [place]', 'I arrived at school yesterday.', false],
  ['take [someone] to [place]', 'I took her home.', true],
  ['take [someone] to [place]', 'I took her to home.', false],
  ['get [someone] to [do]', 'I got him to help us.', true],
  ['get [someone] to [do]', 'I got him helping us.', false],
  ['get [someone] to [do]', 'I got him to helps us.', false],
  ['Nice / Good to see [someone]', 'Nice to see you.', true],
  ['Nice / Good to see [someone]', 'Nice weather.', false],
  ['get [something] [past participle]', 'I got my phone repaired.', true],
  ['get [something] [past participle]', 'I got my phone repair.', false],
  ['get [something] [past participle]', 'I got my phone is.', false],
  ["I'll get back to you.", 'I will check and get back to you.', true],
  ["I'll get back to you.", 'I will check and reply to you.', false],
])('checks structure %s in %s', (target, answer, used) => {
  expect(targetIsUsed(input(answer, answer, target))).toBe(used)
})
it('requires both the word and construction in word-and-construction practice', () => {
  expect(targetIsUsed({ ...input('Get ready.', 'Be ready.', 'be ready'), stepType: 'vocab_sentence_building', requiredWords: ['get'] })).toBe(false)
})
it.each([
  ['I like tea.', 'I do not like tea.'],
  ['I gave her five books.', 'I gave her fifty books.'],
  ['It took two hours.', 'It took two days.'],
  ['I can swim.', 'I must swim.'],
  ['我喜欢茶。', '我不喜欢茶。'],
  ['你晚饭后给我打电话。', '晚饭前给我打电话。'],
  ['我到公司后给她打电话。', '她到公司后给我打电话。'],
])('blocks meaning changes despite high semantic relatedness: %s / %s', (reference, answer) => {
  expect(meaningConflict(input(reference, answer))).not.toBeNull()
})
it.each([
  ['I cannot come.', 'I am unable to come.'],
  ['I worked for two hours.', 'I worked for 120 minutes.'],
  ['Give me five minutes.', 'Give me five minites.'],
  ['你可以回复我吗？', '你能不能回复我？'],
  ['我看一下文件后回复你。', '看完文件我回复你。'],
])('does not confuse legitimate paraphrases with conflicts: %s / %s', (reference, answer) => {
  expect(meaningConflict(input(reference, answer))).toBeNull()
})
it.each([
  ['agree', 'She agreed.'],
  ['use', 'She used the computer.'],
  ['need', 'We needed help.'],
  ['study', 'He studies English.'],
  ['make', 'They made a cake.'],
])('accepts normal inflection of %s', (word, answer) => {
  expect(targetIsUsed({ ...input(answer, answer, word), stepType: 'vocab_drill' })).toBe(true)
})
