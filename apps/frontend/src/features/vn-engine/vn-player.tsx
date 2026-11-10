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
import { resolveDisplayAssetUrl } from '@/lib/file-asset-reference'
import { assetCacheService, OFFLINE_RESOURCE_MISSING } from '@/lib/offline/asset-cache.service'
import { isNative } from '@/lib/native'
import { VnInputPanel, type VnInputRecording } from './vn-input-panel'
import { DialogueListView } from './dialogue-list-view'
import { TappableText } from './dialogue-list-view'
import { TurnGuidanceCard, type VnTurnGuidance } from './practice-guidance'
import { PixiVnStage, type BackgroundFit, type StageVariant } from './pixi-vn-stage'
import { vnTextureRuntime } from './vn-texture-runtime'

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
  portraitScale?: number
  currentAvatarUrl?: string
  currentAvatarAlt?: string
  isWaiting?: boolean
  isEnded?: boolean
  onAdvance?: () => void
  onChoice?: (index: number) => void
  onSubmitInput?: (text: string, audioUrl?: string, recording?: VnInputRecording) => void | Promise<void>
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
  /** Installed Capacitor package: URLs must already be local; never fetch. */
  offlineOnly?: boolean
  onWordInsight?: (word: string) => void
  /** 房间画面已经在底下，对白层不要先铺黑底。 */
  clearBackdrop?: boolean
  /** 片段对白结束，不显示「故事结束」。 */
  hideEndedCaption?: boolean
  /** 片段已经结束时，点击对话区域关闭。设置和历史不受影响。 */
  onDismiss?: () => void
  /** NQTR 等场景只支持 VN 剧场，隐藏设置里的显示模式切换。 */
  hideDisplayMode?: boolean
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

function usableCachedAssetUrl(resolved?: string | null, fallback?: string) {
  if (!resolved || resolved === OFFLINE_RESOURCE_MISSING) return fallback
  return resolveDisplayAssetUrl(resolved) ?? fallback
}

/** Local pack / same-origin content URLs stay usable even when offlineOnly blocks COS. */
function isOfflineSafePlaybackUrl(url?: string | null) {
  if (!url) return false
  if (/^(data:|blob:|file:|capacitor:|asset:)/i.test(url)) return true
  if (/^https?:\/\/localhost\/_capacitor_file_/i.test(url)) return true
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://manyu.local')
    if (parsed.pathname.includes('/file-assets/') && parsed.pathname.endsWith('/content')) return true
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) return true
  } catch {
    return false
  }
  return false
}

function sameDialogueLine(a?: VnPlayerLine | null, b?: VnPlayerLine | null) {
  return Boolean(a && b
    && a.text === b.text
    && a.speaker === b.speaker
    && Boolean(a.isUser) === Boolean(b.isUser))
}

function useCachedAssetUrl(url?: string, role?: string, offlineOnly = false) {
  const allowRemoteFallback = !offlineOnly || isOfflineSafePlaybackUrl(url)
  const [cachedUrl, setCachedUrl] = useState(allowRemoteFallback ? resolveDisplayAssetUrl(url) : undefined)

  useEffect(() => {
    let cancelled = false
    const displayUrl = resolveDisplayAssetUrl(url)
    const allowFallback = !offlineOnly || isOfflineSafePlaybackUrl(url)
    // Package mode: only mount local / same-origin content URLs, never COS.
    if (!allowFallback && url?.startsWith('http')) {
      setCachedUrl(undefined)
    } else {
      setCachedUrl(displayUrl)
    }
    if (!canCacheAssetUrl(url)) return

    assetCacheService.resolve({ url, role, offlineOnly }).then((resolved) => {
      if (!cancelled) {
        setCachedUrl(usableCachedAssetUrl(resolved, allowFallback ? displayUrl : undefined))
      }
    }).catch((err) => {
      if (role === 'background' || role === 'sprite') console.warn('[vn-player] ❌ resolve 失败:', role, url, err)
      if (!cancelled) setCachedUrl(allowFallback ? displayUrl : undefined)
    })

    return () => {
      cancelled = true
    }
  }, [offlineOnly, role, url])

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
  portraitScale,
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
  offlineOnly = false,
  onWordInsight,
  clearBackdrop = false,
  hideEndedCaption = false,
  onDismiss,
  hideDisplayMode = false,
  ref,
}: VnPlayerProps & { ref?: Ref<VnPlayerHandle> }) {
  const { t } = useTranslation()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<VnPlayerSettings>(() => loadVnPlayerSettings())
  const effectiveSettings = hideDisplayMode && settings.displayMode !== 'vn'
    ? { ...settings, displayMode: 'vn' as const }
    : settings
  const showUserInput = showUserInputOverride ?? effectiveSettings.showUserInputInDialogue
  const [reviewLineIndex, setReviewLineIndex] = useState<number | null>(null)
  const [displayedText, setDisplayedText] = useState(currentLine?.text ?? '')
  const typewriterTimerRef = useRef<number | null>(null)

  // ★ Signal that VN player is active — PixiAnimatedBackground pauses when this is set
  useEffect(() => {
    document.body.dataset.vnActive = 'true'
    return () => {
      delete document.body.dataset.vnActive
      vnTextureRuntime.clear()
    }
  }, [])
  const autoAdvanceTimerRef = useRef<number | null>(null)
  // Callers historically disagreed on whether `history` contains currentLine.
  // Normalize it here so all VN surfaces replay the same complete turn order.
  const reviewTimeline = currentLine && !sameDialogueLine(history.at(-1), currentLine)
    ? [...history, currentLine]
    : history
  const currentLineIndex = currentLine
    ? reviewTimeline.findLastIndex((line) => sameDialogueLine(line, currentLine))
    : Math.max(reviewTimeline.length - 1, 0)
  // Ended is a virtual round AFTER the last dialogue line. Live cursor sits on
  // that slot (index === length) so "上一轮" can land on the real last turn —
  // including when that turn is the user's answer.
  const liveCursorIndex = isEnded
    ? reviewTimeline.length
    : Math.max(currentLineIndex, 0)
  const lineIndex = reviewLineIndex ?? liveCursorIndex
  const reviewLine = reviewLineIndex !== null ? reviewTimeline[reviewLineIndex] : null
  // Live ended slot has no dialogue of its own — only end actions.
  const activeLine = reviewLine ?? (isEnded ? null : currentLine)
  const displayLine = activeLine?.isUser && reviewLineIndex === null && !showUserInput ? null : activeLine
  const fullText = displayLine?.text ?? ''
  const fullTranslation = displayLine?.translation ?? ''
  const displayedTranslation = fullText
    ? fullTranslation.slice(0, Math.ceil((displayedText.length / fullText.length) * fullTranslation.length))
    : fullTranslation
  const audioUrl = displayLine?.audioUrl
  const cachedBackgroundUrl = useCachedAssetUrl(backgroundUrl, 'background', offlineOnly)
  const cachedSpriteUrl = useCachedAssetUrl(currentSpriteUrl, 'sprite', offlineOnly)
  // Button / manual replay uses the cached URL; autoplay resolves separately so
  // cache URL swaps don't restart the clip mid-play.
  const cachedAudioUrl = useCachedAssetUrl(audioUrl, displayLine?.isUser ? 'recording' : 'voice', offlineOnly)

  // Prefetch GPU decode for the live scene (CSS underlay paints first).
  useEffect(() => {
    vnTextureRuntime.warmup([cachedBackgroundUrl, cachedSpriteUrl])
  }, [cachedBackgroundUrl, cachedSpriteUrl])

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
    const allowFallback = !offlineOnly || isOfflineSafePlaybackUrl(audioUrl)

    const playResolved = (playable: string) => {
      if (cancelled || !playable) return
      const audio = new Audio(playable)
      audio.preload = 'auto'
      playingAudioRef.current = audio

      audio.play().catch((err) => {
        if (isNative() && err.name === 'AbortError') {
          audio.addEventListener('canplay', () => audio.play().catch(() => {}), { once: true })
        } else {
          console.warn('[VnPlayer] Audio play failed:', err.message)
        }
      })
    }

    // data:/blob: audio is already playable — never send it through offline cache.
    if (!canCacheAssetUrl(audioUrl)) {
      playResolved(audioUrl)
    } else {
      assetCacheService.resolve({ url: audioUrl, role: 'voice', offlineOnly }).then((resolvedUrl) => {
        playResolved(usableCachedAssetUrl(resolvedUrl, allowFallback ? audioUrl : undefined) ?? '')
      })
    }

    return () => {
      cancelled = true
      if (playingAudioRef.current) {
        playingAudioRef.current.pause()
        playingAudioRef.current.removeAttribute('src')
        playingAudioRef.current = null
      }
    }
  }, [audioUrl, offlineOnly])

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
  const canInteract = !!onAdvance && !isEnded && !isWaiting && choices.length === 0 && !historyOpen && !settingsOpen && effectiveSettings.displayMode !== 'chat'
  const canSubmitInput = reviewLineIndex === null && !!onSubmitInput && isWaiting && !activeLine?.isUser && !isEnded && choices.length === 0 && !historyOpen && !settingsOpen
  // End actions live only on the virtual ended round, not while reviewing lines.
  const showEndedUi = isEnded && reviewLineIndex === null
  const canStepPrevious = isEnded && reviewLineIndex === null
    ? reviewTimeline.length > 0
    : lineIndex > 0

  const stepReviewForward = () => {
    if (reviewLineIndex === null) return false
    const next = reviewLineIndex + 1
    // Past the last dialogue line → leave review. If ended, that returns to the
    // virtual ended round; otherwise back to the live current line.
    setReviewLineIndex(next >= reviewTimeline.length ? null : next)
    return true
  }

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
    if (!canStepPrevious) return
    if (isEnded && reviewLineIndex === null) {
      setReviewLineIndex(reviewTimeline.length - 1)
      return
    }
    setReviewLineIndex(lineIndex - 1)
  }

  // ── Chat list mode ──
  if (effectiveSettings.displayMode === 'chat') {
    return (
      <>
        <DialogueListView
          backgroundUrl={cachedBackgroundUrl}
          backgroundFit={backgroundFit}
          currentLine={currentLine}
          history={reviewTimeline}
          choices={choices}
          currentAvatarUrl={currentAvatarUrl}
          currentAvatarAlt={currentAvatarAlt}
          isWaiting={isWaiting}
          isEnded={isEnded}
          hideEndedCaption={hideEndedCaption}
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
          hideDisplayMode={hideDisplayMode}
        />
      </>
    )
  }

  return (
    <div className={cn(
      'relative mx-auto flex w-full flex-col overflow-hidden text-white',
      clearBackdrop ? 'bg-transparent' : 'bg-black',
      frameVariant === 'landscape'
        ? 'aspect-[852/393] h-auto max-h-[393px] max-w-[852px]'
        : 'h-full max-w-[520px]',
      className,
    )}>
      <div
        role="button"
        tabIndex={canInteract || reviewLineIndex !== null ? 0 : -1}
        aria-label={t('vnSettings.advanceDialogue')}
        className={cn(
          'relative flex-1 overflow-hidden text-left outline-none',
          frameVariant === 'landscape' ? 'min-h-0' : clearBackdrop ? 'min-h-0' : 'min-h-[620px]',
          (canInteract || reviewLineIndex !== null) && 'cursor-pointer',
          stageClassName,
        )}
        onClick={() => {
          // 回顾模式：每点一次前进一行；越过最后一句回到 live（含结束虚拟轮）
          if (stepReviewForward()) return
          if (!canInteract) {
            if (isEnded && !historyOpen && !settingsOpen) onDismiss?.()
            return
          }
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
            if (stepReviewForward()) return
            if (!canInteract) {
              if (isEnded && !historyOpen && !settingsOpen) onDismiss?.()
              return
            }
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
        <PixiVnStage backgroundUrl={cachedBackgroundUrl} backgroundFit={backgroundFit} spriteUrl={cachedSpriteUrl} spritePosition={spritePosition} portraitScale={portraitScale} stageVariant={frameVariant} clearBackdrop={clearBackdrop} />
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
            <div className="ml-auto flex h-full w-full max-w-[360px] flex-col overflow-hidden bg-background text-foreground">
              <div className="flex items-center justify-between bg-muted/30 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('vnHistory.title')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('vnHistory.count', { count: reviewTimeline.length })}</p>
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
                {reviewTimeline.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">{t('vnHistory.empty')}</p>
                ) : reviewTimeline.map((line, index) => (
                  <div key={index} className={cn('rounded-lg px-3 py-2', line.isUser ? 'bg-primary/10' : 'bg-muted/40')}>
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
                className="rounded-lg bg-background/90 px-4 py-3 text-center text-sm font-medium text-foreground shadow-lg"
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
            <div className="absolute left-4 top-0 z-10 inline-flex h-8 max-w-[52%] -translate-y-1/2 items-center gap-1.5 rounded-full bg-background/90 px-3 shadow-[0_6px_22px_rgba(15,23,42,.09)] backdrop-blur-2xl">
              <span className="size-1.5 shrink-0 rounded-full bg-primary/65" />
              <span className="truncate text-xs font-semibold text-foreground/80">{displayLine.speaker}</span>
            </div>
          )}
          <div className="absolute right-4 top-0 z-10 flex h-8 -translate-y-1/2 items-center gap-0.5 rounded-full bg-background/90 px-1 shadow-[0_6px_22px_rgba(15,23,42,.09)] backdrop-blur-2xl">
            {cachedAudioUrl && (
              <VnIconButton
                label={displayLine?.isUser ? t('vnSettings.playbackRecording') : t('practiceSession.warmupDrill.playAudio')}
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
              disabled={!canStepPrevious}
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
            'flex flex-col bg-background/90 text-foreground shadow-[0_-18px_56px_rgba(15,23,42,.18)] backdrop-blur-2xl',
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
                      className="mt-3 size-[72px] shrink-0 rounded-2xl object-cover"
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
                      <p className="text-xs text-muted-foreground">{displayedTranslation}</p>
                    )}
                  </div>
                </div>
              ) : showEndedUi ? (
                <div className="absolute inset-0 flex w-full flex-col items-stretch justify-center gap-3 px-4">
                  {!hideEndedCaption && (
                    <p className="text-center text-sm text-muted-foreground">{t('vnHistory.storyEnded')}</p>
                  )}
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
        hideDisplayMode={hideDisplayMode}
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
  hideDisplayMode = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: VnPlayerSettings
  onSettingsChange: (settings: VnPlayerSettings) => void
  hideDisplayMode?: boolean
}) {
  const { t } = useTranslation()
  const update = (patch: Partial<VnPlayerSettings>) => onSettingsChange({ ...settings, ...patch })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Above fullscreen practice-record replay (z-70/71) and similar shells.
        overlayClassName="z-[80]"
        className="z-[81] max-w-sm rounded-2xl w-[90vw]"
      >
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

          {!hideDisplayMode && (
            <>
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
            </>
          )}

          <Separator />

          {/* Display Options */}
          <div className="space-y-4">
            <SettingSwitch
              label={t('vnSettings.typewriter')}
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
