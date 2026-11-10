import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clapperboard,
  Clock3,
  Download,
  Film,
  Footprints,
  Heart,
  History,
  Image,
  Loader2,
  Layers3,
  LockKeyhole,
  Maximize2,
  Play,
  RotateCcw,
  Search,
  ShoppingBag,
  SmilePlus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Virtuoso } from 'react-virtuoso'
import Lightbox from 'yet-another-react-lightbox'
import Video from 'yet-another-react-lightbox/plugins/video'
import 'yet-another-react-lightbox/styles.css'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { ConfigDataTable, type ColumnConfig } from '@/components/common/config-datatable'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PracticeAnalysisPanel } from '@/features/practice/components/practice-analysis-panel'
import {
  learningApi,
  type LearningUnitSummary,
  type MyUnit,
  type StoryEpisodePlayerData,
} from '@/features/learning/api/learning-api'
import {
  scriptCommunityApi,
  type ScriptPracticeMode,
  type ScriptPublishHistoryItem,
  type ScriptPracticeRecord,
  type ScriptWork,
  type ScriptWorkKind,
} from '@/features/scripts/api/script-community-api'
import {
  LearningPackDownloadDrawer,
  LearningPackDownloadStatusButton,
} from '@/layout/learning-pack-download-monitor'
import { useLearningStore } from '@/stores/learning.store'
import { cn } from '@/lib/cn'
import { enqueueScriptVideoRender } from '@/features/scripts/lib/request-script-video-render'
import { buildStoryRepeatFrames } from '@/features/scripts/lib/story-repeat-frames'
import { ScriptRecordVnReplay } from '@/features/scripts/components/script-record-vn-replay'
import { useGlobalTaskStore } from '@/stores/global-task.store'
import { useOnboardingStore } from '@/stores/onboarding.store'
import {
  prepareStoryVnEntry,
  type PreparedStoryVnEntry,
} from '@/features/vn-engine/prepare-story-vn-entry'
import { useInstalledVnMedia } from '@/features/vn-engine/use-installed-vn-media'
import { VnMixedPreviewPlayer } from '@/features/admin/components/vn-mixed-preview-player'
import { practiceRepository } from '@/lib/offline'
import { useAuth } from '@/providers/auth-provider'
import { getFileAssetPrivateUrl } from '@/features/file-assets/api'
import { usePackDisplayUrl } from '@/hooks/use-pack-display-url'
import { displayLearningUnitLocation } from '@/features/learning/lib/learning-unit-display'

/**
 * Package card artwork. Prefer the installed pack's local cover file; otherwise
 * use the API content URL (same contract as learning-plan covers).
 */
function ScriptCover({
  url,
  packId,
  className,
  iconClassName = 'size-7',
}: {
  url?: string | null
  packId?: string | null
  className: string
  iconClassName?: string
}) {
  const resolvedUrl = usePackDisplayUrl(url, packId)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [resolvedUrl])

  if (resolvedUrl && !failed) {
    return (
      <img
        src={resolvedUrl}
        alt=""
        className={className}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span className="flex size-full items-center justify-center text-muted-foreground">
      <Clapperboard className={iconClassName} />
    </span>
  )
}

function isAfterPracticeReset(createdAt: string, resetAt: string | null) {
  return !resetAt || createdAt.localeCompare(resetAt) >= 0
}

function isNqtrScriptUnit(unit: Pick<LearningUnitSummary, 'packageType' | 'contentMode'>) {
  return unit.packageType === 'nqtr' || unit.contentMode === 'nqtr'
}

function scriptPackageTypeLabel(
  unit: Pick<LearningUnitSummary, 'packageType' | 'contentMode'>,
  t: (key: string) => string,
) {
  return isNqtrScriptUnit(unit) ? t('scripts.interactiveNovel') : t('scripts.spokenScript')
}

function getScriptShopChapters(unit: LearningUnitSummary) {
  // Script packages have their own chapter models. `topics` contains warm-up
  // exercises and may legitimately be empty even when the script has chapters.
  return unit.scriptChapters ?? unit.topics
}

function getScriptShopChapterCount(unit: LearningUnitSummary) {
  return unit.scriptChapters?.length ?? unit.scriptCount
}

function practiceRecordFromWork(
  work: ScriptWork,
  records: ScriptPracticeRecord[] = [],
): ScriptPracticeRecord | null {
  if (work.recordId) {
    const existing = records.find((record) => record.id === work.recordId)
    if (existing) return existing
  }
  if (!work.recordId) return null
  const mode: ScriptPracticeMode = work.kind === 'repeat_video' || work.renderPayload?.mode === 'repeat'
    ? 'repeat'
    : 'vn'
  return {
    id: work.recordId,
    episodeId: work.episodeId,
    mode,
    status: 'completed',
    durationSec: work.durationSec,
    turnCount: 0,
    lineCount: 0,
    usedChunkCount: 0,
    completedObjectiveCount: 0,
    score: null,
    completedAt: work.createdAt,
    createdAt: work.createdAt,
    resultSnapshot: (work.renderPayload?.resultSnapshot ?? null) as ScriptPracticeRecord['resultSnapshot'],
    episode: {
      id: work.episode.id,
      title: work.episode.title,
      chapterName: work.episode.chapterName,
      characterName: '',
      scene: work.episode.scene,
    },
    works: [{ id: work.id, status: work.status, kind: work.kind }],
  }
}

function useVideoFullscreenOrientation() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const lockLandscape = () => {
      void ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => undefined)
    }
    const restoreOrientation = () => {
      void ScreenOrientation.unlock().catch(() => undefined)
    }
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement
      if (fullscreenElement?.tagName === 'VIDEO' || fullscreenElement?.querySelector('video')) {
        lockLandscape()
      } else {
        restoreOrientation()
      }
    }

    // iOS native video fullscreen does not use the standard Fullscreen API.
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitbeginfullscreen', lockLandscape, true)
    document.addEventListener('webkitendfullscreen', restoreOrientation, true)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitbeginfullscreen', lockLandscape, true)
      document.removeEventListener('webkitendfullscreen', restoreOrientation, true)
      restoreOrientation()
    }
  }, [])
}

export function ScriptCenterPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  useVideoFullscreenOrientation()
  const [searchParams, setSearchParams] = useSearchParams()
  const panel = searchParams.get('panel')
  const tab = searchParams.get('tab') === 'square' ? 'square' : 'mine'
  const [shopOpen, setShopOpen] = useState(panel === 'store')
  const [recordsOpen, setRecordsOpen] = useState(panel === 'records')
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [publishHistoryOpen, setPublishHistoryOpen] = useState(false)
  const [practiceSameWork, setPracticeSameWork] = useState<ScriptWork | null>(null)
  const [shopFocus, setShopFocus] = useState<{ unitId: string; episodeId: string } | null>(null)
  const [shopUnits, setShopUnits] = useState<LearningUnitSummary[]>([])
  const [shopLoading, setShopLoading] = useState(false)
  const [records, setRecords] = useState<ScriptPracticeRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  // Replay deliberately lives at the page level rather than inside the records
  // drawer.  The drawer and the theatre are two independent layers: dismissing
  // the theatre must never participate in Vaul's drag-to-dismiss gesture.
  const [replayRecord, setReplayRecord] = useState<ScriptPracticeRecord | null>(null)
  const [generating, setGenerating] = useState<Record<string, number>>({})
  // Closing the replay Dialog can finish as a synthetic Vaul dismiss on any
  // underlying sheet (practice records / practice history). Swallow that once.
  const ignoreReplayDismissOnSheetRef = useRef(false)
  // Opening replay from works library also fires Dialog onOpenChange(false) on
  // the works page before replayOpen commits — hold it open synchronously.
  const suppressWorksCloseRef = useRef(false)
  const observedVideoTaskStates = useRef(new Map<string, 'running' | 'done' | 'error'>())
  const recordsRequest = useRef(0)
  const worksRequest = useRef(0)
  const feedRequest = useRef(0)
  const shopRequest = useRef(0)
  const [recordsOwnerId, setRecordsOwnerId] = useState<string | null>(null)
  const [worksOwnerId, setWorksOwnerId] = useState<string | null>(null)
  const [feedOwnerId, setFeedOwnerId] = useState<string | null>(null)
  const [shopOwnerId, setShopOwnerId] = useState<string | null>(null)
  const [works, setWorks] = useState<ScriptWork[]>([])
  // 进入“我的”Tab 必定会加载作品，初始即为 true，避免作品加载时
  // “还没有作品”空状态与骨架屏来回闪烁。
  const [worksLoading, setWorksLoading] = useState(true)
  const [feed, setFeed] = useState<ScriptWork[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)
  const [feedCursor, setFeedCursor] = useState<string | null>(null)

  const myUnits = useLearningStore((state) => state.myUnits)
  const myLoading = useLearningStore((state) => state.myLoading)
  const downloadedPacks = useLearningStore((state) => state.downloadedPacks)
  const downloadTasks = useLearningStore((state) => state.downloadTasks)
  const fetchMyLearning = useLearningStore((state) => state.fetchMyLearning)
  const refreshMyUnits = useLearningStore((state) => state.refreshMyUnits)
  const fetchDownloadedPacks = useLearningStore((state) => state.fetchDownloadedPacks)
  const downloadUnitPack = useLearningStore((state) => state.downloadUnitPack)
  const enrollUnit = useLearningStore((state) => state.enrollUnit)
  const quitUnit = useLearningStore((state) => state.quitUnit)
  const globalTasks = useGlobalTaskStore((state) => state.tasks)
  const onboardingCompletedSegments = useOnboardingStore((state) => state.completedSegments)

  const storyUnits = useMemo(
    () => myUnits.filter((unit) => unit.packageType === 'story' || unit.packageType === 'nqtr' || unit.contentMode === 'nqtr'),
    [myUnits],
  )

  // 剧本页加载完成即触发，目标是始终存在的“剧本商店”入口；无剧本数据时也能看到引导。
  useEffect(() => {
    if (!myLoading) {
      useOnboardingStore.getState().tryStartSegment('scripts')
    }
  }, [myLoading, onboardingCompletedSegments])
  const installedIds = useMemo(
    () => new Set(downloadedPacks.filter((pack) => pack.status === 'installed').map((pack) => pack.packId)),
    [downloadedPacks],
  )
  const activeUnit = useMemo(
    () => [...storyUnits].sort((a, b) => b.completionPercent - a.completionPercent)[0] ?? null,
    [storyUnits],
  )

  useEffect(() => {
    // 数据在启动时已加载过；再次进入时静默后台刷新（不翻转 myLoading），
    // 避免每次切到剧本页都闪现 loading 再回到空状态。
    void fetchMyLearning(true)
    void fetchDownloadedPacks()
  }, [fetchDownloadedPacks, fetchMyLearning])

  useEffect(() => {
    setShopOpen(panel === 'store')
    setRecordsOpen(panel === 'records')
  }, [panel])

  const setPanel = useCallback((next: 'store' | 'records' | 'works' | null) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('panel', next)
    else {
      params.delete('panel')
      setShopFocus(null)
    }
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const openPracticeSameInShop = useCallback((work: ScriptWork) => {
    setShopFocus({
      unitId: work.episode.scene.id,
      episodeId: work.episode.id,
    })
    setPracticeSameWork(null)
    setPanel('store')
  }, [setPanel])

  const closeReplay = useCallback(() => {
    // Vaul listens at the document level. When the full-screen dialog is
    // removed from a close-button click, the same pointer sequence can finish
    // as a drawer dismiss. Consume that one synthetic dismissal only.
    ignoreReplayDismissOnSheetRef.current = true
    setReplayRecord(null)
    window.setTimeout(() => {
      ignoreReplayDismissOnSheetRef.current = false
    }, 0)
  }, [])

  const loadShop = useCallback(async () => {
    const requestId = ++shopRequest.current
    const ownerId = userId
    setShopLoading(true)
    try {
      const [storyResult, nqtrResult] = await Promise.all([
        learningApi.getUnits({ packageType: 'story', page: 1, pageSize: 30 }),
        learningApi.getUnits({ packageType: 'nqtr', page: 1, pageSize: 30 }),
      ])
      const merged = [...(storyResult.list ?? []), ...(nqtrResult.list ?? [])]
      if (shopRequest.current !== requestId) return
      setShopUnits(merged)
      setShopOwnerId(ownerId)
    } catch {
      if (shopRequest.current !== requestId) return
      toast.error(t('scripts.shopLoadFailed'))
    } finally {
      if (shopRequest.current === requestId) setShopLoading(false)
    }
  }, [t, userId])

  const loadRecords = useCallback(async () => {
    const requestId = ++recordsRequest.current
    const ownerId = userId
    setRecordsLoading(true)
    try {
      const allRecords: ScriptPracticeRecord[] = []
      let cursor: string | undefined
      do {
        const result = await scriptCommunityApi.myRecords({ limit: 50, cursor })
        allRecords.push(...result.list)
        cursor = result.nextCursor ?? undefined
      } while (cursor)
      const resetAt = await practiceRepository.getPracticeDataResetAt()
      if (recordsRequest.current !== requestId) return
      setRecords(allRecords.filter((record) => isAfterPracticeReset(record.createdAt, resetAt)))
      setRecordsOwnerId(ownerId)
    } catch {
      if (recordsRequest.current !== requestId) return
      setRecords([])
      setRecordsOwnerId(ownerId)
    } finally {
      if (recordsRequest.current === requestId) setRecordsLoading(false)
    }
  }, [userId])

  const loadWorks = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const requestId = ++worksRequest.current
    const ownerId = userId
    if (!silent) setWorksLoading(true)
    try {
      const allWorks: ScriptWork[] = []
      let cursor: string | undefined
      do {
        const result = await scriptCommunityApi.myWorks({ limit: 50, cursor })
        allWorks.push(...result.list)
        cursor = result.nextCursor ?? undefined
      } while (cursor)
      const resetAt = await practiceRepository.getPracticeDataResetAt()
      if (worksRequest.current !== requestId) return
      setWorks(allWorks.filter((work) => isAfterPracticeReset(work.createdAt, resetAt)))
      setWorksOwnerId(ownerId)
    } catch {
      if (worksRequest.current !== requestId) return
      setWorks([])
      setWorksOwnerId(ownerId)
    } finally {
      if (!silent && worksRequest.current === requestId) setWorksLoading(false)
    }
  }, [userId])

  const generateReplayVideo = useCallback(async (record: ScriptPracticeRecord) => {
    if (generating[record.id] || record.works?.some((work) => work.status === 'rendering')) return
    setGenerating((current) => ({ ...current, [record.id]: 1 }))
    try {
      const work = await scriptCommunityApi.createWork({
        recordId: record.id,
        kind: record.mode === 'repeat' ? 'repeat_video' : 'vn_video',
        title: t('scripts.workCompletedTitle', { title: record.episode.title }),
        caption: `${record.mode === 'repeat' ? t('scripts.repeatTheater') : t('scripts.vnInteractive')} · ${t('scripts.timesSpoken', { count: record.mode === 'repeat' ? record.lineCount : record.turnCount })}`,
      })
      await generateAndPublishExistingWork(work, (progress) => {
        setGenerating((current) => ({ ...current, [record.id]: progress }))
      })
      setReplayRecord((current) => current?.id === record.id
        ? { ...current, works: [{ id: work.id, status: 'rendering', kind: work.kind }] }
        : current)
      await Promise.all([loadWorks(), loadRecords()])
      toast.success(t('scripts.createdSubmittedRendering'))
    } catch (error: any) {
      toast.error(error?.message || t('scripts.videoGenerateFailedRetry'))
    } finally {
      setGenerating((current) => {
        const next = { ...current }
        delete next[record.id]
        return next
      })
    }
  }, [generating, loadRecords, loadWorks, t])

  const loadFeed = useCallback(async (cursor?: string, append = false) => {
    const requestId = append ? feedRequest.current : ++feedRequest.current
    const ownerId = userId
    if (append) setFeedLoadingMore(true)
    else setFeedLoading(true)
    try {
      const result = await scriptCommunityApi.feed({ cursor, limit: 20 })
      if (feedRequest.current !== requestId) return
      setFeed((current) => append ? [...current, ...result.list] : result.list)
      setFeedCursor(result.nextCursor)
      setFeedOwnerId(ownerId)
    } catch {
      if (feedRequest.current !== requestId) return
      if (!append) {
        setFeed([])
        setFeedOwnerId(ownerId)
      }
    } finally {
      if (feedRequest.current !== requestId) return
      setFeedLoading(false)
      setFeedLoadingMore(false)
    }
  }, [userId])

  const updateFeedWork = useCallback((
    workId: string,
    updater: (work: ScriptWork) => ScriptWork,
  ) => {
    setFeed((current) => current.map((work) => work.id === workId ? updater(work) : work))
  }, [])

  useEffect(() => {
    recordsRequest.current += 1
    worksRequest.current += 1
    feedRequest.current += 1
    shopRequest.current += 1
    setRecords([])
    setReplayRecord(null)
    setWorks([])
    setWorksLoading(true)
    setFeed([])
    setFeedCursor(null)
    setShopUnits([])
  }, [userId])

  useEffect(() => {
    if (shopOpen) void loadShop()
  }, [loadShop, shopOpen, userId])

  useEffect(() => {
    if (recordsOpen || panel === 'works') void loadRecords()
  }, [loadRecords, panel, recordsOpen, userId])

  useEffect(() => {
    if (tab === 'mine') void loadWorks()
  }, [loadWorks, tab, userId])

  const recordsReady = recordsOwnerId === userId
  const worksReady = worksOwnerId === userId
  const feedReady = feedOwnerId === userId
  const shopReady = shopOwnerId === userId
  const visibleRecords = useMemo(() => (recordsReady ? records : []), [records, recordsReady])
  const visibleWorks = useMemo(() => (worksReady ? works : []), [works, worksReady])
  const visibleFeed = useMemo(() => (feedReady ? feed : []), [feed, feedReady])
  const visibleShopUnits = useMemo(() => (shopReady ? shopUnits : []), [shopReady, shopUnits])
  const visibleReplay = replayRecord

  useEffect(() => {
    if (!visibleReplay) suppressWorksCloseRef.current = false
  }, [visibleReplay])

  // Only the task center polls rendering work. When it reports a terminal
  // state, refresh cloud-backed works and practice records exactly once.
  useEffect(() => {
    const videoTasks = globalTasks.filter((task) => task.kind === 'script_video')
    const settled = videoTasks.filter((task) => (
      (task.status === 'done' || task.status === 'error')
      && observedVideoTaskStates.current.get(task.id) === 'running'
    ))
    observedVideoTaskStates.current = new Map(videoTasks.map((task) => [task.id, task.status]))
    if (settled.length > 0) void Promise.all([loadWorks({ silent: true }), loadRecords()])
  }, [globalTasks, loadRecords, loadWorks])

  // The task drawer may be closed while a render is in progress. Keep a small
  // fallback refresh for this page so its rendering cards still become ready.
  useEffect(() => {
    if (tab !== 'mine' || !visibleWorks.some((work) => work.status === 'rendering')) return
    const timer = window.setInterval(() => void loadWorks({ silent: true }), 15_000)
    return () => window.clearInterval(timer)
  }, [loadWorks, tab, visibleWorks])

  useEffect(() => {
    if (tab === 'square') void loadFeed()
  }, [loadFeed, tab, userId])

  const enroll = async (unit: LearningUnitSummary) => {
    try {
      await enrollUnit(unit.id, unit.title, unit)
      await refreshMyUnits()
      toast.success(t('scripts.joinDownloadStarted', { title: unit.title }))
    } catch {
      toast.error(t('scripts.joinScriptFailed'))
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-3">
      <div className="mb-3 flex items-center justify-between">
        <div />
        <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl">
          <LearningPackDownloadStatusButton onClick={() => setDownloadOpen(true)} embedded />
          <button
            type="button"
            onClick={() => setPublishHistoryOpen(true)}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
            aria-label={t('scripts.publishLog')}
          >
            <History className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => setPanel('records')}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
            aria-label={t('scripts.practiceRecords')}
          >
            <ClipboardList className="size-[18px]" />
          </button>
          <button
            type="button"
            data-spotlight="scripts-shop-button"
            onClick={() => setPanel('store')}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
            aria-label={t('scripts.shop')}
          >
            <ShoppingBag className="size-[18px]" />
          </button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const params = new URLSearchParams(searchParams)
          params.set('tab', value)
          params.delete('panel')
          setSearchParams(params, { replace: true })
        }}
        className="flex flex-col gap-4"
      >
        <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-muted/70 p-1">
          <TabsTrigger value="mine" className="rounded-lg">{t('scripts.mine')}</TabsTrigger>
          <TabsTrigger value="square" className="rounded-lg">{t('scripts.square')}</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-0">
          <MineScripts
            activeUnit={activeUnit}
            units={storyUnits}
            loading={myLoading}
            installedIds={installedIds}
            downloadTasks={downloadTasks}
            onOpenShop={() => setPanel('store')}
            onDownload={downloadUnitPack}
            onQuit={quitUnit}
            works={visibleWorks}
            worksLoading={worksLoading || !worksReady}
            onWorksChanged={loadWorks}
            worksOpen={panel === 'works'}
            onWorksOpenChange={(open) => {
              if (!open && (visibleReplay || suppressWorksCloseRef.current)) return
              setPanel(open ? 'works' : null)
            }}
            records={visibleRecords}
            onOpenReplay={(record) => {
              suppressWorksCloseRef.current = true
              setReplayRecord(record)
            }}
            replayOpen={Boolean(visibleReplay)}
            ignoreReplayDismiss={() => ignoreReplayDismissOnSheetRef.current}
          />
        </TabsContent>

        <TabsContent value="square" className="mt-0">
          <SquareFeed
            works={visibleFeed}
            loading={feedLoading || !feedReady}
            onOpenShop={() => setPanel('store')}
            onPracticeSame={setPracticeSameWork}
            onWorkChanged={updateFeedWork}
            hasMore={Boolean(feedCursor)}
            loadingMore={feedLoadingMore}
            onLoadMore={() => feedCursor ? loadFeed(feedCursor, true) : Promise.resolve()}
          />
        </TabsContent>
      </Tabs>

      <Drawer open={Boolean(practiceSameWork)} onOpenChange={(open) => { if (!open) setPracticeSameWork(null) }}>
        <DrawerContent className="rounded-t-[28px] border-0 bg-background drawer-surface">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">{t('scripts.practiceSameTitle')}</DrawerTitle>
          </DrawerHeader>
          {practiceSameWork && (
            <div className="flex flex-col gap-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <p className="text-sm text-muted-foreground">{t('scripts.practiceSameHint')}</p>
              <div className="flex gap-3 rounded-xl bg-muted/40 p-3">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                  {practiceSameWork.coverUrl || practiceSameWork.episode.scene.coverImage ? (
                    <img
                      src={practiceSameWork.coverUrl ?? practiceSameWork.episode.scene.coverImage ?? undefined}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <Clapperboard className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{practiceSameWork.episode.scene.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {practiceSameWork.episode.chapterName} · {practiceSameWork.episode.title}
                  </p>
                  <Badge variant="secondary" className="mt-2 h-5 rounded-full px-2 text-[10px]">
                    {practiceSameWork.kind === 'progress_card'
                      ? t('scripts.learningProgress')
                      : practiceSameWork.kind === 'vn_video'
                        ? t('scripts.workKindVn')
                        : t('scripts.workKindRepeat')}
                  </Badge>
                </div>
              </div>
              <Button className="w-full" onClick={() => openPracticeSameInShop(practiceSameWork)}>
                <ShoppingBag data-icon="inline-start" />
                {t('scripts.practiceSameGoShop')}
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <LearningPackDownloadDrawer open={downloadOpen} onOpenChange={setDownloadOpen} />
      <ScriptPublishHistoryDialog
        open={publishHistoryOpen}
        onOpenChange={setPublishHistoryOpen}
      />

      <Drawer
        open={recordsOpen}
        // A replay is a modal layer, so the underlying sheet must not react to
        // any of its pointer gestures while it is visible.
        dismissible={!visibleReplay}
        onOpenChange={(open) => {
          if (!open && ignoreReplayDismissOnSheetRef.current) return
          setPanel(open ? 'records' : null)
        }}
      >
        <DrawerContent showHandle={false} className="flex h-[95dvh] max-h-[95dvh] flex-col rounded-t-[28px] bg-background drawer-surface">
          <DrawerHeader className="shrink-0 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] text-left">
            <DrawerTitle className="text-base font-semibold">{t('scripts.practiceRecords')}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <RecordList records={visibleRecords} loading={recordsLoading || !recordsReady} onOpenReplay={setReplayRecord} />
          </div>
        </DrawerContent>
      </Drawer>

      <ScriptRecordReplayDialog
        record={visibleReplay}
        onClose={closeReplay}
        generatingProgress={visibleReplay ? generating[visibleReplay.id] : undefined}
        videoQueued={Boolean(visibleReplay && (
          visibleReplay.works?.some((work) => work.status === 'rendering')
        ))}
        onGenerateVideo={generateReplayVideo}
        onRecordUpdated={(next) => {
          setReplayRecord(next)
          setRecords((current) => current.map((item) => item.id === next.id ? next : item))
        }}
      />

      <Drawer open={shopOpen} onOpenChange={(open) => setPanel(open ? 'store' : null)}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background drawer-surface">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">{t('scripts.shop')}</DrawerTitle>
          </DrawerHeader>
          <div className="h-[calc(88vh-4rem)] overflow-x-hidden overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <ScriptShop
              units={visibleShopUnits}
              ownedIds={new Set(storyUnits.map((unit) => unit.id))}
              installedIds={installedIds}
              downloadTasks={downloadTasks}
              loading={shopLoading || !shopReady}
              focusUnitId={shopFocus?.unitId}
              focusEpisodeId={shopFocus?.episodeId}
              onRefresh={loadShop}
              onEnroll={enroll}
              onDownload={downloadUnitPack}
              onNavigate={() => setPanel(null)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function MineScripts({
  activeUnit,
  units,
  loading,
  installedIds,
  downloadTasks,
  onOpenShop,
  onDownload,
  onQuit,
  works,
  worksLoading,
  onWorksChanged,
  worksOpen,
  onWorksOpenChange,
  records,
  onOpenReplay,
  replayOpen,
  ignoreReplayDismiss,
}: {
  activeUnit: MyUnit | null
  units: MyUnit[]
  loading: boolean
  installedIds: Set<string>
  downloadTasks: Array<{ packId: string; status: string; progress: number }>
  onOpenShop: () => void
  onDownload: (id: string) => Promise<void>
  onQuit: (id: string) => Promise<void>
  works: ScriptWork[]
  worksLoading: boolean
  onWorksChanged: () => Promise<void>
  worksOpen: boolean
  onWorksOpenChange: (open: boolean) => void
  records: ScriptPracticeRecord[]
  onOpenReplay: (record: ScriptPracticeRecord) => void
  replayOpen: boolean
  ignoreReplayDismiss: () => boolean
}) {
  const { t } = useTranslation()
  const [deletingUnit, setDeletingUnit] = useState<MyUnit | null>(null)
  const [deleting, setDeleting] = useState(false)

  const removeScript = async () => {
    if (!deletingUnit || deleting) return
    setDeleting(true)
    try {
      await onQuit(deletingUnit.id)
      setDeletingUnit(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading && units.length === 0) {
    return (
      <div className="rounded-lg bg-muted/30 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="size-4 animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{t('scripts.fetchingPlan')}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t('scripts.syncingProgress')}</p>
          </div>
        </div>
      </div>
    )
  }

  // “你没有开始练习剧本”的空状态只放在“我的剧本”区块内展示，
  // 不再整页返回，避免隐藏“我的作品”等独立数据，也避免空状态与内容来回切换闪烁。
  return (
    <div className="flex flex-col gap-6" data-spotlight="first-script-card">
      {activeUnit && (() => {
        const activeInstalled = installedIds.has(activeUnit.id)
        const activeDownloading = downloadTasks.some((task) => task.packId === activeUnit.id && task.status !== 'error' && task.status !== 'done')
        return (
        <section className="flex flex-col gap-2">
          <p className="px-1 text-xs font-medium text-muted-foreground">{t('scripts.continuePerformance')}</p>
          <Card className="group relative overflow-hidden border-0 bg-muted/30 shadow-none ring-0 dark:ring-0">
            <div className="relative aspect-[2.8/1] overflow-hidden bg-muted/50">
              <ScriptCover
                url={activeUnit.coverImage}
                packId={activeUnit.id}
                className="size-full object-cover"
                iconClassName="size-8 text-muted-foreground"
              />
              <Badge variant="secondary" className="absolute left-2.5 top-2.5 h-5 px-2 text-[10px]">
                {Math.round(activeUnit.completionPercent)}%
              </Badge>
              <button
                type="button"
                onClick={() => setDeletingUnit(activeUnit)}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground"
                aria-label={`${t('learning.quitUnit')} ${activeUnit.title}`}
              >
                <Trash2 className="size-3.5" />
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-background/80 px-2.5 py-1.5 backdrop-blur-sm">
                <Progress value={activeUnit.completionPercent} className="h-1" />
              </div>
            </div>
            <div className={cn('space-y-2 p-2.5', !activeInstalled && 'opacity-70')}>
              <div className="flex items-center gap-2">
                <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">{activeUnit.title}</h1>
                <p className="shrink-0 text-[11px] text-muted-foreground">
                  {displayLearningUnitLocation(activeUnit.location, t('scripts.pocketTheater'))}
                </p>
              </div>
              {!activeInstalled ? (
                <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-2.5 py-1.5">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {activeDownloading ? t('scripts.preparingOffline') : t('scripts.packNeedsDownload')}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 shrink-0 rounded-full px-0 text-foreground hover:bg-muted"
                    disabled={activeDownloading}
                    onClick={() => void onDownload(activeUnit.id)}
                    aria-label={t('scripts.downloadScript')}
                  >
                    {activeDownloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button asChild size="sm" className="h-8 flex-1 rounded-full text-xs">
                    <Link to={`/scripts/packages/${activeUnit.id}`}>
                      <Play data-icon="inline-start" />
                      {t('scripts.continueStory')}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary" className="h-8 rounded-full border-0 bg-primary/10 px-3 text-xs text-primary shadow-none hover:bg-primary/16 hover:text-primary">
                    <Link to={`/scripts/packages/${activeUnit.id}`}>{t('scripts.chapterList')}</Link>
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </section>
        )
      })()}

      {/* <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-muted-foreground">最近练习</p>
          <Button variant="ghost" size="sm" onClick={onOpenRecords}>全部记录</Button>
        </div>
        <button
          type="button"
          onClick={onOpenRecords}
          className="flex items-center gap-3 rounded-2xl bg-muted/35 p-4 text-left transition-colors hover:bg-muted/55"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-primary">
            <Film className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">查看章节练习与最佳演出</p>
            <p className="mt-0.5 text-xs text-muted-foreground">VN、跟读和后续视频作品都会保留在这里</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </section> */}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-muted-foreground">{t('scripts.myWorks')}</p>
          <Button variant="ghost" size="sm" onClick={() => onWorksOpenChange(true)}>{t('scripts.viewMore')}</Button>
        </div>
        <MyWorks works={works} loading={worksLoading} onChanged={onWorksChanged} />
        <WorksLibraryDialog
          open={worksOpen}
          onOpenChange={onWorksOpenChange}
          works={works}
          loading={worksLoading}
          onChanged={onWorksChanged}
          records={records}
          onOpenReplay={onOpenReplay}
          replayOpen={replayOpen}
          ignoreReplayDismiss={ignoreReplayDismiss}
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-muted-foreground">{t('scripts.myScripts')}</p>
          <Button variant="ghost" size="sm" onClick={onOpenShop}>{t('scripts.exploreMore')}</Button>
        </div>
        {units.length === 0 ? (
          <div className="rounded-lg bg-muted/30 p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clapperboard className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{t('scripts.noScriptsYet')}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t('scripts.scriptsHint')}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" size="sm" className="h-9 rounded-full border-0 px-5 text-xs shadow-none" onClick={onOpenShop}>
                {t('scripts.goToShop')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="-mx-2 flex snap-x gap-2 overflow-x-auto px-2 pb-1">
            {units.map((unit) => {
            const installed = installedIds.has(unit.id)
            const downloading = downloadTasks.some((task) => task.packId === unit.id && task.status !== 'error' && task.status !== 'done')
            const blocked = !installed || downloading
            const location = displayLearningUnitLocation(unit.location, scriptPackageTypeLabel(unit, t))

            return (
              <div key={unit.id} className="group relative w-44 shrink-0 snap-start">
                <Card className="w-44 shrink-0 snap-start overflow-hidden border-0 bg-muted/30 shadow-none ring-0 transition-transform group-active:scale-[0.98] dark:ring-0">
                  <Link
                    to={`/scripts/packages/${unit.id}`}
                    aria-disabled={blocked}
                    onClick={(event) => {
                      if (blocked) event.preventDefault()
                    }}
                    className={cn('block', blocked && 'cursor-default opacity-70')}
                  >
                    <div className="relative aspect-video overflow-hidden bg-muted/50">
                      <ScriptCover
                        url={unit.coverImage}
                        packId={unit.id}
                        className="size-full object-cover"
                        iconClassName="size-8 text-muted-foreground"
                      />
                      <Badge variant="secondary" className="absolute left-3 top-3">
                        {scriptPackageTypeLabel(unit, t)}
                      </Badge>
                      {!installed && (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-background/80 px-2.5 py-1.5 backdrop-blur-sm">
                          <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                            {downloading ? t('scripts.preparingOffline') : t('scripts.packNeedsDownload')}
                          </p>
                          <span
                            role="button"
                            tabIndex={0}
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center rounded-full text-foreground',
                              downloading ? 'opacity-60' : 'hover:bg-muted',
                            )}
                            aria-label={t('scripts.downloadScript')}
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              if (!downloading) void onDownload(unit.id)
                            }}
                            onKeyDown={(event) => {
                              if (downloading) return
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                event.stopPropagation()
                                void onDownload(unit.id)
                              }
                            }}
                          >
                            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                          </span>
                        </div>
                      )}
                    </div>
                    <CardHeader className="p-2.5 pb-2">
                      <CardTitle className="truncate text-sm">{unit.title}</CardTitle>
                      <CardDescription className="truncate text-xs">
                        {t('scripts.chapters', { count: unit.scriptCount })} · {location}
                      </CardDescription>
                    </CardHeader>
                  </Link>
                </Card>
              <button
                type="button"
                onClick={() => setDeletingUnit(unit)}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground"
                aria-label={`${t('learning.quitUnit')} ${unit.title}`}
              >
                <Trash2 className="size-3.5" />
              </button>
              </div>
            )
            })}
          </div>
        )}
      </section>
      <Dialog open={Boolean(deletingUnit)} onOpenChange={(open) => { if (!open && !deleting) setDeletingUnit(null) }}>
        <DialogContent className="w-[90vw] max-w-xs rounded-2xl p-6 sm:mx-auto">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base">{t('learning.quitConfirmTitle')}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-5">
              {deletingUnit ? t('learning.quitConfirmDesc', { title: deletingUnit.title }) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" className="flex-1 rounded-xl border-0 shadow-none" disabled={deleting} onClick={() => setDeletingUnit(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" className="flex-1 rounded-xl" disabled={deleting} onClick={() => void removeScript()}>
              {deleting && <Loader2 className="animate-spin" />}
              {t('learning.quitConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

async function generateAndPublishExistingWork(
  work: ScriptWork,
  onProgress: (progress: number) => void,
) {
  const taskId = `script-video:${work.id}`
  const gts = useGlobalTaskStore.getState()
  gts.startTask({ id: taskId, kind: 'script_video', title: i18n.t('scripts.performanceVideo', { title: work.episode.title }) })
  try {
  const player = await learningApi.getStoryEpisodePlayer(work.episodeId)
  if (!player.inkScript.inkSource) throw new Error(i18n.t('scripts.scriptIncomplete'))
  const frames = buildStoryRepeatFrames(player, { audioMode: 'render' })
  const task = await enqueueScriptVideoRender({
    workId: work.id,
    frames,
  })
  onProgress(1)
  useGlobalTaskStore.getState().updateTask(taskId, { progress: 1, stepLabel: i18n.t('scripts.submittedRenderingTask', { taskId: task.taskId.slice(-6) }) })
  } catch (error: any) {
    useGlobalTaskStore.getState().updateTask(taskId, {
      status: 'error',
      stepLabel: i18n.t('scripts.videoGenerateFailed'),
      error: error?.message || i18n.t('scripts.videoGenerateFailedRetry'),
    })
    throw error
  }
}

function selectEpisodeRepresentatives(works: ScriptWork[]) {
  const representatives = new Map<string, ScriptWork>()
  for (const work of works) {
    const current = representatives.get(work.episodeId)
    const workIsPublished = work.status === 'published'
    const currentIsPublished = current?.status === 'published'
    if (
      !current ||
      (workIsPublished && !currentIsPublished) ||
      (workIsPublished === currentIsPublished && work.createdAt > current.createdAt)
    ) {
      representatives.set(work.episodeId, work)
    }
  }
  return [...representatives.values()]
}

function workPrimaryActionLabel(work: ScriptWork, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (work.status === 'rendering') return t('scripts.cancelGeneration')
  if (work.status === 'published') return t('scripts.unpublish')
  if (work.videoUrl) return t('scripts.publishExisting')
  if (work.status === 'failed') return t('scripts.regenerateVideo')
  return t('scripts.generateVideo')
}

function MyWorks({
  works,
  loading,
  onChanged,
}: {
  works: ScriptWork[]
  loading: boolean
  onChanged: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [generating, setGenerating] = useState<Record<string, number>>({})

  const togglePublish = async (work: ScriptWork) => {
    try {
      if (work.status === 'rendering' || work.status === 'published') await scriptCommunityApi.unpublishWork(work.id)
      else if (work.videoUrl) await scriptCommunityApi.publishWork(work.id)
      else {
        setGenerating((current) => ({ ...current, [work.id]: 1 }))
        await generateAndPublishExistingWork(work, (progress) => {
          setGenerating((current) => ({ ...current, [work.id]: progress }))
        })
      }
      toast.success(
        work.status === 'rendering'
          ? t('scripts.canceledGenerationKept')
          : work.status === 'published'
            ? t('scripts.workPrivateHint')
            : work.videoUrl
              ? t('scripts.workPublishedHint')
              : t('scripts.submittedGenerationHint'),
      )
      await onChanged()
    } catch (error: any) {
      toast.error(error?.message || t('scripts.workStatusFailed'))
    } finally {
      setGenerating((current) => {
        const next = { ...current }
        delete next[work.id]
        return next
      })
    }
  }

  if (loading) return <Skeleton className="h-36 rounded-2xl" />
  if (works.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Image className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{t('scripts.noWorksYet')}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t('scripts.worksHint')}</p>
        </div>
      </div>
    )
  }

  const latestByEpisode = selectEpisodeRepresentatives(works)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4)

  return (
    <div className="-mx-2 flex snap-x gap-2 overflow-x-auto px-2 pb-1">
      {latestByEpisode.map((work) => (
        <Card key={work.id} className="w-44 shrink-0 snap-start overflow-hidden border-0 bg-muted/30 shadow-none ring-0 dark:ring-0">
          <div className="relative aspect-video bg-muted/50">
            {work.coverUrl && <img src={work.coverUrl} alt="" className="size-full object-cover" />}
            <Badge variant="secondary" className="absolute left-2 top-2 h-5 px-2 text-[10px]">
              {work.kind === 'progress_card' ? t('scripts.workKindProgressCard') : work.kind === 'vn_video' ? t('scripts.workKindVn') : t('scripts.workKindRepeat')}
            </Badge>
          </div>
          <CardHeader className="p-2.5 pb-2">
            <p className="flex items-center gap-1 truncate text-[11px] font-medium text-primary">
              <BookOpen className="size-3 shrink-0" />
              <span className="truncate">{t('scripts.scriptLabel', { title: work.episode.scene.title })}</span>
            </p>
            <CardTitle className="truncate text-sm">{work.title}</CardTitle>
            <CardDescription className="truncate text-xs">{t('scripts.chapterLabel', { name: work.episode.chapterName })}</CardDescription>
          </CardHeader>
          <CardFooter className="px-2.5 pb-2.5">
            {/* Temporarily hide generate/regenerate video; keep publish/unpublish/cancel only. */}
            {(work.videoUrl || work.status === 'rendering' || work.status === 'published' || generating[work.id]) ? (
            <div className="w-full">
              <Button
                size="sm"
                variant={work.status === 'rendering' || work.status === 'published' ? 'secondary' : 'default'}
                className="h-8 w-full rounded-full border-0 text-xs shadow-none"
                disabled={Boolean(generating[work.id])}
                onClick={() => void togglePublish(work)}
              >
                {generating[work.id]
                  ? t('scripts.generating', { percent: generating[work.id] })
                  : workPrimaryActionLabel(work, t)}
              </Button>
              {generating[work.id] && <Progress value={generating[work.id]} className="mt-1.5 h-1" />}
            </div>
            ) : null}
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

function WorksLibraryDialog({
  open,
  onOpenChange,
  works,
  loading,
  onChanged,
  records,
  onOpenReplay,
  replayOpen,
  ignoreReplayDismiss,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  works: ScriptWork[]
  loading: boolean
  onChanged: () => Promise<void>
  records: ScriptPracticeRecord[]
  onOpenReplay: (record: ScriptPracticeRecord) => void
  replayOpen: boolean
  ignoreReplayDismiss: () => boolean
}) {
  const { t } = useTranslation()
  const pageSize = 15
  const [search, setSearch] = useState('')
  const [sceneId, setSceneId] = useState('all')
  const [groupMode, setGroupMode] = useState<'time' | 'package'>('time')
  const [page, setPage] = useState(1)
  const [generating, setGenerating] = useState<Record<string, number>>({})
  const [historyWork, setHistoryWork] = useState<ScriptWork | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScriptWork | null>(null)
  const [deletingWork, setDeletingWork] = useState(false)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const holdOpenForReplayRef = useRef(false)

  useEffect(() => {
    if (!replayOpen) holdOpenForReplayRef.current = false
  }, [replayOpen])

  const scenes = useMemo(() => Array.from(
    new Map(works.map((work) => [work.episode.scene.id, work.episode.scene])).values(),
  ), [works])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase()
    const matches = [...works]
      .filter((work) => sceneId === 'all' || work.episode.scene.id === sceneId)
      .filter((work) => !keyword || [
        work.title,
        work.caption,
        work.episode.title,
        work.episode.chapterName,
        work.episode.scene.title,
      ].some((value) => value?.toLocaleLowerCase().includes(keyword)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return selectEpisodeRepresentatives(matches)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [sceneId, search, works])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedWorks = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [currentPage, filtered])

  useEffect(() => {
    setPage(1)
  }, [groupMode, sceneId, search])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPage])

  const episodeAttempts = useMemo(() => {
    const map = new Map<string, ScriptWork[]>()
    works.forEach((work) => map.set(work.episodeId, [...(map.get(work.episodeId) ?? []), work]))
    for (const attempts of map.values()) attempts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return map
  }, [works])

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; works: ScriptWork[] }>()
    pagedWorks.forEach((work) => {
      const date = new Date(work.createdAt)
      const key = groupMode === 'package'
        ? work.episode.scene.id
        : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      const label = groupMode === 'package'
        ? work.episode.scene.title
        : date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
      const group = map.get(key) ?? { label, works: [] }
      group.works.push(work)
      map.set(key, group)
    })
    return Array.from(map.values())
  }, [groupMode, pagedWorks])

  const togglePublish = async (work: ScriptWork) => {
    try {
      if (work.status === 'rendering' || work.status === 'published') await scriptCommunityApi.unpublishWork(work.id)
      else if (work.videoUrl) await scriptCommunityApi.publishWork(work.id)
      else {
        setGenerating((current) => ({ ...current, [work.id]: 1 }))
        await generateAndPublishExistingWork(work, (progress) => {
          setGenerating((current) => ({ ...current, [work.id]: progress }))
        })
      }
      await onChanged()
      if (work.status === 'rendering') toast.success(t('scripts.canceledGenerationKept'))
    } catch (error: any) {
      toast.error(error?.message || t('scripts.workStatusFailed'))
    } finally {
      setGenerating((current) => {
        const next = { ...current }
        delete next[work.id]
        return next
      })
    }
  }

  const deleteWork = async () => {
    if (!deleteTarget || deletingWork) return
    setDeletingWork(true)
    try {
      await scriptCommunityApi.deleteWork(deleteTarget.id)
      await onChanged()
      toast.success(t('scripts.deleteWorkSuccess'))
      setDeleteTarget(null)
    } catch (error: any) {
      toast.error(error?.message || t('scripts.deleteWorkFailed'))
    } finally {
      setDeletingWork(false)
    }
  }

  const openReplayFromLibrary = (record: ScriptPracticeRecord) => {
    holdOpenForReplayRef.current = true
    onOpenReplay(record)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && (replayOpen || holdOpenForReplayRef.current)) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 [&>button]:hidden"
        onInteractOutside={(event) => {
          if (replayOpen || holdOpenForReplayRef.current) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (replayOpen || holdOpenForReplayRef.current) event.preventDefault()
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('scripts.myWorks')}</DialogTitle>
          <DialogDescription>{t('scripts.viewAllWorks')}</DialogDescription>
        </DialogHeader>

        <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 pb-[env(safe-area-inset-bottom,0px)] pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
          <header className="mb-4 flex shrink-0 items-center gap-3">
            <button type="button" onClick={() => onOpenChange(false)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground" aria-label={t('scripts.back')}>
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
              <p className="text-xs text-muted-foreground">{t('scripts.script')}</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">{t('scripts.myWorks')}</h1>
            </div>
            <Badge variant="secondary">{filtered.length}</Badge>
          </header>

          <div className="mb-3 flex shrink-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 rounded-full border-0 bg-muted/70 pl-9 shadow-none" placeholder={t('scripts.searchWorks')} />
            </div>
            <button type="button" onClick={() => setGroupMode('time')} className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', groupMode === 'time' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')} aria-label={t('scripts.groupByTime')}>
              <CalendarDays className="size-4" />
            </button>
            <button type="button" onClick={() => setGroupMode('package')} className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', groupMode === 'package' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')} aria-label={t('scripts.groupByPackage')}>
              <Layers3 className="size-4" />
            </button>
          </div>

          <div className="mb-3 shrink-0 overflow-x-auto">
            <div className="flex gap-2">
              <button type="button" onClick={() => setSceneId('all')} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors', sceneId === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground')}>{t('scripts.allScripts')}</button>
              {scenes.map((scene) => (
                <button key={scene.id} type="button" onClick={() => setSceneId(scene.id)} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors', sceneId === scene.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground')}>{scene.title}</button>
              ))}
            </div>
          </div>

          <div ref={listScrollRef} className="min-h-0 flex-1 overflow-y-auto pb-3">
            {loading ? <MobilePageLoading rows={4} minHeightClassName="min-h-[50vh]" /> : groups.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">{t('scripts.noMatchingWorks')}</div>
            ) : (
              <div className="space-y-5">
                {groups.map((group) => (
                  <section key={group.label}>
                    <div className="mb-2 flex items-center justify-between px-1">
                      <h2 className="text-xs font-medium text-muted-foreground">{group.label}</h2>
                      <span className="text-[11px] text-muted-foreground">{t('scripts.chaptersCount', { count: group.works.length })}</span>
                    </div>
                    <div className="space-y-2">
                      {group.works.map((work) => {
                        const attempts = episodeAttempts.get(work.episodeId) ?? [work]
                        return (
                          <div key={work.id} className="flex gap-3 rounded-lg bg-muted/30 p-3">
                            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted/60">
                              {work.coverUrl && <img src={work.coverUrl} alt="" className="size-full object-cover" />}
                              {work.videoUrl && <Play className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-primary" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="mb-1 flex items-center gap-1 truncate text-[11px] font-medium text-primary">
                                <BookOpen className="size-3 shrink-0" />
                                <span className="truncate">{t('scripts.scriptLabel', { title: work.episode.scene.title })}</span>
                              </p>
                              <div className="flex items-start gap-2">
                                <p className="line-clamp-1 flex-1 text-sm font-semibold">{work.title}</p>
                                {attempts.length > 1 && <Badge variant="secondary" className="h-5 shrink-0 px-2 text-[10px]">{t('scripts.attemptsCount', { count: attempts.length })}</Badge>}
                              </div>
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {t('scripts.chapterLabel', { name: work.episode.chapterName })} · {new Date(work.createdAt).toLocaleString(i18n.language)}
                              </p>
                              <div className="mt-2 flex items-center gap-1.5">
                                <Button size="sm" variant={work.status === 'rendering' || work.status === 'published' ? 'outline' : 'default'} className="h-7 rounded-full px-3 text-[11px]" disabled={Boolean(generating[work.id])} onClick={() => void togglePublish(work)}>
                                  {generating[work.id]
                                    ? t('scripts.submittingVideoTask')
                                    : workPrimaryActionLabel(work, t)}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 rounded-full px-2.5 text-[11px] text-muted-foreground" onClick={() => setHistoryWork(work)}>
                                  <History data-icon="inline-start" />
                                  {t('scripts.history')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 rounded-full px-2 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(work)}
                                  aria-label={t('scripts.deleteWork')}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                              {generating[work.id] && <Progress value={generating[work.id]} className="mt-1.5 h-1 w-32" />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
          {!loading && filtered.length > pageSize && (
            <div className="mb-3 flex shrink-0 items-center justify-between rounded-lg bg-muted/35 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">
                {t('scripts.chaptersCount', { count: filtered.length })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 border-0 bg-primary/10 px-2 text-xs text-primary shadow-none hover:bg-primary/16 hover:text-primary"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {t('scripts.prevPage')}
                </Button>
                <span className="min-w-10 text-center text-[11px] text-muted-foreground">
                  {currentPage}/{totalPages}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 border-0 bg-primary/10 px-2 text-xs text-primary shadow-none hover:bg-primary/16 hover:text-primary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t('scripts.nextPage')}
                </Button>
              </div>
            </div>
          )}
        </div>
        <EpisodeWorkHistoryDrawer
          open={Boolean(historyWork)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && (replayOpen || holdOpenForReplayRef.current || ignoreReplayDismiss())) return
            if (!nextOpen) setHistoryWork(null)
          }}
          works={historyWork ? works.filter((work) => work.episodeId === historyWork.episodeId) : []}
          initialKind={historyWork?.kind}
          onPublish={togglePublish}
          onDelete={setDeleteTarget}
          records={records}
          onOpenReplay={openReplayFromLibrary}
          replayOpen={replayOpen}
        />
        <Dialog open={Boolean(deleteTarget)} onOpenChange={(nextOpen) => { if (!nextOpen && !deletingWork) setDeleteTarget(null) }}>
          <DialogContent className="w-[90vw] max-w-sm rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle>{t('scripts.deleteWorkConfirmTitle')}</DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-5">
                {deleteTarget?.status === 'published'
                  ? t('scripts.deletePublishedWorkConfirmDesc')
                  : t('scripts.deleteWorkConfirmDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" className="flex-1 rounded-xl border-0 shadow-none" disabled={deletingWork} onClick={() => setDeleteTarget(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" className="flex-1 rounded-xl" disabled={deletingWork} onClick={() => void deleteWork()}>
                {deletingWork && <Loader2 className="animate-spin" />}
                {t('scripts.deleteWork')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}

function EpisodeWorkHistoryDrawer({
  open,
  onOpenChange,
  works,
  initialKind,
  onPublish,
  onDelete,
  records,
  onOpenReplay,
  replayOpen,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  works: ScriptWork[]
  initialKind?: ScriptWorkKind
  onPublish: (work: ScriptWork) => Promise<void>
  onDelete: (work: ScriptWork) => void
  records: ScriptPracticeRecord[]
  onOpenReplay: (record: ScriptPracticeRecord) => void
  replayOpen: boolean
}) {
  const { t } = useTranslation()
  const [previewWork, setPreviewWork] = useState<ScriptWork | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [mode, setMode] = useState<'vn' | 'repeat'>('vn')
  useEffect(() => {
    if (open) setMode(initialKind === 'repeat_video' ? 'repeat' : 'vn')
  }, [initialKind, open])
  const modeWorks = useMemo(
    () => works.filter((work) => mode === 'vn' ? work.kind === 'vn_video' : work.kind === 'repeat_video'),
    [mode, works],
  )
  const chronological = useMemo(
    () => [...modeWorks].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [modeWorks],
  )
  const ordered = useMemo(() => [...chronological].reverse(), [chronological])
  const episode = ordered[0]?.episode

  const openReplay = (work: ScriptWork) => {
    const record = practiceRecordFromWork(work, records)
    if (!record) {
      toast.error(t('scripts.playbackUnavailable'))
      return
    }
    onOpenReplay(record)
  }

  return (
    <>
      <Drawer
        open={open}
        // Same contract as practice-records drawer: replay Dialog must not
        // drag-dismiss or auto-close this sheet.
        dismissible={!replayOpen && !previewWork}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && replayOpen) return
          onOpenChange(nextOpen)
        }}
      >
        <DrawerContent showHandle={false} className="flex h-[95dvh] max-h-[95dvh] flex-col rounded-t-[28px] bg-background drawer-surface">
          <DrawerHeader className="shrink-0 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] text-left">
            <DrawerTitle className="text-base font-semibold">
              {episode ? t('scripts.practiceHistory', { name: episode.chapterName }) : t('scripts.practiceHistoryFallback')}
            </DrawerTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {episode ? `${episode.scene.title} · ` : ''}{t('scripts.totalAttempts', { count: works.length })}
            </p>
          </DrawerHeader>

          <div className="shrink-0 px-4 pb-2">
            <Tabs value={mode} onValueChange={(value) => setMode(value as 'vn' | 'repeat')}>
              <TabsList className="grid h-9 w-full grid-cols-2 rounded-lg">
                <TabsTrigger value="vn" className="text-xs">{t('scripts.vnHistoryTab')}</TabsTrigger>
                <TabsTrigger value="repeat" className="text-xs">{t('scripts.repeatHistoryTab')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {ordered.length === 0 ? (
              <div className="rounded-lg bg-muted/30 py-12 text-center text-sm text-muted-foreground">
                {t('scripts.noHistory')}
              </div>
            ) : (
              <div className="space-y-2">
                {ordered.map((work) => {
                  const attempt = chronological.findIndex((item) => item.id === work.id) + 1
                  const statusLabel = work.status === 'published'
                    ? t('scripts.published')
                    : work.status === 'rendering'
                      ? t('scripts.generatingStatus')
                      : work.status === 'failed'
                        ? t('scripts.generateFailed')
                        : t('scripts.privateOnly')
                  const canReplay = Boolean(work.recordId)
                  const hasVideo = Boolean(work.videoUrl)
                  return (
                    <div
                      key={work.id}
                      role={canReplay ? 'button' : undefined}
                      tabIndex={canReplay ? 0 : undefined}
                      className={cn('flex gap-3 rounded-lg bg-muted/30 p-3 text-left', canReplay && 'cursor-pointer transition-colors hover:bg-muted/45')}
                      onClick={() => { if (canReplay) openReplay(work) }}
                      onKeyDown={(event) => {
                        if (!canReplay) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openReplay(work)
                        }
                      }}
                    >
                      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted/60">
                        {work.coverUrl && <img src={work.coverUrl} alt="" className="size-full object-cover" />}
                        {hasVideo && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/5">
                            <span className="flex size-8 items-center justify-center rounded-full bg-black/55 text-white">
                              <Play className="ml-0.5 size-3.5 fill-current" />
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="line-clamp-1 flex-1 text-sm font-medium">{work.title}</p>
                          <Badge variant={attempt === chronological.length ? 'default' : 'secondary'} className="h-5 shrink-0 px-2 text-[10px]">
                            {attempt === chronological.length ? t('scripts.latest') : t('scripts.attemptNumber', { n: attempt })}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {work.kind === 'vn_video' ? t('scripts.vnInteractive') : work.kind === 'repeat_video' ? t('scripts.repeatTheater') : t('scripts.learningProgress')}
                          {' · '}
                          {new Date(work.createdAt).toLocaleString(i18n.language)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                          <span className="text-[11px] text-muted-foreground">{statusLabel}</span>
                          {hasVideo && (
                            <Button size="sm" variant="ghost" className="h-6 rounded-full px-2 text-[10px]" onClick={() => setPreviewWork(work)}>
                              {t('scripts.viewVideo')}
                            </Button>
                          )}
                          {work.status === 'published' ? (
                            <Badge variant="secondary" className="h-6 rounded-full border-0 px-2 text-[10px] shadow-none">
                              {t('scripts.currentPublishVersion')}
                            </Badge>
                          ) : work.videoUrl ? (
                            <Button
                              size="sm"
                              className="h-6 rounded-full px-2 text-[10px]"
                              disabled={Boolean(publishingId)}
                              onClick={() => {
                                setPublishingId(work.id)
                                void onPublish(work).finally(() => setPublishingId(null))
                              }}
                            >
                              {publishingId === work.id
                                ? t('scripts.switchingVersion')
                                : t('scripts.setPublishVersion')}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 rounded-full px-2 text-destructive hover:text-destructive"
                            onClick={() => onDelete(work)}
                            aria-label={t('scripts.deleteWork')}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      <Lightbox
        open={Boolean(previewWork?.videoUrl)}
        close={() => setPreviewWork(null)}
        slides={previewWork?.videoUrl ? [{
          type: 'video',
          sources: [{ src: previewWork.videoUrl, type: previewWork.videoMimeType ?? 'video/mp4' }],
        }] : []}
        plugins={[Video]}
        controller={{ closeOnBackdropClick: false, closeOnPullDown: false, closeOnPullUp: false }}
        video={{ controls: true, playsInline: true, controlsList: 'nodownload' }}
        styles={{
          toolbar: {
            top: 'env(safe-area-inset-top, 0px)',
            right: 'env(safe-area-inset-right, 0px)',
            padding: '0.75rem',
          },
        }}
      />
    </>
  )
}

const publishStatusMeta: Record<
  ScriptPublishHistoryItem['status'],
  { label: string; className: string }
> = {
  queued: { label: i18n.t('scripts.queued'), className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  running: { label: i18n.t('scripts.running'), className: 'bg-primary/10 text-primary' },
  completed: { label: i18n.t('scripts.publishCompleted'), className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  failed: { label: i18n.t('scripts.publishFailed'), className: 'bg-destructive/10 text-destructive' },
  canceled: { label: i18n.t('scripts.canceled'), className: 'bg-muted text-muted-foreground' },
}

function formatPublishTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString(i18n.language, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ScriptPublishHistoryDialog({
  open,
  onOpenChange,
  episodeId,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  episodeId?: string
  title?: string
}) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const resolvedTitle = title ?? t('scripts.publishLog')
  const [items, setItems] = useState<ScriptPublishHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    if (!open) return
    let active = true
    setItems([])
    setLoading(true)
    void Promise.all([
      scriptCommunityApi.publishHistory({ episodeId, page, pageSize: 8 }),
      practiceRepository.getPracticeDataResetAt(),
    ])
      .then(([result, resetAt]) => {
        if (!active) return
        setItems(result.items.filter((item) => isAfterPracticeReset(item.createdAt, resetAt)))
        setTotal(result.total)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (active) toast.error(t('scripts.publishLogLoadFailed'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [episodeId, open, page, t, userId])

  useEffect(() => {
    if (open) setPage(1)
  }, [episodeId, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[84dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-4 overflow-hidden rounded-2xl p-5 [&>button]:right-4 [&>button]:top-4 [&>button]:border-0 [&>button]:bg-transparent [&>button]:shadow-none [&>button]:ring-0 [&>button]:outline-none [&>button:hover]:bg-transparent [&>button:focus]:ring-0 [&>button:focus]:ring-offset-0 [&>button:focus]:outline-none [&>button:focus-visible]:ring-0 [&>button:focus-visible]:ring-offset-0 [&>button:focus-visible]:outline-none [&>button[data-state=open]]:bg-transparent">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription className="text-xs">
            {t('scripts.publishLogDesc', { total })}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 py-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg bg-muted/30 py-12 text-center">
            <History className="mx-auto size-8 text-muted-foreground/35" />
            <p className="mt-3 text-sm text-muted-foreground">{t('scripts.noPublishRecords')}</p>
          </div>
        ) : (
          <div className="min-h-0 overflow-hidden rounded-xl bg-muted/25">
            <div className="max-h-[55dvh] overflow-y-auto">
              <table className="w-full table-fixed text-left">
                <thead className="sticky top-0 z-10 bg-muted/95 text-[11px] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="w-[58%] px-3 py-2 font-medium">{t('scripts.tableWork')}</th>
                    <th className="w-[42%] px-2 py-2 font-medium">{t('scripts.taskStatusHeader')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const meta = publishStatusMeta[item.status]
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2.5 align-top">
                          <p className="line-clamp-1 text-xs font-medium">{item.work?.title ?? t('scripts.deletedWork')}</p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                            {item.work ? `${item.work.episode.scene.title} · ${item.work.episode.chapterName}` : item.targetId}
                          </p>
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <Badge className={cn('border-0 text-[10px] shadow-none', meta.className)}>
                            {meta.label}
                          </Badge>
                          <p className="mt-1 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                            {item.status === 'completed' ? '100%' : `${item.progress}%`} · {formatPublishTime(item.createdAt)}
                          </p>
                          {item.errorMessage && (
                            <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-destructive">{item.errorMessage}</p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="h-8 rounded-full border-0 bg-primary/10 px-3 text-xs text-primary shadow-none hover:bg-primary/16 hover:text-primary" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft data-icon="inline-start" />
              {t('scripts.prevPage')}
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="ghost" size="sm" className="h-8 rounded-full border-0 bg-primary/10 px-3 text-xs text-primary shadow-none hover:bg-primary/16 hover:text-primary" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              {t('scripts.nextPage')}
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function getReactions(): string[] {
  return i18n.t('scripts.reactions', { returnObjects: true }) as unknown as string[]
}

function updateReactionGroups(
  groups: ScriptWork['reactionGroups'],
  previousReaction: string | null,
  nextReaction: string | null,
) {
  const counts = new Map(groups.map((group) => [group.reaction, group.count]))
  if (previousReaction) {
    const nextCount = (counts.get(previousReaction) ?? 1) - 1
    if (nextCount > 0) counts.set(previousReaction, nextCount)
    else counts.delete(previousReaction)
  }
  if (nextReaction) counts.set(nextReaction, (counts.get(nextReaction) ?? 0) + 1)
  return [...counts].map(([reaction, count]) => ({ reaction, count }))
}

function SquareFeed({
  works,
  loading,
  onOpenShop,
  onPracticeSame,
  onWorkChanged,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  works: ScriptWork[]
  loading: boolean
  onOpenShop: () => void
  onPracticeSame: (work: ScriptWork) => void
  onWorkChanged: (workId: string, updater: (work: ScriptWork) => ScriptWork) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [previewWork, setPreviewWork] = useState<ScriptWork | null>(null)
  const [previewStartAt, setPreviewStartAt] = useState(0)
  const [inlinePlayingId, setInlinePlayingId] = useState<string | null>(null)
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!previewWork?.videoUrl) return
    const startAt = previewStartAt
    let cancelled = false
    let attempts = 0

    const seekVideo = (video: HTMLVideoElement) => {
      const apply = () => {
        if (cancelled) return
        if (startAt > 0 && Number.isFinite(startAt)) {
          try { video.currentTime = startAt } catch { /* ignore seek errors */ }
        }
        void video.play().catch(() => undefined)
      }
      if (video.readyState >= 1) apply()
      else video.addEventListener('loadedmetadata', apply, { once: true })
    }

    const findAndSeek = () => {
      if (cancelled) return
      const video = document.querySelector('.yarl__slide_current video, .yarl__video_container video') as HTMLVideoElement | null
      if (video) {
        seekVideo(video)
        return
      }
      if (attempts++ < 30) window.setTimeout(findAndSeek, 50)
    }

    const timer = window.setTimeout(findAndSeek, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [previewStartAt, previewWork])

  const toggleLike = async (work: ScriptWork) => {
    const actionKey = `${work.id}:like`
    if (pendingActions.has(actionKey)) return
    setPendingActions((current) => new Set(current).add(actionKey))
    onWorkChanged(work.id, (current) => ({
      ...current,
      liked: !current.liked,
      _count: {
        ...current._count,
        likes: Math.max(0, current._count.likes + (current.liked ? -1 : 1)),
      },
    }))
    try {
      if (work.liked) await scriptCommunityApi.unlike(work.id)
      else await scriptCommunityApi.like(work.id)
    } catch {
      onWorkChanged(work.id, (current) => ({
        ...current,
        liked: work.liked,
        _count: { ...current._count, likes: work._count.likes },
      }))
      toast.error(t('scripts.likeFailed'))
    } finally {
      setPendingActions((current) => {
        const next = new Set(current)
        next.delete(actionKey)
        return next
      })
    }
  }

  const toggleReaction = async (work: ScriptWork, reaction: string) => {
    const actionKey = `${work.id}:reaction`
    if (pendingActions.has(actionKey)) return
    const nextReaction = work.myReaction === reaction ? null : reaction
    setPendingActions((current) => new Set(current).add(actionKey))
    onWorkChanged(work.id, (current) => ({
      ...current,
      myReaction: nextReaction,
      reactionGroups: updateReactionGroups(current.reactionGroups, current.myReaction, nextReaction),
      _count: {
        ...current._count,
        reactions: Math.max(
          0,
          current._count.reactions + (current.myReaction ? 0 : 1) - (nextReaction ? 0 : 1),
        ),
      },
    }))
    try {
      if (work.myReaction === reaction) await scriptCommunityApi.removeReaction(work.id)
      else await scriptCommunityApi.react(work.id, reaction)
    } catch {
      onWorkChanged(work.id, () => work)
      toast.error(t('scripts.reactionFailed'))
    } finally {
      setPendingActions((current) => {
        const next = new Set(current)
        next.delete(actionKey)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : works.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg bg-muted/30 px-6 py-14 text-center">
          <Users className="size-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">{t('scripts.noPublicWorks')}</p>
          <Button variant="secondary" size="sm" className="mt-4 rounded-full border-0 shadow-none" onClick={onOpenShop}>
            {t('scripts.goToShop')}
          </Button>
        </div>
      ) : (
        <Virtuoso
          data={works}
          useWindowScroll
          computeItemKey={(_index, work) => work.id}
          endReached={() => {
            if (hasMore && !loadingMore) void onLoadMore()
          }}
          increaseViewportBy={500}
          itemContent={(_index, work) => (
            <div className="pb-3">
              <SquareWorkCard
                work={work}
                playing={inlinePlayingId === work.id}
                onPlay={() => setInlinePlayingId(work.id)}
                onStop={() => setInlinePlayingId((current) => current === work.id ? null : current)}
                onFullscreen={(startAt) => {
                  setPreviewStartAt(startAt)
                  setInlinePlayingId(null)
                  setPreviewWork(work)
                }}
                onPracticeSame={() => onPracticeSame(work)}
                onLike={() => void toggleLike(work)}
                onReaction={(reaction) => void toggleReaction(work, reaction)}
                likePending={pendingActions.has(`${work.id}:like`)}
                reactionPending={pendingActions.has(`${work.id}:reaction`)}
              />
            </div>
          )}
          components={{
            Footer: () => loadingMore ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : null,
          }}
        />
      )}
      <Lightbox
        open={Boolean(previewWork?.videoUrl)}
        close={() => {
          setPreviewWork(null)
          setPreviewStartAt(0)
        }}
        plugins={[Video]}
        controller={{ closeOnBackdropClick: false, closeOnPullDown: false, closeOnPullUp: false }}
        styles={{
          toolbar: {
            top: 'env(safe-area-inset-top, 0px)',
            right: 'env(safe-area-inset-right, 0px)',
            padding: '0.75rem',
          },
        }}
        carousel={{ finite: true }}
        slides={previewWork?.videoUrl ? [{
          type: 'video',
          width: 1280,
          height: 720,
          autoPlay: true,
          poster: previewWork.coverUrl ?? undefined,
          sources: [{ src: previewWork.videoUrl, type: previewWork.videoMimeType ?? 'video/mp4' }],
        }] : []}
        video={{ controls: true, playsInline: true, autoPlay: true, controlsList: 'nodownload' }}
        render={{ buttonPrev: () => null, buttonNext: () => null }}
      />
    </div>
  )
}

function SquareWorkCard({
  work,
  playing,
  onPlay,
  onStop,
  onFullscreen,
  onPracticeSame,
  onLike,
  onReaction,
  likePending,
  reactionPending,
}: {
  work: ScriptWork
  playing: boolean
  onPlay: () => void
  onStop: () => void
  onFullscreen: (startAt: number) => void
  onPracticeSame: () => void
  onLike: () => void
  onReaction: (reaction: string) => void
  likePending: boolean
  reactionPending: boolean
}) {
  const { t } = useTranslation()
  const [reactionOpen, setReactionOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!playing) {
      setPaused(false)
      setFrameReady(false)
    }
  }, [playing])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!playing) {
      video.pause()
      if (video.currentTime !== 0) video.currentTime = 0
      return
    }
    if (paused) {
      video.pause()
      return
    }
    void video.play().catch(() => undefined)
  }, [paused, playing])

  const markFrameReady = useCallback((video: HTMLVideoElement) => {
    const reveal = () => {
      // Wait one paint after the decoded frame so the first black buffer never flashes through.
      window.requestAnimationFrame(() => setFrameReady(true))
    }
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => reveal())
      return
    }
    reveal()
  }, [])

  const buffering = playing && !paused && !frameReady
  const showPlayButton = (!playing || paused) && !buffering

  return (
    <Card className="overflow-hidden border-0 bg-muted/30 shadow-none ring-0 dark:ring-0">
      <CardHeader className="flex-row items-center gap-2.5 px-3 pb-2 pt-3">
        <Avatar className="size-9">
          <AvatarImage src={work.user.image ?? undefined} alt={work.user.name} />
          <AvatarFallback>{work.user.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-sm">{work.user.name}</CardTitle>
          <CardDescription className="truncate text-[11px]">Lv.{work.user.userLevel} · {work.episode.scene.title} · {work.episode.chapterName}</CardDescription>
        </div>
        <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium">
          {work.kind === 'progress_card' ? t('scripts.learningProgress') : work.kind === 'vn_video' ? t('scripts.workKindVn') : t('scripts.workKindRepeat')}
        </Badge>
      </CardHeader>

      {work.videoUrl ? (
        <div className="relative mx-3 overflow-hidden rounded-xl bg-muted">
          {/* Theme base stays under the video so the browser's native black video surface never peeks through. */}
          <div className="aspect-[2/1] max-h-52 w-full bg-muted" />
          {work.coverUrl ? (
            <img
              src={work.coverUrl}
              alt=""
              className="pointer-events-none absolute inset-0 size-full object-cover"
            />
          ) : null}
          <video
            ref={videoRef}
            src={work.videoUrl}
            className={cn(
              'absolute inset-0 size-full bg-muted object-cover',
              frameReady ? 'opacity-100' : 'opacity-0',
            )}
            playsInline
            preload="metadata"
            onPlaying={(event) => markFrameReady(event.currentTarget)}
            onEnded={onStop}
          />
          <button
            type="button"
            onClick={() => {
              if (!playing) {
                onPlay()
                return
              }
              if (buffering) return
              setPaused((value) => !value)
            }}
            className="absolute inset-0 z-[1] flex items-center justify-center"
            aria-label={t('scripts.playVideo', { title: work.title })}
          >
            {buffering ? (
              <span className="flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm">
                <Loader2 className="size-5 animate-spin" />
              </span>
            ) : showPlayButton ? (
              <span className="flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => onFullscreen(videoRef.current?.currentTime ?? 0)}
            className="absolute bottom-2 right-2 z-10 flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm"
            aria-label={t('scripts.fullscreenView', { title: work.title })}
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative mx-3 flex min-h-24 items-end overflow-hidden rounded-xl bg-background/70 p-3">
          {work.coverUrl && <img src={work.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />}
          <div className="relative">
            <Badge variant="secondary" className="h-5 text-[10px]">{t('scripts.chapterComplete')}</Badge>
            <p className="mt-1.5 text-sm font-semibold">{work.episode.title}</p>
          </div>
        </div>
      )}

      <CardContent className="flex flex-col gap-2 px-3 pb-3 pt-2.5">
        <div>
          <p className="text-sm font-semibold">{work.title}</p>
          {work.caption && <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{work.caption}</p>}
          {work._count.likes > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('scripts.likeTotal', { count: work._count.likes })}
            </p>
          )}
        </div>
        {work.reactionGroups.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-muted-foreground">
            {work.reactionGroups.slice(0, 3).map((group, index) => (
              <span key={group.reaction} className="flex shrink-0 items-center gap-1">
                {index > 0 && <span className="text-muted-foreground/35">·</span>}
                <span>{group.reaction}</span>
                <span>× {group.count}</span>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant={work.liked ? 'secondary' : 'ghost'}
            className={cn('h-8 rounded-full px-2.5', work.liked && 'bg-primary/12 text-primary hover:bg-primary/16')}
            onClick={onLike}
            disabled={likePending}
          >
            <Heart data-icon="inline-start" className={cn(work.liked && 'fill-current')} />
            <span>{work.liked ? t('scripts.liked') : t('scripts.like')}</span>
          </Button>
          <Popover open={reactionOpen} onOpenChange={setReactionOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={work.myReaction ? 'secondary' : 'ghost'}
                className="h-8 rounded-full px-2.5"
                disabled={reactionPending}
              >
                <SmilePlus data-icon="inline-start" />
                {t('scripts.react')}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              sideOffset={8}
              className="w-[min(19rem,calc(100vw-2rem))] rounded-xl border-0 bg-background p-2 shadow-none"
            >
              <p className="px-2 pb-1.5 pt-1 text-[11px] font-medium text-muted-foreground">{t('scripts.sendReaction')}</p>
              <div className="grid grid-cols-2 gap-1">
                {getReactions().map((reaction) => (
                  <button
                    key={reaction}
                    type="button"
                    className={cn(
                      'rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-muted',
                      work.myReaction === reaction && 'bg-primary text-primary-foreground hover:bg-primary/90',
                    )}
                    onClick={() => {
                      setReactionOpen(false)
                      onReaction(reaction)
                    }}
                  >
                    {reaction}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="ghost" className="h-8 rounded-full px-2.5" onClick={onPracticeSame}>
            <Footprints data-icon="inline-start" />
            {t('scripts.practiceSame')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RecordList({
  records,
  loading,
  onOpenReplay,
}: {
  records: ScriptPracticeRecord[]
  loading: boolean
  onOpenReplay: (record: ScriptPracticeRecord) => void
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 15
  const visible = records.filter((record) => {
    if (mode === 'all') return true
    return record.mode === mode
  })

  useEffect(() => setPage(1), [mode])

  const columns: ColumnConfig<ScriptPracticeRecord>[] = [
    {
      key: 'episode', header: t('scripts.episodeHeader'),
      cell: (_value, record) => <div className="min-w-0"><p className="truncate text-sm font-medium">{record.episode.title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{record.episode.scene.title} · {record.episode.chapterName}</p></div>,
    },
    {
      key: 'durationSec', header: t('scripts.practiceHeader'), width: 112, align: 'center',
      cell: (value, record) => <div className="space-y-1"><Badge variant={record.mode === 'vn' ? 'default' : 'secondary'} className="text-[10px]">{record.mode === 'vn' ? t('scripts.workKindVn') : t('scripts.workKindRepeat')}</Badge><p className="whitespace-nowrap text-[10px] text-muted-foreground">{t('scripts.timesCount', { count: record.mode === 'vn' ? record.turnCount : record.lineCount })} · {t('scripts.minutesCount', { count: Math.max(0, Math.round(value / 60)) })}</p></div>,
    },
    {
      key: 'createdAt', header: t('scripts.dateHeader'), width: 88, align: 'center',
      cell: (value) => <span className="whitespace-nowrap text-xs text-muted-foreground">{new Date(value).toLocaleDateString()}</span>,
    },
  ]

  return (
    <Tabs value={mode} onValueChange={setMode} className="flex h-full min-h-0 flex-col">
      <TabsList className="mb-3 grid h-10 w-full shrink-0 grid-cols-3 rounded-xl bg-muted/70 p-1">
        <TabsTrigger value="all" className="rounded-lg text-xs">{t('scripts.allTab')}</TabsTrigger>
        <TabsTrigger value="vn" className="rounded-lg text-xs">VN</TabsTrigger>
        <TabsTrigger value="repeat" className="rounded-lg text-xs">{t('scripts.repeatTab')}</TabsTrigger>
      </TabsList>
      <ConfigDataTable
        data={visible.slice((page - 1) * pageSize, page * pageSize)} columns={columns}
        total={visible.length} page={page} pageSize={pageSize} onPageChange={setPage}
        isLoading={loading} emptyMessage={t('scripts.noPracticeRecords')} onRowClick={onOpenReplay}
        className="min-h-0 flex-1 text-xs [&>div:first-child]:rounded-lg [&>div:first-child]:border-0 [&>div:first-child]:bg-muted/30 [&_td]:px-3 [&_td]:py-2 [&_th]:h-9 [&_th]:px-3 [&_tr]:border-0"
      />
    </Tabs>
  )
}

function ScriptRecordReplayDialog({
  record,
  onClose,
  onGenerateVideo,
  generatingProgress,
  videoQueued,
  onRecordUpdated,
}: {
  record: ScriptPracticeRecord | null
  onClose: () => void
  onGenerateVideo: (record: ScriptPracticeRecord) => Promise<void>
  generatingProgress?: number
  videoQueued: boolean
  onRecordUpdated?: (record: ScriptPracticeRecord) => void
}) {
  const { t } = useTranslation()
  const [overwriteOpen, setOverwriteOpen] = useState(false)
  const [view, setView] = useState<'replay' | 'analysis'>('replay')
  const [replayNonce, setReplayNonce] = useState(0)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(
    record?.resultSnapshot?.aiAnalysis ?? null,
  )

  useEffect(() => {
    setView('replay')
    setReplayNonce(0)
    setAnalysisResult(record?.resultSnapshot?.aiAnalysis ?? null)
  }, [record?.id, record?.resultSnapshot?.aiAnalysis])

  if (!record) return null
  const publishedWork = record.works?.some((work) => work.status === 'published') ?? false
  const hasExistingVideo = record.works?.some((work) => work.status === 'rendering' || work.status === 'ready') ?? false
  const requestVideoGeneration = () => {
    if (publishedWork) {
      toast.error(t('scripts.publishedBlockRegenerate'))
      return
    }
    if (hasExistingVideo && !videoQueued) setOverwriteOpen(true)
    else void onGenerateVideo(record)
  }
  const ensureAiAnalysis = async () => {
    if (analysisResult || analysisLoading) return
    setAnalysisLoading(true)
    try {
      const result = await scriptCommunityApi.analyzeRecord(record.id)
      setAnalysisResult(result.analysis ?? null)
      if (result.analysis) {
        const nextRecord: ScriptPracticeRecord = {
          ...record,
          resultSnapshot: {
            ...(record.resultSnapshot ?? {}),
            aiAnalysis: result.analysis,
            aiAnalysisRaw: result.raw,
            aiAnalysisError: null,
          },
          score: typeof result.analysis.overallScore === 'number'
            ? Math.round(Number(result.analysis.overallScore))
            : record.score,
        }
        onRecordUpdated?.(nextRecord)
        toast.success(t('learning.aiEvaluationDone'))
      } else {
        toast.error(t('learning.aiReviewPending'))
      }
    } catch (error: any) {
      toast.error(error?.message || t('practiceSession.aiEvalUnavailable'))
      setView('replay')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const overwriteDialog = overwriteOpen ? (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm" onClick={() => setOverwriteOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="overwrite-video-title" className="w-full max-w-sm rounded-2xl border-0 bg-background p-5 shadow-lg" onClick={(event) => event.stopPropagation()}>
        <h2 id="overwrite-video-title" className="text-base font-semibold">{t('scripts.overwritePrivateTitle')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('scripts.overwritePrivateDesc')}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="secondary" className="rounded-xl border-0 shadow-none" onClick={() => setOverwriteOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => { setOverwriteOpen(false); void onGenerateVideo(record) }}>{t('scripts.regenerateOverwrite')}</Button>
        </div>
      </div>
    </div>
  ) : null

  if (record.mode === 'repeat') {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent
          overlayClassName="z-[70] bg-background"
          className="left-0 top-0 z-[71] h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 p-0 [&>button]:hidden"
          aria-describedby={undefined}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t('scripts.repeatRecordTitle')}</DialogTitle>
          </DialogHeader>
          <ReadonlyRepeatRecordTheater
            record={record}
            onClose={onClose}
            onGenerateVideo={requestVideoGeneration}
            videoSubmitting={generatingProgress !== undefined}
            videoQueued={videoQueued}
          />
          {overwriteDialog}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        overlayClassName="z-[70]"
        className="left-0 top-0 z-[71] h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 p-0 [&>button]:hidden"
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('scripts.replayDialogTitle')}</DialogTitle>
        </DialogHeader>
        <div className="relative h-full bg-background">
          <div className="absolute inset-x-0 top-0 z-40 flex justify-center px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
            <div className="flex h-9 w-full max-w-[440px] items-center gap-1.5 rounded-full bg-background/90 px-2 shadow-none backdrop-blur-2xl">
              <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-full px-2.5 text-xs" onClick={onClose}>{t('common.close')}</Button>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1 px-1">
                <span className="min-w-0 truncate text-center text-xs font-medium text-muted-foreground">
                  {record.episode.title} · {view === 'analysis' ? t('scripts.aiReviewTab') : t('scripts.dialogueReplay')}
                </span>
                {view === 'replay' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 shrink-0 rounded-full text-foreground/80"
                    onClick={() => setReplayNonce((current) => current + 1)}
                    aria-label={t('scripts.restart')}
                    title={t('scripts.restart')}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1 pr-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 shrink-0 rounded-full text-foreground/80"
                  disabled={publishedWork || generatingProgress !== undefined || videoQueued}
                  onClick={requestVideoGeneration}
                  aria-label={t('scripts.generateVideo')}
                  title={
                    videoQueued
                      ? t('scripts.renderQueued')
                      : generatingProgress !== undefined
                        ? t('scripts.submittingVideoTask')
                        : t('scripts.generateVideo')
                  }
                >
                  <Film className={cn('size-3.5', generatingProgress !== undefined && 'animate-pulse')} />
                </Button>
                <Sparkles className={cn('size-3.5', view === 'analysis' ? 'text-primary' : 'text-muted-foreground')} />
                <Switch
                  checked={view === 'analysis'}
                  onCheckedChange={(checked) => {
                    setView(checked ? 'analysis' : 'replay')
                    if (checked) void ensureAiAnalysis()
                  }}
                  aria-label={t('learning.toggleAiReview')}
                  title={view === 'analysis' ? t('scripts.dialogueReplay') : t('scripts.aiReviewTab')}
                />
              </div>
            </div>
          </div>
          {view === 'analysis' ? (
            <div className="h-full overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-16">
              <PracticeAnalysisPanel
                analysis={analysisResult as any}
                loading={analysisLoading}
                topicTitle={record.episode.title}
                readOnly
                onBack={() => setView('replay')}
              />
            </div>
          ) : (
            <div className="h-full bg-background pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
              <ScriptRecordVnReplay key={replayNonce} record={record} onClose={onClose} />
            </div>
          )}
          {overwriteDialog}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReadonlyRepeatRecordTheater({
  record,
  onClose,
  onGenerateVideo,
  videoSubmitting,
  videoQueued,
}: {
  record: ScriptPracticeRecord
  onClose: () => void
  onGenerateVideo: () => void
  videoSubmitting: boolean
  videoQueued: boolean
}) {
  const { t } = useTranslation()
  const [data, setData] = useState<StoryEpisodePlayerData | null>(null)
  const [preparedAssetMap, setPreparedAssetMap] = useState<PreparedStoryVnEntry['assetMap'] | null>(null)
  const [preparedScene, setPreparedScene] = useState<PreparedStoryVnEntry['scene'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [recordingUrls, setRecordingUrls] = useState<Record<number, string>>({})
  const packageId = record.episode.scene.id

  useEffect(() => {
    let alive = true
    setLoading(true)
    setFailed(false)
    setData(null)
    setPreparedAssetMap(null)
    setPreparedScene(null)
    setActiveIndex(0)
    // Same click-time prep as live repeat theatre — resolves installed URLs
    // before frames are built, so aliases never reach Pixi/audio.
    void prepareStoryVnEntry({ packageId, episodeId: record.episodeId })
      .then((prepared) => {
        if (!alive) return
        setData(prepared.data)
        setPreparedAssetMap(prepared.assetMap)
        setPreparedScene(prepared.scene)
      })
      .catch((error) => {
        console.error('[repeat-record] prepareStoryVnEntry failed', { packageId, episodeId: record.episodeId, error })
        if (alive) setFailed(true)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [packageId, record.episodeId])

  useEffect(() => {
    let alive = true
    const assets = record.resultSnapshot?.recordingAssets ?? {}
    void Promise.all(Object.entries(assets).map(async ([frameIndex, assetId]) => {
      const { url } = await getFileAssetPrivateUrl(assetId)
      return [Number(frameIndex), url] as const
    })).then((entries) => {
      if (alive) setRecordingUrls(Object.fromEntries(entries))
    }).catch(() => {
      if (alive) setRecordingUrls({})
    })
    return () => { alive = false }
  }, [record.id, record.resultSnapshot])

  const { mediaReady, assetMap, scene } = useInstalledVnMedia({
    packageId,
    revision: record.episodeId,
    rawAssetMap: data?.inkScript.assetMap,
    rawScene: data?.scene,
    preparedAssetMap,
    preparedScene,
  })

  const frames = useMemo(() => {
    // Require prepared maps too — mediaReady alone can briefly be true from an
    // empty pre-prep resolve while data already exists (alias leak into frames).
    if (!data || !mediaReady || !preparedAssetMap || !preparedScene) return []
    return buildStoryRepeatFrames(data, {
      assetMap: preparedAssetMap ?? assetMap,
      scene: (preparedScene as StoryEpisodePlayerData['scene'])
        ?? (scene as StoryEpisodePlayerData['scene'])
        ?? data.scene,
    })
  }, [assetMap, data, mediaReady, preparedAssetMap, preparedScene, scene])

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col bg-background pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
      <div className="absolute inset-x-0 top-0 z-20 flex justify-center px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
        <div className="relative flex h-9 w-full max-w-[400px] items-center rounded-full bg-background/90 px-2 shadow-none backdrop-blur-2xl">
          <Button variant="ghost" size="sm" className="relative z-10 h-7 shrink-0 rounded-full px-2.5 text-xs" onClick={onClose}>{t('common.close')}</Button>
          <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center px-14">
            <span className="min-w-0 truncate text-center text-xs font-medium text-muted-foreground">{record.episode.title} · {t('scripts.repeatReplay')}</span>
          </div>
        </div>
      </div>
      {loading || (data && (!mediaReady || !preparedAssetMap || !preparedScene)) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-sm">{t('scripts.loadingRepeatTheater')}</p>
        </div>
      ) : failed || frames.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-muted-foreground">{t('scripts.repeatAssetsUnavailable')}</p>
          <Button variant="secondary" className="rounded-full border-0 shadow-none" onClick={onClose}>{t('common.close')}</Button>
        </div>
      ) : (
        <VnMixedPreviewPlayer
          frames={frames}
          activeIndex={activeIndex}
          onJumpTo={setActiveIndex}
          practiceMode
          readOnly
          initialRecordingUrls={recordingUrls}
          onGenerateVideo={onGenerateVideo}
          videoSubmitting={videoSubmitting}
          videoQueued={videoQueued}
          className="h-full max-h-none max-w-none rounded-none border-0 shadow-none"
        />
      )}
    </div>
  )
}

function ScriptShop({
  units,
  ownedIds,
  installedIds,
  downloadTasks,
  loading,
  focusUnitId,
  focusEpisodeId,
  onRefresh,
  onEnroll,
  onDownload,
  onNavigate,
}: {
  units: LearningUnitSummary[]
  ownedIds: Set<string>
  installedIds: Set<string>
  downloadTasks: Array<{ packId: string; status: string; progress: number }>
  loading: boolean
  focusUnitId?: string | null
  focusEpisodeId?: string | null
  onRefresh: () => Promise<void>
  onEnroll: (unit: LearningUnitSummary) => Promise<void>
  onDownload: (id: string) => Promise<void>
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const [packageFilter, setPackageFilter] = useState<'all' | 'story' | 'nqtr'>('all')
  const [selectedUnit, setSelectedUnit] = useState<LearningUnitSummary | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [chapterPage, setChapterPage] = useState(1)
  const [acquiringId, setAcquiringId] = useState<string | null>(null)
  const focusedUnitIdRef = useRef<string | null>(null)
  const pageSize = 6
  const packageTypeTabs = [
    { id: 'all' as const, label: t('scripts.allPackageTypes') },
    { id: 'story' as const, label: t('scripts.spokenScript') },
    { id: 'nqtr' as const, label: t('scripts.interactiveNovel') },
  ]
  const filteredUnits = units.filter((unit) => {
    if (packageFilter === 'story' && isNqtrScriptUnit(unit)) return false
    if (packageFilter === 'nqtr' && !isNqtrScriptUnit(unit)) return false
    const query = keyword.trim().toLocaleLowerCase()
    if (!query) return true
    return [unit.title, unit.location, unit.description, scriptPackageTypeLabel(unit, t)]
      .some((value) => value?.toLocaleLowerCase().includes(query))
  })

  useEffect(() => {
    if (!focusUnitId) {
      focusedUnitIdRef.current = null
      return
    }
    if (loading) return
    if (focusedUnitIdRef.current === focusUnitId) return
    const target = units.find((unit) => unit.id === focusUnitId)
    focusedUnitIdRef.current = focusUnitId
    if (!target) {
      toast.error(t('scripts.packageNotFound'))
      return
    }
    setSelectedUnit(target)
    setDescExpanded(false)
    setChapterPage(1)
  }, [focusUnitId, loading, t, units])

  const search = (
    <div className="space-y-3 pb-1">
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('scripts.searchScript')}
          className="h-11 rounded-full border-0 bg-muted/70 pl-9 text-sm"
        />
      </div>
      <div className="scrollbar-hide overflow-x-auto">
        <div className="flex w-max gap-2 pb-1">
          {packageTypeTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPackageFilter(tab.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                packageFilter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <>
        {search}
        <MobilePageLoading rows={4} minHeightClassName="min-h-[40vh]" />
      </>
    )
  }

  if (filteredUnits.length === 0) {
    return (
      <>
        {search}
        <div className="flex flex-col items-center py-16 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">{keyword.trim() || packageFilter !== 'all' ? t('scripts.noMatchingScript') : t('scripts.noScriptAvailable')}</p>
          {!keyword.trim() && packageFilter === 'all' && (
            <Button variant="secondary" size="sm" className="mt-4 rounded-full border-0 shadow-none" onClick={() => void onRefresh()}>
              {t('scripts.reload')}
            </Button>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col">
      {search}
      <div className="flex flex-col gap-2">
        {filteredUnits.map((unit) => {
          const installed = installedIds.has(unit.id)
          const task = downloadTasks.find((item) => item.packId === unit.id)
          const packageLabel = scriptPackageTypeLabel(unit, t)
          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => {
                setSelectedUnit(unit)
                setDescExpanded(false)
                setChapterPage(1)
              }}
              className="flex w-full gap-3 rounded-lg bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex aspect-square size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                <ScriptCover url={unit.coverImage} packId={unit.id} className="size-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex items-start gap-2">
                  <h3 className="line-clamp-1 flex-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</h3>
                  {unit.isLocked && <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{displayLearningUnitLocation(unit.location, packageLabel)}</p>
                <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                  {t('scripts.unitMeta', { chapters: getScriptShopChapterCount(unit), words: unit.vocabCount, chunks: unit.chunkCount })}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="h-5 rounded-full border-0 px-2 text-[10px] shadow-none">{packageLabel}</Badge>
                  <Badge variant="secondary" className="h-5 rounded-full border-0 px-2 text-[10px] shadow-none">{unit.isFree ? t('scripts.free') : t('scripts.member')}</Badge>
                  {(task?.status === 'downloading' || task?.status === 'extracting') && (
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">{Math.round(task.progress)}%</Badge>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selectedUnit && (
        <ScriptShopDetail
          unit={selectedUnit}
          owned={ownedIds.has(selectedUnit.id)}
          installed={installedIds.has(selectedUnit.id)}
          task={downloadTasks.find((item) => item.packId === selectedUnit.id)}
          descriptionExpanded={descExpanded}
          chapterPage={chapterPage}
          pageSize={pageSize}
          acquiring={acquiringId === selectedUnit.id}
          focusEpisodeId={selectedUnit.id === focusUnitId ? focusEpisodeId : null}
          onDescriptionToggle={() => setDescExpanded((value) => !value)}
          onChapterPageChange={setChapterPage}
          onClose={() => setSelectedUnit(null)}
          onNavigate={onNavigate}
          onDownload={onDownload}
          onEnroll={async () => {
            setAcquiringId(selectedUnit.id)
            try { await onEnroll(selectedUnit) } finally { setAcquiringId(null) }
          }}
        />
      )}
    </div>
  )
}

function ScriptShopDetail({
  unit,
  owned,
  installed,
  task,
  descriptionExpanded,
  chapterPage,
  pageSize,
  acquiring,
  focusEpisodeId,
  onDescriptionToggle,
  onChapterPageChange,
  onClose,
  onNavigate,
  onDownload,
  onEnroll,
}: {
  unit: LearningUnitSummary
  owned: boolean
  installed: boolean
  task?: { status: string; progress: number }
  descriptionExpanded: boolean
  chapterPage: number
  pageSize: number
  acquiring: boolean
  focusEpisodeId?: string | null
  onDescriptionToggle: () => void
  onChapterPageChange: (page: number) => void
  onClose: () => void
  onNavigate: () => void
  onDownload: (id: string) => Promise<void>
  onEnroll: () => Promise<void>
}) {
  const { t } = useTranslation()
  const downloading = task?.status === 'downloading' || task?.status === 'extracting'
  const scriptChapters = getScriptShopChapters(unit)
  const totalPages = Math.max(1, Math.ceil(scriptChapters.length / pageSize))
  const chapters = scriptChapters.slice((chapterPage - 1) * pageSize, chapterPage * pageSize)
  const enterPath = focusEpisodeId
    ? `/scripts/packages/${unit.id}/episodes/${focusEpisodeId}`
    : `/scripts/packages/${unit.id}`

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[88vh] w-[90vw] overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{unit.title}</DialogTitle>
          <DialogDescription>{displayLearningUnitLocation(unit.location, scriptPackageTypeLabel(unit, t))}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex gap-3 bg-muted/30 p-4">
            <div className="flex aspect-square size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
              <ScriptCover url={unit.coverImage} packId={unit.id} className="size-full object-cover" iconClassName="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="rounded-full border-0 text-[10px] shadow-none">{scriptPackageTypeLabel(unit, t)}</Badge>
                <Badge variant="secondary" className="rounded-full border-0 text-[10px] shadow-none">{unit.isFree ? t('scripts.free') : t('scripts.member')}</Badge>
                {unit.categoryName && <Badge variant="secondary" className="rounded-full border-0 text-[10px] shadow-none">{unit.categoryName}</Badge>}
                {unit.isLocked && <Badge variant="secondary" className="rounded-full border-0 text-[10px] shadow-none">{t('scripts.locked')}</Badge>}
              </div>
              <h3 className="mt-2 line-clamp-2 text-base font-bold leading-5">{unit.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{displayLearningUnitLocation(unit.location, scriptPackageTypeLabel(unit, t))}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{t('scripts.chaptersUnit', { count: getScriptShopChapterCount(unit) })}</span>
                <span>{t('scripts.wordsUnit', { count: unit.vocabCount })}</span>
                <span>{t('scripts.chunksUnit', { count: unit.chunkCount })}</span>
              </div>
            </div>
          </div>

          {unit.description && (
            <div className="border-b border-border/50 px-4 py-3">
              <p className={cn('text-xs leading-5 text-muted-foreground', !descriptionExpanded && 'line-clamp-1')}>{unit.description}</p>
              {unit.description.length > 40 && (
                <button type="button" onClick={onDescriptionToggle} className="mt-1 flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
                  {descriptionExpanded ? t('scripts.collapse') : t('scripts.expand')}
                  <ChevronDown className={cn('size-3 transition-transform', descriptionExpanded && 'rotate-180')} />
                </button>
              )}
            </div>
          )}

          <div className="p-4">
            {downloading ? (
              <div className="flex items-center gap-3">
                <Progress value={task.progress} className="h-2 flex-1" />
                <span className="text-xs tabular-nums text-muted-foreground">{Math.round(task.progress)}%</span>
              </div>
            ) : task?.status === 'queued' ? (
              <Button className="w-full" disabled><Loader2 className="animate-spin" />{t('scripts.waitingDownload')}</Button>
            ) : task?.status === 'error' ? (
              <Button variant="destructive" className="w-full" onClick={() => void onDownload(unit.id)}>{t('scripts.downloadFailedRetry')}</Button>
            ) : installed ? (
              <Button variant="secondary" className="w-full border-0 shadow-none" asChild>
                <Link to={enterPath} onClick={onNavigate}>{t('scripts.enterScript')}</Link>
              </Button>
            ) : owned ? (
              <Button className="w-full" onClick={() => void onDownload(unit.id)}>
                <Download data-icon="inline-start" />{t('scripts.redownload')}
              </Button>
            ) : unit.isLocked ? (
              <Button className="w-full" asChild>
                <Link to="/member" onClick={onNavigate}><LockKeyhole data-icon="inline-start" />{t('scripts.viewBenefits')}</Link>
              </Button>
            ) : (
              <Button className="w-full" disabled={acquiring} onClick={() => void onEnroll()}>
                {acquiring ? <Loader2 className="animate-spin" /> : <Play data-icon="inline-start" />}
                {acquiring ? t('scripts.starting') : t('scripts.startLearning')}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5">
            <p className="text-xs font-medium">{t('scripts.chapterListHeader')}</p>
            {scriptChapters.length > pageSize && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <button type="button" disabled={chapterPage === 1} onClick={() => onChapterPageChange(Math.max(1, chapterPage - 1))} className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/16 disabled:opacity-35" aria-label={t('scripts.prevPage')}>
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="min-w-9 text-center text-[11px] tabular-nums">{chapterPage}/{totalPages}</span>
                <button type="button" disabled={chapterPage === totalPages} onClick={() => onChapterPageChange(Math.min(totalPages, chapterPage + 1))} className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/16 disabled:opacity-35" aria-label={t('scripts.nextPage')}>
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
            {chapters.length ? (
              <div className="space-y-1.5">
                {chapters.map((chapter, index) => (
                  <div key={chapter.id} className="flex items-center gap-3 rounded-lg bg-muted/25 px-3 py-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {(chapterPage - 1) * pageSize + index + 1}
                    </div>
                    <p className="line-clamp-1 min-w-0 flex-1 text-sm font-medium">{chapter.title}</p>
                    <Badge variant="secondary" className="shrink-0 rounded-full border-0 text-[10px] shadow-none">{chapter.difficulty}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="py-8 text-center text-sm text-muted-foreground">{t('scripts.noChapters')}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
