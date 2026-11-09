import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Application, Container, Graphics, Sprite, Ticker, TilingSprite } from 'pixi.js'
import { toVnDisplayUrl, vnTextureRuntime } from '@/features/vn-engine/vn-texture-runtime'
import { isNative } from '@/lib/native/platform'
import { cn } from '@/lib/cn'

export type BackgroundFit = 'cover' | 'contain' | 'stretch' | 'repeat'
export type StageVariant = 'portrait' | 'landscape' | 'mixed'

/** Ren'Py default `dissolve` is ~0.5s — images ease in; no spinner. */
export const VN_DISSOLVE_MS = 500

interface PixiVnStageProps {
  backgroundUrl?: string
  backgroundFit: BackgroundFit
  spriteUrl?: string
  spritePosition: 'left' | 'center' | 'right'
  stageVariant?: StageVariant
  dialogueOverlay?: boolean
  spriteBottomInset?: number
  /** Positive moves down; negative moves the portrait up from its stage baseline. */
  spriteVerticalOffset?: number
  portraitScale?: number
  /** 底下已经有同一张场景图时，舞台保持透明，避免进入对白先黑一下。 */
  clearBackdrop?: boolean
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
  options: { stageVariant: StageVariant; dialogueOverlay: boolean; spriteBottomInset: number; spriteVerticalOffset: number; portraitScale?: number },
) {
  const stageTopInset = options.stageVariant === 'mixed' ? 16 : 58
  const dialogueHeight = options.dialogueOverlay ? getDialogueHeight(height, options.stageVariant) : options.spriteBottomInset
  const spriteOverlap = options.dialogueOverlay ? 32 : 0
  const availableHeight = Math.max(height - stageTopInset - dialogueHeight + spriteOverlap, height * 0.5)
  const widthRatio = options.stageVariant === 'mixed' ? 0.62 : options.stageVariant === 'landscape' ? 0.58 : 0.82
  const scale = Math.min(availableHeight / (sprite.texture.height || 1), (width * widthRatio) / (sprite.texture.width || 1))
  const scaleMultiplier = (options.portraitScale ?? 100) / 100
  sprite.scale.set(scale * scaleMultiplier)
  sprite.anchor.set(0.5, 1)
  sprite.y = height - dialogueHeight + spriteOverlap + options.spriteVerticalOffset
  sprite.x = position === 'center' ? width / 2 : position === 'right' ? width * 0.72 : width * 0.28
}

const BgFitStyle: Record<BackgroundFit, string> = {
  cover: 'cover',
  contain: 'contain',
  stretch: '100% 100%',
  repeat: 'auto',
}

/** Ease alpha 0→1 over duration (Ren'Py-style dissolve). */
function dissolveDisplayObject(
  ticker: Ticker,
  target: { alpha: number },
  durationMs = VN_DISSOLVE_MS,
  from = 0,
  to = 1,
) {
  target.alpha = from
  const start = performance.now()
  const tick = () => {
    const t = Math.min(1, (performance.now() - start) / durationMs)
    // Smoothstep — closer to Ren'Py's soft dissolve than linear
    const eased = t * t * (3 - 2 * t)
    target.alpha = from + (to - from) * eased
    if (t >= 1) ticker.remove(tick)
  }
  ticker.add(tick)
  return () => ticker.remove(tick)
}

function destroyLayer(node: Sprite | TilingSprite | null) {
  if (!node) return
  node.destroy({ children: true, texture: false, textureSource: false })
}

/** Instant CSS/<img> plane — WebView can paint capacitor:// before WebGL catches up. */
function CssUnderlay({
  backgroundUrl,
  backgroundFit,
  spriteUrl,
  spritePosition,
  stageVariant,
  dialogueOverlay,
  spriteBottomInset,
  spriteVerticalOffset,
  portraitScale,
  clearBackdrop,
  showSprite,
  dissolveIn,
}: {
  backgroundUrl?: string
  backgroundFit: BackgroundFit
  spriteUrl?: string
  spritePosition: 'left' | 'center' | 'right'
  stageVariant: StageVariant
  dialogueOverlay: boolean
  spriteBottomInset: number
  spriteVerticalOffset: number
  portraitScale?: number
  clearBackdrop: boolean
  showSprite: boolean
  dissolveIn?: boolean
}) {
  const bottomInset = dialogueOverlay
    ? stageVariant === 'landscape' ? 'calc(clamp(72px,18dvh,112px)-32px)' : 'calc(clamp(148px,24dvh,196px)-32px)'
    : `${spriteBottomInset}px`
  const topInset = stageVariant === 'mixed' ? '16px' : '58px'
  const maxWidth = stageVariant === 'mixed' ? '62%' : stageVariant === 'landscape' ? '58%' : '82%'
  const scalePercent = portraitScale ?? 100
  // Only the portrait dissolves — background snaps on (black stage underneath).
  const [spriteVisible, setSpriteVisible] = useState(!dissolveIn || !showSprite)

  useEffect(() => {
    if (!dissolveIn || !showSprite || !spriteUrl) {
      setSpriteVisible(Boolean(showSprite && spriteUrl) || !dissolveIn)
      return
    }
    setSpriteVisible(false)
    const id = requestAnimationFrame(() => setSpriteVisible(true))
    return () => cancelAnimationFrame(id)
  }, [dissolveIn, showSprite, spriteUrl])

  return (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden',
        clearBackdrop ? 'bg-transparent' : 'bg-black',
      )}
      aria-hidden
    >
      {backgroundUrl && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: BgFitStyle[backgroundFit],
            backgroundPosition: 'center',
            backgroundRepeat: backgroundFit === 'repeat' ? 'repeat' : 'no-repeat',
          }}
        />
      )}
      {showSprite && spriteUrl && (
        <div className="pointer-events-none absolute inset-x-0" style={{ bottom: `calc(${bottomInset} - ${spriteVerticalOffset}px)`, top: topInset }}>
          <img
            src={spriteUrl}
            alt=""
            className="absolute bottom-0 max-h-full select-none object-contain"
            style={{
              maxWidth,
              left: spritePosition === 'center' ? '50%' : spritePosition === 'right' ? '72%' : '28%',
              transform: `translateX(-50%) scale(${scalePercent / 100})`,
              transformOrigin: 'bottom center',
              opacity: spriteVisible ? 1 : 0,
              transition: `opacity ${VN_DISSOLVE_MS}ms ease`,
            }}
          />
        </div>
      )}
    </div>
  )
}

function CssFallbackStage(props: PixiVnStageProps) {
  const { resolvedTheme } = useTheme()
  return (
    <>
      <CssUnderlay
        backgroundUrl={toVnDisplayUrl(props.backgroundUrl)}
        backgroundFit={props.backgroundFit}
        spriteUrl={toVnDisplayUrl(props.spriteUrl)}
        spritePosition={props.spritePosition}
        stageVariant={props.stageVariant ?? 'portrait'}
        dialogueOverlay={props.dialogueOverlay ?? true}
        spriteBottomInset={props.spriteBottomInset ?? 0}
        spriteVerticalOffset={props.spriteVerticalOffset ?? 0}
        portraitScale={props.portraitScale}
        clearBackdrop={props.clearBackdrop ?? false}
        showSprite
        dissolveIn
      />
      {resolvedTheme === 'dark' && <div className="pointer-events-none absolute inset-0 bg-black/40" />}
    </>
  )
}

export function PixiVnStage({
  backgroundUrl: rawBackgroundUrl,
  backgroundFit,
  spriteUrl: rawSpriteUrl,
  spritePosition,
  stageVariant = 'portrait',
  dialogueOverlay = true,
  spriteBottomInset = 0,
  spriteVerticalOffset = 0,
  portraitScale,
  clearBackdrop = false,
}: PixiVnStageProps) {
  const backgroundUrl = toVnDisplayUrl(rawBackgroundUrl)
  const spriteUrl = toVnDisplayUrl(rawSpriteUrl)
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
  const spriteVerticalOffsetRef = useRef(spriteVerticalOffset)
  const portraitScaleRef = useRef(portraitScale)
  const clearBackdropRef = useRef(clearBackdrop)
  clearBackdropRef.current = clearBackdrop
  const stopSpriteDissolveRef = useRef<(() => void) | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  /** True once the current background texture is painted on the canvas. */
  const [gpuBgReady, setGpuBgReady] = useState(!rawBackgroundUrl)
  const [gpuSpriteReady, setGpuSpriteReady] = useState(!rawSpriteUrl)
  const layoutRafRef = useRef<number | null>(null)

  const layout = () => {
    const app = appRef.current
    if (!app || !app.renderer) return
    const width = app.renderer.width
    const height = app.renderer.height

    if (fallbackRef.current) {
      fallbackRef.current.clear()
      if (!clearBackdropRef.current) {
        fallbackRef.current.rect(0, 0, width, height).fill(0x000000)
      }
    }
    if (bgRef.current) fitBackground(bgRef.current, width, height, backgroundFit)
    if (spriteRef.current) {
      layoutSprite(spriteRef.current, width, height, spritePositionRef.current, {
        stageVariant: stageVariantRef.current,
        dialogueOverlay: dialogueOverlayRef.current,
        spriteBottomInset: spriteBottomInsetRef.current,
        spriteVerticalOffset: spriteVerticalOffsetRef.current,
        portraitScale: portraitScaleRef.current,
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

  // Pin visible URLs in the shared runtime (retain + LRU).
  useEffect(() => {
    vnTextureRuntime.setVisible([backgroundUrl, spriteUrl])
  }, [backgroundUrl, spriteUrl])

  useEffect(() => () => {
    vnTextureRuntime.setVisible([])
  }, [])

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
      const devicePixelRatio = window.devicePixelRatio || 1
      const pixiResolution = Math.min(Math.max(devicePixelRatio, 1), 2)

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
      app.canvas.style.opacity = '1'
      host.appendChild(app.canvas)
      resizeObserver = new ResizeObserver(() => scheduleLayout())
      resizeObserver.observe(host)
      layout()
      setReady(true)
    }

    void init()

    return () => {
      cancelled = true
      stopSpriteDissolveRef.current?.()
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
      setGpuBgReady(false)
      setGpuSpriteReady(false)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function loadBackground() {
      const root = rootRef.current
      const app = appRef.current
      if (!root || !app) return

      if (!backgroundUrl) {
        if (bgRef.current) {
          root.removeChild(bgRef.current)
          destroyLayer(bgRef.current)
          bgRef.current = null
        }
        layout()
        setGpuBgReady(true)
        return
      }

      // Background snaps on (black stage underneath). Only portraits dissolve.
      try {
        const texture = await vnTextureRuntime.ensure(backgroundUrl)
        if (cancelled || !rootRef.current || !appRef.current) return
        const newSprite = backgroundFit === 'repeat'
          ? new TilingSprite({ texture, width: 1, height: 1 })
          : new Sprite(texture)
        newSprite.alpha = 1
        const previous = bgRef.current
        if (previous) {
          root.removeChild(previous)
          destroyLayer(previous)
        }
        bgRef.current = newSprite
        rootRef.current.addChildAt(newSprite, 1)
        layout()
        setGpuBgReady(true)
      } catch (err) {
        console.warn('[vn-player] background load failed:', backgroundUrl, err)
        layout()
        setGpuBgReady(true)
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
      const app = appRef.current
      if (!root || !app) return

      if (!spriteUrl) {
        stopSpriteDissolveRef.current?.()
        const previous = spriteRef.current
        if (previous) {
          stopSpriteDissolveRef.current = dissolveDisplayObject(app.ticker, previous, VN_DISSOLVE_MS, previous.alpha, 0)
          window.setTimeout(() => {
            if (spriteRef.current === previous) spriteRef.current = null
            if (previous.parent) previous.parent.removeChild(previous)
            destroyLayer(previous)
          }, VN_DISSOLVE_MS + 32)
        }
        setGpuSpriteReady(true)
        return
      }

      try {
        const texture = await vnTextureRuntime.ensure(spriteUrl)
        if (cancelled || !rootRef.current || !appRef.current) return
        const newSprite = new Sprite(texture)
        const previous = spriteRef.current
        spriteRef.current = newSprite
        rootRef.current.addChild(newSprite)
        layout()
        stopSpriteDissolveRef.current?.()
        stopSpriteDissolveRef.current = dissolveDisplayObject(appRef.current.ticker, newSprite)
        if (previous) {
          const stopOut = dissolveDisplayObject(appRef.current.ticker, previous, VN_DISSOLVE_MS, previous.alpha, 0)
          window.setTimeout(() => {
            stopOut()
            if (previous.parent) previous.parent.removeChild(previous)
            destroyLayer(previous)
          }, VN_DISSOLVE_MS + 32)
        }
        setGpuSpriteReady(true)
      } catch (err) {
        console.warn('[vn-player] sprite load failed:', spriteUrl, err)
        layout()
        setGpuSpriteReady(true)
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
    spriteVerticalOffsetRef.current = spriteVerticalOffset
    portraitScaleRef.current = portraitScale
    layout()
  }, [dialogueOverlay, portraitScale, spriteBottomInset, spritePosition, spriteVerticalOffset, stageVariant])

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
        spriteVerticalOffset={spriteVerticalOffset}
        portraitScale={portraitScale}
        clearBackdrop={clearBackdrop}
      />
    )
  }

  const showCssSprite = Boolean(spriteUrl) && !gpuSpriteReady
  // CSS underlay holds the bg instantly; portrait dissolves on top until GPU catches up.
  const showUnderlay = !gpuBgReady || showCssSprite

  return (
    <>
      {showUnderlay && (
        <CssUnderlay
          backgroundUrl={gpuBgReady ? undefined : backgroundUrl}
          backgroundFit={backgroundFit}
          spriteUrl={spriteUrl}
          spritePosition={spritePosition}
          stageVariant={stageVariant}
          dialogueOverlay={dialogueOverlay}
          spriteBottomInset={spriteBottomInset}
          spriteVerticalOffset={spriteVerticalOffset}
          portraitScale={portraitScale}
          clearBackdrop={clearBackdrop || gpuBgReady}
          showSprite={showCssSprite}
          dissolveIn
        />
      )}
      <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-transparent" />
      {!clearBackdrop && resolvedTheme === 'dark' && (
        <div className="pointer-events-none absolute inset-0 bg-black/40" />
      )}
    </>
  )
}
