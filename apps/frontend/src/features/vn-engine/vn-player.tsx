import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { History, RotateCcw, Settings, SkipBack, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Application, Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js'
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
import { VnInputPanel } from './vn-input-panel'
import { DialogueListView } from './dialogue-list-view'

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
  onSubmitInput?: (text: string) => void | Promise<void>
  inputFeedback?: ReactNode
  inputFeedbackChat?: ReactNode
  inputDisabled?: boolean
  onReset?: () => void
  endedActions?: ReactNode
  onHistoryOpenChange?: (open: boolean) => void
  className?: string
  stageClassName?: string
  showHistoryButton?: boolean
  /** Hide the top bar in chat-list mode (e.g. when parent provides its own header) */
  hideChatTopBar?: boolean
}

interface VnPlayerSettings {
  fontSize: number
  autoAdvance: boolean
  autoAdvanceDelay: number
  bilingual: boolean
  showUserInputInDialogue: boolean
  displayMode: 'vn' | 'chat'
}

const DEFAULT_SETTINGS: VnPlayerSettings = {
  fontSize: 14,
  autoAdvance: false,
  autoAdvanceDelay: 2.5,
  bilingual: false,
  showUserInputInDialogue: true,
  displayMode: 'vn',
}

const SETTINGS_STORAGE_KEY = 'vn-player-settings'

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

export type BackgroundFit = 'cover' | 'contain' | 'stretch' | 'repeat'

interface PixiVnStageProps {
  backgroundUrl?: string
  backgroundFit: BackgroundFit
  spriteUrl?: string
  spritePosition: 'left' | 'center' | 'right'
}

function fitCover(sprite: Sprite, width: number, height: number) {
  const scale = Math.max(width / (sprite.texture.width || 1), height / (sprite.texture.height || 1))
  sprite.scale.set(scale)
  sprite.anchor.set(0.5)
  sprite.position.set(width / 2, height / 2)
}

function fitBackground(sprite: Sprite | TilingSprite, width: number, height: number, fit: BackgroundFit) {
  if (sprite instanceof TilingSprite) {
    sprite.position.set(0, 0)
    sprite.width = width
    sprite.height = height
    sprite.tileScale.set(1)
    return
  }

  const textureWidth = sprite.texture.width || 1
  const textureHeight = sprite.texture.height || 1

  if (fit === 'stretch') {
    sprite.anchor.set(0)
    sprite.position.set(0, 0)
    sprite.width = width
    sprite.height = height
    return
  }

  const scale = fit === 'contain'
    ? Math.min(width / textureWidth, height / textureHeight)
    : Math.max(width / textureWidth, height / textureHeight)
  sprite.scale.set(scale)
  sprite.anchor.set(0.5)
  sprite.position.set(width / 2, height / 2)
}

function getDialogueHeight(height: number) {
  return Math.min(Math.max(height * 0.24, 148), 196)
}

function layoutSprite(sprite: Sprite, width: number, height: number, position: 'left' | 'center' | 'right') {
  const dialogueHeight = getDialogueHeight(height)
  const stageTopInset = 58
  const spriteOverlap = 32
  const availableHeight = Math.max(height - stageTopInset - dialogueHeight + spriteOverlap, height * 0.5)
  const scale = Math.min(availableHeight / (sprite.texture.height || 1), (width * 0.82) / (sprite.texture.width || 1))
  sprite.scale.set(scale)
  sprite.anchor.set(0.5, 1)
  sprite.y = height - dialogueHeight + spriteOverlap
  sprite.x = position === 'center' ? width / 2 : position === 'right' ? width * 0.72 : width * 0.28
}

const BgFitStyle: Record<BackgroundFit, string> = {
  cover: 'cover',
  contain: 'contain',
  stretch: '100% 100%',
  repeat: 'auto',
}

/** CSS-only fallback when PixiJS fails to initialize */
function CssFallbackStage({ backgroundUrl, backgroundFit, spriteUrl, spritePosition }: PixiVnStageProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
          backgroundSize: BgFitStyle[backgroundFit],
          backgroundPosition: 'center',
          backgroundRepeat: backgroundFit === 'repeat' ? 'repeat' : 'no-repeat',
        }}
      />
      {spriteUrl && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(clamp(148px,24dvh,196px)-32px)] top-[58px]">
          <img
            src={spriteUrl}
            alt=""
            className="absolute bottom-0 max-h-full max-w-[82%] select-none object-contain"
            style={{
              left: spritePosition === 'center' ? '50%' : spritePosition === 'right' ? '72%' : '28%',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      )}
    </div>
  )
}

function PixiVnStage({ backgroundUrl, backgroundFit, spriteUrl, spritePosition }: PixiVnStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const rootRef = useRef<Container | null>(null)
  const fallbackRef = useRef<Graphics | null>(null)
  const bgRef = useRef<Sprite | TilingSprite | null>(null)
  const spriteRef = useRef<Sprite | null>(null)
  const spritePositionRef = useRef(spritePosition)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const layout = () => {
    const app = appRef.current
    if (!app || !app.renderer) return
    const width = app.renderer.width
    const height = app.renderer.height

    if (fallbackRef.current) {
      fallbackRef.current.clear()
      fallbackRef.current.rect(0, 0, width, height).fill(0x1a1a2e)
    }
    if (bgRef.current) fitBackground(bgRef.current, width, height, backgroundFit)
    if (spriteRef.current) layoutSprite(spriteRef.current, width, height, spritePositionRef.current)
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    const root = new Container()
    const fallback = new Graphics()
    let resizeObserver: ResizeObserver | null = null

    async function init() {
      // Ensure host has non-zero dimensions before creating WebGL context
      if (host.clientWidth === 0 || host.clientHeight === 0) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (cancelled) return
      }

      let app: Application
      let initOk = false

      // Attempt 1: WebGL (default)
      app = new Application()
      try {
        await app.init({
          resizeTo: host,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        })
        initOk = true
      } catch {
        try { app.destroy(true) } catch { /* ignore */ }
      }

      // Attempt 2: Canvas2D fallback
      if (!initOk) {
        app = new Application()
        try {
          await app.init({
            resizeTo: host,
            backgroundAlpha: 0,
            antialias: true,
            autoDensity: true,
            resolution: Math.min(window.devicePixelRatio || 1, 2),
            preference: 'canvas',
          })
          initOk = true
        } catch {
          try { app.destroy(true) } catch { /* ignore */ }
        }
      }

      if (!initOk) {
        setFailed(true)
        return
      }

      if (cancelled) {
        try { app.destroy(true) } catch { /* ignore */ }
        return
      }

      appRef.current = app
      rootRef.current = root
      fallbackRef.current = fallback
      app.stage.addChild(root)
      root.addChild(fallback)
      app.canvas.className = 'absolute inset-0 h-full w-full'
      host.appendChild(app.canvas)
      resizeObserver = new ResizeObserver(layout)
      resizeObserver.observe(host)
      layout()
      setReady(true)
    }

    void init()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      const app = appRef.current
      if (app) {
        try {
          if (app.canvas && app.canvas.parentElement === host) {
            host.removeChild(app.canvas)
          }
        } catch { /* ignore */ }
        try { app.destroy(true) } catch { /* ignore */ }
      }
      appRef.current = null
      rootRef.current = null
      fallbackRef.current = null
      bgRef.current = null
      spriteRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function loadBackground() {
      const root = rootRef.current
      if (!root) return

      if (bgRef.current) {
        root.removeChild(bgRef.current)
        bgRef.current.destroy()
        bgRef.current = null
      }
      if (!backgroundUrl) {
        layout()
        return
      }

      try {
        const texture = await Assets.load<Texture>(backgroundUrl)
        if (cancelled || !rootRef.current) return
        const sprite = backgroundFit === 'repeat'
          ? new TilingSprite({ texture, width: 1, height: 1 })
          : new Sprite(texture)
        bgRef.current = sprite
        rootRef.current.addChildAt(sprite, 1)
        layout()
      } catch {
        layout()
      }
    }

    void loadBackground()
    return () => {
      cancelled = true
    }
  }, [backgroundFit, backgroundUrl, ready])

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function loadSprite() {
      const root = rootRef.current
      if (!root) return

      if (spriteRef.current) {
        root.removeChild(spriteRef.current)
        spriteRef.current.destroy()
        spriteRef.current = null
      }
      if (!spriteUrl) {
        layout()
        return
      }

      try {
        const texture = await Assets.load<Texture>(spriteUrl)
        if (cancelled || !rootRef.current) return
        const sprite = new Sprite(texture)
        sprite.alpha = 0
        spriteRef.current = sprite
        rootRef.current.addChild(sprite)
        layout()
        appRef.current?.ticker.addOnce(() => {
          if (spriteRef.current === sprite) sprite.alpha = 1
        })
      } catch {
        layout()
      }
    }

    void loadSprite()
    return () => {
      cancelled = true
    }
  }, [spriteUrl, ready])

  useEffect(() => {
    spritePositionRef.current = spritePosition
    layout()
  }, [spritePosition])

  if (failed) {
    return <CssFallbackStage backgroundUrl={backgroundUrl} backgroundFit={backgroundFit} spriteUrl={spriteUrl} spritePosition={spritePosition} />
  }

  return <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-black" />
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
  inputDisabled,
  onReset,
  endedActions,
  onHistoryOpenChange,
  className,
  stageClassName,
  showHistoryButton = true,
  hideChatTopBar = false,
  ref,
}: VnPlayerProps & { ref?: Ref<VnPlayerHandle> }) {
  const { t } = useTranslation()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<VnPlayerSettings>(() => loadVnPlayerSettings())
  const [reviewLineIndex, setReviewLineIndex] = useState<number | null>(null)
  const [displayedText, setDisplayedText] = useState(currentLine?.text ?? '')
  const typewriterTimerRef = useRef<number | null>(null)
  const autoAdvanceTimerRef = useRef<number | null>(null)
  const lineIndex = reviewLineIndex ?? Math.max(history.length - 1, 0)
  const reviewLine = reviewLineIndex !== null ? history[reviewLineIndex] : null
  const activeLine = reviewLine ?? currentLine
  const displayLine = activeLine?.isUser && reviewLineIndex === null && !settings.showUserInputInDialogue ? null : activeLine
  const fullText = displayLine?.text ?? ''
  const fullTranslation = displayLine?.translation ?? ''
  const displayedTranslation = fullText
    ? fullTranslation.slice(0, Math.ceil((displayedText.length / fullText.length) * fullTranslation.length))
    : fullTranslation
  const audioUrl = displayLine?.audioUrl

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    setReviewLineIndex(null)
  }, [currentLine?.text, currentLine?.speaker])

  useEffect(() => {
    if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current)
    setDisplayedText('')
    if (!fullText) return

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
  }, [fullText])

  useEffect(() => {
    if (!audioUrl) return
    console.log('[VnPlayer] Playing audio:', audioUrl.slice(0, 100))
    const audio = new Audio(audioUrl)
    const promise = audio.play()
    if (promise) {
      promise.catch((err) => console.warn('[VnPlayer] Audio play failed:', err.message))
    }
    return () => {
      audio.pause()
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
  const canSubmitInput = !!onSubmitInput && isWaiting && !activeLine?.isUser && !isEnded && choices.length === 0 && !historyOpen && !settingsOpen

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
          backgroundUrl={backgroundUrl}
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
          inputDisabled={inputDisabled}
          onReset={onReset}
          endedActions={endedActions}
          onHistoryOpenChange={onHistoryOpenChange}
          className={className}
          showHistoryButton={showHistoryButton}
          fontSize={settings.fontSize}
          bilingual={settings.bilingual}
          showUserInputInDialogue={settings.showUserInputInDialogue}
          onSettingsOpen={() => setSettingsOpen(true)}
          hideTopBar={hideChatTopBar}
          historyOpen={historyOpen}
          onToggleHistory={toggleHistory}
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
    <div className={cn('relative mx-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-black text-white sm:rounded-xl sm:border sm:border-border', className)}>
      <div
        role="button"
        tabIndex={canInteract ? 0 : -1}
        aria-label="推进对话"
        className={cn('relative min-h-[620px] flex-1 overflow-hidden text-left outline-none', canInteract && 'cursor-pointer', stageClassName)}
        onClick={() => {
          if (!canInteract) return
          if (reviewLineIndex !== null) {
            setReviewLineIndex(null)
            return
          }
          if (isTyping) {
            if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current)
            typewriterTimerRef.current = null
            setDisplayedText(fullText)
            return
          }
          onAdvance?.()
        }}
        onKeyDown={(event) => {
          if (canInteract && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            if (reviewLineIndex !== null) {
              setReviewLineIndex(null)
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
        <PixiVnStage backgroundUrl={backgroundUrl} backgroundFit={backgroundFit} spriteUrl={currentSpriteUrl} spritePosition={spritePosition} />

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

        <div className="absolute inset-x-0 bottom-0 z-20">
          {displayLine?.speaker && (
            <div className="absolute left-4 top-0 z-10 inline-flex h-8 max-w-[52%] -translate-y-1/2 items-center rounded-full border border-white/10 bg-black/58 px-3 shadow-[0_6px_22px_rgba(0,0,0,.2)] backdrop-blur-2xl">
              <span className="truncate text-xs font-semibold text-white/88">{displayLine.speaker}</span>
            </div>
          )}
          <div className="absolute right-4 top-0 z-10 flex h-8 -translate-y-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/58 px-1 shadow-[0_6px_22px_rgba(0,0,0,.2)] backdrop-blur-2xl">
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
            'flex min-h-[clamp(148px,24dvh,196px)] flex-col border-t border-white/10 bg-black/58 text-white shadow-[0_-18px_56px_rgba(0,0,0,.34)] backdrop-blur-2xl',
            inputFeedback ? 'max-h-[76dvh] sm:max-h-[64dvh]' : 'max-h-[34dvh]',
          )}>
            <div className="min-h-0 flex-1 overflow-y-auto relative">
              {displayLine ? (
                <div className="flex min-h-full items-start py-3 pl-4 pr-4">
                  {currentAvatarUrl && !displayLine.isUser && (
                    <img
                      src={currentAvatarUrl}
                      alt={currentAvatarAlt || displayLine.speaker || ''}
                      className="mt-3 size-[72px] shrink-0 rounded-2xl object-cover ring-1 ring-white/15"
                    />
                  )}
                  <div className={cn('min-w-0 space-y-2 pt-2', currentAvatarUrl && !displayLine.isUser ? 'ml-3' : '')}>
                    <p className="leading-relaxed text-white/92" style={{ fontSize: settings.fontSize }}>
                      {displayedText}
                      {canAdvance && (
                        <span className="ml-1 inline-block h-0 w-0 animate-bounce border-x-[4px] border-t-[6px] border-x-transparent border-t-white/70 align-middle drop-shadow-[0_0_8px_rgba(255,255,255,.42)]" />
                      )}
                    </p>
                    {settings.bilingual && displayLine.translation && (
                      <p className="text-xs leading-relaxed text-white/58">{displayedTranslation}</p>
                    )}
                  </div>
                </div>
              ) : isEnded ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <p className="text-center text-sm text-white/62">{t('vnHistory.storyEnded')}</p>
                  {endedActions}
                </div>
              ) : isWaiting ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-white/50" style={{ animationDelay: '0ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-white/50" style={{ animationDelay: '150ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-white/50" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-white/50" style={{ animationDelay: '0ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-white/50" style={{ animationDelay: '150ms' }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-white/50" style={{ animationDelay: '300ms' }} />
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
      className="flex size-7 items-center justify-center rounded-full text-white/78 transition-colors hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
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
