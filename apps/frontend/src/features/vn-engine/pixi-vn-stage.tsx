import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Application, Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js'
import { isNative } from '@/lib/native'

export type BackgroundFit = 'cover' | 'contain' | 'stretch' | 'repeat'
export type StageVariant = 'portrait' | 'landscape' | 'mixed'

interface PixiVnStageProps {
  backgroundUrl?: string
  backgroundFit: BackgroundFit
  spriteUrl?: string
  spritePosition: 'left' | 'center' | 'right'
  stageVariant?: StageVariant
  dialogueOverlay?: boolean
  spriteBottomInset?: number
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

function getDialogueHeight(height: number, variant: StageVariant) {
  if (variant === 'landscape') return Math.min(Math.max(height * 0.18, 72), 112)
  return Math.min(Math.max(height * 0.24, 148), 196)
}

function layoutSprite(
  sprite: Sprite,
  width: number,
  height: number,
  position: 'left' | 'center' | 'right',
  options: { stageVariant: StageVariant; dialogueOverlay: boolean; spriteBottomInset: number },
) {
  const stageTopInset = options.stageVariant === 'mixed' ? 16 : 58
  const dialogueHeight = options.dialogueOverlay ? getDialogueHeight(height, options.stageVariant) : options.spriteBottomInset
  const spriteOverlap = options.dialogueOverlay ? 32 : 0
  const availableHeight = Math.max(height - stageTopInset - dialogueHeight + spriteOverlap, height * 0.5)
  const widthRatio = options.stageVariant === 'mixed' ? 0.62 : options.stageVariant === 'landscape' ? 0.58 : 0.82
  const scale = Math.min(availableHeight / (sprite.texture.height || 1), (width * widthRatio) / (sprite.texture.width || 1))
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

function CssFallbackStage({
  backgroundUrl,
  backgroundFit,
  spriteUrl,
  spritePosition,
  stageVariant = 'portrait',
  dialogueOverlay = true,
  spriteBottomInset = 0,
}: PixiVnStageProps) {
  const { resolvedTheme } = useTheme()
  const bottomInset = dialogueOverlay
    ? stageVariant === 'landscape' ? 'calc(clamp(72px,18dvh,112px)-32px)' : 'calc(clamp(148px,24dvh,196px)-32px)'
    : `${spriteBottomInset}px`
  const topInset = stageVariant === 'mixed' ? '16px' : '58px'
  const maxWidth = stageVariant === 'mixed' ? '62%' : stageVariant === 'landscape' ? '58%' : '82%'

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
        <div className="pointer-events-none absolute inset-x-0" style={{ bottom: bottomInset, top: topInset }}>
          <img
            src={spriteUrl}
            alt=""
            className="absolute bottom-0 max-h-full select-none object-contain"
            style={{
              maxWidth,
              left: spritePosition === 'center' ? '50%' : spritePosition === 'right' ? '72%' : '28%',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      )}
      {resolvedTheme === 'dark' && <div className="pointer-events-none absolute inset-0 bg-black/40" />}
    </div>
  )
}

export function PixiVnStage({
  backgroundUrl,
  backgroundFit,
  spriteUrl,
  spritePosition,
  stageVariant = 'portrait',
  dialogueOverlay = true,
  spriteBottomInset = 0,
}: PixiVnStageProps) {
  const { resolvedTheme } = useTheme()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const rootRef = useRef<Container | null>(null)
  const fallbackRef = useRef<Graphics | null>(null)
  const bgRef = useRef<Sprite | TilingSprite | null>(null)
  const spriteRef = useRef<Sprite | null>(null)
  const spritePositionRef = useRef(spritePosition)
  const stageVariantRef = useRef(stageVariant)
  const dialogueOverlayRef = useRef(dialogueOverlay)
  const spriteBottomInsetRef = useRef(spriteBottomInset)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const layoutRafRef = useRef<number | null>(null)

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
    if (spriteRef.current) {
      layoutSprite(spriteRef.current, width, height, spritePositionRef.current, {
        stageVariant: stageVariantRef.current,
        dialogueOverlay: dialogueOverlayRef.current,
        spriteBottomInset: spriteBottomInsetRef.current,
      })
    }
  }

  const scheduleLayout = () => {
    if (layoutRafRef.current !== null) return
    layoutRafRef.current = window.requestAnimationFrame(() => {
      layoutRafRef.current = null
      layout()
    })
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    const root = new Container()
    const fallback = new Graphics()
    let resizeObserver: ResizeObserver | null = null

    async function init() {
      if (host.clientWidth === 0 || host.clientHeight === 0) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (cancelled) return
      }

      const native = isNative()
      const pixiResolution = native ? 1 : Math.min(window.devicePixelRatio || 1, 2)

      let app: Application
      let initOk = false

      app = new Application()
      try {
        await app.init({
          resizeTo: host,
          backgroundAlpha: 0,
          antialias: !native,
          autoDensity: true,
          resolution: pixiResolution,
        })
        initOk = true
      } catch {
        try { app.destroy(true) } catch { /* ignore */ }
      }

      if (!initOk) {
        app = new Application()
        try {
          await app.init({
            resizeTo: host,
            backgroundAlpha: 0,
            antialias: true,
            autoDensity: true,
            resolution: pixiResolution,
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
      app.canvas.className = 'absolute inset-0 h-full w-full pointer-events-none'
      host.appendChild(app.canvas)
      resizeObserver = new ResizeObserver(() => scheduleLayout())
      resizeObserver.observe(host)
      layout()
      setReady(true)
    }

    void init()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      if (layoutRafRef.current !== null) {
        window.cancelAnimationFrame(layoutRafRef.current)
        layoutRafRef.current = null
      }
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
      if (!backgroundUrl) {
        if (bgRef.current) {
          root.removeChild(bgRef.current)
          bgRef.current.destroy()
          bgRef.current = null
        }
        layout()
        return
      }

      try {
        const texture = await Assets.load<Texture>(backgroundUrl)
        if (cancelled || !rootRef.current) return
        const newSprite = backgroundFit === 'repeat'
          ? new TilingSprite({ texture, width: 1, height: 1 })
          : new Sprite(texture)
        if (bgRef.current) {
          root.removeChild(bgRef.current)
          bgRef.current.destroy()
        }
        bgRef.current = newSprite
        rootRef.current.addChildAt(newSprite, 1)
        layout()
      } catch (err) {
        console.warn('[vn-player] background load failed:', backgroundUrl, err)
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
      if (!spriteUrl) {
        if (spriteRef.current) {
          root.removeChild(spriteRef.current)
          spriteRef.current.destroy()
          spriteRef.current = null
        }
        layout()
        return
      }

      try {
        const texture = await Assets.load<Texture>(spriteUrl)
        if (cancelled || !rootRef.current) return
        const newSprite = new Sprite(texture)
        newSprite.alpha = 0
        if (spriteRef.current) {
          root.removeChild(spriteRef.current)
          spriteRef.current.destroy()
        }
        spriteRef.current = newSprite
        rootRef.current.addChild(newSprite)
        layout()
        appRef.current?.ticker.addOnce(() => {
          if (spriteRef.current === newSprite) newSprite.alpha = 1
        })
      } catch (err) {
        console.warn('[vn-player] sprite load failed:', spriteUrl, err)
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
    stageVariantRef.current = stageVariant
    dialogueOverlayRef.current = dialogueOverlay
    spriteBottomInsetRef.current = spriteBottomInset
    layout()
  }, [dialogueOverlay, spriteBottomInset, spritePosition, stageVariant])

  if (failed) {
    return (
      <CssFallbackStage
        backgroundUrl={backgroundUrl}
        backgroundFit={backgroundFit}
        spriteUrl={spriteUrl}
        spritePosition={spritePosition}
        stageVariant={stageVariant}
        dialogueOverlay={dialogueOverlay}
        spriteBottomInset={spriteBottomInset}
      />
    )
  }

  return (
    <>
      <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-black" />
      {resolvedTheme === 'dark' && <div className="pointer-events-none absolute inset-0 bg-black/40" />}
    </>
  )
}
