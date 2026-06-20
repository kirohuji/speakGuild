import { useEffect, useMemo, useState, useCallback } from 'react'
import type React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BookOpen, BookText, Braces, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, ListChecks, ListMusic, MessageSquareText, Target,
  CheckCircle2, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
import type { UnitDetail } from '../api/learning-api'
import { learningPackService, learningRepository } from '@/lib/offline'
import { ChunkOutputDrillCard } from '@/features/practice/components/chunk-output-drill-card'
import { VocabOutputCard } from '@/features/practice/components/vocab-output-card'
import { PatternDrillCard } from '@/features/practice/components/pattern-drill-card'
import { SentenceDecompositionCard } from '@/features/practice/components/sentence-decomposition-card'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useWarmupSessionStore, type WarmupScore } from '@/stores/warmup-session.store'
import { TodayRecordsDrawer } from '../components/today-records-drawer'

// ── 类型 ──
type SimplePromptItem = { zh: string; answer?: string; hint?: string }
type VocabPromptItem = {
  vocabId: string
  promptZh: string
  targetWords?: string[]
  suggestedAnswer?: string
  hint?: string
}

export type PracticeItem = {
  id: string
  type: string
  label: string
  topicTitle: string
  /** 准确描述练习内容的标签，用于卡片和抽屉标题 */
  displayLabel: string
  /** Dialog header 大字展示的原始练习数据（单词/句型/句块） */
  headerContent: string
  render: () => React.ReactNode
}

type PracticeGroup = {
  type: string
  meta: { label: string; icon: typeof BookText; color: string }
  steps: Array<{ step: PracticeItem; index: number }>
  doneCount: number
  totalCount: number
}

// ── 工具函数 ──
function pickOne<T>(items: T[] | undefined): [T, number] | null {
  if (!items?.length) return null
  const idx = Math.floor(Math.random() * items.length)
  return [items[idx], idx]
}

function shuffle<T>(items: T[]) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** 在文本中高亮目标词（不区分大小写） */
function highlightWord(text: string, word: string): React.ReactNode {
  if (!word || !text) return text
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="rounded bg-blue-500/20 px-0.5 text-blue-600 dark:text-blue-400 font-semibold">{part}</mark>
      : part,
  )
}

// ── 类型显示映射 ──
const TYPE_META: Record<string, { label: string; icon: typeof BookText; color: string }> = {
  chunk_substitution: {
    label: '句块替换',
    icon: MessageSquareText,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-300',
  },
  vocab_drill: {
    label: '词汇输出',
    icon: BookText,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  },
  vocab_sentence_building: {
    label: '一词多句',
    icon: BookText,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  },
  pattern_drill: {
    label: '句型操练',
    icon: Braces,
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  },
  sentence_decomposition: {
    label: '句子拆解',
    icon: BookOpen,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
}

// ── 组件 ──
export function TodayTaskPage() {
  const dailyGoal = usePreferencesStore((s) => s.dailyGoal)
  const warmupStore = useWarmupSessionStore()

  // 数据
  const [unit, setUnit] = useState<UnitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 练习状态
  const [currentIdx, setCurrentIdx] = useState(0)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [runSeed, setRunSeed] = useState(() => Math.random())

  // 每次重新生成题目时重置
  useEffect(() => {
    warmupStore.clearSession()
    setDoneIds(new Set())
  }, [runSeed])

  const markDone = useCallback((stepId: string, _score: WarmupScore = 'strong') => {
    setDoneIds((prev) => {
      const next = new Set(prev)
      next.add(stepId)
      return next
    })
  }, [])

  const handleReshuffle = useCallback(() => {
    warmupStore.clearSession()
    setDoneIds(new Set())
    setCurrentIdx(0)
    setDrawerOpen(false)
    setRunSeed(Math.random())
  }, [warmupStore])

  // ── 加载数据 ──
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      learningPackService.listInstalled(),
      learningRepository.getCachedMyUnits().catch(() => []),
    ])
      .then(async ([packs, units]) => {
        if (cancelled) return

        const installedPacks = packs.filter((pack) => pack.status === 'installed')
        const currentPackId =
          units.find((u) => installedPacks.some((pack) => pack.packId === u.id))?.id ??
          installedPacks[0]?.packId

        if (!currentPackId) return null
        return learningRepository.getCachedUnitDetail(currentPackId)
      })
      .then((detail) => {
        if (!cancelled && detail) setUnit(detail)
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── 构建练习列表 ──
  const steps = useMemo<PracticeItem[]>(() => {
    if (!unit) return []

    const built: PracticeItem[] = []
    for (const topic of unit.trainingTopics ?? []) {
      const pipeline = topic.metadata?.outputTraining?.enabled
        ? (topic.metadata.outputTraining.pipeline ?? [])
        : []
      for (const item of pipeline) {
        const stepId = (suffix: string) => `today:${topic.id}:${item.id}:${suffix}`

        if (item.type === 'chunk_substitution') {
          const picked = pickOne<SimplePromptItem>((item.items ?? []) as SimplePromptItem[])
          if (!picked) continue
          const [sub, subIdx] = picked
          const sid = stepId(`${subIdx}`)
          const isWord = (item.kind ?? 'chunk') === 'word'
          built.push({
            id: sid,
            type: 'chunk_substitution',
            label: item.title || item.chunk || sub.zh || '短语练习',
            displayLabel: isWord ? '词汇替换' : '句块替换',
            headerContent: item.chunk || '',
            topicTitle: topic.title,
            render: () => (
              <ChunkOutputDrillCard
                chunk={{ text: item.chunk, meaning: item.chunkMeaning || '', description: null }}
                items={[sub]}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                kind={item.kind ?? 'chunk'}
                groupTitle={item.title}
                onComplete={(_idx, _passed, score) => markDone(sid, score)}
              />
            ),
          })
        } else if (item.type === 'vocab_drill') {
          const picked = pickOne<VocabPromptItem>((item.vocabs ?? []) as VocabPromptItem[])
          if (!picked) continue
          const [vocab, vocabIdx] = picked
          const sid = stepId(`${vocabIdx}`)
          built.push({
            id: sid,
            type: 'vocab_drill',
            label: item.title || vocab.targetWords?.join(', ') || '词汇练习',
            displayLabel: '词汇输出',
            headerContent: vocab.targetWords?.join(', ') || vocab.promptZh || '',
            topicTitle: topic.title,
            render: () => (
              <VocabOutputCard
                title={item.title || '词汇输出'}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                vocabs={[vocab]}
                onComplete={(_idx, _passed, score) => markDone(sid, score)}
                hideHeader
              />
            ),
          })
        } else if (item.type === 'vocab_sentence_building') {
          for (const [patternIdx, pattern] of ((item.patterns ?? []) as any[]).entries()) {
            const picked = pickOne<SimplePromptItem>((pattern.items ?? []) as SimplePromptItem[])
            if (!picked) continue
            const [sub, subIdx] = picked
            const sid = stepId(`pattern_${patternIdx}_${subIdx}`)
            const vocabWord = item.vocabWord || ''
            const patternChunk = pattern.chunk || vocabWord
            const targetWord = vocabWord || patternChunk
            built.push({
              id: sid,
              type: 'vocab_sentence_building',
              label: `${vocabWord || '词汇'} + ${patternChunk}`,
              displayLabel: '一词多句',
              headerContent: targetWord,
              topicTitle: topic.title,
              render: () => (
                <ChunkOutputDrillCard
                  chunk={{ text: targetWord, meaning: item.vocabMeaning || '', description: null }}
                  items={[sub]}
                  stepId={sid}
                  stepType="vocab_sentence_building"
                  direction={item.direction ?? 'zh_to_en'}
                  kind="word"
                  groupTitle={`${vocabWord || '一词多句'} · ${patternChunk}`}
                  onComplete={(_idx, _passed, score) => markDone(sid, score)}
                />
              ),
            })
          }
        } else if (item.type === 'pattern_drill') {
          const picked = pickOne<SimplePromptItem>((item.items ?? []) as SimplePromptItem[])
          if (!picked) continue
          const [sub, subIdx] = picked
          const sid = stepId(`${subIdx}`)
          built.push({
            id: sid,
            type: 'pattern_drill',
            label: item.title || item.pattern || '句型练习',
            displayLabel: '句型操练',
            headerContent: item.pattern || '',
            topicTitle: topic.title,
            render: () => (
              <PatternDrillCard
                pattern={item.pattern}
                patternMeaning={item.patternMeaning}
                items={[sub]}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                groupTitle={item.title}
                onComplete={(_idx, _passed, score) => markDone(sid, score)}
                hideHeader
              />
            ),
          })
        } else if (item.type === 'sentence_decomposition') {
          const sid = stepId('decomp')
          const title = item.title || '长句拆解'
          const headerContent = item.levels?.[0]?.en || item.fullSentence || title
          built.push({
            id: sid,
            type: 'sentence_decomposition',
            label: title,
            displayLabel: '句子拆解',
            headerContent,
            topicTitle: topic.title,
            render: () => (
              <SentenceDecompositionCard
                title={title}
                levels={item.levels}
                stepId={sid}
                onComplete={(_passed, score) => markDone(sid, score)}
                hideHeader
              />
            ),
          })
        }
      }
    }

    // 检查缺失的题型，为每种缺失类型添加占位卡片
    const allTypes = Object.keys(TYPE_META)
    const presentTypes = new Set(built.map((b) => b.type))
    const missingTypes = allTypes.filter((t) => !presentTypes.has(t))

    // 为缺失类型预留位置；真实题目先保证题型多样性，再随机补足
    const placeholderCount = missingTypes.length
    const realLimit = Math.max(1, dailyGoal - placeholderCount)
    const shuffledBuilt = shuffle(built)
    const byType = new Map<string, PracticeItem[]>()
    for (const step of shuffledBuilt) {
      byType.set(step.type, [...(byType.get(step.type) ?? []), step])
    }
    const limited: PracticeItem[] = []
    const selectedIds = new Set<string>()
    for (const type of Object.keys(TYPE_META)) {
      if (limited.length >= realLimit) break
      const firstOfType = byType.get(type)?.[0]
      if (!firstOfType) continue
      limited.push(firstOfType)
      selectedIds.add(firstOfType.id)
    }
    for (const step of shuffledBuilt) {
      if (limited.length >= realLimit) break
      if (selectedIds.has(step.id)) continue
      limited.push(step)
      selectedIds.add(step.id)
    }

    // 添加占位卡片
    for (const mt of missingTypes) {
      const meta = TYPE_META[mt]
      const Icon = meta?.icon ?? BookOpen
      limited.push({
        id: `placeholder:${mt}`,
        type: mt,
        label: '暂无题目',
        displayLabel: meta?.label ?? mt,
        headerContent: meta?.label ?? mt,
        topicTitle: '该题型未配置练习数据',
        render: () => (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Icon className="size-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">暂无{meta?.label ?? mt}练习题目</p>
            <p className="text-xs text-muted-foreground/60">请联系管理员在后台添加该题型</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => markDone(`placeholder:${mt}`, 'ok')}
            >
              <CheckCircle2 className="mr-1.5 size-4" />
              跳过，标记完成
            </Button>
          </div>
        ),
      })
    }

    return limited
  }, [dailyGoal, markDone, runSeed, unit])

  // ── 进度统计 ──
  const doneCount = steps.filter((s) => doneIds.has(s.id)).length
  const donePercent = steps.length > 0 ? (doneCount / steps.length) * 100 : 0

  const groupedSteps = useMemo<PracticeGroup[]>(() => {
    const order = new Map<string, PracticeGroup>()
    steps.forEach((step, index) => {
      const meta = TYPE_META[step.type] ?? {
        label: step.displayLabel || '知识点',
        icon: MessageSquareText,
        color: 'bg-primary/10 text-primary',
      }
      const group = order.get(step.type) ?? {
        type: step.type,
        meta,
        steps: [],
        doneCount: 0,
        totalCount: 0,
      }
      group.steps.push({ step, index })
      group.totalCount += 1
      if (doneIds.has(step.id)) group.doneCount += 1
      order.set(step.type, group)
    })
    return Array.from(order.values())
  }, [doneIds, steps])

  const openStepAt = useCallback((index: number) => {
    const step = steps[index]
    if (!step) return
    setCurrentIdx(index)
    if (step.id.startsWith('placeholder:')) {
      markDone(step.id, 'ok')
    } else {
      setDrawerOpen(true)
    }
  }, [markDone, steps])

  const openGroup = useCallback((group: PracticeGroup) => {
    const target = group.steps.find(({ step }) => !doneIds.has(step.id)) ?? group.steps[0]
    if (target) openStepAt(target.index)
  }, [doneIds, openStepAt])

  // ── 今日练习记录 ──
  const todayRecords = warmupStore.records

  // ── 导航 ──
  const currentStep = steps[currentIdx]
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < steps.length - 1
  const gotoPrev = useCallback(() => setCurrentIdx((p) => Math.max(0, p - 1)), [])
  const gotoNext = useCallback(() => setCurrentIdx((p) => Math.min(steps.length - 1, p + 1)), [steps.length])

  // ── 加载态 ──
  if (loading) return <MobilePageLoading rows={4} />

  // ── 空态 ──
  if (error || !unit || steps.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">
            {error || '今日要练习的学习包暂无可练习内容'}
          </p>
          <Button className="mt-4" asChild>
            <Link to="/learning">
              选择学习包
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // ── 当前练习类型信息 ──
  const currentMeta = TYPE_META[currentStep?.type] ?? {
    label: '知识点练习',
    icon: MessageSquareText,
    color: 'bg-primary/10 text-primary',
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* ── Header ── */}
      <div className="mb-3 flex items-center justify-between">
        <div />
        <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45 lg:hidden">
          <button
            type="button"
            onClick={(e) => { e.currentTarget.blur(); handleReshuffle() }}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
            aria-label="换一批题目"
          >
            <RefreshCw className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.currentTarget.blur(); setRecordsOpen(true) }}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
            aria-label="练习记录"
          >
            <ClipboardList className="size-[18px]" />
          </button>
        </div>
      </div>

      {/* ── 进度条 ── */}
      <div className="mb-5 rounded-lg bg-muted/30 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">今日进度</p>
          </div>
          <Badge variant="secondary" className="h-6 rounded-full px-2 text-[10px]">
            {doneCount}/{steps.length} 题
          </Badge>
        </div>
        <Progress value={donePercent} className="h-1.5" />
      </div>

      {/* ── 练习卡片列表 ── */}
      <div className="space-y-2.5">
        {groupedSteps.map((group) => {
          const Icon = group.meta.icon
          const isDone = group.doneCount === group.totalCount
          const examples = group.steps
            .map(({ step }) => step.headerContent || step.label)
            .filter(Boolean)
            .slice(0, 3)

          return (
            <Card
              key={group.type}
              className={cn(
                'cursor-pointer border-0 bg-muted/30 shadow-none transition-all active:scale-[0.98]',
                isDone && 'opacity-60',
              )}
              onClick={() => openGroup(group)}
            >
              <CardContent className="flex items-start gap-3 p-3.5">
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', group.meta.color)}>
                  {isDone ? <CheckCircle2 className="size-5 text-green-500" /> : <Icon className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className={cn('truncate text-sm font-semibold', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                      {group.meta.label}
                    </p>
                    <Badge variant={isDone ? 'default' : 'secondary'} className="h-5 shrink-0 rounded-full px-2 text-[10px]">
                      {group.doneCount}/{group.totalCount}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {examples.join(' · ') || `${group.totalCount} 道练习`}
                  </p>
                  {group.totalCount > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {group.steps.slice(0, 4).map(({ step }, itemIndex) => (
                        <span
                          key={step.id}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px]',
                            doneIds.has(step.id)
                              ? 'bg-green-500/10 text-green-600 dark:text-green-300'
                              : 'bg-background/70 text-muted-foreground',
                          )}
                        >
                          {itemIndex + 1}
                        </span>
                      ))}
                      {group.totalCount > 4 && (
                        <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                          +{group.totalCount - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground/60" />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── 今日话题快捷入口 ── */}
      {unit && (unit.trainingTopics ?? []).length > 0 && (
        <>
          <Separator className="my-6" />
          <section>
            {/* <div className="mb-3 flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">今日话题</h2>
              <span className="text-xs text-muted-foreground">快捷练习入口</span>
            </div> */}
            <div className="space-y-1.5">
              {(unit.trainingTopics ?? []).map((topic, index) => (
                <Link
                  key={topic.id}
                  to={`/practice/session/${topic.id}`}
                  className="flex items-center gap-3 rounded-lg bg-muted/25 px-3 py-3 transition-colors hover:bg-muted/50 active:scale-[0.98]"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{topic.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {topic.activeChunks?.length ?? 0} 表达 · {Math.max(1, Math.round(topic.suggestedDurationSec / 60))} 分钟
                    </p>
                    <div className="mt-1">
                      <Badge variant="secondary" className="rounded-full text-[10px]">{unit.title}</Badge>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px]">{topic.difficulty}</Badge>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── 练习 Dialog（与 LearningInsightDialog 完全统一）── */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="!z-[10000] h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 pt-safe md:h-[88vh] md:max-w-3xl md:rounded-2xl md:pt-0 [&>button]:hidden">
          <DialogTitle className="sr-only">
            {currentStep?.displayLabel || currentMeta.label} · {currentStep?.topicTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {currentStep?.label}
          </DialogDescription>

          <div className="flex h-full flex-col">
            {/* Header：Badge 标识题型，大字展示练习内容 */}
            <div className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-9 md:px-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {(() => { const Icon = currentMeta.icon; return <Icon className="size-[18px]" /> })()}
                </div>
                <div className="w-0 flex-1 overflow-hidden">
                  <Badge variant="secondary" className="mb-1.5">{currentMeta.label}</Badge>
                  <h2 className="truncate text-lg font-bold leading-tight text-foreground">
                    {currentStep?.headerContent || currentStep?.label}
                  </h2>
                  <p className="truncate mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {currentStep?.topicTitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 md:px-6">
              <div key={currentStep?.id} className="min-h-full">
                {currentStep?.render()}
              </div>
            </div>

            {/* Bottom nav */}
            <div className={cn('flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3', isIOS() && 'pb-safe')}>
              <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev} className="gap-1">
                <ChevronLeft className="size-4" />
                <span className="ml-1">上一题</span>
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {currentIdx + 1} / {steps.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={gotoNext} disabled={!hasNext} className="gap-1">
                  <span className="mr-1">下一题</span>
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPlaylistOpen(true)}
                  title="题目列表"
                >
                  <ListMusic className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 题目列表 Drawer ── */}
      <Drawer open={playlistOpen} onOpenChange={setPlaylistOpen}>
        <DrawerContent className="h-[100dvh] rounded-none pt-safe">
          <div className="flex items-center justify-between px-5 py-3">
            <DrawerTitle className="text-lg">今日练习</DrawerTitle>
            <button
              type="button"
              onClick={() => setPlaylistOpen(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-4 pb-8">
            <div className="space-y-1">
              {groupedSteps.map((group) => {
                const isActive = group.steps.some(({ index }) => index === currentIdx)
                const isDone = group.doneCount === group.totalCount
                const Icon = group.meta.icon
                return (
                  <button
                    key={group.type}
                    type="button"
                    onClick={() => { openGroup(group); setPlaylistOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{group.meta.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{group.doneCount}/{group.totalCount} 题完成</p>
                    </div>
                    {isDone && <CheckCircle2 className="size-4 shrink-0 text-green-500" />}
                    {isActive && <Badge variant="default" className="px-1.5 py-0 text-[10px]">当前</Badge>}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* ── 练习记录 Drawer ── */}
      <TodayRecordsDrawer
        open={recordsOpen}
        onOpenChange={setRecordsOpen}
        records={todayRecords}
        steps={steps}
        onReplay={(idx) => { setCurrentIdx(idx); setRecordsOpen(false); setDrawerOpen(true) }}
      />
    </div>
  )
}
