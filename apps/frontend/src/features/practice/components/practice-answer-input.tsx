import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square, Play, Pause } from 'lucide-react'
import { cn } from '@/lib/cn'
import { transcribeRecording } from '@/lib/practice-ai-api'
import { startBestNativeVoiceInput, type NativeVoiceInputSession } from '@/lib/native/vn-voice-input'
import { usePreferencesStore } from '@/stores/preferences.store'

type VoiceStatus = 'idle' | 'recording' | 'processing'

interface PracticeAnswerInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  onEnter?: () => void
  onAudioChange?: (audioUrl: string | null) => void
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(
      (mimeType) => MediaRecorder.isTypeSupported(mimeType),
    ) ?? ''
  )
}

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function normalizeInputText(value: string) {
  return value.replace(/\r\n?/g, '\n').trim()
}

export function PracticeAnswerInput({
  value,
  onChange,
  placeholder = '输入回答...',
  disabled,
  onEnter,
  onAudioChange,
}: PracticeAnswerInputProps) {
  const nativeSpeechRecognitionEnabled = usePreferencesStore((s) => s.nativeSpeechRecognitionEnabled)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [voiceError, setVoiceError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const nativeVoiceSessionRef = useRef<NativeVoiceInputSession | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const cleanupRecording = useCallback(() => {
    nativeVoiceSessionRef.current?.cancel().catch(() => undefined)
    nativeVoiceSessionRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => {
    cleanupRecording()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [cleanupRecording])

  useEffect(() => {
    if (voiceStatus !== 'recording') return
    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 200)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [voiceStatus])

  const processAudioBlob = useCallback(async (blob: Blob, filename: string) => {
    setVoiceStatus('processing')
    try {
      const result = await transcribeRecording(blob, filename)
      const text = normalizeInputText(result.text ?? '')

      // Save audio URL for playback
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      onAudioChange?.(url)

      if (!text) {
        setVoiceError('未识别到语音内容，请重试')
        setVoiceStatus('idle')
        return
      }
      onChange(text)
      setVoiceError('')
      setVoiceStatus('idle')
    } catch {
      setVoiceError('语音识别失败，请重试')
      setVoiceStatus('idle')
    }
  }, [onChange, audioUrl, onAudioChange])

  const startRecording = useCallback(async () => {
    if (disabled || voiceStatus !== 'idle') return
    setVoiceError('')
    setElapsed(0)
    cleanupRecording()
    // Revoke old audio when starting new recording
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); onAudioChange?.(null) }
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false) }

    try {
      const nativeSession = await startBestNativeVoiceInput({
        language: 'en-US',
        useNativeSpeechRecognition: nativeSpeechRecognitionEnabled,
        onPartial: (partialText) => {
          const text = normalizeInputText(partialText)
          if (text) onChange(text)
        },
      })

      if (nativeSession) {
        nativeVoiceSessionRef.current = nativeSession
        setVoiceStatus('recording')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || mimeType || 'audio/webm' })
        await processAudioBlob(blob, `practice-answer.${ext}`)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(200)
      setVoiceStatus('recording')
    } catch {
      setVoiceError('无法访问麦克风，请检查权限设置')
      setVoiceStatus('idle')
    }
  }, [cleanupRecording, disabled, nativeSpeechRecognitionEnabled, onChange, processAudioBlob, voiceStatus])

  const stopRecording = useCallback(async () => {
    const nativeSession = nativeVoiceSessionRef.current
    if (nativeSession) {
      nativeVoiceSessionRef.current = null
      setVoiceStatus('processing')
      try {
        if (nativeSession.kind === 'speech') {
          const result = await nativeSession.stop()
          const text = normalizeInputText(result.text)
          if (text) {
            onChange(text)
            setVoiceError('')
          } else {
            setVoiceError('未识别到语音内容，请重试')
          }
          setVoiceStatus('idle')
          return
        }

        const result = await nativeSession.stop()
        await processAudioBlob(result.blob, result.filename)
      } catch {
        setVoiceError('语音识别失败，请重试')
        setVoiceStatus('idle')
      }
      return
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [onChange, processAudioBlob])

  const isRecording = voiceStatus === 'recording'
  const isProcessing = voiceStatus === 'processing'

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {})
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }, [])

  return (
    <div className={cn(
      'mx-2 rounded-lg bg-background/70 ring-1 ring-border/45 transition-colors focus-within:ring-primary/30',
      disabled && 'opacity-75',
    )}>
      <div className="flex items-end gap-1.5 p-1.5">
        <button
          type="button"
          disabled={disabled || isProcessing}
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-45',
            isRecording
              ? 'bg-rose-500 text-white'
              : voiceError
                ? 'bg-destructive/10 text-destructive'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-label={isRecording ? '停止录音' : '语音输入'}
          title={voiceError || (isRecording ? `录音中 ${formatElapsed(elapsed)}` : '语音输入')}
        >
          {isProcessing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isRecording ? (
            <Square className="size-3.5 fill-current" />
          ) : (
            <Mic className="size-4" />
          )}
        </button>
        <textarea
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isRecording ? `录音中 ${formatElapsed(elapsed)}` : isProcessing ? '识别中...' : voiceError || placeholder}
          disabled={disabled || isProcessing}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              onEnter?.()
            }
          }}
          className="block min-h-[52px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {/* Audio playback of last recording */}
      {audioUrl && voiceStatus === 'idle' && (
        <div className="flex items-center gap-2 border-t border-border/40 px-2.5 py-2">
          <button
            type="button"
            onClick={togglePlay}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            aria-label={isPlaying ? '暂停回放' : '回放录音'}
          >
            {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-0.5" />}
          </button>
          <span className="text-[11px] text-muted-foreground">录音回放</span>
          {/* biome-ignore lint/a11y/useMediaCaption: short self-recording replay */}
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            preload="auto"
          />
        </div>
      )}
    </div>
  )
}
