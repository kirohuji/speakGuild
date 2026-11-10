import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Film, History, RotateCcw, Settings, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { VnPlayer, type VnPlayerHandle, type VnPlayerLine } from '@/features/vn-engine/vn-player'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { type StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { learningRepository } from '@/lib/offline'
import {
  clearPreparedStoryVnEntry,
  takePreparedStoryVnEntry,
  type PreparedStoryVnEntry,
} from '@/features/vn-engine/prepare-story-vn-entry'
import { useInstalledVnMedia } from '@/features/vn-engine/use-installed-vn-media'
import { useVnTagVisuals } from '@/features/vn-engine/use-vn-tag-visuals'
import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'
import { writeLocalStoryEpisodePassed } from '@/features/scripts/lib/story-chapter-progress'
import { useLayoutStore } from '@/stores/layout.store'
import { VnMixedPreviewPlayer } from '@/features/admin/components/vn-mixed-preview-player'
import { enqueueScriptVideoRender } from '@/features/scripts/lib/request-script-video-render'
import { buildStoryRepeatFrames } from '@/features/scripts/lib/story-repeat-frames'
import { PracticeAnalysisPanel } from '@/features/practice/components/practice-analysis-panel'
import { useGlobalTaskStore } from '@/stores/global-task.store'
import { createFileReference, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import {
  parseVnTags,
  characterMatchesSpeaker,
} from '@/features/practice/lib/practice-session-utils'

export function ScriptPlayerPage() {
  const { t } = useTranslation()
  const { episodeId } = useParams()
  const [searchParams] = useSearchParams()
  const packageId = searchParams.get('packageId') ?? ''
  const mode = searchParams.get('mode') === 'repeat' ? 'repeat' : 'vn'
  const setImmersiveMode = useLayoutStore((state) => state.setImmersiveMode)
  const preparedRef = useRef<PreparedStoryVnEntry | null>(
    episodeId ? takePreparedStoryVnEntry(packageId, episodeId) : null,
  )
  const [data, setData] = useState<StoryEpisodePlayerData | null>(preparedRef.current?.data ?? null)
  const [prepared, setPrepared] = useState<PreparedStoryVnEntry | null>(preparedRef.current)
  const [loading, setLoading] = useState(!preparedRef.current)
  const [failed, setFailed] = useState(false)
  const completionSaved = useRef(false)

  useEffect(() => {
    setImmersiveMode(true)
    return () => {
      setImmersiveMode(false)
      clearPreparedStoryVnEntry()
    }
  }, [setImmersiveMode])

  useEffect(() => {
    if (!episodeId) return
    if (preparedRef.current) return
    setLoading(true)
    setFailed(false)
    learningRepository.getStoryEpisodePlayer(packageId, episodeId)
      .then((next) => {
        setData(next)
        setPrepared(null)
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [episodeId, packageId])

  // Theme-colored hold while cold-loading (no click-time prep). Prefer preparing on the episode buttons.
  if (loading) {
    return <div className="h-dvh bg-background" aria-busy="true" aria-label={t('common.loading')} />
  }

  if (failed || !data) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg font-semibold">{t('scripts.episodePlayFailed')}</p>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          {t('scripts.episodePlayFailedDesc')}
        </p>
        <Button asChild variant="secondary" className="rounded-full border-0 shadow-none">
          <Link to={`/scripts/packages/${packageId}/episodes/${episodeId}`}>
            <ArrowLeft data-icon="inline-start" />
            {t('scripts.backToEpisode')}
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
      prepared={prepared}
    />
  )
}

function getRecordedAudioDurationMs(blob: Blob) {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio()
    const finish = (durationMs = 0) => {
      URL.revokeObjectURL(url)
      audio.removeAttribute('src')
      audio.load()
      resolve(durationMs)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? Math.ceil(audio.duration * 1000) : 0)
    audio.onerror = () => finish()
    audio.src = url
  })
}

function InkEpisodePlayer({
  data,
  episodeId,
  packageId,
  mode,
  completionSaved,
  prepared,
}: {
  data: StoryEpisodePlayerData
  episodeId: string
  packageId: string
  mode: 'vn' | 'repeat'
  completionSaved: React.MutableRefObject<boolean>
  prepared?: PreparedStoryVnEntry | null
}) {
  const { t } = useTranslation()
  const [userTurns, setUserTurns] = useState<VnPlayerLine[]>([])
  const [recordId, setRecordId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [videoQueued, setVideoQueued] = useState(false)
  const [videoCompleted, setVideoCompleted] = useState(false)
  const startGlobalTask = useGlobalTaskStore((state) => state.startTask)
  const updateGlobalTask = useGlobalTaskStore((state) => state.updateTask)
  const [repeatSaving, setRepeatSaving] = useState(false)
  const [repeatFrameIndex, setRepeatFrameIndex] = useState(0)
  const [isChatMode, setIsChatMode] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null)
  const vnPlayerRef = useRef<VnPlayerHandle | null>(null)
  const startedAt = useRef(Date.now())
  const story = useInkStory(data.inkScript.inkJson)
  const { currentTags } = story

  const { mediaReady, assetMap: resolvedAssetMap, scene: resolvedScene } = useInstalledVnMedia({
    packageId,
    revision: episodeId,
    rawAssetMap: data.inkScript.assetMap,
    rawScene: data.scene,
    preparedAssetMap: prepared?.assetMap,
    preparedScene: prepared?.scene,
  })
  const vnVisual = useVnTagVisuals({
    currentTags,
    mediaReady,
    assetMap: resolvedAssetMap,
    sceneBackgroundUrl: (resolvedScene as { backgroundUrl?: string | null } | null)?.backgroundUrl,
    isWaiting: story.isWaiting,
    initialBackgroundUrl: prepared?.backgroundUrl,
  })

  // 跟踪是否刚提交了用户输入（用于在 currentLine 中优先展示用户输入）
  const userInputJustSubmittedRef = useRef(false)

  const inkLines = useMemo<VnPlayerLine[]>(
    () => story.lines.map((line) => {
      const parsed = parseVnTags(line.tags, mediaReady ? resolvedAssetMap : undefined)
      return {
        speaker: line.speaker,
        text: line.text,
        translation: parsed.translation,
        audioUrl: parsed.audio,
      }
    }),
    [mediaReady, resolvedAssetMap, story.lines],
  )

  // inkLines 变化时（advanceStory 推进了剧情），清除「刚提交」标记
  useEffect(() => {
    userInputJustSubmittedRef.current = false
  }, [inkLines])
  const combined = useMemo(() => {
    const result: VnPlayerLine[] = []
    const maxLen = Math.max(inkLines.length, userTurns.length)
    for (let i = 0; i < maxLen; i++) {
      if (i < inkLines.length) result.push(inkLines[i])
      if (i < userTurns.length) result.push(userTurns[i])
    }
    return result
  }, [inkLines, userTurns])
  const dialogueSnapshot = useMemo(
    () => combined.map(({ speaker, text, isUser }) => ({ speaker, text, isUser })),
    [combined],
  )
  // Live dialogue line for the VN stage:
  // - Ended: always the real last timeline turn (user answer included), so the
  //   player's review model can step End → last user/NPC without gaps.
  // - Just submitted: flash the user's answer before the next NPC line arrives.
  // - Otherwise: last NPC line (user answers are reviewed via 上一轮).
  const currentLine = useMemo(() => {
    if (story.isEnded) return combined.at(-1) ?? null
    if (userInputJustSubmittedRef.current) return combined.at(-1) ?? null
    for (let i = combined.length - 1; i >= 0; i--) {
      if (!combined[i].isUser) return combined[i]
    }
    return combined.at(-1) ?? null
  }, [combined, story.isEnded])
  // Complete chronological timeline (NPC + user). VnPlayer treats "ended" as a
  // virtual slot after this list.
  const history = combined

  // ── 角色与立绘解析（与练习 VN 相同逻辑）──
  const characters = useMemo(
    () => (resolvedScene as { characters?: any[] } | null)?.characters ?? [],
    [resolvedScene],
  )
  const currentCharacter = useMemo(() => {
    const speaker = vnVisual.speaker || (currentLine?.speaker && !currentLine.isUser ? currentLine.speaker : undefined)
    return characters.find((c) => characterMatchesSpeaker(c as any, speaker))
      || (characters.length === 1 ? characters[0] : undefined)
  }, [characters, vnVisual.speaker, currentLine])

  const expressionMap = useMemo(() => {
    if (!currentCharacter?.expressions || typeof currentCharacter.expressions !== 'object') return {}
    return currentCharacter.expressions as Record<string, string | { spriteUrl?: string; avatarUrl?: string }>
  }, [currentCharacter?.expressions])

  const currentState = vnVisual.expression ? expressionMap[vnVisual.expression] : expressionMap['default']
  const stateSpriteUrl = typeof currentState === 'string' ? currentState : (currentState as any)?.spriteUrl
  const stateAvatarUrl = typeof currentState === 'object' ? (currentState as any)?.avatarUrl : undefined
  const currentSpriteUrl = currentCharacter
    ? stateSpriteUrl || currentCharacter.spriteBaseUrl || undefined
    : undefined
  const spritePosition = (vnVisual.position || currentCharacter?.defaultPosition || 'center') as 'left' | 'center' | 'right'
  const assetsResolving = !mediaReady

  const repeatFrames = useMemo(
    () => buildStoryRepeatFrames(data, {
      assetMap: resolvedAssetMap,
      scene: (resolvedScene as StoryEpisodePlayerData['scene']) ?? data.scene,
    }),
    [data, resolvedAssetMap, resolvedScene],
  )
  // Remotion runs on the server: never Capacitor file URLs, and keep signed audio
  // URLs (not cookie-bound content?inline=1) so headless Chrome can fetch them.
  const renderFrames = useMemo(() => buildStoryRepeatFrames(data, { audioMode: 'render' }), [data])

  useEffect(() => {
    if (!story.isEnded || completionSaved.current) return
    completionSaved.current = true
    writeLocalStoryEpisodePassed(episodeId)
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
        dialogue: dialogueSnapshot,
      },
    }).then((record) => {
      setRecordId(record.id)
    }).catch(() => {
      completionSaved.current = false
      toast.error(t('scripts.recordSyncFailed'))
    })
  }, [completionSaved, data.episode.objectives.length, data.inkScript.id, data.inkScript.version, dialogueSnapshot, episodeId, inkLines.length, mode, story.isEnded, t, userTurns.length])

  const publishVideo = async () => {
    if (!recordId || publishing || videoQueued) return
    setPublishing(true)
    let globalTaskId: string | null = null
    try {
      const work = await scriptCommunityApi.createWork({
        recordId,
        kind: mode === 'vn' ? 'vn_video' : 'repeat_video',
        title: t('scripts.workTitleComplete', { title: data.episode.title }),
        caption: `${mode === 'vn' ? t('scripts.vnInteractive') : t('scripts.repeatTheater')} · ${t('scripts.speakingCount', { count: userTurns.length || inkLines.length })}`,
      })
      const taskId = `script-video:${work.id}`
      globalTaskId = taskId
      startGlobalTask({ id: taskId, kind: 'script_video', title: t('scripts.performanceVideo', { title: data.episode.title }) })
      const task = await enqueueScriptVideoRender({
        workId: work.id,
        frames: renderFrames,
      })
      setVideoCompleted(false)
      setVideoQueued(true)
      updateGlobalTask(taskId, { progress: 1, stepLabel: t('scripts.renderSubmitted', { taskId: task.taskId.slice(-6) }) })
      toast.success(t('scripts.renderSubmittedHint'))
    } catch (error: any) {
      if (globalTaskId) {
        updateGlobalTask(globalTaskId, {
          status: 'error',
          stepLabel: t('scripts.videoGenerateFailed'),
          error: error?.message || t('scripts.videoGenerateFailedRetry'),
        })
      }
      toast.error(error?.message || t('scripts.videoGenerateFailedRetry'))
    } finally {
      setPublishing(false)
    }
  }

  const submitInput = async (text: string) => {
    const value = text.trim()
    if (!value) return
    setUserTurns((current) => [...current, { speaker: t('learning.speakerMe'), text: value, isUser: true }])
    userInputJustSubmittedRef.current = true
    story.resumeAfterInput(value)
    // 不调 advanceStory — 让用户点「继续」后再推进，先展示输入内容
  }

  const requestAiAnalysis = async () => {
    if (!recordId || analysisLoading) return
    if (analysisResult) {
      setAnalysisOpen(true)
      return
    }
    setAnalysisOpen(true)
    setAnalysisLoading(true)
    try {
      const result = await scriptCommunityApi.analyzeRecord(recordId)
      setAnalysisResult(result.analysis ?? null)
      if (!result.analysis) toast.error(t('learning.aiReviewPending'))
      else toast.success(t('learning.aiEvaluationDone'))
    } catch (error: any) {
      toast.error(error?.message || t('practiceSession.aiEvalUnavailable'))
      setAnalysisOpen(false)
    } finally {
      setAnalysisLoading(false)
    }
  }

  const completeRepeat = async ({
    recordedCount,
    totalCount,
    recordings,
    audioLocks,
  }: {
    recordedCount: number
    totalCount: number
    recordings: Record<number, Blob>
    audioLocks?: Record<number, 'tts' | 'recording'>
  }) => {
    if (repeatSaving || completionSaved.current) return
    if (recordedCount < totalCount) {
      toast.error(t('scripts.repeatAllLinesRequired'))
      return
    }
    setRepeatSaving(true)
    completionSaved.current = true
    try {
      const recordingBatchId = `repeat-${episodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const recordingAssets = Object.fromEntries(await Promise.all(
        Object.entries(recordings).map(async ([frameIndex, blob]) => {
          const mimeType = blob.type || 'audio/webm'
          const extension = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
            : mimeType.includes('ogg') ? 'ogg'
              : 'webm'
          const file = new File([blob], `repeat-${episodeId}-${frameIndex}.${extension}`, { type: mimeType })
          const asset = await uploadFileToCosAndComplete({ file, group: 'user_recording' })
          // The completion request verifies this temporary user-owned
          // reference, then atomically transfers it to the record itself.
          await createFileReference(asset.id, 'script_practice_upload', recordingBatchId)
          return [frameIndex, asset.id]
        }),
      )) as Record<string, string>
      const recordingDurationsMs = Object.fromEntries(await Promise.all(
        Object.entries(recordings).map(async ([frameIndex, blob]) => [frameIndex, await getRecordedAudioDurationMs(blob)] as const),
      ))
      const recordingAssetIds = [...new Set(Object.values(recordingAssets))]
      writeLocalStoryEpisodePassed(episodeId)
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
          recordingAssets,
          recordingDurationsMs,
          audioLocks: audioLocks && Object.keys(audioLocks).length > 0 ? audioLocks : undefined,
          dialogue: repeatFrames.map((frame) => ({
            speaker: frame.kind === 'choice' || frame.kind === 'userInput' ? t('learning.speakerMe') : frame.speaker,
            text: frame.text,
            isUser: frame.kind === 'choice' || frame.kind === 'userInput',
          })),
        },
        audioAssetId: recordingAssetIds[0],
        recordingAssetIds,
        recordingBatchId,
      })
      setRecordId(record.id)
      toast.success(t('scripts.repeatSaved'))
    } catch (error) {
      completionSaved.current = false
      console.error('[repeat-vn] practice record save failed', {
        episodeId,
        recordedCount,
        recordingCount: Object.keys(recordings).length,
        error,
      })
      toast.error(t('scripts.repeatSaveFailed'))
    } finally {
      setRepeatSaving(false)
    }
  }

  const showEndedChrome = mode === 'vn' && !assetsResolving && story.isEnded

  return (
    <div className="relative flex h-dvh flex-col bg-background">
      <div className="z-30 shrink-0 bg-background pt-[env(safe-area-inset-top,0px)]">
        <div className="relative flex h-11 w-full items-center gap-2 px-2 text-foreground">
        <Button asChild variant="ghost" size="sm" className="relative z-10 h-8 shrink-0 rounded-md px-2 text-xs font-medium text-foreground/80 shadow-none hover:bg-muted hover:text-foreground">
          <Link to={showEndedChrome ? `/scripts/packages/${packageId}` : `/scripts/packages/${packageId}/episodes/${episodeId}`}>
            <ArrowLeft className="size-3.5" />
            {showEndedChrome ? t('scripts.backToChapterList') : t('common.back')}
          </Link>
        </Button>
        <span className="pointer-events-none absolute inset-x-0 truncate px-16 text-center text-xs font-medium text-foreground/70">
          {mode === 'repeat' ? t('scripts.repeatTheater') : t('scripts.vnInteractive')}
        </span>
        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1">
          {showEndedChrome ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-md px-2 text-xs font-medium text-foreground/80 shadow-none hover:bg-muted hover:text-foreground"
              onClick={() => window.location.reload()}
            >
              <RotateCcw className="size-3.5" />
              {t('scripts.performAgain')}
            </Button>
          ) : isChatMode ? (
            <>
              <button
                type="button"
                aria-label={t('vnHistory.title')}
                onClick={() => vnPlayerRef.current?.toggleHistory()}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              >
                <History className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={t('vnSettings.title')}
                onClick={() => vnPlayerRef.current?.toggleSettings()}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings className="size-3.5" />
              </button>
            </>
          ) : null}
        </div>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-background">
      {/* Theme hold → dissolve images in. Never a spinner for media resolve. */}
      {mode === 'repeat' ? (
        assetsResolving ? null : (
          <VnMixedPreviewPlayer
            frames={repeatFrames}
            activeIndex={repeatFrameIndex}
            onJumpTo={setRepeatFrameIndex}
            practiceMode
            onComplete={(result) => void completeRepeat(result)}
            completionSubmitting={repeatSaving}
            onGenerateVideo={recordId ? () => void publishVideo() : undefined}
            videoSubmitting={publishing}
            videoQueued={videoQueued}
            videoCompleted={videoCompleted}
            className="h-full max-h-none max-w-none rounded-none border-0 shadow-none"
          />
        )
      ) : (
      <VnPlayer
        ref={vnPlayerRef}
        currentLine={assetsResolving ? null : currentLine}
        history={assetsResolving ? [] : history}
        choices={assetsResolving ? [] : story.choices}
        isWaiting={assetsResolving || story.isWaiting}
        isEnded={!assetsResolving && story.isEnded}
        onAdvance={assetsResolving ? undefined : story.advanceStory}
        onChoice={assetsResolving ? undefined : story.handleChoice}
        onSubmitInput={assetsResolving ? undefined : submitInput}
        className="h-full max-w-none rounded-none border-0 bg-background"
        stageClassName="min-h-0"
        hideChatTopBar
        showUserInputOverride
        clearBackdrop
        offlineOnly
        backgroundUrl={assetsResolving ? undefined : vnVisual.backgroundUrl}
        backgroundFit={vnVisual.backgroundFit}
        currentSpriteUrl={assetsResolving ? undefined : currentSpriteUrl}
        spriteAlt={currentCharacter?.displayName || currentCharacter?.name}
        spritePosition={spritePosition}
        currentAvatarUrl={assetsResolving ? undefined : (stateAvatarUrl || (currentCharacter as any)?.avatarUrl || undefined)}
        currentAvatarAlt={currentCharacter?.displayName || currentCharacter?.name}
        onDisplayModeChange={(displayMode) => setIsChatMode(displayMode === 'chat')}
        hideEndedCaption
        endedActions={(
          <div className="mx-auto flex flex-col items-center gap-2.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 rounded-full border-0 bg-primary/10 px-4 text-xs font-medium text-primary shadow-none hover:bg-primary/16 hover:text-primary disabled:bg-primary/6 disabled:text-primary/45"
              disabled={!recordId || publishing || videoQueued || videoCompleted}
              onClick={() => void publishVideo()}
            >
              <Film data-icon="inline-start" className={publishing ? 'animate-pulse' : undefined} />
              {videoCompleted
                ? t('scripts.videoReadyToPublish')
                : videoQueued
                ? t('scripts.renderQueued')
                : publishing
                  ? t('scripts.submittingVideoTask')
                  : recordId
                    ? t('scripts.generateVideo')
                    : t('scripts.savingRecord')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 rounded-full border-0 bg-primary/10 px-4 text-xs font-medium text-primary shadow-none hover:bg-primary/16 hover:text-primary disabled:bg-primary/6 disabled:text-primary/45"
              disabled={!recordId || analysisLoading}
              onClick={() => void requestAiAnalysis()}
            >
              <Sparkles data-icon="inline-start" />
              {analysisLoading
                ? t('common.loading')
                : analysisResult
                  ? t('learning.viewAiReview')
                  : t('scripts.requestAiReview')}
            </Button>
          </div>
        )}
      />
      )}
      {analysisOpen && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-background px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3">
          <PracticeAnalysisPanel
            analysis={analysisResult as any}
            loading={analysisLoading}
            topicTitle={data.episode.title}
            readOnly
            onBack={() => setAnalysisOpen(false)}
            onRestart={() => window.location.reload()}
          />
        </div>
      )}
      </div>
    </div>
  )
}
