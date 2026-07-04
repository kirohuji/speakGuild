import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeftRight,
  AlertTriangle,
  Braces,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  FileText,
  Info,
  Layers,
  Loader2,
  Plus,
  Power,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'

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
}: Props) {
  const [local, setLocal] = useState<WarmupPipelineData>(value)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(value.pipeline[0]?.id ?? null)
  const [aiHintingAll, setAiHintingAll] = useState(false)
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
    const next = { ...local, ...patch }
    setLocal(next)
    onChange(next)
  }

  const updateItem = (idx: number, item: WarmupPipelineItem) => {
    const next = [...local.pipeline]
    next[idx] = item
    commit({ pipeline: next })
  }

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

  const validationItems: ValidationItem[] = [
    local.enabled
      ? { label: '启用状态', detail: '会进入学习端热身流程。', tone: 'ok' }
      : { label: '启用状态', detail: '当前停用，学习端不会展示。', tone: 'warn' },
    local.pipeline.length >= 3
      ? {
          label: '步骤数量',
          detail: local.pipeline.length <= 5 ? '符合推荐 3-5 步。' : '超过推荐上限，学习端会偏长。',
          tone: local.pipeline.length <= 5 ? 'ok' : 'warn',
        }
      : { label: '步骤数量', detail: '至少需要 3 个练习步骤。', tone: 'error' },
    totalPracticeItems >= 6
      ? {
          label: '题目总量',
          detail: totalPracticeItems <= 15 ? '符合推荐 8-15 题附近。' : '题量较大，建议拆分或精简。',
          tone: totalPracticeItems >= 8 && totalPracticeItems <= 15 ? 'ok' : 'warn',
        }
      : { label: '题目总量', detail: '最低需要 6 个输出条目。', tone: 'error' },
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
          />
        )
      case 'pattern_drill':
        return (
          <PatternDrillForm
            {...common}
            value={item}
            onChange={(v) => updateItem(idx, v)}
            patterns={patterns}
          />
        )
    }
  }

  return (
    <div className="mt-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-4 py-3">
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            title="上一个话题"
            disabled={!onPrevTopic || aiHintingAll}
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
            disabled={!onNextTopic || aiHintingAll}
            onClick={onNextTopic}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            disabled={aiHintingAll || totalHintableItems === 0}
            onClick={generateAllHints}
          >
            {aiHintingAll ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            全部 AI 提示
          </Button>
        </div>
      </div>

      <div className="grid min-h-[660px] gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border/70 bg-background">
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

        <div className="p-2">
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

        <div className="border-t border-border/70 px-2 py-2">
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

        <div className="border-t border-border/70 px-2 py-2">
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

      <section className="min-w-0">
        <div className="rounded-lg border border-border/70 bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{selectedItem ? selectedItem.title || '未命名练习' : '选择左侧题目'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedItem ? `${typeLabel(selectedItem)} · ${itemCountLabel(selectedItem)}` : '添加或选择一个练习组后在这里编辑。'}
              </p>
            </div>
            {selectedItem && (
              <Badge variant="outline" className="text-[10px]">第 {selectedIndex + 1} 步</Badge>
            )}
          </div>
          <div className="p-4">
            {selectedItem ? (
              renderItemForm(selectedItem, selectedIndex)
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/10 px-6 py-14 text-center">
                <p className="text-sm font-medium">暂无选中的练习组</p>
                <p className="mt-1 text-xs text-muted-foreground">从下方添加题型开始配置。</p>
              </div>
            )}
          </div>
        </div>
      </section>
      </div>
    </div>
  )
}
