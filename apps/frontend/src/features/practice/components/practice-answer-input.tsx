import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Mic, Square, Play, Pause } from 'lucide-react'
import { cn } from '@/lib/cn'
import { transcribeVoiceInput } from '@/lib/local-stt/local-stt.service'
import { startBestNativeVoiceInput, type NativeVoiceInputSession } from '@/lib/native/vn-voice-input'
import { usePreferencesStore } from '@/stores/preferences.store'
import {
  getVoiceInputFeedbackText,
  getVoiceMicErrorMessage,
  normalizeVoiceInputText,
  pickVoiceRecordingMimeType,
  type VoiceInputStatus,
} from '@/lib/voice-input-feedback'

interface PracticeAnswerInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  onEnter?: () => void
  onAudioChange?: (audioUrl: string | null) => void
  /** Restores playback when moving between questions or opening a review. */
  recordedAudioUrl?: string | null
  /** Removes the record action while keeping the answer and playback visible. */
  readOnly?: boolean
  /** 语音识别语言，默认 en-US；中文输入时传 zh-CN */
  lang?: string
}

export function PracticeAnswerInput({
  value,
  onChange,
  placeholder = '输入回答…',
  disabled,
  onEnter,
  onAudioChange,
  recordedAudioUrl,
  readOnly = false,
  lang = 'en-US',
}: PracticeAnswerInputProps) {
  const { t } = useTranslation()
  const nativeSpeechRecognitionEnabled = usePreferencesStore((s) => s.nativeSpeechRecognitionEnabled)
  const localSttEnabled = usePreferencesStore((s) => s.localSttEnabled)
  const [voiceStatus, setVoiceStatus] = useState<VoiceInputStatus>('idle')
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
  const audioUrlRef = useRef<string | null>(null)
  const playbackUrl = recordedAudioUrl === undefined ? audioUrl : recordedAudioUrl

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
    if (!onAudioChange && audioUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(audioUrlRef.current)
  }, [cleanupRecording, onAudioChange])

  const setRecordedAudioUrl = useCallback((nextUrl: string | null) => {
    const previousUrl = audioUrlRef.current
    if (!onAudioChange && previousUrl?.startsWith('blob:') && previousUrl !== nextUrl) URL.revokeObjectURL(previousUrl)
    audioUrlRef.current = nextUrl
    setAudioUrl(nextUrl)
    onAudioChange?.(nextUrl)
  }, [onAudioChange])

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
      const result = await transcribeVoiceInput(blob, filename, lang)
      const text = normalizeVoiceInputText(result.text ?? '')

      // Prefer the uploaded URL so playback survives question changes.
      const fallbackUrl = URL.createObjectURL(blob)
      const nextAudioUrl = result.audioUrl ?? fallbackUrl
      if (nextAudioUrl !== fallbackUrl) URL.revokeObjectURL(fallbackUrl)
      setRecordedAudioUrl(nextAudioUrl)

      if (!text) {
        setVoiceError(t('profile.placement.voiceNoContent'))
        setVoiceStatus('idle')
        return
      }
      onChange(text)
      setVoiceError('')
      setVoiceStatus('idle')
    } catch {
      setVoiceError(t('profile.placement.voiceFailed'))
      setVoiceStatus('idle')
    }
  }, [lang, onChange, setRecordedAudioUrl, t])

  const startRecording = useCallback(async () => {
    if (disabled || voiceStatus !== 'idle') return
    setVoiceError('')
    setElapsed(0)
    cleanupRecording()
    // Revoke old audio when starting new recording
    if (audioUrlRef.current) setRecordedAudioUrl(null)
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false) }

    try {
      const nativeSession = await startBestNativeVoiceInput({
        language: lang,
        useNativeSpeechRecognition: nativeSpeechRecognitionEnabled && !localSttEnabled,
        onPartial: (partialText) => {
          const text = normalizeVoiceInputText(partialText)
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
      const mimeType = pickVoiceRecordingMimeType()
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
    } catch (error) {
      setVoiceError(getVoiceMicErrorMessage(error, t))
      setVoiceStatus('idle')
    }
  }, [cleanupRecording, disabled, lang, localSttEnabled, nativeSpeechRecognitionEnabled, onChange, processAudioBlob, setRecordedAudioUrl, t, voiceStatus])

  const stopRecording = useCallback(async () => {
    const nativeSession = nativeVoiceSessionRef.current
    if (nativeSession) {
      nativeVoiceSessionRef.current = null
      setVoiceStatus('processing')
      try {
        if (nativeSession.kind === 'speech') {
          const result = await nativeSession.stop()
          const text = normalizeVoiceInputText(result.text)
          if (text) {
            onChange(text)
            setVoiceError('')
          } else {
            setVoiceError(t('profile.placement.voiceNoContent'))
          }
          setVoiceStatus('idle')
          return
        }

        const result = await nativeSession.stop()
        await processAudioBlob(result.blob, result.filename)
      } catch {
        setVoiceError(t('profile.placement.voiceFailed'))
        setVoiceStatus('idle')
      }
      return
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [onChange, processAudioBlob, t])

  const isRecording = voiceStatus === 'recording'
  const isProcessing = voiceStatus === 'processing'
  const voiceFeedbackText = getVoiceInputFeedbackText({
    t,
    status: voiceStatus,
    elapsed,
    error: voiceError,
    idleText: placeholder,
  })

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
      'mx-1 rounded-xl bg-background/70 ring-1 ring-border/45 transition-colors focus-within:ring-primary/30',
      disabled && !readOnly && 'opacity-75',
    )}>
      <div className="flex items-end gap-2 p-1.5">
        {!readOnly && <button
          type="button"
          disabled={disabled || isProcessing}
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45',
            isRecording
              ? 'bg-rose-500 text-white'
              : voiceError
                ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/25'
                : 'bg-muted/75 text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-label={isRecording ? t('profile.placement.voiceStop') : t('profile.placement.voiceButton')}
          title={voiceStatus === 'idle' && !voiceError ? t('profile.placement.voiceIdle') : voiceFeedbackText}
        >
          {isProcessing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : isRecording ? (
            <Square className="size-5 fill-current" />
          ) : (
            <Mic className="size-5" />
          )}
        </button>}
        <textarea
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={voiceFeedbackText}
          aria-label={placeholder}
          disabled={disabled || isProcessing}
          readOnly={readOnly}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              onEnter?.()
            }
          }}
          className="block min-h-[52px] min-w-0 flex-1 resize-none bg-transparent py-2 pl-0 pr-1 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        {playbackUrl && voiceStatus === 'idle' && (
          <button
            type="button"
            onClick={togglePlay}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
            aria-label={isPlaying ? t('vnSettings.pausePlayback') : t('vnSettings.playbackRecording')}
            title={isPlaying ? t('vnSettings.pausePlayback') : t('vnSettings.playbackRecording')}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
          </button>
        )}
      </div>

      {(voiceStatus !== 'idle' || voiceError) && (
        <p
          aria-live="polite"
          className={cn('break-words px-3 pb-2 text-xs leading-4 text-muted-foreground', voiceError && 'text-destructive')}
        >
          {voiceFeedbackText}
        </p>
      )}

      {playbackUrl && voiceStatus === 'idle' && (
        // biome-ignore lint/a11y/useMediaCaption: short self-recording replay
        <audio
          ref={audioRef}
          src={playbackUrl}
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          preload="auto"
          className="hidden"
        />
      )}
    </div>
  )
}
