import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { parseISO, startOfDay } from 'date-fns'
import {
  ClipboardList, ShoppingBag, Eye, Settings, CircleCheck, CircleDashed,
  CheckCircle2, XCircle, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDataTable, type ColumnConfig } from '@/components/common/config-datatable'
import { type PracticeRecord, type PracticeRecordsResult } from '@/features/profile/api'
import { type PracticeSession, type TopicDetail, warmupRecordApi, type WarmupRecord } from '@/features/practice/api/english-practice-api'
import { PracticeAnalysisPanel } from '@/features/practice/components/practice-analysis-panel'
import { ChunkOutputDrillCard } from '@/features/practice/components/chunk-output-drill-card'
import { VocabOutputCard } from '@/features/practice/components/vocab-output-card'
import { PatternDrillCard } from '@/features/practice/components/pattern-drill-card'
import { SentenceDecompositionCard } from '@/features/practice/components/sentence-decomposition-card'
import { VnPlayer, type VnPlayerLine, type VnPlayerHandle } from '@/features/vn-engine/vn-player'
import { MemberPage } from '@/features/membership/pages/member-page'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
import { practiceRepository } from '@/lib/offline'
import { useLearningStore } from '@/stores/learning.store'
import { MyLearningView } from '../components/my-learning-view'
import { ShopView } from '../components/shop-view'

export function LearningPlanPage() {
  const { t } = useTranslation()
  const [shopOpen, setShopOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)

  const myUnits = useLearningStore((s) => s.myUnits)
  const myLoading = useLearningStore((s) => s.myLoading)
  const fetchMyLearning = useLearningStore((s) => s.fetchMyLearning)
  const refreshMyUnits = useLearningStore((s) => s.refreshMyUnits)
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
    fetchMyLearning()
    fetchDownloadedPacks()
  }, [fetchMyLearning, fetchDownloadedPacks])

  const inProgress = myUnits.filter((u) => u.completionPercent < 100)
  const completed = myUnits.filter((u) => u.completionPercent >= 100)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3">
        <div className="mb-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45 lg:hidden">
            <button type="button" onClick={(e) => { e.currentTarget.blur(); setRecordsOpen(true) }}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
              aria-label={t('profile.records')}>
              <ClipboardList className="size-[18px]" />
            </button>
            <button type="button" onClick={(e) => { e.currentTarget.blur(); setShopOpen(true); refreshShop(); fetchTags() }}
              className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
              aria-label={t('member.title')}>
              <ShoppingBag className="size-[18px]" />
            </button>
          </div>
        </div>

        <MyLearningView
          myUnits={myUnits} inProgress={inProgress} completed={completed}
          loading={myLoading}
          onGoToShop={() => { setShopOpen(true); refreshShop(); fetchTags() }}
          onRefresh={refreshMyUnits}
          onQuitUnit={storeQuitUnit}
          downloadedPackIds={downloadedPacks.filter((pack) => pack.status === 'installed').map((pack) => pack.packId)}
          updatePackIds={availablePackUpdates.map((update) => update.packId)}
          installingPackIds={packInstallingIds}
          onDownloadUnitPack={downloadUnitPack}
        />

        <Drawer open={recordsOpen} onOpenChange={setRecordsOpen}>
          <DrawerContent className="max-h-[95vh] rounded-t-[28px] border-border/70 bg-background drawer-surface">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{t('profile.records')}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <PracticeRecordsWithTabs />
            </div>
          </DrawerContent>
        </Drawer>

        <Drawer open={shopOpen} onOpenChange={setShopOpen}>
          <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{t('learning.shopTitle')}</DrawerTitle>
            </DrawerHeader>
            <div className="h-[calc(88vh-4rem)] overflow-x-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <ShopView
                isOpen={shopOpen}
                onMemberOpen={() => setMemberOpen(true)}
                onEnrollUnit={storeEnrollUnit}
                onRefreshShop={refreshShop}
                onLoadMore={loadMoreShop}
              />
            </div>
          </DrawerContent>
        </Drawer>

        <Drawer open={memberOpen} onOpenChange={setMemberOpen}>
          <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{t('member.title')}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <MemberPage compact />
            </div>
          </DrawerContent>
        </Drawer>
    </div>
  )
}


// ─── Tabbed Records (VN + Warmup) ──────────────────────────────────────────
function PracticeRecordsWithTabs() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('vn')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-3 w-full">
        <TabsTrigger value="vn" className="flex-1 text-xs">{t('profile.records')}</TabsTrigger>
        <TabsTrigger value="warmup" className="flex-1 text-xs">{t('learning.warmupPractice')}</TabsTrigger>
      </TabsList>
      <TabsContent value="vn" className="mt-0">
        <PracticeRecordsContent />
      </TabsContent>
      <TabsContent value="warmup" className="mt-0">
        <WarmupRecordsContent />
      </TabsContent>
    </Tabs>
  )
}


// ─── 知识点练习记录 ────────────────────────────────────────────────────────
function WarmupRecordsContent() {
  const { t } = useTranslation()
  const [records, setRecords] = useState<WarmupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const pageSize = 15
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<WarmupRecord | null>(null)

  useEffect(() => {
    setLoading(true)
    warmupRecordApi.listAll()
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [])

  const pagedRecords = useMemo(() => {
    const start = (page - 1) * pageSize
    return records.slice(start, start + pageSize)
  }, [records, page])

  const columns: ColumnConfig<WarmupRecord>[] = [
    {
      key: 'topicTitle',
      header: t('learning.topicHeader'),
      cell: (v, row) => {
        const passedItems = row.items?.filter((i: any) => i.passed).length ?? 0
        const totalItems = row.items?.length ?? 0
        return (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{v || t('learning.warmupPractice')}</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {passedItems}/{totalItems} {t('learning.passedSuffix')}
              </p>
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
    <div className="space-y-4">
      <p className="rounded-lg bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
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
      />
      <WarmupRecordDetailDrawer
        record={selectedRecord}
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => { if (!open) setSelectedRecord(null) }}
      />
    </div>
  )
}

function WarmupRecordDetailDrawer({
  record,
  open,
  onOpenChange,
}: {
  record: WarmupRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [currentIdx, setCurrentIdx] = useState(0)

  if (!record) return null

  const items = record.items ?? []
  const total = items.length
  const current = items[currentIdx]
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < total - 1

  const gotoPrev = () => setCurrentIdx((p) => Math.max(0, p - 1))
  const gotoNext = () => setCurrentIdx((p) => Math.min(total - 1, p + 1))

  // 根据 stepType 渲染对应的练习卡片
  const renderCard = () => {
    if (!current) return null
    const rd = {
      userAnswer: current.userAnswer || '',
      passed: current.passed,
      feedback: current.feedback || '',
      correction: current.correction,
      audioUrl: current.audioUrl,
    }
    if (current.stepType === 'chunk_substitution') {
      return (
        <ChunkOutputDrillCard
          chunk={{ text: current.correction?.split(' ')?.slice(0, 3)?.join(' ') || current.answer || current.zh || '', meaning: '' }}
          items={[{ zh: current.zh, answer: current.answer }]}
          stepId={current.stepId || String(currentIdx)}
          groupTitle={current.groupTitle}
          reviewData={rd}
        />
      )
    }
    if (current.stepType === 'vocab_drill') {
      return (
        <VocabOutputCard
          title={current.groupTitle || t('learning.wordDrill')}
          vocabs={[{ vocabId: '', promptZh: current.zh, suggestedAnswer: current.answer }]}
          stepId={current.stepId || String(currentIdx)}
          reviewData={rd}
        />
      )
    }
    if (current.stepType === 'pattern_drill') {
      return (
        <PatternDrillCard
          pattern={current.correction || current.answer || current.zh || ''}
          items={[{ zh: current.zh, answer: current.answer }]}
          stepId={current.stepId || String(currentIdx)}
          groupTitle={current.groupTitle}
          reviewData={rd}
        />
      )
    }
    if (current.stepType === 'sentence_decomposition') {
      // 从 correction 反序列化 levels，从 userAnswer 反序列化录音
      let levels: any[] = []
      try { levels = JSON.parse(current.correction || '[]') } catch {}
      let levelAudios: Record<number, string> | null = null
      try { levelAudios = JSON.parse(current.userAnswer || '{}') } catch {}
      return (
        <SentenceDecompositionCard
          title={current.zh || t('learning.sentenceBreakdown')}
          levels={levels.length > 0 ? levels : [{ level: 1, label: '', en: current.answer || current.zh || '', zh: '' }]}
          stepId={current.stepId || String(currentIdx)}
          reviewData={{ levelAudios }}
        />
      )
    }
    // fallback
    return (
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            current.passed ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500',
          )}>
            {current.passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{current.zh}</p>
            {current.userAnswer && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('learning.yourAnswer')}<span className={cn('font-medium', current.passed ? 'text-green-600' : 'text-red-500')}>{current.userAnswer}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!z-[10001] h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 pt-safe md:h-[88vh] md:max-w-3xl md:rounded-2xl md:pt-0 [&>button]:hidden">
        <DialogTitle className="sr-only">{t('learning.reviewTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('learning.reviewSubtitle')}</DialogDescription>

        <div className="flex h-full flex-col">
          {/* Header — 与练习 Dialog 一致 */}
          <div className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-9 md:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CheckCircle2 className="size-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {record.topicTitle || t('learning.warmupPractice')} · {t('common.total')} {record.score ?? '-'} {t('learning.scoreUnit')}
                </p>
                <h2 className="truncate text-lg font-bold leading-tight text-foreground">
                  {current?.zh || t('learning.practiceReview')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          </div>

          {/* Body — 当前题目卡片 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
            <div key={currentIdx} className="h-full">
              {renderCard()}
            </div>
          </div>

          {/* Footer — 与练习 Dialog 完全一致的导航栏 */}
          <div className={cn('flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3', isIOS() && 'pb-safe')}>
            <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev} className="gap-1">
              <ChevronLeft className="size-4" />
              <span className="ml-1">{t('todayTask.prevQuestion')}</span>
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentIdx + 1} / {total}
            </span>
            <Button variant="outline" size="sm" onClick={gotoNext} disabled={!hasNext} className="gap-1">
              <span className="mr-1">{t('todayTask.nextQuestion')}</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


// ─── 练习记录列表内容 ──────────────────────────────────────────────────────
function PracticeRecordsContent() {
  const { t, i18n } = useTranslation()
  const [data, setData] = useState<PracticeRecordsResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<PracticeRecord | null>(null)
  const pageSize = 15

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    practiceRepository.listPracticeRecords({ page, pageSize })
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
  }, [page])

  const columns: ColumnConfig<PracticeRecord>[] = [
    {
      key: 'topicName',
      header: t('profile.practiceRecords.columns.topic'),
      cell: (v, row) => (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium">{v}</span>
            {row.questionText && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{row.questionText}</p>
            )}
            {row.summary && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">{row.summary}</p>
            )}
          </div>
          <Eye className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
        </div>
      ),
    },
    {
      key: 'status',
      header: t('profile.practiceRecords.columns.status'),
      width: 110,
      cell: (v, row) => (
        <div className="space-y-1">
          <Badge variant={v === 'analyzed' ? 'default' : v === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
            {v === 'analyzed' ? t('profile.practiceRecords.status.analyzed') : v === 'analyzing' ? t('profile.practiceRecords.status.analyzing') : v === 'completed' ? t('profile.practiceRecords.status.completed') : v === 'failed' ? t('profile.practiceRecords.status.failed') : t('profile.practiceRecords.status.inProgress')}
          </Badge>
          <div className="text-[11px] text-muted-foreground">
            {typeof row.score === 'number' && <span className="font-semibold text-primary tabular-nums">{row.score}{t('profile.reviewScoreUnit')}</span>}
            {typeof row.score === 'number' && <span className="mx-1 text-border">·</span>}
            <span>{row.practiceCount}{t('profile.reviewPracticeCountUnit')}</span>
          </div>
        </div>
      ),
      align: 'center',
    },
    {
      key: 'lastPracticeAt',
      header: t('profile.practiceRecords.columns.date'),
      cell: (v) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {new Date(v).toLocaleDateString(i18n.language)}
        </span>
      ),
      align: 'center',
    },
  ]

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
        {t('profile.reviewIncompleteHint')}
      </p>
      <ConfigDataTable
        data={data?.list || []}
        columns={columns}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t('profile.practiceRecords.empty')}
        onRowClick={setSelectedRecord}
      />
      <PracticeRecordReadonlyReviewDrawer
        record={selectedRecord}
        open={Boolean(selectedRecord)}
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
    ? character.expressions as Record<string, string>
    : {}
  const spriteUrl = expressions.default || character?.spriteBaseUrl || undefined
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
          <div className="h-full overflow-y-auto bg-background">
            <div className="mx-auto max-w-2xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={() => setShowAnalysis(false)}>{t('profile.reviewBackToChat')}</Button>
                <Badge variant={passed ? 'default' : 'secondary'} className={cn('rounded-full', passed && 'bg-emerald-600 hover:bg-emerald-600')}>
                  {score > 0 ? `${score} ${t('profile.reviewScoreUnit')} · ${passed ? t('profile.reviewScorePassed') : t('profile.reviewScoreRetry')}` : t('profile.reviewScorePending')}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
              </div>
              {session.analysisResult ? (
                <PracticeAnalysisPanel analysis={session.analysisResult} loading={false} readOnly />
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
          <div className="relative h-full bg-background">
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
