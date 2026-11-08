import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { parseISO, startOfDay } from 'date-fns'
import {
  ClipboardList, ShoppingBag, Eye, Settings, CircleCheck, CircleDashed,
  CheckCheck, ChevronDown, Filter,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ColumnConfig, ConfigDataTableProps } from '@/components/common/config-datatable'
import { type PracticeRecord, type PracticeRecordsResult } from '@/features/profile/api'
import { type PracticeSession, type TopicDetail, warmupRecordApi, type WarmupRecord } from '@/features/practice/api/english-practice-api'
import type { VnPlayerLine, VnPlayerHandle } from '@/features/vn-engine/vn-player'
import { cn } from '@/lib/cn'
import { learningRepository, practiceRepository } from '@/lib/offline'
import { dailyPracticeRepository } from '@/lib/offline/daily-practice.repository'
import { useLearningStore } from '@/stores/learning.store'
import { useDailyPracticeStore } from '@/stores/daily-practice.store'
import { usePreferencesStore } from '@/stores/preferences.store'
import { toast } from 'sonner'
import { isInProgressLearningUnit, isStoryLearningUnit } from '../api/learning-api'
import { MyLearningView } from '../components/my-learning-view'
import { LearningPackDownloadDrawer, LearningPackDownloadStatusButton } from '@/layout/learning-pack-download-monitor'
import { useIsMobile } from '@/hooks/use-mobile'
import { TopicSessionReadonlyReviewDrawer } from '../components/topic-session-readonly-review-drawer'

const LazyConfigDataTable = lazy(() =>
  import('@/components/common/config-datatable').then((m) => ({ default: m.ConfigDataTable })),
)

function ConfigDataTable<T extends Record<string, any>>(props: ConfigDataTableProps<T>) {
  return <LazyConfigDataTable {...(props as ConfigDataTableProps<Record<string, any>>)} />
}
const PracticeAnalysisPanel = lazy(() =>
  import('@/features/practice/components/practice-analysis-panel').then((m) => ({ default: m.PracticeAnalysisPanel })),
)
const WarmupRecordDetailDialog = lazy(() =>
  import('@/features/practice/components/warmup-record-detail-dialog').then((m) => ({ default: m.WarmupRecordDetailDialog })),
)
const VnPlayer = lazy(() =>
  import('@/features/vn-engine/vn-player').then((m) => ({ default: m.VnPlayer })),
)
const MemberPage = lazy(() =>
  import('@/features/membership/pages/member-page').then((m) => ({ default: m.MemberPage })),
)
const ShopView = lazy(() =>
  import('../components/shop-view').then((m) => ({ default: m.ShopView })),
)

export function LearningPlanPage() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [shopOpen, setShopOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [downloadDrawerOpen, setDownloadDrawerOpen] = useState(false)
  const [activePracticePackId, setActivePracticePackId] = useState<string | null>(null)

  const myUnits = useLearningStore((s) => s.myUnits)
  const myLoading = useLearningStore((s) => s.myLoading)
  const fetchMyLearning = useLearningStore((s) => s.fetchMyLearning)
  const refreshShop = useLearningStore((s) => s.refreshShop)
  const loadMoreShop = useLearningStore((s) => s.loadMoreShop)
  const fetchTags = useLearningStore((s) => s.fetchTags)
  const storeQuitUnit = useLearningStore((s) => s.quitUnit)
  const storeEnrollUnit = useLearningStore((s) => s.enrollUnit)
  const downloadedPacks = useLearningStore((s) => s.downloadedPacks)
  const availablePackUpdates = useLearningStore((s) => s.availablePackUpdates)
  const packInstallingIds = useLearningStore((s) => s.packInstallingIds)
  const fetchDownloadedPacks = useLearningStore((s) => s.fetchDownloadedPacks)
  const downloadUnitPack = useLearningStore((s) => s.downloadUnitPack)

  useEffect(() => {
    // Local SQLite remains the normal source when returning to this page.
    // The repository contacts my-units only when its account projection is
    // absent, so document-reading progress can update without polling.
    void fetchMyLearning(true)
    void fetchDownloadedPacks()
  }, [fetchMyLearning, fetchDownloadedPacks])

  useEffect(() => {
    void dailyPracticeRepository.getActivePracticePackId().then(setActivePracticePackId)
  }, [downloadedPacks])

  const handleSetActivePracticePack = async (unit: typeof myUnits[number]) => {
    await dailyPracticeRepository.setActivePracticePackId(unit.id)
    const mode = usePreferencesStore.getState().dailyPracticeLastMode === 'review' ? 'review' : 'practice'
    await useDailyPracticeStore.getState().loadToday(null, null, mode)
    setActivePracticePackId(unit.id)
    toast.success(t('learning.currentPracticePackSet', { title: unit.title }))
  }

  // 学习页不显示剧情包（story）；进行中口径与加入上限一致
  const learningUnits = myUnits.filter((unit) => !isStoryLearningUnit(unit))
  const inProgress = learningUnits.filter(isInProgressLearningUnit)
  const completed = learningUnits.filter((unit) => unit.status === 'completed' || (!unit.status && unit.completionPercent >= 100))

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3">
        <div className="mb-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl">
            <LearningPackDownloadStatusButton onClick={() => setDownloadDrawerOpen(true)} embedded />
            {isMobile && (
              <>
                <button type="button" onClick={(e) => { e.currentTarget.blur(); setRecordsOpen(true) }}
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
                  aria-label={t('profile.records')}>
                  <ClipboardList className="size-[18px]" />
                </button>
                <button type="button" onClick={(e) => { e.currentTarget.blur(); setShopOpen(true); refreshShop({ excludePackageType: 'story' }); fetchTags() }}
                  className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
                  aria-label={t('member.title')}
                  data-spotlight="open-shop">
                  <ShoppingBag className="size-[18px]" />
                </button>
              </>
            )}
          </div>
        </div>

        <MyLearningView
          myUnits={learningUnits} inProgress={inProgress} completed={completed}
          loading={myLoading}
          onGoToShop={() => { setShopOpen(true); refreshShop({ excludePackageType: 'story' }); fetchTags() }}
          onQuitUnit={storeQuitUnit}
          downloadedPackIds={downloadedPacks.filter((pack) => pack.status === 'installed').map((pack) => pack.packId)}
          updatePackIds={availablePackUpdates.map((update) => update.packId)}
          installingPackIds={packInstallingIds}
          onDownloadUnitPack={downloadUnitPack}
          activePracticePackId={activePracticePackId}
          onSetActivePracticePack={handleSetActivePracticePack}
        />

        <Drawer open={recordsOpen} onOpenChange={setRecordsOpen}>
          <DrawerContent className="flex h-[95vh] max-h-[95vh] flex-col rounded-t-[28px] bg-background drawer-surface">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{t('profile.records')}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {recordsOpen && (
                <Suspense fallback={<MobilePageLoading rows={4} />}>
                  <PracticeRecordsWithTabs active={recordsOpen} />
                </Suspense>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        <LearningPackDownloadDrawer open={downloadDrawerOpen} onOpenChange={setDownloadDrawerOpen} />

        <Drawer open={shopOpen} onOpenChange={setShopOpen}>
          <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{t('learning.shopTitle')}</DrawerTitle>
            </DrawerHeader>
            <div className="h-[calc(88vh-4rem)] overflow-x-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {shopOpen && (
                <Suspense fallback={<MobilePageLoading rows={4} />}>
                  <ShopView
                    isOpen={shopOpen}
                    onMemberOpen={() => setMemberOpen(true)}
                    onEnrollUnit={storeEnrollUnit}
                    onRefreshShop={refreshShop}
                    onLoadMore={loadMoreShop}
                    excludePackageType="story"
                  />
                </Suspense>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        <Drawer open={memberOpen} onOpenChange={setMemberOpen}>
          <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{t('member.title')}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {memberOpen && (
                <Suspense fallback={<MobilePageLoading rows={4} />}>
                  <MemberPage compact />
                </Suspense>
              )}
            </div>
          </DrawerContent>
        </Drawer>
    </div>
  )
}


// ─── Tabbed Records (VN + Warmup) ──────────────────────────────────────────
function PracticeRecordsWithTabs({ active }: { active: boolean }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('vn')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full min-h-0 flex-col">
      <TabsList className="mb-3 w-full shrink-0">
        <TabsTrigger value="vn" className="flex-1 text-xs">{t('profile.records')}</TabsTrigger>
        <TabsTrigger value="warmup" className="flex-1 text-xs">{t('learning.warmupPractice')}</TabsTrigger>
      </TabsList>
      <TabsContent value="vn" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <PracticeRecordsContent active={active && activeTab === 'vn'} />
      </TabsContent>
      <TabsContent value="warmup" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <WarmupRecordsContent />
      </TabsContent>
    </Tabs>
  )
}


// ─── 知识点练习记录 ────────────────────────────────────────────────────────
function warmupRecordFingerprint(record: WarmupRecord) {
  const items = Array.isArray(record.items) ? record.items : []
  return items
    .map((item: any) => `${item.stepId ?? ''}|${item.userAnswer ?? ''}|${item.answer ?? item.suggestedAnswer ?? ''}`)
    .join('::')
}

function warmupRecordKeys(record: WarmupRecord) {
  const keys = new Set<string>()
  const remoteId = (record as any).remoteId
  if (remoteId) keys.add(`remote:${remoteId}`)
  if (!String(record.id).startsWith('guided-warmup:') && !String(record.id).startsWith('today-warmup:') && !String(record.id).startsWith('warmup:')) {
    keys.add(`remote:${record.id}`)
  }
  const fingerprint = warmupRecordFingerprint(record)
  if (fingerprint) keys.add(`fp:${fingerprint}`)
  keys.add(`id:${record.id}`)
  return [...keys]
}

function warmupRecordDisplayTitle(record: WarmupRecord, fallback: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const items = Array.isArray(record.items) ? record.items : []
  const first = items[0] as any
  if (!first) return record.topicTitle || fallback
  const title = first.groupTitle || first.displayLabel || record.topicTitle || fallback
  const prompt = first.zh || first.promptZh || first.answer || first.suggestedAnswer
  if (items.length === 1 && prompt && prompt !== title) return `${title} · ${String(prompt).slice(0, 28)}`
  return items.length > 1 ? `${title} · ${t('learning.questionCountLabel', { count: items.length })}` : title
}

function warmupRecordPracticeCount(record: WarmupRecord) {
  const items = Array.isArray(record.items) ? record.items : []
  return items.reduce((sum, item: any) => sum + Math.max(1, Number(item.practiceCount ?? 1)), 0)
}

function mergeWarmupRecords(localRecords: WarmupRecord[], remoteRecords: WarmupRecord[]) {
  const seen = new Set<string>()
  return [...localRecords, ...remoteRecords]
    .filter((record) => {
      const keys = warmupRecordKeys(record)
      if (keys.some((key) => seen.has(key))) return false
      keys.forEach((key) => seen.add(key))
      return true
    })
    .sort((a, b) => String((b as any).updatedAt ?? b.createdAt ?? '').localeCompare(String((a as any).updatedAt ?? a.createdAt ?? '')))
}

function WarmupRecordsContent() {
  const { t } = useTranslation()
  const [records, setRecords] = useState<WarmupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const pageSize = 15
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<WarmupRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.allSettled([
      practiceRepository.listLocalWarmupRecords(),
      warmupRecordApi.listAll(),
      practiceRepository.getPracticeDataResetAt(),
    ]).then(([localResult, remoteResult, resetResult]) => {
      if (cancelled) return
      const localRecords = localResult.status === 'fulfilled' ? localResult.value : []
      const resetAt = resetResult.status === 'fulfilled' ? resetResult.value : null
      const remoteRecords = remoteResult.status === 'fulfilled'
        ? remoteResult.value.filter((record) => !resetAt || String(record.createdAt ?? '').localeCompare(resetAt) >= 0)
        : []
      setRecords(mergeWarmupRecords(localRecords, remoteRecords))
    }).catch(() => {
      if (!cancelled) setRecords([])
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const pagedRecords = useMemo(() => {
    const start = (page - 1) * pageSize
    return records.slice(start, start + pageSize)
  }, [records, page])

  const columns: ColumnConfig<WarmupRecord>[] = [
    {
      key: 'topicTitle',
      header: t('learning.warmupPractice'),
      cell: (v, row) => {
        const passedItems = row.items?.filter((i: any) => i.passed).length ?? 0
        const totalItems = row.items?.length ?? 0
        const practiceCount = warmupRecordPracticeCount(row)
        return (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{warmupRecordDisplayTitle(row, t('learning.warmupPractice'), t)}</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {passedItems}/{totalItems} {t('learning.passedSuffix')} · {t('todayTask.practiceTimes', { count: practiceCount })}
              </p>
              {v && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{v}</p>
              )}
              {row.feedback && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{row.feedback}</p>
              )}
            </div>
            <Eye className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
          </div>
        )
      },
    },
    {
      key: 'score',
      header: t('learning.scoreHeader'),
      width: 70,
      cell: (v) => (
        <span className={cn(
          'text-sm font-bold tabular-nums',
          v != null && v >= 80 ? 'text-green-600' : v != null && v >= 50 ? 'text-amber-600' : 'text-muted-foreground',
        )}>
          {v ?? '-'}
        </span>
      ),
      align: 'center',
    },
    {
      key: 'createdAt',
      header: t('learning.dateHeader'),
      cell: (v) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {new Date(v).toLocaleDateString()}
        </span>
      ),
      align: 'center',
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <p className="shrink-0 rounded-lg bg-muted/35 px-3 py-1.5 text-xs leading-5 text-muted-foreground">
        {t('learning.recordsHint')}
      </p>
      <ConfigDataTable
        data={pagedRecords}
        columns={columns}
        total={records.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={loading}
        emptyMessage={t('learning.noWarmupRecords')}
        onRowClick={setSelectedRecord}
        className="min-h-0 flex-1 text-xs [&_td]:px-3 [&_td]:py-2 [&_th]:h-9 [&_th]:px-3"
      />
      <Suspense fallback={null}>
        <WarmupRecordDetailDialog
          items={selectedRecord?.items ?? []}
          topicTitle={selectedRecord?.topicTitle}
          score={selectedRecord?.score}
          open={Boolean(selectedRecord)}
          onOpenChange={(open) => { if (!open) setSelectedRecord(null) }}
        />
      </Suspense>
    </div>
  )
}

function PracticeRecordsContent({ active }: { active: boolean }) {
  const { t } = useTranslation()
  const [data, setData] = useState<PracticeRecordsResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<PracticeRecord | null>(null)
  const [recordTypes, setRecordTypes] = useState<Array<'dialogue' | 'reading' | 'writing'>>(['dialogue', 'reading', 'writing'])
  const [filterOpen, setFilterOpen] = useState(false)
  const pageSize = 15

  useEffect(() => {
    if (!active) return
    let cancelled = false
    setIsLoading(true)
    // 离线优先：有本地缓存直接展示；空缓存时 repository 内部再 refresh
    void practiceRepository.listPracticeRecords({ page: 1, pageSize: 100 })
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch(() => {
        if (!cancelled) setData({ list: [], total: 0, page, pageSize })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [active])

  useEffect(() => {
    if (!active) setFilterOpen(false)
  }, [active])

  const visibleRecords = useMemo(() => (data?.list ?? []).filter((record) => recordTypes.includes(record.recordType ?? 'dialogue')), [data?.list, recordTypes])
  const pagedRecords = useMemo(() => visibleRecords.slice((page - 1) * pageSize, page * pageSize), [page, visibleRecords])
  const toggleRecordType = (type: 'dialogue' | 'reading' | 'writing') => {
    setPage(1)
    setRecordTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  }
  const isFiltered = recordTypes.length < 3
  const filterTypeOptions = [
    ['dialogue', t('profile.practiceRecords.filterTypes.dialogue')],
    ['reading', t('profile.practiceRecords.filterTypes.reading')],
    ['writing', t('profile.practiceRecords.filterTypes.writing')],
  ] as const

  const columns: ColumnConfig<PracticeRecord>[] = [
    {
      key: 'topicName',
      header: t('profile.practiceRecords.columns.topic'),
      cell: (v, row) => {
        const type = row.recordType ?? 'dialogue'
        const typeClass =
          type === 'reading'
            ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
            : type === 'writing'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              : 'border-border/80 bg-muted/60 text-muted-foreground'
        return (
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium">{v}</span>
              <Badge variant="outline" className={cn('h-5 shrink-0 px-1.5 text-[10px] font-semibold opacity-90', typeClass)}>
                {t(`profile.practiceRecords.types.${type}`)}
              </Badge>
            </div>
            {row.questionText && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{row.questionText}</p>
            )}
            {row.summary && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{row.summary}</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: t('profile.practiceRecords.columns.status'),
      width: 88,
      cell: (v, row) => (
          <div className="inline-flex flex-col items-center gap-1">
            <Badge variant={v === 'analyzed' ? 'default' : v === 'failed' ? 'destructive' : 'secondary'} className="max-w-full truncate text-[10px]">
              {v === 'analyzed' ? t('profile.practiceRecords.status.analyzed') : v === 'analyzing' ? t('profile.practiceRecords.status.analyzing') : v === 'completed' ? t('profile.practiceRecords.status.completed') : v === 'failed' ? t('profile.practiceRecords.status.failed') : t('profile.practiceRecords.status.inProgress')}
            </Badge>
            <div className="flex flex-col items-center gap-0.5 text-[11px] leading-none text-muted-foreground">
              {typeof row.score === 'number' && (
                <span className="font-semibold text-primary tabular-nums">
                  {row.score}
                  <span className="ml-0.5 font-medium text-muted-foreground">{t('profile.reviewScoreUnit')}</span>
                </span>
              )}
              <span className="tabular-nums">
                {row.practiceCount ?? 0}
                <span className="ml-0.5">{t('profile.reviewPracticeCountUnit')}</span>
              </span>
            </div>
          </div>
      ),
      align: 'center',
    },
    {
      key: 'lastPracticeAt',
      header: t('profile.practiceRecords.columns.date'),
      width: 64,
      cell: (v) => {
        const date = new Date(v)
        return (
          <span className="inline-block whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            {`${date.getMonth() + 1}/${date.getDate()}`}
          </span>
        )
      },
      align: 'center',
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <p className="min-w-0 flex-1 rounded-lg bg-muted/35 px-3 py-1.5 text-xs leading-5 text-muted-foreground">{t('profile.reviewIncompleteHint')}</p>
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className={cn(
                'h-8 shrink-0 rounded-full border-0 px-2.5 text-xs shadow-none',
                isFiltered && 'bg-primary/10 text-primary hover:bg-primary/15',
              )}
              aria-label={t('profile.practiceRecords.filterAria')}
            >
              <Filter className="size-3.5" />
              <span>{isFiltered ? `${recordTypes.length}/3` : t('profile.practiceRecords.filter')}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-52 overflow-hidden rounded-xl border-0 bg-background p-1.5 text-foreground shadow-none"
          >
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1">
              <p className="text-xs font-semibold tracking-wide text-foreground">{t('profile.practiceRecords.filterTitle')}</p>
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => setRecordTypes(['dialogue', 'reading', 'writing'])}
                  className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('profile.practiceRecords.showAll')}
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {filterTypeOptions.map(([type, label]) => {
                const selected = recordTypes.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() => toggleRecordType(type)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted',
                      selected ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded border',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/45',
                    )}>
                      <CheckCheck className={cn('size-3.5', !selected && 'invisible')} />
                    </span>
                    <span className="flex-1">{label}</span>
                    {selected && (
                      <span className="text-[10px] font-medium text-muted-foreground">{t('profile.practiceRecords.shown')}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <ConfigDataTable
        data={pagedRecords}
        columns={columns}
        total={visibleRecords.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t('profile.practiceRecords.empty')}
        onRowClick={setSelectedRecord}
        className="min-h-0 flex-1"
      />
      <PracticeRecordReadonlyReviewDrawer
        record={selectedRecord}
        open={Boolean(selectedRecord && (selectedRecord.recordType ?? 'dialogue') === 'dialogue')}
        onOpenChange={(open) => { if (!open) setSelectedRecord(null) }}
      />
      <TopicSessionReadonlyReviewDrawer
        record={selectedRecord && (selectedRecord.recordType === 'reading' || selectedRecord.recordType === 'writing') ? selectedRecord : null}
        open={Boolean(selectedRecord && (selectedRecord.recordType === 'reading' || selectedRecord.recordType === 'writing'))}
        onOpenChange={(open) => { if (!open) setSelectedRecord(null) }}
      />
    </div>
  )
}

function PracticeRecordReadonlyReviewDrawer({
  record,
  open,
  onOpenChange,
}: {
  record: PracticeRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [topicDetail, setTopicDetail] = useState<TopicDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [showAnalysis, setShowAnalysis] = useState(false)

  useEffect(() => {
    if (!open || !record?.sessionId) return
    setLoading(true)
    setSession(null)
    setTopicDetail(null)
    setLineIndex(0)
    setShowAnalysis(false)
    Promise.all([
      practiceRepository.getPracticeSessionForReview(record.sessionId),
      practiceRepository.getTopicDetail(record.topicId).catch(() => null),
    ])
      .then(([nextSession, nextTopicDetail]) => {
        setSession(nextSession)
        setTopicDetail(nextTopicDetail)
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false))
  }, [open, record?.sessionId, record?.topicId])

  const replayLines = useMemo(() => (session?.turns ?? []).flatMap((turn) => [
    { line: { speaker: topicDetail?.scene.title || 'NPC', text: turn.npcText } satisfies VnPlayerLine },
    { line: { speaker: t('learning.speakerMe'), text: turn.userText, isUser: true } satisfies VnPlayerLine, turn },
  ]), [session?.turns, topicDetail?.scene.title])
  const currentReplayLine = replayLines[lineIndex]
  const isEnded = replayLines.length > 0 && lineIndex >= replayLines.length
  const score = Number(session?.analysisResult?.overallScore ?? record?.score ?? 0)
  const passed = score > 70
  const character = topicDetail?.scene.characters?.[0]
  const expressions = character?.expressions && typeof character.expressions === 'object'
    ? character.expressions as Record<string, string | { spriteUrl?: string }>
    : {}
  const defaultState = expressions.default
  const spriteUrl = (typeof defaultState === 'string' ? defaultState : defaultState?.spriteUrl) || character?.spriteBaseUrl || undefined
  const vnPlayerRef = useRef<VnPlayerHandle | null>(null)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent showHandle={false} className="h-[100dvh] max-h-[100dvh] rounded-none border-0 bg-background pt-safe">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{t('profile.reviewTitle')}</DrawerTitle>
        </DrawerHeader>
        {loading ? (
          <MobilePageLoading rows={4} minHeightClassName="min-h-full" />
        ) : !session ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-muted-foreground">{t('profile.reviewLoadFailed')}</p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          </div>
        ) : showAnalysis ? (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-2xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={() => setShowAnalysis(false)}>{t('profile.reviewBackToChat')}</Button>
                <Badge variant={passed ? 'default' : 'secondary'} className={cn('rounded-full', passed && 'bg-emerald-600 hover:bg-emerald-600')}>
                  {score > 0 ? `${score} ${t('profile.reviewScoreUnit')} · ${passed ? t('profile.reviewScorePassed') : t('profile.reviewScoreRetry')}` : t('profile.reviewScorePending')}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
              </div>
              {session.analysisResult ? (
                <Suspense fallback={<MobilePageLoading rows={3} />}>
                  <PracticeAnalysisPanel analysis={session.analysisResult} loading={false} readOnly />
                </Suspense>
              ) : (
                <p className="rounded-lg bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">{t('profile.reviewNoAnalysis')}</p>
              )}
            </div>
          </div>
        ) : replayLines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-muted-foreground">{t('profile.reviewNoReplay')}</p>
            {session.analysisResult && <Button size="sm" onClick={() => setShowAnalysis(true)}>{t('profile.reviewViewAnalysis')}</Button>}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          </div>
        ) : (
          <div className="relative h-full">
            <div className="absolute inset-x-0 top-0 z-40 flex justify-center px-3 py-2">
              <div className="flex h-9 w-full max-w-[440px] items-center gap-2 rounded-full border border-border/55 bg-background/90 px-2 text-foreground shadow-lg backdrop-blur-2xl">
                <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
                <div className="min-w-0 flex-1 text-center">
                  <p className="truncate text-xs font-semibold">{t('profile.reviewReadonlyHeader')} · {record?.questionText}</p>
                </div>
                <Badge variant={passed ? 'default' : 'secondary'} className={cn('h-6 rounded-full px-2 text-[10px]', passed && 'bg-emerald-600 hover:bg-emerald-600')}>
                  {score > 0 ? `${score} ${t('profile.reviewScoreUnit')}` : t('profile.reviewBadge')}
                </Badge>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => vnPlayerRef.current?.toggleSettings()}
                  aria-label={t('profile.settings')}
                >
                  <Settings className="size-3.5" />
                </button>
              </div>
            </div>
            <Suspense fallback={<MobilePageLoading rows={4} minHeightClassName="min-h-full" />}>
            <VnPlayer
              ref={vnPlayerRef}
              className="h-full max-w-none rounded-none border-none"
              stageClassName="min-h-0"
              showUserInputOverride
              hideChatTopBar
              backgroundUrl={topicDetail?.scene.backgroundUrl || undefined}
              currentLine={isEnded ? null : currentReplayLine?.line ?? null}
              history={replayLines.slice(0, Math.min(lineIndex, replayLines.length)).map((item) => item.line)}
              currentSpriteUrl={spriteUrl}
              spritePosition={character?.defaultPosition || 'center'}
              currentAvatarUrl={character?.avatarUrl || undefined}
              currentAvatarAlt={character?.displayName || character?.name}
              isEnded={isEnded}
              onAdvance={() => setLineIndex((current) => Math.min(current + 1, replayLines.length))}
              inputFeedback={currentReplayLine?.turn ? <PracticeReplayFeedback turn={currentReplayLine.turn} /> : null}
              inputFeedbackChat={currentReplayLine?.turn ? <PracticeReplayFeedback turn={currentReplayLine.turn} compact /> : null}
              showHistoryButton={false}
              endedActions={(
                <Button size="sm" className="h-8 rounded-full px-4 text-xs" onClick={() => setShowAnalysis(true)}>
                  {t('profile.reviewViewAnalysis')}
                </Button>
              )}
            />
            </Suspense>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function PracticeReplayFeedback({
  turn,
  compact = false,
}: {
  turn: NonNullable<PracticeSession['turns']>[number]
  compact?: boolean
}) {
  const { t } = useTranslation()
  const judgement = turn.judgement as { passed?: boolean; feedback?: string; chunksUsed?: string[] } | null
  if (!judgement) return null

  return (
    <div className={cn(
      'border-t text-foreground backdrop-blur-xl',
      compact ? 'px-3 py-2.5' : 'px-4 py-3 pb-safe',
      judgement.passed ? 'border-emerald-500/25 bg-emerald-500/[0.08]' : 'border-amber-500/25 bg-amber-500/[0.08]',
    )}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        {judgement.passed ? <CircleCheck className="size-3.5 text-emerald-500" /> : <CircleDashed className="size-3.5 text-amber-500" />}
        <span>{judgement.passed ? t('profile.reviewRoundPassed') : t('profile.reviewRoundNeedsAdjust')}</span>
      </div>
      {judgement.feedback && <p className="mt-1.5 text-xs leading-5 text-foreground/75">{judgement.feedback}</p>}
      {(judgement.chunksUsed ?? turn.chunksUsed).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(judgement.chunksUsed ?? turn.chunksUsed).map((chunk) => (
            <Badge key={chunk} variant="outline" className="rounded-full bg-background/60 px-2 text-[10px]">{chunk}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}
