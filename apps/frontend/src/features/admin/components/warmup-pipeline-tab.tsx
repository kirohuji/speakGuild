import { useState, useEffect, useCallback } from 'react'
import { Plus, Zap, Loader2, GripVertical, Trash2, ChevronUp, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'

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
}

let _idCounter = Date.now()
const genId = () => `warmup_${++_idCounter}`

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

export function WarmupPipelineTab({ value, onChange, vocabs = [], chunks = [], patterns = [] }: Props) {
  const [local, setLocal] = useState<WarmupPipelineData>(value)
  // Track which items are collapsed (by id)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLocal(value)
    // Default all items to collapsed
    setCollapsedIds(new Set(value.pipeline.map((item) => item.id)))
  }, [value])

  const commit = (patch: Partial<WarmupPipelineData>) => {
    const next = { ...local, ...patch }
    setLocal(next)
    onChange(next)
  }

  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateItem = (idx: number, item: WarmupPipelineItem) => {
    const next = [...local.pipeline]
    next[idx] = item
    commit({ pipeline: next })
  }

  const deleteItem = (idx: number) => {
    commit({ pipeline: local.pipeline.filter((_, i) => i !== idx) })
  }

  const addItem = (type: WarmupPipelineItem['type']) => {
    let item: WarmupPipelineItem
    if (type === 'chunk_substitution') item = newChunkSubstitution()
    else if (type === 'vocab_sentence_building') item = newVocabSentenceBuilding()
    else if (type === 'sentence_decomposition') item = newSentenceDecomposition()
    else item = newPatternDrill()
    commit({ pipeline: [...local.pipeline, item] })
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...local.pipeline]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    commit({ pipeline: next })
  }

  const typeLabel = (item: WarmupPipelineItem) => {
    if (item.type === 'chunk_substitution') return item.kind === 'word' ? '单词替换' : '句块替换'
    if (item.type === 'vocab_sentence_building') return '一词多句'
    if (item.type === 'sentence_decomposition') return '句子拆解'
    return '句型操练'
  }

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
    <div className="mt-0 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <div>
            <Label className="text-sm">知识点练习流水线</Label>
            <p className="text-xs text-muted-foreground mt-1">
              配置热身阶段的知识点练习题目，支持四种题型，帮助学习者从不同维度攻克输出难点。
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground hover:text-foreground mt-0.5">
                <Info className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm" align="start" side="bottom">
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-sm">句块替换 / 单词替换</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <strong>解决：</strong>学习者知道单词意思但不会在句子中使用，"哑巴英语"的典型痛点。
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <strong>好处：</strong>通过中↔英双向替换训练，把孤立词汇变成可输出的句块，形成肌肉记忆。适合词汇量够但说不出口的学习者。
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="font-semibold text-sm">一词多句</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <strong>解决：</strong>一个词只会用一种句式表达，缺乏灵活变通能力，真实对话中遇到变体就卡壳。
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <strong>好处：</strong>围绕一个核心词汇，用多种句型搭配造句，训练"一词多表"能力。让学习者在不同场景下都能灵活调用同一词汇。
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="font-semibold text-sm">句子拆解</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <strong>解决：</strong>想表达复杂意思但只会说简单短句，英文思维"碎片化"，无法组织长句。
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <strong>好处：</strong>从核心句开始逐级添加修饰成分（地点/时间/原因），让学习者看清长句的"骨架"，从简单到复杂渐进式输出，降低认知负荷。
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="font-semibold text-sm">句型操练</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <strong>解决：</strong>语法规则背了不少，但无法在实际对话中快速套用，反应慢半拍。
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <strong>好处：</strong>固定句型框架 + 可变槽位，训练"句型即插即用"能力。大量重复操练形成自动化反应，对话时不再需要"翻译式"思考。
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addItem('chunk_substitution')}>
            <Plus className="size-3.5 mr-1" />句块替换
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addItem('vocab_sentence_building')}>
            <Plus className="size-3.5 mr-1" />一词多句
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addItem('sentence_decomposition')}>
            <Plus className="size-3.5 mr-1" />句子拆解
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addItem('pattern_drill')}>
            <Plus className="size-3.5 mr-1" />句型操练
          </Button>
        </div>
      </div>

      {/* Pipeline items */}
      {local.pipeline.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
          还没有配置任何练习题目。点击上方按钮添加。
        </div>
      ) : (
        <div className="space-y-3">
          {local.pipeline.map((item, idx) => {
            const isCollapsed = collapsedIds.has(item.id)
            return (
              <div key={item.id} className="flex gap-2">
                {/* Order controls — always visible */}
                <div className="flex flex-col items-center gap-1 pt-1.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, -1)}
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    disabled={idx === local.pipeline.length - 1}
                    onClick={() => moveItem(idx, 1)}
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </div>
                {/* Collapsible card */}
                <div className={cn(
                  'flex-1 min-w-0 rounded-lg border border-border/60 bg-muted/10',
                  !isCollapsed && 'pb-3',
                )}>
                  {/* Clickable header */}
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-muted/20 transition-colors rounded-t-lg"
                    onClick={() => toggleCollapse(item.id)}
                  >
                    <ChevronRight className={cn(
                      'size-3.5 text-muted-foreground shrink-0 transition-transform',
                      !isCollapsed && 'rotate-90',
                    )} />
                    <Badge variant="secondary" className="text-[10px] shrink-0">{typeLabel(item)}</Badge>
                    {'direction' in item && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{item.direction === 'en_to_zh' ? '英→中' : '中→英'}</Badge>
                    )}
                    <span className={cn('text-xs truncate flex-1', item.title ? 'font-medium' : 'text-muted-foreground')}>
                      {item.title || '未命名练习'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive size-6 shrink-0"
                      onClick={(e) => { e.stopPropagation(); deleteItem(idx) }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </button>
                  {/* Collapsible content */}
                  {!isCollapsed && (
                    <div className="px-3 pt-1 border-t border-border/30">
                      {renderItemForm(item, idx)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
