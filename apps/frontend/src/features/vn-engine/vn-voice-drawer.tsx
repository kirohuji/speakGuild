import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { FileAudio, Loader2, Mic, Pause, Play, Send, Square } from 'lucide-react'
import { cn } from '@/lib/cn'
import { transcribeVoiceInput } from '@/lib/local-stt/local-stt.service'

// ---------------------------------------------------------------------------
// 音波可视化条（纯 CSS 动画，录音时激活）
// ---------------------------------------------------------------------------
function WaveformBars({ active }: { active: boolean }) {
  const barCount = 24
  return (
    <div className="flex h-8 items-center justify-center gap-[2px] px-2">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-[2.5px] rounded-full transition-all duration-150',
            active ? 'bg-primary/45' : 'bg-foreground/20',
            active ? 'animate-waveform' : 'h-1',
          )}
          style={{
            animationDelay: active ? `${(i * 0.06).toFixed(2)}s` : '0s',
            height: active ? undefined : '4px',
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 优先选择编码格式
// ---------------------------------------------------------------------------
function pickMimeType() {
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(
      (m) => MediaRecorder.isTypeSupported(m),
    ) ?? ''
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface VnVoiceDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (text: string, audioUrl?: string) => void
}

type VoiceState =
  | { status: 'idle' }
  | { status: 'recording'; startedAt: number }
  | { status: 'processing' }
  | { status: 'done'; text: string }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function VnVoiceDrawer({ open, onOpenChange, onConfirm }: VnVoiceDrawerProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>({ status: 'idle' })
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasRecording, setHasRecording] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const lastAudioUrlRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeTypeRef = useRef('')

  // ---- 清理 ----
  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (lastAudioUrlRef.current) {
      URL.revokeObjectURL(lastAudioUrlRef.current)
      lastAudioUrlRef.current = null
    }
  }, [])

  // Drawer 关闭时重置状态
  useEffect(() => {
    if (!open) {
      cleanup()
      setVoiceState({ status: 'idle' })
      setLastAudioUrl(null)
      setError(null)
      setElapsed(0)
      setIsPlaying(false)
      setHasRecording(false)
    }
  }, [open, cleanup])

  // 卸载清理
  useEffect(() => () => cleanup(), [cleanup])

  // ---- 计时器 ----
  useEffect(() => {
    if (voiceState.status === 'recording') {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - (voiceState as any).startedAt)
      }, 200)
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
  }, [voiceState.status])

  // ---- 播放状态监听 ----
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
  }, [hasRecording])

  // ---- 录音 ----
  const startRecording = useCallback(async () => {
    setError(null)
    setElapsed(0)
    cleanup()
    setHasRecording(false)
    setIsPlaying(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = pickMimeType()
      mimeTypeRef.current = mimeType
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

        // 保存供回放
        if (lastAudioUrlRef.current) URL.revokeObjectURL(lastAudioUrlRef.current)
        lastAudioUrlRef.current = URL.createObjectURL(blob)
        setHasRecording(true)

        // 转写
        setVoiceState({ status: 'processing' })
        try {
          const result = await transcribeVoiceInput(blob, `recording.${ext}`)
          const transcribed = result.text?.trim()
          if (transcribed) {
            setLastAudioUrl(result.audioUrl ?? null)
            setVoiceState({ status: 'done', text: transcribed })
          } else {
            setError('未识别到语音内容，请重试')
            setVoiceState({ status: 'idle' })
          }
        } catch {
          setError('语音识别失败，请重试')
          setVoiceState({ status: 'idle' })
        }
      }

      mediaRecorderRef.current = mr
      mr.start(200)
      setVoiceState({ status: 'recording', startedAt: Date.now() })
    } catch {
      setError('无法访问麦克风，请检查权限设置')
    }
  }, [cleanup])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }, [])

  // ---- 回放 ----
  const togglePlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(() => setIsPlaying(false))
    }
  }, [isPlaying])

  // ---- 测试：上传音频文件测试 STT ----
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setHasRecording(false)
    setIsPlaying(false)
    cleanup()

    // 保存供回放
    if (lastAudioUrlRef.current) URL.revokeObjectURL(lastAudioUrlRef.current)
    lastAudioUrlRef.current = URL.createObjectURL(file)
    setHasRecording(true)

    setVoiceState({ status: 'processing' })
    try {
      const result = await transcribeVoiceInput(file, file.name)
      const transcribed = result.text?.trim()
      if (transcribed) {
        setLastAudioUrl(result.audioUrl ?? null)
        setVoiceState({ status: 'done', text: transcribed })
      } else {
        setError('未识别到语音内容')
        setVoiceState({ status: 'idle' })
      }
    } catch {
      setError('语音识别失败')
      setVoiceState({ status: 'idle' })
    }

    // 重置 input 以允许重复选同一个文件
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [cleanup])

  // ---- 确认使用 ----
  const confirmText = () => {
    if (voiceState.status === 'done' && voiceState.text) {
      onConfirm(voiceState.text, lastAudioUrl ?? undefined)
      onOpenChange(false)
    }
  }

  // ---- 格式化时间 ----
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const isRecording = voiceState.status === 'recording'
  const isProcessing = voiceState.status === 'processing'
  const isDone = voiceState.status === 'done'

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        showHandle={false}
        className="mx-auto max-h-[42dvh] w-full max-w-[520px] overflow-hidden rounded-t-[10px] border-x-0 border-b-0 border-t border-border/55 !bg-background/90 px-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-foreground shadow-[0_-18px_56px_rgba(15,23,42,.18)] ![background-image:none] backdrop-blur-2xl"
      >
        {/* 隐藏音频元素 */}
        <audio ref={audioRef} src={lastAudioUrlRef.current ?? undefined} preload="auto" />
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-foreground/20" />

        <DrawerHeader className="px-4 pb-2 pt-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DrawerTitle className="text-sm font-semibold tracking-normal">语音输入</DrawerTitle>
              <p className="sr-only">
                {isRecording ? '正在收音，讲完后点停止' : isDone ? '检查识别内容后发送' : '录音后自动转写成文字'}
              </p>
            </div>
            <div className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-muted-foreground',
              isRecording && 'text-rose-600',
              isProcessing && 'text-primary',
              isDone && 'text-primary',
            )}>
              <span className={cn(
                'size-1.5 rounded-full',
                isRecording ? 'animate-pulse bg-rose-500' : isProcessing ? 'bg-primary' : isDone ? 'bg-emerald-500' : 'bg-muted-foreground/50',
              )} />
              {isRecording ? fmt(elapsed) : isProcessing ? '识别中' : isDone ? '已识别' : '待录音'}
            </div>
          </div>
        </DrawerHeader>

        <div className="space-y-2 px-4">
          <div className={cn(
            'min-h-[52px] max-h-[82px] overflow-y-auto rounded-lg bg-muted/70 px-3 py-2 ring-1 ring-border/45 transition-colors',
            isDone && 'bg-muted/70 ring-primary/25',
          )}>
            {isProcessing ? (
              <div className="flex h-9 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                正在识别语音…
              </div>
            ) : isDone ? (
              <p className="text-sm font-medium leading-6 text-foreground">
                {(voiceState as any).text}
              </p>
            ) : (
              <div className="flex h-9 flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-foreground">
                  {isRecording ? '正在聆听…' : '准备好后开始录音'}
                </p>
                <p className="sr-only">
                  {isRecording ? '声音会被保留用于回放' : '支持直接录音，也可以上传音频测试识别'}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-lg bg-muted/70 px-2 py-1 ring-1 ring-border/45">
            <WaveformBars active={isRecording} />
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex justify-end">
              {hasRecording && !isRecording && (
                <button
                  type="button"
                  aria-label={isPlaying ? '暂停回放' : '回放录音'}
                  title={isPlaying ? '暂停回放' : '回放录音'}
                  onClick={togglePlayback}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground ring-1 ring-border/45 transition-all hover:bg-muted hover:text-foreground active:scale-95',
                    isPlaying && 'text-primary ring-primary/25',
                  )}
                >
                  {isPlaying ? (
                    <Pause className="size-3.5 fill-current" />
                  ) : (
                    <Play className="ml-0.5 size-3.5 fill-current" />
                  )}
                </button>
              )}
              {!hasRecording && !isRecording && <div className="size-9" />}
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => {
                if (isRecording) stopRecording()
                else startRecording()
              }}
              className={cn(
                'flex size-10 items-center justify-center rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-40',
                isRecording
                  ? 'bg-rose-500 text-white'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              {isProcessing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isRecording ? (
                <Square className="size-4 fill-current" />
              ) : (
                <Mic className="size-4" />
              )}
            </button>

            <div className="flex justify-start">
              {!isRecording && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    aria-label="上传音频测试"
                    title="上传音频文件测试 STT"
                    disabled={isProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex size-9 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground ring-1 ring-border/45 transition-all hover:bg-muted hover:text-primary active:scale-95 disabled:opacity-30"
                  >
                    <FileAudio className="size-3.5" />
                  </button>
                </>
              )}
              {isRecording && <div className="size-9" />}
            </div>
          </div>

          <div className={cn(!isDone && 'hidden')}>
            {isDone && (
              <Button
                onClick={confirmText}
                className="h-10 w-full gap-2 rounded-lg font-semibold"
                size="lg"
              >
                <Send className="size-4" />
                使用这段文字
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
