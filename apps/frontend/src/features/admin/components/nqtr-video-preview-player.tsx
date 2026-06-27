import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import html2canvas from 'html2canvas'
import { Film, Maximize2, Mic, Pause, Play, Settings, ArrowLeft, Clapperboard, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import {
  FollowReadDrawer,
  mixedFrameDisplayText,
  mixedFrameLabel,
  MixedPlaybackSettingsDialog,
  type LoopMode,
} from './vn-mixed-preview-player'
import { type MixedTimelineFrame } from './vn-mixed-timeline'
import { NqtrVideoComposition } from './nqtr-video-composition'
import {
  buildNqtrVideoTimeline,
  findActiveVideoFrame,
  getLoopCount,
} from './nqtr-video-timeline'

interface NqtrVideoPreviewPlayerProps {
  frames: MixedTimelineFrame[]
  activeIndex: number
  onJumpTo: (index: number) => void
  className?: string
}

function canFollowFrame(frame?: MixedTimelineFrame | null) {
  return Boolean(frame && frame.kind !== 'missingInput' && frame.text)
}

const MP4_MIME_TYPES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
]

function pickMp4MimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return MP4_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function NqtrVideoPreviewPlayer({
  frames,
  activeIndex,
  onJumpTo,
  className,
}: NqtrVideoPreviewPlayerProps) {
  const playerRef = useRef<PlayerRef>(null)
  const videoSurfaceRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null)
  const recordingUrlsRef = useRef<Record<number, string>>({})
  const loopIndexRef = useRef(1)
  const activeFrame = frames[activeIndex] ?? frames[0]
  const [playing, setPlaying] = useState(false)
  const [gapSeconds, setGapSeconds] = useState(1)
  const [loopMode, setLoopMode] = useState<LoopMode>('1')
  const [loopIndex, setLoopIndex] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [followOpen, setFollowOpen] = useState(false)
  const [followFrame, setFollowFrame] = useState<MixedTimelineFrame | null>(null)
  const [recordingUrls, setRecordingUrls] = useState<Record<number, string>>({})
  const [playingRecordingIndex, setPlayingRecordingIndex] = useState<number | null>(null)

  const timeline = useMemo(
    () => buildNqtrVideoTimeline(frames, { gapSeconds, userRecordings: recordingUrls }),
    [frames, gapSeconds, recordingUrls],
  )

  const generateWork = useCallback(async () => {
    const surface = videoSurfaceRef.current
    const player = playerRef.current
    if (!surface || !player) return

    const mimeType = pickMp4MimeType()
    if (!mimeType) {
      toast.error('当前浏览器不支持直接导出 MP4，请后续使用服务端 Remotion 导出')
      return
    }

    setIsGenerating(true)
    player.pause()
    setPlaying(false)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = timeline.width
      canvas.height = timeline.height
      const canvasCtx = canvas.getContext('2d')
      if (!canvasCtx) throw new Error('Canvas unavailable')

      const audioCtx = new AudioContext()
      const audioDestination = audioCtx.createMediaStreamDestination()
      const audioBuffers: Array<{ frame: typeof timeline.frames[number]; buffer: AudioBuffer }> = []
      const audioFrames = timeline.frames.filter((frame) => frame.resolvedAudioUrl)
      for (const frame of audioFrames) {
        if (!frame.resolvedAudioUrl) continue
        try {
          const response = await fetch(frame.resolvedAudioUrl)
          const arrayBuffer = await response.arrayBuffer()
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
          audioBuffers.push({ frame, buffer: audioBuffer })
        } catch {
          console.warn('Failed to load audio for frame', frame.index)
        }
      }

      const videoStream = canvas.captureStream(timeline.fps)
      const stream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ])
      const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      const stopped = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve()
        recorder.onerror = (event) => reject(('error' in event && event.error instanceof Error) ? event.error : new Error('MediaRecorder failed'))
      })

      recorder.start()
      const audioStartTime = audioCtx.currentTime
      for (const item of audioBuffers) {
        const source = audioCtx.createBufferSource()
        source.buffer = item.buffer
        source.connect(audioDestination)
        source.start(audioStartTime + item.frame.startSeconds)
      }
      for (let frame = 0; frame < timeline.durationInFrames; frame += 1) {
        player.seekTo(frame)
        await wait(1000 / timeline.fps)
        const snapshot = await html2canvas(surface, {
          backgroundColor: '#090b10',
          scale: 1,
          useCORS: true,
          logging: false,
        })
        canvasCtx.drawImage(snapshot, 0, 0, canvas.width, canvas.height)
      }
      recorder.stop()
      await stopped
      stream.getTracks().forEach((track) => track.stop())
      await audioCtx.close()

      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nqtr-work-${Date.now()}.mp4`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('MP4 已生成')
    } catch (err) {
      console.error('Generate work failed', err)
      toast.error('生成失败')
    } finally {
      setIsGenerating(false)
    }
  }, [timeline])

  const clearRecordingPlayback = useCallback(() => {
    const audio = recordingAudioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      recordingAudioRef.current = null
    }
    setPlayingRecordingIndex(null)
  }, [])

  const pausePlayer = useCallback(() => {
    playerRef.current?.pause()
    setPlaying(false)
  }, [])

  const seekToFrame = useCallback((index: number, autoPlay = false) => {
    const item = timeline.frames.find((frame) => frame.index === index)
    if (!item) return
    clearRecordingPlayback()
    playerRef.current?.seekTo(item.startFrame)
    onJumpTo(index)
    if (autoPlay) {
      playerRef.current?.play()
      setPlaying(true)
    }
  }, [clearRecordingPlayback, onJumpTo, timeline.frames])

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  useEffect(() => {
    recordingUrlsRef.current = recordingUrls
  }, [recordingUrls])

  useEffect(() => () => {
    clearRecordingPlayback()
    Object.values(recordingUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
  }, [clearRecordingPlayback])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const onFrameUpdate = ({ detail }: { detail: { frame: number } }) => {
      const active = findActiveVideoFrame(timeline.frames, detail.frame)
      if (!active) return
      if (active.index !== activeIndex) onJumpTo(active.index)
      if (active.kind === 'missingInput' && player.isPlaying()) player.pause()
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      const maxLoops = getLoopCount(loopMode)
      if (!maxLoops) {
        player.seekTo(0)
        player.play()
        setLoopIndex((value) => value + 1)
        loopIndexRef.current += 1
        return
      }
      if (loopIndexRef.current < maxLoops) {
        loopIndexRef.current += 1
        setLoopIndex(loopIndexRef.current)
        player.seekTo(0)
        player.play()
        return
      }
      loopIndexRef.current = 1
      setLoopIndex(1)
      setPlaying(false)
    }

    player.addEventListener('frameupdate', onFrameUpdate)
    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
    player.addEventListener('ended', onEnded)
    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate)
      player.removeEventListener('play', onPlay)
      player.removeEventListener('pause', onPause)
      player.removeEventListener('ended', onEnded)
    }
  }, [activeIndex, loopMode, onJumpTo, timeline.frames])

  useEffect(() => {
    loopIndexRef.current = 1
    setLoopIndex(1)
    playerRef.current?.seekTo(0)
    playerRef.current?.pause()
  }, [frames])

  const togglePlaying = () => {
    clearRecordingPlayback()
    const player = playerRef.current
    if (!player) return
    if (player.isPlaying()) {
      player.pause()
      setPlaying(false)
      return
    }
    loopIndexRef.current = 1
    setLoopIndex(1)
    player.play()
    setPlaying(true)
  }

  const openFollow = (frame: MixedTimelineFrame) => {
    if (!canFollowFrame(frame)) return
    pausePlayer()
    clearRecordingPlayback()
    seekToFrame(frame.index)
    setFollowFrame(frame)
    setFollowOpen(true)
  }

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
    pausePlayer()
    clearRecordingPlayback()
    seekToFrame(frameIndex)
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

  if (isExpanded) {
    return (
      <>
        <div className="relative mx-auto flex w-full flex-col overflow-hidden rounded-lg bg-black">
          <div className="relative aspect-video overflow-hidden">
            <Player
              ref={playerRef}
              component={NqtrVideoComposition}
              inputProps={{ timeline }}
              durationInFrames={timeline.durationInFrames}
              compositionWidth={timeline.width}
              compositionHeight={timeline.height}
              fps={timeline.fps}
              controls
              showVolumeControls
              showPlaybackRateControl
              initiallyShowControls={false}
              spaceKeyToPlayOrPause={false}
              loop={loopMode === 'infinite'}
              style={{ width: '100%', height: '100%' }}
              acknowledgeRemotionLicense
            />
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="absolute left-3 top-3 z-20 flex items-center gap-1 text-xs font-medium text-white/55 transition-colors hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              返回
            </button>
          </div>
        </div>
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
          onLoopModeChange={(mode) => {
            setLoopMode(mode)
            loopIndexRef.current = 1
            setLoopIndex(1)
          }}
        />
      </>
    )
  }

  return (
    <div className={cn('mx-auto flex h-[78vh] max-h-[760px] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border border-border bg-[#080b11] text-white shadow-sm', className)}>
      <div ref={videoSurfaceRef} className="relative aspect-video shrink-0 overflow-hidden border-b border-white/10 bg-black">
        <Player
          ref={playerRef}
          component={NqtrVideoComposition}
          inputProps={{ timeline }}
          durationInFrames={timeline.durationInFrames}
          compositionWidth={timeline.width}
          compositionHeight={timeline.height}
          fps={timeline.fps}
          controls={false}
          clickToPlay={false}
          loop={loopMode === 'infinite'}
          style={{ width: '100%', height: '100%' }}
          acknowledgeRemotionLicense
        />
        {/* <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md border border-white/10 bg-black/38 px-2 py-1 text-[11px] font-semibold text-white/70 backdrop-blur">
          <Film className="size-3.5" />
          Remotion
        </div> */}
      </div>

      <div className="border-b border-white/10 bg-[#0d1118] px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlaying}
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
              playing ? 'bg-cyan-300 text-slate-950' : 'bg-white/8 text-white/78 hover:bg-white/12 hover:text-white',
            )}
            title={playing ? '暂停' : '播放'}
          >
            {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
          </button>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            disabled={!canFollowFrame(activeFrame)}
            onClick={() => openFollow(activeFrame)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-emerald-300/12 px-2.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-300/22 transition-colors hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Mic className="size-3.5" />
            跟读
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/8 text-white/70 transition-colors hover:bg-white/12 hover:text-white"
            title="播放设置"
          >
            <Settings className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/8 text-white/70 transition-colors hover:bg-white/12 hover:text-white"
            title="展开横屏"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={generateWork}
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/8 text-white/70 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-40"
            title="生成作品"
          >
            {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Clapperboard className="size-3.5" />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#10131a] px-3 py-3">
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
                  active && 'text-cyan-100',
                )}
              >
                <button type="button" onClick={() => seekToFrame(frame.index)} className="min-w-0 text-left">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn('truncate text-[11px] font-semibold', active ? 'text-cyan-100' : 'text-white/42')}>
                      {mixedFrameLabel(frame)}
                    </span>
                    {recordedUrl ? (
                      <span className="shrink-0 text-[10px] text-emerald-200/70">用户录音</span>
                    ) : frame.audioUrl ? (
                      <span className="shrink-0 text-[10px] text-white/28">TTS</span>
                    ) : null}
                  </span>
                  <span className={cn(
                    'mt-1 block whitespace-pre-wrap text-sm leading-5',
                    active ? 'font-semibold text-cyan-50' : isMissing ? 'text-amber-100' : 'text-white/70',
                  )}>
                    {mixedFrameDisplayText(frame)}
                  </span>
                  {frame.translation && (
                    <span className={cn('mt-1 block text-xs leading-5', active ? 'text-cyan-100/55' : 'text-white/35')}>{frame.translation}</span>
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
                        ? 'text-white/34 hover:bg-white/8 hover:text-emerald-100'
                        : 'cursor-not-allowed text-white/10',
                      active && canFollowFrame(frame) && 'text-emerald-100',
                    )}
                    title="跟读"
                  >
                    <Mic className="size-3.5" />
                  </button>
                  {recordedUrl && (
                    <button
                      type="button"
                      onClick={() => playRecordedFrame(frame.index, recordedUrl)}
                      className="flex size-7 items-center justify-center rounded-full text-cyan-100 transition-colors hover:bg-white/8"
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
        onLoopModeChange={(mode) => {
          setLoopMode(mode)
          loopIndexRef.current = 1
          setLoopIndex(1)
        }}
      />
    </div>
  )
}
