import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Map, MapPin, Users, DoorOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  listMaps, createMap, updateMap, deleteMap,
  listLocations, createLocation, updateLocation, deleteLocation,
  listCharacters,
  type GameMapData, type GameLocationData, type GameCharacter,
} from '../api-content-admin'

export function AdminMapsPage() {
  const [maps, setMaps] = useState<GameMapData[]>([])
  const [locations, setLocations] = useState<GameLocationData[]>([])
  const [characters, setCharacters] = useState<GameCharacter[]>([])
  const [loading, setLoading] = useState(true)

  // Map dialog
  const [mapDialogOpen, setMapDialogOpen] = useState(false)
  const [editMap, setEditMap] = useState<GameMapData | null>(null)
  const [mapForm, setMapForm] = useState({ name: '', displayName: '', requiredOutputLevel: 'L1', isPreview: false, sortOrder: 0 })

  // Location dialog
  const [locDialogOpen, setLocDialogOpen] = useState(false)
  const [editLoc, setEditLoc] = useState<GameLocationData | null>(null)
  const [locForm, setLocForm] = useState({
    mapId: '', name: '', displayName: '', description: '', posX: 50, posY: 50,
    locationType: 'vn_scene', requiredOutputLevel: 'L1', isPreview: false, sortOrder: 0,
  })

  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [mps, locs, chars] = await Promise.all([
        listMaps(), listLocations().catch(() => [] as GameLocationData[]), listCharacters().catch(() => [] as GameCharacter[]),
      ])
      setMaps(mps)
      setLocations(locs)
      setCharacters(chars)
    } catch { toast.error('加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const locsForMap = (mapId: string) => locations.filter((l) => l.mapId === mapId)

  // Map CRUD
  const openCreateMap = () => {
    setEditMap(null); setMapForm({ name: '', displayName: '', requiredOutputLevel: 'L1', isPreview: false, sortOrder: 0 })
    setMapDialogOpen(true)
  }
  const openEditMap = (m: GameMapData) => {
    setEditMap(m)
    setMapForm({ name: m.name, displayName: m.displayName, requiredOutputLevel: m.requiredOutputLevel, isPreview: m.isPreview ?? false, sortOrder: m.sortOrder ?? 0 })
    setMapDialogOpen(true)
  }
  const saveMap = async () => {
    if (!mapForm.name || !mapForm.displayName) { toast.error('名称和显示名必填'); return }
    setSaving(true)
    try {
      if (editMap) { await updateMap(editMap.id, mapForm); toast.success('已更新') }
      else { await createMap(mapForm); toast.success('已创建') }
      setMapDialogOpen(false); load()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }
  const removeMap = async (m: GameMapData) => {
    if (!confirm(`删除地图 "${m.displayName}"？其下所有地点也将被删除。`)) return
    try { await deleteMap(m.id); toast.success('已删除'); load() } catch { toast.error('删除失败') }
  }

  // Location CRUD
  const openCreateLoc = (mapId: string) => {
    setEditLoc(null)
    setLocForm({ mapId, name: '', displayName: '', description: '', posX: 50, posY: 50, locationType: 'vn_scene', requiredOutputLevel: 'L1', isPreview: false, sortOrder: 0 })
    setLocDialogOpen(true)
  }
  const openEditLoc = (loc: GameLocationData) => {
    setEditLoc(loc)
    setLocForm({
      mapId: loc.mapId, name: loc.name, displayName: loc.displayName,
      description: loc.description ?? '', posX: loc.posX, posY: loc.posY,
      locationType: loc.locationType, requiredOutputLevel: loc.requiredOutputLevel,
      isPreview: loc.isPreview ?? false, sortOrder: loc.sortOrder ?? 0,
    })
    setLocDialogOpen(true)
  }
  const saveLoc = async () => {
    if (!locForm.name || !locForm.displayName) { toast.error('名称和显示名必填'); return }
    setSaving(true)
    try {
      if (editLoc) { await updateLocation(editLoc.id, locForm); toast.success('已更新') }
      else { await createLocation(locForm); toast.success('已创建') }
      setLocDialogOpen(false); load()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }
  const removeLoc = async (loc: GameLocationData) => {
    if (!confirm(`删除地点 "${loc.displayName}"？`)) return
    try { await deleteLocation(loc.id); toast.success('已删除'); load() } catch { toast.error('删除失败') }
  }

  if (loading) return <div className="p-6 text-muted-foreground">加载中...</div>

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">地图管理</h1>
          <p className="text-sm text-muted-foreground">管理探索模式的地图、地点和 NPC 关联</p>
        </div>
        <Button size="sm" onClick={openCreateMap}><Plus className="mr-1 size-4" />新建地图</Button>
      </div>

      {maps.map((map) => (
        <Card key={map.id} className="overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Map className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-base">{map.displayName}</CardTitle>
                  <CardDescription className="font-mono text-xs">{map.name}</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">需 {map.requiredOutputLevel}</Badge>
                {map.isPreview && <Badge className="text-xs bg-amber-500/10 text-amber-600">预览</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => openCreateLoc(map.id)}>
                  <Plus className="mr-1 size-3" />添加地点
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEditMap(map)}><Edit3 className="size-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => removeMap(map)}><Trash2 className="size-3.5 text-destructive" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {locsForMap(map.id).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">暂无地点，点击「添加地点」创建</p>
            ) : (
              <div className="divide-y">
                {locsForMap(map.id).map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <MapPin className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{loc.displayName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{loc.name}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">({loc.posX}, {loc.posY})</Badge>
                      <Badge variant="secondary" className="text-xs">{loc.locationType}</Badge>
                      {loc.isPreview && <Badge className="text-xs bg-amber-500/10 text-amber-600">预览</Badge>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        {loc.npcs?.length ?? 0}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <DoorOpen className="size-3" />
                        {loc.exits?.length ?? 0}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => openEditLoc(loc)}><Edit3 className="size-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => removeLoc(loc)}><Trash2 className="size-3 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Map Dialog */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editMap ? '编辑地图' : '新建地图'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Key</Label><Input value={mapForm.name} onChange={e => setMapForm(p => ({ ...p, name: e.target.value }))} placeholder="campus" /></div>
              <div><Label>显示名</Label><Input value={mapForm.displayName} onChange={e => setMapForm(p => ({ ...p, displayName: e.target.value }))} placeholder="大学校园" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>最低输出等级</Label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={mapForm.requiredOutputLevel} onChange={e => setMapForm(p => ({ ...p, requiredOutputLevel: e.target.value }))}>
                  <option value="L1">L1</option><option value="L2">L2</option><option value="L3">L3</option><option value="L4">L4</option><option value="L5">L5</option>
                </select>
              </div>
              <div><Label>排序</Label><Input type="number" value={mapForm.sortOrder} onChange={e => setMapForm(p => ({ ...p, sortOrder: +e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={mapForm.isPreview} onChange={e => setMapForm(p => ({ ...p, isPreview: e.target.checked }))} />
              预览地图
            </label>
            <Button className="w-full" onClick={saveMap} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={locDialogOpen} onOpenChange={setLocDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editLoc ? '编辑地点' : '新建地点'}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Key</Label><Input value={locForm.name} onChange={e => setLocForm(p => ({ ...p, name: e.target.value }))} placeholder="dormitory_lobby" /></div>
              <div><Label>显示名</Label><Input value={locForm.displayName} onChange={e => setLocForm(p => ({ ...p, displayName: e.target.value }))} placeholder="宿舍大厅" /></div>
            </div>
            <div><Label>描述</Label><Input value={locForm.description} onChange={e => setLocForm(p => ({ ...p, description: e.target.value }))} placeholder="宿舍楼入口..." /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>X 坐标</Label><Input type="number" value={locForm.posX} onChange={e => setLocForm(p => ({ ...p, posX: +e.target.value }))} /></div>
              <div><Label>Y 坐标</Label><Input type="number" value={locForm.posY} onChange={e => setLocForm(p => ({ ...p, posY: +e.target.value }))} /></div>
              <div>
                <Label>类型</Label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={locForm.locationType} onChange={e => setLocForm(p => ({ ...p, locationType: e.target.value }))}>
                  <option value="vn_scene">VN 场景</option><option value="dialogue_hub">对话中心</option><option value="transition">过渡</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>最低输出等级</Label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={locForm.requiredOutputLevel} onChange={e => setLocForm(p => ({ ...p, requiredOutputLevel: e.target.value }))}>
                  <option value="L1">L1</option><option value="L2">L2</option><option value="L3">L3</option>
                </select>
              </div>
              <div><Label>排序</Label><Input type="number" value={locForm.sortOrder} onChange={e => setLocForm(p => ({ ...p, sortOrder: +e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={locForm.isPreview} onChange={e => setLocForm(p => ({ ...p, isPreview: e.target.checked }))} />
              预览地点
            </label>
            <Button className="w-full" onClick={saveLoc} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
