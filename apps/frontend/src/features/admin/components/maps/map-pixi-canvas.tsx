import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, MapPin, Plus, Trash2, Unlock } from 'lucide-react'
import { Application, extend, useApplication } from '@pixi/react'
import {
  Container, Graphics, Sprite, Text as PixiText, Texture,
  type FederatedPointerEvent, type Graphics as PixiGraphics,
} from 'pixi.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { GameLocationData, GameMapData, GameRoomData } from '../../api-content-admin'
import { clampPercent, hasAsset, type CanvasLayer, type CanvasMode } from './map-management-shared'

extend({ Container, Graphics, Sprite, Text: PixiText })
const PixiTextElement = 'pixiText' as any

export function MapPixiCanvas({
  map,
  locations,
  roomsForLoc,
  selectedLocationId,
  mode,
  height,
  layers,
  layerVisible,
  layerLocked,
  backgroundScale,
  backgroundRotation,
  onSelectLocation,
  onMoveLocation,
  onCreateLocation,
  onToggleLayerVisible,
  onToggleLayerLocked,
  onMoveLayer,
  onAddLayer,
  onDeleteLayer,
}: {
  map: GameMapData
  locations: GameLocationData[]
  roomsForLoc: (locId: string) => GameRoomData[]
  selectedLocationId: string
  mode: CanvasMode
  height: number
  layers: CanvasLayer[]
  layerVisible: Record<string, boolean>
  layerLocked: Record<string, boolean>
  backgroundScale: number
  backgroundRotation: number
  onSelectLocation: (id: string) => void
  onMoveLocation: (loc: GameLocationData, posX: number, posY: number) => void
  onCreateLocation: () => void
  onToggleLayerVisible: (layerId: string) => void
  onToggleLayerLocked: (layerId: string) => void
  onMoveLayer: (layerId: string, direction: -1 | 1) => void
  onAddLayer: () => void
  onDeleteLayer: (layerId: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 960, height })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => {
      setSize({
        width: Math.max(320, Math.round(host.clientWidth)),
        height: Math.max(320, Math.round(host.clientHeight)),
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [height])

  return (
    <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 rounded-none border border-border bg-card p-3" style={{ height }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">图层</p>
          <Badge variant="outline" className="text-[10px]">{mode === 'edit' ? '编辑' : '预览'}</Badge>
        </div>
        <Button size="sm" variant="outline" className="h-8 justify-start" onClick={onAddLayer}>
          <Plus data-icon="inline-start" />
          添加图层
        </Button>
        <div className="flex flex-col gap-1">
          {layers.map((layer) => (
            <div key={layer.id} className="flex items-center gap-1 rounded-none border border-border bg-background px-2 py-1.5">
              <Button variant="ghost" size="icon" className="size-6" onClick={() => onToggleLayerVisible(layer.id)}>
                {(layerVisible[layer.id] ?? true) ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => onToggleLayerLocked(layer.id)}>
                {(layerLocked[layer.id] ?? false) ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </Button>
              <span className="min-w-0 flex-1 truncate text-xs">{layer.name}</span>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => onMoveLayer(layer.id, -1)}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => onMoveLayer(layer.id, 1)}>
                <ArrowDown className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={layer.kind !== 'custom'}
                title={layer.kind === 'custom' ? '删除图层' : '内置图层可隐藏，不能删除'}
                onClick={() => onDeleteLayer(layer.id)}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div
        ref={hostRef}
        className={cn(
          'relative overflow-hidden rounded-none border border-border bg-muted [overflow-anchor:none]',
          mode === 'edit' ? 'cursor-crosshair' : 'cursor-default',
        )}
        style={{ height }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <Application
          resizeTo={hostRef as React.RefObject<HTMLElement>}
          backgroundAlpha={0}
          antialias
          autoDensity
          resolution={Math.min(window.devicePixelRatio || 1, 2)}
        >
          <MapPixiLayer
            map={map}
            locations={locations}
            roomsForLoc={roomsForLoc}
            selectedLocationId={selectedLocationId}
            mode={mode}
            width={size.width}
            height={size.height}
            layers={layers}
            layerVisible={layerVisible}
            layerLocked={layerLocked}
            backgroundScale={backgroundScale}
            backgroundRotation={backgroundRotation}
            onSelectLocation={onSelectLocation}
            onMoveLocation={onMoveLocation}
          />
        </Application>
        {locations.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-none border border-border bg-background/95 px-5 py-4 shadow-sm">
              <MapPin className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">这张地图还没有地点</p>
              <Button size="sm" onClick={onCreateLocation}>
                <Plus data-icon="inline-start" />
                添加地点
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MapPixiLayer({
  map,
  locations,
  roomsForLoc,
  selectedLocationId,
  mode,
  width,
  height,
  layers,
  layerVisible,
  layerLocked,
  backgroundScale,
  backgroundRotation,
  onSelectLocation,
  onMoveLocation,
}: {
  map: GameMapData
  locations: GameLocationData[]
  roomsForLoc: (locId: string) => GameRoomData[]
  selectedLocationId: string
  mode: CanvasMode
  width: number
  height: number
  layers: CanvasLayer[]
  layerVisible: Record<string, boolean>
  layerLocked: Record<string, boolean>
  backgroundScale: number
  backgroundRotation: number
  onSelectLocation: (id: string) => void
  onMoveLocation: (loc: GameLocationData, posX: number, posY: number) => void
}) {
  const { app, isInitialised } = useApplication()
  const [hoveredId, setHoveredId] = useState('')
  const [draggingId, setDraggingId] = useState('')
  const activeDragIdRef = useRef('')
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({})

  useEffect(() => {
    if (!isInitialised || !app.stage) return
    app.stage.eventMode = 'static'
  }, [app, isInitialised])

  useEffect(() => {
    setDraftPositions({})
    setDraggingId('')
    activeDragIdRef.current = ''
    setHoveredId('')
  }, [map.id])

  const bgTexture = useMemo(() => (
    hasAsset(map.backgroundUrl) ? Texture.from(map.backgroundUrl ?? '') : Texture.EMPTY
  ), [map.backgroundUrl])

  const drawFallback = useCallback((graphics: PixiGraphics) => {
    graphics.clear()
    graphics.rect(0, 0, width, height)
    graphics.fill({ color: 0x101114 })
    graphics.rect(0, 0, width, height)
    graphics.stroke({ color: 0xffffff, alpha: 0.08, width: 1 })
    for (let x = 0; x <= width; x += 48) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, height)
    }
    for (let y = 0; y <= height; y += 48) {
      graphics.moveTo(0, y)
      graphics.lineTo(width, y)
    }
    graphics.stroke({ color: 0xffffff, alpha: 0.05, width: 1 })
  }, [height, width])

  const drawOverlay = useCallback((graphics: PixiGraphics) => {
    graphics.clear()
    graphics.rect(0, 0, width, height)
    graphics.fill({ color: 0x000000, alpha: (layerVisible.background ?? true) ? 0.08 : 0 })
  }, [height, layerVisible.background, width])

  const handleMove = (event: FederatedPointerEvent) => {
    const activeDragId = activeDragIdRef.current || draggingId
    if (!activeDragId || mode !== 'edit' || layerLocked.locations) return
    const x = clampPercent((event.global.x / width) * 100)
    const y = clampPercent((event.global.y / height) * 100)
    setDraftPositions((prev) => ({ ...prev, [activeDragId]: { x, y } }))
  }

  const finishDrag = (event: FederatedPointerEvent) => {
    const activeDragId = activeDragIdRef.current || draggingId
    const draggingLocation = locations.find((loc) => loc.id === activeDragId) ?? null
    if (!activeDragId || !draggingLocation || mode !== 'edit' || layerLocked.locations) return
    activeDragIdRef.current = ''
    const x = clampPercent((event.global.x / width) * 100)
    const y = clampPercent((event.global.y / height) * 100)
    setDraggingId('')
    setDraftPositions((prev) => {
      const next = { ...prev }
      delete next[activeDragId]
      return next
    })
    onMoveLocation(draggingLocation, x, y)
  }

  const renderBackgroundLayer = () => {
    if (!(layerVisible.background ?? true) || !hasAsset(map.backgroundUrl)) return null
    const scaledWidth = width * backgroundScale
    const scaledHeight = height * backgroundScale
    return (
      <pixiContainer key="background" x={width / 2} y={height / 2} rotation={(backgroundRotation * Math.PI) / 180}>
        <pixiSprite
          texture={bgTexture}
          x={-scaledWidth / 2}
          y={-scaledHeight / 2}
          width={scaledWidth}
          height={scaledHeight}
          alpha={0.95}
        />
      </pixiContainer>
    )
  }

  const renderLocationLayer = () => {
    if (!(layerVisible.locations ?? true)) return null
    return locations.map((loc) => {
        const draft = draftPositions[loc.id]
        const x = ((draft?.x ?? clampPercent(loc.posX)) / 100) * width
        const y = ((draft?.y ?? clampPercent(loc.posY)) / 100) * height
        const selected = selectedLocationId === loc.id
        const hovered = hoveredId === loc.id
        return (
          <MapLocationNode
            key={loc.id}
            location={loc}
            x={x}
            y={y}
            mode={mode}
            selected={selected}
            hovered={hovered}
            dragging={draggingId === loc.id}
            locked={layerLocked.locations}
            onSelect={() => onSelectLocation(loc.id)}
            onHover={(value) => setHoveredId(value ? loc.id : '')}
            onDragStart={() => {
              if (layerLocked.locations) return
              activeDragIdRef.current = loc.id
              setDraggingId(loc.id)
              onSelectLocation(loc.id)
            }}
            onDragMove={handleMove}
            onDragEnd={finishDrag}
          />
        )
      })
  }

  const renderLabelLayer = () => {
    if (!(layerVisible.labels ?? false)) return null
    return locations.map((loc) => {
      const draft = draftPositions[loc.id]
      const x = ((draft?.x ?? clampPercent(loc.posX)) / 100) * width
      const y = ((draft?.y ?? clampPercent(loc.posY)) / 100) * height
      const selected = selectedLocationId === loc.id
      const hovered = hoveredId === loc.id
      if (!hovered && !(mode === 'edit' && selected)) return null
      return (
        <MapLocationLabel
          key={`label-${loc.id}`}
          location={loc}
          roomCount={roomsForLoc(loc.id).length}
          x={x}
          y={y}
        />
      )
    })
  }

  const renderLayer = (layer: CanvasLayer) => {
    if (layer.kind === 'background') return renderBackgroundLayer()
    if (layer.kind === 'locations') return renderLocationLayer()
    if (layer.kind === 'labels') return renderLabelLayer()
    return null
  }

  return (
    <pixiContainer>
      <pixiGraphics draw={drawFallback} />
      <pixiGraphics
        eventMode="static"
        cursor={mode === 'edit' && draggingId ? 'grabbing' : 'default'}
        draw={drawOverlay}
        onPointerMove={handleMove}
        onPointerUp={finishDrag}
        onPointerUpOutside={finishDrag}
        onPointerCancel={finishDrag}
      />
      {layers.map(renderLayer)}
    </pixiContainer>
  )
}

function MapLocationNode({
  location,
  x,
  y,
  mode,
  selected,
  hovered,
  dragging,
  locked,
  onSelect,
  onHover,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  location: GameLocationData
  x: number
  y: number
  mode: CanvasMode
  selected: boolean
  hovered: boolean
  dragging: boolean
  locked: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
  onDragStart: () => void
  onDragMove: (event: FederatedPointerEvent) => void
  onDragEnd: (event: FederatedPointerEvent) => void
}) {
  const scale = dragging ? 1.18 : selected || hovered ? 1.1 : 1
  const accent = selected ? 0x3b82f6 : location.disabled ? 0x8b8f98 : 0xf8fafc
  const fill = location.locationType === 'outdoor'
    ? 0x22c55e
    : location.locationType === 'district'
      ? 0xf59e0b
      : 0x3b82f6

  const drawPin = useCallback((graphics: PixiGraphics) => {
    graphics.clear()
    graphics.circle(3, 5, 21 * scale)
    graphics.fill({ color: 0x000000, alpha: 0.22 })
    graphics.circle(0, 0, 18 * scale)
    graphics.fill({ color: fill, alpha: location.disabled ? 0.45 : 0.92 })
    graphics.circle(0, 0, 18 * scale)
    graphics.stroke({ color: accent, alpha: selected || hovered ? 0.95 : 0.5, width: selected || hovered ? 3 : 1.5 })
    graphics.circle(0, 0, 6 * scale)
    graphics.fill({ color: 0xffffff, alpha: 0.95 })
  }, [accent, fill, hovered, location.disabled, scale, selected])

  return (
    <pixiContainer
      x={x}
      y={y}
      eventMode="static"
      cursor={mode === 'edit' && !locked ? 'grab' : 'pointer'}
      alpha={location.hidden ? 0.45 : 1}
      onPointerTap={() => onSelect()}
      onPointerDown={(event: FederatedPointerEvent) => {
        if (mode !== 'edit' || locked || event.button !== 0) return
        onDragStart()
      }}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerUpOutside={onDragEnd}
      onPointerCancel={onDragEnd}
      onPointerOver={() => onHover(true)}
      onPointerOut={() => onHover(false)}
    >
      <pixiGraphics draw={drawPin} />
    </pixiContainer>
  )
}

function MapLocationLabel({
  location,
  roomCount,
  x,
  y,
}: {
  location: GameLocationData
  roomCount: number
  x: number
  y: number
}) {
  const labelWidth = Math.max(92, Math.min(170, location.displayName.length * 15 + 48))
  const drawLabel = useCallback((graphics: PixiGraphics) => {
    graphics.clear()
    graphics.roundRect(-labelWidth / 2, -54, labelWidth, 28, 8)
    graphics.fill({ color: 0x0f172a, alpha: 0.88 })
    graphics.roundRect(-labelWidth / 2, -54, labelWidth, 28, 8)
    graphics.stroke({ color: 0xffffff, alpha: 0.16, width: 1 })
  }, [labelWidth])

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={drawLabel} />
      <PixiTextElement
        text={`${location.displayName} · ${roomCount}`}
        x={-labelWidth / 2 + 12}
        y={-49}
        style={{
          fill: 0xffffff,
          fontSize: 12,
          fontWeight: '600',
        }}
      />
    </pixiContainer>
  )
}
