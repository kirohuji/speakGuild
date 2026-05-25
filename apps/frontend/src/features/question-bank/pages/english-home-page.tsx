import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen, Play, Library, TrendingUp, Sparkles, Mic, Target,
  ListChecks, ChevronRight, ArrowRight, BookText, MessageSquareText,
  CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import api from '@/features/practice/api/english-practice-api'
import { chunkApi } from '@/features/practice/api/english-practice-api'
import { learningApi, type TodayPlan, type UnitDetail } from '@/features/learning/api/learning-api'
import {
  LearningInsightDialog,
  type LearningInsightItem,
} from '@/features/practice/components/learning-insight-dialog'

interface QuickStats {
  userLevel: number; totalXp: number; xpForNextLevel: number
  outputLevel: string; outputLevelDescription: string
  totalChunks: number; masteredChunks: number
}

export function EnglishHomePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(true)

  // Dialog 沉浸式学习
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogItems, setDialogItems] = useState<LearningInsightItem[]>([])

  // 追踪用户在首页已查看的词汇和 Chunk
  const [seenVocabIds, setSeenVocabIds] = useState<Set<string>>(new Set())
  const [seenChunkIds, setSeenChunkIds] = useState<Set<string>>(new Set())
  const [fullUnit, setFullUnit] = useState<UnitDetail | null>(null)

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return }

    Promise.all([
      api.get('/level/overview').then((res: any) => {
        const data = res?.data ?? res
        if (data?.outputLevel) setStats(data)
      }).catch(() => {}),
      learningApi.getTodayTasks().then(setTodayPlan).catch(() => setTodayPlan(null)),
    ]).finally(() => setLoading(false))
  }, [session])

  // 从今日任务中提取词汇和 Chunk 数据
  const vocabTask = todayPlan?.tasks.find((t) => t.type === 'vocab')
  const chunkTask = todayPlan?.tasks.find((t) => t.type === 'chunk')
  const practiceTask = todayPlan?.tasks.find((t) => t.type === 'practice')
  const scriptTask = todayPlan?.tasks.find((t) => t.type === 'script')

  // 默认只展示今日限额内的卡片
  const shownVocabItems = vocabTask?.data ?? []
  // 如果用户点击了"查看更多"，从全量详情中取所有词汇
  const [expandedVocabItems, setExpandedVocabItems] = useState<any[]>([])
  const [expandedChunkItems, setExpandedChunkItems] = useState<any[]>([])

  const handleShowAllVocab = useCallback(async () => {
    if (showAllVocab) { setShowAllVocab(false); return }
    if (expandedVocabItems.length > 0) { setShowAllVocab(true); return }
    // 首次展开，加载全量
    const unitId = vocabTask?.unitId
    if (!unitId) return
    try {
      const unit = await learningApi.getUnitDetail(unitId)
      if (unit) {
        setFullUnit(unit)
        setExpandedVocabItems(unit.vocabularies)
        setShowAllVocab(true)
      }
    } catch {}
  }, [showAllVocab, expandedVocabItems, vocabTask])

  const handleShowAllChunk = useCallback(async () => {
    if (showAllChunk) { setShowAllChunk(false); return }
    if (expandedChunkItems.length > 0) { setShowAllChunk(true); return }
    const unitId = chunkTask?.unitId
    if (!unitId) return
    try {
      const unit = await learningApi.getUnitDetail(unitId)
      if (unit) {
        setFullUnit(unit)
        setExpandedChunkItems(unit.chunks)
        setShowAllChunk(true)
      }
    } catch {}
  }, [showAllChunk, expandedChunkItems, chunkTask])

  const displayVocabItems = showAllVocab ? expandedVocabItems : shownVocabItems
  const displayChunkItems = showAllChunk ? expandedChunkItems : (chunkTask?.data ?? [])

  // 打开 Dialog 学习词汇
  const openVocabDialog = useCallback((startIndex: number) => {
    const items: LearningInsightItem[] = shownVocabItems.map((v: any) => ({
      kind: 'word' as const,
      id: v.id ?? v.word ?? '',
      word: v.word ?? '',
      meaning: v.meaning ?? '',
      sceneName: vocabTask?.unitTitle,
    }))
    setDialogItems(items)
    setDialogIndex(Math.min(startIndex, items.length - 1))
    setDialogOpen(true)
  }, [shownVocabItems, vocabTask])

  // 打开 Dialog 学习 Chunk
  const openChunkDialog = useCallback((startIndex: number) => {
    const items: LearningInsightItem[] = (chunkTask?.data ?? []).map((c: any) => ({
      kind: 'chunk' as const,
      id: c.id ?? c.text ?? '',
      text: c.text ?? '',
      meaning: c.meaning ?? '',
      sceneName: chunkTask?.unitTitle,
    }))
    setDialogItems(items)
    setDialogIndex(Math.min(startIndex, items.length - 1))
    setDialogOpen(true)
  }, [chunkTask])

  // 标记 Chunk 已看
  const markChunkActivated = useCallback(async (chunkId: string) => {
    if (seenChunkIds.has(chunkId)) return
    setSeenChunkIds((prev) => new Set(prev).add(chunkId))
    try { await chunkApi.activate(chunkId) } catch {}
  }, [seenChunkIds])

  // Dialog 关闭时，标记所有展示过的词/Chunk 为已看
  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      // 标记 dialog 中所有 word 为已看
      for (const item of dialogItems) {
        if (item.kind === 'word' && item.id) setSeenVocabIds((prev) => new Set(prev).add(item.id))
        if (item.kind === 'chunk' && item.id) {
          setSeenChunkIds((prev) => new Set(prev).add(item.id))
          markChunkActivated(item.id)
        }
      }
    }
    setDialogOpen(open)
  }, [dialogItems, markChunkActivated])

  const allVocabSeen = shownVocabItems.length > 0 && shownVocabItems.every((v) => seenVocabIds.has(v.id ?? ''))
  const allChunkSeen = (chunkTask?.data ?? []).length > 0 && (chunkTask?.data ?? []).every((c) => seenChunkIds.has(c.id ?? ''))

  const xpPercent = stats
    ? Math.min(100, Math.round((stats.totalXp % (stats.xpForNextLevel || 100)) / (stats.xpForNextLevel || 100) * 100))
    : 0

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-6 h-20 w-full rounded-xl" />
        <Skeleton className="mb-4 h-32 w-full rounded-xl" />
        <Skeleton className="mb-4 h-32 w-full rounded-xl" />
      </div>
    )
  }

  // 未登录
  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pb-24 pt-20 text-center">
        <BookOpen className="mb-4 size-16 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold text-foreground">GuideReady</h1>
        <p className="mt-2 text-muted-foreground">多语种导游资格面试练习平台</p>
        <Button className="mt-6" asChild><Link to="/auth/login">登录 / 注册</Link></Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* ===== 顶部：问候 + 等级 ===== */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            👋 {session?.user?.name ?? '同学'}
          </h1>
          {todayPlan?.currentUnit && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              正在学习：{todayPlan.currentUnit.title}
            </p>
          )}
        </div>
        {stats && (
          <Link to="/growth" className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 transition-colors hover:bg-muted">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Lv.{stats.userLevel}</span>
            <ChevronRight className="size-3 text-muted-foreground" />
          </Link>
        )}
      </div>

      {/* ===== 今日词汇（最多2个，点击打开 Dialog） ===== */}
      {shownVocabItems.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookText className="size-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-foreground">今日词汇</h2>
              <Badge variant="secondary" className="text-[10px]">
                {seenVocabIds.size}/{vocabTask?.count ?? shownVocabItems.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {allVocabSeen && <CheckCircle2 className="size-4 text-green-500" />}
              {(vocabTask?.count ?? 0) > 2 && (
                <button
                  onClick={() => openVocabDialog(0)}
                  className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  共 {vocabTask?.count} 个 <ChevronRight className="size-3" />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {shownVocabItems.slice(0, 2).map((item: any, i: number) => (
              <button
                key={item.id ?? item.word}
                onClick={() => openVocabDialog(i)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all hover:shadow-sm',
                  seenVocabIds.has(item.id ?? '')
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-border bg-card hover:border-blue-500/40',
                )}
              >
                <p className="text-sm font-bold text-foreground">{item.word}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {seenVocabIds.has(item.id ?? '') ? item.meaning : '点我查看详情'}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ===== 今日表达（点击打开 Dialog） ===== */}
      {(chunkTask?.data ?? []).length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-purple-500" />
              <h2 className="text-sm font-semibold text-foreground">今日表达</h2>
              <Badge variant="secondary" className="text-[10px]">
                {seenChunkIds.size}/{chunkTask?.count ?? (chunkTask?.data ?? []).length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {allChunkSeen && <CheckCircle2 className="size-4 text-green-500" />}
              {(chunkTask?.count ?? 0) > 0 && (
                <button
                  onClick={() => openChunkDialog(0)}
                  className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  共 {chunkTask?.count} 个 <ChevronRight className="size-3" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            {(chunkTask?.data ?? []).slice(0, 1).map((item: any, i: number) => (
              <button
                key={item.id ?? item.text}
                onClick={() => openChunkDialog(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm',
                  seenChunkIds.has(item.id ?? '')
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-border bg-card hover:border-purple-500/40',
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <MessageSquareText className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {seenChunkIds.has(item.id ?? '') ? item.meaning : '点我查看详情'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ===== 沉浸式学习 Dialog ===== */}
      <LearningInsightDialog
        items={dialogItems}
        index={dialogIndex}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onIndexChange={setDialogIndex}
      />

      {/* ===== 今日练习（词汇和 Chunk 都看过之后才出现） ===== */}
      {practiceTask && (
        <section className="mb-5">
          <Card className={cn(
            'transition-all',
            (!allVocabSeen || !allChunkSeen) && 'opacity-50',
          )}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-full',
                allVocabSeen && allChunkSeen ? 'bg-orange-500/20' : 'bg-muted',
              )}>
                <Mic className={cn(
                  'size-6',
                  allVocabSeen && allChunkSeen ? 'text-orange-500' : 'text-muted-foreground',
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {allVocabSeen && allChunkSeen ? '开始今天的口语练习' : '先学完词汇和表达'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {practiceTask.topicTitle ?? practiceTask.description}
                  {practiceTask.durationSec && ` · ${Math.round(practiceTask.durationSec / 60)} 分钟`}
                </p>
              </div>
              <Button
                size="sm"
                disabled={!allVocabSeen || !allChunkSeen}
                onClick={() => practiceTask.topicId && navigate(`/practice/session/${practiceTask.topicId}`)}
              >
                开始
                <ArrowRight className="ml-1 size-3" />
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ===== 剧本挑战 ===== */}
      {scriptTask && (
        <section className="mb-5">
          <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                <Play className="size-6 text-green-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">剧本挑战</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {scriptTask.episodeTitle ?? scriptTask.description}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-green-500/30 text-green-600 hover:bg-green-500/10"
                onClick={() => scriptTask.episodeId && navigate(`/script/${scriptTask.episodeId}`)}
              >
                挑战
                <Play className="ml-1 size-3" />
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ===== 无今日任务时的空白状态 ===== */}
      {(!todayPlan || todayPlan.tasks.length === 0) && (
        <div className="mb-6 flex flex-col items-center py-8 text-center">
          <Target className="mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">今天没有学习任务</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/learning">浏览学习材料</Link>
          </Button>
        </div>
      )}

      {/* ===== 快速导航 ===== */}
      <Separator className="mb-4" />
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: '学习计划', icon: BookOpen, path: '/learning', desc: '全部教材' },
          { label: '今日任务', icon: ListChecks, path: '/today', desc: '任务清单' },
          { label: '剧本挑战', icon: Play, path: '/script', desc: '剧情闯关' },
          { label: '我的学习库', icon: Library, path: '/expressions', desc: '沉淀内容' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.path} to={item.path}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-col items-center gap-1.5 p-3">
                  <Icon className="size-5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* ===== 底部成长入口 ===== */}
      {stats && (
        <div className="mt-4">
          <Link to="/growth">
            <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
              <TrendingUp className="size-4" />
              Lv.{stats.userLevel} · {stats.masteredChunks}/{stats.totalChunks} Chunk · {stats.totalXp} XP
              <ChevronRight className="size-3" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}


