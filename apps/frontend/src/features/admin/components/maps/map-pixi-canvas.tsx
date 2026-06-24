import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Box, CopyPlus, Eye, EyeOff, Lock,
  MapPin, Plus, Trash2, Unlock,
} from 'lucide-react'
import { Application, extend, useApplication, useTick } from '@pixi/react'
import {
  Assets, Container, Graphics, Sprite, Texture,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
  type Graphics as PixiGraphics,
} from 'pixi.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/cn'
import type { GameLocationData, GameMapData, GameRoomData } from '../../api-content-admin'
import { ImageUploadField } from '../image-upload-field'
import {
  clampPercent,
  hasAsset,
  type CanvasMode,
  type MapDocument,
  type MapLayer,
  type MapObject,
  type MapPrefab,
} from './map-management-shared'

extend({ Container, Graphics, Sprite })

export function MapPixiCanvas({
  map,
  locations,
  roomsForLoc,
  selectedLocationId,
  mode,
  height,
  document,
  selectedLayerId,
  selectedObjectId,
  backgroundScale,
  backgroundRotation,
  onSelectLocation,
  onMoveLocation,
  onCreateLocation,
  onSelectObject,
  onToggleLayerVisible,
  onToggleLayerLocked,
  onSelectLayer,
  onMoveLayer,
  onAddLayer,
  onDeleteLayer,
  onUpdateLayerBackground,
  onUpdateLayer,
  onUpdateMapBackground,
  onAddObjectFromPrefab,
  onUpdateObject,
  onDeleteObject,
  onResizeLocationIcon,
}: {
  map: GameMapData
  locations: GameLocationData[]
  roomsForLoc: (locId: string) => GameRoomData[]
  selectedLocationId: string
  mode: CanvasMode
  height: number
  document: MapDocument
  selectedLayerId: string
  selectedObjectId: string
  backgroundScale: number
  backgroundRotation: number
  onSelectLocation: (id: string) => void
  onMoveLocation: (loc: GameLocationData, posX: number, posY: number) => void
  onCreateLocation: () => void
  onSelectObject: (id: string) => void
  onToggleLayerVisible: (layerId: string) => void
  onToggleLayerLocked: (layerId: string) => void
  onSelectLayer: (layerId: string) => void
  onMoveLayer: (layerId: string, direction: -1 | 1) => void
  onAddLayer: () => void
  onDeleteLayer: (layerId: string) => void
  onUpdateLayerBackground: (layerId: string, backgroundUrl: string) => void
  onUpdateLayer: (layerId: string, patch: Partial<MapLayer>) => void
  onUpdateMapBackground: (backgroundUrl: string) => void
  onAddObjectFromPrefab: (prefab: MapPrefab) => void
  onUpdateObject: (objectId: string, patch: Partial<MapObject>) => void
  onDeleteObject: (objectId: string) => void
  onResizeLocationIcon?: (locId: string, width: number, height: number) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 960, height })
  const [hoveredLocationId, setHoveredLocationId] = useState('')
  const hoveredLocation = useMemo(
    () => locations.find((loc) => loc.id === hoveredLocationId) ?? null,
    [locations, hoveredLocationId],
  )
  const selectedLayer = useMemo(
    () => document.layers.find((layer) => layer.id === selectedLayerId) ?? document.layers[0] ?? null,
    [document.layers, selectedLayerId],
  )
  const selectedObject = useMemo(
    () => document.objects.find((object) => object.id === selectedObjectId) ?? null,
    [document.objects, selectedObjectId],
  )

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
    <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
      <ScrollArea className="border border-border bg-card" style={{ height }}>
        <div className="flex flex-col gap-4 p-3">
          <LayerPanel
            map={map}
            mode={mode}
            layers={document.layers}
            selectedLayer={selectedLayer}
            onAddLayer={onAddLayer}
            onDeleteLayer={onDeleteLayer}
            onMoveLayer={onMoveLayer}
            onSelectLayer={onSelectLayer}
            onToggleLayerVisible={onToggleLayerVisible}
            onToggleLayerLocked={onToggleLayerLocked}
            onUpdateLayer={onUpdateLayer}
            onUpdateLayerBackground={onUpdateLayerBackground}
            onUpdateMapBackground={onUpdateMapBackground}
          />
          <PrefabPanel prefabs={document.prefabs} onAddObjectFromPrefab={onAddObjectFromPrefab} />
          <ObjectPanel
            document={document}
            locations={locations}
            roomsForLoc={roomsForLoc}
            selectedObject={selectedObject}
            onSelectLayer={onSelectLayer}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onDeleteObject={onDeleteObject}
          />
        </div>
      </ScrollArea>

      <div
        ref={hostRef}
        className={cn(
          'relative overflow-hidden border border-border bg-muted [overflow-anchor:none]',
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
          <MapPixiStage
            map={map}
            document={document}
            locations={locations}
            selectedLocationId={selectedLocationId}
            selectedObjectId={selectedObjectId}
            mode={mode}
            width={size.width}
            height={size.height}
            backgroundScale={backgroundScale}
            backgroundRotation={backgroundRotation}
            onSelectLocation={onSelectLocation}
            onMoveLocation={onMoveLocation}
            onResizeLocationIcon={onResizeLocationIcon}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onHoverLocation={setHoveredLocationId}
            onLeaveLocation={() => setHoveredLocationId('')}
          />
        </Application>
        {hoveredLocation && (
          <LocationPreviewPopover
            location={hoveredLocation}
            document={document}
            viewportWidth={size.width}
            viewportHeight={size.height}
          />
        )}
        {locations.length === 0 && document.objects.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto flex flex-col items-center gap-3 border border-border bg-background/95 px-5 py-4 shadow-sm">
              <MapPin className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">这张地图还没有地点或地图对象</p>
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

function LayerPanel({
  map,
  mode,
  layers,
  selectedLayer,
  onAddLayer,
  onDeleteLayer,
  onMoveLayer,
  onSelectLayer,
  onToggleLayerVisible,
  onToggleLayerLocked,
  onUpdateLayer,
  onUpdateLayerBackground,
  onUpdateMapBackground,
}: {
  map: GameMapData
  mode: CanvasMode
  layers: MapLayer[]
  selectedLayer: MapLayer | null
  onAddLayer: () => void
  onDeleteLayer: (layerId: string) => void
  onMoveLayer: (layerId: string, direction: -1 | 1) => void
  onSelectLayer: (layerId: string) => void
  onToggleLayerVisible: (layerId: string) => void
  onToggleLayerLocked: (layerId: string) => void
  onUpdateLayer: (layerId: string, patch: Partial<MapLayer>) => void
  onUpdateLayerBackground: (layerId: string, backgroundUrl: string) => void
  onUpdateMapBackground: (backgroundUrl: string) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">图层</p>
        <Badge variant="outline" className="text-[10px]">{mode === 'edit' ? '编辑' : '预览'}</Badge>
      </div>
      <Button size="sm" variant="outline" className="h-8 w-full justify-start" onClick={onAddLayer}>
        <Plus data-icon="inline-start" />
        添加图层
      </Button>
      <div className="flex flex-col gap-1">
        {layers.map((layer) => (
          <div
            key={layer.id}
            role="button"
            tabIndex={0}
            className={cn(
              'flex items-center gap-1 border border-border bg-background px-2 py-1.5 text-left',
              selectedLayer?.id === layer.id && 'border-primary bg-primary/5',
            )}
            onClick={() => onSelectLayer(layer.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelectLayer(layer.id)
            }}
          >
            <Button variant="ghost" size="icon" className="size-6" onClick={(event) => { event.stopPropagation(); onToggleLayerVisible(layer.id) }}>
              {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="size-6" onClick={(event) => { event.stopPropagation(); onToggleLayerLocked(layer.id) }}>
              {layer.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            </Button>
            <span className="min-w-0 flex-1 truncate text-xs">{layer.name}</span>
            <Button variant="ghost" size="icon" className="size-6" onClick={(event) => { event.stopPropagation(); onMoveLayer(layer.id, -1) }}>
              <ArrowUp className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6" onClick={(event) => { event.stopPropagation(); onMoveLayer(layer.id, 1) }}>
              <ArrowDown className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              disabled={layer.kind !== 'custom'}
              title={layer.kind === 'custom' ? '删除图层' : '内置图层可隐藏，不能删除'}
              onClick={(event) => { event.stopPropagation(); onDeleteLayer(layer.id) }}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      {selectedLayer && (
        <div className="space-y-3 border border-border bg-background/60 p-3">
          <div className="grid gap-2">
            <Label className="text-xs">图层名称</Label>
            <Input
              className="h-8"
              value={selectedLayer.name}
              disabled={selectedLayer.kind !== 'custom'}
              onChange={(event) => onUpdateLayer(selectedLayer.id, { name: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">透明度</Label>
            <Input
              className="h-8"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={selectedLayer.opacity}
              onChange={(event) => onUpdateLayer(selectedLayer.id, { opacity: clamp01(Number(event.target.value)) })}
            />
          </div>
          {selectedLayer.kind === 'background' ? (
            <ImageUploadField
              value={map.backgroundUrl ?? ''}
              onChange={onUpdateMapBackground}
              placeholder="添加空间底图背景"
              previewSize="sm"
              group="library"
              disabled={selectedLayer.locked}
            />
          ) : selectedLayer.kind === 'custom' ? (
            <ImageUploadField
              value={selectedLayer.backgroundUrl ?? ''}
              onChange={(url) => onUpdateLayerBackground(selectedLayer.id, url)}
              placeholder="添加图层背景"
              previewSize="sm"
              group="library"
              disabled={selectedLayer.locked}
            />
          ) : (
            <p className="border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              该图层由地图对象或系统节点组成。
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function PrefabPanel({
  prefabs,
  onAddObjectFromPrefab,
}: {
  prefabs: MapPrefab[]
  onAddObjectFromPrefab: (prefab: MapPrefab) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">Prefab</p>
        <Badge variant="secondary" className="text-[10px]">{prefabs.length}</Badge>
      </div>
      <div className="grid gap-2">
        {prefabs.map((prefab) => (
          <button
            key={prefab.id}
            type="button"
            className="border border-border bg-background px-3 py-2 text-left hover:border-primary hover:bg-primary/5"
            onClick={() => onAddObjectFromPrefab(prefab)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium">{prefab.name}</span>
              <CopyPlus className="size-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{prefab.description}</p>
          </button>
        ))}
      </div>
    </section>
  )
}

function ObjectPanel({
  document,
  locations,
  roomsForLoc,
  selectedObject,
  onSelectLayer,
  onSelectObject,
  onUpdateObject,
  onDeleteObject,
}: {
  document: MapDocument
  locations: GameLocationData[]
  roomsForLoc: (locId: string) => GameRoomData[]
  selectedObject: MapObject | null
  onSelectLayer: (layerId: string) => void
  onSelectObject: (objectId: string) => void
  onUpdateObject: (objectId: string, patch: Partial<MapObject>) => void
  onDeleteObject: (objectId: string) => void
}) {
  const selectedLayer = selectedObject ? document.layers.find((layer) => layer.id === selectedObject.layerId) : null
  const rooms = locations.flatMap((loc) => roomsForLoc(loc.id).map((room) => ({ ...room, locationName: loc.displayName })))
  const objectScale = selectedObject
    ? Math.round((Math.max(selectedObject.width, selectedObject.height) / 120) * 100)
    : 100

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">对象</p>
        <Badge variant="secondary" className="text-[10px]">{document.objects.length}</Badge>
      </div>
      <div className="grid gap-1">
        {document.objects.length === 0 ? (
          <p className="border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">从 Prefab 添加建筑、机关或触发区。</p>
        ) : document.objects.map((object) => (
          <div
            key={object.id}
            className={cn(
              'flex items-center gap-1 border border-border bg-background px-2 py-1.5',
              selectedObject?.id === object.id && 'border-primary bg-primary/5',
            )}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => {
                onSelectObject(object.id)
                onSelectLayer(object.layerId)
              }}
            >
              <Box className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-xs">{object.name}</span>
              <Badge variant="outline" className="text-[10px]">{object.kind}</Badge>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              title="删除对象"
              onClick={() => onDeleteObject(object.id)}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      {selectedObject && (
        <div className="space-y-3 border border-border bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{selectedObject.name}</p>
              <p className="text-[11px] text-muted-foreground">{selectedLayer?.name ?? '未知图层'}</p>
            </div>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onDeleteObject(selectedObject.id)}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs">名称</Label>
            <Input className="h-8" value={selectedObject.name} onChange={(event) => onUpdateObject(selectedObject.id, { name: event.target.value })} />
          </div>
          <ImageUploadField
            value={selectedObject.imageUrl ?? ''}
            onChange={(url) => onUpdateObject(selectedObject.id, { imageUrl: url })}
            placeholder="替换 prefab 皮肤"
            previewSize="sm"
            group="library"
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={selectedObject.x} onChange={(value) => onUpdateObject(selectedObject.id, { x: value })} />
            <NumberField label="Y" value={selectedObject.y} onChange={(value) => onUpdateObject(selectedObject.id, { y: value })} />
            <NumberField label="宽" value={selectedObject.width} onChange={(value) => onUpdateObject(selectedObject.id, { width: Math.max(4, value) })} />
            <NumberField label="高" value={selectedObject.height} onChange={(value) => onUpdateObject(selectedObject.id, { height: Math.max(4, value) })} />
            <NumberField label="旋转" value={selectedObject.rotation} onChange={(value) => onUpdateObject(selectedObject.id, { rotation: value })} />
            <NumberField label="透明" value={selectedObject.opacity} step={0.05} onChange={(value) => onUpdateObject(selectedObject.id, { opacity: clamp01(value) })} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">缩放</Label>
              <span className="text-[11px] text-muted-foreground">{objectScale}%</span>
            </div>
            <Slider
              min={10}
              max={300}
              step={5}
              value={[objectScale]}
              onValueChange={([value]) => {
                const currentMax = Math.max(selectedObject.width, selectedObject.height) || 120
                const nextMax = (value / 100) * 120
                const ratio = nextMax / currentMax
                onUpdateObject(selectedObject.id, {
                  width: Math.max(4, Math.round(selectedObject.width * ratio)),
                  height: Math.max(4, Math.round(selectedObject.height * ratio)),
                })
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">绑定地点</Label>
            <select
              className="h-8 border border-input bg-background px-2 text-xs"
              value={selectedObject.targetLocationId ?? ''}
              onChange={(event) => onUpdateObject(selectedObject.id, { targetLocationId: event.target.value || undefined })}
            >
              <option value="">不绑定</option>
              {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.displayName}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">绑定房间</Label>
            <select
              className="h-8 border border-input bg-background px-2 text-xs"
              value={selectedObject.targetRoomId ?? ''}
              onChange={(event) => onUpdateObject(selectedObject.id, { targetRoomId: event.target.value || undefined })}
            >
              <option value="">不绑定</option>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.locationName} / {room.displayName}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">行为</Label>
            <select
              className="h-8 border border-input bg-background px-2 text-xs"
              value={selectedObject.behavior?.kind ?? 'none'}
              onChange={(event) => onUpdateObject(selectedObject.id, { behavior: { ...selectedObject.behavior, kind: event.target.value as MapObject['behavior']['kind'] } })}
            >
              <option value="none">无</option>
              <option value="rotate">持续旋转</option>
              <option value="location_entry">进入地点</option>
              <option value="room_entry">进入房间</option>
              <option value="click_trigger">点击触发</option>
              <option value="ambient">氛围效果</option>
            </select>
          </div>
          {selectedObject.behavior?.kind === 'rotate' && (
            <NumberField
              label="旋转速度"
              value={selectedObject.behavior.speed ?? 1}
              step={0.1}
              onChange={(value) => onUpdateObject(selectedObject.id, { behavior: { ...selectedObject.behavior, speed: value } })}
            />
          )}
        </div>
      )}
    </section>
  )
}

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input className="h-8" type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

function MapPixiStage({
  map,
  document,
  locations,
  selectedLocationId,
  selectedObjectId,
  mode,
  width,
  height,
  backgroundScale,
  backgroundRotation,
  onSelectLocation,
  onMoveLocation,
  onResizeLocationIcon,
  onSelectObject,
  onUpdateObject,
  onHoverLocation,
  onLeaveLocation,
}: {
  map: GameMapData
  document: MapDocument
  locations: GameLocationData[]
  selectedLocationId: string
  selectedObjectId: string
  mode: CanvasMode
  width: number
  height: number
  backgroundScale: number
  backgroundRotation: number
  onSelectLocation: (id: string) => void
  onMoveLocation: (loc: GameLocationData, posX: number, posY: number) => void
  onResizeLocationIcon?: (locId: string, width: number, height: number) => void
  onSelectObject: (id: string) => void
  onUpdateObject: (objectId: string, patch: Partial<MapObject>) => void
  onHoverLocation?: (locId: string) => void
  onLeaveLocation?: () => void
}) {
  const { app, isInitialised } = useApplication()
  const [hoveredId, setHoveredId] = useState('')
  const [draggingLocationId, setDraggingLocationId] = useState('')
  const [draggingObjectId, setDraggingObjectId] = useState('')
  const [draftLocationPositions, setDraftLocationPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [draftObjectPositions, setDraftObjectPositions] = useState<Record<string, { x: number; y: number }>>({})
  const activeLocationDragIdRef = useRef('')
  const activeObjectDragIdRef = useRef('')
  const viewport = useMemo(() => getViewportTransform(document, width, height), [document, height, width])

  useEffect(() => {
    if (!isInitialised || !app.stage) return
    app.stage.eventMode = 'static'
  }, [app, isInitialised])

  useEffect(() => {
    setDraftLocationPositions({})
    setDraftObjectPositions({})
    setDraggingLocationId('')
    setDraggingObjectId('')
    activeLocationDragIdRef.current = ''
    activeObjectDragIdRef.current = ''
    setHoveredId('')
  }, [map.id])

  const [bgTexture, setBgTexture] = useState(Texture.EMPTY)
  const [layerTextures, setLayerTextures] = useState<Record<string, Texture>>({})
  const [locationIconTextures, setLocationIconTextures] = useState<Record<string, Texture>>({})

  useEffect(() => {
    let cancelled = false
    const url = map.backgroundUrl
    if (!hasAsset(url)) {
      setBgTexture(Texture.EMPTY)
      return
    }
    Assets.load<Texture>(url!)
      .then((tex) => { if (!cancelled) setBgTexture(tex) })
      .catch((err) => { console.warn('[map-pixi] 背景纹理加载失败:', url, err) })
    return () => { cancelled = true }
  }, [map.backgroundUrl])

  useEffect(() => {
    const imageLayers = document.layers.filter((layer) => layer.kind === 'custom' && hasAsset(layer.backgroundUrl))
    const nextTextures: Record<string, Texture> = {}
    let cancelled = false
    Promise.all(imageLayers.map(async (layer) => {
      try {
        const tex = await Assets.load<Texture>(layer.backgroundUrl!)
        if (!cancelled) nextTextures[layer.id] = tex
      } catch (err) {
        console.warn('[map-pixi] 图层纹理加载失败:', layer.backgroundUrl, err)
      }
    })).then(() => {
      if (!cancelled) setLayerTextures((prev) => ({ ...prev, ...nextTextures }))
    })
    return () => { cancelled = true }
  }, [document.layers])

  useEffect(() => {
    const withIcons = locations.filter((loc) => hasAsset(loc.icon))
    const nextTextures: Record<string, Texture> = {}
    let cancelled = false
    Promise.all(withIcons.map(async (loc) => {
      try {
        const tex = await Assets.load<Texture>(loc.icon!)
        if (!cancelled) nextTextures[loc.id] = tex
      } catch (err) {
        console.warn('[map-pixi] 地点图标加载失败:', loc.icon, err)
      }
    })).then(() => {
      if (!cancelled) setLocationIconTextures((prev) => ({ ...prev, ...nextTextures }))
    })
    return () => { cancelled = true }
  }, [locations])

  const screenToWorld = useCallback((event: FederatedPointerEvent) => ({
    x: (event.global.x - viewport.x) / viewport.scale,
    y: (event.global.y - viewport.y) / viewport.scale,
  }), [viewport.scale, viewport.x, viewport.y])

  const drawFallback = useCallback((graphics: PixiGraphics) => {
    graphics.clear()
    graphics.rect(0, 0, width, height)
    graphics.fill({ color: 0x101114 })
  }, [height, width])

  const drawWorldFrame = useCallback((graphics: PixiGraphics) => {
    graphics.clear()
    graphics.rect(0, 0, document.width, document.height)
    graphics.fill({ color: 0x121418 })
    graphics.rect(0, 0, document.width, document.height)
    graphics.stroke({ color: 0xffffff, alpha: 0.1, width: 2 / viewport.scale })
    const grid = 120
    for (let x = 0; x <= document.width; x += grid) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, document.height)
    }
    for (let y = 0; y <= document.height; y += grid) {
      graphics.moveTo(0, y)
      graphics.lineTo(document.width, y)
    }
    graphics.stroke({ color: 0xffffff, alpha: mode === 'edit' ? 0.07 : 0.025, width: 1 / viewport.scale })
  }, [document.height, document.width, mode, viewport.scale])

  const handleLocationMove = (event: FederatedPointerEvent) => {
    const activeDragId = activeLocationDragIdRef.current || draggingLocationId
    const layer = document.layers.find((item) => item.kind === 'locations')
    if (!activeDragId || mode !== 'edit' || layer?.locked) return
    const point = screenToWorld(event)
    setDraftLocationPositions((prev) => ({
      ...prev,
      [activeDragId]: {
        x: clampPercent((point.x / document.width) * 100),
        y: clampPercent((point.y / document.height) * 100),
      },
    }))
  }

  const finishLocationDrag = (event: FederatedPointerEvent) => {
    const activeDragId = activeLocationDragIdRef.current || draggingLocationId
    const draggingLocation = locations.find((loc) => loc.id === activeDragId) ?? null
    const layer = document.layers.find((item) => item.kind === 'locations')
    if (!activeDragId || !draggingLocation || mode !== 'edit' || layer?.locked) return
    activeLocationDragIdRef.current = ''
    const point = screenToWorld(event)
    const x = clampPercent((point.x / document.width) * 100)
    const y = clampPercent((point.y / document.height) * 100)
    setDraggingLocationId('')
    setDraftLocationPositions((prev) => {
      const next = { ...prev }
      delete next[activeDragId]
      return next
    })
    onMoveLocation(draggingLocation, x, y)
  }

  const handleObjectMove = (event: FederatedPointerEvent) => {
    const activeDragId = activeObjectDragIdRef.current || draggingObjectId
    if (!activeDragId || mode !== 'edit') return
    const object = document.objects.find((item) => item.id === activeDragId)
    const layer = object ? document.layers.find((item) => item.id === object.layerId) : null
    if (!object || object.locked || layer?.locked) return
    setDraftObjectPositions((prev) => ({ ...prev, [activeDragId]: screenToWorld(event) }))
  }

  const finishObjectDrag = (event: FederatedPointerEvent) => {
    const activeDragId = activeObjectDragIdRef.current || draggingObjectId
    if (!activeDragId || mode !== 'edit') return
    const object = document.objects.find((item) => item.id === activeDragId)
    const layer = object ? document.layers.find((item) => item.id === object.layerId) : null
    if (!object || object.locked || layer?.locked) return
    activeObjectDragIdRef.current = ''
    const point = screenToWorld(event)
    setDraggingObjectId('')
    setDraftObjectPositions((prev) => {
      const next = { ...prev }
      delete next[activeDragId]
      return next
    })
    onUpdateObject(activeDragId, {
      x: Math.round(Math.max(0, Math.min(document.width, point.x))),
      y: Math.round(Math.max(0, Math.min(document.height, point.y))),
    })
  }

  const renderBackgroundLayer = (layer: MapLayer) => {
    const visible = layer.visible && hasAsset(map.backgroundUrl)
    return (
      <pixiContainer key={layer.id} x={document.width / 2} y={document.height / 2} rotation={(backgroundRotation * Math.PI) / 180} visible={visible} alpha={layer.opacity}>
        <pixiSprite
          texture={bgTexture}
          x={-(document.width * backgroundScale) / 2}
          y={-(document.height * backgroundScale) / 2}
          width={document.width * backgroundScale}
          height={document.height * backgroundScale}
          alpha={0.95}
        />
      </pixiContainer>
    )
  }

  const renderCustomLayer = (layer: MapLayer) => {
    const visible = layer.visible && hasAsset(layer.backgroundUrl)
    const texture = layerTextures[layer.id] ?? Texture.EMPTY
    return (
      <pixiSprite
        key={layer.id}
        texture={texture}
        x={0}
        y={0}
        width={document.width}
        height={document.height}
        alpha={layer.opacity}
        visible={visible}
      />
    )
  }

  const renderLocationLayer = (layer: MapLayer) => {
    if (!layer.visible) return null
    return locations.map((loc) => {
      const draft = draftLocationPositions[loc.id]
      const x = ((draft?.x ?? clampPercent(loc.posX)) / 100) * document.width
      const y = ((draft?.y ?? clampPercent(loc.posY)) / 100) * document.height
      const selected = selectedLocationId === loc.id
      const hovered = hoveredId === loc.id
      const iconTexture = locationIconTextures[loc.id] ?? null
      return (
        <MapLocationNode
          key={loc.id}
          location={loc}
          x={x}
          y={y}
          viewportScale={viewport.scale}
          mode={mode}
          selected={selected}
          hovered={hovered}
          dragging={draggingLocationId === loc.id}
          locked={layer.locked}
          iconTexture={iconTexture}
          onResizeIcon={onResizeLocationIcon ? (w: number, h: number) => onResizeLocationIcon(loc.id, w, h) : undefined}
          onSelect={() => {
            onSelectLocation(loc.id)
            onSelectObject('')
          }}
          onHover={(value) => {
            setHoveredId(value ? loc.id : '')
            if (value) onHoverLocation?.(loc.id)
            else onLeaveLocation?.()
          }}
          onDragStart={() => {
            if (layer.locked) return
            activeLocationDragIdRef.current = loc.id
            setDraggingLocationId(loc.id)
            onSelectLocation(loc.id)
            onSelectObject('')
          }}
          onDragMove={handleLocationMove}
          onDragEnd={finishLocationDrag}
        />
      )
    })
  }

  const renderObjectLayer = (layer: MapLayer) => {
    if (!layer.visible) return null
    return document.objects
      .filter((object) => object.layerId === layer.id && object.visible)
      .map((object) => {
        const draft = draftObjectPositions[object.id]
        return (
          <MapObjectNode
            key={object.id}
            object={object}
            x={draft?.x ?? object.x}
            y={draft?.y ?? object.y}
            selected={selectedObjectId === object.id}
            mode={mode}
            layerLocked={layer.locked}
            viewportScale={viewport.scale}
            onSelect={() => {
              onSelectObject(object.id)
              if (mode === 'preview' && object.targetLocationId && (
                object.behavior?.kind === 'location_entry' ||
                object.behavior?.kind === 'room_entry' ||
                object.behavior?.kind === 'click_trigger'
              )) {
                onSelectLocation(object.targetLocationId)
              }
            }}
            onDragStart={() => {
              if (object.locked || layer.locked) return
              activeObjectDragIdRef.current = object.id
              setDraggingObjectId(object.id)
              onSelectObject(object.id)
            }}
            onDragMove={handleObjectMove}
            onDragEnd={finishObjectDrag}
          />
        )
      })
  }

  const renderLayer = (layer: MapLayer) => {
    if (layer.kind === 'background') return renderBackgroundLayer(layer)
    if (layer.kind === 'custom') return renderCustomLayer(layer)
    if (layer.kind === 'locations') return renderLocationLayer(layer)
    return renderObjectLayer(layer)
  }

  return (
    <pixiContainer>
      <pixiGraphics draw={drawFallback} />
      <pixiContainer x={viewport.x} y={viewport.y} scale={viewport.scale}>
        <pixiGraphics draw={drawWorldFrame} />
        <pixiGraphics
          eventMode="static"
          cursor={mode === 'edit' && (draggingObjectId || draggingLocationId) ? 'grabbing' : 'default'}
          draw={(graphics) => {
            graphics.clear()
            graphics.rect(0, 0, document.width, document.height)
            graphics.fill({ color: 0x000000, alpha: 0.001 })
          }}
          onPointerMove={(event) => {
            handleLocationMove(event)
            handleObjectMove(event)
          }}
          onPointerUp={(event) => {
            finishLocationDrag(event)
            finishObjectDrag(event)
          }}
          onPointerUpOutside={(event) => {
            finishLocationDrag(event)
            finishObjectDrag(event)
          }}
          onPointerCancel={(event) => {
            finishLocationDrag(event)
            finishObjectDrag(event)
          }}
        />
        {document.layers.map(renderLayer)}
      </pixiContainer>
    </pixiContainer>
  )
}

function MapObjectNode({
  object,
  x,
  y,
  selected,
  mode,
  layerLocked,
  viewportScale,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  object: MapObject
  x: number
  y: number
  selected: boolean
  mode: CanvasMode
  layerLocked: boolean
  viewportScale: number
  onSelect: () => void
  onDragStart: () => void
  onDragMove: (event: FederatedPointerEvent) => void
  onDragEnd: (event: FederatedPointerEvent) => void
}) {
  const [texture, setTexture] = useState(Texture.EMPTY)
  const [spin, setSpin] = useState(0)
  const hasImage = hasAsset(object.imageUrl) && texture !== Texture.EMPTY
  const tint = parseHexColor(object.tint, object.kind === 'collision' ? 0xef4444 : object.kind === 'trigger' ? 0x22c55e : 0x64748b)
  const behavior = object.behavior?.kind ?? 'none'

  useEffect(() => {
    let cancelled = false
    if (!hasAsset(object.imageUrl)) {
      setTexture(Texture.EMPTY)
      return
    }
    Assets.load<Texture>(object.imageUrl!)
      .then((tex) => { if (!cancelled) setTexture(tex) })
      .catch((err) => { console.warn('[map-pixi] 对象纹理加载失败:', object.imageUrl, err) })
    return () => { cancelled = true }
  }, [object.imageUrl])

  useTick((ticker) => {
    if (behavior !== 'rotate' || !object.animation?.autoplay) return
    setSpin((value) => value + ticker.deltaTime * (object.behavior?.speed ?? 1) * 0.025)
  })

  const drawFallbackObject = useCallback((graphics: PixiGraphics) => {
    graphics.clear()
    const alpha = object.kind === 'collision' || object.kind === 'trigger' ? 0.28 : 0.72
    if (object.kind === 'animated_sprite') {
      graphics.circle(0, 0, Math.max(object.width, object.height) / 2)
      graphics.fill({ color: tint, alpha })
      graphics.moveTo(0, 0)
      graphics.lineTo(object.width / 2, 0)
      graphics.stroke({ color: 0xffffff, alpha: 0.5, width: 2 / viewportScale })
    } else {
      graphics.roundRect(-object.width / 2, -object.height / 2, object.width, object.height, 8)
      graphics.fill({ color: tint, alpha })
    }
    graphics.roundRect(-object.width / 2, -object.height / 2, object.width, object.height, 8)
    graphics.stroke({
      color: selected ? 0x38bdf8 : 0xffffff,
      alpha: selected ? 0.95 : 0.25,
      width: (selected ? 3 : 1) / viewportScale,
    })
  }, [object.height, object.kind, object.width, selected, tint, viewportScale])

  return (
    <pixiContainer
      x={x}
      y={y}
      rotation={(object.rotation * Math.PI) / 180 + spin}
      alpha={object.opacity}
      eventMode="static"
      cursor={mode === 'edit' && !object.locked && !layerLocked ? 'grab' : 'pointer'}
      onPointerTap={onSelect}
      onPointerDown={(event: FederatedPointerEvent) => {
        onSelect()
        if (mode !== 'edit' || object.locked || layerLocked || event.button !== 0) return
        onDragStart()
      }}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerUpOutside={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      {hasImage ? (
        <pixiSprite texture={texture} anchor={{ x: 0.5, y: 0.5 }} width={object.width} height={object.height} />
      ) : (
        <pixiGraphics draw={drawFallbackObject} />
      )}
      {selected && (
        <pixiGraphics
          draw={(graphics) => {
            graphics.clear()
            graphics.roundRect(-object.width / 2 - 6, -object.height / 2 - 6, object.width + 12, object.height + 12, 10)
            graphics.stroke({ color: 0x38bdf8, alpha: 0.9, width: 2 / viewportScale })
          }}
        />
      )}
    </pixiContainer>
  )
}

function MapLocationNode({
  location,
  x,
  y,
  viewportScale,
  mode,
  selected,
  hovered,
  dragging,
  locked,
  iconTexture,
  onResizeIcon,
  onSelect,
  onHover,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  location: GameLocationData
  x: number
  y: number
  viewportScale: number
  mode: CanvasMode
  selected: boolean
  hovered: boolean
  dragging: boolean
  locked: boolean
  iconTexture: Texture | null
  onResizeIcon?: (width: number, height: number) => void
  onSelect: () => void
  onHover: (hovered: boolean) => void
  onDragStart: () => void
  onDragMove: (event: FederatedPointerEvent) => void
  onDragEnd: (event: FederatedPointerEvent) => void
}) {
  const hasIcon = iconTexture && iconTexture !== Texture.EMPTY
  const accent = selected ? 0x3b82f6 : location.disabled ? 0x8b8f98 : 0xf8fafc
  const fill = location.locationType === 'outdoor'
    ? 0x22c55e
    : location.locationType === 'district'
      ? 0xf59e0b
      : 0x3b82f6

  const drawPin = useCallback((graphics: PixiGraphics) => {
    graphics.clear()
    if (hasIcon) return
    graphics.circle(3, 5, 21)
    graphics.fill({ color: 0x000000, alpha: 0.22 })
    graphics.circle(0, 0, 18)
    graphics.fill({ color: fill, alpha: location.disabled ? 0.45 : 0.92 })
    graphics.circle(0, 0, 18)
    graphics.stroke({ color: accent, alpha: selected || hovered ? 0.95 : 0.5, width: (selected || hovered ? 3 : 1.5) / viewportScale })
    graphics.circle(0, 0, 6)
    graphics.fill({ color: 0xffffff, alpha: 0.95 })
  }, [accent, fill, hasIcon, hovered, location.disabled, selected, viewportScale])

  return (
    <pixiContainer
      x={x}
      y={y}
      eventMode="static"
      cursor={mode === 'edit' && !locked ? (dragging ? 'grabbing' : 'grab') : 'pointer'}
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
      onWheel={(event: FederatedWheelEvent) => {
        if (!hasIcon || !onResizeIcon) return
        const factor = event.deltaY < 0 ? 1.1 : 0.9
        const w = Math.round(Math.min(240, Math.max(8, (location.iconWidth ?? 26) * factor)))
        const h = Math.round(Math.min(240, Math.max(8, (location.iconHeight ?? 26) * factor)))
        onResizeIcon(w, h)
      }}
    >
      <pixiGraphics draw={drawPin} />
      {hasIcon && (
        <pixiSprite
          texture={iconTexture}
          anchor={{ x: 0.5, y: 0.5 }}
          width={location.iconWidth ?? 26}
          height={location.iconHeight ?? 26}
          alpha={location.disabled ? 0.55 : 0.95}
        />
      )}
    </pixiContainer>
  )
}

function LocationPreviewPopover({
  location,
  document,
  viewportWidth,
  viewportHeight,
}: {
  location: GameLocationData
  document: MapDocument
  viewportWidth: number
  viewportHeight: number
}) {
  const viewport = getViewportTransform(document, viewportWidth, viewportHeight)
  const x = viewport.x + (clampPercent(location.posX) / 100) * document.width * viewport.scale
  const y = viewport.y + (clampPercent(location.posY) / 100) * document.height * viewport.scale

  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium text-foreground/80 bg-foreground/10 backdrop-blur-sm"
      style={{ left: x, top: y - 28 }}
    >
      {location.displayName}
    </div>
  )
}

function getViewportTransform(document: MapDocument, width: number, height: number) {
  const scale = Math.min(width / document.width, height / document.height)
  return {
    scale,
    x: (width - document.width * scale) / 2,
    y: (height - document.height * scale) / 2,
  }
}

function clamp01(value: number) {
  if (Number.isNaN(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function parseHexColor(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const normalized = value.trim().replace('#', '')
  const parsed = Number.parseInt(normalized, 16)
  return Number.isFinite(parsed) ? parsed : fallback
}
