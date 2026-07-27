import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Clock3,
  Download,
  Film,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Play,
  Quote,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { learningApi, type StoryEpisodeItem, type UnitDetail } from '@/features/learning/api/learning-api'
import { useLearningStore } from '@/stores/learning.store'

export function ScriptPackagePage() {
  const { packageId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<UnitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const downloadedPacks = useLearningStore((state) => state.downloadedPacks)
  const downloadTasks = useLearningStore((state) => state.downloadTasks)
  const downloadUnitPack = useLearningStore((state) => state.downloadUnitPack)

  useEffect(() => {
    if (!packageId) return
    setLoading(true)
    learningApi.getUnitDetail(packageId)
      .then((result) => {
        if (!result || result.packageType !== 'story') {
          setDetail(null)
          return
        }
        setDetail(result)
      })
      .catch(() => toast.error('剧本详情加载失败'))
      .finally(() => setLoading(false))
  }, [packageId])

  const installed = downloadedPacks.some((pack) => pack.packId === packageId && pack.status === 'installed')
  const downloading = downloadTasks.some((task) => task.packId === packageId && task.status !== 'error')
  const episodes = detail?.storyEpisodes ?? []
  const completed = episodes.filter((episode) => episode.record?.passed).length
  const progress = episodes.length > 0 ? (completed / episodes.length) * 100 : 0
  const nextEpisode = episodes.find((episode) => episode.isUnlocked && !episode.record?.passed) ?? episodes[0]

  if (loading) return <PackageSkeleton />

  if (!detail) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <Clapperboard className="size-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">没有找到这个剧本</p>
        <Button variant="outline" onClick={() => navigate('/scripts')}>
          返回剧本
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-10 pt-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/scripts')}>
          <ArrowLeft />
          <span className="sr-only">返回剧本</span>
        </Button>
        <Badge variant="secondary">{detail.requiredOutputLevel}</Badge>
      </div>

      <Card className="overflow-hidden">
        <div className="relative min-h-72 bg-gradient-to-br from-primary/35 via-muted/50 to-background p-6">
          <div className="absolute -right-12 -top-10 size-48 rounded-full bg-background/35 blur-3xl" />
          <div className="relative flex min-h-60 flex-col justify-between gap-10">
            <div className="flex items-start justify-between gap-3">
              <Badge>{installed ? '已离线' : '口袋剧场'}</Badge>
              <span className="text-xs font-medium text-muted-foreground">{episodes.length} 章</span>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{detail.location}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">{detail.title}</h1>
                {detail.description && (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground">{completed}/{episodes.length}</span>
              </div>
              {!installed ? (
                <Button
                  className="rounded-full"
                  disabled={downloading}
                  onClick={() => packageId && void downloadUnitPack(packageId)}
                >
                  {downloading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                  {downloading ? '正在准备离线内容' : '下载剧本'}
                </Button>
              ) : nextEpisode ? (
                <Button asChild className="rounded-full">
                  <Link to={`/scripts/packages/${detail.id}/episodes/${nextEpisode.id}`}>
                    <Play data-icon="inline-start" />
                    {nextEpisode.record ? '继续下一章' : '开始剧情'}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1">
          <Film className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">章节</h2>
        </div>
        <div className="flex flex-col gap-2">
          {episodes.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg bg-muted/30 px-6 py-12 text-center">
              <BookOpen className="size-10 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">章节正在编排</p>
              <p className="mt-1 text-xs text-muted-foreground/60">发布后会显示在这里</p>
            </div>
          ) : episodes.map((episode, index) => (
            <EpisodeRow
              key={episode.id}
              episode={episode}
              index={index}
              packageId={detail.id}
              installed={installed}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">剧中表达</h2>
        </div>
        <Tabs defaultValue="vocab" className="flex flex-col gap-3">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vocab">单词 {detail.vocabCount}</TabsTrigger>
            <TabsTrigger value="chunks">句块 {detail.chunkCount}</TabsTrigger>
            <TabsTrigger value="patterns">句型 {detail.sentencePatterns.length}</TabsTrigger>
          </TabsList>
          <TabsContent value="vocab" className="mt-0">
            <ResourceList
              empty="暂无单词"
              items={detail.vocabularies.slice(0, 12).map((item) => ({
                primary: item.word,
                secondary: item.meaning,
              }))}
            />
          </TabsContent>
          <TabsContent value="chunks" className="mt-0">
            <ResourceList
              empty="暂无句块"
              items={detail.chunks.slice(0, 12).map((item) => ({
                primary: item.text,
                secondary: item.meaning,
              }))}
            />
          </TabsContent>
          <TabsContent value="patterns" className="mt-0">
            <ResourceList
              empty="暂无句型"
              items={detail.sentencePatterns.slice(0, 12).map((item) => ({
                primary: item.pattern,
                secondary: item.meaning,
              }))}
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}

function EpisodeRow({
  episode,
  index,
  packageId,
  installed,
}: {
  episode: StoryEpisodeItem
  index: number
  packageId: string
  installed: boolean
}) {
  const locked = !episode.isUnlocked || !installed
  const row = (
    <Card className="transition-transform active:scale-[0.99]">
      <CardHeader className="flex-row items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          {episode.record?.passed ? <Check className="size-4 text-primary" /> : index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardDescription className="truncate text-xs">{episode.chapterName}</CardDescription>
            {episode.isPreview && <Badge variant="secondary">试看</Badge>}
          </div>
          <CardTitle className="mt-1 truncate text-sm">{episode.title}</CardTitle>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{episode.characterName}</span>
            <span>{episode.objectives.length} 个剧情目标</span>
          </div>
        </div>
        {locked ? <LockKeyhole className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      </CardHeader>
    </Card>
  )

  if (locked) return row
  return <Link to={`/scripts/packages/${packageId}/episodes/${episode.id}`}>{row}</Link>
}

function ResourceList({
  items,
  empty,
}: {
  items: Array<{ primary: string; secondary: string }>
  empty: string
}) {
  if (items.length === 0) {
    return <p className="rounded-lg bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-0 p-0">
        {items.map((item, index) => (
          <div key={`${item.primary}-${index}`} className="flex items-start justify-between gap-4 border-b border-border/50 px-4 py-3 last:border-b-0">
            <p className="min-w-0 flex-1 text-sm font-medium">{item.primary}</p>
            <p className="max-w-[45%] text-right text-xs leading-5 text-muted-foreground">{item.secondary}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PackageSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-3">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}
