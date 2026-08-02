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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clapperboard,
  Clock3,
  Download,
  Film,
  Heart,
  History,
  Image,
  Loader2,
  Layers3,
  LockKeyhole,
  Maximize2,
  Play,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  learningApi,
  type LearningUnitSummary,
  type MyUnit,
} from '@/features/learning/api/learning-api'
import {
  scriptCommunityApi,
  type ScriptPublishHistoryItem,
  type ScriptPracticeRecord,
  type ScriptWork,
} from '@/features/scripts/api/script-community-api'
import {
  LearningPackDownloadDrawer,
  LearningPackDownloadStatusButton,
} from '@/layout/learning-pack-download-monitor'
import { useLearningStore } from '@/stores/learning.store'
import { cn } from '@/lib/cn'
import { parseComposer } from '@/features/admin/components/composer-parser'
import { flattenComposerToTimeline } from '@/features/admin/components/vn-mixed-timeline'
import { requestScriptVideoRender } from '@/features/scripts/lib/request-script-video-render'
import { useGlobalTaskStore } from '@/stores/global-task.store'
import { VnPlayer, type VnPlayerLine } from '@/features/vn-engine/vn-player'
import { useCachedImage } from '@/hooks/use-cached-image'

/**
 * The card artwork belongs to the learning package.  A work can additionally
 * have its own generated/uploaded cover; callers pass that URL first and use
 * the package cover only as a fallback.
 */
function ScriptCover({
  url,
  className,
  iconClassName = 'size-7',
}: {
  url?: string | null
  className: string
  iconClassName?: string
}) {
  const { resolvedUrl } = useCachedImage(url)
  return resolvedUrl ? (
    <img src={resolvedUrl} alt="" className={className} />
  ) : (
    <span className="flex size-full items-center justify-center text-muted-foreground">
      <Clapperboard className={iconClassName} />
    </span>
  )
}

function displayScriptLocation(location: string | null | undefined, fallback: string) {
  const value = location?.trim()
  // `story:<id>` is an internal package reference, never presentation text.
  return value && !/^story:[a-z0-9_-]+$/i.test(value) ? value : fallback
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
  useVideoFullscreenOrientation()
  const [searchParams, setSearchParams] = useSearchParams()
  const panel = searchParams.get('panel')
  const tab = searchParams.get('tab') === 'square' ? 'square' : 'mine'
  const [shopOpen, setShopOpen] = useState(panel === 'store')
  const [recordsOpen, setRecordsOpen] = useState(panel === 'records')
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [publishHistoryOpen, setPublishHistoryOpen] = useState(false)
  const [shopUnits, setShopUnits] = useState<LearningUnitSummary[]>([])
  const [shopLoading, setShopLoading] = useState(false)
  const [records, setRecords] = useState<ScriptPracticeRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [works, setWorks] = useState<ScriptWork[]>([])
  const [worksLoading, setWorksLoading] = useState(false)
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

  const storyUnits = useMemo(
    () => myUnits.filter((unit) => unit.packageType === 'story'),
    [myUnits],
  )
  const installedIds = useMemo(
    () => new Set(downloadedPacks.filter((pack) => pack.status === 'installed').map((pack) => pack.packId)),
    [downloadedPacks],
  )
  const activeUnit = useMemo(
    () => [...storyUnits].sort((a, b) => b.completionPercent - a.completionPercent)[0] ?? null,
    [storyUnits],
  )

  useEffect(() => {
    void fetchMyLearning()
    void fetchDownloadedPacks()
  }, [fetchDownloadedPacks, fetchMyLearning])

  useEffect(() => {
    setShopOpen(panel === 'store')
    setRecordsOpen(panel === 'records')
  }, [panel])

  const setPanel = useCallback((next: 'store' | 'records' | null) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('panel', next)
    else params.delete('panel')
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const loadShop = useCallback(async () => {
    setShopLoading(true)
    try {
      const result = await learningApi.getUnits({ packageType: 'story', page: 1, pageSize: 30 })
      setShopUnits(result.list)
    } catch {
      toast.error(t('scripts.shopLoadFailed'))
    } finally {
      setShopLoading(false)
    }
  }, [])

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true)
    try {
      const result = await scriptCommunityApi.myRecords({ limit: 50 })
      setRecords(result.list)
    } catch {
      setRecords([])
    } finally {
      setRecordsLoading(false)
    }
  }, [])

  const loadWorks = useCallback(async () => {
    setWorksLoading(true)
    try {
      const allWorks: ScriptWork[] = []
      let cursor: string | undefined
      do {
        const result = await scriptCommunityApi.myWorks({ limit: 50, cursor })
        allWorks.push(...result.list)
        cursor = result.nextCursor ?? undefined
      } while (cursor)
      setWorks(allWorks)
    } catch {
      setWorks([])
    } finally {
      setWorksLoading(false)
    }
  }, [])

  const loadFeed = useCallback(async (cursor?: string, append = false) => {
    if (append) setFeedLoadingMore(true)
    else setFeedLoading(true)
    try {
      const result = await scriptCommunityApi.feed({ cursor, limit: 20 })
      setFeed((current) => append ? [...current, ...result.list] : result.list)
      setFeedCursor(result.nextCursor)
    } catch {
      if (!append) setFeed([])
    } finally {
      setFeedLoading(false)
      setFeedLoadingMore(false)
    }
  }, [])

  const updateFeedWork = useCallback((
    workId: string,
    updater: (work: ScriptWork) => ScriptWork,
  ) => {
    setFeed((current) => current.map((work) => work.id === workId ? updater(work) : work))
  }, [])

  useEffect(() => {
    if (shopOpen && shopUnits.length === 0) void loadShop()
  }, [loadShop, shopOpen, shopUnits.length])

  useEffect(() => {
    if (recordsOpen) void loadRecords()
  }, [loadRecords, recordsOpen])

  useEffect(() => {
    if (tab === 'mine') void loadWorks()
  }, [loadWorks, tab])

  useEffect(() => {
    if (tab === 'square') void loadFeed()
  }, [loadFeed, tab])

  const enroll = async (unit: LearningUnitSummary) => {
    try {
      await enrollUnit(unit.id, unit.title, unit)
      await refreshMyUnits()
      toast.success(`《${unit.title}》已加入并开始下载`)
    } catch {
      toast.error('开始剧本失败')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-3">
      <div className="mb-3 flex items-center justify-between">
        <div />
        <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45">
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
            onOpenRecords={() => setPanel('records')}
            onDownload={downloadUnitPack}
            onQuit={quitUnit}
            works={works}
            worksLoading={worksLoading}
            onWorksChanged={loadWorks}
          />
        </TabsContent>

        <TabsContent value="square" className="mt-0">
          <SquareFeed
            works={feed}
            loading={feedLoading}
            onOpenShop={() => setPanel('store')}
            onWorkChanged={updateFeedWork}
            hasMore={Boolean(feedCursor)}
            loadingMore={feedLoadingMore}
            onLoadMore={() => feedCursor ? loadFeed(feedCursor, true) : Promise.resolve()}
          />
        </TabsContent>
      </Tabs>

      <LearningPackDownloadDrawer open={downloadOpen} onOpenChange={setDownloadOpen} />
      <ScriptPublishHistoryDialog
        open={publishHistoryOpen}
        onOpenChange={setPublishHistoryOpen}
      />

      <Drawer open={recordsOpen} onOpenChange={(open) => setPanel(open ? 'records' : null)}>
        <DrawerContent className="flex h-[95vh] max-h-[95vh] flex-col rounded-t-[28px] border-border/70 bg-background drawer-surface">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">{t('scripts.practiceRecords')}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <RecordList records={records} loading={recordsLoading} />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={shopOpen} onOpenChange={(open) => setPanel(open ? 'store' : null)}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">{t('scripts.shop')}</DrawerTitle>
          </DrawerHeader>
          <div className="h-[calc(88vh-4rem)] overflow-x-hidden overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <ScriptShop
              units={shopUnits}
              ownedIds={new Set(storyUnits.map((unit) => unit.id))}
              installedIds={installedIds}
              downloadTasks={downloadTasks}
              loading={shopLoading}
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
  onOpenRecords,
  onDownload,
  onQuit,
  works,
  worksLoading,
  onWorksChanged,
}: {
  activeUnit: MyUnit | null
  units: MyUnit[]
  loading: boolean
  installedIds: Set<string>
  downloadTasks: Array<{ packId: string; status: string; progress: number }>
  onOpenShop: () => void
  onOpenRecords: () => void
  onDownload: (id: string) => Promise<void>
  onQuit: (id: string) => Promise<void>
  works: ScriptWork[]
  worksLoading: boolean
  onWorksChanged: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [worksOpen, setWorksOpen] = useState(false)
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

  if (units.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg bg-muted/30 px-6 py-14 text-center">
        <Clapperboard className="size-10 text-muted-foreground/40" />
        <p className="mt-4 text-sm text-muted-foreground">{t('scripts.noScriptsYet')}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-full"
          onClick={(event) => {
            event.currentTarget.blur()
            onOpenShop()
          }}
        >
          {t('scripts.goToShop')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {activeUnit && (
        <section className="flex flex-col gap-2">
          <p className="px-1 text-xs font-medium text-muted-foreground">{t('scripts.continuePerformance')}</p>
          <Card className="overflow-hidden border-0 bg-muted/30 shadow-none">
            <div className="min-h-56 p-5">
              <div className="flex h-full min-h-46 flex-col justify-between gap-8">
                <div className="flex items-start justify-between gap-3">
                  {/* <Badge variant="secondary">
                    {installedIds.has(activeUnit.id) ? '已离线' : '等待下载'}
                  </Badge> */}
                  <span className="text-xs font-medium text-muted-foreground">
                    {Math.round(activeUnit.completionPercent)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeletingUnit(activeUnit)}
                    className="-mr-2 -mt-2 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                    aria-label={`${t('learning.quitUnit')} ${activeUnit.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{displayScriptLocation(activeUnit.location, t('scripts.pocketTheater'))}</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">{activeUnit.title}</h1>
                    {activeUnit.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {activeUnit.description}
                      </p>
                    )}
                  </div>
                  <Progress value={activeUnit.completionPercent} className="h-1.5" />
                  <div className="flex gap-2">
                    {installedIds.has(activeUnit.id) ? (
                      <Button asChild className="flex-1 rounded-full">
                        <Link to={`/scripts/packages/${activeUnit.id}`}>
                          <Play data-icon="inline-start" />
                          {t('scripts.continueStory')}
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 rounded-full"
                        disabled={downloadTasks.some((task) => task.packId === activeUnit.id && task.status !== 'error')}
                        onClick={() => void onDownload(activeUnit.id)}
                      >
                        <Download data-icon="inline-start" />
                        {t('scripts.downloadScript')}
                      </Button>
                    )}
                    <Button asChild variant="outline" className="rounded-full">
                      <Link to={`/scripts/packages/${activeUnit.id}`}>{t('scripts.chapterList')}</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

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
          <Button variant="ghost" size="sm" onClick={() => setWorksOpen(true)}>{t('scripts.viewMore')}</Button>
        </div>
        <MyWorks works={works} loading={worksLoading} onChanged={onWorksChanged} />
        <WorksLibraryDialog
          open={worksOpen}
          onOpenChange={setWorksOpen}
          works={works}
          loading={worksLoading}
          onChanged={onWorksChanged}
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium text-muted-foreground">{t('scripts.myScripts')}</p>
          <Button variant="ghost" size="sm" onClick={onOpenShop}>{t('scripts.exploreMore')}</Button>
        </div>
        <div className="-mx-2 flex snap-x gap-2 overflow-x-auto px-2 pb-1">
          {units.map((unit) => {
            const installed = installedIds.has(unit.id)
            const downloading = downloadTasks.some((task) => task.packId === unit.id && task.status !== 'error')
            const location = displayScriptLocation(unit.location, t('scripts.immersiveTheater'))

            return (
              <div key={unit.id} className="group relative w-44 shrink-0 snap-start">
                <Card className="w-44 shrink-0 snap-start overflow-hidden border-0 bg-muted/30 shadow-none transition-transform group-active:scale-[0.98]">
                  <Link to={`/scripts/packages/${unit.id}`} className="block">
                    <div className="relative aspect-video overflow-hidden bg-muted/50">
                      <ScriptCover
                        url={unit.coverImage}
                        className="size-full object-cover"
                        iconClassName="size-8 text-muted-foreground"
                      />
                      <Badge variant="secondary" className="absolute left-3 top-3">
                        {t('scripts.chapters', { count: unit.scriptCount })}
                      </Badge>
                    </div>
                    <CardHeader className="p-2.5 pb-2">
                      <CardTitle className="truncate text-sm">{unit.title}</CardTitle>
                      <CardDescription className="truncate text-xs">
                        {location}
                      </CardDescription>
                    </CardHeader>
                  </Link>
                  {!installed && (
                    <CardFooter className="p-2.5 pt-0">
                      <Button
                        size="sm"
                        className="h-8 w-full rounded-lg text-xs"
                        disabled={downloading}
                        onClick={() => void onDownload(unit.id)}
                      >
                        {downloading ? <Loader2 className="animate-spin" /> : <Download data-icon="inline-start" />}
                        {t('scripts.downloadScript')}
                      </Button>
                    </CardFooter>
                  )}
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
            <Button variant="outline" className="flex-1 rounded-xl" disabled={deleting} onClick={() => setDeletingUnit(null)}>{t('common.cancel')}</Button>
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
  const frames = flattenComposerToTimeline(parseComposer(player.inkScript.inkSource))
  await requestScriptVideoRender({
    workId: work.id,
    frames,
    onProgress: (progress, step) => {
      onProgress(progress)
      useGlobalTaskStore.getState().updateTask(taskId, { progress, stepLabel: step || i18n.t('scripts.renderingOnServer') })
    },
  })
  onProgress(100)
  useGlobalTaskStore.getState().updateTask(taskId, { progress: 100, status: 'done', stepLabel: i18n.t('scripts.publishedToSquare') })
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
      if (work.status === 'published') await scriptCommunityApi.unpublishWork(work.id)
      else if (work.videoUrl) await scriptCommunityApi.publishWork(work.id)
      else {
        setGenerating((current) => ({ ...current, [work.id]: 1 }))
        await generateAndPublishExistingWork(work, (progress) => {
          setGenerating((current) => ({ ...current, [work.id]: progress }))
        })
      }
      toast.success(work.status === 'published' ? t('scripts.workPrivateHint') : t('scripts.workPublishedHint'))
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
        <Card key={work.id} className="w-44 shrink-0 snap-start overflow-hidden border-0 bg-muted/30 shadow-none">
          <div className="relative aspect-video bg-muted/50">
            {work.coverUrl && <img src={work.coverUrl} alt="" className="size-full object-cover" />}
            <Badge variant="secondary" className="absolute left-2 top-2 h-5 px-2 text-[10px]">
              {work.kind === 'progress_card' ? t('scripts.workKindProgressCard') : work.kind === 'vn_video' ? t('scripts.workKindVn') : t('scripts.workKindRepeat')}
            </Badge>
            {work.videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-background/70 backdrop-blur-xl">
                  <Play className="size-4 text-primary" />
                </div>
              </div>
            )}
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
            <div className="w-full">
              <Button
                size="sm"
                variant={work.status === 'published' ? 'outline' : 'default'}
                className="h-8 w-full rounded-full text-xs"
                disabled={Boolean(generating[work.id])}
                onClick={() => void togglePublish(work)}
              >
                {generating[work.id]
                  ? t('scripts.generating', { percent: generating[work.id] })
                  : work.status === 'published'
                    ? t('scripts.unpublish')
                    : work.videoUrl
                      ? t('scripts.publishExisting')
                      : t('scripts.generateVideoAndPublish')}
              </Button>
              {generating[work.id] && <Progress value={generating[work.id]} className="mt-1.5 h-1" />}
            </div>
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  works: ScriptWork[]
  loading: boolean
  onChanged: () => Promise<void>
}) {
  const { t } = useTranslation()
  const pageSize = 15
  const [search, setSearch] = useState('')
  const [sceneId, setSceneId] = useState('all')
  const [groupMode, setGroupMode] = useState<'time' | 'package'>('time')
  const [page, setPage] = useState(1)
  const [generating, setGenerating] = useState<Record<string, number>>({})
  const [historyWork, setHistoryWork] = useState<ScriptWork | null>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)

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
      if (work.status === 'published') await scriptCommunityApi.unpublishWork(work.id)
      else if (work.videoUrl) await scriptCommunityApi.publishWork(work.id)
      else {
        setGenerating((current) => ({ ...current, [work.id]: 1 }))
        await generateAndPublishExistingWork(work, (progress) => {
          setGenerating((current) => ({ ...current, [work.id]: progress }))
        })
      }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 [&>button]:hidden">
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
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 rounded-xl border-border/60 bg-muted/45 pl-9 shadow-none" placeholder={t('scripts.searchWorks')} />
            </div>
            <button type="button" onClick={() => setGroupMode('time')} className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border', groupMode === 'time' ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-muted/45 text-muted-foreground')} aria-label={t('scripts.groupByTime')}>
              <CalendarDays className="size-4" />
            </button>
            <button type="button" onClick={() => setGroupMode('package')} className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border', groupMode === 'package' ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-muted/45 text-muted-foreground')} aria-label={t('scripts.groupByPackage')}>
              <Layers3 className="size-4" />
            </button>
          </div>

          <div className="mb-3 shrink-0 overflow-x-auto">
            <div className="flex gap-2">
              <button type="button" onClick={() => setSceneId('all')} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', sceneId === 'all' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>{t('scripts.allScripts')}</button>
              {scenes.map((scene) => (
                <button key={scene.id} type="button" onClick={() => setSceneId(scene.id)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', sceneId === scene.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>{scene.title}</button>
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
                                <span className="truncate">剧本《{work.episode.scene.title}》</span>
                              </p>
                              <div className="flex items-start gap-2">
                                <p className="line-clamp-1 flex-1 text-sm font-semibold">{work.title}</p>
                                {attempts.length > 1 && <Badge variant="secondary" className="h-5 shrink-0 px-2 text-[10px]">{t('scripts.attemptsCount', { count: attempts.length })}</Badge>}
                              </div>
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {t('scripts.chapterLabel', { name: work.episode.chapterName })} · {new Date(work.createdAt).toLocaleString(i18n.language)}
                              </p>
                              <div className="mt-2 flex items-center gap-1.5">
                                <Button size="sm" variant={work.status === 'published' ? 'outline' : 'default'} className="h-7 rounded-full px-3 text-[11px]" disabled={Boolean(generating[work.id])} onClick={() => void togglePublish(work)}>
                                  {generating[work.id]
                                    ? `生成中 ${generating[work.id]}%`
                                    : work.status === 'published'
                                      ? '取消发布'
                                      : work.videoUrl
                                        ? '发布到广场'
                                        : '生成视频并发布'}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 rounded-full px-2.5 text-[11px] text-muted-foreground" onClick={() => setHistoryWork(work)}>
                                  <History data-icon="inline-start" />
                                  {t('scripts.history')}
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
                  className="h-7 px-2 text-xs"
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
                  className="h-7 px-2 text-xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t('scripts.nextPage')}
                </Button>
              </div>
            </div>
          )}
        </div>
        <EpisodeWorkHistoryDialog
          open={Boolean(historyWork)}
          onOpenChange={(nextOpen) => { if (!nextOpen) setHistoryWork(null) }}
          works={historyWork ? works.filter((work) => work.episodeId === historyWork.episodeId) : []}
          onPublish={togglePublish}
        />
      </DialogContent>
    </Dialog>
  )
}

function EpisodeWorkHistoryDialog({
  open,
  onOpenChange,
  works,
  onPublish,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  works: ScriptWork[]
  onPublish: (work: ScriptWork) => Promise<void>
}) {
  const { t } = useTranslation()
  const [previewWork, setPreviewWork] = useState<ScriptWork | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const chronological = useMemo(
    () => [...works].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [works],
  )
  const ordered = useMemo(() => [...chronological].reverse(), [chronological])
  const episode = ordered[0]?.episode

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && previewWork) return
          onOpenChange(nextOpen)
        }}
      >
        <DialogContent
          className="flex max-h-[86dvh] w-[calc(100vw-2rem)] max-w-lg flex-col gap-4 overflow-hidden rounded-2xl p-5"
          onInteractOutside={(event) => {
            if (previewWork) event.preventDefault()
          }}
          onEscapeKeyDown={(event) => {
            if (previewWork) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>{episode ? t('scripts.practiceHistory', { name: episode.chapterName }) : t('scripts.practiceHistoryFallback')}</DialogTitle>
            <DialogDescription className="text-xs">
              {episode ? `${episode.scene.title} · ` : ''}{t('scripts.totalAttempts', { count: works.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
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
                  return (
                    <div key={work.id} className="flex gap-3 rounded-lg bg-muted/30 p-3">
                      <button
                        type="button"
                        className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted/60 text-left disabled:cursor-default"
                        disabled={!work.videoUrl}
                        onClick={() => setPreviewWork(work)}
                        aria-label={work.videoUrl ? t('scripts.viewAttemptVideo', { n: attempt }) : undefined}
                      >
                        {work.coverUrl && <img src={work.coverUrl} alt="" className="size-full object-cover" />}
                        {work.videoUrl && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/5">
                            <span className="flex size-8 items-center justify-center rounded-full bg-black/55 text-white">
                              <Play className="ml-0.5 size-3.5 fill-current" />
                            </span>
                          </span>
                        )}
                      </button>
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
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">{statusLabel}</span>
                          {work.videoUrl && (
                            <Button size="sm" variant="ghost" className="h-6 rounded-full px-2 text-[10px]" onClick={() => setPreviewWork(work)}>
                              {t('scripts.viewVideo')}
                            </Button>
                          )}
                          {work.status === 'published' ? (
                            <Badge variant="outline" className="h-6 rounded-full px-2 text-[10px]">
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
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Lightbox
        open={Boolean(previewWork?.videoUrl)}
        close={() => setPreviewWork(null)}
        slides={previewWork?.videoUrl ? [{
          type: 'video',
          sources: [{ src: previewWork.videoUrl, type: previewWork.videoMimeType ?? 'video/mp4' }],
        }] : []}
        plugins={[Video]}
        controller={{ closeOnBackdropClick: true }}
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
  const resolvedTitle = title ?? t('scripts.publishLog')
  const [items, setItems] = useState<ScriptPublishHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    void scriptCommunityApi.publishHistory({ episodeId, page, pageSize: 8 })
      .then((result) => {
        if (!active) return
        setItems(result.items)
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
  }, [episodeId, open, page])

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
                  <tr className="border-b border-border/45">
                    <th className="w-[46%] px-3 py-2 font-medium">{t('scripts.tableWork')}</th>
                    <th className="w-[22%] px-2 py-2 font-medium">{t('scripts.tableStatus')}</th>
                    <th className="w-[32%] px-2 py-2 font-medium">{t('scripts.tableSubmitTime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const meta = publishStatusMeta[item.status]
                    return (
                      <tr key={item.id} className="border-b border-border/35 last:border-0">
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
                          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                            {item.status === 'completed' ? '100%' : `${item.progress}%`}
                          </p>
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {formatPublishTime(item.createdAt)}
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
            <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft data-icon="inline-start" />
              {t('scripts.prevPage')}
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
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
  onWorkChanged,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  works: ScriptWork[]
  loading: boolean
  onOpenShop: () => void
  onWorkChanged: (workId: string, updater: (work: ScriptWork) => ScriptWork) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [previewWork, setPreviewWork] = useState<ScriptWork | null>(null)
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set())

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
          <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onOpenShop}>
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
                onOpen={() => setPreviewWork(work)}
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
        close={() => setPreviewWork(null)}
        plugins={[Video]}
        controller={{ closeOnBackdropClick: true }}
        carousel={{ finite: true }}
        slides={previewWork?.videoUrl ? [{
          type: 'video',
          width: 1280,
          height: 720,
          poster: previewWork.coverUrl ?? undefined,
          sources: [{ src: previewWork.videoUrl, type: previewWork.videoMimeType ?? 'video/mp4' }],
        }] : []}
        video={{ controls: true, playsInline: true }}
        render={{ buttonPrev: () => null, buttonNext: () => null }}
      />
    </div>
  )
}

function SquareWorkCard({
  work,
  onOpen,
  onLike,
  onReaction,
  likePending,
  reactionPending,
}: {
  work: ScriptWork
  onOpen: () => void
  onLike: () => void
  onReaction: (reaction: string) => void
  likePending: boolean
  reactionPending: boolean
}) {
  const { t } = useTranslation()
  const [reactionOpen, setReactionOpen] = useState(false)

  return (
    <Card className="overflow-hidden border-0 bg-muted/25 shadow-none dark:ring-0">
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
        <button
          type="button"
          onClick={onOpen}
          className="group relative mx-3 block w-[calc(100%-1.5rem)] overflow-hidden rounded-xl bg-foreground/90 text-left"
          aria-label={t('scripts.fullscreenView', { title: work.title })}
        >
          {work.coverUrl ? (
            <img src={work.coverUrl} alt="" className="aspect-[2/1] max-h-52 w-full object-cover" />
          ) : (
            <div className="aspect-[2/1] max-h-52 w-full bg-muted-foreground/20" />
          )}
          <span className="absolute inset-0 bg-black/10 transition-colors group-active:bg-black/20" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
              <Play className="ml-0.5 size-5 fill-current" />
            </span>
          </span>
          <span className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <Maximize2 className="size-3.5" />
          </span>
        </button>
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
            className="h-8 rounded-full px-2.5"
            onClick={onLike}
            disabled={likePending}
          >
            <Heart data-icon="inline-start" />
            {t('scripts.likeCount', { count: work._count.likes })}
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
              className="w-[min(19rem,calc(100vw-2rem))] rounded-2xl border-0 bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-full px-2.5"
            disabled={!work.videoUrl}
            onClick={onOpen}
          >
            <Film data-icon="inline-start" />
            {work.videoUrl ? t('scripts.viewVideo') : t('scripts.noVideo')}
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-8 rounded-full px-2.5">
            <Link to={`/scripts/packages/${work.episode.scene.id}/episodes/${work.episode.id}`}>
              <Sparkles data-icon="inline-start" />
              {t('scripts.practiceSame')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RecordList({ records, loading }: { records: ScriptPracticeRecord[]; loading: boolean }) {
  const [mode, setMode] = useState('all')
  const [replayRecord, setReplayRecord] = useState<ScriptPracticeRecord | null>(null)
  const visible = records.filter((record) => {
    if (mode === 'all') return true
    return record.mode === mode
  })

  return (
    <Tabs value={mode} onValueChange={setMode} className="flex h-full min-h-0 flex-col">
      <TabsList className="mb-3 grid w-full shrink-0 grid-cols-3">
        <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
        <TabsTrigger value="vn" className="text-xs">VN</TabsTrigger>
        <TabsTrigger value="repeat" className="text-xs">跟读</TabsTrigger>
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <MobilePageLoading rows={4} minHeightClassName="min-h-[40vh]" />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Clock3 className="size-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">还没有剧本练习记录</p>
            <p className="text-xs text-muted-foreground/60">完成一个章节后，记录会自动保存在这里</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((record) => (
              <button key={record.id} type="button" onClick={() => setReplayRecord(record)} className="w-full text-left">
                <div className="rounded-lg bg-muted/30 p-3.5 transition-colors hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardDescription className="text-xs">{record.episode.scene.title} · {record.episode.chapterName}</CardDescription>
                    <CardTitle className="mt-1 truncate text-sm">{record.episode.title}</CardTitle>
                  </div>
                  <Badge variant={record.mode === 'vn' ? 'default' : 'secondary'}>{record.mode === 'vn' ? 'VN' : '跟读'}</Badge>
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>{record.mode === 'vn' ? record.turnCount : record.lineCount} 次开口</span>
                  <span>{record.usedChunkCount} 个表达</span>
                  <span>{Math.max(0, Math.round(record.durationSec / 60))} 分钟</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <ScriptRecordReplayDialog record={replayRecord} onClose={() => setReplayRecord(null)} />
    </Tabs>
  )
}

function ScriptRecordReplayDialog({ record, onClose }: { record: ScriptPracticeRecord | null; onClose: () => void }) {
  const replayLines = useMemo<VnPlayerLine[]>(
    () => record?.resultSnapshot?.dialogue?.map((line) => ({
      speaker: line.speaker,
      text: line.text,
      isUser: line.isUser,
    })) ?? [],
    [record],
  )
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => setLineIndex(0), [record?.id])

  if (!record) return null
  const isEnded = replayLines.length > 0 && lineIndex >= replayLines.length
  const currentLine = isEnded ? null : replayLines[lineIndex] ?? null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 p-0 [&>button]:hidden">
        <DialogHeader className="sr-only"><DialogTitle>剧本练习回放</DialogTitle></DialogHeader>
        {replayLines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-muted-foreground">这条旧记录未保存对话内容，暂时无法回放。</p>
            <Button variant="outline" onClick={onClose}>关闭</Button>
          </div>
        ) : (
          <div className="relative h-full bg-background">
            <div className="absolute inset-x-0 top-0 z-40 flex justify-center px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
              <div className="flex h-9 w-full max-w-[400px] items-center gap-2 rounded-full border border-border/55 bg-background/90 px-2 shadow-lg backdrop-blur-2xl">
                <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={onClose}>关闭</Button>
                <span className="min-w-0 flex-1 truncate text-center text-xs font-medium text-muted-foreground">{record.episode.title} · 对话回放</span>
              </div>
            </div>
            <VnPlayer
              className="h-full max-w-none rounded-none border-none"
              stageClassName="min-h-0"
              currentLine={currentLine}
              history={replayLines.slice(0, Math.min(lineIndex, replayLines.length))}
              isEnded={isEnded}
              onAdvance={() => setLineIndex((current) => Math.min(current + 1, replayLines.length))}
              showHistoryButton={false}
              endedActions={<Button size="sm" className="rounded-full" onClick={onClose}>完成回放</Button>}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScriptShop({
  units,
  ownedIds,
  installedIds,
  downloadTasks,
  loading,
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
  onRefresh: () => Promise<void>
  onEnroll: (unit: LearningUnitSummary) => Promise<void>
  onDownload: (id: string) => Promise<void>
  onNavigate: () => void
}) {
  const [keyword, setKeyword] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<LearningUnitSummary | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [chapterPage, setChapterPage] = useState(1)
  const [acquiringId, setAcquiringId] = useState<string | null>(null)
  const pageSize = 6
  const filteredUnits = units.filter((unit) => {
    const query = keyword.trim().toLocaleLowerCase()
    if (!query) return true
    return [unit.title, unit.location, unit.description]
      .some((value) => value?.toLocaleLowerCase().includes(query))
  })

  const search = (
    <div className="relative mb-3 mt-1">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="搜索剧本"
        className="h-11 rounded-full border-0 bg-muted/70 pl-9 text-sm"
      />
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
          <p className="mt-4 text-muted-foreground">{keyword.trim() ? '没有匹配的剧本' : '暂无可用剧本'}</p>
          {!keyword.trim() && (
            <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => void onRefresh()}>
              重新加载
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
                <ScriptCover url={unit.coverImage} className="size-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex items-start gap-2">
                  <h3 className="line-clamp-1 flex-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</h3>
                  {unit.isLocked && <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{displayScriptLocation(unit.location, '沉浸式英语剧场')}</p>
                <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                  {unit.scriptCount} 个章节 · {unit.vocabCount} 个单词 · {unit.chunkCount} 个句块
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">{unit.isFree ? '免费' : '会员'}</Badge>
                  {/* {installed && <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">已离线</Badge>} */}
                  {(task?.status === 'downloading' || task?.status === 'extracting') && (
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">{Math.round(task.progress)}%</Badge>
                  )}
                  <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">Lv.{unit.requiredUserLevel}</Badge>
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
  onDescriptionToggle: () => void
  onChapterPageChange: (page: number) => void
  onClose: () => void
  onNavigate: () => void
  onDownload: (id: string) => Promise<void>
  onEnroll: () => Promise<void>
}) {
  const downloading = task?.status === 'downloading' || task?.status === 'extracting'
  const totalPages = Math.max(1, Math.ceil(unit.topics.length / pageSize))
  const chapters = unit.topics.slice((chapterPage - 1) * pageSize, chapterPage * pageSize)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[88vh] w-[90vw] overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{unit.title}</DialogTitle>
          <DialogDescription>{displayScriptLocation(unit.location, '沉浸式英语剧场')}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex gap-3 bg-muted/30 p-4">
            <div className="flex aspect-square size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
              <ScriptCover url={unit.coverImage} className="size-full object-cover" iconClassName="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="rounded-full text-[10px]">{unit.isFree ? '免费' : '会员'}</Badge>
                {unit.categoryName && <Badge variant="secondary" className="rounded-full text-[10px]">{unit.categoryName}</Badge>}
                {unit.isLocked && <Badge variant="outline" className="rounded-full text-[10px]">未解锁</Badge>}
              </div>
              <h3 className="mt-2 line-clamp-2 text-base font-bold leading-5">{unit.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{displayScriptLocation(unit.location, '沉浸式英语剧场')}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{unit.scriptCount} 个章节</span>
                <span>{unit.vocabCount} 个单词</span>
                <span>{unit.chunkCount} 个句块</span>
              </div>
            </div>
          </div>

          {unit.description && (
            <div className="border-b border-border/50 px-4 py-3">
              <p className={cn('text-xs leading-5 text-muted-foreground', !descriptionExpanded && 'line-clamp-1')}>{unit.description}</p>
              {unit.description.length > 40 && (
                <button type="button" onClick={onDescriptionToggle} className="mt-1 flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
                  {descriptionExpanded ? '收起' : '展开'}
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
              <Button className="w-full" disabled><Loader2 className="animate-spin" />等待下载</Button>
            ) : task?.status === 'error' ? (
              <Button variant="destructive" className="w-full" onClick={() => void onDownload(unit.id)}>下载失败，点击重试</Button>
            ) : installed ? (
              <Button variant="outline" className="w-full" asChild>
                <Link to={`/scripts/packages/${unit.id}`} onClick={onNavigate}>进入剧本</Link>
              </Button>
            ) : owned ? (
              <Button className="w-full" onClick={() => void onDownload(unit.id)}>
                <Download data-icon="inline-start" />重新下载
              </Button>
            ) : unit.isLocked ? (
              <Button className="w-full" asChild>
                <Link to="/member" onClick={onNavigate}><LockKeyhole data-icon="inline-start" />查看权益</Link>
              </Button>
            ) : (
              <Button className="w-full" disabled={acquiring} onClick={() => void onEnroll()}>
                {acquiring ? <Loader2 className="animate-spin" /> : <Play data-icon="inline-start" />}
                {acquiring ? '正在开始…' : '开始学习'}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5">
            <p className="text-xs font-medium">章节列表</p>
            {unit.topics.length > pageSize && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <button type="button" disabled={chapterPage === 1} onClick={() => onChapterPageChange(Math.max(1, chapterPage - 1))} className="disabled:opacity-40">上一页</button>
                <span>{chapterPage}/{totalPages}</span>
                <button type="button" disabled={chapterPage === totalPages} onClick={() => onChapterPageChange(Math.min(totalPages, chapterPage + 1))} className="disabled:opacity-40">下一页</button>
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
                    <Badge variant="outline" className="rounded-full text-[10px]">{chapter.difficulty}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="py-8 text-center text-sm text-muted-foreground">暂无章节</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
