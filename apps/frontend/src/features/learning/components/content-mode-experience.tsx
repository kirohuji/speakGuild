import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CheckCircle2, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { type UnitDetail } from '../api/learning-api'

const PROGRESS_KEY = (unitId: string) => `manyu:novel-progress:${unitId}`

export function ContentModeExperience({ unit }: { unit: UnitDetail }) {
  const navigate = useNavigate()

  if (unit.contentMode === 'novel') {
    return <NovelEntryCard unit={unit} />
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

function NovelEntryCard({ unit }: { unit: UnitDetail }) {
  const novel = unit.novelPackage

  if (!novel) {
    return (
      <section className="mb-5 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        后台还没有上传 EPUB
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
      <Button size="lg" className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" asChild>
        <Link to={`/learning/units/${unit.id}/read`}>
          {pct > 0 ? '继续阅读' : '开始阅读'}<ChevronRight className="size-4" />
        </Link>
      </Button>
    </section>
  )
}
