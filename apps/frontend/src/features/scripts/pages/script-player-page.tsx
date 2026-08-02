import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, History, Loader2, RotateCcw, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { VnPlayer, type VnPlayerHandle, type VnPlayerLine } from '@/features/vn-engine/vn-player'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { type StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { learningRepository } from '@/lib/offline'
import { assetCacheService } from '@/lib/offline/asset-cache.service'
import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'
import { useLayoutStore } from '@/stores/layout.store'
import { VnMixedPreviewPlayer } from '@/features/admin/components/vn-mixed-preview-player'
import { enqueueScriptVideoRender } from '@/features/scripts/lib/request-script-video-render'
import { buildStoryRepeatFrames } from '@/features/scripts/lib/story-repeat-frames'
import { useGlobalTaskStore } from '@/stores/global-task.store'
import { createFileReference, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import {
  parseVnTags,
  isBackgroundFit,
  isSpritePosition,
  characterMatchesSpeaker,
} from '@/features/practice/lib/practice-session-utils'

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
    learningRepository.getStoryEpisodePlayer(packageId, episodeId)
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

async function resolveSceneAssets(scene: StoryEpisodePlayerData['scene']) {
  if (!scene) return scene
  const resolveUrl = (url?: string | null) => url
    ? assetCacheService.resolve({ url, role: 'background', offlineOnly: true })
    : Promise.resolve(url)
  const characters = await Promise.all((scene.characters ?? []).map(async (character) => {
    const expressions = character.expressions && typeof character.expressions === 'object'
      ? await Promise.all(Object.entries(character.expressions).map(async ([name, value]) => {
        if (typeof value === 'string') return [name, await resolveUrl(value)]
        if (value && typeof value === 'object') {
          const entry = value as { spriteUrl?: string | null; avatarUrl?: string | null }
          return [name, {
            ...entry,
            spriteUrl: await resolveUrl(entry.spriteUrl),
            avatarUrl: await resolveUrl(entry.avatarUrl),
          }]
        }
        return [name, value]
      }))
      : []
    return {
      ...character,
      spriteBaseUrl: await resolveUrl(character.spriteBaseUrl),
      expressions: expressions.length ? Object.fromEntries(expressions) : character.expressions,
    }
  }))
  return { ...scene, backgroundUrl: await resolveUrl(scene.backgroundUrl), characters }
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
  const [videoQueued, setVideoQueued] = useState(false)
  const [videoCompleted, setVideoCompleted] = useState(false)
  const startGlobalTask = useGlobalTaskStore((state) => state.startTask)
  const updateGlobalTask = useGlobalTaskStore((state) => state.updateTask)
  const [repeatSaving, setRepeatSaving] = useState(false)
  const [repeatFrameIndex, setRepeatFrameIndex] = useState(0)
  const [isChatMode, setIsChatMode] = useState(false)
  const [resolvedAssetMap, setResolvedAssetMap] = useState(data.inkScript.assetMap ?? undefined)
  const [resolvedScene, setResolvedScene] = useState(data.scene)
  const [assetMapReady, setAssetMapReady] = useState(false)
  const [sceneAssetsReady, setSceneAssetsReady] = useState(false)
  const vnPlayerRef = useRef<VnPlayerHandle | null>(null)
  const startedAt = useRef(Date.now())
  const story = useInkStory(data.inkScript.inkJson)
  const { currentTags } = story

  // The package installer stores story resources by immutable SHA-256 and
  // creates a stable fileAssetId alias. Resolve aliases once here, before Ink
  // tags are interpreted, so Capacitor never needs a fresh signed API URL for
  // an already-installed episode.
  useEffect(() => {
    let cancelled = false
    const source = data.inkScript.assetMap ?? {}
    void Promise.all(Object.entries(source).map(async ([alias, entry]) => {
      if (!entry.signedUrl) return [alias, entry] as const
      const localUrl = await assetCacheService.resolve({
        url: entry.signedUrl,
        assetId: entry.fileAssetId,
        fileAssetId: entry.fileAssetId,
        mimeType: entry.mimeType,
        role: entry.type === 'audio' ? 'voice' : 'background',
        offlineOnly: true,
      })
      return [alias, { ...entry, signedUrl: localUrl }] as const
    })).then((resolvedEntries) => {
      if (cancelled) return
      const resolved = Object.fromEntries(resolvedEntries)
      console.log('[script-player] resolved offline asset map', {
        episodeId,
        total: resolvedEntries.length,
        local: resolvedEntries.filter(([, entry]) => Boolean(
          entry.signedUrl?.startsWith('capacitor://') || entry.signedUrl?.includes('/_capacitor_file_/'),
        )).length,
      })
      setResolvedAssetMap(resolved)
    }).catch((error) => {
      // A package player is offline-only: do not retain a remote URL after a
      // resolver failure, because that would silently defeat offline mode.
      console.warn('[script-player] offline asset-map resolution failed', { episodeId, error })
      if (!cancelled) setResolvedAssetMap({})
    }).finally(() => {
      if (!cancelled) setAssetMapReady(true)
    })
    return () => { cancelled = true }
  }, [data.inkScript.assetMap, episodeId])

  useEffect(() => {
    let cancelled = false
    void resolveSceneAssets(data.scene).then((scene) => {
      if (!cancelled) setResolvedScene(scene)
    }).catch((error) => console.warn('[script-player] offline scene resolution failed', { episodeId, error }))
      .finally(() => { if (!cancelled) setSceneAssetsReady(true) })
    return () => { cancelled = true }
  }, [data.scene, episodeId])

  // 跟踪是否刚提交了用户输入（用于在 currentLine 中优先展示用户输入）
  const userInputJustSubmittedRef = useRef(false)

  // ── VN 视觉状态（与练习 VN 相同逻辑）──
  const [vnVisual, setVnVisual] = useState<{
    backgroundUrl?: string
    backgroundFit?: 'cover' | 'contain' | 'stretch' | 'repeat'
    speaker?: string
    expression?: string
    position?: 'left' | 'center' | 'right'
  }>({
    backgroundUrl: undefined,
    backgroundFit: 'cover',
  })

  useEffect(() => {
    const tags = currentTags
    if (tags.length === 0) return
    const parsed = parseVnTags(tags, resolvedAssetMap)
    setVnVisual((prev) => {
      const next = {
        backgroundUrl: parsed.bg || prev.backgroundUrl || (resolvedScene?.backgroundUrl ?? undefined),
        backgroundFit: isBackgroundFit(parsed.bgFit) ? parsed.bgFit : prev.backgroundFit,
        speaker: prev.speaker,
        expression: prev.expression,
        position: prev.position,
      }
      // isWaiting 时 tags 属于 pending 行，不更新立绘状态
      if (!story.isWaiting) {
        next.speaker = parsed.speaker || prev.speaker
        next.expression = parsed.expression || prev.expression || 'default'
        next.position = isSpritePosition(parsed.position) ? parsed.position : prev.position
      }
      return next
    })
  }, [currentTags, resolvedScene?.backgroundUrl, resolvedAssetMap, story.isWaiting])

  const inkLines = useMemo<VnPlayerLine[]>(
    () => story.lines.map((line) => {
      const parsed = parseVnTags(line.tags, resolvedAssetMap)
      return {
        speaker: line.speaker,
        text: line.text,
        translation: parsed.translation,
        audioUrl: parsed.audio,
      }
    }),
    [story.lines, resolvedAssetMap],
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
  // 刚提交用户输入时，优先展示用户输入；否则展示最后一条 NPC 线
  const currentLine = useMemo(() => {
    if (userInputJustSubmittedRef.current) return combined.at(-1) ?? null
    // 普通模式：找最后一条非用户线
    for (let i = combined.length - 1; i >= 0; i--) {
      if (!combined[i].isUser) return combined[i]
    }
    return combined.at(-1) ?? null
  }, [combined])
  // VnPlayer receives the complete chronological timeline, including the
  // current line, so its shared "previous dialogue" control can step back to
  // a user's immediately preceding answer instead of skipping it.
  const history = combined

  // ── 角色与立绘解析（与练习 VN 相同逻辑）──
  const characters = useMemo(() => resolvedScene?.characters ?? [], [resolvedScene?.characters])
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
  const assetsResolving = !assetMapReady || !sceneAssetsReady

  const repeatFrames = useMemo(
    () => buildStoryRepeatFrames(data, { assetMap: resolvedAssetMap, scene: resolvedScene }),
    [data, resolvedAssetMap, resolvedScene],
  )
  // Remotion runs on the server and must never receive Capacitor file URLs.
  const renderFrames = useMemo(() => buildStoryRepeatFrames(data), [data])

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
        dialogue: dialogueSnapshot,
      },
    }).then((record) => {
      setRecordId(record.id)
    }).catch(() => {
      completionSaved.current = false
      toast.error('章节记录同步失败，稍后会再次尝试')
    })
  }, [completionSaved, data.episode.objectives.length, data.inkScript.id, data.inkScript.version, dialogueSnapshot, episodeId, inkLines.length, mode, story.isEnded, userTurns.length])

  const publishVideo = async () => {
    if (!recordId || publishing || videoQueued) return
    setPublishing(true)
    let globalTaskId: string | null = null
    try {
      const work = await scriptCommunityApi.createWork({
        recordId,
        kind: mode === 'vn' ? 'vn_video' : 'repeat_video',
        title: `完成《${data.episode.title}》`,
        caption: `${mode === 'vn' ? 'VN 互动' : '跟读剧场'} · ${userTurns.length || inkLines.length} 次开口`,
      })
      const taskId = `script-video:${work.id}`
      globalTaskId = taskId
      startGlobalTask({ id: taskId, kind: 'script_video', title: `《${data.episode.title}》演出视频` })
      const task = await enqueueScriptVideoRender({
        workId: work.id,
        frames: renderFrames,
      })
      setVideoCompleted(false)
      setVideoQueued(true)
      updateGlobalTask(taskId, { progress: 1, stepLabel: `已提交后台渲染（任务 ${task.taskId.slice(-6)}）` })
      toast.success('已创建作品并提交后台渲染；完成后会自动发布到广场，可继续练习')
    } catch (error: any) {
      if (globalTaskId) {
        updateGlobalTask(globalTaskId, {
          status: 'error',
          stepLabel: '视频生成失败',
          error: error?.message || '视频生成失败，请重试',
        })
      }
      toast.error(error?.message || '视频生成失败，请重试')
    } finally {
      setPublishing(false)
    }
  }

  const submitInput = async (text: string) => {
    const value = text.trim()
    if (!value) return
    setUserTurns((current) => [...current, { speaker: '我', text: value, isUser: true }])
    userInputJustSubmittedRef.current = true
    story.resumeAfterInput(value)
    // 不调 advanceStory — 让用户点「继续」后再推进，先展示输入内容
  }

  const completeRepeat = async ({
    recordedCount,
    totalCount,
    recordings,
  }: {
    recordedCount: number
    totalCount: number
    recordings: Record<number, Blob>
  }) => {
    if (repeatSaving || completionSaved.current) return
    if (recordedCount < totalCount) {
      toast.error('完成全部台词跟读后，才会生成练习记录')
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
          dialogue: repeatFrames.map((frame) => ({
            speaker: frame.kind === 'choice' || frame.kind === 'userInput' ? '我' : frame.speaker,
            text: frame.text,
            isUser: frame.kind === 'choice' || frame.kind === 'userInput',
          })),
        },
        audioAssetId: recordingAssetIds[0],
        recordingAssetIds,
        recordingBatchId,
      })
      setRecordId(record.id)
      toast.success('跟读演出已保存')
    } catch (error) {
      completionSaved.current = false
      console.error('[repeat-vn] practice record save failed', {
        episodeId,
        recordedCount,
        recordingCount: Object.keys(recordings).length,
        error,
      })
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
      {assetsResolving ? (
        <div className="flex h-full items-center justify-center bg-background">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      ) : mode === 'repeat' ? (
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
        showUserInputOverride
        offlineOnly
        backgroundUrl={vnVisual.backgroundUrl || (resolvedScene?.backgroundUrl ?? undefined)}
        backgroundFit={vnVisual.backgroundFit}
        currentSpriteUrl={currentSpriteUrl}
        spriteAlt={currentCharacter?.displayName || currentCharacter?.name}
        spritePosition={spritePosition}
        currentAvatarUrl={stateAvatarUrl || (currentCharacter as any)?.avatarUrl || undefined}
        currentAvatarAlt={currentCharacter?.displayName || currentCharacter?.name}
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
              disabled={!recordId || publishing || videoQueued || videoCompleted}
              onClick={() => void publishVideo()}
            >
              {videoCompleted
                ? '视频已生成并发布'
                : videoQueued
                ? '已提交后台生成'
                : publishing
                  ? '正在提交视频任务…'
                  : recordId
                    ? '生成视频并发布'
                    : '正在保存记录…'}
            </Button>
          </div>
        )}
      />
      )}
      </div>
    </div>
  )
}
