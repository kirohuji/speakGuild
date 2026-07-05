import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ArrowLeftRight,
  AlertTriangle,
  BarChart3,
  Braces,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  FileText,
  Info,
  Layers,
  ListChecks,
  Loader2,
  Plus,
  Power,
  Scissors,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import { synthesizeAdminAudio } from '@/lib/admin-tts-helpers'

import {
  ChunkSubstitutionForm,
  type ChunkSubstitutionItem,
} from './chunk-substitution-form'
import {
  VocabSentenceBuildingForm,
  type VocabSentenceBuildingItem,
} from './vocab-sentence-building-form'
import {
  SentenceDecompositionForm,
  type SentenceDecompositionItem,
} from './sentence-decomposition-form'
import {
  PatternDrillForm,
  type PatternDrillItem,
} from './pattern-drill-form'

export type WarmupPipelineItem = ChunkSubstitutionItem | VocabSentenceBuildingItem | SentenceDecompositionItem | PatternDrillItem

export interface WarmupPipelineData {
  version: number
  enabled: boolean
  pipeline: WarmupPipelineItem[]
  materialUsage?: WarmupMaterialUsage
}

export interface WarmupMaterialUsage {
  generatedAt: string
  usedRefs: {
    vocabIds: string[]
    chunkIds: string[]
    patternIds: string[]
  }
  totals: {
    vocabs: Array<{ id: string; word: string; meaning?: string; count: number }>
    chunks: Array<{ id: string; text: string; meaning?: string; count: number }>
    patterns: Array<{ id: string; pattern: string; meaning?: string; count: number }>
  }
  itemStats: Array<{
    id: string
    type: WarmupPipelineItem['type']
    title?: string
    vocabs: Array<{ id: string; word: string; meaning?: string; count: number }>
    chunks: Array<{ id: string; text: string; meaning?: string; count: number }>
    patterns: Array<{ id: string; pattern: string; meaning?: string; count: number }>
  }>
}

interface Props {
  value: WarmupPipelineData
  onChange: (value: WarmupPipelineData) => void
  vocabs?: { id: string; word: string; meaning: string }[]
  chunks?: { id: string; text: string; meaning: string }[]
  patterns?: { id: string; pattern: string; meaning?: string }[]
  topicTitle?: string
  topicIndex?: number
  topicTotal?: number
  onPrevTopic?: () => void
  onNextTopic?: () => void
  difficulty?: string
  teachingMarkdown?: string | null
  onTeachingMarkdownChange?: (value: string) => void
  onGenerateTeaching?: () => Promise<string | null>
}

let _idCounter = Date.now()
const genId = () => `warmup_${++_idCounter}`

const itemTypeOptions: Array<{
  type: WarmupPipelineItem['type']
  label: string
  description: string
  icon: typeof ArrowLeftRight
}> = [
  {
    type: 'chunk_substitution',
    label: '句块替换',
    description: '中英互换，把词或句块练成可输出表达。',
    icon: ArrowLeftRight,
  },
  {
    type: 'vocab_sentence_building',
    label: '一词多句',
    description: '围绕核心词汇，用多种句式做输出变化。',
    icon: Layers,
  },
  {
    type: 'sentence_decomposition',
    label: '句子拆解',
    description: '从核心句逐级扩展，训练长句组织能力。',
    icon: FileText,
  },
  {
    type: 'pattern_drill',
    label: '句型操练',
    description: '固定句型框架加可变槽位，练快速套用。',
    icon: Braces,
  },
]

const WARMUP_BATCH_AI_TIMEOUT_MS = 300_000

type ValidationTone = 'ok' | 'warn' | 'error'

interface ValidationItem {
  label: string
  detail: string
  tone: ValidationTone
}

function newChunkSubstitution(): ChunkSubstitutionItem {
  return {
    id: genId(),
    type: 'chunk_substitution',
    title: '',
    chunk: '',
    chunkMeaning: '',
    direction: 'zh_to_en',
    kind: 'chunk',
    items: [{ zh: '', answer: '' }],
  }
}

function newVocabSentenceBuilding(): VocabSentenceBuildingItem {
  return {
    id: genId(),
    type: 'vocab_sentence_building',
    title: '',
    vocabWord: '',
    vocabMeaning: '',
    direction: 'zh_to_en',
    patterns: [{ chunk: '', items: [{ zh: '', answer: '' }] }],
  }
}

function newSentenceDecomposition(): SentenceDecompositionItem {
  return {
    id: genId(),
    type: 'sentence_decomposition',
    title: '',
    fullSentence: '',
    fullSentenceZh: '',
    levels: [],
  }
}

function newPatternDrill(): PatternDrillItem {
  return {
    id: genId(),
    type: 'pattern_drill',
    title: '',
    pattern: '',
    patternMeaning: '',
    direction: 'zh_to_en',
    items: [{ zh: '', answer: '' }],
  }
}

type HintableWarmupItem = ChunkSubstitutionItem['items'][number]
  | VocabSentenceBuildingItem['patterns'][number]['items'][number]
  | PatternDrillItem['items'][number]

const looksEnglish = (text?: string) => /[A-Za-z]/.test(text ?? '')

const isLegacyEnToZhItem = (item: HintableWarmupItem, direction?: string) => (
  direction === 'en_to_zh' && !item.en && looksEnglish(item.answer) && Boolean(item.zh)
)

const getPromptText = (item: HintableWarmupItem, direction?: string) => {
  if (direction !== 'en_to_zh') return item.zh ?? item.en ?? ''
  if (item.en) return item.en
  if (isLegacyEnToZhItem(item, direction)) return item.answer
  return item.zh ?? item.answer ?? ''
}

const getAnswerText = (item: HintableWarmupItem, direction?: string) => {
  if (direction !== 'en_to_zh') return item.answer ?? ''
  if (item.en) return item.answer ?? item.zh ?? ''
  if (isLegacyEnToZhItem(item, direction)) return item.zh ?? ''
  return item.answer ?? ''
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeForUsage = (value: string) => value
  .toLowerCase()
  .replace(/[’‘]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

const isSameMaterial = (left?: string, right?: string) => normalizeForUsage(left ?? '') === normalizeForUsage(right ?? '')

const tokenizeUsageText = (value: string) => normalizeForUsage(value)
  .replace(/['"]/g, '')
  .match(/[a-z0-9]+/g) ?? []

const hasOrderedTokens = (textTokens: string[], patternTokens: string[]) => {
  if (!patternTokens.length) return false
  let cursor = 0
  for (const token of textTokens) {
    if (token === patternTokens[cursor]) cursor += 1
    if (cursor >= patternTokens.length) return true
  }
  return false
}

const getPatternFixedParts = (pattern: string) => normalizeForUsage(pattern)
  .replace(/\[[^\]]*]/g, '|')
  .replace(/\{[^}]*}/g, '|')
  .replace(/<[^>]*>/g, '|')
  .replace(/\([^)]*\)/g, '|')
  .replace(/_{2,}/g, '|')
  .replace(/\.{2,}/g, '|')
  .replace(/\s*\/\s*/g, '|')
  .split('|')
  .map((part) => part.replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim())
  .filter((part) => tokenizeUsageText(part).length >= 2 || part.length >= 4)

const countMaterialInText = (text: string, needle: string, mode: 'word' | 'phrase') => {
  const normalizedNeedle = normalizeForUsage(needle)
  if (!normalizedNeedle) return 0
  const normalizedText = normalizeForUsage(text)
  if (!normalizedText) return 0
  const escaped = escapeRegExp(normalizedNeedle)
  const pattern = mode === 'word'
    ? new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'gi')
    : new RegExp(escaped, 'gi')
  return [...normalizedText.matchAll(pattern)].length
}

const countPatternInText = (text: string, pattern: string) => {
  const exactCount = countMaterialInText(text, pattern, 'phrase')
  if (exactCount > 0) return exactCount

  const normalizedText = normalizeForUsage(text)
  const fixedParts = getPatternFixedParts(pattern)
  if (fixedParts.length) {
    const matchedParts = fixedParts.filter((part) => normalizedText.includes(part))
    if (matchedParts.length === fixedParts.length) return 1
    if (fixedParts.length >= 2 && matchedParts.length >= Math.ceil(fixedParts.length * 0.7)) return 1
  }

  const patternTokens = tokenizeUsageText(pattern)
    .filter((token) => !['slot', 'slots', 'someone', 'something', 'somebody', 'noun', 'verb', 'adj', 'adjective', 'object'].includes(token))
  const usefulTokens = patternTokens.filter((token) => token.length > 1)
  if (usefulTokens.length >= 3 && hasOrderedTokens(tokenizeUsageText(text), usefulTokens)) return 1

  return 0
}

const countDirectMaterialUse = (item: WarmupPipelineItem, material: string, group: 'vocab' | 'chunk' | 'pattern') => {
  if (item.type === 'sentence_decomposition') {
    return item.sourceKind === group && isSameMaterial(item.sourceText, material)
      ? Math.max(1, item.levels.length)
      : 0
  }

  if (group === 'vocab') {
    if (item.type === 'vocab_sentence_building' && isSameMaterial(item.vocabWord, material)) {
      return Math.max(1, item.patterns.reduce((sum, pattern) => sum + pattern.items.length, 0))
    }
    if (item.type === 'chunk_substitution' && item.kind === 'word' && isSameMaterial(item.chunk, material)) {
      return Math.max(1, item.items.length)
    }
    return 0
  }

  if (group === 'chunk') {
    if (item.type === 'chunk_substitution' && item.kind !== 'word' && isSameMaterial(item.chunk, material)) {
      return Math.max(1, item.items.length)
    }
    if (item.type === 'vocab_sentence_building') {
      return item.patterns.reduce((sum, pattern) => (
        sum + (isSameMaterial(pattern.chunk, material) ? Math.max(1, pattern.items.length) : 0)
      ), 0)
    }
    return 0
  }

  if (item.type === 'pattern_drill' && isSameMaterial(item.pattern, material)) {
    return Math.max(1, item.items.length)
  }
  if (item.type === 'vocab_sentence_building') {
    return item.patterns.reduce((sum, pattern) => (
      sum + (isSameMaterial(pattern.chunk, material) ? Math.max(1, pattern.items.length) : 0)
    ), 0)
  }
  return 0
}

const materialCount = (item: WarmupPipelineItem, text: string, material: string, group: 'vocab' | 'chunk' | 'pattern') => {
  const directCount = countDirectMaterialUse(item, material, group)
  const textCount = group === 'pattern'
    ? countPatternInText(text, material)
    : countMaterialInText(text, material, group === 'vocab' ? 'word' : 'phrase')
  return Math.max(directCount, textCount)
}

const getWarmupItemText = (item: WarmupPipelineItem) => {
  if (item.type === 'sentence_decomposition') {
    return [item.title, item.sourceText, item.fullSentence, item.fullSentenceZh, ...item.levels.flatMap((level) => [level.en, level.zh, level.hint])].join('\n')
  }
  if (item.type === 'vocab_sentence_building') {
    return [
      item.vocabWord,
      item.vocabMeaning,
      ...item.patterns.flatMap((pattern) => [
        pattern.chunk,
        ...pattern.items.flatMap((it) => [getPromptText(it, item.direction), getAnswerText(it, item.direction), it.hint]),
      ]),
    ].join('\n')
  }
  if (item.type === 'chunk_substitution') {
    return [item.chunk, item.chunkMeaning, ...item.items.flatMap((it) => [getPromptText(it, item.direction), getAnswerText(it, item.direction), it.hint])].join('\n')
  }
  return [item.pattern, item.patternMeaning, ...item.items.flatMap((it) => [getPromptText(it, item.direction), getAnswerText(it, item.direction), it.hint])].join('\n')
}

const normalizeDedupeText = (value?: string) => normalizeForUsage(value ?? '')
  .replace(/[^a-z0-9\u4e00-\u9fa5\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const dedupeTokens = (value: string) => new Set(normalizeDedupeText(value).split(/\s+/).filter((token) => token.length > 1))

const similarityScore = (left: string, right: string) => {
  const a = dedupeTokens(left)
  const b = dedupeTokens(right)
  if (!a.size || !b.size) return 0
  const intersection = [...a].filter((token) => b.has(token)).length
  return intersection / Math.max(a.size, b.size)
}

const isSimilarExercise = (left: string, right: string) => {
  if (!left || !right) return false
  if (left === right) return true
  return similarityScore(left, right) >= 0.86
}

const exerciseSignature = (item: HintableWarmupItem, direction?: string) => [
  normalizeDedupeText(getPromptText(item, direction)),
  normalizeDedupeText(getAnswerText(item, direction)),
].filter(Boolean).join(' => ')

function compactWarmupPipeline(pipeline: WarmupPipelineItem[]) {
  const globalSignatures: string[] = []
  let removedCount = 0

  const keepUniqueExercises = <T extends HintableWarmupItem>(items: T[], direction?: string, minKeep = 2) => {
    const kept: T[] = []
    for (const item of items) {
      const signature = exerciseSignature(item, direction)
      const duplicate = signature
        ? [...kept.map((it) => exerciseSignature(it, direction)), ...globalSignatures].some((existing) => isSimilarExercise(signature, existing))
        : false
      if (duplicate && kept.length >= minKeep) {
        removedCount += 1
        continue
      }
      kept.push(item)
      if (signature) globalSignatures.push(signature)
    }
    return kept
  }

  const nextPipeline = pipeline.map((item) => {
    if (item.type === 'chunk_substitution' || item.type === 'pattern_drill') {
      return {
        ...item,
        items: keepUniqueExercises(item.items, item.direction, Math.min(2, item.items.length)),
      }
    }
    if (item.type === 'vocab_sentence_building') {
      return {
        ...item,
        patterns: item.patterns.map((pattern) => ({
          ...pattern,
          items: keepUniqueExercises(pattern.items, item.direction, Math.min(2, pattern.items.length)),
        })).filter((pattern) => pattern.items.length > 0),
      }
    }
    return item
  }).filter((item) => {
    if (item.type === 'vocab_sentence_building') return item.patterns.length > 0
    return true
  })

  return { pipeline: nextPipeline, removedCount }
}

export function buildWarmupMaterialUsage(
  value: WarmupPipelineData,
  vocabs: { id: string; word: string; meaning?: string }[] = [],
  chunks: { id: string; text: string; meaning?: string }[] = [],
  patterns: { id: string; pattern: string; meaning?: string }[] = [],
): WarmupMaterialUsage {
  const itemStats = (value.pipeline ?? []).map((item) => {
    const text = getWarmupItemText(item)
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      vocabs: vocabs
        .map((vocab) => ({ id: vocab.id, word: vocab.word, meaning: vocab.meaning, count: materialCount(item, text, vocab.word, 'vocab') }))
        .filter((entry) => entry.count > 0),
      chunks: chunks
        .map((chunk) => ({ id: chunk.id, text: chunk.text, meaning: chunk.meaning, count: materialCount(item, text, chunk.text, 'chunk') }))
        .filter((entry) => entry.count > 0),
      patterns: patterns
        .map((pattern) => ({ id: pattern.id, pattern: pattern.pattern, meaning: pattern.meaning, count: materialCount(item, text, pattern.pattern, 'pattern') }))
        .filter((entry) => entry.count > 0),
    }
  })

  const totals = {
    vocabs: vocabs.map((vocab) => ({
      id: vocab.id,
      word: vocab.word,
      meaning: vocab.meaning,
      count: itemStats.reduce((sum, stat) => sum + (stat.vocabs.find((entry) => entry.id === vocab.id)?.count ?? 0), 0),
    })),
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.text,
      meaning: chunk.meaning,
      count: itemStats.reduce((sum, stat) => sum + (stat.chunks.find((entry) => entry.id === chunk.id)?.count ?? 0), 0),
    })),
    patterns: patterns.map((pattern) => ({
      id: pattern.id,
      pattern: pattern.pattern,
      meaning: pattern.meaning,
      count: itemStats.reduce((sum, stat) => sum + (stat.patterns.find((entry) => entry.id === pattern.id)?.count ?? 0), 0),
    })),
  }

  return {
    generatedAt: new Date().toISOString(),
    usedRefs: {
      vocabIds: totals.vocabs.filter((entry) => entry.count > 0).map((entry) => entry.id),
      chunkIds: totals.chunks.filter((entry) => entry.count > 0).map((entry) => entry.id),
      patternIds: totals.patterns.filter((entry) => entry.count > 0).map((entry) => entry.id),
    },
    totals,
    itemStats,
  }
}

export function WarmupPipelineTab({
  value,
  onChange,
  vocabs = [],
  chunks = [],
  patterns = [],
  topicTitle,
  topicIndex,
  topicTotal,
  onPrevTopic,
  onNextTopic,
  difficulty,
  teachingMarkdown,
  onTeachingMarkdownChange,
  onGenerateTeaching,
}: Props) {
  const [local, setLocal] = useState<WarmupPipelineData>(value)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(value.pipeline[0]?.id ?? null)
  const [aiGeneratingMissing, setAiGeneratingMissing] = useState(false)
  const [aiHintingAll, setAiHintingAll] = useState(false)
  const [aiAudioAll, setAiAudioAll] = useState(false)
  const [teachingGenerating, setTeachingGenerating] = useState(false)
  const [teachingMode, setTeachingMode] = useState<'edit' | 'preview'>('edit')
  const prevIdsRef = useRef<string>('')

  useEffect(() => {
    setLocal(value)
    const ids = value.pipeline.map(item => item.id)
    const currentIds = ids.join(',')
    if (currentIds !== prevIdsRef.current) {
      prevIdsRef.current = currentIds
      setSelectedItemId((current) => current && ids.includes(current) ? current : ids[0] ?? null)
    }
  }, [value])

  const commit = (patch: Partial<WarmupPipelineData>) => {
    const base = { ...local, ...patch }
    const next = {
      ...base,
      materialUsage: buildWarmupMaterialUsage(base, vocabs, chunks, patterns),
    }
    setLocal(next)
    onChange(next)
  }

  const updateItem = (idx: number, item: WarmupPipelineItem) => {
    const next = [...local.pipeline]
    next[idx] = item
    commit({ pipeline: next })
  }

  const materialUsageStats = useMemo(
    () => buildWarmupMaterialUsage(local, vocabs, chunks, patterns),
    [local, vocabs, chunks, patterns],
  )
  const materialCoverage = materialUsageStats.usedRefs

  const generationContext = useMemo(() => ({
    topicTitle: topicTitle?.trim() || undefined,
    difficulty: difficulty || undefined,
    materials: {
      vocabs: vocabs.map((vocab) => ({ id: vocab.id, word: vocab.word, meaning: vocab.meaning })),
      chunks: chunks.map((chunk) => ({ id: chunk.id, text: chunk.text, meaning: chunk.meaning })),
      patterns: patterns.map((pattern) => ({ id: pattern.id, pattern: pattern.pattern, meaning: pattern.meaning })),
    },
    usedRefs: materialCoverage,
  }), [topicTitle, difficulty, vocabs, chunks, patterns, materialCoverage])

  const deleteItem = (idx: number) => {
    const deletedId = local.pipeline[idx]?.id
    const next = local.pipeline.filter((_, i) => i !== idx)
    commit({ pipeline: next })
    if (selectedItemId === deletedId) {
      setSelectedItemId(next[Math.min(idx, next.length - 1)]?.id ?? null)
    }
  }

  const addItem = (type: WarmupPipelineItem['type']) => {
    let item: WarmupPipelineItem
    if (type === 'chunk_substitution') item = newChunkSubstitution()
    else if (type === 'vocab_sentence_building') item = newVocabSentenceBuilding()
    else if (type === 'sentence_decomposition') item = newSentenceDecomposition()
    else item = newPatternDrill()
    commit({ pipeline: [...local.pipeline, item] })
    setSelectedItemId(item.id)
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...local.pipeline]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    commit({ pipeline: next })
  }

  const compactDuplicates = (showToast = true) => {
    const result = compactWarmupPipeline(local.pipeline)
    if (!result.removedCount) {
      if (showToast) toast.success('没有发现需要压缩的重复题目')
      return result
    }
    commit({ pipeline: result.pipeline })
    if (showToast) toast.success(`已去掉 ${result.removedCount} 条重复/相似题目`)
    return result
  }

  const generateAllHints = async () => {
    const hintableCount = local.pipeline.reduce((sum, item) => {
      if (item.type === 'sentence_decomposition') return sum
      if (item.type === 'vocab_sentence_building') {
        return sum + item.patterns.reduce((inner, pattern) => inner + pattern.items.length, 0)
      }
      return sum + item.items.length
    }, 0)

    if (!hintableCount) {
      toast.error('当前话题还没有可生成提示的题目')
      return
    }

    setAiHintingAll(true)
    try {
      const { post } = await import('@/lib/request')
      let appliedCount = 0
      const nextPipeline: WarmupPipelineItem[] = []

      for (const item of local.pipeline) {
        if (item.type === 'chunk_substitution') {
          if (!item.chunk || !item.items.length) {
            nextPipeline.push(item)
            continue
          }
          const direction = item.direction ?? 'zh_to_en'
          const res: any = await post('/practice-ai/generate-drills', {
            type: 'chunk_substitution',
            keyword: item.chunk,
            meaning: item.chunkMeaning || '',
            direction,
            kind: item.kind ?? 'chunk',
            generateHints: true,
            itemCount: item.items.length,
            items: item.items.map((it) => ({ zh: getPromptText(it, direction), answer: getAnswerText(it, direction) })),
            ...generationContext,
          })
          const hints = Array.isArray(res?.hints) ? res.hints : []
          appliedCount += hints.filter(Boolean).length
          nextPipeline.push({
            ...item,
            items: item.items.map((it, index) => ({ ...it, hint: hints[index] ?? it.hint ?? '' })),
          })
          continue
        }

        if (item.type === 'pattern_drill') {
          if (!item.pattern || !item.items.length) {
            nextPipeline.push(item)
            continue
          }
          const direction = item.direction ?? 'zh_to_en'
          const res: any = await post('/practice-ai/generate-drills', {
            type: 'pattern_drill',
            keyword: item.pattern,
            meaning: item.patternMeaning || '',
            direction,
            generateHints: true,
            itemCount: item.items.length,
            items: item.items.map((it) => ({ zh: getPromptText(it, direction), answer: getAnswerText(it, direction) })),
            ...generationContext,
          })
          const hints = Array.isArray(res?.hints) ? res.hints : []
          appliedCount += hints.filter(Boolean).length
          nextPipeline.push({
            ...item,
            items: item.items.map((it, index) => ({ ...it, hint: hints[index] ?? it.hint ?? '' })),
          })
          continue
        }

        if (item.type === 'vocab_sentence_building') {
          const allItems = item.patterns.flatMap((pattern) => pattern.items)
          if (!item.vocabWord || !allItems.length) {
            nextPipeline.push(item)
            continue
          }
          const direction = item.direction ?? 'zh_to_en'
          const res: any = await post('/practice-ai/generate-drills', {
            type: 'vocab_sentence_building',
            keyword: item.vocabWord,
            meaning: item.vocabMeaning || '',
            direction,
            generateHints: true,
            itemCount: allItems.length,
            items: allItems.map((it) => ({ zh: getPromptText(it, direction), answer: getAnswerText(it, direction) })),
            ...generationContext,
          })
          const hints = Array.isArray(res?.hints) ? res.hints : []
          appliedCount += hints.filter(Boolean).length
          let hintIndex = 0
          nextPipeline.push({
            ...item,
            patterns: item.patterns.map((pattern) => ({
              ...pattern,
              items: pattern.items.map((it) => ({ ...it, hint: hints[hintIndex++] ?? it.hint ?? '' })),
            })),
          })
          continue
        }

        nextPipeline.push(item)
      }

      commit({ pipeline: nextPipeline })
      if (appliedCount) toast.success(`已为 ${appliedCount} 道题生成 AI 提示`)
      else toast.error('AI 未返回教学提示，请检查题目关键词后重试')
    } catch (err: any) {
      toast.error(err?.message || '批量生成 AI 提示失败')
    } finally {
      setAiHintingAll(false)
    }
  }

  const generateMissingPracticeItems = async () => {
    const currentZhItems = local.pipeline
      .filter((item): item is ChunkSubstitutionItem => item.type === 'chunk_substitution' && item.direction === 'zh_to_en')
      .reduce((sum, item) => sum + item.items.length, 0)
    const currentEnItems = local.pipeline
      .filter((item): item is ChunkSubstitutionItem => item.type === 'chunk_substitution' && item.direction === 'en_to_zh')
      .reduce((sum, item) => sum + item.items.length, 0)
    const currentPatternItems = local.pipeline
      .filter((item): item is PatternDrillItem => item.type === 'pattern_drill')
      .reduce((sum, item) => sum + item.items.length, 0)
    const currentExpansionUnits = local.pipeline
      .filter((item) => item.type === 'vocab_sentence_building' || item.type === 'sentence_decomposition')
      .length
    const currentPracticeItems = local.pipeline.reduce((sum, item) => {
      if (item.type === 'sentence_decomposition') return sum + item.levels.length
      if (item.type === 'vocab_sentence_building') return sum + item.patterns.reduce((inner, pattern) => inner + pattern.items.length, 0)
      return sum + item.items.length
    }, 0)

    const structureMissing =
      Math.max(0, 3 - currentZhItems)
      + Math.max(0, 2 - currentEnItems)
      + Math.max(0, 2 - currentPatternItems)
      + Math.max(0, 1 - currentExpansionUnits)
      + Math.max(0, 3 - local.pipeline.length)
      + Math.max(0, 6 - currentPracticeItems)
    const missingVocabs = materialUsageStats.totals.vocabs.filter((entry) => entry.count === 0)
    const missingChunks = materialUsageStats.totals.chunks.filter((entry) => entry.count === 0)
    const missingPatterns = materialUsageStats.totals.patterns.filter((entry) => entry.count === 0)
    const missingCount = missingVocabs.length + missingChunks.length + missingPatterns.length
    if (!missingCount && !structureMissing) {
      toast.success('当前材料都已经覆盖')
      return
    }

    setAiGeneratingMissing(true)
    try {
      const { post } = await import('@/lib/request')
      const normalizeTranslationItems = (
        items: any[],
        direction: 'zh_to_en' | 'en_to_zh',
      ): Array<{ zh?: string; en?: string; answer: string; hint?: string }> => {
        return (Array.isArray(items) ? items : [])
          .map((it) => {
            const answer = String(it?.answer ?? '').trim()
            const hint = String(it?.hint ?? '').trim()
            if (direction === 'en_to_zh') {
              // en_to_zh: prompt is English (field "en"), answer is Chinese.
              // If AI mistakenly put content in "zh" instead of "en", swap.
              const rawEn = String(it?.en ?? '').trim()
              const rawZh = String(it?.zh ?? '').trim()
              const en = rawEn || (rawZh && /[A-Za-z]/.test(rawZh) ? rawZh : '')
              return { en, answer, hint }
            }
            // zh_to_en: prompt is Chinese (field "zh"), answer is English.
            // If AI mistakenly used "en" field for the prompt, drop it — do NOT fallback.
            const zh = String(it?.zh ?? '').trim()
            return { zh, answer, hint }
          })
          .filter((it) => Boolean((direction === 'en_to_zh' ? it.en : it.zh)?.trim()) && Boolean(it.answer.trim()))
      }

      const normalizeGeneratedItem = (item: any): WarmupPipelineItem | null => {
        if (item?.type === 'chunk_substitution') {
          const direction: 'zh_to_en' | 'en_to_zh' = item.direction === 'en_to_zh' ? 'en_to_zh' : 'zh_to_en'
          const kind: 'word' | 'chunk' = item.kind === 'word' ? 'word' : 'chunk'
          const chunk = String(item.chunk ?? '').trim()
          const items = normalizeTranslationItems(item.items, direction)
          if (!chunk || !items.length) return null
          return {
            id: genId(),
            type: 'chunk_substitution',
            title: String(item.title ?? `${chunk} ${kind === 'word' ? '单词替换' : '句块替换'}`).trim(),
            chunk,
            chunkMeaning: String(item.chunkMeaning ?? '').trim(),
            direction,
            kind,
            items,
          }
        }

        if (item?.type === 'vocab_sentence_building') {
          const vocabWord = String(item.vocabWord ?? '').trim()
          const direction: 'zh_to_en' | 'en_to_zh' = item.direction === 'en_to_zh' ? 'en_to_zh' : 'zh_to_en'
          const nextPatterns = (Array.isArray(item.patterns) ? item.patterns : [])
            .map((pattern: any) => ({
              chunk: String(pattern?.chunk ?? vocabWord).trim(),
              items: normalizeTranslationItems(pattern?.items, direction),
            }))
            .filter((pattern) => pattern.chunk && pattern.items.length)
          if (!vocabWord || !nextPatterns.length) return null
          return {
            id: genId(),
            type: 'vocab_sentence_building',
            title: String(item.title ?? `${vocabWord} 一词多句`).trim(),
            vocabWord,
            vocabMeaning: String(item.vocabMeaning ?? '').trim(),
            direction,
            patterns: nextPatterns,
          }
        }

        if (item?.type === 'pattern_drill') {
          const direction: 'zh_to_en' | 'en_to_zh' = item.direction === 'en_to_zh' ? 'en_to_zh' : 'zh_to_en'
          const pattern = String(item.pattern ?? '').trim()
          const items = normalizeTranslationItems(item.items, direction)
          if (!pattern || !items.length) return null
          return {
            id: genId(),
            type: 'pattern_drill',
            title: String(item.title ?? `${pattern} 句型操练`).trim(),
            pattern,
            patternMeaning: String(item.patternMeaning ?? '').trim(),
            direction,
            items,
          }
        }

        if (item?.type === 'sentence_decomposition') {
          const fullSentence = String(item.fullSentence ?? '').trim()
          const sourceKind = ['vocab', 'chunk', 'pattern'].includes(item.sourceKind) ? item.sourceKind : undefined
          const levels = (Array.isArray(item.levels) ? item.levels : [])
            .map((level: any, index: number) => ({
              level: Number.isFinite(Number(level?.level)) ? Number(level.level) : index + 1,
              label: String(level?.label ?? `第 ${index + 1} 级`).trim(),
              en: String(level?.en ?? '').trim(),
              zh: String(level?.zh ?? '').trim(),
              highlight: String(level?.highlight ?? '').trim(),
              hint: String(level?.hint ?? '').trim(),
            }))
            .filter((level) => level.en && level.zh)
            .map((level, index) => ({ ...level, level: index + 1 }))
          if (!fullSentence || !levels.length) return null
          return {
            id: genId(),
            type: 'sentence_decomposition',
            title: String(item.title ?? `${fullSentence.slice(0, 20)}${fullSentence.length > 20 ? '...' : ''} 句子拆解`).trim(),
            sourceText: String(item.sourceText ?? '').trim(),
            sourceKind,
            fullSentence,
            fullSentenceZh: String(item.fullSentenceZh ?? '').trim(),
            levels,
          }
        }

        return null
      }

      const res: any = await post('/practice-ai/generate-warmup-pipeline', {
        topicTitle,
        difficulty,
        materials: {
          vocabs: materialUsageStats.totals.vocabs,
          chunks: materialUsageStats.totals.chunks,
          patterns: materialUsageStats.totals.patterns,
        },
        structure: {
          zhToEnItems: currentZhItems,
          enToZhItems: currentEnItems,
          patternItems: currentPatternItems,
          expansionUnits: currentExpansionUnits,
          steps: local.pipeline.length,
          totalItems: currentPracticeItems,
        },
        // 把当前已生成的 pipeline 内容传给后端，AI 可以参考/改进
        previousPipeline: local.pipeline.map((item) => {
          const { id, audioUrl, audioAssetId, ...rest } = item as any
          // 递归清理子项中的音频字段
          const cleanItems = (arr: any[]) => arr?.map((it: any) => {
            const { audioUrl: _au, audioAssetId: _aa, ...clean } = it
            return clean
          })
          if (rest.items) rest.items = cleanItems(rest.items)
          if (rest.patterns) {
            rest.patterns = rest.patterns.map((p: any) => ({
              ...p,
              items: cleanItems(p.items ?? []),
            }))
          }
          if (rest.levels) rest.levels = cleanItems(rest.levels)
          return rest
        }),
      }, { timeout: WARMUP_BATCH_AI_TIMEOUT_MS })

      const generatedItems = (Array.isArray(res?.pipeline) ? res.pipeline : [])
        .map(normalizeGeneratedItem)
        .filter((item): item is WarmupPipelineItem => Boolean(item))

      if (!generatedItems.length) {
        toast.error('AI 没有生成可用题目，请稍后重试')
        return
      }

      const nextPipeline = [...local.pipeline, ...generatedItems]
      const compacted = compactWarmupPipeline(nextPipeline)
      commit({ pipeline: compacted.pipeline })
      setSelectedItemId(generatedItems[0].id)
      toast.success(`已补齐生成 ${generatedItems.length} 个题组${compacted.removedCount ? `，并去掉 ${compacted.removedCount} 条重复题目` : ''}`)
    } catch (err: any) {
      toast.error(err?.message || '全部 AI 生成失败')
    } finally {
      setAiGeneratingMissing(false)
    }
  }

  const generateAllEnglishAudio = async () => {
    const pendingCount = local.pipeline.reduce((sum, item) => {
      if (!('direction' in item) || item.direction !== 'en_to_zh') return sum
      if (item.type === 'vocab_sentence_building') {
        return sum + item.patterns.reduce((inner, pattern) => inner + pattern.items.filter((it) => getPromptText(it, item.direction).trim() && !it.audioAssetId).length, 0)
      }
      return sum + item.items.filter((it) => getPromptText(it, item.direction).trim() && !it.audioAssetId).length
    }, 0)
    if (!pendingCount) {
      toast.error('没有需要生成英文音频的英→中题目')
      return
    }

    setAiAudioAll(true)
    try {
      let generatedCount = 0
      const nextPipeline: WarmupPipelineItem[] = []
      for (const item of local.pipeline) {
        if (item.type === 'chunk_substitution' && item.direction === 'en_to_zh') {
          const items = [...item.items]
          for (let idx = 0; idx < items.length; idx += 1) {
            const text = getPromptText(items[idx], item.direction).trim()
            if (!text || items[idx].audioAssetId) continue
            const audio = await synthesizeAdminAudio(text, 'warmup_chunk_sub', `${item.id}-${idx}`)
            items[idx] = { ...items[idx], audioUrl: audio.url, audioAssetId: audio.assetId }
            generatedCount += 1
          }
          nextPipeline.push({ ...item, items })
          continue
        }
        if (item.type === 'pattern_drill' && item.direction === 'en_to_zh') {
          const items = [...item.items]
          for (let idx = 0; idx < items.length; idx += 1) {
            const text = getPromptText(items[idx], item.direction).trim()
            if (!text || items[idx].audioAssetId) continue
            const audio = await synthesizeAdminAudio(text, 'warmup_pattern_drill', `${item.id}-${idx}`)
            items[idx] = { ...items[idx], audioUrl: audio.url, audioAssetId: audio.assetId }
            generatedCount += 1
          }
          nextPipeline.push({ ...item, items })
          continue
        }
        if (item.type === 'vocab_sentence_building' && item.direction === 'en_to_zh') {
          const nextPatterns = []
          for (let pIdx = 0; pIdx < item.patterns.length; pIdx += 1) {
            const pattern = item.patterns[pIdx]
            const items = [...pattern.items]
            for (let iIdx = 0; iIdx < items.length; iIdx += 1) {
              const text = getPromptText(items[iIdx], item.direction).trim()
              if (!text || items[iIdx].audioAssetId) continue
              const audio = await synthesizeAdminAudio(text, 'warmup_vocab_build', `${item.id}-${pIdx}-${iIdx}`)
              items[iIdx] = { ...items[iIdx], audioUrl: audio.url, audioAssetId: audio.assetId }
              generatedCount += 1
            }
            nextPatterns.push({ ...pattern, items })
          }
          nextPipeline.push({ ...item, patterns: nextPatterns })
          continue
        }
        nextPipeline.push(item)
      }
      commit({ pipeline: nextPipeline })
      toast.success(`已生成 ${generatedCount} 条英文题干音频`)
    } catch (err: any) {
      toast.error(err?.message || '批量生成英文音频失败')
    } finally {
      setAiAudioAll(false)
    }
  }

  const generateTeaching = async () => {
    if (!onGenerateTeaching) return
    setTeachingGenerating(true)
    try {
      const markdown = await onGenerateTeaching()
      if (markdown != null) {
        onTeachingMarkdownChange?.(markdown)
        toast.success('教学文档已生成')
      }
    } catch (err: any) {
      toast.error(err?.message || 'AI 生成教学文档失败')
    } finally {
      setTeachingGenerating(false)
    }
  }

  const typeLabel = (item: WarmupPipelineItem) => {
    if (item.type === 'chunk_substitution') return item.kind === 'word' ? '单词替换' : '句块替换'
    if (item.type === 'vocab_sentence_building') return '一词多句'
    if (item.type === 'sentence_decomposition') return '句子拆解'
    return '句型操练'
  }

  const itemCountLabel = (item: WarmupPipelineItem) => {
    return `${getItemUnitCount(item)} ${item.type === 'sentence_decomposition' ? '层' : '题'}`
  }

  const getItemUnitCount = (item: WarmupPipelineItem) => {
    if ('items' in item) return item.items.length
    if (item.type === 'vocab_sentence_building') {
      const count = item.patterns.reduce((sum, pattern) => sum + pattern.items.length, 0)
      return count
    }
    if (item.type === 'sentence_decomposition') return item.levels.length
    return 0
  }

  const getPracticeItemCount = (item: WarmupPipelineItem) => {
    if (item.type === 'sentence_decomposition') return item.levels.length
    if (item.type === 'vocab_sentence_building') {
      return item.patterns.reduce((sum, pattern) => sum + pattern.items.length, 0)
    }
    return item.items.length
  }

  const zhChunkItems = local.pipeline
    .filter((item): item is ChunkSubstitutionItem => item.type === 'chunk_substitution' && item.direction === 'zh_to_en')
    .reduce((sum, item) => sum + item.items.length, 0)
  const enChunkItems = local.pipeline
    .filter((item): item is ChunkSubstitutionItem => item.type === 'chunk_substitution' && item.direction === 'en_to_zh')
    .reduce((sum, item) => sum + item.items.length, 0)
  const patternItems = local.pipeline
    .filter((item): item is PatternDrillItem => item.type === 'pattern_drill')
    .reduce((sum, item) => sum + item.items.length, 0)
  const vocabPatternGroups = local.pipeline
    .filter((item): item is VocabSentenceBuildingItem => item.type === 'vocab_sentence_building')
    .reduce((sum, item) => sum + item.patterns.length, 0)
  const decompositionLevels = local.pipeline
    .filter((item): item is SentenceDecompositionItem => item.type === 'sentence_decomposition')
    .reduce((sum, item) => sum + item.levels.length, 0)
  const totalPracticeItems = local.pipeline.reduce((sum, item) => sum + getPracticeItemCount(item), 0)
  const totalHintableItems = local.pipeline.reduce((sum, item) => {
    if (item.type === 'sentence_decomposition') return sum
    if (item.type === 'vocab_sentence_building') {
      return sum + item.patterns.reduce((inner, pattern) => inner + pattern.items.length, 0)
    }
    return sum + item.items.length
  }, 0)
  const singleItemSections = local.pipeline.filter((item) => getPracticeItemCount(item) === 1).length
  const materialGroups = [
    { label: '单词', items: materialUsageStats.totals.vocabs, usedIds: materialCoverage.vocabIds, getText: (item: { word: string }) => item.word },
    { label: '句块', items: materialUsageStats.totals.chunks, usedIds: materialCoverage.chunkIds, getText: (item: { text: string }) => item.text },
    { label: '句型', items: materialUsageStats.totals.patterns, usedIds: materialCoverage.patternIds, getText: (item: { pattern: string }) => item.pattern },
  ]
  const missingMaterialCount = materialGroups.reduce((sum, group) => sum + group.items.filter((item: any) => item.count === 0).length, 0)
  const totalMaterialCount =
    materialUsageStats.totals.vocabs.length
    + materialUsageStats.totals.chunks.length
    + materialUsageStats.totals.patterns.length
  const usedMaterialCount =
    materialCoverage.vocabIds.length
    + materialCoverage.chunkIds.length
    + materialCoverage.patternIds.length
  const coverageComplete = totalMaterialCount > 0 && missingMaterialCount === 0

  const validationItems: ValidationItem[] = [
    local.enabled
      ? { label: '启用状态', detail: '会进入学习端热身流程。', tone: 'ok' }
      : { label: '启用状态', detail: '当前停用，学习端不会展示。', tone: 'warn' },
    local.pipeline.length >= 3
      ? {
          label: '步骤数量',
          detail: local.pipeline.length <= 5
            ? '符合推荐 3-5 步。'
            : coverageComplete
              ? `${local.pipeline.length} 步，已覆盖材料池，可作为完整练习组。`
              : '超过推荐上限，建议先确认材料覆盖是否必要。',
          tone: local.pipeline.length <= 5 || coverageComplete ? 'ok' : 'warn',
        }
      : { label: '步骤数量', detail: '至少需要 3 个练习步骤。', tone: 'error' },
    totalPracticeItems >= 6
      ? {
          label: '题目总量',
          detail: totalPracticeItems <= 15
            ? '符合推荐 8-15 题附近。'
            : coverageComplete
              ? `${totalPracticeItems} 题，已覆盖当前材料池。`
              : '题量较大，建议拆分或精简。',
          tone: (totalPracticeItems >= 8 && totalPracticeItems <= 15) || coverageComplete ? 'ok' : 'warn',
        }
      : { label: '题目总量', detail: '最低需要 6 个输出条目。', tone: 'error' },
    totalMaterialCount === 0
      ? { label: '材料覆盖', detail: '当前话题还没有绑定单词、句块或句型。', tone: 'warn' }
      : coverageComplete
        ? { label: '材料覆盖', detail: `${usedMaterialCount}/${totalMaterialCount} 已覆盖。`, tone: 'ok' }
        : { label: '材料覆盖', detail: `${usedMaterialCount}/${totalMaterialCount} 已覆盖，还有 ${missingMaterialCount} 个材料未覆盖。`, tone: 'warn' },
    zhChunkItems >= 3
      ? { label: '中译英替换', detail: `${zhChunkItems} 题，满足核心输出要求。`, tone: 'ok' }
      : { label: '中译英替换', detail: '建议至少 3 题，作为第一步输出激活。', tone: 'error' },
    enChunkItems >= 2
      ? { label: '英译中检查', detail: `${enChunkItems} 题，满足理解检查要求。`, tone: 'ok' }
      : { label: '英译中检查', detail: '建议至少 2 题，用来确认能听懂/读懂。', tone: 'warn' },
    patternItems >= 2
      ? { label: '句型操练', detail: `${patternItems} 题，满足结构输出要求。`, tone: 'ok' }
      : { label: '句型操练', detail: '建议至少 2 题，补齐语法框架训练。', tone: 'warn' },
    singleItemSections === 0
      ? { label: '单题 section', detail: '没有单条目练习组。', tone: 'ok' }
      : { label: '单题 section', detail: `${singleItemSections} 组只有 1 个条目，建议扩到 2+。`, tone: 'error' },
  ]

  const validationTone = validationItems.some((item) => item.tone === 'error')
    ? 'error'
    : validationItems.some((item) => item.tone === 'warn')
      ? 'warn'
      : 'ok'

  const validationLabel = validationTone === 'ok' ? '结构合理' : validationTone === 'warn' ? '需要留意' : '需要补齐'
  const validationIssueCount = validationItems.filter((item) => item.tone !== 'ok').length
  const selectedIndex = local.pipeline.findIndex((item) => item.id === selectedItemId)
  const selectedItem = selectedIndex >= 0 ? local.pipeline[selectedIndex] : null
  const getItemMaterialStats = (itemId: string) => materialUsageStats.itemStats.find((stat) => stat.id === itemId)

  const renderItemForm = (item: WarmupPipelineItem, idx: number) => {
    const common = { key: item.id, onDelete: () => deleteItem(idx) }
    switch (item.type) {
      case 'chunk_substitution':
        return (
          <ChunkSubstitutionForm
            {...common}
            value={item}
            onChange={(v) => updateItem(idx, v)}
            vocabs={vocabs}
            chunks={chunks}
            generationContext={generationContext}
          />
        )
      case 'vocab_sentence_building':
        return (
          <VocabSentenceBuildingForm
            {...common}
            value={item}
            onChange={(v) => updateItem(idx, v)}
            vocabs={vocabs}
            chunks={chunks}
            generationContext={generationContext}
          />
        )
      case 'sentence_decomposition':
        return (
          <SentenceDecompositionForm
            {...common}
            value={item}
            onChange={(v) => updateItem(idx, v)}
            chunks={chunks}
            patterns={patterns}
            generationContext={generationContext}
          />
        )
      case 'pattern_drill':
        return (
          <PatternDrillForm
            {...common}
            value={item}
            onChange={(v) => updateItem(idx, v)}
            patterns={patterns}
            generationContext={generationContext}
          />
        )
    }
  }

  const renderMaterialPoolPopover = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
          <ListChecks className="size-3.5" />
          材料池
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[30rem] p-3" align="end" side="bottom">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">当前材料池与使用次数</p>
          <Badge variant="outline" className="text-[10px]">{difficulty || 'L2'}</Badge>
        </div>
        <div className="space-y-3">
          {materialGroups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium">{group.label}</p>
                <span className="text-[10px] text-muted-foreground">已用 {group.usedIds.length}/{group.items.length}</span>
              </div>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
                {group.items.length ? group.items.map((item: any) => {
                  const used = item.count > 0
                  return (
                    <Badge
                      key={item.id}
                      variant={used ? 'default' : 'outline'}
                      className={cn('max-w-full gap-1 truncate px-1.5 text-[10px]', !used && 'text-muted-foreground')}
                    >
                      <span className="truncate">{group.getText(item)}</span>
                      <span className="tabular-nums">x{item.count}</span>
                    </Badge>
                  )
                }) : (
                  <span className="text-[10px] text-muted-foreground">暂无</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )

  const renderItemMaterialPopover = (item: WarmupPipelineItem) => {
    const stats = getItemMaterialStats(item.id)
    const summary = [
      ...(stats?.vocabs ?? []).slice(0, 2).map((entry) => entry.word),
      ...(stats?.chunks ?? []).slice(0, 1).map((entry) => entry.text),
      ...(stats?.patterns ?? []).slice(0, 1).map((entry) => entry.pattern),
    ]
    const total = (stats?.vocabs.length ?? 0) + (stats?.chunks.length ?? 0) + (stats?.patterns.length ?? 0)

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mt-1 flex max-w-full items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            <BarChart3 className="size-3 shrink-0" />
            <span className="truncate">{summary.length ? summary.join(' / ') : '未匹配材料'}</span>
            {total > summary.length ? <span className="shrink-0">+{total - summary.length}</span> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start" side="right">
          <div className="space-y-2">
            {[
              ['单词', stats?.vocabs ?? [], (entry: any) => entry.word],
              ['句块', stats?.chunks ?? [], (entry: any) => entry.text],
              ['句型', stats?.patterns ?? [], (entry: any) => entry.pattern],
            ].map(([label, entries, getText]) => (
              <div key={label as string}>
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground">{label as string}</p>
                <div className="flex flex-wrap gap-1">
                  {(entries as any[]).length ? (entries as any[]).map((entry) => (
                    <Badge key={entry.id} variant="outline" className="max-w-full gap-1 truncate text-[10px]">
                      <span className="truncate">{(getText as (value: any) => string)(entry)}</span>
                      <span className="tabular-nums">x{entry.count}</span>
                    </Badge>
                  )) : (
                    <span className="text-[10px] text-muted-foreground">暂无匹配</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="mt-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{topicTitle?.trim() || '未命名话题'}</p>
            {typeof topicIndex === 'number' && topicTotal ? (
              <Badge variant="outline" className="text-[10px]">话题 {topicIndex + 1}/{topicTotal}</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalPracticeItems} 题 · {local.pipeline.length} 步 · {totalHintableItems} 题可生成 AI 提示
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {renderMaterialPoolPopover()}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            title="上一个话题"
            disabled={!onPrevTopic || aiGeneratingMissing || aiHintingAll || aiAudioAll}
            onClick={onPrevTopic}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            title="下一个话题"
            disabled={!onNextTopic || aiGeneratingMissing || aiHintingAll || aiAudioAll}
            onClick={onNextTopic}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            disabled={aiGeneratingMissing || aiHintingAll || aiAudioAll || missingMaterialCount === 0}
            onClick={generateMissingPracticeItems}
          >
            {aiGeneratingMissing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            全部 AI 生成{missingMaterialCount ? ` ${missingMaterialCount}` : ''}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={aiGeneratingMissing || aiHintingAll || aiAudioAll || totalHintableItems === 0}
            onClick={generateAllHints}
          >
            {aiHintingAll ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            全部 AI 提示
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={aiGeneratingMissing || aiHintingAll || aiAudioAll || totalPracticeItems === 0}
            onClick={() => compactDuplicates(true)}
          >
            <Scissors className="size-3.5" />
            去重压缩
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={aiGeneratingMissing || aiHintingAll || aiAudioAll}
            onClick={generateAllEnglishAudio}
          >
            {aiAudioAll ? <Loader2 className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
            全部 AI 音频
          </Button>
        </div>
      </div>

      <div className="grid h-[min(660px,calc(92vh-15rem))] min-h-[520px] gap-3 xl:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-lg border border-border/70 bg-background">
        <div className="border-b border-border/70 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-sm font-semibold">知识点练习</Label>
                <Badge variant={local.enabled ? 'default' : 'secondary'} className="gap-1 text-[10px]">
                  <Power className="size-3" />
                  {local.enabled ? '启用' : '停用'}
                </Badge>
              </div>
            </div>
            <Switch checked={local.enabled} onCheckedChange={(enabled) => commit({ enabled })} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {local.pipeline.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/10 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">还没有题目</p>
              <p className="mt-1 text-xs text-muted-foreground">从下方添加一种题型。</p>
            </div>
          ) : (
            <div className="space-y-1">
              {local.pipeline.map((item, idx) => {
                const active = item.id === selectedItemId
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'group rounded-md border bg-muted/10 transition-colors',
                      active ? 'border-primary/50 bg-primary/5' : 'border-border/70 hover:bg-muted/20',
                    )}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <span className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                        active ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground',
                      )}>
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1">
                          <span className="truncate text-xs font-medium">{item.title || typeLabel(item)}</span>
                          <Badge variant="outline" className="shrink-0 px-1.5 text-[10px]">{itemCountLabel(item)}</Badge>
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {typeLabel(item)}
                          {'direction' in item ? ` · ${item.direction === 'en_to_zh' ? '英→中' : '中→英'}` : ''}
                        </span>
                      </span>
                    </button>
                    <div className="border-t border-border/50 px-2 py-1">
                      {renderItemMaterialPopover(item)}
                    </div>
                    <div className="flex items-center justify-end gap-0.5 border-t border-border/50 px-1.5 py-0.5">
                      <Button variant="ghost" size="icon-sm" className="size-5" disabled={idx === 0} onClick={() => moveItem(idx, -1)}>
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="size-5" disabled={idx === local.pipeline.length - 1} onClick={() => moveItem(idx, 1)}>
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="size-5 text-destructive" onClick={() => deleteItem(idx)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/70 px-2 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">添加题型</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-5 text-muted-foreground">
                  <Info className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[26rem] p-2" align="start" side="bottom">
                <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-primary" />
                    <p className="text-xs font-semibold">推荐编排</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    至少 3 步，推荐 3-5 步；先中译英激活，再英译中检查，最后用句型操练、一词多句或句子拆解收束。
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {itemTypeOptions.map(({ type, label, description, icon: Icon }) => (
                    <div key={type} className="rounded-md border border-border/60 bg-muted/10 p-2">
                      <div className="flex items-center gap-1.5">
                        <Icon className="size-3.5 text-muted-foreground" />
                        <p className="text-xs font-semibold">{label}</p>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {itemTypeOptions.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                className="group flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-muted/10 px-2 text-left text-[11px] font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
                onClick={() => addItem(type)}
              >
                <Icon className="size-3 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <Plus className="size-3 text-muted-foreground transition-colors group-hover:text-primary" />
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/70 px-2 py-2">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ['步骤', `${local.pipeline.length}`],
              ['总题量', `${totalPracticeItems}`],
              ['校验', validationIssueCount ? `${validationIssueCount} 项` : 'OK'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border/60 bg-muted/10 px-2 py-1">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'mt-1.5 flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-muted/20',
                  validationTone === 'ok' && 'border-success/40 bg-success/5',
                  validationTone === 'warn' && 'border-warning/40 bg-warning/5',
                  validationTone === 'error' && 'border-destructive/40 bg-destructive/5',
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {validationTone === 'ok' ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle className={cn('size-3.5 shrink-0', validationTone === 'warn' ? 'text-warning' : 'text-destructive')} />
                  )}
                  <span className="truncate text-xs font-medium">{validationLabel}</span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="start" side="right">
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    ['中译英', `${zhChunkItems}`],
                    ['英译中', `${enChunkItems}`],
                    ['句型', `${patternItems}`],
                    ['拓展', `${vocabPatternGroups + decompositionLevels}`],
                    ['步骤', `${local.pipeline.length}`],
                    ['总题量', `${totalPracticeItems}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-muted/30 px-2 py-1">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-xs font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                {validationItems.map((item) => (
                  <div key={item.label} className="flex gap-2 rounded-md bg-muted/20 px-2 py-1.5">
                    {item.tone === 'ok' ? (
                      <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" />
                    ) : (
                      <AlertTriangle className={cn('mt-0.5 size-3 shrink-0', item.tone === 'warn' ? 'text-warning' : 'text-destructive')} />
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium leading-none">{item.label}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </aside>

      <section className="min-h-0 min-w-0">
        <Tabs defaultValue="exercise" className="flex h-full min-h-0 flex-col rounded-lg border border-border/70 bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{selectedItem ? selectedItem.title || '未命名练习' : '知识点练习'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedItem ? `${typeLabel(selectedItem)} · ${itemCountLabel(selectedItem)}` : '添加或选择一个练习组后在这里编辑。'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedItem && (
                <Badge variant="outline" className="text-[10px]">第 {selectedIndex + 1} 步</Badge>
              )}
              <TabsList className="h-8 bg-muted/50">
                <TabsTrigger value="exercise" className="h-7 px-3 text-xs">题目编辑</TabsTrigger>
                <TabsTrigger value="teaching" className="h-7 px-3 text-xs">教学文档</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="exercise" className="m-0 min-h-0 flex-1 overflow-y-auto p-4">
            {selectedItem ? (
              renderItemForm(selectedItem, selectedIndex)
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/10 px-6 py-14 text-center">
                <p className="text-sm font-medium">暂无选中的练习组</p>
                <p className="mt-1 text-xs text-muted-foreground">从左侧添加题型开始配置。</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="teaching" className="m-0 min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">教学文档</p>
                <p className="mt-0.5 text-xs text-muted-foreground">保存话题后，学习端会读取这份 Markdown。</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Tabs value={teachingMode} onValueChange={(value) => setTeachingMode(value as 'edit' | 'preview')}>
                  <TabsList className="h-8 bg-muted/50">
                    <TabsTrigger value="edit" className="h-7 px-3 text-xs">编辑</TabsTrigger>
                    <TabsTrigger value="preview" className="h-7 px-3 text-xs">预览</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  disabled={!onGenerateTeaching || teachingGenerating}
                  onClick={generateTeaching}
                >
                  {teachingGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  AI 生成
                </Button>
              </div>
            </div>
            <MarkdownEditor
              value={teachingMarkdown ?? ''}
              onChange={onTeachingMarkdownChange}
              height={360}
              preview={teachingMode}
              placeholder="这里可以维护话题级教学说明。"
            />
          </TabsContent>
        </Tabs>
      </section>
      </div>
    </div>
  )
}
