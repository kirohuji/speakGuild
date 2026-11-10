import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clapperboard,
  Film,
  Loader2,
  Mic2,
  Play,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { ExpressionPrepSection } from '@/features/learning/components/expression-prep-section'
import { prepareStoryVnEntry } from '@/features/vn-engine/prepare-story-vn-entry'
import { resolveStoryEpisodeUnlock } from '@/features/scripts/lib/story-chapter-progress'
import { readTopicTeaching } from '@/lib/offline/learning-pack-read-model'
import { useLearningStore } from '@/stores/learning.store'

export function ScriptEpisodePage() {
  const { t } = useTranslation()
  const { packageId, episodeId } = useParams()
  const navigate = useNavigate()
  const storedDetail = useLearningStore((state) => state.unitDetail)
  const loading = useLearningStore((state) => state.unitDetailLoading)
  const fetchUnitDetail = useLearningStore((state) => state.fetchUnitDetail)
  const [preparingMode, setPreparingMode] = useState<'vn' | 'repeat' | null>(null)
  const [teachingOpen, setTeachingOpen] = useState(false)
  const [teachingMarkdown, setTeachingMarkdown] = useState('')

  useEffect(() => {
    if (!packageId) return
    void fetchUnitDetail(packageId)
  }, [fetchUnitDetail, packageId])

  const detail = storedDetail?.id === packageId ? storedDetail : null
  const projected = Boolean((detail as { __offlineProjection?: boolean } | null)?.__offlineProjection)

  const episode = useMemo(() => {
    const episodes = resolveStoryEpisodeUnlock(detail?.storyEpisodes ?? [])
    return episodes.find((item) => item.id === episodeId) ?? null
  }, [detail, episodeId])

  const teachingTopic = useMemo(() => {
    if (!detail || !episode) return null
    const topics = detail.trainingTopics ?? []
    const byInk = episode.inkScriptId
      ? topics.find((topic) => topic.inkScriptId === episode.inkScriptId)
      : null
    if (byInk) return byInk
    return topics.find((topic) => topic.hasTeachingDocument || Boolean(topic.teachingMarkdown?.trim())) ?? null
  }, [detail, episode])

  const hasTeachingDocument = Boolean(
    episode?.hasTeachingDocument
    || episode?.teachingMarkdown?.trim()
    || teachingTopic?.hasTeachingDocument
    || teachingTopic?.teachingMarkdown?.trim(),
  )

  useEffect(() => {
    if (!episode) {
      setTeachingMarkdown('')
      return
    }
    const episodeTeaching = episode.teachingMarkdown?.trim() || ''
    if (episodeTeaching) {
      setTeachingMarkdown(episodeTeaching)
      return
    }
    if (!teachingTopic) {
      setTeachingMarkdown('')
      return
    }
    let cancelled = false
    readTopicTeaching(teachingTopic.id)
      .then((document) => {
        if (!cancelled) {
          setTeachingMarkdown(
            document?.teachingMarkdown?.trim()
            || teachingTopic.teachingMarkdown?.trim()
            || '',
          )
        }
      })
      .catch(() => {
        if (!cancelled) setTeachingMarkdown(teachingTopic.teachingMarkdown?.trim() || '')
      })
    return () => { cancelled = true }
  }, [episode, teachingTopic])

  const startMode = async (mode: 'vn' | 'repeat') => {
    if (!detail || !episode || preparingMode) return
    setPreparingMode(mode)
    try {
      await prepareStoryVnEntry({ packageId: detail.id, episodeId: episode.id })
      navigate(`/scripts/player/${episode.id}?packageId=${detail.id}&mode=${mode}`)
    } catch (error) {
      console.warn('[script-episode] prepare stage failed', error)
      toast.error(t('scripts.prepareStageFailed'))
      navigate(`/scripts/player/${episode.id}?packageId=${detail.id}&mode=${mode}`)
    } finally {
      setPreparingMode(null)
    }
  }

  if (loading && !detail) {
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
        <Button variant="secondary" className="rounded-full border-0 shadow-none" onClick={() => navigate(`/scripts/packages/${packageId}`)}>
          {t('scripts.backToScripts')}
        </Button>
      </div>
    )
  }

  const vocabCount = projected
    ? (episode.vocabCount ?? episode.vocabularies.length)
    : episode.vocabularies.length
  const chunkCount = projected
    ? (episode.chunkCount ?? episode.chunks.length)
    : episode.chunks.length
  const patternCount = projected
    ? (episode.patternCount ?? episode.sentencePatterns.length)
    : episode.sentencePatterns.length
  const expressionTotal = vocabCount + chunkCount + patternCount
  const modeDisabled = !episode.isUnlocked || !episode.inkScriptId
  const hasObjectives = episode.objectives.length > 0

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
          {hasTeachingDocument && (
            <Button
              variant="outline-primary"
              className="mt-4 min-h-11 w-full shadow-none"
              size="default"
              onClick={() => setTeachingOpen(true)}
            >
              <BookOpen className="size-4" />
              {t('practiceVn.teaching')}
            </Button>
          )}
        </div>
      </section>

      {hasObjectives && (
        <section className="mb-5">
          <SectionHeader eyebrow="2" title={t('scripts.chapterObjectives')} meta={`${episode.objectives.length} ${t('scripts.itemsUnit')}`} />
          <Card className="border-0 bg-muted/30 shadow-none ring-0 dark:ring-0">
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
        <SectionHeader
          eyebrow={hasObjectives ? '3' : '2'}
          title={t('scripts.prePerformancePreview')}
          meta={`${expressionTotal} ${t('scripts.itemsUnit')}`}
        />
        <ExpressionPrepSection
          vocabularies={projected ? undefined : episode.vocabularies}
          chunks={projected ? undefined : episode.chunks}
          patterns={projected ? undefined : episode.sentencePatterns}
          contentSource={projected ? {
            topicId: episode.id,
            totals: {
              vocab: vocabCount,
              chunk: chunkCount,
              pattern: patternCount,
            },
          } : undefined}
          sceneName={detail.title}
          defaultCollapsed
          collapsible
        />
      </section>

      <section className="mb-5">
        <SectionHeader
          eyebrow={hasObjectives ? '4' : '3'}
          title={t('scripts.choosePracticeMode')}
        />
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            icon={Play}
            title={t('scripts.vnModeTitle')}
            description={t('scripts.vnModeDesc')}
            disabled={modeDisabled}
            preparing={preparingMode === 'vn'}
            busy={preparingMode !== null}
            onStart={() => void startMode('vn')}
          />
          <ModeCard
            icon={Mic2}
            title={t('scripts.repeatModeTitle')}
            description={t('scripts.repeatModeDesc')}
            disabled={modeDisabled}
            preparing={preparingMode === 'repeat'}
            busy={preparingMode !== null}
            onStart={() => void startMode('repeat')}
          />
        </div>
      </section>

      <PracticeVnDrawer
        open={teachingOpen}
        onOpenChange={setTeachingOpen}
        hideToggles
        unitId={detail.id}
        topicId={teachingTopic?.id}
        teachingMarkdown={teachingMarkdown}
      />
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
  disabled,
  preparing,
  busy,
  onStart,
}: {
  icon: typeof Play
  title: string
  description: string
  disabled: boolean
  preparing: boolean
  busy: boolean
  onStart: () => void
}) {
  const { t } = useTranslation()

  return (
    <Card className="flex h-full flex-col overflow-hidden border-0 bg-muted/30 shadow-none ring-0 dark:ring-0">
      <CardHeader className="flex flex-1 flex-col items-start gap-3 p-3 pb-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-sm leading-5">{title}</CardTitle>
          <CardDescription className="mt-1 line-clamp-3 text-[11px] leading-4">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardFooter className="mt-auto px-3 pb-3 pt-1">
        {disabled ? (
          <Button size="sm" variant="secondary" className="h-8 w-full rounded-full px-2 text-xs" disabled>
            {t('scripts.locked')}
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 w-full rounded-full text-xs"
            disabled={busy}
            onClick={onStart}
          >
            {preparing ? (
              <Loader2 className="animate-spin" aria-label={t('scripts.preparingStage')} />
            ) : (
              t('scripts.start')
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

