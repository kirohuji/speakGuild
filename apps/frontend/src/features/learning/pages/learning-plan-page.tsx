import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, GraduationCap, Plane, Coffee, Briefcase, Users,
  ChevronRight, CheckCircle2, Lock, Sparkles, ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  useEffect(() => {
    learningApi.getUnits()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (categories.length > 0 && !expandedCategory) {
      // 展开第一个有未完成单元的类别
      const firstIncomplete = categories.find((c) =>
        c.units.some((u) => u.isUnlocked && (u.completionPercent ?? 0) < 100),
      )
      setExpandedCategory(firstIncomplete?.id ?? categories[0]?.id ?? null)
    }
  }, [categories])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">学习计划</h1>
        <p className="mt-1 text-muted-foreground">选择一套教材，系统自动安排每日学习任务</p>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">学习内容即将上线</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => {
            const CatIcon = getCategoryIcon(category.name)
            const isExpanded = expandedCategory === category.id
            const unlockedUnits = category.units.filter((u) => u.isUnlocked)
            const inProgress = unlockedUnits.filter((u) => {
              const pct = u.completionPercent ?? 0
              return pct > 0 && pct < 100
            })
            const completed = unlockedUnits.filter((u) => (u.completionPercent ?? 0) >= 100)

            return (
              <Card key={category.id} className="overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                          <CatIcon className="size-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{category.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {unlockedUnits.length} 个单元 · 已完成 {completed.length}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={cn(
                          'size-4 text-muted-foreground transition-transform',
                          isExpanded && 'rotate-90',
                        )}
                      />
                    </div>

                    {/* Mini progress bar */}
                    {unlockedUnits.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {unlockedUnits.map((u) => {
                          const pct = u.completionPercent ?? 0
                          return (
                            <div
                              key={u.id}
                              className={cn(
                                'h-1.5 flex-1 rounded-full',
                                pct >= 100
                                  ? 'bg-green-500'
                                  : pct > 0
                                    ? 'bg-primary'
                                    : 'bg-muted',
                              )}
                              title={`${u.title}: ${pct}%`}
                            />
                          )
                        })}
                      </div>
                    )}
                  </CardHeader>
                </button>

                {isExpanded && (
                  <CardContent className="space-y-2 pt-0">
                    {inProgress.length > 0 && (
                      <div className="mb-2">
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">继续学习</p>
                        {inProgress.map((unit) => (
                          <UnitCard key={unit.id} unit={unit} />
                        ))}
                      </div>
                    )}

                    {unlockedUnits
                      .filter((u) => (u.completionPercent ?? 0) === 0)
                      .map((unit) => (
                        <UnitCard key={unit.id} unit={unit} />
                      ))}

                    {completed.length > 0 && (
                      <>
                        <p className="pt-1 text-xs font-medium text-muted-foreground">已完成</p>
                        {completed.map((unit) => (
                          <UnitCard key={unit.id} unit={unit} />
                        ))}
                      </>
                    )}

                    {category.units
                      .filter((u) => !u.isUnlocked)
                      .map((unit) => (
                        <LockedUnitCard key={unit.id} unit={unit} />
                      ))}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4 text-center">
        <Sparkles className="mx-auto mb-2 size-6 text-primary" />
        <p className="text-sm text-muted-foreground">
          每完成一个单元，你就能在真实场景中更自信地表达
        </p>
      </div>
    </div>
  )
}

function UnitCard({ unit }: { unit: LearningUnitSummary }) {
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
            <Badge variant="secondary" className="text-[10px]">
              {pct}%
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{unit.location}</p>

        {!isCompleted && (
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{unit.vocabCount} 词</span>
            <span>{unit.chunkCount} 表达</span>
            <span>{unit.topicCount} 练习</span>
            <span>{unit.scriptCount} 剧本</span>
          </div>
        )}

        {!isCompleted && pct > 0 && (
          <Progress value={pct} className="mt-1.5 h-1" />
        )}
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

function LockedUnitCard({ unit }: { unit: LearningUnitSummary }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/50 bg-muted/20 p-3 opacity-60">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <Lock className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">{unit.title}</p>
        <p className="text-xs text-muted-foreground">
          需要用户等级 Lv.{unit.requiredUserLevel} 解锁
        </p>
      </div>
    </div>
  )
}
