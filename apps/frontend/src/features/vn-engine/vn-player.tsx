import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { History, RotateCcw, Settings, SkipBack, Volume2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { assetCacheService } from '@/lib/offline'
import { isNative } from '@/lib/native'
import { VnInputPanel } from './vn-input-panel'
import { DialogueListView } from './dialogue-list-view'
import { TappableText } from './dialogue-list-view'
import { TurnGuidanceCard, type VnTurnGuidance } from './practice-guidance'
import { PixiVnStage, type BackgroundFit, type StageVariant } from './pixi-vn-stage'

export type { BackgroundFit } from './pixi-vn-stage'

export interface VnPlayerLine {
  speaker?: string
  text: string
  isUser?: boolean
  translation?: string
  audioUrl?: string
}

export interface VnPlayerChoice {
  index: number
  text: string
}

export interface VnPlayerHandle {
  toggleHistory: (open?: boolean) => void
  toggleSettings: (open?: boolean) => void
}

interface VnPlayerProps {
  backgroundUrl?: string
  backgroundFit?: BackgroundFit
  currentLine?: VnPlayerLine | null
  history?: VnPlayerLine[]
  choices?: VnPlayerChoice[]
  currentSpriteUrl?: string
  spriteAlt?: string
  spritePosition?: 'left' | 'center' | 'right'
  currentAvatarUrl?: string
  currentAvatarAlt?: string
  isWaiting?: boolean
  isEnded?: boolean
  onAdvance?: () => void
  onChoice?: (index: number) => void
  onSubmitInput?: (text: string, audioUrl?: string) => void | Promise<void>
  inputFeedback?: ReactNode
  inputFeedbackChat?: ReactNode
  inputGuidance?: VnTurnGuidance
  inputDisabled?: boolean
  onReset?: () => void
  endedActions?: ReactNode
  onHistoryOpenChange?: (open: boolean) => void
  className?: string
  stageClassName?: string
  frameVariant?: Extract<StageVariant, 'portrait' | 'landscape'>
  showHistoryButton?: boolean
  /** Hide the top bar in chat-list mode (e.g. when parent provides its own header) */
  hideChatTopBar?: boolean
  onDisplayModeChange?: (displayMode: VnPlayerSettings['displayMode']) => void
  showUserInputOverride?: boolean
  onWordInsight?: (word: string) => void
}

interface VnPlayerSettings {
  fontSize: number
  autoAdvance: boolean
  autoAdvanceDelay: number
  bilingual: boolean
  showUserInputInDialogue: boolean
  displayMode: 'vn' | 'chat'
  typewriter: boolean
}

const DEFAULT_SETTINGS: VnPlayerSettings = {
  fontSize: 14,
  autoAdvance: false,
  autoAdvanceDelay: 2.5,
  bilingual: false,
  showUserInputInDialogue: true,
  displayMode: 'vn',
  typewriter: false,
}

const SETTINGS_STORAGE_KEY = 'manyu-vn-player-settings'

function canCacheAssetUrl(url?: string | null) {
  return !!url && !url.startsWith('blob:') && !url.startsWith('data:')
}

function useCachedAssetUrl(url?: string, role?: string) {
  const [cachedUrl, setCachedUrl] = useState(url)

  useEffect(() => {
    let cancelled = false
    setCachedUrl(url)
    if (!canCacheAssetUrl(url)) return

    assetCacheService.resolve({ url, role }).then((resolved) => {
      if (!cancelled) {
        setCachedUrl(resolved)
      }
    }).catch((err) => {
      if (role === 'background' || role === 'sprite') console.warn('[vn-player] ❌ resolve 失败:', role, url, err)
      if (!cancelled) setCachedUrl(url)
    })

    return () => {
      cancelled = true
    }
  }, [role, url])

  return cachedUrl
}

function loadVnPlayerSettings(): VnPlayerSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const saved = JSON.parse(raw) as Partial<VnPlayerSettings>
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function VnPlayer({
  backgroundUrl,
  backgroundFit = 'cover',
  currentLine,
  history = [],
  choices = [],
  currentSpriteUrl,
  spritePosition = 'left',
  currentAvatarUrl,
  currentAvatarAlt,
  isWaiting = false,
  isEnded = false,
  onAdvance,
  onChoice,
  onSubmitInput,
  inputFeedback,
  inputFeedbackChat,
  inputGuidance,
  inputDisabled,
  onReset,
  endedActions,
  onHistoryOpenChange,
  className,
  stageClassName,
  frameVariant = 'portrait',
  showHistoryButton = true,
  hideChatTopBar = false,
  onDisplayModeChange,
  showUserInputOverride,
  onWordInsight,
  ref,
}: VnPlayerProps & { ref?: Ref<VnPlayerHandle> }) {
  const { t } = useTranslation()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<VnPlayerSettings>(() => loadVnPlayerSettings())
  const showUserInput = showUserInputOverride ?? settings.showUserInputInDialogue
  const [reviewLineIndex, setReviewLineIndex] = useState<number | null>(null)
  const [displayedText, setDisplayedText] = useState(currentLine?.text ?? '')
  const typewriterTimerRef = useRef<number | null>(null)

  // ★ Signal that VN player is active — PixiAnimatedBackground pauses when this is set
  useEffect(() => {
    document.body.dataset.vnActive = 'true'
    return () => {
      delete document.body.dataset.vnActive
    }
  }, [])
  const autoAdvanceTimerRef = useRef<number | null>(null)
  const lineIndex = reviewLineIndex ?? Math.max(history.length - 1, 0)
  const reviewLine = reviewLineIndex !== null ? history[reviewLineIndex] : null
  const activeLine = reviewLine ?? currentLine
  const displayLine = activeLine?.isUser && reviewLineIndex === null && !showUserInput ? null : activeLine
  const fullText = displayLine?.text ?? ''
  const fullTranslation = displayLine?.translation ?? ''
  const displayedTranslation = fullText
    ? fullTranslation.slice(0, Math.ceil((displayedText.length / fullText.length) * fullTranslation.length))
    : fullTranslation
  const audioUrl = displayLine?.audioUrl
  const cachedBackgroundUrl = useCachedAssetUrl(backgroundUrl, 'background')
  const cachedSpriteUrl = useCachedAssetUrl(currentSpriteUrl, 'sprite')
  // 注意：音频不使用 useCachedAssetUrl，而是直接在 effect 内 resolve，
  // 避免 cached URL 切换触发 effect 重跑导致重复播放/中断。
  const cachedAudioUrl = useCachedAssetUrl(audioUrl, displayLine?.isUser ? 'recording' : 'voice')

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    onDisplayModeChange?.(settings.displayMode)
  }, [onDisplayModeChange, settings])

  useEffect(() => {
    setReviewLineIndex(null)
  }, [currentLine?.text, currentLine?.speaker])

  useEffect(() => {
    if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current)
    setDisplayedText('')
    if (!fullText) return

    if (!settings.typewriter) {
      setDisplayedText(fullText)
      return
    }

    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setDisplayedText(fullText.slice(0, index))
      if (index >= fullText.length) {
        window.clearInterval(timer)
        if (typewriterTimerRef.current === timer) typewriterTimerRef.current = null
      }
    }, 18)
    typewriterTimerRef.current = timer

    return () => {
      window.clearInterval(timer)
      if (typewriterTimerRef.current === timer) typewriterTimerRef.current = null
    }
  }, [fullText, settings.typewriter])

  // ── 音频自动播放（只依赖 audioUrl，内部 resolve cached URL）──
  const playingAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!audioUrl) return

    // 停止前一段音频
    if (playingAudioRef.current) {
      playingAudioRef.current.pause()
      playingAudioRef.current.removeAttribute('src')
      playingAudioRef.current = null
    }

    let cancelled = false

    assetCacheService.resolve({ url: audioUrl, role: 'voice' }).then((resolvedUrl) => {
      if (cancelled || !resolvedUrl) return
      const audio = new Audio(resolvedUrl)
      audio.preload = 'auto'
      playingAudioRef.current = audio

      audio.play().catch((err) => {
        if (isNative() && err.name === 'AbortError') {
          audio.addEventListener('canplay', () => audio.play().catch(() => {}), { once: true })
        } else {
          console.warn('[VnPlayer] Audio play failed:', err.message)
        }
      })
    })

    return () => {
      cancelled = true
      if (playingAudioRef.current) {
        playingAudioRef.current.pause()
        playingAudioRef.current.removeAttribute('src')
        playingAudioRef.current = null
      }
    }
  }, [audioUrl])

  const toggleHistory = (value: boolean) => {
    setHistoryOpen(value)
    onHistoryOpenChange?.(value)
  }
  useImperativeHandle(ref, () => ({
    toggleHistory: (open?: boolean) => toggleHistory(open ?? !historyOpen),
    toggleSettings: (open?: boolean) => setSettingsOpen(open ?? !settingsOpen),
  }), [historyOpen, settingsOpen])
  const isTyping = !!fullText && displayedText.length < fullText.length
  const canAdvance = !!onAdvance && !isEnded && !isWaiting && choices.length === 0 && !historyOpen && !settingsOpen && reviewLineIndex === null && !isTyping
  const canInteract = !!onAdvance && !isEnded && !isWaiting && choices.length === 0 && !historyOpen && !settingsOpen && settings.displayMode !== 'chat'
  const canSubmitInput = reviewLineIndex === null && !!onSubmitInput && isWaiting && !activeLine?.isUser && !isEnded && choices.length === 0 && !historyOpen && !settingsOpen

  useEffect(() => {
    if (autoAdvanceTimerRef.current !== null) window.clearTimeout(autoAdvanceTimerRef.current)
    if (!settings.autoAdvance || !canAdvance) return

    const timer = window.setTimeout(() => {
      onAdvance?.()
    }, settings.autoAdvanceDelay * 1000)
    autoAdvanceTimerRef.current = timer

    return () => {
      window.clearTimeout(timer)
      if (autoAdvanceTimerRef.current === timer) autoAdvanceTimerRef.current = null
    }
  }, [canAdvance, onAdvance, settings.autoAdvance, settings.autoAdvanceDelay, fullText])

  // Auto-advance when story can continue but nothing to display (no line, no choices)
  useEffect(() => {
    if (!canAdvance || displayLine || choices.length > 0 || isEnded) return
    const timer = window.setTimeout(() => {
      onAdvance?.()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [canAdvance, displayLine, choices.length, isEnded, onAdvance])

  const goToPreviousLine = () => {
    if (history.length <= 1) return
    setReviewLineIndex(Math.max(0, lineIndex - 1))
  }

  // ── Chat list mode ──
  if (settings.displayMode === 'chat') {
    return (
      <>
        <DialogueListView
          backgroundUrl={cachedBackgroundUrl}
          backgroundFit={backgroundFit}
          currentLine={currentLine}
          history={history}
          choices={choices}
          currentAvatarUrl={currentAvatarUrl}
          currentAvatarAlt={currentAvatarAlt}
          isWaiting={isWaiting}
          isEnded={isEnded}
          onAdvance={onAdvance}
          onChoice={onChoice}
          onSubmitInput={onSubmitInput}
          inputFeedback={inputFeedbackChat ?? inputFeedback}
          inputGuidance={inputGuidance}
          inputDisabled={inputDisabled}
          onReset={onReset}
          endedActions={endedActions}
          onHistoryOpenChange={onHistoryOpenChange}
          className={className}
          showHistoryButton={showHistoryButton}
          fontSize={settings.fontSize}
          bilingual={settings.bilingual}
          showUserInputInDialogue={showUserInput}
          onSettingsOpen={() => setSettingsOpen(true)}
          hideTopBar={hideChatTopBar}
          historyOpen={historyOpen}
          onToggleHistory={toggleHistory}
          onWordInsight={onWordInsight}
          typewriter={settings.typewriter}
        />
        <VnSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          onSettingsChange={setSettings}
        />
      </>
    )
  }

  return (
    <div className={cn(
      'relative mx-auto flex w-full flex-col overflow-hidden bg-black text-white sm:rounded-xl sm:border sm:border-border',
      frameVariant === 'landscape'
        ? 'aspect-[852/393] h-auto max-h-[393px] max-w-[852px]'
        : 'h-full max-w-[520px]',
      className,
    )}>
      <div
        role="button"
        tabIndex={canInteract || reviewLineIndex !== null ? 0 : -1}
        aria-label="推进对话"
        className={cn(
          'relative flex-1 overflow-hidden text-left outline-none',
          frameVariant === 'landscape' ? 'min-h-0' : 'min-h-[620px]',
          (canInteract || reviewLineIndex !== null) && 'cursor-pointer',
          stageClassName,
        )}
        onClick={() => {
          // 回顾模式：每点一次前进一行，走到最新行才退出回顾
          if (reviewLineIndex !== null) {
            const next = reviewLineIndex + 1
            if (next >= history.length) {
              setReviewLineIndex(null)
            } else {
              setReviewLineIndex(next)
            }
            return
          }
          if (!canInteract) return
          // 打字机播放中 → 优先跳过动画
          if (isTyping) {
            if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current)
            typewriterTimerRef.current = null
            setDisplayedText(fullText)
            return
          }
          onAdvance?.()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            // 回顾模式：每按一次前进一行，走到最新行才退出回顾
            if (reviewLineIndex !== null) {
              const next = reviewLineIndex + 1
              if (next >= history.length) {
                setReviewLineIndex(null)
              } else {
                setReviewLineIndex(next)
              }
              return
            }
            if (!canInteract) return
            if (isTyping) {
              if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current)
              typewriterTimerRef.current = null
              setDisplayedText(fullText)
              return
            }
            onAdvance?.()
          }
        }}
      >
        <PixiVnStage backgroundUrl={cachedBackgroundUrl} backgroundFit={backgroundFit} spriteUrl={cachedSpriteUrl} spritePosition={spritePosition} stageVariant={frameVariant} />
        {onReset && (
          <div className="absolute right-3 top-3 z-30 flex gap-2">
            <span
              role="button"
              tabIndex={0}
              className="flex size-9 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-md transition-colors hover:bg-black/70 hover:text-white"
              onClick={(event) => { event.stopPropagation(); onReset() }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  onReset()
                }
              }}
            >
              <RotateCcw className="size-4" />
            </span>
          </div>
        )}

        {historyOpen && (
          <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm p-4" onClick={(event) => event.stopPropagation()}>
            <div className="ml-auto flex h-full w-full max-w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('vnHistory.title')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('vnHistory.count', { count: history.length })}</p>
                </div>
                <button
                  type="button"
                  className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => toggleHistory(false)}
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4">
                {history.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">{t('vnHistory.empty')}</p>
                ) : history.map((line, index) => (
                  <div key={index} className={cn('rounded-lg border px-3 py-2', line.isUser ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/40')}>
                    {line.speaker && <p className="mb-1 text-xs font-semibold text-muted-foreground">{line.speaker}</p>}
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{line.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {choices.length > 0 && (
          <div className="absolute inset-x-5 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
            {choices.map((choice) => (
              <span
                key={choice.index}
                role="button"
                tabIndex={0}
                className="rounded-lg border border-border/60 bg-background/90 px-4 py-3 text-center text-sm font-medium text-foreground shadow-lg transition-colors hover:border-primary/40 hover:bg-primary/10"
                onClick={(event) => { event.stopPropagation(); onChoice?.(choice.index) }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    onChoice?.(choice.index)
                  }
                }}
              >
                {choice.text}
              </span>
            ))}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-20" data-keyboard-lift>
          {canSubmitInput && (
            <TurnGuidanceCard guidance={inputGuidance} className="absolute right-4 bottom-full max-w-[min(88%,360px)]" />
          )}
          {displayLine?.speaker && (
            <div className="absolute left-4 top-0 z-10 inline-flex h-8 max-w-[52%] -translate-y-1/2 items-center gap-1.5 rounded-full border border-primary/20 bg-background/90 px-3 shadow-[0_6px_22px_rgba(15,23,42,.09)] ring-1 ring-primary/[0.08] backdrop-blur-2xl">
              <span className="size-1.5 shrink-0 rounded-full bg-primary/65" />
              <span className="truncate text-xs font-semibold text-foreground/80">{displayLine.speaker}</span>
            </div>
          )}
          <div className="absolute right-4 top-0 z-10 flex h-8 -translate-y-1/2 items-center gap-0.5 rounded-full border border-primary/20 bg-background/90 px-1 shadow-[0_6px_22px_rgba(15,23,42,.09)] ring-1 ring-primary/[0.08] backdrop-blur-2xl">
            {displayLine?.isUser && cachedAudioUrl && (
              <VnIconButton
                label="回放录音"
                onClick={() => {
                  const audio = new Audio(cachedAudioUrl)
                  audio.play().catch(() => {})
                }}
              >
                <Volume2 className="size-3.5" />
              </VnIconButton>
            )}
            <VnIconButton
              label={t('vnHistory.prevLine')}
              disabled={history.length <= 1 || lineIndex <= 0}
              onClick={goToPreviousLine}
            >
              <SkipBack className="size-3.5" />
            </VnIconButton>
            {showHistoryButton && (
              <VnIconButton label={t('vnHistory.title')} onClick={() => toggleHistory(!historyOpen)}>
                <History className="size-3.5" />
              </VnIconButton>
            )}
            <VnIconButton label={t('vnSettings.title')} onClick={() => setSettingsOpen(true)}>
              <Settings className="size-3.5" />
            </VnIconButton>
          </div>
          <div className={cn(
            'flex flex-col border-t border-border/55 bg-background/90 text-foreground shadow-[0_-18px_56px_rgba(15,23,42,.18)] backdrop-blur-2xl',
            frameVariant === 'landscape'
              ? 'min-h-[88px] max-h-[126px]'
              : inputFeedback
                ? 'min-h-[clamp(148px,24dvh,196px)] max-h-[58dvh] sm:max-h-[52dvh]'
                : 'min-h-[clamp(148px,24dvh,196px)] max-h-[34dvh]',
          )}>
            <div className="min-h-0 flex-1 overflow-y-auto relative">
              {displayLine ? (
                <div className="flex min-h-full items-start py-3 pl-4 pr-4">
                  {currentAvatarUrl && !displayLine.isUser && (
                    <img
                      src={currentAvatarUrl}
                      alt={currentAvatarAlt || displayLine.speaker || ''}
                      className="mt-3 size-[72px] shrink-0 rounded-2xl object-cover ring-1 ring-border/70"
                    />
                  )}
                  <div className={cn(
                    'min-w-0 space-y-2 pt-2',
                    currentAvatarUrl && !displayLine.isUser ? 'ml-3' : '',
                  )}>
                    <p className="whitespace-pre-wrap font-medium leading-relaxed text-foreground" style={{ fontSize: settings.fontSize }}>
                      <TappableText text={displayedText} onWordDetail={onWordInsight} />
                      {canAdvance && (
                        <span className="ml-1 inline-block h-0 w-0 animate-bounce border-x-[4px] border-t-[6px] border-x-transparent border-t-primary/70 align-middle" />
                      )}
                    </p>
                    {settings.bilingual && displayLine.translation && (
                      <p className="text-xs l sm:rounded-2xltext-muted-foreground">{displayedTranslation}</p>
                    )}
                  </div>
                </div>
              ) : isEnded ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <p className="text-center text-sm text-muted-foreground">{t('vnHistory.storyEnded')}</p>
                  {endedActions}
                </div>
              ) : isWaiting ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/45" style={{ animationDelay: '0ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/45" style={{ animationDelay: '150ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/45" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/45" style={{ animationDelay: '0ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/45" style={{ animationDelay: '150ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-foreground/45" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              )}
            </div>
            {inputFeedback}
            {canSubmitInput && (
              <VnInputPanel onSubmit={onSubmitInput} disabled={inputDisabled} />
            )}
          </div>
        </div>
      </div>
      <VnSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  )
}

function VnIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="flex size-7 items-center justify-center rounded-full text-foreground/55 transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

function VnSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: VnPlayerSettings
  onSettingsChange: (settings: VnPlayerSettings) => void
}) {
  const { t } = useTranslation()
  const update = (patch: Partial<VnPlayerSettings>) => onSettingsChange({ ...settings, ...patch })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl w-[90vw]">
        <DialogHeader>
          <DialogTitle>{t('vnSettings.title')}</DialogTitle>
          <DialogDescription>{t('vnSettings.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Font Size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('vnSettings.fontSize')}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{settings.fontSize}px</span>
            </div>
            <Slider
              min={12}
              max={22}
              step={1}
              value={[settings.fontSize]}
              onValueChange={([fontSize]) => update({ fontSize })}
            />
          </div>

          <Separator />

          {/* Auto Advance */}
          <div className="space-y-4">
            <SettingSwitch
              label={t('vnSettings.autoAdvance')}
              checked={settings.autoAdvance}
              onCheckedChange={(autoAdvance) => update({ autoAdvance })}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className={cn('text-sm', !settings.autoAdvance && 'text-muted-foreground/50')}>
                  {t('vnSettings.autoAdvanceDelay')}
                </Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {settings.autoAdvanceDelay.toFixed(1)} {t('vnSettings.seconds')}
                </span>
              </div>
              <Slider
                min={1}
                max={8}
                step={0.5}
                value={[settings.autoAdvanceDelay]}
                onValueChange={([autoAdvanceDelay]) => update({ autoAdvanceDelay })}
                disabled={!settings.autoAdvance}
              />
            </div>
          </div>

          <Separator />

          {/* Display Mode */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('vnSettings.displayMode')}</Label>
            <div className="flex rounded-lg bg-muted p-0.5">
              <button
                type="button"
                className={cn(
                  'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
                  settings.displayMode === 'vn' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => update({ displayMode: 'vn' })}
              >
                {t('vnSettings.displayModeVn')}
              </button>
              <button
                type="button"
                className={cn(
                  'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
                  settings.displayMode === 'chat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => update({ displayMode: 'chat' })}
              >
                {t('vnSettings.displayModeChat')}
              </button>
            </div>
          </div>

          <Separator />

          {/* Display Options */}
          <div className="space-y-4">
            <SettingSwitch
              label="打字机效果"
              checked={settings.typewriter}
              onCheckedChange={(typewriter) => update({ typewriter })}
            />

            <SettingSwitch
              label={t('vnSettings.bilingual')}
              checked={settings.bilingual}
              onCheckedChange={(bilingual) => update({ bilingual })}
            />

            <SettingSwitch
              label={t('vnSettings.showUserInput')}
              checked={settings.showUserInputInDialogue}
              onCheckedChange={(showUserInputInDialogue) => update({ showUserInputInDialogue })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SettingSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted/60">
      <Label className="cursor-pointer text-sm font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
