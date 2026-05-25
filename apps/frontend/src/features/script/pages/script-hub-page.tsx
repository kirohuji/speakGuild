import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Lock, CheckCircle2, ChevronRight, Star, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { scriptApi, type ScriptChapter, type ScriptEpisodeCard, type EpisodeReadiness } from '../api/script-api'
import { cn } from '@/lib/cn'

export function ScriptHubPage() {
  const [chapters, setChapters] = useState<ScriptChapter[]>([])
  const [loading, setLoading] = useState(true)
  const [readinessMap, setReadinessMap] = useState<Record<string, EpisodeReadiness>>({})
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null)

  useEffect(() => {
    scriptApi.getChapters()
      .then(setChapters)
      .catch(() => setChapters([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (chapters.length > 0 && !expandedChapter) {
      const first = chapters.find((ch) => ch.episodes.some((e) => !e.passed))
      setExpandedChapter(first?.chapterId ?? chapters[0]?.chapterId ?? null)
    }
  }, [chapters])

  const loadReadiness = async (episodeId: string) => {
    if (readinessMap[episodeId]) return
    try { const r = await scriptApi.getReadiness(episodeId); setReadinessMap((p) => ({ ...p, [episodeId]: r })) } catch {}
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">剧本模式</h1>
        <p className="mt-1 text-muted-foreground">在剧情任务中使用英语，推动故事发展</p>
      </div>

      {chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">剧本内容即将上线</p>
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter) => {
            const allPassed = chapter.episodes.every((e) => e.passed)
            const progressCount = chapter.episodes.filter((e) => e.passed).length
            const isExpanded = expandedChapter === chapter.chapterId

            return (
              <Card key={chapter.chapterId} className={cn('overflow-hidden', allPassed && 'opacity-80')}>
                <button className="w-full text-left" onClick={() => setExpandedChapter(isExpanded ? null : chapter.chapterId)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {allPassed ? <CheckCircle2 className="size-5 text-green-500" /> : <Play className="size-5 text-primary" />}
                        <CardTitle className="text-lg">{chapter.chapterTitle}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{progressCount}/{chapter.episodes.length}</span>
                        <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                      </div>
                    </div>
                    <Progress value={(progressCount / Math.max(chapter.episodes.length, 1)) * 100} className="mt-2 h-1" />
                  </CardHeader>
                </button>

                {isExpanded && (
                  <CardContent className="space-y-2 pt-0">
                    {chapter.episodes.map((ep) => (
                      <EpisodeCard key={ep.id} episode={ep} readiness={readinessMap[ep.id]} onHover={() => loadReadiness(ep.id)} />
                    ))}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EpisodeCard({ episode, readiness, onHover }: { episode: ScriptEpisodeCard; readiness?: EpisodeReadiness; onHover: () => void }) {
  const isLocked = !episode.isPreview && !episode.passed
  return (
    <Link to={`/script/${episode.id}`} onMouseEnter={onHover}
      className={cn('flex items-center gap-3 rounded-lg border p-3 transition-colors',
        episode.passed ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10' : isLocked ? 'border-border bg-muted/30' : 'border-border hover:bg-muted/50')}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        {episode.passed ? <CheckCircle2 className="size-5 text-green-500" /> : isLocked ? <Lock className="size-4 text-muted-foreground" /> : <Star className="size-4 text-amber-500" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{episode.episodeOrder}. {episode.title}</p>
          <Badge variant="secondary" className="shrink-0 text-xs">{episode.requiredOutputLevel}</Badge>
          {episode.isPreview && <Badge className="shrink-0 text-xs">免费</Badge>}
        </div>
        {isLocked && readiness && (
          <div className="mt-1 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground"><span>准备度</span><span>{readiness.readiness}%</span></div>
            <Progress value={readiness.readiness} className="h-1" />
            {readiness.readiness < 70 && <p className="text-xs text-amber-500">还差 {readiness.chunkRequired - readiness.chunkMastered} 个 Chunk</p>}
          </div>
        )}
        {episode.passed && <p className="text-xs text-green-600 dark:text-green-400">已通关</p>}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
