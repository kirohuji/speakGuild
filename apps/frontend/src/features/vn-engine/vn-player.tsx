import { useEffect, useRef, useState } from 'react'
import { Application, Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js'
import { History, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface VnPlayerLine {
  speaker?: string
  text: string
  isUser?: boolean
}

export interface VnPlayerChoice {
  index: number
  text: string
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
  isWaiting?: boolean
  isEnded?: boolean
  onAdvance?: () => void
  onChoice?: (index: number) => void
  onReset?: () => void
  className?: string
  stageClassName?: string
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

function layoutSprite(sprite: Sprite, width: number, height: number, position: 'left' | 'center' | 'right') {
  const scale = Math.min((height * 0.62) / (sprite.texture.height || 1), (width * 0.74) / (sprite.texture.width || 1))
  sprite.scale.set(scale)
  sprite.anchor.set(0.5, 1)
  sprite.y = height - 118
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
    <div className="absolute inset-0 overflow-hidden bg-[#141827]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
          backgroundSize: BgFitStyle[backgroundFit],
          backgroundPosition: 'center',
          backgroundRepeat: backgroundFit === 'repeat' ? 'repeat' : 'no-repeat',
        }}
      />
      <div className="absolute inset-0 bg-black/16" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-black/10 to-transparent" />
      {spriteUrl && (
        <img
          src={spriteUrl}
          alt=""
          className="pointer-events-none absolute select-none"
          style={{
            maxHeight: '62%',
            maxWidth: '74%',
            bottom: '118px',
            left: spritePosition === 'center' ? '50%' : spritePosition === 'right' ? '72%' : '28%',
            transform: 'translateX(-50%)',
            objectFit: 'contain',
            objectPosition: 'bottom center',
          }}
        />
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
  const overlayRef = useRef<Graphics | null>(null)
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
      fallbackRef.current.rect(0, 0, width, height).fill(0x141827)
      fallbackRef.current.rect(0, height * 0.42, width, height * 0.58).fill({ color: 0x000000, alpha: 0.28 })
    }
    if (bgRef.current) fitBackground(bgRef.current, width, height, backgroundFit)
    if (spriteRef.current) layoutSprite(spriteRef.current, width, height, spritePositionRef.current)
    if (overlayRef.current) {
      overlayRef.current.clear()
      overlayRef.current.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.16 })
      overlayRef.current.rect(0, height * 0.48, width, height * 0.52).fill({ color: 0x000000, alpha: 0.48 })
    }
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    const root = new Container()
    const fallback = new Graphics()
    const overlay = new Graphics()
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
      overlayRef.current = overlay
      app.stage.addChild(root)
      root.addChild(fallback)
      root.addChild(overlay)
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
      overlayRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function loadBackground() {
      const root = rootRef.current
      const overlay = overlayRef.current
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
        if (overlay) rootRef.current.setChildIndex(overlay, rootRef.current.children.length - 1)
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
      const overlay = overlayRef.current
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
        if (overlay) rootRef.current.setChildIndex(overlay, rootRef.current.children.length - 1)
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
  isWaiting = false,
  isEnded = false,
  onAdvance,
  onChoice,
  onReset,
  className,
  stageClassName,
}: VnPlayerProps) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const canAdvance = !!onAdvance && !isEnded && !isWaiting && choices.length === 0 && !historyOpen

  return (
    <div className={cn('relative mx-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-black text-white sm:rounded-xl sm:border sm:border-border', className)}>
      <div
        role="button"
        tabIndex={canAdvance ? 0 : -1}
        aria-label="推进对话"
        className={cn('relative min-h-[620px] flex-1 overflow-hidden text-left outline-none', canAdvance && 'cursor-pointer', stageClassName)}
        onClick={() => { if (canAdvance) onAdvance?.() }}
        onKeyDown={(event) => {
          if (canAdvance && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            onAdvance?.()
          }
        }}
      >
        <PixiVnStage backgroundUrl={backgroundUrl} backgroundFit={backgroundFit} spriteUrl={currentSpriteUrl} spritePosition={spritePosition} />

        <div className="absolute right-3 top-3 z-30 flex gap-2">
          <span
            role="button"
            tabIndex={0}
            className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/55 hover:text-white"
            onClick={(event) => { event.stopPropagation(); setHistoryOpen((value) => !value) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                setHistoryOpen((value) => !value)
              }
            }}
          >
            <History className="size-4" />
          </span>
          {onReset && (
            <span
              role="button"
              tabIndex={0}
              className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/55 hover:text-white"
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
          )}
        </div>

        {historyOpen && (
          <div className="absolute inset-0 z-40 bg-black/38 p-4 backdrop-blur-sm" onClick={(event) => event.stopPropagation()}>
            <div className="ml-auto flex h-full w-full max-w-[360px] flex-col overflow-hidden rounded-xl border border-white/18 bg-black/72 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/12 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">历史对话</p>
                  <p className="text-[11px] text-white/50">{history.length} 条记录</p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded-full px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => setHistoryOpen(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setHistoryOpen(false)
                    }
                  }}
                >
                  关闭
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {history.length === 0 ? (
                  <p className="py-10 text-center text-sm text-white/52">还没有历史对话</p>
                ) : history.map((line, index) => (
                  <div key={index} className={cn('rounded-lg border px-3 py-2', line.isUser ? 'border-sky-300/25 bg-sky-300/10' : 'border-white/12 bg-white/7')}>
                    {line.speaker && <p className="mb-1 text-xs font-semibold text-white/56">{line.speaker}</p>}
                    <p className="text-sm leading-6 text-white/88">{line.text}</p>
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
                className="rounded-lg border border-white/20 bg-black/58 px-4 py-3 text-center text-sm font-medium text-white shadow-xl backdrop-blur-md transition-colors hover:border-white/45 hover:bg-black/72"
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

        <div className="absolute inset-x-3 bottom-3 z-20">
          {currentLine?.speaker && (
            <div className="ml-3 inline-flex min-w-24 max-w-[82%] items-center rounded-t-lg border border-white/20 border-b-0 bg-black/72 px-4 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur-md">
              <span className="truncate">{currentLine.speaker}</span>
            </div>
          )}
          <div className="min-h-[112px] rounded-xl border border-white/20 bg-black/68 px-4 py-3 shadow-2xl backdrop-blur-md">
            {currentLine ? (
              <p className="text-[15px] leading-7 text-white">{currentLine.text}</p>
            ) : isEnded ? (
              <p className="text-center text-sm text-white/70">故事结束</p>
            ) : isWaiting ? (
              <p className="text-center text-sm text-white/70">等待用户输入...</p>
            ) : (
              <p className="text-center text-sm text-white/55">点击继续</p>
            )}
            {canAdvance && <span className="absolute bottom-3 right-5 text-xs text-white/55">点击继续</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
