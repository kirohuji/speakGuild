import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen, Play, Library, TrendingUp, Sparkles, Mic, Target,
  ListChecks, ChevronRight, ArrowRight, BookText, MessageSquareText,
  CheckCircle2,
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
import { learningApi, type TodayPlan } from '@/features/learning/api/learning-api'
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
  const practiceTasks = todayPlan?.tasks.filter((t) => t.type === 'practice') ?? []

  // 今日词汇/表达数据
  const shownVocabItems = vocabTask?.data ?? []

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
        </div>
        {stats && (
          <Link to="/growth" className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 transition-colors hover:bg-muted">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Lv.{stats.userLevel}</span>
            <ChevronRight className="size-3 text-muted-foreground" />
          </Link>
        )}
      </div>

      {/* ===== 正在学习卡片（含词汇/表达预习） ===== */}
      {todayPlan?.currentUnit && (() => {
        const unit = todayPlan.currentUnit
        const p = unit.progress
        const totalItems = p ? p.vocabTotal + p.chunkTotal + p.practiceTotal : 0
        const completedItems = p ? p.vocabLearned + p.chunkMastered + p.completedPractice : 0
        const overallPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

        return (
          <Card
            className="mb-5 border-blue-500/30 bg-gradient-to-br from-blue-500/[0.04] to-transparent transition-colors hover:bg-blue-500/[0.08]"
          >
            <CardContent className="p-4">
              {/* 头部：图标 + 标题 + 地点 */}
              <div
                className="flex cursor-pointer items-center gap-4"
                onClick={() => navigate(`/learning/units/${unit.id}`)}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                  <BookOpen className="size-5 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{unit.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{unit.location}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>

              {/* 进度 */}
              {p && totalItems > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Progress value={overallPercent} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground">{overallPercent}%</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>词汇 {p.vocabLearned}/{p.vocabTotal}</span>
                    <span>表达 {p.chunkMastered}/{p.chunkTotal}</span>
                    <span>练习 {p.completedPractice}/{p.practiceTotal}</span>
                  </div>
                </div>
              )}

              {/* 预习材料：词汇 */}
              {shownVocabItems.length > 0 && (
                <div className="mt-3 border-t border-blue-500/10 pt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <BookText className="size-3.5 text-blue-500" />
                      需要掌握的词汇
                      <span className="text-[10px] text-muted-foreground/60">
                        ({seenVocabIds.size}/{vocabTask?.count ?? shownVocabItems.length})
                      </span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); openVocabDialog(0) }} className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-600">
                      预习 <ChevronRight className="size-3" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {shownVocabItems.slice(0, 6).map((item: any) => (
                      <button key={item.id ?? item.word} onClick={(e) => { e.stopPropagation(); openVocabDialog(0) }}
                        className={cn('rounded-md border px-2 py-0.5 text-xs transition-colors',
                          seenVocabIds.has(item.id ?? '')
                            ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                            : 'border-border bg-background text-muted-foreground hover:border-blue-500/40 hover:text-foreground',
                        )}>
                        {item.word}
                      </button>
                    ))}
                    {(vocabTask?.count ?? 0) > 6 && <span className="text-xs text-muted-foreground">+{vocabTask!.count! - 6}</span>}
                  </div>
                </div>
              )}

              {/* 预习材料：Chunk */}
              {(chunkTask?.data ?? []).length > 0 && (
                <div className="mt-3 border-t border-purple-500/10 pt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MessageSquareText className="size-3.5 text-purple-500" />
                      需要掌握的表达
                      <span className="text-[10px] text-muted-foreground/60">
                        ({seenChunkIds.size}/{chunkTask?.count ?? (chunkTask?.data ?? []).length})
                      </span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); openChunkDialog(0) }} className="flex items-center gap-0.5 text-xs text-purple-500 hover:text-purple-600">
                      预习 <ChevronRight className="size-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {(chunkTask?.data ?? []).slice(0, 3).map((item: any) => (
                      <button key={item.id ?? item.text} onClick={(e) => { e.stopPropagation(); openChunkDialog(0) }}
                        className={cn('flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors',
                          seenChunkIds.has(item.id ?? '')
                            ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                            : 'border-border bg-background text-muted-foreground hover:border-purple-500/40 hover:text-foreground',
                        )}>
                        <span className="font-medium text-foreground">{item.text}</span>
                        {!seenChunkIds.has(item.id ?? '') && <span className="text-muted-foreground/60">— {item.meaning}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* ============================================== */}
      {/* ===== 今日练习 ===== */}
      {/* ============================================== */}

      {/* 练习话题列表 */}
      {practiceTasks.length > 0 ? (
        <section className="mb-5 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Mic className="size-4 text-orange-500" />
            今日练习 ({practiceTasks.length})
          </h2>
          {practiceTasks.map((task) => (
            <Card key={task.id}
              className="cursor-pointer border-orange-500/30 bg-gradient-to-br from-orange-500/[0.04] to-transparent transition-colors hover:bg-orange-500/[0.08]"
              onClick={() => task.topicId && navigate(`/practice/session/${task.topicId}`)}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
                  <Mic className="size-5 text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{task.topicTitle ?? task.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{task.promptZh ?? task.description}</p>
                  {task.durationSec && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">建议 {Math.round(task.durationSec / 60)} 分钟</p>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <div className="mb-6 flex flex-col items-center py-8 text-center">
          <Target className="mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">今天没有练习任务</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/learning">浏览学习材料</Link>
          </Button>
        </div>
      )}

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


