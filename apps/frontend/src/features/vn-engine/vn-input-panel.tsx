import { useCallback, useEffect, useRef, useState } from 'react'
import { FileAudio, Keyboard, Loader2, Mic, Pause, Play, Send, Square } from 'lucide-react'
import { cn } from '@/lib/cn'
import { transcribeRecording } from '@/lib/practice-ai-api'

const TEXTAREA_MIN_HEIGHT = 36
const TEXTAREA_MAX_HEIGHT = 108

// ── 录音编码格式 ──
function pickMimeType() {
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(
      (m) => MediaRecorder.isTypeSupported(m),
    ) ?? ''
  )
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── 类型 ──
type InputMode = 'voice' | 'text'
type VoiceStatus = 'idle' | 'recording' | 'processing' | 'done'

interface VnInputPanelProps {
  disabled?: boolean
  placeholder?: string
  onSubmit: (text: string, audioUrl?: string) => void | Promise<void>
  variant?: 'default' | 'embedded'
}

export function VnInputPanel({
  disabled,
  placeholder = '输入文字...',
  onSubmit,
  variant = 'default',
}: VnInputPanelProps) {
  // ── 模式 ──
  const [mode, setMode] = useState<InputMode>('voice')

  // ── 文字模式 ──
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isMultiline, setIsMultiline] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // ── 语音模式 ──
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [transcribedText, setTranscribedText] = useState('')
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  // ── 录音 Refs ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const localAudioUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isDisabled = disabled || submitting

  // ── 清理录音资源 ──
  const cleanupRecording = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (localAudioUrlRef.current) {
      URL.revokeObjectURL(localAudioUrlRef.current)
      localAudioUrlRef.current = null
    }
  }, [])

  // 卸载清理
  useEffect(() => () => cleanupRecording(), [cleanupRecording])

  // ── 录音计时 ──
  useEffect(() => {
    if (voiceStatus !== 'recording') return
    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 200)
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
  }, [voiceStatus])

  // ── 回放状态监听 ──
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [recordedAudioUrl])

  // ── 开始录音 ──
  const startRecording = useCallback(async () => {
    setVoiceError(null)
    setElapsed(0)
    setText('')
    cleanupRecording()
    setIsPlaying(false)
    setRecordedAudioUrl(null)
    setTranscribedText('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || mimeType || 'audio/webm' })

        // 保存本地 blob URL 供回放
        if (localAudioUrlRef.current) URL.revokeObjectURL(localAudioUrlRef.current)
        localAudioUrlRef.current = URL.createObjectURL(blob)

        // 转写
        setVoiceStatus('processing')
        try {
          const result = await transcribeRecording(blob, `recording.${ext}`)
          const transcribed = result.text?.trim()
          if (transcribed) {
            setTranscribedText(transcribed)
            setText(transcribed)
            // 优先用服务端返回的 audioUrl，其次用本地 blob
            setRecordedAudioUrl(result.audioUrl ?? localAudioUrlRef.current)
            setVoiceStatus('done')
          } else {
            setVoiceError('未识别到语音内容，请重试')
            setVoiceStatus('idle')
          }
        } catch {
          setVoiceError('语音识别失败，请重试')
          setVoiceStatus('idle')
        }
      }

      mediaRecorderRef.current = mr
      mr.start(200)
      setVoiceStatus('recording')
    } catch {
      setVoiceError('无法访问麦克风，请检查权限设置')
    }
  }, [cleanupRecording])

  // ── 停止录音 ──
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [])

  // ── 重置语音状态 ──
  const resetVoice = useCallback(() => {
    cleanupRecording()
    setVoiceStatus('idle')
    setTranscribedText('')
    setRecordedAudioUrl(null)
    setVoiceError(null)
    setElapsed(0)
    setIsPlaying(false)
  }, [cleanupRecording])

  // ── 提交 ──
  const submit = useCallback(async (submitText?: string) => {
    const finalText = (submitText ?? text).trim()
    if (!finalText || isDisabled) return
    setSubmitting(true)
    try {
      await onSubmit(finalText, recordedAudioUrl ?? undefined)
      setText('')
      setTranscribedText('')
      setRecordedAudioUrl(null)
      setVoiceStatus('idle')
      setVoiceError(null)
    } finally {
      setSubmitting(false)
    }
  }, [text, isDisabled, onSubmit, recordedAudioUrl])

  // ── 回放 ──
  const togglePlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(() => setIsPlaying(false))
    }
  }, [isPlaying])

  // ── 文字区域自适应高度（rAF 节流，避免每次按键都触发同步布局计算）──
  const heightRafRef = useRef<number | null>(null)
  useEffect(() => {
    if (heightRafRef.current !== null) return // 已有待处理的 rAF
    heightRafRef.current = window.requestAnimationFrame(() => {
      heightRafRef.current = null
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.style.height = `${TEXTAREA_MIN_HEIGHT}px`
      const nextHeight = Math.min(Math.max(textarea.scrollHeight, TEXTAREA_MIN_HEIGHT), TEXTAREA_MAX_HEIGHT)
      textarea.style.height = `${nextHeight}px`
      textarea.style.overflowY = textarea.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden'
      setIsMultiline(nextHeight > TEXTAREA_MIN_HEIGHT)
    })
    return () => {
      if (heightRafRef.current !== null) {
        window.cancelAnimationFrame(heightRafRef.current)
        heightRafRef.current = null
      }
    }
  }, [text])

  // ── 点击开始录音 ──
  const handleStartRecording = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDisabled || voiceStatus !== 'idle') return
    startRecording()
  }, [isDisabled, voiceStatus, startRecording])

  // ── 点击停止录音 ──
  const handleStopRecording = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (voiceStatus === 'recording') {
      stopRecording()
    }
  }, [voiceStatus, stopRecording])

  // ── 上传音频文件测试 STT（临时，回头删） ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setVoiceError(null)
    setIsPlaying(false)
    setText('')
    cleanupRecording()
    setRecordedAudioUrl(null)
    setTranscribedText('')

    // 保存本地 blob 供回放
    if (localAudioUrlRef.current) URL.revokeObjectURL(localAudioUrlRef.current)
    localAudioUrlRef.current = URL.createObjectURL(file)

    setVoiceStatus('processing')
    try {
      const result = await transcribeRecording(file, file.name)
      const transcribed = result.text?.trim()
      if (transcribed) {
        setTranscribedText(transcribed)
        setText(transcribed)
        setRecordedAudioUrl(result.audioUrl ?? localAudioUrlRef.current)
        setVoiceStatus('done')
      } else {
        setVoiceError('未识别到语音内容')
        setVoiceStatus('idle')
      }
    } catch {
      setVoiceError('语音识别失败')
      setVoiceStatus('idle')
    }

    // 重置 input 以允许重复选同一个文件
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [cleanupRecording])

  // ── 切换模式时重置语音 ──
  const switchToText = useCallback(() => {
    if (voiceStatus === 'recording') stopRecording()
    resetVoice()
    setMode('text')
  }, [voiceStatus, stopRecording, resetVoice])

  const switchToVoice = useCallback(() => {
    setText('')
    setMode('voice')
    resetVoice()
  }, [resetVoice])

  // ── 渲染 ──
  const showTextMode = mode === 'text'
  const recording = voiceStatus === 'recording'
  const processing = voiceStatus === 'processing'
  const voiceDone = voiceStatus === 'done'

  return (
    <div className={cn(
      variant === 'default' && 'border-t border-border/45 bg-background/55 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2.5 backdrop-blur-xl',
      variant === 'embedded' && 'rounded-lg bg-muted/45 p-1 transition-colors focus-within:bg-muted/60 focus-within:ring-1 focus-within:ring-primary/25',
    )}>
      {/* 隐藏的回放 audio 元素 */}
      <audio ref={audioRef} src={recordedAudioUrl ?? undefined} preload="auto" className="hidden" />

      <div className={cn(
        'flex',
        isMultiline && (showTextMode || voiceDone) ? 'min-h-10 items-end' : 'h-10 items-center',
        variant === 'default' ? 'gap-2' : 'gap-1',
      )}>
        {/* ═══════ 语音模式 ═══════ */}
        {!showTextMode && (
          <>
            {/* 空闲：点击录音按钮 */}
            {voiceStatus === 'idle' && (
              <>
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => { e.stopPropagation(); switchToText() }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  aria-label="切换到文字输入"
                >
                  <Keyboard className="size-4" />
                </button>

                {/* 测试：上传音频文件 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  aria-label="上传音频测试"
                  title="上传音频测试 STT（临时）"
                >
                  <FileAudio className="size-4" />
                </button>

                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={handleStartRecording}
                  className={cn(
                    'flex flex-1 h-full items-center justify-center gap-2 rounded-lg select-none transition-all active:scale-[0.97]',
                    voiceError
                      ? 'bg-destructive/10 ring-1 ring-destructive/30 text-destructive'
                      : 'bg-muted/70 ring-1 ring-border/45 text-muted-foreground hover:bg-muted hover:text-foreground',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Mic className="size-4" />
                  <span className="text-sm font-medium">
                    {voiceError || '点击录音'}
                  </span>
                </button>
              </>
            )}

            {/* 录音中 */}
            {recording && (
              <>
                <button
                  type="button"
                  disabled
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground/30"
                >
                  <Keyboard className="size-4" />
                </button>
                <div
                  className={cn(
                    'flex flex-1 h-full items-center justify-between gap-2 rounded-lg px-3 select-none',
                    'bg-rose-50 dark:bg-rose-950/25 ring-1 ring-rose-200 dark:ring-rose-800/40',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatElapsed(elapsed)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white transition-transform active:scale-90"
                    aria-label="停止录音"
                  >
                    <Square className="size-3.5 fill-current" />
                  </button>
                </div>
              </>
            )}

            {/* 识别中 */}
            {processing && (
              <>
                <button
                  type="button"
                  disabled
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground/30"
                >
                  <Keyboard className="size-4" />
                </button>
                <div className="flex flex-1 h-full items-center justify-center gap-2 rounded-lg bg-muted/70 ring-1 ring-border/45">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">识别中…</span>
                </div>
              </>
            )}

            {/* 识别完成：复用 textarea 支持多行 + 重录 + 发送 */}
            {voiceDone && (
              <>
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => { e.stopPropagation(); switchToText() }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  aria-label="切换到文字输入"
                >
                  <Keyboard className="size-4" />
                </button>

                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => { e.stopPropagation(); startRecording() }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  aria-label="重新录音"
                >
                  <Mic className="size-4" />
                </button>

                <div className={cn(
                  'flex min-w-0 flex-1 items-end rounded-lg',
                  variant === 'default' ? 'gap-2 px-3' : 'px-1.5',
                  variant === 'default' && 'bg-muted/70 ring-1 ring-border/45',
                )}>
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    style={{ height: TEXTAREA_MIN_HEIGHT }}
                    value={text}
                    disabled={isDisabled}
                    placeholder="识别结果…"
                    onChange={(event) => setText(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault()
                        submit()
                      }
                    }}
                    className="box-border block h-9 max-h-[108px] min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-1.5 text-base font-medium leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                  />
                </div>

                {/* <button
                  type="button"
                  disabled={!recordedAudioUrl}
                  onClick={(e) => { e.stopPropagation(); togglePlayback() }}
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    isPlaying
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    !recordedAudioUrl && 'opacity-30',
                  )}
                  aria-label={isPlaying ? '暂停回放' : '回放录音'}
                >
                  {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button> */}
                <button
                  type="button"
                  disabled={isDisabled || !text.trim()}
                  onClick={(e) => { e.stopPropagation(); submit() }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/85 active:scale-95 disabled:bg-muted disabled:text-muted-foreground/50"
                  aria-label="发送"
                >
                  <Send className="size-4" />
                </button>
              </>
            )}
          </>
        )}

        {/* ═══════ 文字模式 ═══════ */}
        {showTextMode && (
          <>
            <button
              type="button"
              disabled={isDisabled}
              onClick={(e) => { e.stopPropagation(); switchToVoice() }}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label="切换到语音输入"
            >
              <Mic className="size-4" />
            </button>

            <div className={cn(
              'flex min-w-0 flex-1 items-end rounded-lg',
              variant === 'default' ? 'gap-2 px-3' : 'px-1.5',
              variant === 'default' && 'bg-muted/70 ring-1 ring-border/45',
            )}>
              <textarea
                ref={textareaRef}
                rows={1}
                style={{ height: TEXTAREA_MIN_HEIGHT }}
                value={text}
                disabled={isDisabled}
                placeholder={placeholder}
                onChange={(event) => setText(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    submit()
                  }
                }}
                className="box-border block h-9 max-h-[108px] min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-1.5 text-base font-medium leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="button"
              disabled={isDisabled || !text.trim()}
              onClick={(e) => { e.stopPropagation(); submit() }}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/85 active:scale-95 disabled:bg-muted disabled:text-muted-foreground/50"
              aria-label="发送"
            >
              <Send className="size-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
