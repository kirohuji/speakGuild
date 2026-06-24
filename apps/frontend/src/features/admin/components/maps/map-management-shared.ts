export type MapView = 'canvas' | 'structure'
export type CanvasMode = 'preview' | 'edit'
export type BuiltinLayerKind = 'background' | 'locations'
export type MapLayerKind = BuiltinLayerKind | 'terrain' | 'decor' | 'interactive' | 'characters' | 'effects' | 'collision' | 'debug' | 'custom'
export type MapObjectKind = 'static_sprite' | 'animated_sprite' | 'trigger' | 'collision' | 'location'
export type MapBehaviorKind = 'none' | 'rotate' | 'room_entry' | 'location_entry' | 'click_trigger' | 'ambient'

export type MapLayer = {
  id: string
  kind: MapLayerKind
  name: string
  backgroundUrl?: string
  visible: boolean
  locked: boolean
  opacity: number
  order: number
}

export type CanvasLayer = MapLayer

export type MapPrefab = {
  id: string
  name: string
  description: string
  kind: MapObjectKind
  layerKind: MapLayerKind
  imageUrl?: string
  width: number
  height: number
  tint?: string
  behavior?: {
    kind: MapBehaviorKind
    speed?: number
  }
}

export type MapObject = {
  id: string
  prefabId?: string
  layerId: string
  kind: MapObjectKind
  name: string
  imageUrl?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  tint?: string
  targetLocationId?: string
  targetRoomId?: string
  animation?: {
    autoplay: boolean
    loop: boolean
    fps: number
  }
  behavior?: {
    kind: MapBehaviorKind
    speed?: number
    payload?: Record<string, unknown>
  }
}

export type MapDocument = {
  version: 1
  width: number
  height: number
  layers: MapLayer[]
  objects: MapObject[]
  prefabs: MapPrefab[]
}
export type ReadinessItem = { key: string; ok: boolean; label: string }

export const roomTypeLabel: Record<string, string> = {
  vn_scene: 'VN 场景',
  hub: '枢纽',
  shop: '商店',
  quest: '任务点',
}

export const locationTypeLabel: Record<string, string> = {
  building: '建筑',
  outdoor: '户外',
  district: '街区',
}

export function clampPercent(value: number) {
  if (Number.isNaN(value)) return 50
  return Math.min(100, Math.max(0, value))
}

export function hasAsset(value?: string | null) {
  return Boolean(value && value.trim())
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function makeLocationKey(displayName: string) {
  const base = displayName
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || `location_${Date.now().toString(36)}`
}

export function defaultCanvasLayers(): CanvasLayer[] {
  return [
    { id: 'background', kind: 'background', name: '空间底图', visible: true, locked: false, opacity: 1, order: 0 },
    { id: 'decor', kind: 'decor', name: '建筑与装饰', visible: true, locked: false, opacity: 1, order: 10 },
    { id: 'interactive', kind: 'interactive', name: '入口与机关', visible: true, locked: false, opacity: 1, order: 20 },
    { id: 'effects', kind: 'effects', name: '动态效果', visible: true, locked: false, opacity: 1, order: 30 },
    { id: 'locations', kind: 'locations', name: '地点节点', visible: true, locked: false, opacity: 1, order: 40 },
    { id: 'collision', kind: 'collision', name: '碰撞与触发区', visible: false, locked: false, opacity: 0.45, order: 50 },
  ]
}

export function defaultMapPrefabs(): MapPrefab[] {
  return [
    {
      id: 'prefab_building_entry',
      name: '建筑入口',
      description: '可替换皮肤的地点入口，适合宿舍、图书馆、商店等建筑。',
      kind: 'static_sprite',
      layerKind: 'interactive',
      width: 160,
      height: 120,
      tint: '#3b82f6',
      behavior: { kind: 'location_entry' },
    },
    {
      id: 'prefab_decor_building',
      name: '装饰建筑',
      description: '只负责视觉表现的建筑或大型装饰。',
      kind: 'static_sprite',
      layerKind: 'decor',
      width: 180,
      height: 140,
      tint: '#64748b',
      behavior: { kind: 'none' },
    },
    {
      id: 'prefab_rotating_gear',
      name: '旋转机关',
      description: '单图旋转动画，适合齿轮、风扇、广告牌等循环机关。',
      kind: 'animated_sprite',
      layerKind: 'effects',
      width: 96,
      height: 96,
      tint: '#f59e0b',
      behavior: { kind: 'rotate', speed: 1.8 },
    },
    {
      id: 'prefab_trigger_zone',
      name: '触发区域',
      description: '不可见或半透明区域，点击或进入后触发脚本/房间。',
      kind: 'trigger',
      layerKind: 'collision',
      width: 180,
      height: 100,
      tint: '#22c55e',
      behavior: { kind: 'click_trigger' },
    },
    {
      id: 'prefab_collision_block',
      name: '碰撞阻挡',
      description: '运行时不可通行区域，编辑器里可视化。',
      kind: 'collision',
      layerKind: 'collision',
      width: 160,
      height: 80,
      tint: '#ef4444',
      behavior: { kind: 'none' },
    },
  ]
}

export function normalizeMapDocument(editorData: unknown, fallback?: { width?: number; height?: number }): MapDocument {
  const input = (editorData && typeof editorData === 'object') ? editorData as Partial<MapDocument> : {}
  const width = Number(input.width || fallback?.width || 1920)
  const height = Number(input.height || fallback?.height || 1080)
  const layers = (Array.isArray(input.layers) && input.layers.length > 0 ? input.layers : defaultCanvasLayers())
    .map((layer, index) => ({
      id: layer.id || uid('layer'),
      kind: layer.kind || 'custom',
      name: layer.name || `图层 ${index + 1}`,
      backgroundUrl: layer.backgroundUrl,
      visible: layer.visible ?? true,
      locked: layer.locked ?? false,
      opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
      order: typeof layer.order === 'number' ? layer.order : index * 10,
    }))
    .sort((a, b) => a.order - b.order)
  const prefabs = Array.isArray(input.prefabs) && input.prefabs.length > 0 ? input.prefabs : defaultMapPrefabs()
  const layerIds = new Set(layers.map((layer) => layer.id))
  const fallbackLayerId = layers.find((layer) => layer.kind === 'decor')?.id || layers[0]?.id || 'decor'
  const objects = (Array.isArray(input.objects) ? input.objects : []).map((object) => ({
    id: object.id || uid('object'),
    prefabId: object.prefabId,
    layerId: layerIds.has(object.layerId) ? object.layerId : fallbackLayerId,
    kind: object.kind || 'static_sprite',
    name: object.name || '地图对象',
    imageUrl: object.imageUrl,
    x: typeof object.x === 'number' ? object.x : width / 2,
    y: typeof object.y === 'number' ? object.y : height / 2,
    width: typeof object.width === 'number' ? object.width : 120,
    height: typeof object.height === 'number' ? object.height : 90,
    rotation: typeof object.rotation === 'number' ? object.rotation : 0,
    opacity: typeof object.opacity === 'number' ? object.opacity : 1,
    visible: object.visible ?? true,
    locked: object.locked ?? false,
    tint: object.tint,
    targetLocationId: object.targetLocationId,
    targetRoomId: object.targetRoomId,
    animation: object.animation,
    behavior: object.behavior,
  }))
  return { version: 1, width, height, layers, objects, prefabs }
}

export function createObjectFromPrefab(prefab: MapPrefab, document: MapDocument): MapObject {
  const layer = document.layers.find((item) => item.kind === prefab.layerKind) ?? document.layers.find((item) => item.kind === 'decor') ?? document.layers[0]
  return {
    id: uid('object'),
    prefabId: prefab.id,
    layerId: layer?.id || 'decor',
    kind: prefab.kind,
    name: prefab.name,
    imageUrl: prefab.imageUrl,
    x: Math.round(document.width / 2),
    y: Math.round(document.height / 2),
    width: prefab.width,
    height: prefab.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    tint: prefab.tint,
    animation: prefab.kind === 'animated_sprite' ? { autoplay: true, loop: true, fps: 12 } : undefined,
    behavior: prefab.behavior,
  }
}
