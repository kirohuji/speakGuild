import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Clock3,
  Download,
  Film,
  Heart,
  Image,
  Loader2,
  Layers3,
  LockKeyhole,
  Play,
  Search,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Virtuoso } from 'react-virtuoso'
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
  type ScriptPracticeRecord,
  type ScriptWork,
} from '@/features/scripts/api/script-community-api'
import {
  LearningPackDownloadDrawer,
  LearningPackDownloadStatusButton,
} from '@/layout/learning-pack-download-monitor'
import { useLearningStore } from '@/stores/learning.store'
import { cn } from '@/lib/cn'

export function ScriptCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const panel = searchParams.get('panel')
  const tab = searchParams.get('tab') === 'square' ? 'square' : 'mine'
  const [shopOpen, setShopOpen] = useState(panel === 'store')
  const [recordsOpen, setRecordsOpen] = useState(panel === 'records')
  const [downloadOpen, setDownloadOpen] = useState(false)
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
      toast.error('剧本商店加载失败')
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
      await learningApi.startUnit(unit.id)
      await refreshMyUnits()
      toast.success(`《${unit.title}》已加入我的剧本`)
    } catch {
      toast.error('加入剧本失败')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3">
      <div className="mb-3 flex items-center justify-between">
        <div />
        <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45">
          <LearningPackDownloadStatusButton onClick={() => setDownloadOpen(true)} embedded />
          <button
            type="button"
            onClick={() => setPanel('records')}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
            aria-label="剧本练习记录"
          >
            <Clock3 className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => setPanel('store')}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
            aria-label="剧本商店"
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
          <TabsTrigger value="mine" className="rounded-lg">我的</TabsTrigger>
          <TabsTrigger value="square" className="rounded-lg">广场</TabsTrigger>
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
            onChanged={() => loadFeed()}
            hasMore={Boolean(feedCursor)}
            loadingMore={feedLoadingMore}
            onLoadMore={() => feedCursor ? loadFeed(feedCursor, true) : Promise.resolve()}
          />
        </TabsContent>
      </Tabs>

      <LearningPackDownloadDrawer open={downloadOpen} onOpenChange={setDownloadOpen} />

      <Drawer open={recordsOpen} onOpenChange={(open) => setPanel(open ? 'records' : null)}>
        <DrawerContent className="flex h-[95vh] max-h-[95vh] flex-col rounded-t-[28px] border-border/70 bg-background drawer-surface">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">剧本练习记录</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <RecordList records={records} loading={recordsLoading} />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={shopOpen} onOpenChange={(open) => setPanel(open ? 'store' : null)}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">剧本商店</DrawerTitle>
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
  works: ScriptWork[]
  worksLoading: boolean
  onWorksChanged: () => Promise<void>
}) {
  const [worksOpen, setWorksOpen] = useState(false)

  if (loading && units.length === 0) {
    return (
      <div className="rounded-lg bg-muted/30 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="size-4 animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">正在获取剧本计划</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">正在同步你加入的剧本和章节进度</p>
          </div>
        </div>
      </div>
    )
  }

  if (units.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg bg-muted/30 px-6 py-14 text-center">
        <Clapperboard className="size-10 text-muted-foreground/40" />
        <p className="mt-4 text-sm text-muted-foreground">你还没有开始练习剧本</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-full"
          onClick={(event) => {
            event.currentTarget.blur()
            onOpenShop()
          }}
        >
          前往剧本商店
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {activeUnit && (
        <section className="flex flex-col gap-2">
          <p className="px-1 text-xs font-medium text-muted-foreground">继续演出</p>
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
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{activeUnit.location || '口袋剧场'}</p>
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
                          继续剧情
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 rounded-full"
                        disabled={downloadTasks.some((task) => task.packId === activeUnit.id && task.status !== 'error')}
                        onClick={() => void onDownload(activeUnit.id)}
                      >
                        <Download data-icon="inline-start" />
                        下载剧本
                      </Button>
                    )}
                    <Button asChild variant="outline" className="rounded-full">
                      <Link to={`/scripts/packages/${activeUnit.id}`}>章节目录</Link>
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
          <p className="text-xs font-medium text-muted-foreground">我的作品</p>
          <Button variant="ghost" size="sm" onClick={() => setWorksOpen(true)}>查看更多</Button>
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
          <p className="text-xs font-medium text-muted-foreground">我的剧本</p>
          <Button variant="ghost" size="sm" onClick={onOpenShop}>探索更多</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {units.map((unit) => (
            <Link key={unit.id} to={`/scripts/packages/${unit.id}`} className="group">
              <Card className="h-full overflow-hidden border-0 bg-muted/30 shadow-none transition-transform group-active:scale-[0.98]">
                <div className="aspect-[4/3] bg-muted/50 p-3">
                  <Badge variant="secondary">{unit.scriptCount} 章</Badge>
                </div>
                <CardHeader className="p-3">
                  <CardTitle className="line-clamp-1 text-sm">{unit.title}</CardTitle>
                  <CardDescription className="line-clamp-1 text-xs">
                    {unit.location || '沉浸式英语剧场'}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
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
  const togglePublish = async (work: ScriptWork) => {
    try {
      if (work.status === 'published') await scriptCommunityApi.unpublishWork(work.id)
      else await scriptCommunityApi.publishWork(work.id)
      toast.success(work.status === 'published' ? '作品已转为仅自己可见' : '作品已发布到广场')
      await onChanged()
    } catch (error: any) {
      toast.error(error?.message || '作品状态更新失败')
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
          <p className="text-sm font-medium text-foreground">还没有作品</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">完成章节后，可以生成并发布学习作品</p>
        </div>
      </div>
    )
  }

  const latestByEpisode = Array.from(works.reduce((map, work) => {
    if (!map.has(work.episodeId)) map.set(work.episodeId, work)
    return map
  }, new Map<string, ScriptWork>()).values()).slice(0, 4)

  return (
    <div className="-mx-2 flex snap-x gap-2 overflow-x-auto px-2 pb-1">
      {latestByEpisode.map((work) => (
        <Card key={work.id} className="w-44 shrink-0 snap-start overflow-hidden border-0 bg-muted/30 shadow-none">
          <div className="relative aspect-video bg-muted/50">
            {work.coverUrl && <img src={work.coverUrl} alt="" className="size-full object-cover" />}
            <Badge variant="secondary" className="absolute left-2 top-2 h-5 px-2 text-[10px]">
              {work.kind === 'progress_card' ? '进度卡' : work.kind === 'vn_video' ? 'VN' : '跟读'}
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
            <CardTitle className="truncate text-sm">{work.title}</CardTitle>
            <CardDescription className="truncate text-xs">{work.episode.scene.title} · {work.episode.chapterName}</CardDescription>
          </CardHeader>
          <CardFooter className="px-2.5 pb-2.5">
            <Button
              size="sm"
              variant={work.status === 'published' ? 'outline' : 'default'}
              className="h-8 w-full rounded-full text-xs"
              disabled={!['ready', 'published'].includes(work.status)}
              onClick={() => void togglePublish(work)}
            >
              {work.status === 'published' ? '取消发布' : work.status === 'ready' ? '发布到广场' : '等待视频'}
            </Button>
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
  const [search, setSearch] = useState('')
  const [sceneId, setSceneId] = useState('all')
  const [groupMode, setGroupMode] = useState<'time' | 'package'>('time')

  const scenes = useMemo(() => Array.from(
    new Map(works.map((work) => [work.episode.scene.id, work.episode.scene])).values(),
  ), [works])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase()
    return [...works]
      .filter((work) => sceneId === 'all' || work.episode.scene.id === sceneId)
      .filter((work) => !keyword || [
        work.title,
        work.caption,
        work.episode.title,
        work.episode.chapterName,
        work.episode.scene.title,
      ].some((value) => value?.toLocaleLowerCase().includes(keyword)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [sceneId, search, works])

  const episodeAttempts = useMemo(() => {
    const map = new Map<string, ScriptWork[]>()
    works.forEach((work) => map.set(work.episodeId, [...(map.get(work.episodeId) ?? []), work]))
    for (const attempts of map.values()) attempts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return map
  }, [works])

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; works: ScriptWork[] }>()
    filtered.forEach((work) => {
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
  }, [filtered, groupMode])

  const togglePublish = async (work: ScriptWork) => {
    try {
      if (work.status === 'published') await scriptCommunityApi.unpublishWork(work.id)
      else await scriptCommunityApi.publishWork(work.id)
      await onChanged()
    } catch (error: any) {
      toast.error(error?.message || '作品状态更新失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>我的作品</DialogTitle>
          <DialogDescription>查看全部剧本练习作品</DialogDescription>
        </DialogHeader>

        <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 pb-[env(safe-area-inset-bottom,0px)] pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
          <header className="mb-4 flex shrink-0 items-center gap-3">
            <button type="button" onClick={() => onOpenChange(false)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground" aria-label="返回">
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
              <p className="text-xs text-muted-foreground">剧本</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">我的作品</h1>
            </div>
            <Badge variant="secondary">{filtered.length}</Badge>
          </header>

          <div className="mb-3 flex shrink-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 rounded-xl border-border/60 bg-muted/45 pl-9 shadow-none" placeholder="搜索作品、章节或剧本包" />
            </div>
            <button type="button" onClick={() => setGroupMode('time')} className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border', groupMode === 'time' ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-muted/45 text-muted-foreground')} aria-label="按时间分组">
              <CalendarDays className="size-4" />
            </button>
            <button type="button" onClick={() => setGroupMode('package')} className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border', groupMode === 'package' ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-muted/45 text-muted-foreground')} aria-label="按剧本包分组">
              <Layers3 className="size-4" />
            </button>
          </div>

          <div className="mb-3 shrink-0 overflow-x-auto">
            <div className="flex gap-2">
              <button type="button" onClick={() => setSceneId('all')} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', sceneId === 'all' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>全部剧本</button>
              {scenes.map((scene) => (
                <button key={scene.id} type="button" onClick={() => setSceneId(scene.id)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', sceneId === scene.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>{scene.title}</button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-6">
            {loading ? <MobilePageLoading rows={4} minHeightClassName="min-h-[50vh]" /> : groups.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">没有匹配的作品</div>
            ) : (
              <div className="space-y-5">
                {groups.map((group) => (
                  <section key={group.label}>
                    <div className="mb-2 flex items-center justify-between px-1">
                      <h2 className="text-xs font-medium text-muted-foreground">{group.label}</h2>
                      <span className="text-[11px] text-muted-foreground">{group.works.length} 个作品</span>
                    </div>
                    <div className="space-y-2">
                      {group.works.map((work) => {
                        const attempts = episodeAttempts.get(work.episodeId) ?? [work]
                        const attempt = attempts.findIndex((item) => item.id === work.id) + 1
                        const latest = attempt === attempts.length
                        return (
                          <div key={work.id} className="flex gap-3 rounded-lg bg-muted/30 p-3">
                            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted/60">
                              {work.coverUrl && <img src={work.coverUrl} alt="" className="size-full object-cover" />}
                              {work.videoUrl && <Play className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-primary" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <p className="line-clamp-1 flex-1 text-sm font-semibold">{work.title}</p>
                                {attempts.length > 1 && <Badge variant={latest ? 'default' : 'secondary'} className="h-5 shrink-0 px-2 text-[10px]">{latest ? '最新' : `第 ${attempt} 次`}</Badge>}
                              </div>
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{work.episode.chapterName} · {new Date(work.createdAt).toLocaleString('zh-CN')}</p>
                              <Button size="sm" variant={work.status === 'published' ? 'outline' : 'default'} className="mt-2 h-7 rounded-full px-3 text-[11px]" disabled={!['ready', 'published'].includes(work.status)} onClick={() => void togglePublish(work)}>
                                {work.status === 'published' ? '取消发布' : work.status === 'ready' ? '发布到广场' : '等待视频'}
                              </Button>
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

const reactions = ['太棒了', '发音真自然', '剧情感拉满', '我也在练', '继续加油', '学到了']

function SquareFeed({
  works,
  loading,
  onOpenShop,
  onChanged,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  works: ScriptWork[]
  loading: boolean
  onOpenShop: () => void
  onChanged: () => Promise<void>
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => Promise<void>
}) {
  const toggleLike = async (work: ScriptWork) => {
    if (work.liked) await scriptCommunityApi.unlike(work.id)
    else await scriptCommunityApi.like(work.id)
    await onChanged()
  }

  const toggleReaction = async (work: ScriptWork, reaction: string) => {
    if (work.myReaction === reaction) await scriptCommunityApi.removeReaction(work.id)
    else await scriptCommunityApi.react(work.id, reaction)
    await onChanged()
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
          <p className="mt-4 text-sm text-muted-foreground">这里还没有公开作品</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onOpenShop}>
            前往剧本商店
          </Button>
        </div>
      ) : (
        <Virtuoso
          className="h-[calc(100dvh-13.5rem)]"
          data={works}
          endReached={() => {
            if (hasMore && !loadingMore) void onLoadMore()
          }}
          increaseViewportBy={500}
          itemContent={(_index, work) => (
            <div className="pb-3">
              <SquareWorkCard
                work={work}
                onLike={() => void toggleLike(work)}
                onReaction={(reaction) => void toggleReaction(work, reaction)}
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
    </div>
  )
}

function SquareWorkCard({
  work,
  onLike,
  onReaction,
}: {
  work: ScriptWork
  onLike: () => void
  onReaction: (reaction: string) => void
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center gap-3 p-4">
        <Avatar className="size-10">
          <AvatarImage src={work.user.image ?? undefined} alt={work.user.name} />
          <AvatarFallback>{work.user.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-sm">{work.user.name}</CardTitle>
          <CardDescription className="text-xs">Lv.{work.user.userLevel} · {work.episode.scene.title}</CardDescription>
        </div>
        <Badge variant="secondary">
          {work.kind === 'progress_card' ? '学习进度' : work.kind === 'vn_video' ? 'VN' : '跟读'}
        </Badge>
      </CardHeader>

      {work.videoUrl ? (
        <video
          src={work.videoUrl}
          poster={work.coverUrl ?? undefined}
          controls
          preload="metadata"
          playsInline
          className="aspect-video w-full bg-muted object-cover"
        />
      ) : (
        <div className="relative flex aspect-video items-end bg-gradient-to-br from-primary/25 via-muted/60 to-background p-5">
          {work.coverUrl && <img src={work.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />}
          <div className="relative">
            <Badge variant="secondary">章节完成</Badge>
            <p className="mt-2 text-lg font-semibold">{work.episode.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{work.episode.chapterName}</p>
          </div>
        </div>
      )}

      <CardContent className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">{work.title}</p>
          {work.caption && <p className="mt-1 text-sm leading-6 text-muted-foreground">{work.caption}</p>}
        </div>
        {work.reactionGroups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {work.reactionGroups.map((group) => (
              <Badge key={group.reaction} variant="secondary">{group.reaction} {group.count}</Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={work.liked ? 'default' : 'outline'}
            className="rounded-full"
            onClick={onLike}
          >
            <Heart data-icon="inline-start" />
            {work._count.likes}
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to={`/scripts/packages/${work.episode.scene.id}/episodes/${work.episode.id}`}>
              <Sparkles data-icon="inline-start" />
              练同款
            </Link>
          </Button>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {reactions.map((reaction) => (
            <Button
              key={reaction}
              size="sm"
              variant={work.myReaction === reaction ? 'secondary' : 'ghost'}
              className="shrink-0 rounded-full"
              onClick={() => onReaction(reaction)}
            >
              {reaction}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RecordList({ records, loading }: { records: ScriptPracticeRecord[]; loading: boolean }) {
  const [mode, setMode] = useState('all')
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
              <Link key={record.id} to={`/scripts/packages/${record.episode.scene.id}/episodes/${record.episode.id}`}>
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </Tabs>
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
              <div className="flex aspect-square size-[72px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Clapperboard className="size-7" />
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex items-start gap-2">
                  <h3 className="line-clamp-1 flex-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</h3>
                  {unit.isLocked && <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unit.location || '沉浸式英语剧场'}</p>
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
          <DialogDescription>{unit.location}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex gap-3 bg-muted/30 p-4">
            <div className="flex aspect-square size-20 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Clapperboard className="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="rounded-full text-[10px]">{unit.isFree ? '免费' : '会员'}</Badge>
                {unit.categoryName && <Badge variant="secondary" className="rounded-full text-[10px]">{unit.categoryName}</Badge>}
                {unit.isLocked && <Badge variant="outline" className="rounded-full text-[10px]">未解锁</Badge>}
              </div>
              <h3 className="mt-2 line-clamp-2 text-base font-bold leading-5">{unit.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{unit.location || '沉浸式英语剧场'}</p>
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
                <Download data-icon="inline-start" />离线下载
              </Button>
            ) : unit.isLocked ? (
              <Button className="w-full" asChild>
                <Link to="/member" onClick={onNavigate}><LockKeyhole data-icon="inline-start" />查看权益</Link>
              </Button>
            ) : (
              <Button className="w-full" disabled={acquiring} onClick={() => void onEnroll()}>
                {acquiring ? <Loader2 className="animate-spin" /> : <Play data-icon="inline-start" />}
                {acquiring ? '加入中…' : '加入剧本'}
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
