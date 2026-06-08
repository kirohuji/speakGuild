import { useEffect, useRef, useState } from 'react'
import { Mic, Send } from 'lucide-react'
import { cn } from '@/lib/cn'
import { VnVoiceDrawer } from './vn-voice-drawer'

const TEXTAREA_MIN_HEIGHT = 36
const TEXTAREA_MAX_HEIGHT = 108

interface VnInputPanelProps {
  disabled?: boolean
  placeholder?: string
  onSubmit: (text: string, audioUrl?: string) => void | Promise<void>
  variant?: 'default' | 'embedded'
}

export function VnInputPanel({
  disabled,
  placeholder = '输入文字或点击麦克风录音',
  onSubmit,
  variant = 'default',
}: VnInputPanelProps) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isMultiline, setIsMultiline] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingAudioUrlRef = useRef<string | null>(null)
  const isDisabled = disabled || submitting

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = `${TEXTAREA_MIN_HEIGHT}px`
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, TEXTAREA_MIN_HEIGHT), TEXTAREA_MAX_HEIGHT)
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden'
    setIsMultiline(nextHeight > TEXTAREA_MIN_HEIGHT)
  }, [text])

  const submit = async () => {
    const nextText = text.trim()
    if (!nextText || isDisabled) return
    setSubmitting(true)
    const audioUrl = pendingAudioUrlRef.current ?? undefined
    pendingAudioUrlRef.current = null
    try {
      await onSubmit(nextText, audioUrl)
      setText('')
    } finally {
      setSubmitting(false)
    }
  }

  // Drawer 确认回调：把识别文字填入输入框，记录 audioUrl
  const handleVoiceConfirm = (transcribed: string, audioUrl?: string) => {
    setText((prev) => (prev ? `${prev} ${transcribed}` : transcribed))
    if (audioUrl) pendingAudioUrlRef.current = audioUrl
  }

  return (
    <>
      <div className={cn(
        variant === 'default' && 'border-t border-border/45 bg-background/55 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2.5 backdrop-blur-xl',
        variant === 'embedded' && 'rounded-lg bg-muted/45 p-1 transition-colors focus-within:bg-muted/60 focus-within:ring-1 focus-within:ring-primary/25',
      )}>
        <div className={cn(
          'flex',
          isMultiline ? 'min-h-10 items-end' : 'h-10 items-center',
          variant === 'default' ? 'gap-2' : 'gap-1',
        )}>
          {/* 语音按钮：打开 Drawer */}
          <button
            type="button"
            aria-label="语音输入"
            title="语音输入"
            disabled={isDisabled}
            onClick={(event) => {
              event.stopPropagation()
              setDrawerOpen(true)
            }}
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40',
              variant === 'default' && 'bg-muted/70 ring-1 ring-border/45',
            )}
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
                  void submit()
                }
              }}
              className="box-border block h-9 max-h-[108px] min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-1.5 text-base font-medium leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="button"
            aria-label="发送"
            title="发送"
            disabled={isDisabled || !text.trim()}
            onClick={(event) => {
              event.stopPropagation()
              void submit()
            }}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/85 active:scale-95 disabled:bg-muted disabled:text-muted-foreground/50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>

      {/* 语音输入 Drawer */}
      <VnVoiceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onConfirm={handleVoiceConfirm}
      />
    </>
  )
}
