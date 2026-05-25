import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AudioPlayer } from '@/components/common/audio-player'
import { cn } from '@/lib/cn'
import { transcribeRecording, type TranscribeRecordingResult } from '@/lib/practice-ai-api'
import type { TtsWordTimestamp } from '@/lib/tts-api'

type RecorderState =
  | { status: 'idle' }
  | { status: 'recording'; startedAt: number }
  | { status: 'processing' }
  | { status: 'done'; result: TranscribeRecordingResult; audioUrl: string }
  | { status: 'error'; message: string }

type VoiceRecorderProps = {
  onTranscribed?: (text: string) => void
  className?: string
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function VoiceRecorder({ onTranscribed, className }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>({ status: 'idle' })
  const [elapsed, setElapsed] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  // Cleanup object URL on unmount
  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Prefer formats Whisper accepts best
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || mimeType || 'audio/webm' })

        setState({ status: 'processing' })
        try {
          const result = await transcribeRecording(blob, `recording.${ext}`)

          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
          const url = URL.createObjectURL(blob)
          audioUrlRef.current = url

          setState({ status: 'done', result, audioUrl: url })
          if (result.text) onTranscribed?.(result.text)
        } catch (e: any) {
          setState({ status: 'error', message: e?.message || '上传失败' })
        }
      }

      mediaRecorderRef.current = mr
      mr.start(200)

      const startedAt = Date.now()
      setState({ status: 'recording', startedAt })
      setElapsed(0)
      timerRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAt)
      }, 200)
    } catch (e: any) {
      setState({ status: 'error', message: '无法访问麦克风：' + (e?.message || '权限被拒绝') })
    }
  }, [onTranscribed])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }, [])

  const reset = useCallback(() => {
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null }
    setState({ status: 'idle' })
    setElapsed(0)
  }, [])

  return (
    <div className={cn('space-y-3', className)}>
      {/* Controls */}
      <div className="flex items-center gap-3">
        {state.status === 'idle' && (
          <Button onClick={startRecording} className="gap-2">
            <Mic className="size-4" />
            开始录音
          </Button>
        )}

        {state.status === 'recording' && (
          <>
            <Button variant="destructive" onClick={stopRecording} className="gap-2">
              <Square className="size-4" />
              停止录音
            </Button>
            <div className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />
              <span className="tabular-nums text-sm text-muted-foreground">{fmt(elapsed)}</span>
            </div>
          </>
        )}

        {state.status === 'processing' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在转写录音…
          </div>
        )}

        {(state.status === 'done' || state.status === 'error') && (
          <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
            <Mic className="size-3.5" />
            重新录音
          </Button>
        )}
      </div>

      {state.status === 'error' && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.message}
        </div>
      )}

      {state.status === 'done' && (
        <div className="space-y-3">
          {/* Transcription */}
          {state.result.text ? (
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                转写文本
              </p>
              <p className="text-sm leading-relaxed">{state.result.text}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
              未配置 Whisper 转写服务，仅提供录音回放。
            </div>
          )}

          {/* Audio playback with waveform */}
          <AudioPlayer
            audioUrl={state.audioUrl}
            wordTimestamps={state.result.wordTimestamps as TtsWordTimestamp[] | null}
            audioProvider={null}
          />
        </div>
      )}
    </div>
  )
}
