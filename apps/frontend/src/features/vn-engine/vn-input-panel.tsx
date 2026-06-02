import { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, Mic, Send, Square } from 'lucide-react'
import { cn } from '@/lib/cn'

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

interface VnInputPanelProps {
  disabled?: boolean
  placeholder?: string
  onSubmit: (text: string) => void | Promise<void>
  variant?: 'default' | 'embedded'
}

export function VnInputPanel({
  disabled,
  placeholder = '输入或按住语音，说出你的回答',
  onSubmit,
  variant = 'default',
}: VnInputPanelProps) {
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const isDisabled = disabled || submitting

  const SpeechRecognition = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const speechWindow = window as SpeechWindow
    return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
  }, [])

  useEffect(() => {
    setSpeechSupported(Boolean(SpeechRecognition))
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [SpeechRecognition])

  const submit = async () => {
    const nextText = text.trim()
    if (!nextText || isDisabled) return
    setSubmitting(true)
    try {
      await onSubmit(nextText)
      setText('')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleVoice = () => {
    if (isDisabled) return
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    if (!SpeechRecognition) {
      setSpeechSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()
      if (transcript) setText(transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => {
      setIsListening(false)
      setSpeechSupported(false)
    }

    recognitionRef.current = recognition
    setIsListening(true)
    recognition.start()
  }

  return (
    <div className={cn(
      variant === 'default' && 'border-t border-border/45 bg-background/55 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2.5 backdrop-blur-xl',
      variant === 'embedded' && 'rounded-lg bg-muted/45 p-1 transition-colors focus-within:bg-muted/60 focus-within:ring-1 focus-within:ring-primary/25',
    )}>
      <div className="flex h-10 items-center gap-2">
        <button
          type="button"
          aria-label={isListening ? '停止语音输入' : '开始语音输入'}
          title={isListening ? '停止语音输入' : '开始语音输入'}
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation()
            toggleVoice()
          }}
          className={cn(
            'relative flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40',
            variant === 'default' && 'bg-muted/70 ring-1 ring-border/45',
            isListening && 'bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300',
          )}
        >
          {isListening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
          {isListening && <span className="absolute inset-0 animate-ping rounded-lg ring-1 ring-rose-500/40" />}
        </button>

        <div className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3',
          variant === 'default' && 'bg-muted/70 ring-1 ring-border/45',
        )}>
          <Keyboard className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={text}
            disabled={isDisabled}
            placeholder={speechSupported ? placeholder : '当前浏览器不支持语音识别，可以直接输入文字'}
            onChange={(event) => setText(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                event.stopPropagation()
                void submit()
              }
            }}
            className="h-9 min-w-0 flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
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
  )
}
