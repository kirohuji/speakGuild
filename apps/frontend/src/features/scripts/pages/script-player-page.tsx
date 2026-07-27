import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, History, Loader2, RotateCcw, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { VnPlayer, type VnPlayerHandle, type VnPlayerLine } from '@/features/vn-engine/vn-player'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { learningApi, type StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'
import { useLayoutStore } from '@/stores/layout.store'
import { parseComposer } from '@/features/admin/components/composer-parser'
import { flattenComposerToTimeline } from '@/features/admin/components/vn-mixed-timeline'
import { VnMixedPreviewPlayer } from '@/features/admin/components/vn-mixed-preview-player'
import { requestScriptVideoRender } from '@/features/scripts/lib/request-script-video-render'
import { useGlobalTaskStore } from '@/stores/global-task.store'

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
  const [publishProgress, setPublishProgress] = useState(0)
  const [published, setPublished] = useState(false)
  const startGlobalTask = useGlobalTaskStore((state) => state.startTask)
  const updateGlobalTask = useGlobalTaskStore((state) => state.updateTask)
  const [repeatSaving, setRepeatSaving] = useState(false)
  const [repeatFrameIndex, setRepeatFrameIndex] = useState(0)
  const [isChatMode, setIsChatMode] = useState(false)
  const vnPlayerRef = useRef<VnPlayerHandle | null>(null)
  const startedAt = useRef(Date.now())
  const story = useInkStory(data.inkScript.inkJson)
  const inkLines = useMemo<VnPlayerLine[]>(
    () => story.lines.map((line) => ({ speaker: line.speaker, text: line.text })),
    [story.lines],
  )
  const combined = useMemo(() => [...inkLines, ...userTurns], [inkLines, userTurns])
  const currentLine = combined.at(-1) ?? null
  const history = combined.slice(0, -1)
  const repeatFrames = useMemo(
    () => data.inkScript.inkSource
      ? flattenComposerToTimeline(parseComposer(data.inkScript.inkSource))
      : [],
    [data.inkScript.inkSource],
  )

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

  const publishVideo = async () => {
    if (!recordId || publishing || published) return
    const taskId = `script-video:${recordId}`
    setPublishing(true)
    setPublishProgress(1)
    startGlobalTask({
      id: taskId,
      kind: 'script_video',
      title: `《${data.episode.title}》演出视频`,
    })
    try {
      const work = await scriptCommunityApi.createWork({
        recordId,
        kind: mode === 'vn' ? 'vn_video' : 'repeat_video',
        title: `完成《${data.episode.title}》`,
        caption: `${mode === 'vn' ? 'VN 互动' : '跟读剧场'} · ${userTurns.length || inkLines.length} 次开口`,
      })
      await requestScriptVideoRender({
        workId: work.id,
        frames: repeatFrames,
        onProgress: (progress, step) => {
          setPublishProgress(progress)
          updateGlobalTask(taskId, { progress, stepLabel: step || '服务端 Remotion 渲染中' })
        },
      })
      setPublishProgress(100)
      setPublished(true)
      updateGlobalTask(taskId, { progress: 100, status: 'done', stepLabel: '已发布到广场' })
      toast.success('演出视频已发布到广场')
    } catch (error: any) {
      setPublishProgress(0)
      updateGlobalTask(taskId, {
        status: 'error',
        stepLabel: '视频生成失败',
        error: error?.message || '视频生成失败，请重试',
      })
      toast.error(error?.message || '视频生成失败，请重试')
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

  const completeRepeat = async ({ recordedCount }: { recordedCount: number; totalCount: number }) => {
    if (repeatSaving || completionSaved.current) return
    setRepeatSaving(true)
    completionSaved.current = true
    try {
      const record = await scriptCommunityApi.completeRecord(episodeId, {
        mode: 'repeat',
        durationSec: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
        turnCount: 0,
        lineCount: recordedCount,
        completedObjectiveCount: data.episode.objectives.length,
        resultSnapshot: {
          inkScriptId: data.inkScript.id,
          inkScriptVersion: data.inkScript.version,
          mode: 'repeat',
          recordedLineCount: recordedCount,
        },
      })
      setRecordId(record.id)
      toast.success('跟读演出已保存')
    } catch {
      completionSaved.current = false
      toast.error('跟读记录保存失败，请重试')
    } finally {
      setRepeatSaving(false)
    }
  }

  return (
    <div className="relative flex h-dvh flex-col bg-background">
      <div className="absolute inset-x-0 top-0 z-30 flex justify-center px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
        <div className="flex h-9 w-full max-w-[400px] items-center gap-1 rounded-full border border-border/55 bg-background/90 px-1.5 text-foreground shadow-lg ring-1 ring-primary/[0.08] backdrop-blur-2xl">
        <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 rounded-full px-2.5 text-xs font-medium text-foreground/80 shadow-none hover:bg-primary/[0.16] hover:text-foreground">
          <Link to={`/scripts/packages/${packageId}/episodes/${episodeId}`}>
            <ArrowLeft className="size-3.5" />
            返回
          </Link>
        </Button>
        <span className="min-w-0 flex-1 truncate px-2 text-center text-xs font-medium text-foreground/70">
          {mode === 'repeat' ? '跟读剧场' : 'VN 互动'}
        </span>
        {isChatMode && (
          <>
            <button
              type="button"
              aria-label="对话历史"
              onClick={() => vnPlayerRef.current?.toggleHistory()}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-primary/[0.16] hover:text-foreground"
            >
              <History className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="对话设置"
              onClick={() => vnPlayerRef.current?.toggleSettings()}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-primary/[0.16] hover:text-foreground"
            >
              <Settings className="size-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-primary/[0.16] hover:text-foreground"
          aria-label="重新开始"
        >
          <RotateCcw className="size-3.5" />
        </button>
        </div>
      </div>
      <div className={mode === 'repeat'
        ? 'min-h-0 flex-1 bg-background pt-[calc(3.5rem+env(safe-area-inset-top,0px))]'
        : 'min-h-0 flex-1 bg-background'}>
      {mode === 'repeat' ? (
        <VnMixedPreviewPlayer
          frames={repeatFrames}
          activeIndex={repeatFrameIndex}
          onJumpTo={setRepeatFrameIndex}
          practiceMode
          onComplete={(result) => void completeRepeat(result)}
          className="h-full max-h-none max-w-none rounded-none border-0 shadow-none"
        />
      ) : (
      <VnPlayer
        ref={vnPlayerRef}
        currentLine={currentLine}
        history={history}
        choices={story.choices}
        isWaiting={story.isWaiting}
        isEnded={story.isEnded}
        onAdvance={story.advanceStory}
        onChoice={story.handleChoice}
        onSubmitInput={submitInput}
        className="h-full max-w-none rounded-none border-none"
        stageClassName="min-h-0"
        hideChatTopBar
        onDisplayModeChange={(displayMode) => setIsChatMode(displayMode === 'chat')}
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
              disabled={!recordId || publishing || published}
              onClick={() => void publishVideo()}
            >
              {published
                ? '已发布到广场'
                : publishing
                  ? `正在生成视频 ${publishProgress}%`
                  : recordId
                    ? '生成视频并发布'
                    : '正在保存记录…'}
            </Button>
            {publishing && (
              <Progress value={publishProgress} className="h-1.5 w-48" />
            )}
          </div>
        )}
      />
      )}
      </div>
      {mode === 'repeat' && recordId && (
        <div className="absolute inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 rounded-2xl bg-background/92 p-3 shadow-lg backdrop-blur-xl">
          <Button
            size="sm"
            className="rounded-full"
            disabled={publishing || published}
            onClick={() => void publishVideo()}
          >
            {published
              ? '已发布到广场'
              : publishing
                ? `正在生成视频 ${publishProgress}%`
                : '生成视频并发布'}
          </Button>
          {publishing && <Progress value={publishProgress} className="h-1.5" />}
        </div>
      )}
    </div>
  )
}
