import { useState, useEffect, useCallback } from 'react'
import { Plus, Zap, Loader2, GripVertical, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
    levels: [
      { level: 1, label: '核心句', en: '', zh: '', highlight: '', hint: '' },
    ],
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

  useEffect(() => { setLocal(value) }, [value])

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
        <div>
          <Label className="text-sm">知识点练习流水线</Label>
          <p className="text-xs text-muted-foreground mt-1">
            配置热身阶段的知识点练习题目，支持单词替换、一词多句、句子拆解三种题型。
          </p>
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
        <div className="space-y-4">
          {local.pipeline.map((item, idx) => (
            <div key={item.id} className="flex gap-2">
              {/* Order controls */}
              <div className="flex flex-col items-center gap-1 pt-3">
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
              {/* Form content */}
              <div className="flex-1 min-w-0">
                {renderItemForm(item, idx)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
