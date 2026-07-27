import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Film,
  Headphones,
  LockKeyhole,
  MessageCircle,
  Mic2,
  Play,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { learningApi, type StoryEpisodeItem, type UnitDetail } from '@/features/learning/api/learning-api'

export function ScriptEpisodePage() {
  const { packageId, episodeId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<UnitDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!packageId) return
    setLoading(true)
    learningApi.getUnitDetail(packageId)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [packageId])

  const episode = useMemo(
    () => detail?.storyEpisodes?.find((item) => item.id === episodeId) ?? null,
    [detail, episodeId],
  )

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-60 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  if (!detail || !episode) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <Film className="size-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">没有找到这个章节</p>
        <Button variant="outline" onClick={() => navigate(`/scripts/packages/${packageId}`)}>
          返回剧本
        </Button>
      </div>
    )
  }

  const keyExpressions = [
    ...episode.chunks.map((item) => ({ primary: item.text, secondary: item.meaning })),
    ...episode.sentencePatterns.map((item) => ({ primary: item.pattern, secondary: item.meaning })),
    ...episode.vocabularies.map((item) => ({ primary: item.word, secondary: item.meaning })),
  ].slice(0, 8)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-10 pt-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(`/scripts/packages/${detail.id}`)}>
          <ArrowLeft />
          <span className="sr-only">返回《{detail.title}》</span>
        </Button>
        <div className="flex items-center gap-2">
          {episode.record?.passed && <Badge><CheckCircle2 className="mr-1 size-3" />已完成</Badge>}
          <Badge variant="secondary">{episode.requiredOutputLevel}</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="relative min-h-60 bg-gradient-to-br from-foreground/20 via-primary/15 to-background p-6">
          <div className="absolute right-5 top-5 flex size-12 items-center justify-center rounded-full bg-background/50 backdrop-blur-xl">
            <Clapperboard className="size-5 text-primary" />
          </div>
          <div className="relative flex min-h-48 max-w-md flex-col justify-end">
            <p className="text-xs font-medium text-muted-foreground">{detail.title} · {episode.chapterName}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{episode.title}</h1>
            {episode.description && (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{episode.description}</p>
            )}
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="p-4">
            <UserRound className="size-5 text-primary" />
            <CardDescription className="mt-2 text-xs">本章角色</CardDescription>
            <CardTitle className="text-sm">{episode.characterName}</CardTitle>
            <CardDescription className="text-xs">{episode.characterRole}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-4">
            <Clock3 className="size-5 text-primary" />
            <CardDescription className="mt-2 text-xs">建议体验</CardDescription>
            <CardTitle className="text-sm">6～12 分钟</CardTitle>
            <CardDescription className="text-xs">{episode.objectives.length} 个剧情目标</CardDescription>
          </CardHeader>
        </Card>
      </section>

      {episode.objectives.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <MessageCircle className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">本章沟通目标</h2>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-3 p-4">
              {episode.objectives.map((objective, index) => (
                <div key={`${objective}-${index}`} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-5">{objective}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">开演前看一眼</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-0 p-0">
            {keyExpressions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                本章没有额外的表达预习，可以直接进入剧情。
              </p>
            ) : keyExpressions.map((item, index) => (
              <div key={`${item.primary}-${index}`} className="flex items-start justify-between gap-4 border-b border-border/50 px-4 py-3 last:border-b-0">
                <p className="min-w-0 flex-1 text-sm font-medium">{item.primary}</p>
                <p className="max-w-[45%] text-right text-xs leading-5 text-muted-foreground">{item.secondary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <ModeCard
          icon={Play}
          title="VN 互动模式"
          description="作为角色主动回答，用自己的表达推动剧情。"
          meta="训练沟通与临场反应"
          to={`/scripts/player/${episode.id}?packageId=${detail.id}&mode=vn`}
          disabled={!episode.isUnlocked || !episode.inkScriptId}
        />
        <ModeCard
          icon={Mic2}
          title="跟读剧场"
          description="听原声、逐句模仿，再完成一段完整角色演出。"
          meta="训练发音、节奏与语调"
          to={`/scripts/player/${episode.id}?packageId=${detail.id}&mode=repeat`}
          disabled={!episode.isUnlocked || !episode.inkScriptId}
        />
      </section>

      {episode.record && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">上次演出</CardTitle>
            <CardDescription>章节记录会保留，视频作品将在后续渲染流程中从记录生成。</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            <Metric label="开口轮数" value={episode.record.turnCount} />
            <Metric label="使用表达" value={episode.record.usedChunkCount} />
            <Metric label="获得 XP" value={episode.record.xpEarned} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ModeCard({
  icon: Icon,
  title,
  description,
  meta,
  to,
  disabled,
}: {
  icon: typeof Play
  title: string
  description: string
  meta: string
  to: string
  disabled: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start gap-4 p-4 pb-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardFooter className="justify-between gap-3 px-4 pb-4">
        <span className="text-xs text-muted-foreground">{meta}</span>
        {disabled ? (
          <Button size="sm" variant="secondary" className="rounded-full" disabled>
            <LockKeyhole data-icon="inline-start" />
            尚未发布
          </Button>
        ) : (
          <Button asChild size="sm" className="rounded-full">
            <Link to={to}>
              <Headphones data-icon="inline-start" />
              开始
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/45 p-3 text-center">
      <p className="text-base font-semibold">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
