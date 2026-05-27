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
}

export function VnInputPanel({
  disabled,
  placeholder = '输入或按住语音，说出你的回答',
  onSubmit,
}: VnInputPanelProps) {
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

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
    if (!nextText || disabled) return
    await onSubmit(nextText)
    setText('')
  }

  const toggleVoice = () => {
    if (disabled) return
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
    <div className="border-t border-white/10 bg-black/12 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] pt-2.5">
      <div className="flex h-10 items-center gap-2">
        <button
          type="button"
          aria-label={isListening ? '停止语音输入' : '开始语音输入'}
          title={isListening ? '停止语音输入' : '开始语音输入'}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation()
            toggleVoice()
          }}
          className={cn(
            'relative flex size-9 shrink-0 items-center justify-center border border-white/10 text-white/78 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40',
            isListening && 'border-rose-300/30 bg-rose-500/18 text-rose-100',
          )}
        >
          {isListening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
          {isListening && <span className="absolute inset-0 animate-ping border border-rose-200/50" />}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 border-x border-white/10 px-3">
          <Keyboard className="size-4 shrink-0 text-white/40" />
          <input
            value={text}
            disabled={disabled}
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
            className="h-7 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="button"
          aria-label="发送"
          title="发送"
          disabled={disabled || !text.trim()}
          onClick={(event) => {
            event.stopPropagation()
            void submit()
          }}
          className="flex size-9 shrink-0 items-center justify-center border border-white/10 text-white/78 transition-colors hover:bg-white/10 hover:text-white disabled:bg-transparent disabled:text-white/28"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  )
}
