import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Search, Star, BookOpen, TrendingUp, Calendar, Target,
  ChevronRight, MapPin, FileText, ScrollText, Mic, BookMarked,
  Heart, History, Crown, CircleUser, LayoutGrid,
  Trophy, Users, MessageSquare,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDataTable, type ColumnConfig } from '@/components/common/config-datatable'
import { BindingDialog } from '@/features/question-bank/components/binding-dialog'
import { OnboardingGuide, useOnboarding } from '@/components/common/onboarding-guide'
import { SearchOverlay } from '@/features/question-bank/components/search-overlay'
import { getQuestionBankHome, type QuestionBankHome, type ScenicCard, type OtherTopic } from '@/features/question-bank/api'
import { useConfigStore } from '@/stores/config.store'
import { useAssetsStore } from '@/stores/assets.store'
import { cn } from '@/lib/cn'

type TabMode = 'practice' | 'study'

// ─── 走马灯数据（可后期改为接口下发） ───────────────────────────────────────
const carouselSlides = [
  { id: 1, gradient: 'from-blue-500 to-blue-700', title: '导游口试备考', subtitle: '系统练习，高分通过' },
  { id: 2, gradient: 'from-emerald-500 to-teal-600', title: '景点介绍专项', subtitle: '10大热门景点，逐一攻破' },
  { id: 3, gradient: 'from-orange-500 to-amber-600', title: '模拟考试上线', subtitle: '真实考场环境，精准测评' },
]

// ─── 分类宫格（2行×5） ─────────────────────────────────────────────────────
const categoryItems = [
  { label: '景点介绍', icon: MapPin, path: '/' },
  { label: '模拟考试', icon: FileText, path: '/mock' },
  { label: '真题练习', icon: ScrollText, path: '/' },
  { label: '发音训练', icon: Mic, path: '/' },
  { label: '排行榜', icon: Trophy, path: '/leaderboard' },
  { label: '成就', icon: Crown, path: '/achievements' },
  { label: '邀请好友', icon: Users, path: '/invite' },
  { label: '个人中心', icon: CircleUser, path: '/profile' },
  { label: '反馈', icon: MessageSquare, path: '/feedback' },
  { label: '全部分类', icon: LayoutGrid, path: '/' },
]

// ─── 今日日期格式 ────────────────────────────────────────────────────────────
function getTodayLabel() {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const d = new Date()
  return `${d.getMonth() + 1}月${d.getDate()}日 / ${dayNames[d.getDay()]}`
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export function HomePage() {
  const { t } = useTranslation()
  const { isConfigured } = useConfigStore()
  const { isFavorite, addFavorite, removeFavorite } = useAssetsStore()

  const [showBinding, setShowBinding] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { hasSeen, markSeen } = useOnboarding()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!hasSeen && isConfigured) {
      setShowOnboarding(true)
    }
  }, [hasSeen, isConfigured])
  const [homeData, setHomeData] = useState<QuestionBankHome | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [mode, setMode] = useState<TabMode>('practice')
  const [topicPage, setTopicPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (kw?: string, m?: string) => {
    setIsLoading(true)
    setError('')
    try {
      const data = await getQuestionBankHome({ keyword: kw, mode: m })
      setHomeData(data)
    } catch {
      setError(t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!isConfigured) setShowBinding(true)
  }, [isConfigured])

  useEffect(() => {
    if (!isConfigured) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchData(keyword, mode)
    }, keyword ? 300 : 0)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [keyword, mode, isConfigured, fetchData])

  // 桌面端表格列定义
  const otherTopicsColumns: ColumnConfig<OtherTopic>[] = [
    {
      key: 'name',
      header: t('home.columns.topic'),
      cell: (v) => <span className="font-medium">{v}</span>,
    },
    {
      key: 'questionCount',
      header: t('home.columns.count'),
      cell: (v) => <span className="text-muted-foreground">{v}</span>,
      width: 80,
    },
    {
      key: 'masteredCount',
      header: t('home.columns.mastered'),
      cell: (v) => <span className="text-green-600 dark:text-green-400">{v}</span>,
      width: 80,
    },
    {
      key: 'masteryRate',
      header: t('home.columns.progress'),
      cell: (v) => (
        <div className="flex items-center gap-2">
          <Progress value={v} className="h-1.5 w-20" />
          <span className="text-xs text-muted-foreground">{v}%</span>
        </div>
      ),
      width: 160,
    },
    {
      key: 'topicId',
      header: t('home.columns.action'),
      cell: (v) => (
        <Link to={`/practice/${v}`}>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            {t('common.goTo')}
          </Button>
        </Link>
      ),
      width: 100,
    },
  ]

  const paginatedOtherTopics = homeData?.otherTopics.slice(
    (topicPage - 1) * 10,
    topicPage * 10
  ) || []

  const modeTabRow = (
    <div className="flex gap-2">
      {(['practice', 'study'] as TabMode[]).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            mode === m
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          {t(`home.hero.${m}`)}
        </button>
      ))}
    </div>
  )

  // 分区数据
  const allScenic = homeData?.scenicCards ?? []
  const recentStudy = allScenic.filter((c) => c.masteryRate > 0)
  const recommended = allScenic.filter((c) => c.masteryRate < 100)

  const toggleFav = (topicId: string) => {
    if (isFavorite(topicId)) removeFavorite(topicId)
    else addFavorite(topicId)
  }

  return (
    <div>
      <BindingDialog
        open={showBinding}
        onClose={() => setShowBinding(false)}
        forceOpen={!isConfigured}
      />

      <OnboardingGuide
        open={showOnboarding && isConfigured}
        onClose={() => { setShowOnboarding(false); markSeen() }}
        onFinish={markSeen}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* ══════════════ 手机端视图 ══════════════ */}
      <div className="lg:hidden space-y-3">

        {/* 搜索栏 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('home.hero.searchPlaceholder')}
            readOnly
            onFocus={() => setSearchOpen(true)}
            className="pl-9 rounded-full bg-muted/60 border-0 focus-visible:ring-1 cursor-pointer"
          />
        </div>

        {/* 走马灯 */}
        <MobileCarousel />

        {/* 分类宫格 */}
        {/* <div className="rounded-2xl bg-card p-3 shadow-sm">
          <div className="grid grid-cols-5 gap-y-3">
            {categoryItems.map(({ label, icon: Icon, path }) => (
              <Link
                key={label}
                to={path}
                className="no-underline flex flex-col items-center gap-1"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[11px] text-foreground/80">{label}</span>
              </Link>
            ))}
          </div>
        </div> */}

        {/* 今日更新 */}
        <MobileSectionCard
          title="今日更新"
          subtitle={getTodayLabel()}
          moreLink="/"
        >
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-16 w-16 flex-shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {(allScenic.length > 0 ? allScenic : homeData?.otherTopics.map(ot => ({
                id: ot.topicId,
                topicId: ot.topicId,
                name: ot.name,
                coverImage: undefined,
                questionCount: ot.questionCount,
                masteredCount: ot.masteredCount,
                masteryRate: ot.masteryRate,
              })) ?? []).slice(0, 4).map((item) => (
                <UpdateListItem key={item.id} card={item as ScenicCard} />
              ))}
            </div>
          )}
        </MobileSectionCard>

        {/* 最近学习 */}
        {(isLoading || recentStudy.length > 0) && (
          <MobileSectionCard
            title="最近学习"
            desc="继续上次的练习进度"
            moreLink="/"
          >
            {isLoading ? (
              <HorizontalScrollSkeleton />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                {recentStudy.slice(0, 8).map((card) => (
                  <HorizontalScrollCard key={card.id} card={card} />
                ))}
              </div>
            )}
          </MobileSectionCard>
        )}

        {/* 为你推荐 */}
        {(isLoading || recommended.length > 0) && (
          <MobileSectionCard
            title="为你推荐"
            desc="根据你的进度，重点攻克以下内容"
            moreLink="/"
          >
            {isLoading ? (
              <HorizontalScrollSkeleton />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                {recommended.slice(0, 8).map((card) => (
                  <HorizontalScrollCard key={card.id} card={card} />
                ))}
              </div>
            )}
          </MobileSectionCard>
        )}
      </div>

      {/* ══════════════ 桌面端视图（保持原样） ══════════════ */}
      <div className="hidden lg:block space-y-8">

        {/* Hero */}
        <Card className="overflow-hidden bg-primary/[0.04] dark:bg-primary/[0.08]">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold">{t('home.title')}</h1>
                {homeData?.bankName && (
                  <p className="mt-1 text-muted-foreground">{homeData.bankName}</p>
                )}
                <div className="mt-4">{modeTabRow}</div>
              </div>
              {isLoading ? (
                <div className="flex gap-6">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-20" />)}
                </div>
              ) : homeData ? (
                <div className="flex flex-wrap gap-6">
                  <StatItem icon={Calendar} label={t('home.hero.practiceDays')} value={homeData.practiceDays} />
                  <StatItem icon={BookOpen} label={t('home.hero.totalQuestions')} value={homeData.totalQuestions} />
                  <StatItem icon={Target} label={t('home.hero.mastered')} value={homeData.masteredQuestions} />
                  {homeData.lastMockScore !== undefined && (
                    <StatItem icon={TrendingUp} label={t('home.hero.lastMock')} value={`${homeData.lastMockScore}分`} />
                  )}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* 搜索栏 */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('home.hero.searchPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 景点介绍 */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('home.scenic.title')}</h2>
            <Badge variant="secondary">{homeData?.scenicCards.length ?? 0} 个景点</Badge>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-destructive/10 p-8 text-center text-destructive">{error}</div>
          ) : allScenic.length === 0 ? (
            <div className="rounded-2xl bg-muted/40 py-12 text-center text-muted-foreground">{t('common.empty')}</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {allScenic.map((card) => (
                <DesktopScenicCard
                  key={card.id}
                  card={card}
                  isFav={isFavorite(card.topicId)}
                  onToggleFav={() => toggleFav(card.topicId)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 其他题型 */}
        {(homeData?.otherTopics.length || 0) > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{t('home.otherTopics.title')}</h2>
            </div>
            <ConfigDataTable
              data={paginatedOtherTopics}
              columns={otherTopicsColumns}
              total={homeData?.otherTopics.length || 0}
              page={topicPage}
              pageSize={10}
              onPageChange={setTopicPage}
              isLoading={isLoading}
              emptyMessage={t('common.empty')}
            />
          </section>
        )}
      </div>
    </div>
  )
}

// ─── 走马灯 ────────────────────────────────────────────────────────────────
function MobileCarousel() {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % carouselSlides.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative overflow-hidden rounded-2xl h-36">
      {carouselSlides.map((slide, i) => (
        <div
          key={slide.id}
          className={cn(
            'absolute inset-0 flex flex-col items-start justify-end p-4 transition-opacity duration-500',
            `bg-gradient-to-br ${slide.gradient}`,
            i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <p className="text-lg font-bold text-white leading-tight">{slide.title}</p>
          <p className="mt-0.5 text-sm text-white/80">{slide.subtitle}</p>
        </div>
      ))}
      {/* 指示点 */}
      <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 z-10">
        {carouselSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Section 容器（白框 + 标题栏） ─────────────────────────────────────────
function MobileSectionCard({
  title,
  subtitle,
  desc,
  moreLink,
  children,
}: {
  title: string
  subtitle?: string
  desc?: string
  moreLink?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold">{title}</h2>
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
        {moreLink && (
          <Link to={moreLink} className="no-underline flex items-center gap-0.5 text-xs text-muted-foreground">
            更多 <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {desc && <p className="mb-3 text-xs text-muted-foreground">{desc}</p>}
      {children}
    </div>
  )
}

// ─── 今日更新：列表项 ───────────────────────────────────────────────────────
function UpdateListItem({ card }: { card: ScenicCard }) {
  return (
    <Link to={`/practice/${card.topicId}`} className="no-underline block py-3 first:pt-0 last:pb-0">
      <div className="flex gap-3">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
          {card.coverImage ? (
            <img src={card.coverImage} alt={card.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{card.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">导游说</p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{card.questionCount} 道题</span>
            <span>·</span>
            <span>{card.masteryRate}% 已掌握</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── 横向滚动卡片 ───────────────────────────────────────────────────────────
function HorizontalScrollCard({ card }: { card: ScenicCard }) {
  return (
    <Link to={`/practice/${card.topicId}`} className="no-underline w-[108px] flex-shrink-0">
      <div className="aspect-square overflow-hidden rounded-xl bg-muted">
        {card.coverImage ? (
          <img src={card.coverImage} alt={card.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">{card.name}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{card.masteryRate}% 已掌握</p>
    </Link>
  )
}

function HorizontalScrollSkeleton() {
  return (
    <div className="flex gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-[108px] flex-shrink-0 space-y-1.5">
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      ))}
    </div>
  )
}

// ─── 桌面端组件 ────────────────────────────────────────────────────────────
function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | number
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function DesktopScenicCard({
  card,
  isFav,
  onToggleFav,
}: {
  card: ScenicCard
  isFav: boolean
  onToggleFav: () => void
}) {
  const { t } = useTranslation()

  return (
    <Link to={`/practice/${card.topicId}`} className="block no-underline">
      <Card className="group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_24px_rgba(0,0,0,0.10)]">
        <div className="relative h-32 bg-gradient-to-br from-muted to-muted/30">
          {card.coverImage ? (
            <img src={card.coverImage} alt={card.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.preventDefault(); onToggleFav() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleFav() }
            }}
            className="absolute right-2 top-2 cursor-pointer rounded-full bg-background/80 p-1 backdrop-blur-sm"
          >
            <Star className={cn('h-4 w-4 transition-colors', isFav ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
          </span>
        </div>
        <CardContent className="p-3">
          <h3 className="text-sm font-medium leading-tight">{card.name}</h3>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{card.masteredCount}/{card.questionCount} 题</span>
              <span>{card.masteryRate}%</span>
            </div>
            <Progress value={card.masteryRate} className="h-1" />
          </div>
          <span className="mt-3 flex h-7 w-full items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground">
            {t('common.goTo')}
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
