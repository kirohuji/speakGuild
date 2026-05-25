import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, GraduationCap, Plane, Coffee, Briefcase, Users,
  ChevronRight, CheckCircle2, Lock, Sparkles, ArrowRight,
  ShoppingBag, Play,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { learningApi, type LearningCategory, type LearningUnitSummary } from '../api/learning-api'

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  '留学生活': GraduationCap,
  '旅行英语': Plane,
  '日常社交': Coffee,
  '职场交流': Briefcase,
  '学术挑战': Users,
}

function getCategoryIcon(name: string) {
  return CATEGORY_ICONS[name] ?? BookOpen
}

export function LearningPlanPage() {
  const [categories, setCategories] = useState<LearningCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'learning' | 'shop'>('learning')

  useEffect(() => {
    learningApi.getUnits()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

  // 搜集所有单元
  const allUnits = categories.flatMap((c) =>
    c.units.map((u) => ({ ...u, categoryName: c.name, categoryIcon: c.icon })),
  )

  const inProgress = allUnits.filter(
    (u) => u.isUnlocked && (u.completionPercent ?? 0) > 0 && (u.completionPercent ?? 0) < 100,
  )
  const notStarted = allUnits.filter(
    (u) => u.isUnlocked && (u.completionPercent ?? 0) === 0,
  )
  const completed = allUnits.filter((u) => (u.completionPercent ?? 0) >= 100)
  const locked = allUnits.filter((u) => !u.isUnlocked)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">学习计划</h1>
        <p className="mt-1 text-muted-foreground">选择教材，系统自动安排每日任务</p>
      </div>

      {/* Tab: 进行中 / 学习商店 */}
      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setTab('learning')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'learning' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          当前学习
          {inProgress.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {inProgress.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('shop')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'shop' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          学习商店
          {notStarted.length > 0 && (
            <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 text-[10px] text-muted-foreground">
              {notStarted.length}
            </span>
          )}
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">学习内容即将上线</p>
        </div>
      ) : tab === 'learning' ? (
        /* ===== 当前学习 Tab ===== */
        <div className="space-y-4">
          {/* 进行中的单元 */}
          {inProgress.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Play className="size-4 text-primary" />
                继续学习
              </h2>
              <div className="space-y-2">
                {inProgress.map((unit) => (
                  <UnitCard key={unit.id} unit={unit} />
                ))}
              </div>
            </section>
          )}

          {/* 已完成的单元 */}
          {completed.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CheckCircle2 className="size-4 text-green-500" />
                已完成
              </h2>
              <div className="space-y-2">
                {completed.map((unit) => (
                  <UnitCard key={unit.id} unit={unit} />
                ))}
              </div>
            </section>
          )}

          {inProgress.length === 0 && completed.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <BookOpen className="size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">还没有开始学习</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setTab('shop')}>
                去学习商店选教材
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* ===== 学习商店 Tab ===== */
        <div className="space-y-6">
          {notStarted.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShoppingBag className="size-4 text-primary" />
                可获取的学习单元
                <Badge variant="secondary" className="text-[10px]">{notStarted.length}</Badge>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {notStarted.map((unit) => (
                  <ShopCard key={unit.id} unit={unit} />
                ))}
              </div>
            </section>
          )}

          {locked.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Lock className="size-4" />
                等级解锁
                <Badge variant="outline" className="text-[10px]">{locked.length}</Badge>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {locked.map((unit) => (
                  <LockedUnitCard key={unit.id} unit={unit} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ── 进行中/已完成 单元卡片 ──

function UnitCard({ unit }: { unit: LearningUnitSummary & { categoryName?: string } }) {
  const pct = unit.completionPercent ?? 0
  const isCompleted = pct >= 100

  return (
    <Link
      to={`/learning/units/${unit.id}`}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors',
        isCompleted
          ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
          : 'border-border hover:bg-muted/50',
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          isCompleted ? 'bg-green-500/20' : 'bg-primary/10',
        )}
      >
        {isCompleted ? (
          <CheckCircle2 className="size-5 text-green-500" />
        ) : (
          <BookOpen className="size-4 text-primary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{unit.title}</p>
          {!isCompleted && pct > 0 && (
            <Badge variant="secondary" className="text-[10px]">{pct}%</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{unit.location}</p>
        {!isCompleted && (
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{unit.vocabCount} 词</span>
            <span>{unit.chunkCount} 表达</span>
            <span>{unit.topicCount} 练习</span>
          </div>
        )}
        {!isCompleted && pct > 0 && <Progress value={pct} className="mt-1.5 h-1" />}
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

// ── 商店卡片 ──

function ShopCard({ unit }: { unit: LearningUnitSummary & { categoryName?: string } }) {
  return (
    <Link
      to={`/learning/units/${unit.id}`}
      className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <BookOpen className="size-5 text-primary" />
        </div>
        {unit.categoryName && (
          <Badge variant="outline" className="text-[10px]">{unit.categoryName}</Badge>
        )}
      </div>
      <h3 className="text-sm font-bold text-foreground group-hover:text-primary">{unit.title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{unit.location}</p>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{unit.vocabCount} 词汇</span>
        <span>·</span>
        <span>{unit.chunkCount} 表达</span>
        <span>·</span>
        <span>{unit.topicCount} 练习</span>
      </div>
      <Button size="sm" variant="outline" className="mt-3 w-full gap-1 text-xs">
        获取学习
        <ArrowRight className="size-3" />
      </Button>
    </Link>
  )
}

// ── 锁定单元卡片 ──

function LockedUnitCard({ unit }: { unit: LearningUnitSummary & { categoryName?: string } }) {
  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-muted/20 p-4 opacity-60">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
        <Lock className="size-4 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-muted-foreground">{unit.title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{unit.location}</p>
      <p className="mt-2 text-[10px] text-muted-foreground">
        需要 Lv.{unit.requiredUserLevel} 解锁
      </p>
    </div>
  )
}
