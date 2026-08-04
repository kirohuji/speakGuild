import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { learningApi, type SceneExperience, type UnitDetail } from '../api/learning-api'

export function ContentModeExperience({ unit }: { unit: UnitDetail }) {
  const navigate = useNavigate()
  const [experience, setExperience] = useState<SceneExperience | null>(null)

  useEffect(() => {
    if (unit.contentMode === 'practice') return
    learningApi.getSceneExperience(unit.id).then(setExperience).catch(() => setExperience(null))
  }, [unit.contentMode, unit.id])

  if (unit.contentMode === 'novel') {
    return <NovelEntryCard unit={unit} experience={experience} />
  }

  const title = unit.contentMode === 'writing' ? '写作任务' : unit.contentMode === 'reading' ? '阅读与理解' : '精听训练'

  return (
    <section className="mb-5">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">3</span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">共 {unit.trainingTopics.length} 个话题，进度独立于今日任务</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 rounded-full text-[11px]">{unit.trainingTopics.length} 个话题</Badge>
      </div>
      <div className="space-y-2">
        {unit.trainingTopics.map((topic, index) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => navigate(`/learning/${unit.contentMode}/${topic.id}?unitId=${unit.id}`)}
            className="w-full text-left"
          >
            <Card className="border-0 bg-primary/[0.045] shadow-none transition-transform active:scale-[0.99]">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold shadow-sm">{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{topic.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{topic.promptZh || topic.promptEn}</span></span>
                {topic.latestSubmission?.status === 'reviewed' && <CheckCircle2 className="size-4 text-emerald-600" />}
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </button>
        ))}
        {unit.trainingTopics.length === 0 && <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">后台还没有添加内容话题</div>}
      </div>
    </section>
  )
}

function NovelEntryCard({ unit, experience }: { unit: UnitDetail; experience: SceneExperience | null }) {
  if (!experience) {
    return (
      <section className="mb-5 flex h-32 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </section>
    )
  }
  if (!experience.novelPackage) {
    return (
      <section className="mb-5 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        后台还没有上传 EPUB
      </section>
    )
  }

  const novel = experience.novelPackage
  const pct = novel.progress?.percentage != null ? Math.round(novel.progress.percentage * 100) : 0
  const tocCount = novel.toc?.length ?? 0

  return (
    <section className="mb-5 rounded-lg bg-accent/[0.06] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-accent" />
          <p className="text-sm font-semibold text-foreground">阅读</p>
        </div>
        <span className="text-right text-xs leading-5 text-muted-foreground">
          {tocCount > 0 && `${tocCount} 章`}
          {tocCount > 0 && pct > 0 && ' · '}
          {pct > 0 && `已读 ${pct}%`}
        </span>
      </div>
      <p className="text-lg font-semibold leading-7 text-foreground">{novel.metadata?.title ?? unit.title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">沉浸式英文阅读体验</p>
      {experience.groupItem && (
        <p className="mt-1 text-xs text-muted-foreground/70">
          {experience.groupItem.group.name} · 第 {experience.groupItem.sortOrder + 1}/{experience.groupItem.group.items.length} 册
        </p>
      )}
      <Button size="lg" className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" asChild>
        <Link to={`/learning/units/${unit.id}/read`}>
          {pct > 0 ? '继续阅读' : '开始阅读'}<ChevronRight className="size-4" />
        </Link>
      </Button>
    </section>
  )
}
