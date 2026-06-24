import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Box, CopyPlus, Eye, EyeOff, Hand, Lock,
  MapPin, MousePointer2, Plus, RotateCcw, Trash2, Unlock,
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

type EditViewTool = 'select' | 'pan'

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
  const isPreview = mode === 'preview'
  const previewSize = { width: 390, height: 844 }
  const [editViewTool, setEditViewTool] = useState<EditViewTool>('select')
  const [viewportVersion, setViewportVersion] = useState(0)
  const [zoomLabel, setZoomLabel] = useState('100%')
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
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => {
      setSize({
        width: isPreview ? previewSize.width : Math.max(320, Math.round(host.clientWidth)),
        height: isPreview ? previewSize.height : Math.max(320, Math.round(host.clientHeight)),
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [height, isPreview])

  return (
    <div className={cn('grid gap-3', isPreview ? 'justify-center' : 'xl:grid-cols-[220px_minmax(0,1fr)_260px]')}>
      <ScrollArea className={cn('rounded-xl bg-card', isPreview && 'hidden')} style={{ height }}>
        <div className="p-2">
          <LayerPanel
            map={map}
            mode={mode}
            layers={document.layers}
            objects={document.objects}
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
        </div>
      </ScrollArea>

      <div
        ref={hostRef}
        className={cn(
          'relative overflow-hidden rounded-xl bg-muted [overflow-anchor:none]',
          isPreview && 'mx-auto',
          mode === 'edit' ? 'cursor-crosshair' : 'cursor-default',
        )}
        style={isPreview ? previewSize : { height }}
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
            editViewTool={editViewTool}
            viewportVersion={viewportVersion}
            onSelectLocation={onSelectLocation}
            onMoveLocation={onMoveLocation}
            onResizeLocationIcon={onResizeLocationIcon}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onZoomChange={setZoomLabel}
            onHoverLocation={setHoveredLocationId}
            onLeaveLocation={() => setHoveredLocationId('')}
          />
        </Application>
        {!isPreview && (
          <div className="absolute right-2 top-2 z-10 flex items-center rounded-lg bg-background/90 backdrop-blur">
            <Button
              variant={editViewTool === 'select' ? 'default' : 'ghost'}
              size="icon"
              className="size-7"
              title="选择/拖动对象"
              onClick={() => setEditViewTool('select')}
            >
              <MousePointer2 className="size-3.5" />
            </Button>
            <Button
              variant={editViewTool === 'pan' ? 'default' : 'ghost'}
              size="icon"
              className="size-7"
              title="拖动画布"
              onClick={() => setEditViewTool('pan')}
            >
              <Hand className="size-3.5" />
            </Button>
            <span className="min-w-12 px-2 text-center font-mono text-[10px] text-muted-foreground">
              {zoomLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="重置视图"
              onClick={() => setViewportVersion((value) => value + 1)}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        )}
        {hoveredLocation && (
          <LocationPreviewPopover
            location={hoveredLocation}
            document={document}
            viewportWidth={size.width}
            viewportHeight={size.height}
            mode={mode}
          />
        )}
        {locations.length === 0 && document.objects.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-xl bg-background/95 px-5 py-4">
              <MapPin className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">这张地图还没有地点或地图对象</p>
              <Button size="sm" onClick={onCreateLocation}>
                <Plus data-icon="inline-start" />
                添加地点
              </Button>
            </div>
          </div>
        )}
        {isPreview && (
          <div className="pointer-events-none absolute left-3 top-3 bg-black/45 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur">
            iPhone 12 · 390 x 844
          </div>
        )}
      </div>
      <ScrollArea className={cn('rounded-xl bg-card', isPreview && 'hidden')} style={{ height }}>
        <div className="flex flex-col gap-3 p-2">
          <PrefabPanel
            prefabs={document.prefabs}
            selectedLocationName={selectedLocation?.displayName}
            onAddObjectFromPrefab={onAddObjectFromPrefab}
          />
          <ObjectPanel
            document={document}
            locations={locations}
            roomsForLoc={roomsForLoc}
            selectedLocationId={selectedLocationId}
            selectedLocationName={selectedLocation?.displayName}
            selectedObject={selectedObject}
            onSelectLayer={onSelectLayer}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onDeleteObject={onDeleteObject}
          />
        </div>
      </ScrollArea>
    </div>
  )
}

function LayerPanel({
  map,
  mode,
  layers,
  objects,
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
  objects: MapObject[]
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
  const layerObjectCounts = useMemo(() => {
    const counts = new Map<string, number>()
    objects.forEach((object) => counts.set(object.layerId, (counts.get(object.layerId) ?? 0) + 1))
    return counts
  }, [objects])

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold">图层</p>
        <Button size="icon" variant="outline" className="size-6" title="添加图层" onClick={onAddLayer}>
          <Plus className="size-3" />
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        {layers.map((layer) => {
          const objectCount = layerObjectCounts.get(layer.id) ?? 0
          const isSystemLayer = layer.kind === 'background' || layer.kind === 'locations'
          const canDeleteLayer = !isSystemLayer && objectCount === 0
          return (
          <div
            key={layer.id}
            role="button"
            tabIndex={0}
            className={cn(
              'flex items-center gap-0.5 bg-background px-1.5 py-1 text-left',
              selectedLayer?.id === layer.id && 'bg-primary/5',
            )}
            onClick={() => onSelectLayer(layer.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelectLayer(layer.id)
            }}
          >
            <Button variant="ghost" size="icon" className="size-5" onClick={(event) => { event.stopPropagation(); onToggleLayerVisible(layer.id) }}>
              {layer.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="size-5" onClick={(event) => { event.stopPropagation(); onToggleLayerLocked(layer.id) }}>
              {layer.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
            </Button>
            <span className="min-w-0 flex-1 truncate text-[11px]">{layer.name}</span>
            {objectCount > 0 && <span className="px-1 font-mono text-[9px] text-muted-foreground">{objectCount}</span>}
            <Button variant="ghost" size="icon" className="size-5" onClick={(event) => { event.stopPropagation(); onMoveLayer(layer.id, -1) }}>
              <ArrowUp className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="size-5" onClick={(event) => { event.stopPropagation(); onMoveLayer(layer.id, 1) }}>
              <ArrowDown className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              disabled={!canDeleteLayer}
              title={isSystemLayer ? '系统图层不能删除' : objectCount > 0 ? '图层里还有对象，先移动或删除对象' : '删除图层'}
              onClick={(event) => { event.stopPropagation(); onDeleteLayer(layer.id) }}
            >
              <Trash2 className="size-3 text-destructive" />
            </Button>
          </div>
        )})}
      </div>
      {selectedLayer && (
        <div className="space-y-2 rounded-lg bg-background/60 p-2">
          <div className="grid gap-1.5">
            <Label className="text-[10px]">图层名称</Label>
            <Input
              className="h-7 text-xs"
              value={selectedLayer.name}
              disabled={selectedLayer.kind !== 'custom'}
              onChange={(event) => onUpdateLayer(selectedLayer.id, { name: event.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[10px]">透明度</Label>
            <Input
              className="h-7 text-xs"
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
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
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
  selectedLocationName,
  onAddObjectFromPrefab,
}: {
  prefabs: MapPrefab[]
  selectedLocationName?: string
  onAddObjectFromPrefab: (prefab: MapPrefab) => void
}) {
  const disabled = !selectedLocationName
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold">Prefab</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {selectedLocationName ?? '先选择地点'}
          </p>
        </div>
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{prefabs.length}</Badge>
      </div>
      <div className="grid gap-1">
        {prefabs.map((prefab) => (
          <button
            key={prefab.id}
            type="button"
            title={prefab.description}
            disabled={disabled}
            className="flex items-center gap-1.5 bg-background px-2 py-1.5 text-left hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => onAddObjectFromPrefab(prefab)}
          >
            <CopyPlus className="size-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{prefab.name}</span>
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
  selectedLocationId,
  selectedLocationName,
  selectedObject,
  onSelectLayer,
  onSelectObject,
  onUpdateObject,
  onDeleteObject,
}: {
  document: MapDocument
  locations: GameLocationData[]
  roomsForLoc: (locId: string) => GameRoomData[]
  selectedLocationId: string
  selectedLocationName?: string
  selectedObject: MapObject | null
  onSelectLayer: (layerId: string) => void
  onSelectObject: (objectId: string) => void
  onUpdateObject: (objectId: string, patch: Partial<MapObject>) => void
  onDeleteObject: (objectId: string) => void
}) {
  const rooms = locations.flatMap((loc) => roomsForLoc(loc.id).map((room) => ({ ...room, locationName: loc.displayName })))
  const scopedObjects = selectedLocationId
    ? document.objects.filter((object) => object.targetLocationId === selectedLocationId)
    : document.objects.filter((object) => !object.targetLocationId)
  const scopedSelectedObject = selectedObject && scopedObjects.some((object) => object.id === selectedObject.id)
    ? selectedObject
    : null
  const selectedLayer = scopedSelectedObject ? document.layers.find((layer) => layer.id === scopedSelectedObject.layerId) : null
  const objectScale = scopedSelectedObject
    ? Math.round((Math.max(scopedSelectedObject.width, scopedSelectedObject.height) / 120) * 100)
    : 100

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">对象</p>
          <p className="truncate text-[10px] text-muted-foreground">{selectedLocationName ?? '全局对象'}</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">{scopedObjects.length}</Badge>
      </div>
      <div className="grid gap-1">
        {scopedObjects.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {selectedLocationName ? '从 Prefab 给当前地点添加视觉对象。' : '未绑定地点的全局对象会显示在这里。'}
          </p>
        ) : scopedObjects.map((object) => (
          <div
            key={object.id}
            className={cn(
              'flex items-center gap-1 bg-background px-2 py-1.5',
              selectedObject?.id === object.id && 'bg-primary/5',
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
      {scopedSelectedObject && (
        <div className="space-y-3 rounded-lg bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{scopedSelectedObject.name}</p>
              <p className="text-[11px] text-muted-foreground">{selectedLayer?.name ?? '未知图层'}</p>
            </div>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onDeleteObject(scopedSelectedObject.id)}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs">名称</Label>
            <Input className="h-8" value={scopedSelectedObject.name} onChange={(event) => onUpdateObject(scopedSelectedObject.id, { name: event.target.value })} />
          </div>
          <ImageUploadField
            value={scopedSelectedObject.imageUrl ?? ''}
            onChange={(url) => onUpdateObject(scopedSelectedObject.id, { imageUrl: url })}
            placeholder="替换 prefab 皮肤"
            previewSize="sm"
            group="library"
          />
          <div className="grid gap-2">
            <Label className="text-xs">图层</Label>
            <select
              className="h-8 border border-input bg-background px-2 text-xs"
              value={scopedSelectedObject.layerId}
              onChange={(event) => {
                onUpdateObject(scopedSelectedObject.id, { layerId: event.target.value })
                onSelectLayer(event.target.value)
              }}
            >
              {document.layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={scopedSelectedObject.x} onChange={(value) => onUpdateObject(scopedSelectedObject.id, { x: value })} />
            <NumberField label="Y" value={scopedSelectedObject.y} onChange={(value) => onUpdateObject(scopedSelectedObject.id, { y: value })} />
            <NumberField label="宽" value={scopedSelectedObject.width} onChange={(value) => onUpdateObject(scopedSelectedObject.id, { width: Math.max(4, value) })} />
            <NumberField label="高" value={scopedSelectedObject.height} onChange={(value) => onUpdateObject(scopedSelectedObject.id, { height: Math.max(4, value) })} />
            <NumberField label="旋转" value={scopedSelectedObject.rotation} onChange={(value) => onUpdateObject(scopedSelectedObject.id, { rotation: value })} />
            <NumberField label="透明" value={scopedSelectedObject.opacity} step={0.05} onChange={(value) => onUpdateObject(scopedSelectedObject.id, { opacity: clamp01(value) })} />
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
                const currentMax = Math.max(scopedSelectedObject.width, scopedSelectedObject.height) || 120
                const nextMax = (value / 100) * 120
                const ratio = nextMax / currentMax
                onUpdateObject(scopedSelectedObject.id, {
                  width: Math.max(4, Math.round(scopedSelectedObject.width * ratio)),
                  height: Math.max(4, Math.round(scopedSelectedObject.height * ratio)),
                })
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">绑定地点</Label>
            <select
              className="h-8 border border-input bg-background px-2 text-xs"
              value={scopedSelectedObject.targetLocationId ?? ''}
              onChange={(event) => onUpdateObject(scopedSelectedObject.id, { targetLocationId: event.target.value || undefined })}
            >
              <option value="">不绑定</option>
              {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.displayName}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">绑定房间</Label>
            <select
              className="h-8 border border-input bg-background px-2 text-xs"
              value={scopedSelectedObject.targetRoomId ?? ''}
              onChange={(event) => onUpdateObject(scopedSelectedObject.id, { targetRoomId: event.target.value || undefined })}
            >
              <option value="">不绑定</option>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.locationName} / {room.displayName}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">行为</Label>
            <select
              className="h-8 border border-input bg-background px-2 text-xs"
              value={scopedSelectedObject.behavior?.kind ?? 'none'}
              onChange={(event) => onUpdateObject(scopedSelectedObject.id, { behavior: { ...scopedSelectedObject.behavior, kind: event.target.value as MapObject['behavior']['kind'] } })}
            >
              <option value="none">无</option>
              <option value="rotate">持续旋转</option>
              <option value="location_entry">进入地点</option>
              <option value="room_entry">进入房间</option>
              <option value="click_trigger">点击触发</option>
              <option value="ambient">氛围效果</option>
            </select>
          </div>
          {scopedSelectedObject.behavior?.kind === 'rotate' && (
            <NumberField
              label="旋转速度"
              value={scopedSelectedObject.behavior.speed ?? 1}
              step={0.1}
              onChange={(value) => onUpdateObject(scopedSelectedObject.id, { behavior: { ...scopedSelectedObject.behavior, speed: value } })}
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
  editViewTool,
  viewportVersion,
  onSelectLocation,
  onMoveLocation,
  onResizeLocationIcon,
  onSelectObject,
  onUpdateObject,
  onZoomChange,
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
  editViewTool: EditViewTool
  viewportVersion: number
  onSelectLocation: (id: string) => void
  onMoveLocation: (loc: GameLocationData, posX: number, posY: number) => void
  onResizeLocationIcon?: (locId: string, width: number, height: number) => void
  onSelectObject: (id: string) => void
  onUpdateObject: (objectId: string, patch: Partial<MapObject>) => void
  onZoomChange: (label: string) => void
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
  const [viewportPan, setViewportPan] = useState({ x: 0, y: 0 })
  const [zoomScale, setZoomScale] = useState(1)
  const [panning, setPanning] = useState(false)
  const panStartRef = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 })
  const baseViewport = useMemo(() => getViewportTransform(document, width, height, mode), [document, height, mode, width])
  const viewport = useMemo(() => ({
    ...baseViewport,
    scale: baseViewport.scale * zoomScale,
    x: baseViewport.x + viewportPan.x,
    y: baseViewport.y + viewportPan.y,
  }), [baseViewport, viewportPan, zoomScale])

  useEffect(() => {
    if (!isInitialised || !app.stage) return
    app.stage.eventMode = 'static'
  }, [app, isInitialised])

  // Sync Pixi renderer size to container dimensions (side-effect free resize)
  useEffect(() => {
    if (!isInitialised) return
    app.renderer.resize(width, height)
  }, [app, isInitialised, width, height])

  useEffect(() => {
    setDraftLocationPositions({})
    setDraftObjectPositions({})
    setDraggingLocationId('')
    setDraggingObjectId('')
    activeLocationDragIdRef.current = ''
    activeObjectDragIdRef.current = ''
    setHoveredId('')
    setViewportPan({ x: 0, y: 0 })
    setZoomScale(1)
    setPanning(false)
  }, [map.id])

  useEffect(() => {
    setViewportPan({ x: 0, y: 0 })
    setZoomScale(1)
    setPanning(false)
  }, [document.height, document.width, height, mode, viewportVersion, width])

  useEffect(() => {
    onZoomChange(`${Math.round(zoomScale * 100)}%`)
  }, [onZoomChange, zoomScale])

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

  const clampViewportPan = useCallback((pan: { x: number; y: number }, scale = viewport.scale) => {
    const scaledWidth = document.width * scale
    const scaledHeight = document.height * scale
    const slackX = Math.max(0, (scaledWidth - width) / 2)
    const slackY = Math.max(0, (scaledHeight - height) / 2)
    return {
      x: Math.max(-slackX, Math.min(slackX, pan.x)),
      y: Math.max(-slackY, Math.min(slackY, pan.y)),
    }
  }, [document.height, document.width, height, viewport.scale, width])

  const handleViewportWheel = (event: FederatedWheelEvent) => {
    if (mode !== 'edit') return
    event.preventDefault()
    const nextZoom = Math.max(1, Math.min(5, zoomScale * (event.deltaY < 0 ? 1.12 : 0.88)))
    if (nextZoom === zoomScale) return
    const worldX = (event.global.x - viewport.x) / viewport.scale
    const worldY = (event.global.y - viewport.y) / viewport.scale
    const nextScale = baseViewport.scale * nextZoom
    const nextPan = clampViewportPan({
      x: event.global.x - baseViewport.x - worldX * nextScale,
      y: event.global.y - baseViewport.y - worldY * nextScale,
    }, nextScale)
    setZoomScale(nextZoom)
    setViewportPan(nextPan)
  }

  const startViewportPan = (event: FederatedPointerEvent) => {
    if (event.button !== 0) return
    if (mode !== 'preview' && editViewTool !== 'pan') return
    panStartRef.current = {
      pointerX: event.global.x,
      pointerY: event.global.y,
      panX: viewportPan.x,
      panY: viewportPan.y,
    }
    setPanning(true)
  }

  const moveViewportPan = (event: FederatedPointerEvent) => {
    if (!panning) return
    const start = panStartRef.current
    setViewportPan(clampViewportPan({
      x: start.panX + event.global.x - start.pointerX,
      y: start.panY + event.global.y - start.pointerY,
    }))
  }

  const finishViewportPan = () => {
    setPanning(false)
  }

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
          locked={layer.locked || editViewTool === 'pan'}
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
              if (layer.locked || editViewTool === 'pan') return
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
            layerLocked={layer.locked || editViewTool === 'pan'}
            viewportScale={viewport.scale}
            onSelect={() => {
              onSelectObject(object.id)
              if (object.targetLocationId && (
                mode === 'edit' ||
                object.behavior?.kind === 'location_entry' ||
                object.behavior?.kind === 'room_entry' ||
                object.behavior?.kind === 'click_trigger'
              )) {
                onSelectLocation(object.targetLocationId)
              }
            }}
            onDragStart={() => {
              if (object.locked || layer.locked || editViewTool === 'pan') return
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
          cursor={mode === 'preview' || editViewTool === 'pan' ? (panning ? 'grabbing' : 'grab') : mode === 'edit' && (draggingObjectId || draggingLocationId) ? 'grabbing' : 'default'}
          draw={(graphics) => {
            graphics.clear()
            graphics.rect(0, 0, document.width, document.height)
            graphics.fill({ color: 0x000000, alpha: 0.001 })
          }}
          onPointerDown={startViewportPan}
          onWheel={handleViewportWheel}
          onPointerMove={(event) => {
            moveViewportPan(event)
            handleLocationMove(event)
            handleObjectMove(event)
          }}
          onPointerUp={(event) => {
            finishViewportPan()
            finishLocationDrag(event)
            finishObjectDrag(event)
          }}
          onPointerUpOutside={(event) => {
            finishViewportPan()
            finishLocationDrag(event)
            finishObjectDrag(event)
          }}
          onPointerCancel={(event) => {
            finishViewportPan()
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
        if (!event.altKey || !hasIcon || !onResizeIcon) return
        event.stopPropagation()
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
  mode,
}: {
  location: GameLocationData
  document: MapDocument
  viewportWidth: number
  viewportHeight: number
  mode: CanvasMode
}) {
  const viewport = getViewportTransform(document, viewportWidth, viewportHeight, mode)
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

function getViewportTransform(document: MapDocument, width: number, height: number, mode: CanvasMode = 'edit') {
  const fitScale = mode === 'preview'
    ? Math.max(width / document.width, height / document.height) * 1.2
    : Math.min(width / document.width, height / document.height)
  const scale = Number.isFinite(fitScale) ? fitScale : 1
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
