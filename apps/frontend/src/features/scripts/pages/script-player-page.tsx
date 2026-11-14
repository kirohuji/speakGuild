import { showRequestError } from '@/lib/request-feedback'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Film, History, RotateCcw, Settings, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { VnPlayer, type VnPlayerHandle, type VnPlayerLine } from '@/features/vn-engine/vn-player'
import { type VnInputRecording } from '@/features/vn-engine/vn-input-panel'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { type StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { learningRepository, offlineSyncService } from '@/lib/offline'
import {
  clearPreparedStoryVnEntry,
  takePreparedStoryVnEntry,
  type PreparedStoryVnEntry,
} from '@/features/vn-engine/prepare-story-vn-entry'
import { useInstalledVnMedia } from '@/features/vn-engine/use-installed-vn-media'
import { useVnTagVisuals } from '@/features/vn-engine/use-vn-tag-visuals'
import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'
import { scriptRepository } from '@/lib/offline'
import {
  SCRIPT_PRACTICE_SYNCED_EVENT,
  SCRIPT_PRACTICE_SYNC_FAILED_EVENT,
  type ScriptPracticeSyncFailedEventDetail,
  type ScriptPracticeSyncedEventDetail,
} from '@/lib/offline/script.repository'
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
import {
  buildPerformedStoryFrames,
  buildRepeatDialogueSnapshot,
  type PerformedStoryTurn,
} from '@/features/scripts/lib/performed-story-timeline'

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

type LivePerformedStoryTurn = PerformedStoryTurn & {
  audioUrl?: string
  recording?: VnInputRecording
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
  const [performedTurns, setPerformedTurns] = useState<LivePerformedStoryTurn[]>([])
  const [recordId, setRecordId] = useState<string | null>(null)
  const [recordSyncStatus, setRecordSyncStatus] = useState<'idle' | 'saving' | 'pending' | 'synced' | 'failed'>('idle')
  const [saveRetryNonce, setSaveRetryNonce] = useState(0)
  const pendingMutationIdRef = useRef<string | null>(null)
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
  const capturedInkLineCountRef = useRef(0)

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

  useEffect(() => {
    const start = capturedInkLineCountRef.current
    if (inkLines.length <= start) return
    const appended = inkLines.slice(start).map((line): LivePerformedStoryTurn => ({
      speaker: line.speaker,
      text: line.text,
      isUser: false,
      audioUrl: line.audioUrl,
    }))
    capturedInkLineCountRef.current = inkLines.length
    setPerformedTurns((current) => [...current, ...appended])
  }, [inkLines])

  // Re-bind NPC TTS when installed assetMap resolves after lines were first captured.
  useEffect(() => {
    setPerformedTurns((current) => {
      let inkIdx = 0
      let changed = false
      const next = current.map((turn) => {
        if (turn.isUser) return turn
        const ink = inkLines[inkIdx++]
        if (!ink) return turn
        if (turn.audioUrl === ink.audioUrl && turn.speaker === ink.speaker) return turn
        changed = true
        return { ...turn, audioUrl: ink.audioUrl, speaker: ink.speaker || turn.speaker }
      })
      return changed ? next : current
    })
  }, [inkLines])

  // inkLines 变化时（advanceStory 推进了剧情），清除「刚提交」标记
  useEffect(() => {
    userInputJustSubmittedRef.current = false
  }, [inkLines])
  const combined = useMemo<VnPlayerLine[]>(() => performedTurns.map((turn) => ({
    speaker: turn.speaker,
    text: turn.text,
    isUser: turn.isUser,
    audioUrl: turn.audioUrl,
  })), [performedTurns])
  const userTurns = useMemo(() => performedTurns.filter((turn) => turn.isUser), [performedTurns])
  const dialogueSnapshot = useMemo(
    () => performedTurns.map(({ speaker, text, isUser, originalText }) => ({ speaker, text, isUser, originalText })),
    [performedTurns],
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
  const performedRenderFrames = useMemo(
    () => buildPerformedStoryFrames(renderFrames, dialogueSnapshot),
    [dialogueSnapshot, renderFrames],
  )

  useEffect(() => {
    const handleSynced = (event: Event) => {
      const detail = (event as CustomEvent<ScriptPracticeSyncedEventDetail>).detail
      if (!detail?.record?.id || detail.clientMutationId !== pendingMutationIdRef.current) return
      pendingMutationIdRef.current = null
      setRecordId(detail.record.id)
      setRecordSyncStatus('synced')
      toast.success(t('scripts.recordSyncCompleted'))
    }
    const handleSyncFailed = (event: Event) => {
      const detail = (event as CustomEvent<ScriptPracticeSyncFailedEventDetail>).detail
      if (detail?.clientMutationId !== pendingMutationIdRef.current) return
      setRecordSyncStatus('failed')
    }
    window.addEventListener(SCRIPT_PRACTICE_SYNCED_EVENT, handleSynced)
    window.addEventListener(SCRIPT_PRACTICE_SYNC_FAILED_EVENT, handleSyncFailed)
    return () => {
      window.removeEventListener(SCRIPT_PRACTICE_SYNCED_EVENT, handleSynced)
      window.removeEventListener(SCRIPT_PRACTICE_SYNC_FAILED_EVENT, handleSyncFailed)
    }
  }, [t])

  useEffect(() => {
    const capturedNpcLineCount = performedTurns.filter((turn) => !turn.isUser).length
    if (
      mode !== 'vn'
      || !story.isEnded
      || completionSaved.current
      || capturedNpcLineCount < inkLines.length
    ) return
    completionSaved.current = true
    setRecordSyncStatus('saving')
    void (async () => {
      const recordingBatchId = `vn-${episodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const recordedTurns = performedTurns
        .map((turn, frameIndex) => ({ turn, frameIndex }))
        .filter((entry): entry is { turn: LivePerformedStoryTurn & { recording: VnInputRecording }; frameIndex: number } => Boolean(entry.turn.recording))
      const uploaded = await Promise.all(recordedTurns.map(async ({ turn, frameIndex }) => {
        const recording = turn.recording
        const file = new File([recording.blob], recording.filename, { type: recording.blob.type || 'audio/webm' })
        const asset = await uploadFileToCosAndComplete({ file, group: 'user_recording' })
        await createFileReference(asset.id, 'script_practice_upload', recordingBatchId)
        return {
          frameIndex,
          assetId: asset.id,
          durationMs: await getRecordedAudioDurationMs(recording.blob),
        }
      }))
      const recordingAssets = Object.fromEntries(uploaded.map((item) => [item.frameIndex, item.assetId]))
      const recordingDurationsMs = Object.fromEntries(uploaded.map((item) => [item.frameIndex, item.durationMs]))
      const performedTimeline = dialogueSnapshot.map((turn, frameIndex) => ({
        ...turn,
        recorded: Boolean(recordingAssets[String(frameIndex)]),
        recordingFrameIndex: recordingAssets[String(frameIndex)] ? frameIndex : undefined,
        recordingDurationMs: recordingDurationsMs[String(frameIndex)],
      }))
      const recordingAssetIds = [...new Set(Object.values(recordingAssets))]
      const { record, pending, clientMutationId } = await scriptRepository.completePractice(episodeId, {
        mode: 'vn',
        durationSec: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
        turnCount: userTurns.length,
        lineCount: performedTimeline.length,
        completedObjectiveCount: data.episode.objectives.length,
        resultSnapshot: {
          inkScriptId: data.inkScript.id,
          inkScriptVersion: data.inkScript.version,
          mode: 'vn',
          dialogue: performedTimeline,
          performedTimeline,
          recordingAssets,
          recordingDurationsMs,
        },
        audioAssetId: recordingAssetIds[0],
        recordingAssetIds,
        recordingBatchId: recordingAssetIds.length > 0 ? recordingBatchId : undefined,
      }, {
        episode: {
          id: data.episode.id,
          title: data.episode.title,
          chapterName: data.episode.chapterName,
          characterName: data.episode.characterName,
          scene: {
            id: data.episode.sceneId,
            title: data.episode.sceneTitle,
          },
        },
      })
      if (pending) {
        pendingMutationIdRef.current = clientMutationId
        setRecordSyncStatus('pending')
        toast.info(t('scripts.recordWaitingSync'))
      } else {
        setRecordId(record.id)
        setRecordSyncStatus('synced')
      }
    })().catch((error) => {
      completionSaved.current = false
      setRecordSyncStatus('failed')
      console.error('[script-vn] practice record save failed', { episodeId, error })
      toast.error(t('scripts.recordSyncFailed'))
    })
  }, [completionSaved, data.episode, data.inkScript.id, data.inkScript.version, dialogueSnapshot, episodeId, inkLines.length, mode, performedTurns, saveRetryNonce, story.isEnded, t, userTurns.length])

  const retryRecordSync = async () => {
    setRecordSyncStatus('saving')
    if (!pendingMutationIdRef.current) {
      completionSaved.current = false
      setSaveRetryNonce((current) => current + 1)
      return
    }
    try {
      const result = await offlineSyncService.sync(undefined, { quiet: true })
      if (pendingMutationIdRef.current && result.push.failed === 0) {
        setRecordSyncStatus('pending')
      }
    } catch {
      setRecordSyncStatus('failed')
    }
  }

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
        frames: mode === 'vn' ? performedRenderFrames : renderFrames,
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
      showRequestError(error, t('scripts.videoGenerateFailedRetry'))
    } finally {
      setPublishing(false)
    }
  }

  const submitInput = async (text: string, audioUrl?: string, recording?: VnInputRecording) => {
    const value = text.trim()
    if (!value) return
    setPerformedTurns((current) => [...current, {
      speaker: t('learning.speakerMe'),
      text: value,
      isUser: true,
      audioUrl,
      recording,
    }])
    userInputJustSubmittedRef.current = true
    story.resumeAfterInput(value)
    // 不调 advanceStory — 让用户点「继续」后再推进，先展示输入内容
  }

  const chooseStoryBranch = (index: number) => {
    const choice = story.choices.find((item) => item.index === index)
    if (choice?.text?.trim()) {
      setPerformedTurns((current) => [...current, {
        speaker: t('learning.speakerMe'),
        text: choice.text.trim(),
        originalText: choice.text.trim(),
        isUser: true,
      }])
      userInputJustSubmittedRef.current = true
    }
    story.handleChoice(index)
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
      showRequestError(error, t('practiceSession.aiEvalUnavailable'))
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
      const performedTimeline = buildRepeatDialogueSnapshot(
        repeatFrames,
        recordingAssets,
        recordingDurationsMs,
        t('learning.speakerMe'),
      )
      setRecordSyncStatus('saving')
      const { record, pending, clientMutationId } = await scriptRepository.completePractice(episodeId, {
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
          dialogue: performedTimeline,
          performedTimeline,
        },
        audioAssetId: recordingAssetIds[0],
        recordingAssetIds,
        recordingBatchId,
      }, {
        episode: {
          id: data.episode.id,
          title: data.episode.title,
          chapterName: data.episode.chapterName,
          characterName: data.episode.characterName,
          scene: {
            id: data.episode.sceneId,
            title: data.episode.sceneTitle,
          },
        },
      })
      if (pending) {
        pendingMutationIdRef.current = clientMutationId
        setRecordSyncStatus('pending')
        toast.info(t('scripts.recordWaitingSync'))
        return
      }
      setRecordId(record.id)
      setRecordSyncStatus('synced')
      toast.success(t('scripts.repeatSaved'))
    } catch (error) {
      completionSaved.current = false
      setRecordSyncStatus('failed')
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
          {mode === 'repeat'
            ? t('scripts.repeatTheater')
            : analysisOpen
              ? `${data.episode.title} · ${t('scripts.aiReviewTab')}`
              : t('scripts.vnInteractive')}
        </span>
        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1">
          {showEndedChrome ? (
            <>
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
              <Sparkles className={cn('size-3.5', analysisOpen ? 'text-primary' : 'text-muted-foreground')} />
              <Switch
                checked={analysisOpen}
                disabled={!recordId || analysisLoading}
                onCheckedChange={(checked) => {
                  if (checked) void requestAiAnalysis()
                  else setAnalysisOpen(false)
                }}
                aria-label={t('learning.toggleAiReview')}
                title={analysisOpen ? t('scripts.dialogueReplay') : t('scripts.aiReviewTab')}
              />
            </>
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
        onChoice={assetsResolving ? undefined : chooseStoryBranch}
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
            {recordSyncStatus !== 'idle' && recordSyncStatus !== 'synced' && (
              <p className="text-center text-xs text-muted-foreground" role="status" aria-live="polite">
                {recordSyncStatus === 'pending'
                  ? t('scripts.recordWaitingSync')
                  : recordSyncStatus === 'failed'
                    ? t('scripts.recordSyncFailed')
                    : t('scripts.savingRecord')}
              </p>
            )}
            {recordSyncStatus === 'failed' && (
              <Button type="button" size="sm" variant="ghost" onClick={() => void retryRecordSync()}>
                {t('scripts.retryRecordSync')}
              </Button>
            )}
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
                    : recordSyncStatus === 'pending'
                      ? t('scripts.recordWaitingSyncShort')
                      : t('scripts.savingRecord')}
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
