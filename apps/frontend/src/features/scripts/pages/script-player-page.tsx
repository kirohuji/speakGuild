import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { VnPlayer, type VnPlayerLine } from '@/features/vn-engine/vn-player'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { learningApi, type StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'
import { useLayoutStore } from '@/stores/layout.store'

export function ScriptPlayerPage() {
  const { episodeId } = useParams()
  const [searchParams] = useSearchParams()
  const packageId = searchParams.get('packageId') ?? ''
  const mode = searchParams.get('mode') === 'repeat' ? 'repeat' : 'vn'
  const setImmersiveMode = useLayoutStore((state) => state.setImmersiveMode)
  const [data, setData] = useState<StoryEpisodePlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const completionSaved = useRef(false)

  useEffect(() => {
    setImmersiveMode(true)
    return () => setImmersiveMode(false)
  }, [setImmersiveMode])

  useEffect(() => {
    if (!episodeId) return
    setLoading(true)
    setFailed(false)
    learningApi.getStoryEpisodePlayer(episodeId)
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [episodeId])

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    )
  }

  if (failed || !data) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg font-semibold">章节脚本暂时无法播放</p>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          请确认剧本包已经下载，并且后台已经编译发布本章 Ink 脚本。
        </p>
        <Button asChild variant="outline" className="rounded-full">
          <Link to={`/scripts/packages/${packageId}/episodes/${episodeId}`}>
            <ArrowLeft data-icon="inline-start" />
            返回章节
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <InkEpisodePlayer
      key={`${episodeId}-${mode}`}
      data={data}
      episodeId={episodeId!}
      packageId={packageId || data.episode.sceneId}
      mode={mode}
      completionSaved={completionSaved}
    />
  )
}

function InkEpisodePlayer({
  data,
  episodeId,
  packageId,
  mode,
  completionSaved,
}: {
  data: StoryEpisodePlayerData
  episodeId: string
  packageId: string
  mode: 'vn' | 'repeat'
  completionSaved: React.MutableRefObject<boolean>
}) {
  const [userTurns, setUserTurns] = useState<VnPlayerLine[]>([])
  const [recordId, setRecordId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const startedAt = useRef(Date.now())
  const story = useInkStory(data.inkScript.inkJson)
  const inkLines = useMemo<VnPlayerLine[]>(
    () => story.lines.map((line) => ({ speaker: line.speaker, text: line.text })),
    [story.lines],
  )
  const combined = useMemo(() => [...inkLines, ...userTurns], [inkLines, userTurns])
  const currentLine = combined.at(-1) ?? null
  const history = combined.slice(0, -1)

  useEffect(() => {
    if (!story.isEnded || completionSaved.current) return
    completionSaved.current = true
    void scriptCommunityApi.completeRecord(episodeId, {
      mode,
      durationSec: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
      turnCount: mode === 'vn' ? userTurns.length : 0,
      lineCount: mode === 'repeat' ? inkLines.length : 0,
      completedObjectiveCount: data.episode.objectives.length,
      resultSnapshot: {
        inkScriptId: data.inkScript.id,
        inkScriptVersion: data.inkScript.version,
        mode,
      },
    }).then((record) => {
      setRecordId(record.id)
    }).catch(() => {
      completionSaved.current = false
      toast.error('章节记录同步失败，稍后会再次尝试')
    })
  }, [completionSaved, data.episode.objectives.length, data.inkScript.id, data.inkScript.version, episodeId, inkLines.length, mode, story.isEnded, userTurns.length])

  const publishProgress = async () => {
    if (!recordId || publishing) return
    setPublishing(true)
    try {
      const work = await scriptCommunityApi.createWork({
        recordId,
        kind: 'progress_card',
        title: `完成《${data.episode.title}》`,
        caption: `${mode === 'vn' ? 'VN 互动' : '跟读剧场'} · ${userTurns.length || inkLines.length} 次开口`,
      })
      await scriptCommunityApi.publishWork(work.id)
      toast.success('章节进度已发布到广场')
    } catch (error: any) {
      toast.error(error?.message || '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  const submitInput = async (text: string) => {
    const value = text.trim()
    if (!value) return
    setUserTurns((current) => [...current, { speaker: '我', text: value, isUser: true }])
    story.resumeAfterInput(value)
    story.advanceStory()
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-20">
        <Button asChild size="icon" variant="secondary" className="pointer-events-auto rounded-full bg-background/65 backdrop-blur-xl">
          <Link to={`/scripts/packages/${packageId}/episodes/${episodeId}`}>
            <ArrowLeft />
            <span className="sr-only">退出章节</span>
          </Link>
        </Button>
      </div>
      <div className="pointer-events-none absolute right-3 top-[calc(0.85rem+env(safe-area-inset-top,0px))] z-20 rounded-full bg-background/65 px-3 py-1.5 text-xs font-medium backdrop-blur-xl">
        {mode === 'repeat' ? '跟读剧场' : 'VN 互动'}
      </div>
      <VnPlayer
        currentLine={currentLine}
        history={history}
        choices={story.choices}
        isWaiting={story.isWaiting}
        isEnded={story.isEnded}
        onAdvance={story.advanceStory}
        onChoice={story.handleChoice}
        onSubmitInput={submitInput}
        onReset={() => window.location.reload()}
        className="h-full"
        stageClassName="h-full"
        endedActions={(
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-primary" />
              本章演出完成
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => window.location.reload()}>
                <RotateCcw data-icon="inline-start" />
                再演一次
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link to={`/scripts/packages/${packageId}`}>返回章节目录</Link>
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              disabled={!recordId || publishing}
              onClick={() => void publishProgress()}
            >
              {publishing ? '发布中…' : recordId ? '分享本章进度' : '正在保存记录…'}
            </Button>
          </div>
        )}
      />
    </div>
  )
}
