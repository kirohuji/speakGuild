import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines, CheckCircle2, Eraser, Film, Loader2, Mic, Pause, Play, Settings, Square, Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { PixiVnStage } from '@/features/vn-engine/pixi-vn-stage'
import { MixedPlaybackSettingsDialog, type LoopMode } from '@/components/common/playback-settings-dialog'
import { isUserMixedFrame, type MixedTimelineFrame } from './vn-mixed-timeline'
import { resolveDisplayAssetUrl } from '@/lib/file-asset-reference'
import { assetCacheService, OFFLINE_RESOURCE_MISSING } from '@/lib/offline/asset-cache.service'
import { startBestNativeVoiceInput, type NativeVoiceInputSession } from '@/lib/native/vn-voice-input'
import { isPlayableMediaUrl } from '@/features/vn-engine/vn-media-url'

type FrameAudioSource = 'tts' | 'recording'

function defaultAudioSource(frame: MixedTimelineFrame, hasRecording: boolean): FrameAudioSource | null {
  if (isUserMixedFrame(frame)) {
    // Learner lines: own recording is required; TTS is only a rare fallback.
    if (hasRecording) return 'recording'
    if (frame.audioUrl) return 'tts'
    return null
  }
  // Character lines: TTS first; learner dubbing is optional and fills missing TTS.
  if (frame.audioUrl) return 'tts'
  if (hasRecording) return 'recording'
  return null
}

function isRequiredFollowFrame(frame: MixedTimelineFrame) {
  return isUserMixedFrame(frame) && Boolean(frame.text) && frame.kind !== 'missingInput'
}

function resolveFramePlaybackUrl(
  frame: MixedTimelineFrame,
  recordingUrls: Record<number, string>,
  audioLocks: Record<number, FrameAudioSource>,
): string | undefined {
  const recording = recordingUrls[frame.index]
  const locked = audioLocks[frame.index]
  if (locked === 'tts' && frame.audioUrl) return frame.audioUrl
  if (locked === 'recording' && recording) return recording
  const preferred = defaultAudioSource(frame, Boolean(recording))
  if (preferred === 'recording') return recording
  if (preferred === 'tts') return frame.audioUrl
  return undefined
}

// 兼容旧导入：播放设置弹窗已抽为公共组件
export { MixedPlaybackSettingsDialog }
export type { LoopMode }

interface VnMixedPreviewPlayerProps {
  frames: MixedTimelineFrame[]
  activeIndex: number
  onJumpTo: (index: number) => void
  className?: string
  practiceMode?: boolean
  /** Keeps the full theatre and playback controls, but removes recording actions. */
  readOnly?: boolean
  onComplete?: (result: {
    recordedCount: number
    totalCount: number
    recordings: Record<number, Blob>
    /** Theatre locks also guide video audio when both TTS and recording exist. */
    audioLocks?: Record<number, 'tts' | 'recording'>
  }) => void
  completionSubmitting?: boolean
  /** Persisted recording URLs used by history replay. Keys are timeline frame indexes. */
  initialRecordingUrls?: Record<number, string>
  onGenerateVideo?: () => void
  videoSubmitting?: boolean
  videoQueued?: boolean
  videoCompleted?: boolean
}

export function mixedFrameLabel(frame: MixedTimelineFrame) {
  if (frame.kind === 'choice') return '我'
  if (frame.kind === 'userInput') return '我'
  if (frame.kind === 'missingInput') return '待补充'
  return frame.speaker || '旁白'
}

export function estimateMixedFrameDuration(frame: MixedTimelineFrame) {
  if (frame.kind === 'choice') return 1000
  if (frame.kind === 'missingInput') return 0
  return Math.max(1200, Math.min(5200, frame.text.length * 80))
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function isObjectUrl(url: string | null | undefined) {
  return Boolean(url?.startsWith('blob:'))
}

function getMicStartErrorMessage(error: unknown) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return '当前页面不是安全环境，浏览器会禁止麦克风'
  }
  if (!navigator.mediaDevices?.getUserMedia) return '当前 WebView 不支持麦克风录音'
  if (typeof MediaRecorder === 'undefined') return '当前 WebView 不支持 MediaRecorder 录音'
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '无法访问麦克风，请检查权限设置'
  return '麦克风启动失败，请稍后重试'
}

export function mixedFrameDisplayText(frame: MixedTimelineFrame) {
  // 跟读剧场只走默认分支（第一个选项），不把未采用的分支暴露给学习者。
  if (frame.kind === 'choice') return frame.choices?.[0]?.text || frame.text
  return frame.text
}

function useOfflineAssetUrl(url: string | undefined, role: 'background' | 'sprite') {
  // Ink aliases (bg_*) are lookup keys, not paths — never hand them to Pixi
  // or the offline downloader (that produced /bg_xxx decode failures).
  const playableUrl = isPlayableMediaUrl(url) ? url : undefined
  const [resolvedUrl, setResolvedUrl] = useState(() => resolveDisplayAssetUrl(playableUrl))

  useEffect(() => {
    let cancelled = false
    const displayUrl = resolveDisplayAssetUrl(playableUrl)
    setResolvedUrl(displayUrl)
    if (!playableUrl || playableUrl.startsWith('blob:') || playableUrl.startsWith('data:')) return
    void assetCacheService.resolve({ url: playableUrl, role })
      .then((resolved) => {
        if (cancelled) return
        if (!resolved || resolved === OFFLINE_RESOURCE_MISSING) {
          setResolvedUrl(displayUrl)
          return
        }
        const next = resolveDisplayAssetUrl(resolved)
        setResolvedUrl(isPlayableMediaUrl(next) ? next : displayUrl)
      })
      .catch(() => {
        if (!cancelled) setResolvedUrl(displayUrl)
      })
    return () => { cancelled = true }
  }, [playableUrl, role])

  return resolvedUrl
}

export function VnMixedPreviewPlayer({
  frames,
  activeIndex,
  onJumpTo,
  className,
  practiceMode = false,
  readOnly = false,
  onComplete,
  completionSubmitting = false,
  initialRecordingUrls,
  onGenerateVideo,
  videoSubmitting = false,
  videoQueued = false,
  videoCompleted = false,
}: VnMixedPreviewPlayerProps) {
  const activeFrame = frames[activeIndex] ?? frames[0]
  // 首帧通常先设置舞台背景再出现台词；没有显式背景的帧沿用本剧本的主题背景。
  const activeBackground = useMemo(() => {
    // Frames normally inherit the background, but this also protects old
    // manifests whose first dialogue frame did not carry that inherited data.
    const currentOrPrevious = frames.slice(0, activeIndex + 1).reverse().find((frame) => frame.background.url)
    return currentOrPrevious?.background ?? frames.find((frame) => frame.background.url)?.background ?? {}
  }, [activeIndex, frames])
  const cachedBackgroundUrl = useOfflineAssetUrl(activeBackground.url, 'background')
  const cachedSpriteUrl = useOfflineAssetUrl(activeFrame?.sprite.url, 'sprite')
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [playing, setPlaying] = useState(false)
  const [gapSeconds, setGapSeconds] = useState(1)
  const [loopMode, setLoopMode] = useState<LoopMode>('1')
  const [loopIndex, setLoopIndex] = useState(1)
  const [followOpen, setFollowOpen] = useState(false)
  const [followFrame, setFollowFrame] = useState<MixedTimelineFrame | null>(null)
  const [recordingUrls, setRecordingUrls] = useState<Record<number, string>>(initialRecordingUrls ?? {})
  const [audioLocks, setAudioLocks] = useState<Record<number, FrameAudioSource>>({})
  const [playingRecordingIndex, setPlayingRecordingIndex] = useState<number | null>(null)
  const [playingTtsIndex, setPlayingTtsIndex] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsPreviewRef = useRef<HTMLAudioElement | null>(null)
  const recordingUrlsRef = useRef<Record<number, string>>({})
  const recordingBlobsRef = useRef<Record<number, Blob>>({})

  useEffect(() => {
    console.log('[repeat-vn] stage resources', {
      frameIndex: activeFrame?.index,
      backgroundSource: activeBackground.url,
      backgroundResolved: cachedBackgroundUrl,
      spriteSource: activeFrame?.sprite.url,
      spriteResolved: cachedSpriteUrl,
      portraitScale: activeFrame?.portraitScale,
    })
  }, [activeBackground.url, activeFrame?.index, activeFrame?.sprite.url, cachedBackgroundUrl, cachedSpriteUrl])

  const clearPlayback = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current = null
    }
  }, [])

  const clearRecordingPlayback = useCallback(() => {
    const audio = recordingAudioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      recordingAudioRef.current = null
    }
    setPlayingRecordingIndex(null)
  }, [])

  const clearTtsPreview = useCallback(() => {
    const audio = ttsPreviewRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      ttsPreviewRef.current = null
    }
    setPlayingTtsIndex(null)
  }, [])

  const jumpToFrame = useCallback((index: number) => {
    clearPlayback()
    clearTtsPreview()
    clearRecordingPlayback()
    onJumpTo(index)
  }, [clearPlayback, clearRecordingPlayback, clearTtsPreview, onJumpTo])

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  useEffect(() => () => {
    clearPlayback()
    clearRecordingPlayback()
    clearTtsPreview()
  }, [clearPlayback, clearRecordingPlayback, clearTtsPreview])

  useEffect(() => {
    recordingUrlsRef.current = recordingUrls
  }, [recordingUrls])

  useEffect(() => {
    if (readOnly) setRecordingUrls(initialRecordingUrls ?? {})
  }, [initialRecordingUrls, readOnly])

  useEffect(() => () => {
    Object.values(recordingUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    setPlaying(false)
    setLoopIndex(1)
    clearPlayback()
  }, [clearPlayback, frames])

  useEffect(() => {
    if (!playing || !activeFrame) return
    clearPlayback()
    if (activeFrame.kind === 'missingInput') {
      setPlaying(false)
      return
    }

    const moveNext = () => {
      const nextIndex = activeIndex + 1
      if (nextIndex < frames.length) {
        onJumpTo(nextIndex)
        return
      }

      const maxLoops = loopMode === 'infinite' ? Number.POSITIVE_INFINITY : Number(loopMode)
      if (loopIndex < maxLoops) {
        setLoopIndex((value) => value + 1)
        onJumpTo(0)
      } else {
        setPlaying(false)
        setLoopIndex(1)
      }
    }

    const scheduleNext = (baseDelay = 0) => {
      timerRef.current = window.setTimeout(moveNext, baseDelay + gapSeconds * 1000)
    }

    // Character lines prefer TTS; learner lines prefer the user's recording.
    // Per-line locks override that default for theatre playback only.
    const playbackUrl = resolveFramePlaybackUrl(activeFrame, recordingUrls, audioLocks)
    if (playbackUrl) {
      const audio = new Audio(playbackUrl)
      audioRef.current = audio
      audio.onended = () => scheduleNext()
      audio.onerror = () => scheduleNext(estimateMixedFrameDuration(activeFrame))
      audio.play().catch(() => scheduleNext(estimateMixedFrameDuration(activeFrame)))
    } else {
      scheduleNext(estimateMixedFrameDuration(activeFrame))
    }

    return () => clearPlayback()
  }, [activeFrame, activeIndex, audioLocks, clearPlayback, frames.length, gapSeconds, loopIndex, loopMode, onJumpTo, playing, recordingUrls])

  const togglePlaying = () => {
    if (playing) {
      setPlaying(false)
      clearPlayback()
    } else {
      setLoopIndex(1)
      setPlaying(true)
    }
  }

  const canFollowFrame = (frame?: MixedTimelineFrame | null) => Boolean(frame && frame.kind !== 'missingInput' && frame.text)

  const openFollow = (frame: MixedTimelineFrame) => {
    if (!canFollowFrame(frame)) return
    clearPlayback()
    clearRecordingPlayback()
    clearTtsPreview()
    setPlaying(false)
    onJumpTo(frame.index)
    setFollowFrame(frame)
    setFollowOpen(true)
  }

  const effectiveSource = (frame: MixedTimelineFrame): FrameAudioSource | null => {
    const locked = audioLocks[frame.index]
    if (locked === 'tts' && frame.audioUrl) return 'tts'
    if (locked === 'recording' && recordingUrls[frame.index]) return 'recording'
    return defaultAudioSource(frame, Boolean(recordingUrls[frame.index]))
  }

  const lockAudioSource = (frameIndex: number, source: FrameAudioSource) => {
    setAudioLocks((prev) => ({ ...prev, [frameIndex]: source }))
  }

  const playPreferredFrame = (frame: MixedTimelineFrame) => {
    const url = resolveFramePlaybackUrl(frame, recordingUrls, audioLocks)
    const source = effectiveSource(frame)
    if (!url || !source) {
      jumpToFrame(frame.index)
      return
    }
    if (source === 'recording') playRecordedFrame(frame.index, url)
    else playTtsFrame(frame.index, url)
  }

  const canFollow = canFollowFrame(activeFrame)
  // Only "我" lines are required. Character dubbing is optional bonus.
  const requiredFrames = useMemo(() => frames.filter((frame) => isRequiredFollowFrame(frame)), [frames])
  const requiredCount = requiredFrames.length
  const requiredRecordedCount = useMemo(
    () => requiredFrames.filter((frame) => Boolean(recordingUrls[frame.index])).length,
    [recordingUrls, requiredFrames],
  )
  const optionalRecordedCount = useMemo(
    () => frames.filter((frame) => !isUserMixedFrame(frame) && Boolean(recordingUrls[frame.index])).length,
    [frames, recordingUrls],
  )
  // 管理后台保留深色预览台，移动端跟读则融入用户当前主题。
  const mobileSurface = practiceMode
  const panelClass = mobileSurface
    ? 'bg-background text-foreground shadow-none'
    : 'border border-border bg-[#0b0d12] text-white shadow-sm'
  const toolbarClass = mobileSurface
    ? 'bg-muted/30'
    : 'border-white/10 bg-[#0d1118]'
  const listClass = mobileSurface
    ? 'bg-background/45'
    : 'bg-[#10131a]'

  const saveRecordingUrl = useCallback((frameIndex: number, url: string, blob: Blob) => {
    setRecordingUrls((prev) => {
      if (prev[frameIndex] && prev[frameIndex] !== url) URL.revokeObjectURL(prev[frameIndex])
      return { ...prev, [frameIndex]: url }
    })
    recordingBlobsRef.current[frameIndex] = blob
  }, [])

  const clearRecordingUrl = useCallback((frameIndex: number) => {
    setRecordingUrls((prev) => {
      if (!prev[frameIndex]) return prev
      if (isObjectUrl(prev[frameIndex])) URL.revokeObjectURL(prev[frameIndex])
      const next = { ...prev }
      delete next[frameIndex]
      return next
    })
    delete recordingBlobsRef.current[frameIndex]
    setAudioLocks((prev) => {
      if (prev[frameIndex] !== 'recording') return prev
      const next = { ...prev }
      delete next[frameIndex]
      return next
    })
    if (playingRecordingIndex === frameIndex) clearRecordingPlayback()
  }, [clearRecordingPlayback, playingRecordingIndex])

  const playRecordedFrame = (frameIndex: number, url: string) => {
    if (playingRecordingIndex === frameIndex) {
      clearRecordingPlayback()
      return
    }
    setPlaying(false)
    clearPlayback()
    clearTtsPreview()
    clearRecordingPlayback()
    onJumpTo(frameIndex)
    const audio = new Audio(url)
    recordingAudioRef.current = audio
    const clearIfCurrent = () => {
      if (recordingAudioRef.current !== audio) return
      recordingAudioRef.current = null
      setPlayingRecordingIndex(null)
    }
    audio.onplay = () => setPlayingRecordingIndex(frameIndex)
    audio.onpause = clearIfCurrent
    audio.onended = clearIfCurrent
    audio.play().catch(clearIfCurrent)
  }

  const playTtsFrame = (frameIndex: number, url: string) => {
    if (playingTtsIndex === frameIndex) {
      clearTtsPreview()
      return
    }
    setPlaying(false)
    clearPlayback()
    clearRecordingPlayback()
    clearTtsPreview()
    onJumpTo(frameIndex)
    const audio = new Audio(url)
    ttsPreviewRef.current = audio
    const clearIfCurrent = () => {
      if (ttsPreviewRef.current !== audio) return
      ttsPreviewRef.current = null
      setPlayingTtsIndex(null)
    }
    audio.onplay = () => setPlayingTtsIndex(frameIndex)
    audio.onpause = clearIfCurrent
    audio.onended = clearIfCurrent
    audio.play().catch(clearIfCurrent)
  }

  if (!activeFrame) {
    return (
      <div className={cn('mx-auto flex h-[78vh] max-h-[760px] max-w-[420px] flex-col overflow-hidden rounded-xl border-0 bg-muted/30', className)}>
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          当前脚本没有可预览台词
        </div>
      </div>
    )
  }

  return (
    <div className={cn('mx-auto flex h-[78vh] max-h-[760px] w-full max-w-[420px] flex-col overflow-hidden', mobileSurface ? 'bg-background' : 'rounded-xl border', panelClass, className)}>
      <div className={cn('relative aspect-video shrink-0 overflow-hidden', mobileSurface ? 'bg-background' : 'border-b border-white/10 bg-black')}>
        <PixiVnStage
          backgroundUrl={cachedBackgroundUrl}
          backgroundFit={activeBackground.fit || 'cover'}
          spriteUrl={activeFrame.kind === 'choice' && activeFrame.hideSpriteForChoices ? undefined : cachedSpriteUrl}
          spritePosition={activeFrame.sprite.position}
          stageVariant="mixed"
          dialogueOverlay={false}
          spriteBottomInset={8}
          spriteVerticalOffset={practiceMode ? 24 : 0}
          portraitScale={activeFrame.portraitScale}
          clearBackdrop={practiceMode}
        />
      </div>

      <div className={cn('px-2 py-1', !mobileSurface && 'border-b', toolbarClass)}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlaying}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors',
              playing
                ? 'bg-primary text-primary-foreground'
                : mobileSurface
                  ? 'bg-muted text-muted-foreground hover:bg-muted/75 hover:text-foreground'
                  : 'bg-white/8 text-white/78 hover:bg-white/12 hover:text-white',
            )}
            title={playing ? '暂停' : '播放'}
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
          </button>

          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-[11px] font-medium', mobileSurface ? 'text-muted-foreground' : 'text-white/62')}>
              {videoSubmitting
                ? '正在提交视频生成任务…'
                : videoQueued
                  ? '视频正在后台生成，完成后会自动更新'
                  : videoCompleted
                    ? '演出视频已生成并发布'
                    : playing
                ? (effectiveSource(activeFrame) === 'recording'
                  ? '用户录音结束后自动推进'
                  : effectiveSource(activeFrame) === 'tts'
                    ? 'TTS 结束后自动推进'
                    : '按文本时长自动推进')
                : `间隔 ${gapSeconds}s · ${loopMode === 'infinite' ? '无限循环' : `循环 ${loopMode} 次`}`}
            </p>
            {playing && (
              <p className={cn('mt-0.5 text-[10px]', mobileSurface ? 'text-muted-foreground/70' : 'text-white/38')}>
                {loopMode === 'infinite' ? `第 ${loopIndex} 轮` : `${loopIndex}/${loopMode}`}
              </p>
            )}
          </div>

          {!readOnly && (
            <button
              type="button"
              disabled={!canFollow}
              onClick={() => openFollow(activeFrame)}
              className={cn(
                'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                mobileSurface
                  ? 'bg-primary/10 text-primary hover:bg-primary/16'
                  : 'bg-emerald-300/12 text-emerald-100 ring-1 ring-emerald-300/22 hover:bg-emerald-300/18',
              )}
            >
              <Mic className="size-3.5" />
              跟读
            </button>
          )}

          {practiceMode && onGenerateVideo && (
            <button
              type="button"
              disabled={videoSubmitting || videoQueued || videoCompleted}
              onClick={onGenerateVideo}
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                mobileSurface
                  ? 'bg-muted text-muted-foreground hover:bg-muted/75 hover:text-foreground'
                  : 'bg-white/8 text-white/70 hover:bg-white/12 hover:text-white',
              )}
              title={videoCompleted ? '演出视频已生成并发布' : videoQueued ? '视频已提交后台生成' : videoSubmitting ? '正在提交视频任务' : '生成演出视频'}
            >
              {videoCompleted ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Film className={cn('size-4', videoSubmitting && 'animate-pulse')} />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors',
              mobileSurface
                ? 'bg-muted text-muted-foreground hover:bg-muted/75 hover:text-foreground'
                : 'bg-white/8 text-white/70 hover:bg-white/12 hover:text-white',
            )}
            title="播放设置"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-3 py-3', listClass)}>
        <div className="space-y-0.5">
          {frames.map((frame) => {
            const active = frame.index === activeIndex
            const isMissing = frame.kind === 'missingInput'
            const recordedUrl = recordingUrls[frame.index]
            const preferred = effectiveSource(frame)
            const hasTts = Boolean(frame.audioUrl)
            const hasRecording = Boolean(recordedUrl)
            const hasBothSources = hasTts && hasRecording
            const segmentBtn = (selected: boolean) => cn(
              'flex h-6 min-w-8 items-center justify-center rounded-md px-2.5 transition-colors',
              selected
                ? 'bg-primary/25 text-primary'
                : (mobileSurface ? 'text-muted-foreground hover:bg-muted hover:text-foreground' : 'text-white/34 hover:bg-white/8 hover:text-white/70'),
            )
            return (
              <div
                key={frame.index}
                ref={(node) => { itemRefs.current[frame.index] = node }}
                className={cn(
                  'w-full px-1 py-2 transition-colors',
                  active && (mobileSurface ? 'rounded-xl bg-primary/8 px-2 text-primary' : 'text-cyan-100'),
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'max-w-[40%] truncate text-base font-semibold leading-6',
                    active ? (mobileSurface ? 'text-primary' : 'text-cyan-100') : (mobileSurface ? 'text-muted-foreground' : 'text-white/42'),
                  )}>
                    {mixedFrameLabel(frame)}
                  </span>
                  {(hasTts || hasRecording) && (
                    <div
                      className={cn(
                        'flex shrink-0 items-center rounded-md p-0.5',
                        hasBothSources
                          ? (mobileSurface ? 'bg-muted' : 'bg-white/10')
                          : 'bg-transparent',
                      )}
                      role={hasBothSources ? 'group' : undefined}
                      aria-label={hasBothSources ? '音源选择' : undefined}
                    >
                      {hasTts && (
                        <button
                          type="button"
                          onClick={() => {
                            if (hasBothSources) lockAudioSource(frame.index, 'tts')
                            playTtsFrame(frame.index, frame.audioUrl!)
                          }}
                          className={segmentBtn(preferred === 'tts')}
                          title={hasBothSources ? (preferred === 'tts' ? '播放 TTS（当前选用）' : '选用并播放 TTS') : '播放 TTS'}
                        >
                          {playingTtsIndex === frame.index ? <Pause className="size-3 fill-current" /> : <Volume2 className="size-3" />}
                        </button>
                      )}
                      {hasRecording && (
                        <button
                          type="button"
                          onClick={() => {
                            if (hasBothSources) lockAudioSource(frame.index, 'recording')
                            playRecordedFrame(frame.index, recordedUrl!)
                          }}
                          className={segmentBtn(preferred === 'recording')}
                          title={hasBothSources ? (preferred === 'recording' ? '回放录音（当前选用）' : '选用并回放录音') : '回放录音'}
                        >
                          {playingRecordingIndex === frame.index ? <Pause className="size-3 fill-current" /> : <AudioLines className="size-3" />}
                        </button>
                      )}
                    </div>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      disabled={!canFollowFrame(frame)}
                      onClick={() => openFollow(frame)}
                      className={cn(
                        'ml-auto flex h-6 min-w-8 shrink-0 items-center justify-center rounded-md px-2 transition-colors',
                        canFollowFrame(frame)
                          ? mobileSurface ? 'text-muted-foreground hover:bg-primary/10 hover:text-primary' : 'text-white/34 hover:bg-white/8 hover:text-emerald-100'
                          : mobileSurface ? 'cursor-not-allowed text-muted-foreground/30' : 'cursor-not-allowed text-white/10',
                        active && canFollowFrame(frame) && (mobileSurface ? 'text-primary' : 'text-emerald-100'),
                      )}
                      title="跟读录音"
                    >
                      <Mic className="size-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => playPreferredFrame(frame)}
                  className="mt-1 w-full min-w-0 text-left"
                >
                  <span className={cn(
                    'block whitespace-pre-wrap text-sm leading-6',
                    active
                      ? (mobileSurface ? 'font-semibold text-foreground' : 'font-semibold text-cyan-50')
                      : isMissing ? (mobileSurface ? 'text-amber-700 dark:text-amber-300' : 'text-amber-100')
                        : (mobileSurface ? 'text-foreground/82' : 'text-white/70'),
                  )}>
                    {mixedFrameDisplayText(frame)}
                  </span>
                  {frame.translation && (
                    <span className={cn('mt-1 block text-[13px] leading-5', active ? (mobileSurface ? 'text-primary/70' : 'text-cyan-100/55') : (mobileSurface ? 'text-muted-foreground' : 'text-white/35'))}>{frame.translation}</span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {practiceMode && !readOnly && (
        <div className={cn('flex shrink-0 items-center gap-3 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]', !mobileSurface && 'border-t', toolbarClass)}>
          <div className="min-w-0 flex-1">
            <p className={cn('text-xs font-medium', mobileSurface ? 'text-foreground' : 'text-white/80')}>
              跟读进度 {requiredRecordedCount}/{requiredCount}
              {optionalRecordedCount > 0 ? ` · 角色加录 ${optionalRecordedCount}` : ''}
            </p>
            <div className={cn('mt-1.5 h-1 overflow-hidden rounded-full', mobileSurface ? 'bg-muted' : 'bg-white/10')}>
              <div className={cn('h-full rounded-full transition-all', mobileSurface ? 'bg-primary' : 'bg-emerald-300')} style={{ width: `${requiredCount ? (requiredRecordedCount / requiredCount) * 100 : 0}%` }} />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={completionSubmitting || requiredCount === 0 || requiredRecordedCount < requiredCount}
            onClick={() => onComplete?.({
              recordedCount: requiredRecordedCount,
              totalCount: requiredCount,
              recordings: { ...recordingBlobsRef.current },
              audioLocks: { ...audioLocks },
            })}
            className={cn('h-8 shrink-0 px-3 text-xs', mobileSurface ? '' : 'bg-emerald-300 text-slate-950 hover:bg-emerald-200')}
          >
            {completionSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            {completionSubmitting ? '正在保存演出…' : '完成演出'}
          </Button>
        </div>
      )}

      <FollowReadDrawer
        open={followOpen}
        onOpenChange={(open) => {
          setFollowOpen(open)
          if (!open) setFollowFrame(null)
        }}
        frame={followFrame}
        initialRecordingUrl={followFrame ? recordingUrls[followFrame.index] ?? null : null}
        onRecordingReady={saveRecordingUrl}
        onRecordingClear={clearRecordingUrl}
      />
      <MixedPlaybackSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        gapSeconds={gapSeconds}
        onGapSecondsChange={setGapSeconds}
        loopMode={loopMode}
        onLoopModeChange={(mode) => { setLoopMode(mode); setLoopIndex(1) }}
      />
    </div>
  )
}

export function FollowReadDrawer({
  open,
  onOpenChange,
  frame,
  initialRecordingUrl = null,
  onRecordingReady,
  onRecordingClear,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  frame: MixedTimelineFrame | null
  initialRecordingUrl?: string | null
  onRecordingReady: (frameIndex: number, url: string, blob: Blob) => void
  onRecordingClear?: (frameIndex: number) => void
}) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [playingTts, setPlayingTts] = useState(false)
  const [playingRecording, setPlayingRecording] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const nativeSessionRef = useRef<NativeVoiceInputSession | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordedUrlRef = useRef<string | null>(null)
  const ownsRecordedUrlRef = useRef(false)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null)
  const startedAtRef = useRef(0)

  const cleanupRecording = useCallback(() => {
    nativeSessionRef.current?.cancel().catch(() => undefined)
    nativeSessionRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  const cleanupAudio = useCallback(() => {
    ttsAudioRef.current?.pause()
    recordingAudioRef.current?.pause()
    ttsAudioRef.current = null
    recordingAudioRef.current = null
    setPlayingTts(false)
    setPlayingRecording(false)
  }, [])

  useEffect(() => {
    if (!open) {
      cleanupRecording()
      cleanupAudio()
      setRecording(false)
      setElapsed(0)
      setError('')
      if (ownsRecordedUrlRef.current && isObjectUrl(recordedUrlRef.current)) {
        URL.revokeObjectURL(recordedUrlRef.current)
      }
      recordedUrlRef.current = null
      ownsRecordedUrlRef.current = false
      setRecordedUrl(null)
      return
    }
    recordedUrlRef.current = initialRecordingUrl
    ownsRecordedUrlRef.current = false
    setRecordedUrl(initialRecordingUrl)
  }, [cleanupAudio, cleanupRecording, initialRecordingUrl, open])

  useEffect(() => () => {
    cleanupRecording()
    cleanupAudio()
    if (ownsRecordedUrlRef.current && isObjectUrl(recordedUrlRef.current)) {
      URL.revokeObjectURL(recordedUrlRef.current)
    }
  }, [cleanupAudio, cleanupRecording])

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200)
    return () => window.clearInterval(timer)
  }, [recording])

  const startRecording = useCallback(async () => {
    setError('')
    cleanupAudio()
    try {
      // Match the shared VN input behavior: on Capacitor this asks for the
      // native record-audio permission and uses the native recorder, instead
      // of relying on WebView MediaRecorder support.
      const nativeSession = await startBestNativeVoiceInput({
        language: 'en-US',
        useNativeSpeechRecognition: false,
      })
      if (nativeSession) {
        nativeSessionRef.current = nativeSession
        startedAtRef.current = Date.now()
        setElapsed(0)
        setRecording(true)
        console.log('[repeat-vn] native microphone recording started', { frameIndex: frame?.index })
        return
      }

      if (typeof MediaRecorder === 'undefined') {
        setError('当前浏览器不支持录音')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' })
        if (ownsRecordedUrlRef.current && isObjectUrl(recordedUrlRef.current)) URL.revokeObjectURL(recordedUrlRef.current)
        const url = URL.createObjectURL(blob)
        recordedUrlRef.current = url
        // Parent stores this URL after onRecordingReady; drawer must not revoke it.
        ownsRecordedUrlRef.current = false
        setRecordedUrl(url)
        if (frame) onRecordingReady(frame.index, url, blob)
        cleanupRecording()
      }
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setElapsed(0)
      setRecording(true)
      recorder.start(200)
      console.log('[repeat-vn] web microphone recording started', { frameIndex: frame?.index })
    } catch (error) {
      console.warn('[repeat-vn] microphone start failed', { frameIndex: frame?.index, error })
      setError(getMicStartErrorMessage(error))
    }
  }, [cleanupAudio, cleanupRecording, frame, onRecordingReady])

  const stopRecording = useCallback(async () => {
    const nativeSession = nativeSessionRef.current
    if (nativeSession) {
      nativeSessionRef.current = null
      setRecording(false)
      try {
        if (nativeSession.kind !== 'audio-recorder') {
          await nativeSession.cancel()
          throw new Error('Follow practice requires an audio recorder session')
        }
        const result = await nativeSession.stop()
        const url = result.playbackUrl || URL.createObjectURL(result.blob)
        if (ownsRecordedUrlRef.current && isObjectUrl(recordedUrlRef.current)) URL.revokeObjectURL(recordedUrlRef.current)
        recordedUrlRef.current = url
        ownsRecordedUrlRef.current = false
        setRecordedUrl(url)
        if (frame) onRecordingReady(frame.index, url, result.blob)
        console.log('[repeat-vn] native microphone recording stopped', {
          frameIndex: frame?.index,
          bytes: result.blob.size,
          playbackUrl: url,
        })
      } catch (error) {
        console.warn('[repeat-vn] native microphone stop failed', { frameIndex: frame?.index, error })
        setError('录音保存失败，请重试')
      }
      return
    }
    recorderRef.current?.stop()
    setRecording(false)
  }, [frame, onRecordingReady])

  const playTts = useCallback(() => {
    if (!frame?.audioUrl) return
    cleanupAudio()
    const audio = new Audio(frame.audioUrl)
    ttsAudioRef.current = audio
    audio.onplay = () => setPlayingTts(true)
    audio.onpause = () => setPlayingTts(false)
    audio.onended = () => setPlayingTts(false)
    audio.play().catch(() => setPlayingTts(false))
  }, [cleanupAudio, frame?.audioUrl])

  const playRecording = useCallback(() => {
    if (!recordedUrl) return
    cleanupAudio()
    const audio = new Audio(recordedUrl)
    recordingAudioRef.current = audio
    audio.onplay = () => setPlayingRecording(true)
    audio.onpause = () => setPlayingRecording(false)
    audio.onended = () => setPlayingRecording(false)
    audio.play().catch(() => setPlayingRecording(false))
  }, [cleanupAudio, recordedUrl])

  const clearRecording = useCallback(() => {
    cleanupAudio()
    // Parent owns handed-off blob URLs and revokes them in onRecordingClear.
    if (ownsRecordedUrlRef.current && isObjectUrl(recordedUrlRef.current)) URL.revokeObjectURL(recordedUrlRef.current)
    recordedUrlRef.current = null
    ownsRecordedUrlRef.current = false
    setRecordedUrl(null)
    setElapsed(0)
    if (frame) onRecordingClear?.(frame.index)
  }, [cleanupAudio, frame, onRecordingClear])

  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent showHandle={false} className="mx-auto max-h-[72dvh] w-full max-w-[520px] overflow-hidden rounded-t-[28px] border-0 bg-background px-0 pb-[calc(0.8rem+env(safe-area-inset-bottom,0px))] text-foreground drawer-surface">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <DrawerHeader className="px-4 pb-2 pt-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="text-sm font-semibold text-foreground">跟读检查</DrawerTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">{frame?.speaker || '旁白'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {recordedUrl && !recording && (
                <button
                  type="button"
                  onClick={clearRecording}
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="清空录音"
                  aria-label="清空录音"
                >
                  <Eraser className="size-3.5" />
                </button>
              )}
              <span className={cn('rounded px-2 py-1 text-[11px]', recording ? 'bg-rose-500/10 text-rose-700' : 'bg-muted text-muted-foreground')}>
                {recording ? formatElapsed(elapsed) : recordedUrl ? '已录音' : '待录音'}
              </span>
            </div>
          </div>
        </DrawerHeader>

        <div className="space-y-3 px-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm font-medium leading-6 text-foreground">{frame?.text}</p>
            {frame?.translation && <p className="mt-2 text-xs leading-5 text-muted-foreground">{frame.translation}</p>}
          </div>

          {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-1.5 border-0 shadow-none"
              disabled={!frame?.audioUrl || recording}
              onClick={playTts}
            >
              {playingTts ? <Pause className="size-3.5" /> : <Volume2 className="size-3.5" />}
              TTS
            </Button>
            <Button
              type="button"
              className={cn('h-10 gap-1.5 border-0 shadow-none', recording ? 'bg-rose-500 text-white hover:bg-rose-500/90' : '')}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? <Square className="size-3.5 fill-current" /> : <Mic className="size-3.5" />}
              {recording ? '停止' : '录音'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-1.5 border-0 shadow-none"
              disabled={!recordedUrl || recording}
              onClick={playRecording}
            >
              {playingRecording ? <Pause className="size-3.5" /> : <AudioLines className="size-3.5" />}
              回放
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
