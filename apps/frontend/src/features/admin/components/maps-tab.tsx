import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ChevronDown, ChevronRight,
  Edit3, Home, Map, MapPin,
  MousePointer2, Move, Plus, Route,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Trash2, Users,
} from 'lucide-react'
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
import { LocationDetailsPanel } from './maps/location-details-panel'
import { MapDirectory } from './maps/map-directory'
import { MapPixiCanvas } from './maps/map-pixi-canvas'
import { ReadinessPanel } from './maps/readiness-panel'
import { matchTemplate } from './maps/match-template'
import {
  createObjectFromPrefab,
  hasAsset,
  locationTypeLabel,
  makeLocationKey,
  normalizeMapDocument,
  roomTypeLabel,
  type CanvasMode,
  type MapDocument,
  type MapLayer,
  type MapObject,
  type MapPrefab,
  type MapView,
  type ReadinessItem,
  uid,
} from './maps/map-management-shared'

interface MapsTabProps {
  onLocationsChange?: (locations: GameLocationData[]) => void
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
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('edit')
  const [selectedCanvasLayerId, setSelectedCanvasLayerId] = useState('background')
  const [selectedMapObjectId, setSelectedMapObjectId] = useState('')
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const backgroundScale = 1
  const backgroundRotation = 0
  const canvasHeight = 620
  const [readinessOpen, setReadinessOpen] = useState(false)
  const positionSaveVersion = useRef<Record<string, number>>({})

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
  const [autoAligning, setAutoAligning] = useState(false)

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

  const selectedMapDocument = useMemo(
    () => normalizeMapDocument(selectedMap?.editorData, {
      width: selectedMap?.width,
      height: selectedMap?.height,
    }),
    [selectedMap?.editorData, selectedMap?.height, selectedMap?.width],
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

  const saveMapDocument = useCallback(async (
    updater: (document: MapDocument) => MapDocument,
    errorMessage = '地图编辑数据保存失败',
  ) => {
    if (!selectedMap) return
    const previousData = selectedMap.editorData
    const current = normalizeMapDocument(previousData, { width: selectedMap.width, height: selectedMap.height })
    const next = updater(current)
    setMaps((prev) => prev.map((item) => (
      item.id === selectedMap.id ? { ...item, editorData: next, width: next.width, height: next.height } : item
    )))
    try {
      await updateMap(selectedMap.id, { editorData: next, width: next.width, height: next.height })
    } catch {
      setMaps((prev) => prev.map((item) => (
        item.id === selectedMap.id ? { ...item, editorData: previousData } : item
      )))
      toast.error(errorMessage)
    }
  }, [selectedMap])

  const updateMapLayer = useCallback((layerId: string, patch: Partial<MapLayer>) => {
    saveMapDocument((document) => ({
      ...document,
      layers: document.layers.map((layer) => (
        layer.id === layerId ? { ...layer, ...patch } : layer
      )),
    }))
  }, [saveMapDocument])

  const toggleLayerVisible = useCallback((layerId: string) => {
    const layer = selectedMapDocument.layers.find((item) => item.id === layerId)
    updateMapLayer(layerId, { visible: !(layer?.visible ?? true) })
  }, [selectedMapDocument.layers, updateMapLayer])

  const toggleLayerLocked = useCallback((layerId: string) => {
    const layer = selectedMapDocument.layers.find((item) => item.id === layerId)
    updateMapLayer(layerId, { locked: !(layer?.locked ?? false) })
  }, [selectedMapDocument.layers, updateMapLayer])

  const moveLayer = useCallback((layerId: string, direction: -1 | 1) => {
    saveMapDocument((document) => {
      const layers = [...document.layers].sort((a, b) => a.order - b.order)
      const index = layers.findIndex((layer) => layer.id === layerId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return document
      const [item] = layers.splice(index, 1)
      layers.splice(nextIndex, 0, item)
      return {
        ...document,
        layers: layers.map((layer, order) => ({ ...layer, order: order * 10 })),
      }
    })
  }, [saveMapDocument])

  const addCanvasLayer = useCallback(() => {
    const id = uid('layer')
    saveMapDocument((document) => ({
      ...document,
      layers: [
        ...document.layers,
        {
          id,
          kind: 'custom',
          name: `新图层 ${document.layers.filter((layer) => layer.kind === 'custom').length + 1}`,
          visible: true,
          locked: false,
          opacity: 1,
          order: document.layers.length * 10,
        },
      ],
    }))
    setSelectedCanvasLayerId(id)
  }, [saveMapDocument])

  const deleteCanvasLayer = useCallback((layerId: string) => {
    let deleted = false
    saveMapDocument((document) => {
      const layer = document.layers.find((item) => item.id === layerId)
      if (!layer) return document
      if (layer.kind === 'background' || layer.kind === 'locations') {
        toast.error('系统图层不能删除')
        return document
      }
      if (document.objects.some((object) => object.layerId === layerId)) {
        toast.error('图层里还有对象，先移动或删除对象')
        return document
      }
      deleted = true
      return {
        ...document,
        layers: document.layers.filter((item) => item.id !== layerId),
      }
    })
    if (deleted) setSelectedCanvasLayerId((current) => (current === layerId ? 'background' : current))
  }, [saveMapDocument])

  const updateCanvasLayerBackground = useCallback((layerId: string, backgroundUrl: string) => {
    updateMapLayer(layerId, { backgroundUrl })
  }, [updateMapLayer])

  const addMapObjectFromPrefab = useCallback((prefab: MapPrefab) => {
    const object = createObjectFromPrefab(prefab, selectedMapDocument, selectedLocation ? {
      locationId: selectedLocation.id,
      x: (selectedLocation.posX / 100) * selectedMapDocument.width,
      y: (selectedLocation.posY / 100) * selectedMapDocument.height,
    } : undefined)
    saveMapDocument((document) => ({
      ...document,
      objects: [...document.objects, object],
    }))
    if (selectedLocation) setSelectedLocationId(selectedLocation.id)
    setSelectedMapObjectId(object.id)
    setSelectedCanvasLayerId(object.layerId)
  }, [saveMapDocument, selectedLocation, selectedMapDocument])

  const updateMapObject = useCallback((objectId: string, patch: Partial<MapObject>) => {
    saveMapDocument((document) => ({
      ...document,
      objects: document.objects.map((object) => (
        object.id === objectId ? { ...object, ...patch } : object
      )),
    }))
  }, [saveMapDocument])

  const deleteMapObject = useCallback((objectId: string) => {
    saveMapDocument((document) => ({
      ...document,
      objects: document.objects.filter((object) => object.id !== objectId),
    }))
    setSelectedMapObjectId((current) => (current === objectId ? '' : current))
  }, [saveMapDocument])

  const updateMapBackgroundFromLayer = useCallback(async (backgroundUrl: string) => {
    if (!selectedMap) return
    const previousUrl = selectedMap.backgroundUrl ?? ''
    setMaps((prev) => prev.map((item) => (
      item.id === selectedMap.id ? { ...item, backgroundUrl } : item
    )))
    try {
      await updateMap(selectedMap.id, { backgroundUrl })
    } catch {
      setMaps((prev) => prev.map((item) => (
        item.id === selectedMap.id ? { ...item, backgroundUrl: previousUrl } : item
      )))
      toast.error('底图背景保存失败')
    }
  }, [selectedMap])

  const handleResizeLocationIcon = useCallback(async (locId: string, width: number, height: number) => {
    setLocations((prev) => prev.map((l) => (
      l.id === locId ? { ...l, iconWidth: width, iconHeight: height } : l
    )))
    try {
      await updateLocation(locId, { iconWidth: width, iconHeight: height })
    } catch {
      toast.error('地点图标尺寸保存失败')
      load()
    }
  }, [load])

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
    const previousX = loc.posX
    const previousY = loc.posY
    if (previousX === nextX && previousY === nextY) return
    const version = (positionSaveVersion.current[loc.id] ?? 0) + 1
    positionSaveVersion.current[loc.id] = version
    const scroller = document.querySelector('main')
    const scrollTop = scroller?.scrollTop ?? window.scrollY
    setLocations((prev) => (
      prev.map((item) => (
        item.id === loc.id ? { ...item, posX: nextX, posY: nextY } : item
      ))
    ))
    setSelectedLocationId(loc.id)
    requestAnimationFrame(() => {
      if (scroller) scroller.scrollTop = scrollTop
      else window.scrollTo({ top: scrollTop })
    })
    try {
      await updateLocation(loc.id, { posX: nextX, posY: nextY })
    } catch {
      if (positionSaveVersion.current[loc.id] === version) {
        setLocations((prev) => (
          prev.map((item) => (
            item.id === loc.id ? { ...item, posX: previousX, posY: previousY } : item
          ))
        ))
      }
      toast.error('坐标保存失败')
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
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <Map className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">暂无地图</p>
          <p className="text-xs text-muted-foreground/60">点击「新建地图」开始创建</p>
        </div>
      ) : (
        <div
          className={cn(
            'grid min-h-0 gap-3',
            leftSidebarOpen && rightSidebarOpen && 'xl:grid-cols-[300px_minmax(0,1fr)_320px]',
            leftSidebarOpen && !rightSidebarOpen && 'xl:grid-cols-[300px_minmax(0,1fr)_44px]',
            !leftSidebarOpen && rightSidebarOpen && 'xl:grid-cols-[44px_minmax(0,1fr)_320px]',
            !leftSidebarOpen && !rightSidebarOpen && 'xl:grid-cols-[44px_minmax(0,1fr)_44px]',
          )}
        >
          {leftSidebarOpen ? (
            <aside className="min-w-0">
              <div className="mb-2 flex justify-end">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  title="收起地图目录"
                  onClick={() => setLeftSidebarOpen(false)}
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </div>
              <MapDirectory
                maps={maps}
                selectedMap={selectedMap}
                selectedLocationId={selectedLocation?.id ?? ''}
                locsForMap={locsForMap}
                roomsForLoc={roomsForLoc}
                onSelectMap={(mapId, firstLocationId) => {
                  setSelectedMapId(mapId)
                  setSelectedLocationId(firstLocationId)
                }}
                onSelectLocation={setSelectedLocationId}
                onEditLocation={openEditLoc}
                onDeleteLocation={removeLoc}
              />
            </aside>
          ) : (
            <SidebarDock
              side="left"
              label="地图目录"
              title="展开地图目录"
              onClick={() => setLeftSidebarOpen(true)}
            />
          )}

          <Card className="overflow-hidden shadow-none">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="truncate text-lg">{selectedMap?.displayName}</CardTitle>
                    <Badge variant="outline" className="h-6 px-2 text-[11px]">
                      {selectedLocations.length} 地点 / {selectedMapRooms.length} 房间
                    </Badge>
                  </div>
                  <CardDescription className="font-mono">{selectedMap?.name}</CardDescription>
                </div>
                {selectedMap && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center">
                      <Button
                        variant={view === 'canvas' ? 'default' : 'ghost'}
                        size="icon"
                        className="size-8"
                        title="空间视图"
                        onClick={() => setView('canvas')}
                      >
                        <MapPin className="size-4" />
                      </Button>
                      <Button
                        variant={view === 'structure' ? 'default' : 'ghost'}
                        size="icon"
                        className="size-8"
                        title="结构视图"
                        onClick={() => setView('structure')}
                      >
                        <Route className="size-4" />
                      </Button>
                    </div>
                    {view === 'canvas' && (
                      <div className="flex items-center">
                        <Button
                          variant={canvasMode === 'preview' ? 'default' : 'ghost'}
                          size="icon"
                          className="size-8"
                          title="预览模式"
                          onClick={() => setCanvasMode('preview')}
                        >
                          <MousePointer2 className="size-4" />
                        </Button>
                        <Button
                          variant={canvasMode === 'edit' ? 'default' : 'ghost'}
                          size="icon"
                          className="size-8"
                          title="编辑模式"
                          onClick={() => setCanvasMode('edit')}
                        >
                          <Move className="size-4" />
                        </Button>
                      </div>
                    )}
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
                    document={selectedMapDocument}
                    selectedLayerId={selectedCanvasLayerId}
                    selectedObjectId={selectedMapObjectId}
                    backgroundScale={backgroundScale}
                    backgroundRotation={backgroundRotation}
                    onSelectLocation={selectLocationFromCanvas}
                    onMoveLocation={saveLocationPosition}
                    onCreateLocation={() => openCreateLoc(selectedMap.id)}
                    onSelectObject={setSelectedMapObjectId}
                    onToggleLayerVisible={toggleLayerVisible}
                    onToggleLayerLocked={toggleLayerLocked}
                    onSelectLayer={setSelectedCanvasLayerId}
                    onMoveLayer={moveLayer}
                    onAddLayer={addCanvasLayer}
                    onDeleteLayer={deleteCanvasLayer}
                    onUpdateLayerBackground={updateCanvasLayerBackground}
                    onUpdateLayer={updateMapLayer}
                    onUpdateMapBackground={updateMapBackgroundFromLayer}
                    onAddObjectFromPrefab={addMapObjectFromPrefab}
                    onUpdateObject={updateMapObject}
                    onDeleteObject={deleteMapObject}
                    onResizeLocationIcon={handleResizeLocationIcon}
                  />
                  {canvasMode === 'edit' && (
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={autoAligning}
                        onClick={async () => {
                          setAutoAligning(true)
                          try {
                            const result = await matchTemplate(selectedMap.backgroundUrl!, selectedLocation.icon!)
                            if (result) {
                              setLocations((prev) => prev.map((l) =>
                                l.id === selectedLocation.id ? { ...l, posX: result.x, posY: result.y } : l
                              ))
                              saveLocationPosition({ ...selectedLocation, posX: result.x, posY: result.y }, result.x, result.y)
                              toast.success(`已定位，置信度 ${Math.round(result.confidence * 100)}%`)
                            } else {
                              toast.error('匹配失败，请手动拖拽')
                            }
                          } finally {
                            setAutoAligning(false)
                          }
                        }}
                      >
                        {autoAligning ? '匹配中...' : '自动定位'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {selectedMap && view === 'structure' && (
                <ScrollArea className="h-[520px]">
                  <div>
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
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditLoc(loc)}>
                                <Edit3 className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => removeLoc(loc)}>
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
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
                                <div>
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

          {rightSidebarOpen ? (
            <aside className="min-w-0">
              <div className="mb-2 flex justify-start">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  title="收起地点详情"
                  onClick={() => setRightSidebarOpen(false)}
                >
                  <PanelRightClose className="size-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-4">
                <ReadinessPanel
                  open={readinessOpen}
                  onOpenChange={setReadinessOpen}
                  okCount={readinessOk}
                  totalCount={readinessTotal}
                  issues={readinessIssues}
                />
                <LocationDetailsPanel
                  selectedLocation={selectedLocation}
                  selectedLocationRooms={selectedLocationRooms}
                  onEditLocation={openEditLoc}
                  onCreateRoom={openCreateRoom}
                  onEditRoom={openEditRoom}
                  onRemoveNpc={handleRemoveNpc}
                />
              </div>
            </aside>
          ) : (
            <SidebarDock
              side="right"
              label="地点详情"
              title="展开地点详情"
              onClick={() => setRightSidebarOpen(true)}
            />
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
                  className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm"
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
                className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm"
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
                  className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm"
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
                className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm"
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
                className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm"
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

function SidebarDock({
  side,
  label,
  title,
  onClick,
}: {
  side: 'left' | 'right'
  label: string
  title: string
  onClick: () => void
}) {
  const Icon = side === 'left' ? PanelLeftOpen : PanelRightOpen
  return (
    <button
      type="button"
      title={title}
      className="flex h-full min-h-[760px] w-full flex-col items-center gap-3 rounded-xl bg-card px-2 py-3 text-muted-foreground transition hover:bg-primary/5 hover:text-foreground"
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0" />
      <span className="[writing-mode:vertical-rl] text-xs font-medium tracking-normal">{label}</span>
    </button>
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
