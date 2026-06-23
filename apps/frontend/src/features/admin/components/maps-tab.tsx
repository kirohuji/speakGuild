import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronRight,
  Edit3, Eye, EyeOff, Home, Layers3, Lock, Map, MapPin, Maximize2, Minimize2,
  MousePointer2, Move, Plus, RotateCcw, Route, ScrollText, SlidersHorizontal,
  Trash2, Unlock, Users,
} from 'lucide-react'
import { Application, extend, useApplication } from '@pixi/react'
import {
  Container, Graphics, Sprite, Text as PixiText, Texture,
  type FederatedPointerEvent, type Graphics as PixiGraphics,
} from 'pixi.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import {
  listMaps, createMap, updateMap, deleteMap,
  listLocations, createLocation, updateLocation, deleteLocation,
  listRooms, createRoom, updateRoom, deleteRoom,
  addRoomNpc, removeRoomNpc,
  listCharacters,
  type GameMapData, type GameLocationData, type GameRoomData, type GameCharacter,
} from '../api-content-admin'
import { ImageUploadField } from './image-upload-field'

interface MapsTabProps {
  onLocationsChange?: (locations: GameLocationData[]) => void
}

type MapView = 'canvas' | 'structure'
type CanvasMode = 'preview' | 'edit'
type BuiltinLayerKind = 'background' | 'locations' | 'labels'
type CanvasLayer = {
  id: string
  kind: BuiltinLayerKind | 'custom'
  name: string
}

extend({ Container, Graphics, Sprite, Text: PixiText })
const PixiTextElement = 'pixiText' as any

const roomTypeLabel: Record<string, string> = {
  vn_scene: 'VN 场景',
  hub: '枢纽',
  shop: '商店',
  quest: '任务点',
}

const locationTypeLabel: Record<string, string> = {
  building: '建筑',
  outdoor: '户外',
  district: '街区',
}

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 50
  return Math.min(100, Math.max(0, value))
}

function hasAsset(value?: string | null) {
  return Boolean(value && value.trim())
}

function makeLocationKey(displayName: string) {
  const base = displayName
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || `location_${Date.now().toString(36)}`
}

function defaultCanvasLayers(): CanvasLayer[] {
  return [
    { id: 'background', kind: 'background', name: '空间底图' },
    { id: 'locations', kind: 'locations', name: '地点节点' },
    { id: 'labels', kind: 'labels', name: '地点标题' },
  ]
}

export function MapsTab({ onLocationsChange }: MapsTabProps) {
  const [maps, setMaps] = useState<GameMapData[]>([])
  const [locations, setLocations] = useState<GameLocationData[]>([])
  const [rooms, setRooms] = useState<GameRoomData[]>([])
  const [characters, setCharacters] = useState<GameCharacter[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedMapId, setSelectedMapId] = useState<string>('')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [view, setView] = useState<MapView>('canvas')
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('preview')
  const [canvasLayers, setCanvasLayers] = useState<CanvasLayer[]>(() => defaultCanvasLayers())
  const [layerVisible, setLayerVisible] = useState<Record<string, boolean>>({
    background: true,
    locations: true,
    labels: false,
  })
  const [layerLocked, setLayerLocked] = useState<Record<string, boolean>>({
    background: false,
    locations: false,
    labels: true,
  })
  const [backgroundScale, setBackgroundScale] = useState(1)
  const [backgroundRotation, setBackgroundRotation] = useState(0)
  const [leftPanelWidth, setLeftPanelWidth] = useState(260)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [canvasHeight, setCanvasHeight] = useState(620)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const [mapDialogOpen, setMapDialogOpen] = useState(false)
  const [editMap, setEditMap] = useState<GameMapData | null>(null)
  const [mapForm, setMapForm] = useState({
    name: '', displayName: '', requiredOutputLevel: 'L1',
    sortOrder: 0,
    backgroundUrl: '', thumbnailUrl: '',
  })

  const [locDialogOpen, setLocDialogOpen] = useState(false)
  const [editLoc, setEditLoc] = useState<GameLocationData | null>(null)
  const [locForm, setLocForm] = useState({
    mapId: '', name: '', displayName: '', description: '',
    posX: 50, posY: 50, locationType: 'building',
    requiredOutputLevel: 'L1', sortOrder: 0,
    backgroundUrl: '',
  })

  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [editRoom, setEditRoom] = useState<GameRoomData | null>(null)
  const [roomForm, setRoomForm] = useState({
    locationId: '', name: '', displayName: '', description: '',
    roomType: 'vn_scene', isEntrance: false,
    disabled: false, hidden: false,
    icon: '', inkScriptId: '',
    requiredOutputLevel: 'L1', sortOrder: 0,
    backgroundUrl: '',
  })

  const [addNpcOpen, setAddNpcOpen] = useState(false)
  const [addNpcRoomId, setAddNpcRoomId] = useState('')
  const [addNpcCharId, setAddNpcCharId] = useState('')

  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mps, locs, rms, chars] = await Promise.all([
        listMaps(),
        listLocations().catch(() => [] as GameLocationData[]),
        listRooms().catch(() => [] as GameRoomData[]),
        listCharacters().catch(() => [] as GameCharacter[]),
      ])
      setMaps(mps)
      setLocations(locs)
      setRooms(rms)
      setCharacters(chars)
      onLocationsChange?.(locs)
      setSelectedMapId((current) => current || mps[0]?.id || '')
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [onLocationsChange])

  useEffect(() => { load() }, [load])

  const selectedMap = useMemo(
    () => maps.find((m) => m.id === selectedMapId) ?? maps[0] ?? null,
    [maps, selectedMapId],
  )

  const locsForMap = useCallback(
    (mapId: string) => locations.filter((l) => l.mapId === mapId),
    [locations],
  )

  const roomsForLoc = useCallback(
    (locId: string) => rooms.filter((r) => r.locationId === locId),
    [rooms],
  )

  const selectedLocations = useMemo(
    () => (selectedMap ? locsForMap(selectedMap.id) : []),
    [locsForMap, selectedMap],
  )

  const selectedLocation = useMemo(
    () => selectedLocations.find((l) => l.id === selectedLocationId) ?? selectedLocations[0] ?? null,
    [selectedLocationId, selectedLocations],
  )

  const selectedMapRooms = useMemo(
    () => selectedLocations.flatMap((loc) => roomsForLoc(loc.id)),
    [roomsForLoc, selectedLocations],
  )

  const selectedLocationRooms = useMemo(
    () => (selectedLocation ? roomsForLoc(selectedLocation.id) : []),
    [roomsForLoc, selectedLocation],
  )

  const preserveScroll = useCallback((action: () => void) => {
    const scroller = document.querySelector('main')
    const scrollTop = scroller?.scrollTop ?? window.scrollY
    action()
    requestAnimationFrame(() => {
      if (scroller) {
        scroller.scrollTop = scrollTop
      } else {
        window.scrollTo({ top: scrollTop })
      }
    })
  }, [])

  const selectLocationFromCanvas = useCallback((id: string) => {
    preserveScroll(() => setSelectedLocationId(id))
  }, [preserveScroll])

  const toggleLayerVisible = useCallback((layerId: string) => {
    setLayerVisible((prev) => ({ ...prev, [layerId]: !(prev[layerId] ?? true) }))
  }, [])

  const toggleLayerLocked = useCallback((layerId: string) => {
    setLayerLocked((prev) => ({ ...prev, [layerId]: !(prev[layerId] ?? false) }))
  }, [])

  const moveLayer = useCallback((layerId: string, direction: -1 | 1) => {
    setCanvasLayers((prev) => {
      const index = prev.findIndex((layer) => layer.id === layerId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }, [])

  const addCanvasLayer = useCallback(() => {
    const id = `custom_${Date.now().toString(36)}`
    setCanvasLayers((prev) => [...prev, { id, kind: 'custom', name: `新图层 ${prev.filter((layer) => layer.kind === 'custom').length + 1}` }])
    setLayerVisible((prev) => ({ ...prev, [id]: true }))
    setLayerLocked((prev) => ({ ...prev, [id]: false }))
  }, [])

  const deleteCanvasLayer = useCallback((layerId: string) => {
    setCanvasLayers((prev) => prev.filter((layer) => layer.id !== layerId))
    setLayerVisible((prev) => {
      const next = { ...prev }
      delete next[layerId]
      return next
    })
    setLayerLocked((prev) => {
      const next = { ...prev }
      delete next[layerId]
      return next
    })
  }, [])

  const readinessItems = useMemo(() => {
    if (!selectedMap) return []
    const items: { key: string; ok: boolean; label: string }[] = []
    items.push({
      key: 'map-bg',
      ok: hasAsset(selectedMap.backgroundUrl),
      label: '地图背景图',
    })
    items.push({
      key: 'locations',
      ok: selectedLocations.length > 0,
      label: '至少一个地点',
    })
    selectedLocations.forEach((loc) => {
      const locRooms = roomsForLoc(loc.id)
      items.push({
        key: `${loc.id}-rooms`,
        ok: locRooms.length > 0,
        label: `${loc.displayName} 有房间`,
      })
      items.push({
        key: `${loc.id}-entrance`,
        ok: locRooms.some((rm) => rm.isEntrance),
        label: `${loc.displayName} 有入口房间`,
      })
    })
    selectedMapRooms
      .filter((rm) => rm.roomType === 'vn_scene' || rm.roomType === 'quest')
      .forEach((rm) => {
        items.push({
          key: `${rm.id}-npc`,
          ok: (rm.npcs?.length ?? 0) > 0,
          label: `${rm.displayName} 有 NPC`,
        })
        items.push({
          key: `${rm.id}-story`,
          ok: hasAsset(rm.inkScriptId),
          label: `${rm.displayName} 绑定脚本`,
        })
      })
    return items
  }, [roomsForLoc, selectedLocations, selectedMap, selectedMapRooms])

  const readinessOk = readinessItems.filter((item) => item.ok).length
  const readinessTotal = readinessItems.length
  const readinessIssues = readinessItems.filter((item) => !item.ok)

  const openCreateMap = () => {
    setEditMap(null)
    setMapForm({ name: '', displayName: '', requiredOutputLevel: 'L1', sortOrder: 0, backgroundUrl: '', thumbnailUrl: '' })
    setMapDialogOpen(true)
  }

  const openEditMap = (m: GameMapData) => {
    setEditMap(m)
    setMapForm({
      name: m.name,
      displayName: m.displayName,
      requiredOutputLevel: m.requiredOutputLevel,
      sortOrder: m.sortOrder ?? 0,
      backgroundUrl: m.backgroundUrl ?? '',
      thumbnailUrl: m.thumbnailUrl ?? '',
    })
    setMapDialogOpen(true)
  }

  const saveMap = async () => {
    if (!mapForm.name || !mapForm.displayName) { toast.error('名称和显示名必填'); return }
    setSaving(true)
    try {
      const saved = editMap ? await updateMap(editMap.id, mapForm) : await createMap(mapForm)
      toast.success(editMap ? '地图已更新' : '地图已创建')
      setSelectedMapId(saved.id)
      setMapDialogOpen(false)
      load()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const removeMap = async (m: GameMapData) => {
    if (!confirm(`删除地图 "${m.displayName}"？其下所有地点和房间也将被删除。`)) return
    try {
      await deleteMap(m.id)
      toast.success('已删除')
      setSelectedMapId((current) => (current === m.id ? '' : current))
      load()
    } catch {
      toast.error('删除失败')
    }
  }

  const openCreateLoc = (mapId: string) => {
    setEditLoc(null)
    setLocForm({
      mapId, name: '', displayName: '', description: '',
      posX: 50, posY: 50, locationType: 'building',
      requiredOutputLevel: 'L1', sortOrder: 0,
      backgroundUrl: '',
    })
    setLocDialogOpen(true)
  }

  const openEditLoc = (loc: GameLocationData) => {
    setEditLoc(loc)
    setLocForm({
      mapId: loc.mapId,
      name: loc.name,
      displayName: loc.displayName,
      description: loc.description ?? '',
      posX: loc.posX,
      posY: loc.posY,
      locationType: loc.locationType,
      requiredOutputLevel: loc.requiredOutputLevel,
      sortOrder: loc.sortOrder ?? 0,
      backgroundUrl: loc.backgroundUrl ?? '',
    })
    setLocDialogOpen(true)
  }

  const saveLoc = async () => {
    if (!locForm.displayName) { toast.error('显示名必填'); return }
    setSaving(true)
    try {
      const payload = {
        mapId: locForm.mapId,
        name: editLoc?.name || makeLocationKey(locForm.displayName),
        displayName: locForm.displayName,
        description: locForm.description,
        posX: locForm.posX,
        posY: locForm.posY,
        locationType: locForm.locationType,
        requiredOutputLevel: editLoc?.requiredOutputLevel ?? 'L1',
        sortOrder: editLoc?.sortOrder ?? 0,
        backgroundUrl: locForm.backgroundUrl,
      }
      const saved = editLoc ? await updateLocation(editLoc.id, payload) : await createLocation(payload)
      toast.success(editLoc ? '地点已更新' : '地点已创建')
      setSelectedMapId(saved.mapId)
      setSelectedLocationId(saved.id)
      setLocDialogOpen(false)
      load()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const saveLocationPosition = async (loc: GameLocationData, posX: number, posY: number) => {
    const nextX = Number(posX.toFixed(2))
    const nextY = Number(posY.toFixed(2))
    const scroller = document.querySelector('main')
    const scrollTop = scroller?.scrollTop ?? window.scrollY
    setLocations((prev) => prev.map((item) => (
      item.id === loc.id ? { ...item, posX: nextX, posY: nextY } : item
    )))
    setSelectedLocationId(loc.id)
    requestAnimationFrame(() => {
      if (scroller) scroller.scrollTop = scrollTop
      else window.scrollTo({ top: scrollTop })
    })
    try {
      await updateLocation(loc.id, { posX: nextX, posY: nextY })
      toast.success(`${loc.displayName} 已移动到 (${nextX}, ${nextY})`)
      load()
      requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop = scrollTop
        else window.scrollTo({ top: scrollTop })
      })
    } catch {
      toast.error('坐标保存失败')
      load()
      requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop = scrollTop
        else window.scrollTo({ top: scrollTop })
      })
    }
  }

  const removeLoc = async (loc: GameLocationData) => {
    if (!confirm(`删除地点 "${loc.displayName}"？其下所有房间也将被删除。`)) return
    try {
      await deleteLocation(loc.id)
      toast.success('已删除')
      setSelectedLocationId((current) => (current === loc.id ? '' : current))
      load()
    } catch {
      toast.error('删除失败')
    }
  }

  const openCreateRoom = (locationId: string) => {
    setEditRoom(null)
    setRoomForm({
      locationId, name: '', displayName: '', description: '',
      roomType: 'vn_scene', isEntrance: false,
      disabled: false, hidden: false,
      icon: '', inkScriptId: '',
      requiredOutputLevel: 'L1', sortOrder: 0,
      backgroundUrl: '',
    })
    setRoomDialogOpen(true)
  }

  const openEditRoom = (rm: GameRoomData) => {
    setEditRoom(rm)
    setRoomForm({
      locationId: rm.locationId,
      name: rm.name,
      displayName: rm.displayName,
      description: rm.description ?? '',
      roomType: rm.roomType,
      isEntrance: rm.isEntrance,
      disabled: rm.disabled,
      hidden: rm.hidden,
      icon: rm.icon ?? '',
      inkScriptId: rm.inkScriptId ?? '',
      requiredOutputLevel: rm.requiredOutputLevel,
      sortOrder: rm.sortOrder ?? 0,
      backgroundUrl: rm.backgroundUrl ?? '',
    })
    setRoomDialogOpen(true)
  }

  const saveRoom = async () => {
    if (!roomForm.name || !roomForm.displayName) { toast.error('名称和显示名必填'); return }
    setSaving(true)
    try {
      const payload = {
        ...roomForm,
        inkScriptId: roomForm.inkScriptId.trim() || null,
      }
      await (editRoom ? updateRoom(editRoom.id, payload) : createRoom(payload))
      toast.success(editRoom ? '房间已更新' : '房间已创建')
      setRoomDialogOpen(false)
      load()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const removeRoom = async (rm: GameRoomData) => {
    if (!confirm(`删除房间 "${rm.displayName}"？`)) return
    try {
      await deleteRoom(rm.id)
      toast.success('已删除')
      load()
    } catch {
      toast.error('删除失败')
    }
  }

  const handleAddNpc = async () => {
    if (!addNpcRoomId || !addNpcCharId) { toast.error('请选择房间和角色'); return }
    setSaving(true)
    try {
      await addRoomNpc({ roomId: addNpcRoomId, characterId: addNpcCharId })
      toast.success('NPC 已添加')
      setAddNpcOpen(false)
      load()
    } catch {
      toast.error('添加失败')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveNpc = async (id: string) => {
    try {
      await removeRoomNpc(id)
      toast.success('已移除')
      load()
    } catch {
      toast.error('移除失败')
    }
  }

  const toggleCollapse = (locId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(locId)) next.delete(locId)
      else next.add(locId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    )
  }

  const roomCount = rooms.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            管理探索模式的地图、地点与房间。共 {maps.length} 个地图，{locations.length} 个地点，{roomCount} 个房间。
          </p>
          <p className="text-xs text-muted-foreground">
            Map 是世界容器，Location 是地图锚点，Room 是玩家实际进入与触发故事的导航单元。
          </p>
        </div>
        <Button size="sm" onClick={openCreateMap}>
          <Plus data-icon="inline-start" />
          新建地图
        </Button>
      </div>

      {maps.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16">
          <Map className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">暂无地图</p>
          <p className="text-xs text-muted-foreground/60">点击「新建地图」开始创建</p>
        </div>
      ) : (
        <div
          className="grid min-h-0 gap-3"
          style={{
            gridTemplateColumns: rightPanelCollapsed
              ? `${leftPanelWidth}px minmax(0,1fr) 44px`
              : `${leftPanelWidth}px minmax(0,1fr) ${rightPanelWidth}px`,
          }}
        >
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers3 className="size-4" />
                地图目录
              </CardTitle>
              <CardDescription>选择一个世界进行空间编排</CardDescription>
              <div className="flex items-center gap-2 pt-1">
                <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                <Input
                  type="range"
                  min={220}
                  max={420}
                  value={leftPanelWidth}
                  onChange={(event) => setLeftPanelWidth(Number(event.target.value))}
                  className="h-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[640px]">
                <div className="flex flex-col gap-2 p-3 pt-0">
                  {maps.map((map) => {
                    const mapLocs = locsForMap(map.id)
                    const mapRooms = mapLocs.flatMap((loc) => roomsForLoc(loc.id))
                    const isActive = selectedMap?.id === map.id
                    return (
                      <button
                        key={map.id}
                        type="button"
                        className={cn(
                          'rounded-lg border bg-card p-3 text-left transition hover:bg-muted/40',
                          isActive && 'border-primary bg-muted/50',
                        )}
                        onClick={() => {
                          setSelectedMapId(map.id)
                          setSelectedLocationId(mapLocs[0]?.id || '')
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{map.displayName}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground">{map.name}</p>
                          </div>
                          <Badge variant="outline">需 {map.requiredOutputLevel}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                          <span className="rounded-md bg-muted px-2 py-1">{mapLocs.length} 地点</span>
                          <span className="rounded-md bg-muted px-2 py-1">{mapRooms.length} 房间</span>
                          <span className="rounded-md bg-muted px-2 py-1">
                            {mapRooms.reduce((sum, rm) => sum + (rm.npcs?.length ?? 0), 0)} NPC
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg">{selectedMap?.displayName}</CardTitle>
                  <CardDescription className="font-mono">{selectedMap?.name}</CardDescription>
                </div>
                {selectedMap && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openCreateLoc(selectedMap.id)}>
                      <Plus data-icon="inline-start" />
                      添加地点
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openEditMap(selectedMap)}>
                      <Edit3 className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => removeMap(selectedMap)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
              <Tabs value={view} onValueChange={(value) => setView(value as MapView)}>
                <TabsList className="mt-3">
                  <TabsTrigger value="canvas">
                    <MapPin className="size-4" />
                    空间视图
                  </TabsTrigger>
                  <TabsTrigger value="structure">
                    <Route className="size-4" />
                    结构视图
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {view === 'canvas' && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={canvasMode === 'preview' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => setCanvasMode('preview')}
                    >
                      <MousePointer2 data-icon="inline-start" />
                      预览
                    </Button>
                    <Button
                      variant={canvasMode === 'edit' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => setCanvasMode('edit')}
                    >
                      <Move data-icon="inline-start" />
                      编辑
                    </Button>
                  </div>
                  <div className="flex min-w-48 items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">高度</span>
                    <Input
                      type="range"
                      min={420}
                      max={860}
                      value={canvasHeight}
                      onChange={(event) => setCanvasHeight(Number(event.target.value))}
                      className="h-8"
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {selectedMap && view === 'canvas' && (
                <div className="p-3">
                  <MapPixiCanvas
                    map={selectedMap}
                    locations={selectedLocations}
                    roomsForLoc={roomsForLoc}
                    selectedLocationId={selectedLocation?.id ?? ''}
                    mode={canvasMode}
                    height={canvasHeight}
                    layers={canvasLayers}
                    layerVisible={layerVisible}
                    layerLocked={layerLocked}
                    backgroundScale={backgroundScale}
                    backgroundRotation={backgroundRotation}
                    onSelectLocation={selectLocationFromCanvas}
                    onMoveLocation={saveLocationPosition}
                    onCreateLocation={() => openCreateLoc(selectedMap.id)}
                    onToggleLayerVisible={toggleLayerVisible}
                    onToggleLayerLocked={toggleLayerLocked}
                    onMoveLayer={moveLayer}
                    onAddLayer={addCanvasLayer}
                    onDeleteLayer={deleteCanvasLayer}
                    onBackgroundScaleChange={setBackgroundScale}
                    onBackgroundRotationChange={setBackgroundRotation}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={canvasMode === 'edit' ? 'default' : 'secondary'}>
                      {canvasMode === 'edit' ? '编辑模式' : '预览模式'}
                    </Badge>
                    <span>
                      {canvasMode === 'edit'
                        ? '左键按住地点拖拽，松开后保存坐标。'
                        : '点击地点会高亮并显示标题，不能拖拽。'}
                    </span>
                  </div>
                </div>
              )}

              {selectedMap && view === 'structure' && (
                <ScrollArea className="h-[520px]">
                  <div className="divide-y">
                    {selectedLocations.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">暂无地点，点击「添加地点」创建。</p>
                    ) : selectedLocations.map((loc) => {
                      const locRooms = roomsForLoc(loc.id)
                      const isCollapsed = collapsed.has(loc.id)
                      return (
                        <div key={loc.id}>
                          <div
                            className={cn(
                              'flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20',
                              selectedLocation?.id === loc.id && 'bg-muted/40',
                            )}
                            onClick={() => {
                              setSelectedLocationId(loc.id)
                              toggleCollapse(loc.id)
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {isCollapsed ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                              <MapPin className="size-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{loc.displayName}</p>
                                <p className="truncate font-mono text-xs text-muted-foreground">{loc.name}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Badge variant="secondary">{locationTypeLabel[loc.locationType] ?? loc.locationType}</Badge>
                              <Badge variant="outline">{locRooms.length} 房间</Badge>
                              <Button variant="outline" size="sm" onClick={() => openCreateRoom(loc.id)}>
                                <Plus data-icon="inline-start" />
                                房间
                              </Button>
                            </div>
                          </div>
                          {!isCollapsed && (
                            <div className="bg-muted/10">
                              {locRooms.length === 0 ? (
                                <p className="px-10 py-3 text-xs text-muted-foreground">暂无房间。</p>
                              ) : (
                                <div className="divide-y divide-border/50">
                                  {locRooms.map((rm) => (
                                    <RoomRow
                                      key={rm.id}
                                      room={rm}
                                      onEdit={() => openEditRoom(rm)}
                                      onDelete={() => removeRoom(rm)}
                                      onAddNpc={() => {
                                        setAddNpcRoomId(rm.id)
                                        setAddNpcCharId('')
                                        setAddNpcOpen(true)
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {rightPanelCollapsed ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                title="展开检查面板"
                onClick={() => setRightPanelCollapsed(false)}
              >
                <Maximize2 className="size-4" />
              </Button>
              <div className="text-xs text-muted-foreground [writing-mode:vertical-rl]">
                检查
              </div>
            </div>
          ) : (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <SlidersHorizontal className="size-4" />
                    面板尺寸
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="折叠检查面板"
                    onClick={() => setRightPanelCollapsed(true)}
                  >
                    <Minimize2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Input
                  type="range"
                  min={280}
                  max={520}
                  value={rightPanelWidth}
                  onChange={(event) => setRightPanelWidth(Number(event.target.value))}
                  className="h-8"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="size-4" />
                  可玩性检查
                </CardTitle>
                <CardDescription>
                  {readinessTotal === 0 ? '暂无检查项' : `${readinessOk}/${readinessTotal} 项通过`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {readinessIssues.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    当前地图结构完整，可以进入预览联调。
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {readinessIssues.slice(0, 6).map((item) => (
                      <div key={item.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                        <AlertTriangle className="size-4 text-muted-foreground" />
                        <span>{item.label}</span>
                      </div>
                    ))}
                    {readinessIssues.length > 6 && (
                      <p className="text-xs text-muted-foreground">另有 {readinessIssues.length - 6} 项待完善。</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="size-4" />
                  {selectedLocation ? selectedLocation.displayName : '地点详情'}
                </CardTitle>
                <CardDescription>
                  {selectedLocation ? `${selectedLocation.name} · (${selectedLocation.posX}, ${selectedLocation.posY})` : '选择一个地点查看房间'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {selectedLocation ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{locationTypeLabel[selectedLocation.locationType] ?? selectedLocation.locationType}</Badge>
                      <Badge variant="outline">需 {selectedLocation.requiredOutputLevel}</Badge>
                      {selectedLocation.hidden && <Badge variant="outline"><EyeOff className="mr-1 size-3" />隐藏</Badge>}
                      {selectedLocation.disabled && <Badge variant="outline"><Lock className="mr-1 size-3" />禁用</Badge>}
                    </div>
                    {selectedLocation.description && (
                      <p className="text-sm text-muted-foreground">{selectedLocation.description}</p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditLoc(selectedLocation)}>
                        <Edit3 data-icon="inline-start" />
                        编辑地点
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openCreateRoom(selectedLocation.id)}>
                        <Plus data-icon="inline-start" />
                        添加房间
                      </Button>
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      {selectedLocationRooms.length === 0 ? (
                        <p className="text-sm text-muted-foreground">这个地点还没有房间。</p>
                      ) : selectedLocationRooms.map((room) => (
                        <div key={room.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{room.displayName}</p>
                              <p className="truncate font-mono text-xs text-muted-foreground">{room.name}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditRoom(room)}>
                              <Edit3 className="size-3.5" />
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="secondary">{roomTypeLabel[room.roomType] ?? room.roomType}</Badge>
                            {room.isEntrance && <Badge>入口</Badge>}
                            {hasAsset(room.inkScriptId) ? <Badge variant="outline"><ScrollText className="mr-1 size-3" />脚本</Badge> : <Badge variant="outline">未绑脚本</Badge>}
                            <Badge variant="outline"><Users className="mr-1 size-3" />{room.npcs?.length ?? 0}</Badge>
                          </div>
                          {(room.npcs?.length ?? 0) > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {room.npcs?.map((npc) => (
                                <button
                                  key={npc.id}
                                  type="button"
                                  className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                                  title="点击移除 NPC"
                                  onClick={() => handleRemoveNpc(npc.id)}
                                >
                                  {npc.character.displayName}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">还没有可查看的地点。</p>
                )}
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      )}

      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMap ? '编辑地图' : '新建地图'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Key</Label>
                <Input value={mapForm.name} onChange={(e) => setMapForm((p) => ({ ...p, name: e.target.value }))} placeholder="campus" />
              </div>
              <div>
                <Label>显示名</Label>
                <Input value={mapForm.displayName} onChange={(e) => setMapForm((p) => ({ ...p, displayName: e.target.value }))} placeholder="大学校园" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>最低输出等级</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={mapForm.requiredOutputLevel}
                  onChange={(e) => setMapForm((p) => ({ ...p, requiredOutputLevel: e.target.value }))}
                >
                  {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>排序</Label>
                <Input type="number" value={mapForm.sortOrder} onChange={(e) => setMapForm((p) => ({ ...p, sortOrder: +e.target.value }))} />
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs font-semibold">空间视图底图</Label>
              <ImageUploadField
                value={mapForm.backgroundUrl}
                onChange={(url) => setMapForm((p) => ({ ...p, backgroundUrl: url }))}
                placeholder="输入背景图 URL 或上传"
                previewSize="lg"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">缩略图</Label>
              <ImageUploadField
                value={mapForm.thumbnailUrl}
                onChange={(url) => setMapForm((p) => ({ ...p, thumbnailUrl: url }))}
                placeholder="输入缩略图 URL 或上传"
                previewSize="sm"
              />
            </div>
            <Button className="w-full" onClick={saveMap} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={locDialogOpen} onOpenChange={setLocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editLoc ? '编辑地点' : '新建地点'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>显示名</Label>
              <Input value={locForm.displayName} onChange={(e) => setLocForm((p) => ({ ...p, displayName: e.target.value }))} placeholder="宿舍楼" />
              <p className="mt-1 text-xs text-muted-foreground">
                Key 会自动生成{editLoc ? `：${editLoc.name}` : ''}。
              </p>
            </div>
            <div>
              <Label>描述</Label>
              <Input value={locForm.description} onChange={(e) => setLocForm((p) => ({ ...p, description: e.target.value }))} placeholder="地点描述..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>X 坐标</Label>
                <Input type="number" value={locForm.posX} readOnly disabled />
              </div>
              <div>
                <Label>Y 坐标</Label>
                <Input type="number" value={locForm.posY} readOnly disabled />
              </div>
            </div>
            <div>
              <Label>类型</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={locForm.locationType}
                onChange={(e) => setLocForm((p) => ({ ...p, locationType: e.target.value }))}
              >
                <option value="building">建筑</option>
                <option value="outdoor">户外</option>
                <option value="district">街区</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">坐标由空间视图拖拽生成；输出等级和排序使用系统默认值。</p>
            <Separator />
            <div>
              <Label className="text-xs font-semibold">地点背景</Label>
              <ImageUploadField
                value={locForm.backgroundUrl}
                onChange={(url) => setLocForm((p) => ({ ...p, backgroundUrl: url }))}
                placeholder="输入地点背景图 URL 或上传"
                previewSize="lg"
              />
            </div>
            <Button className="w-full" onClick={saveLoc} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRoom ? '编辑房间' : '新建房间'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Key</Label>
                <Input value={roomForm.name} onChange={(e) => setRoomForm((p) => ({ ...p, name: e.target.value }))} placeholder="dorm_101" />
              </div>
              <div>
                <Label>显示名</Label>
                <Input value={roomForm.displayName} onChange={(e) => setRoomForm((p) => ({ ...p, displayName: e.target.value }))} placeholder="101 宿舍" />
              </div>
            </div>
            <div>
              <Label>描述</Label>
              <Input value={roomForm.description} onChange={(e) => setRoomForm((p) => ({ ...p, description: e.target.value }))} placeholder="房间描述..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>类型</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={roomForm.roomType}
                  onChange={(e) => setRoomForm((p) => ({ ...p, roomType: e.target.value }))}
                >
                  <option value="vn_scene">VN 场景</option>
                  <option value="hub">交通枢纽</option>
                  <option value="shop">商店</option>
                  <option value="quest">任务点</option>
                </select>
              </div>
              <div>
                <Label>图标 URL</Label>
                <Input value={roomForm.icon} onChange={(e) => setRoomForm((p) => ({ ...p, icon: e.target.value }))} placeholder="图标 URL（可选）" />
              </div>
            </div>
            <div>
              <Label>Ink 脚本 ID</Label>
              <Input value={roomForm.inkScriptId} onChange={(e) => setRoomForm((p) => ({ ...p, inkScriptId: e.target.value }))} placeholder="可选：绑定故事脚本 ID" />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roomForm.isEntrance}
                  onChange={(e) => setRoomForm((p) => ({ ...p, isEntrance: e.target.checked }))}
                  className="rounded border-border"
                />
                设为入口
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roomForm.disabled}
                  onChange={(e) => setRoomForm((p) => ({ ...p, disabled: e.target.checked }))}
                  className="rounded border-border"
                />
                禁用
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roomForm.hidden}
                  onChange={(e) => setRoomForm((p) => ({ ...p, hidden: e.target.checked }))}
                  className="rounded border-border"
                />
                隐藏
              </label>
            </div>
            <div>
              <Label>输出等级</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={roomForm.requiredOutputLevel}
                onChange={(e) => setRoomForm((p) => ({ ...p, requiredOutputLevel: e.target.value }))}
              >
                {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <Separator />
            <div>
              <Label className="text-xs font-semibold">房间背景</Label>
              <ImageUploadField
                value={roomForm.backgroundUrl}
                onChange={(url) => setRoomForm((p) => ({ ...p, backgroundUrl: url }))}
                placeholder="输入房间背景图 URL 或上传（Ink DSL 中 #bg 标签优先使用此图）"
                previewSize="lg"
              />
            </div>
            <Button className="w-full" onClick={saveRoom} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addNpcOpen} onOpenChange={setAddNpcOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加 NPC 到房间</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>选择角色</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={addNpcCharId}
                onChange={(e) => setAddNpcCharId(e.target.value)}
              >
                <option value="">-- 选择角色 --</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName} ({c.role})</option>
                ))}
              </select>
            </div>
            <Button className="w-full" onClick={handleAddNpc} disabled={saving || !addNpcCharId}>
              添加
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MapPixiCanvas({
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
  onBackgroundScaleChange,
  onBackgroundRotationChange,
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
  onBackgroundScaleChange: (value: number) => void
  onBackgroundRotationChange: (value: number) => void
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
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" style={{ height }}>
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
            <div key={layer.id} className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5">
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
        {layers.some((layer) => layer.kind === 'background') && <Separator />}
        {layers.some((layer) => layer.kind === 'background') && (
        <div className={cn('flex flex-col gap-2', layerLocked.background && 'opacity-50')}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">底图缩放</span>
            <span className="font-mono text-[10px] text-muted-foreground">{Math.round(backgroundScale * 100)}%</span>
          </div>
          <Input
            type="range"
            min={50}
            max={180}
            value={Math.round(backgroundScale * 100)}
            disabled={layerLocked.background}
            onChange={(event) => onBackgroundScaleChange(Number(event.target.value) / 100)}
            className="h-7"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">底图旋转</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              disabled={layerLocked.background}
              onClick={() => onBackgroundRotationChange(0)}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
          <Input
            type="range"
            min={-180}
            max={180}
            value={backgroundRotation}
            disabled={layerLocked.background}
            onChange={(event) => onBackgroundRotationChange(Number(event.target.value))}
            className="h-7"
          />
        </div>
        )}
      </div>
      <div
        ref={hostRef}
        className={cn(
          'relative overflow-hidden rounded-lg border border-border bg-muted [overflow-anchor:none]',
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
            <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-lg border border-border bg-background/95 px-5 py-4 shadow-sm">
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
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({})
  const draggingLocation = useMemo(
    () => locations.find((loc) => loc.id === draggingId) ?? null,
    [draggingId, locations],
  )

  useEffect(() => {
    if (!isInitialised || !app.stage) return
    app.stage.eventMode = 'static'
  }, [app, isInitialised])

  useEffect(() => {
    setDraftPositions({})
    setDraggingId('')
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
    if (!draggingId || mode !== 'edit' || layerLocked.locations) return
    const x = clampPercent((event.global.x / width) * 100)
    const y = clampPercent((event.global.y / height) * 100)
    setDraftPositions((prev) => ({ ...prev, [draggingId]: { x, y } }))
  }

  const finishDrag = (event: FederatedPointerEvent) => {
    if (!draggingId || !draggingLocation || mode !== 'edit' || layerLocked.locations) return
    const x = clampPercent((event.global.x / width) * 100)
    const y = clampPercent((event.global.y / height) * 100)
    setDraggingId('')
    setDraftPositions((prev) => {
      const next = { ...prev }
      delete next[draggingId]
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

function RoomRow({
  room,
  onEdit,
  onDelete,
  onAddNpc,
}: {
  room: GameRoomData
  onEdit: () => void
  onDelete: () => void
  onAddNpc: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-10 py-2.5 hover:bg-muted/20">
      <div className="flex min-w-0 items-center gap-3">
        <Home className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm">{room.displayName}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{room.name}</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">{roomTypeLabel[room.roomType] ?? room.roomType}</Badge>
        {room.isEntrance && <Badge className="text-[10px]">入口</Badge>}
        {hasAsset(room.inkScriptId) ? (
          <Badge variant="outline" className="text-[10px]">脚本</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">未绑脚本</Badge>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" />
          {room.npcs?.length ?? 0}
        </span>
        {room.disabled && <Badge variant="outline" className="text-[10px]">禁用</Badge>}
        {room.hidden && <Badge variant="outline" className="text-[10px]">隐藏</Badge>}
        <Button variant="ghost" size="icon" className="size-6" title="添加 NPC" onClick={onAddNpc}>
          <Users className="size-3" />
        </Button>
        <Button variant="ghost" size="icon" className="size-6" onClick={onEdit}>
          <Edit3 className="size-3" />
        </Button>
        <Button variant="ghost" size="icon" className="size-6" onClick={onDelete}>
          <Trash2 className="size-3 text-destructive" />
        </Button>
      </div>
    </div>
  )
}
