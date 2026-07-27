import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clapperboard,
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
  const { t } = useTranslation()
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
        <p className="text-muted-foreground">{t('scripts.episodeNotFound')}</p>
        <Button variant="outline" onClick={() => navigate(`/scripts/packages/${packageId}`)}>
          {t('scripts.backToScripts')}
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
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3 md:pt-4">
      <div className="mb-4">
        <div className="flex min-h-10 items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => navigate(`/scripts/packages/${detail.id}`)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label={t('scripts.backToPackage', { title: detail.title })}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
            <p className="truncate text-xs text-muted-foreground">{detail.title} · {episode.chapterName}</p>
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{episode.title}</h1>
          </div>
        </div>
        <div className="hidden md:block">
          <Link to={`/scripts/packages/${detail.id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {detail.title}
          </Link>
          <div className="flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full">{episode.requiredOutputLevel}</Badge>
                {episode.record?.passed && <Badge className="rounded-full"><CheckCircle2 className="mr-1 size-3" />{t('scripts.completed')}</Badge>}
              </div>
              <h1 className="text-xl font-bold leading-tight text-foreground">{episode.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{episode.chapterName}</p>
            </div>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clapperboard className="size-5" />
            </div>
          </div>
        </div>
      </div>

      <section className="mb-5">
        <SectionHeader eyebrow="1" title={t('scripts.chapterSummary')} />
        <div className="rounded-lg bg-muted/30 p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {episode.description || t('scripts.defaultEpisodeDesc')}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-background/55 p-3">
              <div className="flex items-center gap-2 text-muted-foreground"><UserRound className="size-4" /><span className="text-xs">{t('scripts.chapterRole')}</span></div>
              <p className="mt-2 text-sm font-semibold">{episode.characterName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{episode.characterRole}</p>
            </div>
            <div className="rounded-lg bg-background/55 p-3">
              <div className="flex items-center gap-2 text-muted-foreground"><Sparkles className="size-4" /><span className="text-xs">{t('scripts.chapterContent')}</span></div>
              <p className="mt-2 text-sm font-semibold">{t('scripts.coreExpressionsCount', { count: keyExpressions.length })}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('scripts.vnAndRepeatHint')}</p>
            </div>
          </div>
        </div>
      </section>

      {episode.objectives.length > 0 && (
        <section className="mb-5">
          <SectionHeader eyebrow="2" title={t('scripts.chapterObjectives')} meta={`${episode.objectives.length} ${t('scripts.itemsUnit')}`} />
          <Card className="border-0 bg-muted/30 shadow-none">
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

      <section className="mb-5">
        <SectionHeader eyebrow="3" title={t('scripts.prePerformancePreview')} meta={`${keyExpressions.length} ${t('scripts.itemsUnit')}`} />
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardContent className="flex flex-col gap-0 p-0">
            {keyExpressions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('scripts.noExtraPreview')}
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

      <section className="mb-5">
        <SectionHeader eyebrow="4" title={t('scripts.choosePracticeMode')} />
        <div className="flex flex-col gap-2">
        <ModeCard
          icon={Play}
          title={t('scripts.vnModeTitle')}
          description={t('scripts.vnModeDesc')}
          meta={t('scripts.vnModeMeta')}
          to={`/scripts/player/${episode.id}?packageId=${detail.id}&mode=vn`}
          disabled={!episode.isUnlocked || !episode.inkScriptId}
        />
        <ModeCard
          icon={Mic2}
          title={t('scripts.repeatModeTitle')}
          description={t('scripts.repeatModeDesc')}
          meta={t('scripts.repeatModeMeta')}
          to={`/scripts/player/${episode.id}?packageId=${detail.id}&mode=repeat`}
          disabled={!episode.isUnlocked || !episode.inkScriptId}
        />
        </div>
      </section>

      {episode.record && (
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('scripts.lastPerformance')}</CardTitle>
            <CardDescription>{t('scripts.lastPerformanceHint')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            <Metric label={t('scripts.turnsSpoken')} value={episode.record.turnCount} />
            <Metric label={t('scripts.expressionsUsed')} value={episode.record.usedChunkCount} />
            <Metric label={t('scripts.xpEarned')} value={episode.record.xpEarned} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string
  title: string
  meta?: string
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
          {eyebrow}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
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
  const { t } = useTranslation()

  return (
    <Card className="overflow-hidden border-0 bg-muted/30 shadow-none">
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
            {t('scripts.notPublishedYet')}
          </Button>
        ) : (
          <Button asChild size="sm" className="rounded-full">
            <Link to={to}>
              <Headphones data-icon="inline-start" />
              {t('scripts.start')}
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
