import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Clapperboard,
  Download,
  Loader2,
  LockKeyhole,
  Play,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { ExpressionPrepSection } from '@/features/learning/components/expression-prep-section'
import { isNqtrLearningUnit, type StoryEpisodeItem } from '@/features/learning/api/learning-api'
import { readNqtrSaveHybrid } from '@/features/nqtr/api/nqtr-local-save'
import { resolveNqtrChapterUnlock, type NqtrChapterProgressItem } from '@/features/nqtr/lib/nqtr-chapter-progress'
import { resolveStoryEpisodeUnlock } from '@/features/scripts/lib/story-chapter-progress'
import { useLearningStore } from '@/stores/learning.store'
import { displayLearningUnitLocation } from '@/features/learning/lib/learning-unit-display'

export function ScriptPackagePage() {
  const { t } = useTranslation()
  const { packageId } = useParams()
  const navigate = useNavigate()
  const storedDetail = useLearningStore((state) => state.unitDetail)
  const loading = useLearningStore((state) => state.unitDetailLoading)
  const fetchUnitDetail = useLearningStore((state) => state.fetchUnitDetail)
  const myUnits = useLearningStore((state) => state.myUnits)
  const downloadedPacks = useLearningStore((state) => state.downloadedPacks)
  const availablePackUpdates = useLearningStore((state) => state.availablePackUpdates)
  const downloadTasks = useLearningStore((state) => state.downloadTasks)
  const downloadUnitPack = useLearningStore((state) => state.downloadUnitPack)
  const fetchDownloadedPacks = useLearningStore((state) => state.fetchDownloadedPacks)

  useEffect(() => {
    if (!packageId) return
    void fetchUnitDetail(packageId)
  }, [fetchUnitDetail, packageId])

  const detail = storedDetail?.id === packageId
    && (storedDetail.packageType === 'story' || storedDetail.packageType === 'nqtr' || storedDetail.contentMode === 'nqtr')
    ? storedDetail
    : null
  const projected = Boolean((detail as { __offlineProjection?: boolean } | null)?.__offlineProjection)
  const patternCount = projected
    ? ((detail as { patternCount?: number } | null)?.patternCount ?? 0)
    : (detail?.sentencePatterns?.length ?? 0)
  const expressionTotal = (detail?.vocabCount ?? 0) + (detail?.chunkCount ?? 0) + patternCount
  const isNqtr = detail ? isNqtrLearningUnit(detail) : false

  useEffect(() => {
    void fetchDownloadedPacks().catch(() => undefined)
  }, [fetchDownloadedPacks])

  const ownedUnit = myUnits.find((unit) => unit.id === packageId) ?? null
  const installed = downloadedPacks.some((pack) => pack.packId === packageId && pack.status === 'installed')
  const updateAvailable = availablePackUpdates.some((update) => update.packId === packageId)
  const downloading = downloadTasks.some((task) => task.packId === packageId && task.status !== 'error' && task.status !== 'done')
  const episodes = useMemo(
    () => resolveStoryEpisodeUnlock(detail?.storyEpisodes ?? []),
    [detail?.storyEpisodes],
  )
  const [nqtrChapters, setNqtrChapters] = useState<Array<NqtrChapterProgressItem & { passed: boolean; isUnlocked: boolean }>>([])
  const [resumeChapterId, setResumeChapterId] = useState<string | null>(null)
  const [teachingOpen, setTeachingOpen] = useState(false)
  const [teachingMarkdown, setTeachingMarkdown] = useState('')

  const openTeaching = (markdown?: string | null) => {
    const next = markdown?.trim() || ''
    if (!next) return
    setTeachingMarkdown(next)
    setTeachingOpen(true)
  }

  useEffect(() => {
    if (!isNqtr || !packageId || !detail) {
      setNqtrChapters([])
      setResumeChapterId(null)
      return
    }
    let cancelled = false
    const base = (detail.nqtrChapters ?? []).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary ?? null,
      teachingMarkdown: chapter.teachingMarkdown ?? null,
      hasTeachingDocument: Boolean(chapter.hasTeachingDocument || chapter.teachingMarkdown?.trim()),
      sortOrder: chapter.sortOrder ?? 0,
    }))
    void readNqtrSaveHybrid(packageId)
      .then((save) => {
        if (cancelled) return
        const unlocked = resolveNqtrChapterUnlock(base, save)
        setNqtrChapters(unlocked)
        const resume = save?.chapterId
          ? unlocked.find((chapter) => chapter.id === save.chapterId && chapter.isUnlocked)
          : null
        setResumeChapterId(resume?.id ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setNqtrChapters(resolveNqtrChapterUnlock(base, null))
          setResumeChapterId(null)
        }
      })
    return () => { cancelled = true }
  }, [detail, isNqtr, packageId])

  const chapters = isNqtr ? nqtrChapters : episodes
  const completed = isNqtr
    ? nqtrChapters.filter((chapter) => chapter.passed).length
    : episodes.filter((episode) => episode.record?.passed).length
  const progress = chapters.length > 0 ? (completed / chapters.length) * 100 : 0
  const nextEpisode = !isNqtr
    ? (episodes.find((episode) => episode.isUnlocked && !episode.record?.passed) ?? null)
    : null
  const nextChapter = isNqtr
    ? (
      (resumeChapterId ? nqtrChapters.find((chapter) => chapter.id === resumeChapterId) : null)
      ?? nqtrChapters.find((chapter) => chapter.isUnlocked && !chapter.passed)
      ?? nqtrChapters.find((chapter) => chapter.isUnlocked)
      ?? null
    )
    : null
  const continueNqtr = Boolean(resumeChapterId)

  // 与学习计划详情一致：命中同一包的离线缓存时不再闪出加载骨架。
  if (loading && !detail) return <PackageSkeleton />

  if (!detail) {
    // 已拥有但未安装：与学习计划一致，引导下载，而不是当成「不存在」。
    if (ownedUnit && !installed) {
      return (
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
          <Clapperboard className="size-12 text-muted-foreground/40" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">{ownedUnit.title}</p>
            <p className="text-sm text-muted-foreground">{t('scripts.packNeedsDownload')}</p>
          </div>
          <Button
            className="rounded-full"
            disabled={downloading}
            onClick={() => packageId && void downloadUnitPack(packageId)}
          >
            {downloading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
            {downloading ? t('scripts.preparingOffline') : t('scripts.downloadScript')}
          </Button>
          <Button variant="secondary" className="rounded-full border-0 shadow-none" onClick={() => navigate('/scripts')}>
            {t('scripts.backToScripts')}
          </Button>
        </div>
      )
    }
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <Clapperboard className="size-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">{t('scripts.packageNotFound')}</p>
        <Button variant="secondary" className="rounded-full border-0 shadow-none" onClick={() => navigate('/scripts')}>
          {t('scripts.backToScripts')}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3 md:pt-4">
      <div className="mb-4">
        <div className="flex min-h-10 items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => navigate('/scripts')}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label={t('scripts.backToScripts')}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
            <p className="truncate text-xs text-muted-foreground">{displayLearningUnitLocation(detail.location, isNqtr ? t('scripts.immersiveTheater') : t('scripts.spokenScript'))}</p>
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{detail.title}</h1>
          </div>
        </div>
        <div className="hidden md:block">
          <Link to="/scripts" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {t('scripts.script')}
          </Link>
          <div className="flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
              <Badge variant="secondary" className="mb-2 rounded-full">{detail.requiredOutputLevel}</Badge>
              <h1 className="text-xl font-bold leading-tight text-foreground">{detail.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{displayLearningUnitLocation(detail.location, isNqtr ? t('scripts.immersiveTheater') : t('scripts.spokenScript'))}</p>
            </div>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clapperboard className="size-5" />
            </div>
          </div>
        </div>
      </div>

      <section className="mb-5">
        <SectionHeader eyebrow="1" title={t('scripts.storySummary')} meta={`${chapters.length} ${t('scripts.chapterUnit')}`} />
        <div className="rounded-lg bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-6 text-muted-foreground">
              {detail.description || t('scripts.defaultDescription')}
            </p>
            <Badge variant="secondary" className="shrink-0">
              {isNqtr ? t('scripts.immersiveTheater') : t('scripts.spokenScript')}
            </Badge>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-xs tabular-nums text-muted-foreground">{completed}/{chapters.length}</span>
          </div>
          <div className="mt-4">
            {!installed || updateAvailable ? (
              <Button
                className="w-full"
                disabled={downloading}
                onClick={() => packageId && void downloadUnitPack(packageId)}
              >
                {downloading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                {downloading ? t('scripts.preparingOffline') : updateAvailable ? t('learning.packUpdateAvailable') : t('scripts.downloadScript')}
              </Button>
            ) : isNqtr && nextChapter ? (
              <Button asChild className="w-full">
                <Link to={`/scripts/nqtr/${detail.id}?chapterId=${nextChapter.id}`}>
                  <Play data-icon="inline-start" />
                  {continueNqtr || completed > 0 ? t('scripts.continueNextChapter') : t('scripts.startStory')}
                </Link>
              </Button>
            ) : nextEpisode ? (
              <Button asChild className="w-full">
                <Link to={`/scripts/packages/${detail.id}/episodes/${nextEpisode.id}`}>
                  <Play data-icon="inline-start" />
                  {nextEpisode.record?.passed === false || completed > 0 ? t('scripts.continueNextChapter') : t('scripts.startStory')}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mb-5">
        <SectionHeader
          eyebrow="2"
          title={t('scripts.inStoryExpressions')}
          meta={`${expressionTotal} ${t('scripts.itemsUnit')}`}
        />
        <ExpressionPrepSection
          vocabularies={projected ? undefined : detail.vocabularies}
          chunks={projected ? undefined : detail.chunks}
          patterns={projected ? undefined : detail.sentencePatterns}
          contentSource={projected ? {
            unitId: detail.id,
            totals: {
              vocab: detail.vocabCount,
              chunk: detail.chunkCount,
              pattern: patternCount,
            },
          } : undefined}
          sceneName={detail.title}
          defaultCollapsed
          collapsible
        />
      </section>

      <section className="mb-5">
        <SectionHeader eyebrow="3" title={t('scripts.chapterPractice')} meta={`${completed}/${chapters.length}`} />
        <div className="flex flex-col gap-2">
          {chapters.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg bg-muted/30 px-6 py-12 text-center">
              <BookOpen className="size-10 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">{t('scripts.chaptersArranging')}</p>
              <p className="mt-1 text-xs text-muted-foreground/60">{t('scripts.chaptersArrangingHint')}</p>
            </div>
          ) : isNqtr ? nqtrChapters.map((chapter, index) => (
            <NqtrChapterRow
              key={chapter.id}
              chapter={chapter}
              index={index}
              packageId={detail.id}
              installed={installed}
              onOpenTeaching={() => openTeaching(chapter.teachingMarkdown)}
            />
          )) : episodes.map((episode, index) => (
            <EpisodeRow
              key={episode.id}
              episode={episode}
              index={index}
              packageId={detail.id}
              installed={installed}
              onOpenTeaching={() => openTeaching(episode.teachingMarkdown)}
            />
          ))}
        </div>
      </section>

      <PracticeVnDrawer
        open={teachingOpen}
        onOpenChange={setTeachingOpen}
        hideToggles
        unitId={detail.id}
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

function NqtrChapterRow({
  chapter,
  index,
  packageId,
  installed,
  onOpenTeaching,
}: {
  chapter: NqtrChapterProgressItem & { passed: boolean; isUnlocked: boolean }
  index: number
  packageId: string
  installed: boolean
  onOpenTeaching: () => void
}) {
  const { t } = useTranslation()
  const locked = !chapter.isUnlocked || !installed
  const hasTeaching = Boolean(chapter.hasTeachingDocument || chapter.teachingMarkdown?.trim())
  const row = (
    <Card className="border-0 bg-muted/30 shadow-none ring-0 transition-colors hover:bg-muted/50 dark:ring-0">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          {chapter.passed ? <Check className="size-4 text-primary" /> : index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{chapter.title}</p>
          {chapter.summary ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{chapter.summary}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{t('scripts.vnInteractive')}</p>
        </div>
        {hasTeaching && (
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenTeaching() }}
            className="flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground active:scale-[0.92]"
            aria-label={t('practiceVn.teaching')}
          >
            <BookOpen className="size-4" />
          </button>
        )}
        {locked ? <LockKeyhole className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      </CardContent>
    </Card>
  )
  if (locked) return row
  return <Link to={`/scripts/nqtr/${packageId}?chapterId=${chapter.id}`}>{row}</Link>
}

function EpisodeRow({
  episode,
  index,
  packageId,
  installed,
  onOpenTeaching,
}: {
  episode: StoryEpisodeItem
  index: number
  packageId: string
  installed: boolean
  onOpenTeaching: () => void
}) {
  const { t } = useTranslation()
  const locked = !episode.isUnlocked || !installed
  const hasTeaching = Boolean(episode.hasTeachingDocument || episode.teachingMarkdown?.trim())
  const row = (
    <Card className="border-0 bg-muted/30 shadow-none ring-0 transition-colors hover:bg-muted/50 dark:ring-0">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          {episode.record?.passed ? <Check className="size-4 text-primary" /> : index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs text-muted-foreground">{episode.chapterName}</p>
            {episode.isPreview && <Badge variant="secondary">{t('scripts.preview')}</Badge>}
          </div>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{episode.title}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{episode.characterName}</span>
            <span>{t('scripts.storyObjectives', { count: episode.objectives.length })}</span>
          </div>
        </div>
        {hasTeaching && (
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenTeaching() }}
            className="flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground active:scale-[0.92]"
            aria-label={t('practiceVn.teaching')}
          >
            <BookOpen className="size-4" />
          </button>
        )}
        {locked ? <LockKeyhole className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      </CardContent>
    </Card>
  )

  if (locked) return row
  return <Link to={`/scripts/packages/${packageId}/episodes/${episode.id}`}>{row}</Link>
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
