export type MapView = 'canvas' | 'structure'
export type CanvasMode = 'preview' | 'edit'
export type BuiltinLayerKind = 'background' | 'locations' | 'labels'
export type CanvasLayer = {
  id: string
  kind: BuiltinLayerKind | 'custom'
  name: string
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
    { id: 'background', kind: 'background', name: '空间底图' },
    { id: 'locations', kind: 'locations', name: '地点节点' },
    { id: 'labels', kind: 'labels', name: '地点标题' },
  ]
}
