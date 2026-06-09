import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { ExternalLink, History, Loader2, RotateCcw, Settings, Volume2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { get } from '@/lib/request'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { VnPlayerLine, VnPlayerChoice, BackgroundFit } from './vn-player'
import type { DictionaryEntry } from '@/features/admin/api-dictionary'
import { TurnGuidanceCard, type VnTurnGuidance } from './practice-guidance'
import { VnInputPanel } from './vn-input-panel'

// ── 单词查询缓存 ──
const wordCache = new Map<string, DictionaryEntry | null>()

async function lookupWord(word: string): Promise<DictionaryEntry | null> {
  const key = word.toLowerCase().trim()
  if (!key) return null
  if (wordCache.has(key)) return wordCache.get(key)!
  try {
    const entry = await get<DictionaryEntry>(`/dictionary/${encodeURIComponent(key)}`)
    wordCache.set(key, entry)
    return entry
  } catch {
    wordCache.set(key, null)
    return null
  }
}

/** 长按单词弹出释义的 Popover */
function WordPopover({
  word,
  onViewDetail,
  onDismiss,
}: {
  word: string
  onViewDetail?: (word: string) => void
  onDismiss?: () => void
}) {
  const [entry, setEntry] = useState<DictionaryEntry | null | 'loading'>('loading')

  useEffect(() => {
    setEntry('loading')
    lookupWord(word).then(setEntry)
  }, [word])

  const firstSense = entry !== 'loading' && entry ? entry.senseClusters?.[0]?.senses?.[0] : null
  const zh = firstSense?.translations?.zh ?? ''

  return (
    <PopoverContent
      side="top"
      align="center"
      className="w-56 p-3 text-sm"
      onOpenAutoFocus={(e) => e.preventDefault()}
      onInteractOutside={(e) => {
        e.preventDefault() // 阻止点击穿透到 VN 对话推进
        onDismiss?.()
      }}
    >
      <p className="font-semibold text-foreground">{word}</p>
      {entry === 'loading' ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          查询中...
        </div>
      ) : zh ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{zh}</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">暂无释义</p>
      )}
      {onViewDetail && (
        <button
          type="button"
          className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onViewDetail(word)
          }}
        >
          <ExternalLink className="size-3" />
          查看详情
        </button>
      )}
    </PopoverContent>
  )
}

/** 将文本拆为单词，每个单词可长按查词 */
export function TappableText({
  text,
  onWordDetail,
}: {
  text: string
  /** 点击"查看详情"：打开完整单词 dialog */
  onWordDetail?: (word: string) => void
}) {
  const [activeWord, setActiveWord] = useState<string | null>(null)
  // 按空格拆分英文单词，中文按字符
  const tokens = text.split(/(\s+)/g)

  // 只要传了 onWordDetail 就启用长按查词
  const enabled = !!onWordDetail

  return (
    <>
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) {
          return <span key={i}>{token}</span>
        }
        // 对每个片段，提取纯单词（去掉标点）用于查询
        const wordMatch = token.match(/^(\w[\w'-]*)/)
        const word = wordMatch ? wordMatch[1] : ''
        const isWord = word.length >= 2

        if (!isWord || !enabled) {
          return <span key={i}>{token}</span>
        }

        return (
          <TappableWord
            key={i}
            word={word}
            displayText={token}
            isActive={activeWord === word}
            onActivate={(w) => setActiveWord(w)}
            onDeactivate={() => setActiveWord(null)}
            onViewDetail={onWordDetail}
          />
        )
      })}
    </>
  )
}

/** 单个可长按单词 */
function TappableWord({
  word,
  displayText,
  isActive,
  onActivate,
  onDeactivate,
  onViewDetail,
}: {
  word: string
  displayText: string
  isActive: boolean
  onActivate: (word: string) => void
  onDeactivate: () => void
  onViewDetail?: (word: string) => void
}) {
  const spanRef = useRef<HTMLSpanElement | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const movedRef = useRef(false)

  const clear = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }, [])

  // 用原生事件绕过 React 17+ touchstart 默认 passive 的限制
  useEffect(() => {
    const el = spanRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      // 滚动中无法取消，跳过长按检测
      if (!e.cancelable) return
      e.preventDefault()
      movedRef.current = false
      clear()
      longPressRef.current = setTimeout(() => {
        if (!movedRef.current) {
          onActivate(word)
        }
      }, 500)
    }

    const onTouchMove = () => {
      movedRef.current = true
      clear()
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault()
      clear()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      clear()
    }
  }, [word, onActivate, clear])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onActivate(word)
    },
    [word, onActivate],
  )

  return (
    <Popover open={isActive} onOpenChange={(open) => { if (!open) onDeactivate() }}>
      <PopoverTrigger asChild>
        <span
          ref={spanRef}
          className={cn(
            'cursor-pointer select-none rounded transition-colors hover:bg-primary/10 active:bg-primary/15',
            isActive && 'bg-primary/15 ring-1 ring-primary/30',
          )}
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
          onContextMenu={handleContextMenu}
        >
          {displayText}
        </span>
      </PopoverTrigger>
      {isActive && (
        <WordPopover
          word={word}
          onViewDetail={onViewDetail}
          onDismiss={onDeactivate}
        />
      )}
    </Popover>
  )
}

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
  /** 用户长按单词后点击"查看详情"时回调 */
  onWordInsight?: (word: string) => void
  /** 打字机效果开关 */
  typewriter?: boolean
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
  onWordInsight,
  typewriter = false,
}: DialogueListViewProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
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
      {resolvedTheme === 'dark' && <div className="pointer-events-none absolute inset-0 bg-black/35" />}
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
                typewriter={typewriter}
                onWordDetail={onWordInsight}
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
      {inputFeedback && !(isWaiting && onSubmitInput) && (
        <div className="relative z-10 px-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] pt-2">
          <div className="overflow-hidden rounded-xl border border-border/55 bg-background/75 backdrop-blur-2xl">
            {inputFeedback}
          </div>
        </div>
      )}

      {isWaiting && onSubmitInput && (
        <div className="relative z-10 px-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] pt-2">
          <TurnGuidanceCard guidance={inputGuidance} className="mb-2 mr-0 max-w-[min(92%,360px)]" />
          <div className="overflow-hidden rounded-xl border border-border/55 bg-background/75 p-1.5 backdrop-blur-2xl">
            {inputFeedback && <div className="mb-1.5 overflow-hidden rounded-lg bg-muted/30">{inputFeedback}</div>}
            <VnInputPanel
              variant="embedded"
              placeholder={t('practiceVn.chatInputPlaceholder')}
              disabled={inputDisabled}
              onSubmit={onSubmitInput}
            />
          </div>
        </div>
      )}

      {/* ── History overlay ── */}
      {historyOpen && (
        <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={(event) => event.stopPropagation()}>
          <div className="ml-auto flex h-full w-full max-w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
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
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4">
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
  typewriter,
  onWordDetail,
}: {
  line: VnPlayerLine
  isUser: boolean
  isLast: boolean
  avatarUrl?: string
  avatarAlt?: string
  fontSize: number
  bilingual: boolean
  typewriter?: boolean
  onWordDetail?: (word: string) => void
}) {
  // User input should appear immediately. Typewriter is reserved for new NPC replies.
  const hasTypewriter = typewriter !== false && isLast && !isUser && !!line.speaker
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
              <TappableText text={displayedText} onWordDetail={onWordDetail} />
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
  const [audioPlaying, setAudioPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlayAudio = () => {
    if (!line.audioUrl) return
    if (audioPlaying && audioRef.current) {
      audioRef.current.pause()
      return
    }
    const audio = new Audio(line.audioUrl)
    audioRef.current = audio
    audio.onplay = () => setAudioPlaying(true)
    audio.onpause = () => setAudioPlaying(false)
    audio.onended = () => { setAudioPlaying(false); audioRef.current = null }
    audio.play().catch(() => setAudioPlaying(false))
  }

  useEffect(() => () => {
    audioRef.current?.pause()
  }, [])

  return (
    <div className="flex w-full justify-end">
      <div className="max-w-[78%]">
        <div className={cn(
          'relative rounded-lg bg-primary/15 px-3.5 py-2.5 text-foreground ring-1 ring-primary/20',
          line.audioUrl && 'pr-11',
        )}>
          {line.audioUrl && (
            <button
              type="button"
              aria-label="回放录音"
              title="回放录音"
              onClick={(event) => {
                event.stopPropagation()
                handlePlayAudio()
              }}
              className={cn(
                'absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/75 text-primary shadow-sm ring-1 ring-primary/20 backdrop-blur transition-colors hover:bg-primary/10 active:scale-95',
                audioPlaying && 'bg-primary/10',
              )}
            >
              <Volume2 className={cn('size-3.5', audioPlaying && 'animate-pulse')} />
            </button>
          )}
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
