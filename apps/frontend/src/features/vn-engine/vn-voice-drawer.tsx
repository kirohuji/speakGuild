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
import { transcribeRecording } from '@/lib/practice-ai-api'

// ---------------------------------------------------------------------------
// 音波可视化条（纯 CSS 动画，录音时激活）
// ---------------------------------------------------------------------------
function WaveformBars({ active }: { active: boolean }) {
  const barCount = 32
  return (
    <div className="flex items-center justify-center gap-[2px] h-16 px-4">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-[3px] rounded-full bg-primary/30 transition-all duration-150',
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
  onConfirm: (text: string) => void
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
          const result = await transcribeRecording(blob, `recording.${ext}`)
          const transcribed = result.text?.trim()
          if (transcribed) {
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
      const result = await transcribeRecording(file, file.name)
      const transcribed = result.text?.trim()
      if (transcribed) {
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
      onConfirm(voiceState.text)
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
      <DrawerContent className="max-h-[70vh] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        {/* 隐藏音频元素 */}
        <audio ref={audioRef} src={lastAudioUrlRef.current ?? undefined} preload="auto" />

        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base">语音输入</DrawerTitle>
        </DrawerHeader>

        {/* ---- 转写文字展示区 ---- */}
        <div className="min-h-[60px] rounded-xl bg-muted/50 px-4 py-3 mb-4">
          {isProcessing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在识别语音…
            </div>
          ) : isDone ? (
            <p className="text-base leading-relaxed text-foreground">
              {(voiceState as any).text}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isRecording ? '正在聆听…' : '点击下方按钮开始录音'}
            </p>
          )}
        </div>

        {/* ---- 错误提示 ---- */}
        {error && (
          <div className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* ---- 音波图 ---- */}
        <div className="mb-2">
          <WaveformBars active={isRecording} />
        </div>

        {/* ---- 计时 ---- */}
        {isRecording && (
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-rose-500" />
            <span className="tabular-nums text-sm text-muted-foreground">{fmt(elapsed)}</span>
          </div>
        )}
        {!isRecording && (
          <div className="mb-3 h-5" /> /* 占位保持布局 */
        )}

        {/* ---- 操作按钮行 ---- */}
        <div className="flex items-center justify-center gap-4 mb-4">
          {/* 左侧占位，保持中间按钮居中 */}
          <div className="w-12" />

          {/* 中间：录音/停止按钮 */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              if (isRecording) stopRecording()
              else startRecording()
            }}
            className={cn(
              'flex size-16 items-center justify-center rounded-full transition-all duration-200 active:scale-95 disabled:opacity-40',
              isRecording
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-primary text-primary-foreground shadow-lg shadow-primary/30',
            )}
          >
            {isProcessing ? (
              <Loader2 className="size-6 animate-spin" />
            ) : isRecording ? (
              <Square className="size-6 fill-current" />
            ) : (
              <Mic className="size-6" />
            )}
          </button>

          {/* 右侧按钮组 */}
          <div className="flex flex-col items-center gap-2 w-12">
            {/* 回放按钮（仅在有录音时显示） */}
            {hasRecording && !isRecording && (
              <button
                type="button"
                aria-label={isPlaying ? '暂停回放' : '回放录音'}
                onClick={togglePlayback}
                className={cn(
                  'flex size-12 items-center justify-center rounded-full border-2 border-border text-muted-foreground transition-all hover:bg-muted active:scale-95',
                  isPlaying && 'border-primary text-primary bg-primary/10',
                )}
              >
                {isPlaying ? (
                  <Pause className="size-5 fill-current" />
                ) : (
                  <Play className="size-5 fill-current ml-0.5" />
                )}
              </button>
            )}

            {/* 测试：上传音频文件 */}
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
                  className="flex size-8 items-center justify-center rounded-full border border-dashed border-border/60 text-muted-foreground/50 transition-all hover:border-primary/40 hover:text-primary/60 active:scale-95 disabled:opacity-30"
                >
                  <FileAudio className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ---- 确认按钮 ---- */}
        {isDone && (
          <Button
            onClick={confirmText}
            className="w-full gap-2"
            size="lg"
          >
            <Send className="size-4" />
            使用这段文字
          </Button>
        )}
      </DrawerContent>
    </Drawer>
  )
}
