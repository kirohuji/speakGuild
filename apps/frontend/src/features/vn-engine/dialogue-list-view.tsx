import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { History, RotateCcw, Settings, SkipBack, X, Send } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { VnPlayerLine, VnPlayerChoice, BackgroundFit } from './vn-player'

interface DialogueListViewProps {
  backgroundUrl?: string
  backgroundFit?: BackgroundFit
  currentLine?: VnPlayerLine | null
  history?: VnPlayerLine[]
  choices?: VnPlayerChoice[]
  currentAvatarUrl?: string
  currentAvatarAlt?: string
  isWaiting?: boolean
  isEnded?: boolean
  onAdvance?: () => void
  onChoice?: (index: number) => void
  onSubmitInput?: (text: string) => void | Promise<void>
  onReset?: () => void
  endedActions?: ReactNode
  onHistoryOpenChange?: (open: boolean) => void
  className?: string
  showHistoryButton?: boolean
  fontSize?: number
  bilingual?: boolean
  showUserInputInDialogue?: boolean
  onSettingsOpen?: () => void
}

const BgFitStyle: Record<string, string> = {
  cover: 'cover',
  contain: 'contain',
  stretch: '100% 100%',
  repeat: 'auto',
}

export function DialogueListView({
  backgroundUrl,
  backgroundFit = 'cover',
  currentLine,
  history = [],
  choices = [],
  currentAvatarUrl,
  currentAvatarAlt,
  isWaiting = false,
  isEnded = false,
  onAdvance,
  onChoice,
  onSubmitInput,
  onReset,
  endedActions,
  onHistoryOpenChange,
  className,
  showHistoryButton = true,
  fontSize = 14,
  bilingual = false,
  showUserInputInDialogue = true,
  onSettingsOpen,
}: DialogueListViewProps) {
  const { t } = useTranslation()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // ── Build display list: history + current line ──
  const displayLines: VnPlayerLine[] = [...history]
  if (currentLine && !isEnded) {
    // If the current line is already the last in history, don't duplicate
    const lastHistoryLine = history[history.length - 1]
    if (!lastHistoryLine || lastHistoryLine.text !== currentLine.text || lastHistoryLine.speaker !== currentLine.speaker) {
      displayLines.push(currentLine)
    }
  }

  // Filter user lines based on setting
  const visibleLines = displayLines.filter((line) => {
    if (line.isUser && !showUserInputInDialogue) return false
    return true
  })

  const canInteract = !!onAdvance && !isEnded && !isWaiting && choices.length === 0 && !historyOpen

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleLines.length, choices.length, isWaiting])

  const toggleHistory = (value: boolean) => {
    setHistoryOpen(value)
    onHistoryOpenChange?.(value)
  }

  const handleSubmitInput = async () => {
    const text = inputText.trim()
    if (!text || submitting || !onSubmitInput) return
    setSubmitting(true)
    try {
      await onSubmitInput(text)
      setInputText('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cn('relative flex h-full w-full flex-col overflow-hidden bg-[#0f172a]', className)}>
      {/* ── Background ── */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]"
        style={{
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
          backgroundSize: BgFitStyle[backgroundFit] || 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: backgroundFit === 'repeat' ? 'repeat' : 'no-repeat',
        }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/50" />

      {/* ── Top bar ── */}
      <div className="relative z-10 flex items-center justify-between px-3 py-2">
        <div />
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/46 px-1 shadow-[0_6px_22px_rgba(0,0,0,.24)] backdrop-blur-2xl">
          {onReset && (
            <IconButton label={t('practiceSession.retry')} onClick={onReset}>
              <RotateCcw className="size-3.5" />
            </IconButton>
          )}
          {showHistoryButton && (
            <IconButton label={t('vnHistory.title')} onClick={() => toggleHistory(!historyOpen)}>
              <History className="size-3.5" />
            </IconButton>
          )}
          {onSettingsOpen && (
            <IconButton label={t('vnSettings.title')} onClick={onSettingsOpen}>
              <Settings className="size-3.5" />
            </IconButton>
          )}
        </div>
      </div>

      {/* ── Chat list ── */}
      <div
        ref={scrollRef}
        role="button"
        tabIndex={canInteract ? 0 : -1}
        aria-label="推进对话"
        className={cn('relative z-10 min-h-0 flex-1 overflow-y-auto px-3 py-2 outline-none', canInteract && 'cursor-pointer')}
        onClick={() => { if (canInteract) onAdvance?.() }}
        onKeyDown={(event) => {
          if (canInteract && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            onAdvance?.()
          }
        }}
      >
        <div className="flex flex-col gap-2.5 pb-2">
          {visibleLines.map((line, index) => {
            const isLast = index === visibleLines.length - 1
            const isUser = line.isUser
            return (
              <ChatBubble
                key={index}
                line={line}
                isUser={isUser}
                isLast={isLast}
                avatarUrl={!isUser ? currentAvatarUrl : undefined}
                avatarAlt={!isUser ? (currentAvatarAlt || line.speaker || '') : undefined}
                fontSize={fontSize}
                bilingual={bilingual}
              />
            )
          })}

          {/* Choices */}
          {choices.length > 0 && (
            <div className="flex flex-col gap-2 py-2">
              {choices.map((choice) => (
                <button
                  key={choice.index}
                  type="button"
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left text-sm font-medium text-white shadow-lg backdrop-blur-md transition-colors hover:border-white/35 hover:bg-white/18"
                  onClick={(event) => {
                    event.stopPropagation()
                    onChoice?.(choice.index)
                  }}
                >
                  {choice.text}
                </button>
              ))}
            </div>
          )}

          {/* Waiting indicator */}
          {isWaiting && (
            <div className="flex items-center gap-1.5 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '0ms' }} />
              <span className="size-1.5 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '150ms' }} />
              <span className="size-1.5 animate-bounce rounded-full bg-white/60" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {/* Ended state */}
          {isEnded && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-center text-sm text-white/62">{t('vnHistory.storyEnded')}</p>
              {endedActions}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      {isWaiting && onSubmitInput && (
        <div className="relative z-10 border-t border-white/10 bg-black/40 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitInput() }}
              placeholder="输入你的回答..."
              disabled={submitting}
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/30 focus:bg-white/12"
            />
            <button
              type="button"
              onClick={handleSubmitInput}
              disabled={!inputText.trim() || submitting}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/80 transition-colors hover:bg-white/25 disabled:opacity-30"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── History overlay ── */}
      {historyOpen && (
        <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={(event) => event.stopPropagation()}>
          <div className="ml-auto flex h-full w-full max-w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{t('vnHistory.title')}</p>
                <p className="text-[11px] text-muted-foreground">{t('vnHistory.count', { count: history.length })}</p>
              </div>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => toggleHistory(false)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {history.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t('vnHistory.empty')}</p>
              ) : history.map((line, index) => (
                <div key={index} className={cn('rounded-lg border px-3 py-2', line.isUser ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/40')}>
                  {line.speaker && <p className="mb-1 text-xs font-semibold text-muted-foreground">{line.speaker}</p>}
                  <p className="text-sm leading-6 text-foreground">{line.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Chat bubble for a single dialogue line */
function ChatBubble({
  line,
  isUser,
  isLast,
  avatarUrl,
  avatarAlt,
  fontSize,
  bilingual,
}: {
  line: VnPlayerLine
  isUser: boolean
  isLast: boolean
  avatarUrl?: string
  avatarAlt?: string
  fontSize: number
  bilingual: boolean
}) {
  // Typewriter effect for the last line only
  const [displayedText, setDisplayedText] = useState(isLast ? '' : line.text)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isLast) {
      setDisplayedText(line.text)
      return
    }
    // Typewriter for the last line
    setDisplayedText('')
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setDisplayedText(line.text.slice(0, index))
      if (index >= line.text.length) {
        window.clearInterval(timer)
        if (timerRef.current === timer) timerRef.current = null
      }
    }, 18)
    timerRef.current = timer
    return () => {
      window.clearInterval(timer)
      if (timerRef.current === timer) timerRef.current = null
    }
  }, [line.text, isLast])

  const isTyping = isLast && displayedText.length < line.text.length

  return (
    <div className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {/* Avatar for NPC */}
      {!isUser && avatarUrl && (
        <img
          src={avatarUrl}
          alt={avatarAlt || ''}
          className="mt-1 size-9 shrink-0 rounded-full object-cover ring-1 ring-white/15"
        />
      )}

      <div className={cn('max-w-[78%]', isUser ? 'items-end' : 'items-start')}>
        {/* Speaker name */}
        {!isUser && line.speaker && (
          <p className="mb-0.5 ml-1 text-[11px] font-medium text-white/60">{line.speaker}</p>
        )}

        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5',
            isUser
              ? 'rounded-br-md bg-primary/70 text-white shadow-sm'
              : 'rounded-bl-md bg-white/12 text-white/92 backdrop-blur-sm',
          )}
        >
          <p className="leading-relaxed" style={{ fontSize }}>
            {displayedText}
            {isTyping && (
              <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-current align-middle opacity-70" />
            )}
          </p>
        </div>

        {/* Translation */}
        {bilingual && line.translation && (
          <p className="mt-0.5 ml-1 text-[11px] leading-relaxed text-white/45">{line.translation}</p>
        )}
      </div>

      {/* Avatar placeholder for user side alignment */}
      {isUser && <div className="size-9 shrink-0" />}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-7 items-center justify-center rounded-full text-white/78 transition-colors hover:bg-white/12 hover:text-white"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
