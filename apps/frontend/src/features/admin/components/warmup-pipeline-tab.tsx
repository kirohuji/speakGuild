import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeftRight,
  Braces,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Info,
  Layers,
  Plus,
  Power,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
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
  const initializedRef = useRef(false)
  // Track previous pipeline ID set to detect structural changes (new topic opened, items added/removed)
  const prevIdsRef = useRef<string>('')

  useEffect(() => {
    setLocal(value)
    const newIds = new Set(value.pipeline.map(item => item.id))
    const currentIds = [...newIds].sort().join(',')
    // On initial load or when pipeline structure changes, collapse all
    if (!initializedRef.current) {
      initializedRef.current = true
      prevIdsRef.current = currentIds
      setCollapsedIds(newIds)
    } else if (currentIds !== prevIdsRef.current) {
      // Only add newly added items to collapsed set
      prevIdsRef.current = currentIds
      setCollapsedIds(prev => {
        const next = new Set(prev)
        for (const id of newIds) next.add(id)
        return next
      })
    }
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

  const itemCountLabel = (item: WarmupPipelineItem) => {
    if ('items' in item) return `${item.items.length} 题`
    if (item.type === 'vocab_sentence_building') {
      const count = item.patterns.reduce((sum, pattern) => sum + pattern.items.length, 0)
      return `${count} 题`
    }
    if (item.type === 'sentence_decomposition') return `${item.levels.length} 层`
    return '未配置'
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
    <div className="mt-0 space-y-5">
      <div className="rounded-lg border border-border/70 bg-background">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm font-semibold">知识点练习流水线</Label>
              <Badge variant={local.enabled ? 'default' : 'secondary'} className="gap-1 text-[10px]">
                <Power className="size-3" />
                {local.enabled ? '已启用' : '已停用'}
              </Badge>
              <Badge variant="outline" className="text-[10px]">v{local.version || 1}</Badge>
              <Badge variant="outline" className="text-[10px]">{local.pipeline.length} 组练习</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              配置热身阶段的知识点练习。保存话题后会作为 metadata.outputTraining 写入，不会影响基础提示和 Ink 绑定。
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">启用</span>
            <Switch checked={local.enabled} onCheckedChange={(enabled) => commit({ enabled })} />
          </div>
        </div>

        <div className="grid gap-2 p-3 md:grid-cols-4">
          {itemTypeOptions.map(({ type, label, description, icon: Icon }) => (
            <button
              key={type}
              type="button"
              className="group rounded-md border border-border/70 bg-muted/10 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              onClick={() => addItem(type)}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="flex size-8 items-center justify-center rounded-md bg-background text-muted-foreground transition-colors group-hover:text-primary">
                  <Icon className="size-4" />
                </span>
                {label}
                <Plus className="ml-auto size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          每一组练习都会在学习端按顺序出现。建议一个话题保持 3-6 组，先句块替换，再一词多句或句型操练，最后用句子拆解收束。
        </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-[11px] text-muted-foreground hover:text-foreground">
                查看题型说明
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm" align="end" side="bottom">
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

      {local.pipeline.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background/60 px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">还没有配置练习题目</p>
          <p className="mt-1 text-xs text-muted-foreground">从上方选择一种题型添加，新增项会默认折叠，展开后编辑具体题目。</p>
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
                <div className={cn(
                  'flex-1 min-w-0 rounded-lg border border-border/60 bg-background shadow-sm',
                  isCollapsed && 'bg-muted/10',
                  !isCollapsed && 'pb-3',
                )}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-t-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
                    onClick={() => toggleCollapse(item.id)}
                  >
                    <ChevronRight className={cn(
                      'size-3.5 text-muted-foreground shrink-0 transition-transform',
                      !isCollapsed && 'rotate-90',
                    )} />
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{typeLabel(item)}</Badge>
                    {'direction' in item && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">{item.direction === 'en_to_zh' ? '英→中' : '中→英'}</Badge>
                    )}
                    <Badge variant="outline" className="shrink-0 text-[10px]">{itemCountLabel(item)}</Badge>
                    <span className={cn('min-w-0 flex-1 truncate text-xs', item.title ? 'font-medium' : 'text-muted-foreground')}>
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
