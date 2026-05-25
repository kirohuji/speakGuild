import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import WavesurferPlayer from '@wavesurfer/react'
import type WaveSurfer from 'wavesurfer.js'
import { cn } from '@/lib/cn'

export type AudioWaveformHandle = {
  syncProgress: (timeSeconds: number) => void
}

type AudioWaveformProps = {
  audioUrl: string
  /** 主播放器时长（秒），WaveSurfer 尚未 ready 时用于估算进度比例 */
  durationSeconds: number
  onSeek: (timeSeconds: number) => void
  /** WaveSurfer 解码完成时触发，可补全 duration */
  onReady?: (durationSeconds: number) => void
  className?: string
}

export const AudioWaveform = forwardRef<AudioWaveformHandle, AudioWaveformProps>(
  ({ audioUrl, durationSeconds, onSeek, onReady, className }, ref) => {
    const waveSurferRef = useRef<WaveSurfer | null>(null)
    const syncingRef = useRef(false)
    const onSeekRef = useRef(onSeek)
    const onReadyRef = useRef(onReady)

    useEffect(() => { onSeekRef.current = onSeek }, [onSeek])
    useEffect(() => { onReadyRef.current = onReady }, [onReady])

    useEffect(() => {
      waveSurferRef.current = null
    }, [audioUrl])

    useImperativeHandle(ref, () => ({
      syncProgress(timeSeconds: number) {
        const ws = waveSurferRef.current
        const dur = ws?.getDuration?.() ?? durationSeconds
        if (!ws || !dur) return
        syncingRef.current = true
        ws.seekTo(Math.max(0, Math.min(1, timeSeconds / dur)))
        window.setTimeout(() => { syncingRef.current = false }, 0)
      },
    }), [durationSeconds])

    const shellCn = cn(
      'min-h-[52px] w-full overflow-hidden rounded-xl bg-muted/30',
      className,
    )

    if (!audioUrl) return <div className={shellCn} />

    return (
      <div className={shellCn}>
        <WavesurferPlayer
          url={audioUrl}
          waveColor="hsl(var(--muted-foreground) / 0.25)"
          progressColor="hsl(var(--primary))"
          cursorColor="hsl(var(--primary))"
          cursorWidth={2}
          height={52}
          barWidth={2}
          barGap={2}
          barRadius={4}
          normalize
          interact
          dragToSeek
          onReady={(ws, dur) => {
            waveSurferRef.current = ws
            const d = dur > 0 ? dur : ws.getDuration?.() ?? 0
            if (d > 0) onReadyRef.current?.(d)
          }}
          onDestroy={(ws) => {
            if (waveSurferRef.current === ws) waveSurferRef.current = null
          }}
          onInteraction={(_ws, newTime) => {
            if (syncingRef.current) return
            onSeekRef.current(newTime)
          }}
        />
      </div>
    )
  },
)

AudioWaveform.displayName = 'AudioWaveform'
