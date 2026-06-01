import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { History, RotateCcw, Settings, X, Send } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { VnPlayerLine, VnPlayerChoice, BackgroundFit } from './vn-player'
import { TurnGuidanceCard, type VnTurnGuidance } from './practice-guidance'

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
  inputFeedback?: ReactNode
  inputGuidance?: VnTurnGuidance
  inputDisabled?: boolean
  onReset?: () => void
  endedActions?: ReactNode
  onHistoryOpenChange?: (open: boolean) => void
  /** External control for history dialog (e.g. from parent header button) */
  historyOpen?: boolean
  onToggleHistory?: (open: boolean) => void
  className?: string
  showHistoryButton?: boolean
  fontSize?: number
  bilingual?: boolean
  showUserInputInDialogue?: boolean
  onSettingsOpen?: () => void
  hideTopBar?: boolean
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
  inputFeedback,
  inputGuidance,
  inputDisabled,
  onReset,
  endedActions,
  onHistoryOpenChange,
  historyOpen: historyOpenProp,
  onToggleHistory,
  className,
  showHistoryButton = true,
  fontSize = 14,
  bilingual = false,
  showUserInputInDialogue = true,
  onSettingsOpen,
  hideTopBar = false,
}: DialogueListViewProps) {
  const { t } = useTranslation()
  const [historyOpenInternal, setHistoryOpenInternal] = useState(false)
  const historyOpen = historyOpenProp !== undefined ? historyOpenProp : historyOpenInternal
  const setHistoryOpen = (value: boolean) => {
    if (onToggleHistory) {
      onToggleHistory(value)
      return
    }
    setHistoryOpenInternal(value)
    onHistoryOpenChange?.(value)
  }
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
    if (!text || submitting || inputDisabled || !onSubmitInput) return
    setSubmitting(true)
    try {
      await onSubmitInput(text)
      setInputText('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cn('relative flex h-full w-full flex-col overflow-hidden bg-background', className)}>
      {/* ── Background ── */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-background via-background to-background"
        style={{
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
          backgroundSize: BgFitStyle[backgroundFit] || 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: backgroundFit === 'repeat' ? 'repeat' : 'no-repeat',
        }}
      />
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-background/68 backdrop-blur-[4px]" />
      {/* Dark mode: dim bright background images */}
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      <div className="pointer-events-none absolute -right-20 top-20 size-64 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-24 size-72 rounded-full bg-amber-400/[0.06] blur-3xl" />

      {/* ── Top bar (hidden when merged into parent header) ── */}
      {!hideTopBar && (
      <div className="absolute right-3 z-40 flex items-center gap-1 rounded-full border border-border/30 bg-background/60 px-1 shadow-lg backdrop-blur-2xl" style={{ top: 'calc(3.25rem + env(safe-area-inset-top, 0px))' }}>
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
      )}
      {/* ── Chat list ── */}
      <div
        ref={scrollRef}
        role="button"
        tabIndex={canInteract ? 0 : -1}
        aria-label="推进对话"
        className={cn(
          'relative z-10 min-h-0 flex-1 overflow-y-auto px-3.5 outline-none',
          hideTopBar && 'pt-[calc(3.25rem+env(safe-area-inset-top,0px))]',
          !hideTopBar && 'py-2',
          canInteract && 'cursor-pointer',
        )}
        onClick={() => { if (canInteract) onAdvance?.() }}
        onKeyDown={(event) => {
          if (canInteract && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            onAdvance?.()
          }
        }}
      >
        <div className="flex flex-col gap-3 pb-3">
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
                  className="rounded-lg bg-muted/65 px-3.5 py-3 text-left text-sm font-medium text-foreground ring-1 ring-border/45 transition-colors hover:bg-muted/80"
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
          {isWaiting && !onSubmitInput && (
            <div className="flex items-center gap-1.5 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: '0ms' }} />
              <span className="size-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: '150ms' }} />
              <span className="size-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {/* Tap-to-continue indicator */}
          {canInteract && visibleLines.length > 0 && (
            <div className="flex justify-center py-2">
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-foreground/30" />
            </div>
          )}

          {/* Ended state */}
          {isEnded && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-center text-sm text-muted-foreground">{t('vnHistory.storyEnded')}</p>
              {endedActions}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      {isWaiting && onSubmitInput && (
        <div className="relative z-10 px-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] pt-2">
          <TurnGuidanceCard guidance={inputGuidance} className="max-w-[min(92%,360px)]" />
          <div className="rounded-lg bg-background/50-2.5 shadow-[0_8px_28px_rgba(15,23,42,0.11)] ring-1 ring-border/60 backdrop-blur-xl">
            {inputFeedback && <div className="mb-2">{inputFeedback}</div>}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitInput() }}
                placeholder={t('practiceVn.chatInputPlaceholder')}
                disabled={submitting || inputDisabled}
                className="min-w-0 flex-1 rounded-lg border-0 bg-muted/70 px-3.5 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:bg-muted/85 focus:ring-1 focus:ring-ring disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleSubmitInput}
                disabled={!inputText.trim() || submitting || inputDisabled}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-30"
              >
                <Send className="size-4" />
              </button>
            </div>
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
  // User input should appear immediately. Typewriter is reserved for new NPC replies.
  const hasTypewriter = isLast && !isUser && !!line.speaker
  const [displayedText, setDisplayedText] = useState(hasTypewriter ? '' : line.text)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!hasTypewriter) {
      setDisplayedText(line.text)
      return
    }
    setDisplayedText('')
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setDisplayedText(line.text.slice(0, index))
      if (index >= line.text.length) {
        window.clearInterval(timer)
        if (timerRef.current === timer) timerRef.current = null
      }
    }, 28)
    timerRef.current = timer
    return () => {
      window.clearInterval(timer)
      if (timerRef.current === timer) timerRef.current = null
    }
  }, [line.text, hasTypewriter])

  const isTyping = isLast && displayedText.length < line.text.length
  const displayedTranslation = line.text
    ? line.translation?.slice(0, Math.ceil((displayedText.length / line.text.length) * line.translation.length))
    : line.translation

  // ── Narration: centered, transparent, italic ──
  if (!isUser && !line.speaker) {
    return (
      <div className="flex w-full flex-col items-center py-3">
        <p className="max-w-[72%] text-center leading-relaxed italic text-muted-foreground" style={{ fontSize }}>
          {displayedText}
          {isTyping && (
            <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-current align-middle opacity-70" />
          )}
        </p>
        {bilingual && line.translation && (
          <p className="mt-1 max-w-[72%] text-center text-[12px] leading-relaxed italic text-muted-foreground/50">
            {displayedTranslation}
          </p>
        )}
      </div>
    )
  }

  // ── NPC message card: 左列头像 + 右列名字/消息 ──
  if (!isUser) {
    return (
      <div className="flex w-full justify-start">
        <div className="flex max-w-[88%] min-w-[140px] gap-3 rounded-lg bg-muted/65 px-3.5 py-3 ring-1 ring-border/45 backdrop-blur-sm">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={avatarAlt || ''}
              className="size-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="size-10 shrink-0 rounded-lg bg-background/70" />
          )}
          <div className="min-w-0 flex-1">
            {line.speaker && (
              <p className="text-sm font-semibold text-foreground/90">{line.speaker}</p>
            )}
            <p className="mt-1 leading-relaxed text-foreground" style={{ fontSize }}>
              {displayedText}
              {isTyping && (
                <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-current align-middle opacity-70" />
              )}
            </p>
            {bilingual && line.translation && (
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{displayedTranslation}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── User bubble: simple right-aligned message ──
  return (
    <div className="flex w-full justify-end">
      <div className="max-w-[78%]">
        <div className="rounded-lg bg-primary/15 px-3.5 py-2.5 text-foreground ring-1 ring-primary/20">
          <p className="leading-relaxed" style={{ fontSize }}>
            {displayedText}
            {isTyping && (
              <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-current align-middle opacity-70" />
            )}
          </p>
        </div>
        {bilingual && line.translation && (
          <p className="mt-1 mr-1 text-right text-[12px] leading-relaxed text-muted-foreground">
            {displayedTranslation}
          </p>
        )}
      </div>
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
      className="flex size-7 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
