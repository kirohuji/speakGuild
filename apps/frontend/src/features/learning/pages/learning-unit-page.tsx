import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, BookText, MessageSquareText,
  Mic, Play, CheckCircle2, Target, ArrowRight,
  Quote,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { learningApi, type UnitDetail } from '../api/learning-api'
import { chunkApi } from '@/features/practice/api/english-practice-api'
import {
  LearningInsightDialog,
  type LearningInsightItem,
} from '@/features/practice/components/learning-insight-dialog'

export function LearningUnitPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [unit, setUnit] = useState<UnitDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Dialog 沉浸式学习
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogItems, setDialogItems] = useState<LearningInsightItem[]>([])
  const [dialogSection, setDialogSection] = useState<'vocab' | 'chunk' | 'pattern'>('vocab')

  // 记录已看
  const [seenVocabIds, setSeenVocabIds] = useState<Set<string>>(new Set())
  const [activatedChunkIds, setActivatedChunkIds] = useState<Set<string>>(new Set())
  const [seenPatternIds, setSeenPatternIds] = useState<Set<string>>(new Set())

  // 练习阶段
  const [practiceUnlocked, setPracticeUnlocked] = useState(false)

  useEffect(() => {
    if (!unitId) return
    setLoading(true)
    learningApi.getUnitDetail(unitId)
      .then(setUnit)
      .catch(() => setUnit(null))
      .finally(() => setLoading(false))
  }, [unitId])

  // 构建 dialog 数据
  const vocabDialogItems = useMemo<LearningInsightItem[]>(() =>
    (unit?.vocabularies ?? []).map((v) => ({
      kind: 'word' as const,
      id: v.id,
      word: v.word,
      meaning: v.meaning,
      sceneName: unit?.title,
    })), [unit])

  const chunkDialogItems = useMemo<LearningInsightItem[]>(() =>
    (unit?.chunks ?? []).map((c) => ({
      kind: 'chunk' as const,
      id: c.id,
      text: c.text,
      meaning: c.meaning,
      description: c.description,
      examples: c.examples,
      sceneName: unit?.title,
    })), [unit])

  const patternDialogItems = useMemo<LearningInsightItem[]>(() =>
    (unit?.sentencePatterns ?? []).map((sp) => ({
      kind: 'pattern' as const,
      id: sp.pattern,
      pattern: sp.pattern,
      meaning: sp.meaning,
      slots: sp.slots,
      example: sp.example,
      difficulty: sp.difficulty,
      sceneName: unit?.title,
    })), [unit])

  const allVocabCount = vocabDialogItems.length
  const allChunkCount = chunkDialogItems.length
  const allPatternCount = patternDialogItems.length
  const totalLearnItems = allVocabCount + allChunkCount + allPatternCount
  const completedLearnItems = seenVocabIds.size + activatedChunkIds.size + seenPatternIds.size

  // 打开 Dialog
  const openDialog = useCallback((
    section: 'vocab' | 'chunk' | 'pattern',
    items: LearningInsightItem[],
    startIndex: number,
  ) => {
    setDialogSection(section)
    setDialogItems(items)
    setDialogIndex(Math.min(startIndex, items.length - 1))
    setDialogOpen(true)
  }, [])

  // Dialog 关闭时标记已看
  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      for (const item of dialogItems) {
        if (item.kind === 'word' && item.id) {
          setSeenVocabIds((prev) => new Set(prev).add(item.id))
          // 更新后端进度
          if (unit && unitId) {
            learningApi.updateProgress(unitId, { vocabLearned: seenVocabIds.size + 1 }).catch(() => {})
          }
        }
        if (item.kind === 'chunk' && item.id) {
          setActivatedChunkIds((prev) => new Set(prev).add(item.id))
          chunkApi.activate(item.id).catch(() => {})
        }
        if (item.kind === 'pattern') {
          setSeenPatternIds((prev) => new Set(prev).add(item.id))
        }
      }
    }
    setDialogOpen(open)
  }, [dialogItems, unit, unitId, seenVocabIds])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>
  if (!unit) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Target className="size-12 text-muted-foreground/40" />
      <p className="text-muted-foreground">学习单元不存在</p>
      <Button variant="outline" asChild><Link to="/learning">返回学习计划</Link></Button>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* ===== Header ===== */}
      <div className="mb-5">
        <Link
          to="/learning"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          学习计划
        </Link>
        <h1 className="text-xl font-bold text-foreground">{unit.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{unit.location}</p>
      </div>

      {/* ===== 学习进度 ===== */}
      <div className="mb-6 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">学习进度</span>
          <span className="font-medium text-foreground">
            {seenVocabIds.size}/{allVocabCount} 词 · {activatedChunkIds.size}/{allChunkCount} 表达 · {seenPatternIds.size}/{allPatternCount} 句型
          </span>
        </div>
        <Progress
          value={totalLearnItems > 0 ? (completedLearnItems / totalLearnItems) * 100 : 0}
          className="mt-2 h-1.5"
        />
      </div>

      {/* ============================================ */}
      {/* ===== 阶段一：学习（点击打开沉浸式 Dialog） ===== */}
      {/* ============================================ */}

      {/* 场景词汇 */}
      {allVocabCount > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <BookText className="size-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-foreground">
              场景词汇
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {allVocabCount} 个 · 已看 {seenVocabIds.size}
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {unit.vocabularies.map((v, i) => (
              <button
                key={v.id}
                onClick={() => openDialog('vocab', vocabDialogItems, i)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all hover:shadow-sm',
                  seenVocabIds.has(v.id)
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-border bg-card hover:border-blue-500/40',
                )}
              >
                <p className="text-sm font-bold text-foreground">{v.word}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {seenVocabIds.has(v.id) ? v.meaning : '点我查看'}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 核心表达 */}
      {allChunkCount > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <MessageSquareText className="size-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-foreground">
              核心表达
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {allChunkCount} 个 · 已看 {activatedChunkIds.size}
              </span>
            </h2>
          </div>
          <div className="space-y-1.5">
            {unit.chunks.map((c, i) => (
              <button
                key={c.id}
                onClick={() => openDialog('chunk', chunkDialogItems, i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm',
                  activatedChunkIds.has(c.id)
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-border bg-card hover:border-purple-500/40',
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <MessageSquareText className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{c.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {activatedChunkIds.has(c.id) ? c.meaning : '点我查看'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 句型骨架 */}
      {allPatternCount > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <Quote className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">
              句型骨架
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {allPatternCount} 个 · 已看 {seenPatternIds.size}
              </span>
            </h2>
          </div>
          <div className="space-y-1.5">
            {unit.sentencePatterns.map((sp, i) => (
              <button
                key={i}
                onClick={() => openDialog('pattern', patternDialogItems, i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm',
                  seenPatternIds.has(sp.pattern)
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-border bg-card hover:border-amber-500/40',
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Quote className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono font-bold text-foreground">{sp.pattern}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {seenPatternIds.has(sp.pattern) ? sp.meaning : '点我查看'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ===== 分隔线 ===== */}
      <div className="relative my-8">
        <Separator />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3">
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {practiceUnlocked ? '练习阶段' : '学习完成即可练习'}
          </Badge>
        </div>
      </div>

      {/* ===== 阶段二：练习 ===== */}
      {!practiceUnlocked && (
        <div className="mb-6 text-center">
          <p className="text-sm text-muted-foreground">点击上方词汇和表达，在沉浸式弹窗中学习</p>
          {totalLearnItems > 0 && (
            <Progress value={(completedLearnItems / totalLearnItems) * 100} className="mx-auto mt-2 h-1 max-w-xs" />
          )}
          <Button className="mt-4" onClick={() => setPracticeUnlocked(true)}>
            我已看完，开始练习
            <ArrowRight className="ml-1 size-4" />
          </Button>
        </div>
      )}

      {practiceUnlocked && (
        <div className="space-y-3">
          {unit.trainingTopics.length > 0 && (
            <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
                  <Mic className="size-6 text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">开口练习</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {unit.trainingTopics.length} 个话题 · 用刚学的表达开口说
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate(`/practice/session/${unit.trainingTopics[0].id}`)}>
                  开始
                  <ArrowRight className="ml-1 size-3" />
                </Button>
              </CardContent>
            </Card>
          )}

          {unit.firstEpisode && (
            <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                  <Play className="size-6 text-green-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">剧本挑战</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {unit.firstEpisode.chapterTitle} — {unit.firstEpisode.title}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="border-green-500/30 text-green-600 hover:bg-green-500/10"
                  onClick={() => navigate(`/script/${unit.firstEpisode!.id}`)}>
                  挑战 <Play className="ml-1 size-3" />
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="pt-2 text-center">
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link to="/">返回首页</Link>
            </Button>
          </div>
        </div>
      )}

      {/* ===== 沉浸式学习 Dialog ===== */}
      <LearningInsightDialog
        items={dialogItems}
        index={dialogIndex}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onIndexChange={setDialogIndex}
      />
    </div>
  )
}
