import { useEffect, useRef, useState } from 'react'
import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js'
import { History, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
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

interface PixiVnStageProps {
  backgroundUrl?: string
  spriteUrl?: string
  spritePosition: 'left' | 'center' | 'right'
}

function fitCover(sprite: Sprite, width: number, height: number) {
  const textureWidth = sprite.texture.width || 1
  const textureHeight = sprite.texture.height || 1
  const scale = Math.max(width / textureWidth, height / textureHeight)
  sprite.scale.set(scale)
  sprite.position.set(width / 2, height / 2)
  sprite.anchor.set(0.5)
}

function layoutSprite(sprite: Sprite, width: number, height: number, position: 'left' | 'center' | 'right') {
  const textureWidth = sprite.texture.width || 1
  const textureHeight = sprite.texture.height || 1
  const maxHeight = height * 0.62
  const maxWidth = width * 0.74
  const scale = Math.min(maxHeight / textureHeight, maxWidth / textureWidth)
  sprite.scale.set(scale)
  sprite.anchor.set(0.5, 1)
  sprite.y = height - 118

  if (position === 'center') {
    sprite.x = width / 2
  } else if (position === 'right') {
    sprite.x = width * 0.72
  } else {
    sprite.x = width * 0.28
  }
}

function PixiVnStage({ backgroundUrl, spriteUrl, spritePosition }: PixiVnStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const rootRef = useRef<Container | null>(null)
  const fallbackRef = useRef<Graphics | null>(null)
  const bgRef = useRef<Sprite | null>(null)
  const spriteRef = useRef<Sprite | null>(null)
  const overlayRef = useRef<Graphics | null>(null)
  const spritePositionRef = useRef(spritePosition)
  const [ready, setReady] = useState(false)

  const layout = () => {
    const app = appRef.current
    if (!app) return
    const width = app.renderer.width
    const height = app.renderer.height
    if (fallbackRef.current) {
      fallbackRef.current.clear()
      fallbackRef.current.rect(0, 0, width, height).fill(0x141827)
      fallbackRef.current.rect(0, height * 0.42, width, height * 0.58).fill({ color: 0x000000, alpha: 0.28 })
    }
    if (bgRef.current) fitCover(bgRef.current, width, height)
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
    const app = new Application()
    const root = new Container()
    const fallback = new Graphics()
    const overlay = new Graphics()
    let resizeObserver: ResizeObserver | null = null

    async function init() {
      await app.init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      })
      if (cancelled) {
        app.destroy(true)
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
      if (app.canvas.parentElement === host) host.removeChild(app.canvas)
      app.destroy(true)
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
    let cancelled = false

    async function loadBackground() {
      const root = rootRef.current
      const overlay = overlayRef.current
      if (!ready) return
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
        if (cancelled || !root) return
        const sprite = new Sprite(texture)
        bgRef.current = sprite
        root.addChildAt(sprite, 1)
        if (overlay) root.setChildIndex(overlay, root.children.length - 1)
        layout()
      } catch {
        layout()
      }
    }

    void loadBackground()
    return () => {
      cancelled = true
    }
  }, [backgroundUrl, ready])

  useEffect(() => {
    let cancelled = false

    async function loadSprite() {
      const root = rootRef.current
      const overlay = overlayRef.current
      if (!ready) return
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
        if (cancelled || !root) return
        const sprite = new Sprite(texture)
        sprite.alpha = 0
        spriteRef.current = sprite
        root.addChild(sprite)
        if (overlay) root.setChildIndex(overlay, root.children.length - 1)
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

  return <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-black" />
}

export function VnPlayer({
  backgroundUrl,
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
  const canAdvance = !!onAdvance && !isEnded && !isWaiting && choices.length === 0

  return (
    <div className={cn('relative mx-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-black text-white sm:rounded-xl sm:border sm:border-border', className)}>
      <div
        role="button"
        tabIndex={canAdvance ? 0 : -1}
        aria-label="推进对话"
        className={cn(
          'relative min-h-[620px] flex-1 overflow-hidden text-left outline-none',
          canAdvance && 'cursor-pointer',
          stageClassName,
        )}
        onClick={() => { if (canAdvance) onAdvance?.() }}
        onKeyDown={(e) => {
          if (canAdvance && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onAdvance?.()
          }
        }}
      >
        <PixiVnStage
          backgroundUrl={backgroundUrl}
          spriteUrl={currentSpriteUrl}
          spritePosition={spritePosition}
        />

        <div className="absolute right-3 top-3 z-30 flex gap-2">
          <span
            role="button"
            tabIndex={0}
            className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/55 hover:text-white"
            onClick={(e) => { e.stopPropagation(); setHistoryOpen(true) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                setHistoryOpen(true)
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
              onClick={(e) => { e.stopPropagation(); onReset() }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onReset()
                }
              }}
            >
              <RotateCcw className="size-4" />
            </span>
          )}
        </div>

        {choices.length > 0 && (
          <div className="absolute inset-x-5 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
            {choices.map((choice) => (
              <span
                key={choice.index}
                role="button"
                tabIndex={0}
                className="rounded-lg border border-white/20 bg-black/58 px-4 py-3 text-center text-sm font-medium text-white shadow-xl backdrop-blur-md transition-colors hover:border-white/45 hover:bg-black/72"
                onClick={(e) => { e.stopPropagation(); onChoice?.(choice.index) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
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
            {canAdvance && (
              <span className="absolute bottom-3 right-5 text-xs text-white/55">点击继续</span>
            )}
          </div>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[82vh] max-w-md overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>历史对话</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[64vh]">
            <div className="space-y-3 p-5">
              {history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">还没有历史对话</p>
              ) : history.map((line, index) => (
                <div key={index} className={cn('rounded-lg border p-3', line.isUser ? 'bg-primary/5' : 'bg-muted/30')}>
                  {line.speaker && <p className="mb-1 text-xs font-semibold text-muted-foreground">{line.speaker}</p>}
                  <p className="text-sm leading-relaxed">{line.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
