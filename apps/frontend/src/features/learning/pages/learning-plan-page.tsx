import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen, GraduationCap, Plane, Coffee, Briefcase, Users,
  ChevronRight, CheckCircle2, Lock, ArrowRight,
  ShoppingBag, Play, Search, Heart, type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/cn'
import {
  learningApi,
  type LearningCategory,
  type LearningUnitSummary,
  type MyUnit,
} from '../api/learning-api'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
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
  const [shopOpen, setShopOpen] = useState(false)

  // ── "当前学习" 数据 ──
  const [myUnits, setMyUnits] = useState<MyUnit[]>([])
  const [myLoading, setMyLoading] = useState(true)

  // ── "学习商店" 数据 ──
  const [shopCategories, setShopCategories] = useState<LearningCategory[]>([])
  const [shopLoading, setShopLoading] = useState(false)

  // 首次加载：两个 Tab 都预拉
  useEffect(() => {
    Promise.all([
      learningApi.getMyUnits().then(setMyUnits).catch(() => setMyUnits([])),
      learningApi.getUnits().then(setShopCategories).catch(() => setShopCategories([])),
    ]).finally(() => { setMyLoading(false); setShopLoading(false) })
  }, [])

  const refreshMyUnits = useCallback(() => {
    learningApi.getMyUnits().then(setMyUnits).catch(() => {})
  }, [])

  const refreshShop = useCallback(() => {
    setShopLoading(true)
    learningApi.getUnits()
      .then(setShopCategories)
      .catch(() => {})
      .finally(() => setShopLoading(false))
  }, [])

  // 商店数据平坦化
  const allShopUnits = shopCategories.flatMap((c) =>
    c.units.map((u) => ({ ...u, categoryName: c.name, categoryIcon: c.icon })),
  )
  const notStarted = allShopUnits.filter(
    (u) => u.isUnlocked && (u.completionPercent ?? 0) === 0,
  )

  // 我的学习数据分组
  const inProgress = myUnits.filter((u) => u.completionPercent < 100)
  const completed = myUnits.filter((u) => u.completionPercent >= 100)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24">
      <div className="mb-3 flex h-10 items-center justify-between">
        <div />

        <div className="flex items-center gap-1 rounded-full bg-background/70 p-1 backdrop-blur-xl ring-1 ring-border/40">
          <button
            type="button"
            onClick={() => { setShopOpen(true); refreshShop() }}
            className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            aria-label="学习商店"
          >
            <ShoppingBag className="size-[18px]" />
            {notStarted.length > 0 && (
              <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </button>
        </div>
      </div>

      <MyLearningView
        myUnits={myUnits}
        inProgress={inProgress}
        completed={completed}
        loading={myLoading}
        onGoToShop={() => { setShopOpen(true); refreshShop() }}
      />

      <Drawer open={shopOpen} onOpenChange={setShopOpen}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-border/70 bg-background">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">学习商店</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <ShopView
              categories={shopCategories}
              loading={shopLoading}
              categoriesEmpty={shopCategories.length === 0}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
//  「当前学习」视图
// ═══════════════════════════════════════════════════════

function MyLearningView({
  myUnits,
  inProgress,
  completed,
  loading,
  onGoToShop,
}: {
  myUnits: MyUnit[]
  inProgress: MyUnit[]
  completed: MyUnit[]
  loading: boolean
  onGoToShop: () => void
}) {
  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
  }

  if (myUnits.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg bg-muted/30 px-6 py-14 text-center">
        <BookOpen className="size-10 text-muted-foreground/40" />
        <p className="mt-4 text-sm text-muted-foreground">还没有开始学习</p>
        <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onGoToShop}>
          去学习商店选教材
        </Button>
      </div>
    )
  }

  const primaryUnit = inProgress[0]
  const otherUnits = inProgress.slice(1)

  return (
    <div className="space-y-5">
      {primaryUnit && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">当前单元</h2>
          <FeaturedLearningCard unit={primaryUnit} />
        </section>
      )}

      {otherUnits.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">其他学习</h2>
          <div className="space-y-2">
            {otherUnits.map((unit) => (
              <MyUnitCard key={unit.id} unit={unit} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-medium text-muted-foreground">
            已完成
          </h2>
          <div className="space-y-2.5">
            {completed.map((unit) => (
              <MyUnitCard key={unit.id} unit={unit} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function FeaturedLearningCard({ unit }: { unit: MyUnit }) {
  const pct = unit.completionPercent
  const Icon = getCategoryIcon(unit.categoryName)
  const nextTopic = unit.topics?.[0]

  return (
    <Link
      to={`/learning/units/${unit.id}`}
      className="block overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm transition-colors hover:bg-muted/30"
    >
      <div className="p-3.5">
        <div className="flex gap-3">
          <div className="relative flex aspect-square size-[92px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40">
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
            <Icon className="relative size-8" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">继续学习</p>
                <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-5 text-foreground">{unit.title}</h3>
              </div>
              <Badge variant="outline" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{pct}%</Badge>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{unit.location}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>{unit.vocabCount} 词汇</span>
              <span>{unit.chunkCount} 句块</span>
              <span>{unit.topicCount} 话题</span>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Progress value={pct} className="h-1 flex-1" />
            <span className="text-[10px] text-muted-foreground">{pct}%</span>
          </div>
          {nextTopic && (
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
              <Play className="size-3.5 text-primary" />
              <span className="line-clamp-1 flex-1">{nextTopic.title}</span>
              <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">{nextTopic.difficulty}</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3.5 py-2.5 text-sm font-medium text-foreground">
        <span>进入学习</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  )
}

// ── 我的学习单元卡片 ──

function MyUnitCard({ unit }: { unit: MyUnit }) {
  const pct = unit.completionPercent
  const isCompleted = pct >= 100
  const Icon = isCompleted ? CheckCircle2 : getCategoryIcon(unit.categoryName)

  return (
    <Link
      to={`/learning/units/${unit.id}`}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm transition-colors',
        isCompleted
          ? 'border-emerald-500/20 hover:bg-emerald-500/[0.04]'
          : 'border-border/70 hover:bg-muted/40',
      )}
    >
      <div
        className={cn(
          'relative flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40',
          isCompleted && 'from-emerald-100 via-emerald-50 to-slate-100 text-emerald-600 dark:from-emerald-950/50 dark:via-emerald-950/30 dark:to-slate-950/40',
        )}
      >
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
        <Icon className="relative size-7" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="line-clamp-1 flex-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</p>
          <Badge variant={isCompleted ? 'secondary' : 'outline'} className="h-5 shrink-0 rounded-full px-2 text-[10px]">
            {isCompleted ? '完成' : `${pct}%`}
          </Badge>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unit.location}</p>
        <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
          <span>{unit.vocabCount} 词汇</span>
          <span>{unit.chunkCount} 句块</span>
          <span>{unit.topicCount} 话题</span>
        </div>

        {!isCompleted && unit.topics && unit.topics.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-1 rounded-full bg-primary/40" />
            <span className="line-clamp-1">{unit.topics[0]?.title}</span>
            {unit.topics.length > 1 && <span className="shrink-0 text-muted-foreground/70">+{unit.topics.length - 1}</span>}
          </div>
        )}

        {!isCompleted && <Progress value={pct} className="mt-2 h-1" />}
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
    </Link>
  )
}

// ═══════════════════════════════════════════════════════
//  「学习商店」视图
// ═══════════════════════════════════════════════════════

function ShopView({
  categories,
  loading,
  categoriesEmpty,
}: {
  categories: LearningCategory[]
  loading: boolean
  categoriesEmpty: boolean
}) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [keyword, setKeyword] = useState('')

  const allUnits = useMemo(
    () =>
      categories.flatMap((category) =>
        category.units.map((unit) => ({
          ...unit,
          categoryName: category.name,
          categoryIcon: category.icon,
        })),
      ),
    [categories],
  )

  const categoryTabs = useMemo(
    () => [
      { id: 'all', label: '全部', count: allUnits.length },
      ...categories.map((category) => ({
        id: category.id,
        label: category.name,
        count: category.units.length,
      })),
    ],
    [allUnits.length, categories],
  )

  const filteredUnits = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return allUnits.filter((unit) => {
      const matchesCategory =
        activeCategory === 'all' ||
        categories.find((category) => category.id === activeCategory)?.name === unit.categoryName

      if (!matchesCategory) return false
      if (!query) return true

      const haystack = [
        unit.title,
        unit.location,
        unit.categoryName,
        ...unit.topics.map((topic) => topic.title),
      ].join(' ').toLowerCase()

      return haystack.includes(query)
    })
  }, [activeCategory, allUnits, categories, keyword])

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>
  }

  if (categoriesEmpty) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <BookOpen className="size-12 text-muted-foreground/40" />
        <p className="mt-4 text-muted-foreground">学习内容即将上线</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索学习单元、场景或话题"
          className="h-11 rounded-full border-0 bg-muted/70 pl-9 text-sm"
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {categoryTabs.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                activeCategory === category.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {category.label}
              <span className="ml-1 opacity-70">{category.count}</span>
            </button>
          ))}
        </div>
      </div>

      {filteredUnits.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ShoppingBag className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">没有找到匹配的学习单元</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60 rounded-lg bg-card">
          {filteredUnits.map((unit) => (
            <ShopCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 商店卡片 ──

function ShopCard({ unit }: { unit: LearningUnitSummary & { categoryName?: string } }) {
  const navigate = useNavigate()
  const [detailOpen, setDetailOpen] = useState(false)
  const [acquiring, setAcquiring] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [topicPage, setTopicPage] = useState(1)
  const pageSize = 6
  const Icon = unit.isUnlocked ? getCategoryIcon(unit.categoryName ?? '') : Lock
  const totalTopicPages = Math.max(1, Math.ceil((unit.topics?.length ?? 0) / pageSize))
  const pagedTopics = (unit.topics ?? []).slice((topicPage - 1) * pageSize, topicPage * pageSize)

  const handleAcquire = useCallback(async () => {
    if (acquiring || !unit.isUnlocked) return
    setAcquiring(true)
    try {
      await learningApi.startUnit(unit.id)
      navigate(`/learning/units/${unit.id}`)
    } catch {
      // 即使失败也允许跳转
      navigate(`/learning/units/${unit.id}`)
    }
  }, [unit.id, unit.isUnlocked, acquiring, navigate])

  return (
    <>
      <button
        type="button"
        onClick={() => { setTopicPage(1); setDetailOpen(true) }}
        className="flex w-full gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <UnitCover unit={unit} icon={Icon} />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-1 flex-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</h3>
            {!unit.isUnlocked && <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unit.location}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {unit.topicCount} 个话题 · {unit.vocabCount} 个词汇 · {unit.chunkCount} 个表达
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            {unit.categoryName && <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">{unit.categoryName}</Badge>}
            <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
              Lv.{unit.requiredUserLevel}
            </Badge>
          </div>
        </div>
      </button>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>{unit.title}</DialogTitle>
            <DialogDescription>{unit.location}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[88vh] flex-col">
            <div className="flex gap-3 border-b p-4">
              <UnitCover unit={unit} icon={Icon} className="size-20" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {unit.categoryName && <Badge variant="secondary" className="rounded-full text-[10px]">{unit.categoryName}</Badge>}
                  {!unit.isUnlocked && <Badge variant="outline" className="rounded-full text-[10px]">未解锁</Badge>}
                </div>
                <h3 className="mt-2 line-clamp-2 text-base font-bold leading-5 text-foreground">{unit.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{unit.location}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{unit.vocabCount} 词汇</span>
                  <span>{unit.chunkCount} 表达</span>
                  <span>{unit.topicCount} 话题</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4">
              <Button
                variant={favorite ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => setFavorite((value) => !value)}
              >
                <Heart className={cn('size-4', favorite && 'fill-current')} />
                收藏
              </Button>
              <Button className="gap-2" disabled={!unit.isUnlocked || acquiring} onClick={handleAcquire}>
                {acquiring ? <Spinner data-icon="inline-start" /> : <ArrowRight className="size-4" />}
                {unit.isUnlocked ? '开始学习' : `Lv.${unit.requiredUserLevel} 解锁`}
              </Button>
            </div>

            <div className="border-y bg-muted/30 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">话题列表</p>
                {unit.topics.length > pageSize && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={topicPage === 1}
                      onClick={() => setTopicPage((page) => Math.max(1, page - 1))}
                      className="rounded-full px-2 py-1 text-[11px] text-muted-foreground disabled:opacity-40"
                    >
                      上一页
                    </button>
                    <span className="text-[11px] text-muted-foreground">{topicPage}/{totalTopicPages}</span>
                    <button
                      type="button"
                      disabled={topicPage === totalTopicPages}
                      onClick={() => setTopicPage((page) => Math.min(totalTopicPages, page + 1))}
                      className="rounded-full px-2 py-1 text-[11px] text-muted-foreground disabled:opacity-40"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              {pagedTopics.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {pagedTopics.map((topic, index) => (
                    <div key={topic.id} className="flex items-center gap-3 py-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {(topicPage - 1) * pageSize + index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-foreground">{topic.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          建议 {Math.max(1, Math.round(topic.suggestedDurationSec / 60))} 分钟
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[10px]">{topic.difficulty}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">这个单元暂时没有话题</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function UnitCover({
  unit,
  icon: Icon,
  className,
}: {
  unit: LearningUnitSummary & { categoryName?: string }
  icon: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40',
        !unit.isUnlocked && 'grayscale',
        className,
      )}
    >
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
      <Icon className="relative size-7" />
    </div>
  )
}
