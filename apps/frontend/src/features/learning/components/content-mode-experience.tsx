import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, CheckCircle2, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PrepPager } from '@/features/practice/components/prep-pager'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { paginateItems } from '@/features/practice/lib/practice-session-utils'
import { type TrainingTopicItem, type UnitDetail } from '../api/learning-api'

const PROGRESS_KEY = (unitId: string) => `manyu:novel-progress:${unitId}`
const TOPIC_PAGE_SIZE = 8

export function ContentModeExperience({ unit }: { unit: UnitDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [topicPage, setTopicPage] = useState(1)
  const [teachingTopic, setTeachingTopic] = useState<TrainingTopicItem | null>(null)

  useEffect(() => {
    setTopicPage(1)
    setTeachingTopic(null)
  }, [unit.id, unit.contentMode])

  const topicPageItems = useMemo(
    () => paginateItems(unit.trainingTopics, topicPage, TOPIC_PAGE_SIZE),
    [topicPage, unit.trainingTopics],
  )

  if (unit.contentMode === 'novel') {
    return <NovelEntryCard unit={unit} />
  }

  const title = unit.contentMode === 'writing' ? t('learning.contentModeWritingTask') : unit.contentMode === 'reading' ? t('learning.contentModeReadingTask') : t('learning.contentModeListeningTask')

  return (
    <>
      <section className="mb-5">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">3</span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t('learning.topicCountHint', { count: unit.trainingTopics.length })}</p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 rounded-full text-[11px]">{t('learning.topicCount', { count: unit.trainingTopics.length })}</Badge>
        </div>
        <div className="space-y-2">
          {topicPageItems.items.map((topic, index) => {
            const absoluteIndex = topicPageItems.startIndex + index
            return (
              <div key={topic.id} className="relative">
                <button
                  type="button"
                  onClick={() => navigate(`/learning/${unit.contentMode}/${topic.id}?unitId=${unit.id}`)}
                  className="w-full text-left"
                >
                  <Card className="border-0 bg-primary/[0.045] shadow-none transition-transform active:scale-[0.99]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold shadow-sm">{absoluteIndex + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{topic.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{topic.promptZh || topic.promptEn}</span></span>
                      {topic.latestSubmission?.status === 'reviewed' && <CheckCircle2 className="size-4 text-emerald-600" />}
                      {topic.teachingMarkdown?.trim() && <span className="size-8 shrink-0" aria-hidden="true" />}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </button>
                {topic.teachingMarkdown?.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-9 top-1/2 size-8 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => setTeachingTopic(topic)}
                    aria-label={`阅读${topic.title}教学文档`}
                  >
                    <BookOpen />
                  </Button>
                )}
              </div>
            )
          })}
          {unit.trainingTopics.length === 0 && <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t('learning.noContentTopics')}</div>}
        </div>
        {unit.trainingTopics.length > 0 && (
          <div className="mt-2">
            <PrepPager
              currentPage={topicPageItems.currentPage}
              totalPages={topicPageItems.totalPages}
              totalItems={unit.trainingTopics.length}
              onPageChange={setTopicPage}
            />
          </div>
        )}
      </section>
      <PracticeVnDrawer
        open={Boolean(teachingTopic)}
        onOpenChange={(open) => { if (!open) setTeachingTopic(null) }}
        hideToggles
        teachingMarkdown={teachingTopic?.teachingMarkdown?.trim() || ''}
      />
    </>
  )
}

function NovelEntryCard({ unit }: { unit: UnitDetail }) {
  const { t } = useTranslation()
  const novel = unit.novelPackage

  if (!novel) {
    return (
      <section className="mb-5 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {t('learning.noEpub')}
      </section>
    )
  }

  // 从 localStorage 读取阅读进度
  let pct = 0
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY(unit.id)) || '{}')
    if (saved.percentage != null) pct = Math.round(saved.percentage * 100)
  } catch { /* ignore */ }

  const tocCount = (novel.toc as any[])?.length ?? 0

  return (
    <section className="mb-5 rounded-lg bg-accent/[0.06] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-accent" />
          <p className="text-sm font-semibold text-foreground">{t('learning.reading')}</p>
        </div>
        <span className="text-right text-xs leading-5 text-muted-foreground">
          {tocCount > 0 && t('learning.chapterCount', { count: tocCount })}
          {tocCount > 0 && pct > 0 && ' · '}
          {pct > 0 && t('learning.readProgress', { pct })}
        </span>
      </div>
      <p className="text-lg font-semibold leading-7 text-foreground">{novel.metadata?.title ?? unit.title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('learning.immersiveReadingDesc')}</p>
      <Button size="lg" className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" asChild>
        <Link to={`/learning/units/${unit.id}/read`}>
          {pct > 0 ? t('learning.continueReading') : t('learning.startReading')}<ChevronRight className="size-4" />
        </Link>
      </Button>
    </section>
  )
}
