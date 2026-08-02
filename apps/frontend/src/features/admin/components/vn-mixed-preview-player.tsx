import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Infinity, Mic, Pause, Play, RotateCcw, Settings, Square, Volume2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { PixiVnStage } from '@/features/vn-engine/pixi-vn-stage'
import { type MixedTimelineFrame } from './vn-mixed-timeline'
import { assetCacheService } from '@/lib/offline'
import { startBestNativeVoiceInput, type NativeVoiceInputSession } from '@/lib/native/vn-voice-input'

interface VnMixedPreviewPlayerProps {
  frames: MixedTimelineFrame[]
  activeIndex: number
  onJumpTo: (index: number) => void
  className?: string
  practiceMode?: boolean
  onComplete?: (result: { recordedCount: number; totalCount: number }) => void
}

export function mixedFrameLabel(frame: MixedTimelineFrame) {
  if (frame.kind === 'choice') return '我'
  if (frame.kind === 'userInput') return '我'
  if (frame.kind === 'missingInput') return '待补充'
  return frame.speaker || '旁白'
}

export type LoopMode = '1' | '2' | 'infinite'

const gapOptions = [
  { value: 0.5, label: '0.5s' },
  { value: 1, label: '1s' },
  { value: 2, label: '2s' },
  { value: 3, label: '3s' },
] as const

const loopOptions: Array<{ value: LoopMode; label: string }> = [
  { value: '1', label: '1次' },
  { value: '2', label: '2次' },
  { value: 'infinite', label: '循环' },
]

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
  const [resolvedUrl, setResolvedUrl] = useState(url)

  useEffect(() => {
    let cancelled = false
    setResolvedUrl(url)
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return
    void assetCacheService.resolve({ url, role })
      .then((resolved) => {
        if (!cancelled) setResolvedUrl(resolved)
      })
      .catch(() => {
        if (!cancelled) setResolvedUrl(url)
      })
    return () => { cancelled = true }
  }, [role, url])

  return resolvedUrl
}

export function VnMixedPreviewPlayer({
  frames,
  activeIndex,
  onJumpTo,
  className,
  practiceMode = false,
  onComplete,
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
  const missingCount = useMemo(() => frames.filter((frame) => frame.kind === 'missingInput').length, [frames])
  const [playing, setPlaying] = useState(false)
  const [gapSeconds, setGapSeconds] = useState(1)
  const [loopMode, setLoopMode] = useState<LoopMode>('1')
  const [loopIndex, setLoopIndex] = useState(1)
  const [followOpen, setFollowOpen] = useState(false)
  const [followFrame, setFollowFrame] = useState<MixedTimelineFrame | null>(null)
  const [recordingUrls, setRecordingUrls] = useState<Record<number, string>>({})
  const [playingRecordingIndex, setPlayingRecordingIndex] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null)
  const recordingUrlsRef = useRef<Record<number, string>>({})

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

  const jumpToFrame = useCallback((index: number) => {
    clearPlayback()
    onJumpTo(index)
  }, [clearPlayback, onJumpTo])

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  useEffect(() => () => {
    clearPlayback()
    clearRecordingPlayback()
  }, [clearPlayback, clearRecordingPlayback])

  useEffect(() => {
    recordingUrlsRef.current = recordingUrls
  }, [recordingUrls])

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

    if (activeFrame.audioUrl) {
      const audio = new Audio(activeFrame.audioUrl)
      audioRef.current = audio
      audio.onended = () => scheduleNext()
      audio.onerror = () => scheduleNext(estimateMixedFrameDuration(activeFrame))
      audio.play().catch(() => scheduleNext(estimateMixedFrameDuration(activeFrame)))
    } else {
      scheduleNext(estimateMixedFrameDuration(activeFrame))
    }

    return () => clearPlayback()
  }, [activeFrame, activeIndex, clearPlayback, frames.length, gapSeconds, loopIndex, loopMode, onJumpTo, playing])

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
    setPlaying(false)
    onJumpTo(frame.index)
    setFollowFrame(frame)
    setFollowOpen(true)
  }

  const canFollow = canFollowFrame(activeFrame)
  const followableCount = useMemo(() => frames.filter((frame) => canFollowFrame(frame)).length, [frames])
  const recordedCount = Object.keys(recordingUrls).length
  // 管理后台保留深色预览台，移动端跟读则融入用户当前主题。
  const mobileSurface = practiceMode
  const panelClass = mobileSurface
    ? 'border-border/60 bg-background/72 text-foreground shadow-none backdrop-blur-xl'
    : 'border-border bg-[#0b0d12] text-white shadow-sm'
  const toolbarClass = mobileSurface
    ? 'border-border/60 bg-card/80'
    : 'border-white/10 bg-[#0d1118]'
  const listClass = mobileSurface
    ? 'bg-background/45'
    : 'bg-[#10131a]'

  const saveRecordingUrl = useCallback((frameIndex: number, url: string) => {
    setRecordingUrls((prev) => {
      if (prev[frameIndex]) URL.revokeObjectURL(prev[frameIndex])
      return { ...prev, [frameIndex]: url }
    })
  }, [])

  const playRecordedFrame = (frameIndex: number, url: string) => {
    if (playingRecordingIndex === frameIndex) {
      clearRecordingPlayback()
      return
    }
    setPlaying(false)
    clearPlayback()
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

  if (!activeFrame) {
    return (
      <div className={cn('mx-auto flex h-[78vh] max-h-[760px] max-w-[420px] flex-col overflow-hidden rounded-xl border border-border bg-card', className)}>
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          当前脚本没有可预览台词
        </div>
      </div>
    )
  }

  return (
    <div className={cn('mx-auto flex h-[78vh] max-h-[760px] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border', panelClass, className)}>
      <div className="relative aspect-video shrink-0 overflow-hidden border-b border-white/10 bg-black">
        <PixiVnStage
          backgroundUrl={cachedBackgroundUrl}
          backgroundFit={activeBackground.fit || 'cover'}
          spriteUrl={activeFrame.kind === 'choice' && activeFrame.hideSpriteForChoices ? undefined : cachedSpriteUrl}
          spritePosition={activeFrame.sprite.position}
          stageVariant="mixed"
          dialogueOverlay={false}
          spriteBottomInset={8}
          portraitScale={activeFrame.portraitScale}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 via-black/34 to-transparent px-4 pb-3 pt-10">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-white/55">
                {activeFrame.speaker || mixedFrameLabel(activeFrame)}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white">{mixedFrameDisplayText(activeFrame)}</p>
            </div>
            {missingCount > 0 && (
              <span className="rounded border border-amber-300/30 bg-amber-300/12 px-2 py-1 text-[11px] text-amber-100">
                缺 {missingCount}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={cn('border-b px-2 py-1', toolbarClass)}>
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
              {playing
                ? activeFrame.audioUrl ? 'TTS 结束后自动推进' : '按文本时长自动推进'
                : `间隔 ${gapSeconds}s · ${loopMode === 'infinite' ? '无限循环' : `循环 ${loopMode} 次`}`}
            </p>
            {playing && (
              <p className={cn('mt-0.5 text-[10px]', mobileSurface ? 'text-muted-foreground/70' : 'text-white/38')}>
                {loopMode === 'infinite' ? `第 ${loopIndex} 轮` : `${loopIndex}/${loopMode}`}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!canFollow}
            onClick={() => openFollow(activeFrame)}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-35',
              mobileSurface
                ? 'bg-primary/10 text-primary ring-primary/20 hover:bg-primary/15'
                : 'bg-emerald-300/12 text-emerald-100 ring-emerald-300/22 hover:bg-emerald-300/18',
            )}
          >
            <Mic className="size-3.5" />
            跟读
          </button>

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
            return (
              <div
                key={frame.index}
                ref={(node) => { itemRefs.current[frame.index] = node }}
                className={cn(
                  'grid w-full grid-cols-[minmax(0,1fr)_32px] items-start gap-2 px-1 py-2 transition-colors',
                  active && (mobileSurface ? 'rounded-xl bg-primary/8 px-2 text-primary' : 'text-cyan-100'),
                )}
              >
                <button
                  type="button"
                  onClick={() => jumpToFrame(frame.index)}
                  className="min-w-0 text-left"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'truncate text-[11px] font-semibold',
                      active ? (mobileSurface ? 'text-primary' : 'text-cyan-100') : (mobileSurface ? 'text-muted-foreground' : 'text-white/42'),
                    )}>
                      {mixedFrameLabel(frame)}
                    </span>
                  </span>
                  <span className={cn(
                    'mt-1 block whitespace-pre-wrap text-sm leading-5',
                    active
                      ? (mobileSurface ? 'font-semibold text-foreground' : 'font-semibold text-cyan-50')
                      : isMissing ? (mobileSurface ? 'text-amber-700 dark:text-amber-300' : 'text-amber-100')
                        : (mobileSurface ? 'text-foreground/82' : 'text-white/70'),
                  )}>
                    {mixedFrameDisplayText(frame)}
                  </span>
                  {frame.translation && (
                    <span className={cn('mt-1 block text-xs leading-5', active ? (mobileSurface ? 'text-primary/70' : 'text-cyan-100/55') : (mobileSurface ? 'text-muted-foreground' : 'text-white/35'))}>{frame.translation}</span>
                  )}
                </button>
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    disabled={!canFollowFrame(frame)}
                    onClick={() => openFollow(frame)}
                    className={cn(
                      'mt-2 flex size-7 items-center justify-center rounded-full transition-colors',
                      canFollowFrame(frame)
                        ? mobileSurface ? 'text-muted-foreground hover:bg-primary/10 hover:text-primary' : 'text-white/34 hover:bg-white/8 hover:text-emerald-100'
                        : mobileSurface ? 'cursor-not-allowed text-muted-foreground/30' : 'cursor-not-allowed text-white/10',
                      active && canFollowFrame(frame) && (mobileSurface ? 'text-primary' : 'text-emerald-100'),
                    )}
                    title="跟读"
                  >
                    <Mic className="size-3.5" />
                  </button>
                  {recordedUrl && (
                    <button
                      type="button"
                      onClick={() => playRecordedFrame(frame.index, recordedUrl)}
                      className={cn('flex size-7 items-center justify-center rounded-full transition-colors', mobileSurface ? 'text-primary hover:bg-primary/10' : 'text-cyan-100 hover:bg-white/8')}
                      title="回放录音"
                    >
                      {playingRecordingIndex === frame.index ? <Pause className="size-3.5 fill-current" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {practiceMode && (
        <div className={cn('flex shrink-0 items-center gap-3 border-t px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]', toolbarClass)}>
          <div className="min-w-0 flex-1">
            <p className={cn('text-xs font-medium', mobileSurface ? 'text-foreground' : 'text-white/80')}>跟读进度 {recordedCount}/{followableCount}</p>
            <div className={cn('mt-1.5 h-1 overflow-hidden rounded-full', mobileSurface ? 'bg-muted' : 'bg-white/10')}>
              <div className={cn('h-full rounded-full transition-all', mobileSurface ? 'bg-primary' : 'bg-emerald-300')} style={{ width: `${followableCount ? (recordedCount / followableCount) * 100 : 0}%` }} />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={followableCount === 0 || recordedCount < followableCount}
            onClick={() => onComplete?.({ recordedCount, totalCount: followableCount })}
            className={cn('h-8 shrink-0 px-3 text-xs', mobileSurface ? '' : 'bg-emerald-300 text-slate-950 hover:bg-emerald-200')}
          >
            <CheckCircle2 className="size-3.5" />
            完成演出
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
        onRecordingReady={saveRecordingUrl}
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

export function MixedPlaybackSettingsDialog({
  open,
  onOpenChange,
  gapSeconds,
  onGapSecondsChange,
  loopMode,
  onLoopModeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  gapSeconds: number
  onGapSecondsChange: (value: number) => void
  loopMode: LoopMode
  onLoopModeChange: (value: LoopMode) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>播放设置</DialogTitle>
          <DialogDescription>控制逐句原声播放的间隔与循环次数。</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">句间间隔</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{gapSeconds.toFixed(1)} 秒</span>
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-0.5">
              {gapOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onGapSecondsChange(option.value)}
                  className={cn(
                    'rounded-md py-2 text-xs font-medium transition-colors',
                    gapSeconds === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">循环次数</Label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5">
              {loopOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onLoopModeChange(option.value)}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-md py-2 text-xs font-medium transition-colors',
                    loopMode === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.value === 'infinite' && <Infinity className="size-3" />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function FollowReadDrawer({
  open,
  onOpenChange,
  frame,
  onRecordingReady,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  frame: MixedTimelineFrame | null
  onRecordingReady: (frameIndex: number, url: string) => void
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
    }
  }, [cleanupAudio, cleanupRecording, open])

  useEffect(() => () => {
    cleanupRecording()
    cleanupAudio()
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
        recordedUrlRef.current = URL.createObjectURL(blob)
        setRecordedUrl(recordedUrlRef.current)
        if (frame) onRecordingReady(frame.index, recordedUrlRef.current)
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
        if (isObjectUrl(recordedUrlRef.current)) URL.revokeObjectURL(recordedUrlRef.current)
        recordedUrlRef.current = url
        setRecordedUrl(url)
        if (frame) onRecordingReady(frame.index, url)
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

  const resetRecording = useCallback(() => {
    cleanupAudio()
    if (isObjectUrl(recordedUrlRef.current)) URL.revokeObjectURL(recordedUrlRef.current)
    recordedUrlRef.current = null
    setRecordedUrl(null)
    setElapsed(0)
  }, [cleanupAudio])

  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent showHandle={false} className="mx-auto max-h-[72dvh] w-full max-w-[520px] overflow-hidden rounded-t-xl border-border bg-background px-0 pb-[calc(0.8rem+env(safe-area-inset-bottom,0px))] text-foreground">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <DrawerHeader className="px-4 pb-2 pt-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="text-sm font-semibold text-foreground">跟读检查</DrawerTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">{frame?.speaker || '旁白'}</p>
            </div>
            <span className={cn('rounded px-2 py-1 text-[11px]', recording ? 'bg-rose-500/10 text-rose-700' : 'bg-muted text-muted-foreground')}>
              {recording ? formatElapsed(elapsed) : recordedUrl ? '已录音' : '待录音'}
            </span>
          </div>
        </DrawerHeader>

        <div className="space-y-3 px-4">
          <div className="rounded-lg border border-border bg-muted/35 p-3">
            <p className="text-sm font-medium leading-6 text-foreground">{frame?.text}</p>
            {frame?.translation && <p className="mt-2 text-xs leading-5 text-muted-foreground">{frame.translation}</p>}
          </div>

          {error && <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-1.5"
              disabled={!frame?.audioUrl || recording}
              onClick={playTts}
            >
              {playingTts ? <Pause className="size-3.5" /> : <Volume2 className="size-3.5" />}
              TTS
            </Button>
            <Button
              type="button"
              className={cn('h-10 gap-1.5', recording ? 'bg-rose-500 text-white hover:bg-rose-500/90' : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200')}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? <Square className="size-3.5 fill-current" /> : <Mic className="size-3.5" />}
              {recording ? '停止' : '录音'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-1.5"
              disabled={!recordedUrl || recording}
              onClick={playRecording}
            >
              {playingRecording ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              回放
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            disabled={!recordedUrl || recording}
            onClick={resetRecording}
            className="h-9 w-full gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            重录
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
