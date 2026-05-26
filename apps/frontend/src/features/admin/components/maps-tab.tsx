import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Edit3, Map, MapPin, Users, DoorOpen, ImageIcon,
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
import { toast } from 'sonner'
import {
  listMaps, createMap, updateMap, deleteMap,
  listLocations, createLocation, updateLocation, deleteLocation,
  type GameMapData, type GameLocationData,
} from '../api-content-admin'
import { ImageUploadField } from './image-upload-field'

interface MapsTabProps {
  onLocationsChange?: (locations: GameLocationData[]) => void
}

export function MapsTab({ onLocationsChange }: MapsTabProps) {
  const [maps, setMaps] = useState<GameMapData[]>([])
  const [locations, setLocations] = useState<GameLocationData[]>([])
  const [loading, setLoading] = useState(true)

  // Map dialog
  const [mapDialogOpen, setMapDialogOpen] = useState(false)
  const [editMap, setEditMap] = useState<GameMapData | null>(null)
  const [mapForm, setMapForm] = useState({
    name: '', displayName: '', requiredOutputLevel: 'L1',
    isPreview: false, sortOrder: 0,
    backgroundUrl: '', thumbnailUrl: '',
  })

  // Location dialog
  const [locDialogOpen, setLocDialogOpen] = useState(false)
  const [editLoc, setEditLoc] = useState<GameLocationData | null>(null)
  const [locForm, setLocForm] = useState({
    mapId: '', name: '', displayName: '', description: '',
    posX: 50, posY: 50, locationType: 'vn_scene',
    requiredOutputLevel: 'L1', isPreview: false, sortOrder: 0,
    backgroundUrl: '',
  })

  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mps, locs] = await Promise.all([
        listMaps(),
        listLocations().catch(() => [] as GameLocationData[]),
      ])
      setMaps(mps)
      setLocations(locs)
      onLocationsChange?.(locs)
    } catch { toast.error('加载失败') }
    finally { setLoading(false) }
  }, [onLocationsChange])

  useEffect(() => { load() }, [load])

  const locsForMap = (mapId: string) => locations.filter((l) => l.mapId === mapId)

  // ─── Map CRUD ─────────────────────────────────

  const openCreateMap = () => {
    setEditMap(null)
    setMapForm({ name: '', displayName: '', requiredOutputLevel: 'L1', isPreview: false, sortOrder: 0, backgroundUrl: '', thumbnailUrl: '' })
    setMapDialogOpen(true)
  }

  const openEditMap = (m: GameMapData) => {
    setEditMap(m)
    setMapForm({
      name: m.name, displayName: m.displayName,
      requiredOutputLevel: m.requiredOutputLevel,
      isPreview: m.isPreview ?? false, sortOrder: m.sortOrder ?? 0,
      backgroundUrl: m.backgroundUrl ?? '', thumbnailUrl: m.thumbnailUrl ?? '',
    })
    setMapDialogOpen(true)
  }

  const saveMap = async () => {
    if (!mapForm.name || !mapForm.displayName) { toast.error('名称和显示名必填'); return }
    setSaving(true)
    try {
      if (editMap) { await updateMap(editMap.id, mapForm); toast.success('地图已更新') }
      else { await createMap(mapForm); toast.success('地图已创建') }
      setMapDialogOpen(false); load()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  const removeMap = async (m: GameMapData) => {
    if (!confirm(`删除地图 "${m.displayName}"？其下所有地点也将被删除。`)) return
    try { await deleteMap(m.id); toast.success('已删除'); load() } catch { toast.error('删除失败') }
  }

  // ─── Location CRUD ────────────────────────────

  const openCreateLoc = (mapId: string) => {
    setEditLoc(null)
    setLocForm({
      mapId, name: '', displayName: '', description: '',
      posX: 50, posY: 50, locationType: 'vn_scene',
      requiredOutputLevel: 'L1', isPreview: false, sortOrder: 0,
      backgroundUrl: '',
    })
    setLocDialogOpen(true)
  }

  const openEditLoc = (loc: GameLocationData) => {
    setEditLoc(loc)
    setLocForm({
      mapId: loc.mapId, name: loc.name, displayName: loc.displayName,
      description: loc.description ?? '', posX: loc.posX, posY: loc.posY,
      locationType: loc.locationType, requiredOutputLevel: loc.requiredOutputLevel,
      isPreview: loc.isPreview ?? false, sortOrder: loc.sortOrder ?? 0,
      backgroundUrl: loc.backgroundUrl ?? '',
    })
    setLocDialogOpen(true)
  }

  const saveLoc = async () => {
    if (!locForm.name || !locForm.displayName) { toast.error('名称和显示名必填'); return }
    setSaving(true)
    try {
      if (editLoc) { await updateLocation(editLoc.id, locForm); toast.success('地点已更新') }
      else { await createLocation(locForm); toast.success('地点已创建') }
      setLocDialogOpen(false); load()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  const removeLoc = async (loc: GameLocationData) => {
    if (!confirm(`删除地点 "${loc.displayName}"？`)) return
    try { await deleteLocation(loc.id); toast.success('已删除'); load() } catch { toast.error('删除失败') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            管理探索模式的地图与地点。共 {maps.length} 个地图，{locations.length} 个地点。
          </p>
        </div>
        <Button size="sm" onClick={openCreateMap}>
          <Plus className="mr-1 size-4" />新建地图
        </Button>
      </div>

      {maps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <Map className="size-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">暂无地图</p>
          <p className="mt-1 text-xs text-muted-foreground/60">点击「新建地图」开始创建</p>
        </div>
      ) : (
        maps.map((map) => (
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
                  {map.isPreview && (
                    <Badge className="text-xs bg-amber-500/10 text-amber-600">预览</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => openCreateLoc(map.id)}>
                    <Plus className="mr-1 size-3" />添加地点
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditMap(map)}>
                    <Edit3 className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => removeMap(map)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
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
                          <p className="text-sm font-medium truncate">{loc.displayName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{loc.name}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">({loc.posX}, {loc.posY})</Badge>
                        <Badge variant="secondary" className="text-xs">{loc.locationType}</Badge>
                        {loc.isPreview && (
                          <Badge className="text-xs bg-amber-500/10 text-amber-600">预览</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-3" />
                          {loc.npcs?.length ?? 0}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DoorOpen className="size-3" />
                          {loc.exits?.length ?? 0}
                        </span>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditLoc(loc)}>
                          <Edit3 className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => removeLoc(loc)}>
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Map Dialog */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMap ? '编辑地图' : '新建地图'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
              <Label className="text-xs font-semibold">地图背景</Label>
              <ImageUploadField
                value={mapForm.backgroundUrl}
                onChange={(url) => setMapForm((p) => ({ ...p, backgroundUrl: url }))}
                placeholder="输入背景图 URL 或上传（在 VN 预览中 #bg 标签引用此图作为默认背景）"
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
            <Separator />
            <div className="flex items-center gap-8">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mapForm.isPreview}
                  onChange={(e) => setMapForm((p) => ({ ...p, isPreview: e.target.checked }))}
                  className="rounded border-border"
                />
                预览模式
              </label>
            </div>
            <Button className="w-full" onClick={saveMap} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={locDialogOpen} onOpenChange={setLocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editLoc ? '编辑地点' : '新建地点'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Key</Label>
                <Input value={locForm.name} onChange={(e) => setLocForm((p) => ({ ...p, name: e.target.value }))} placeholder="dorm_room" />
              </div>
              <div>
                <Label>显示名</Label>
                <Input value={locForm.displayName} onChange={(e) => setLocForm((p) => ({ ...p, displayName: e.target.value }))} placeholder="宿舍房间" />
              </div>
            </div>
            <div>
              <Label>描述</Label>
              <Input value={locForm.description} onChange={(e) => setLocForm((p) => ({ ...p, description: e.target.value }))} placeholder="地点描述..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>X 坐标</Label>
                <Input type="number" value={locForm.posX} onChange={(e) => setLocForm((p) => ({ ...p, posX: +e.target.value }))} />
              </div>
              <div>
                <Label>Y 坐标</Label>
                <Input type="number" value={locForm.posY} onChange={(e) => setLocForm((p) => ({ ...p, posY: +e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>类型</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={locForm.locationType}
                  onChange={(e) => setLocForm((p) => ({ ...p, locationType: e.target.value }))}
                >
                  <option value="vn_scene">VN 场景</option>
                  <option value="hub">交通枢纽</option>
                  <option value="shop">商店</option>
                  <option value="quest">任务点</option>
                </select>
              </div>
              <div>
                <Label>输出等级</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={locForm.requiredOutputLevel}
                  onChange={(e) => setLocForm((p) => ({ ...p, requiredOutputLevel: e.target.value }))}
                >
                  {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs font-semibold">地点背景</Label>
              <ImageUploadField
                value={locForm.backgroundUrl}
                onChange={(url) => setLocForm((p) => ({ ...p, backgroundUrl: url }))}
                placeholder="输入地点背景图 URL 或上传（Ink DSL 中 #bg 标签优先使用此图）"
                previewSize="lg"
              />
            </div>
            <Separator />
            <div className="flex items-center gap-8">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={locForm.isPreview}
                  onChange={(e) => setLocForm((p) => ({ ...p, isPreview: e.target.checked }))}
                  className="rounded border-border"
                />
                预览模式
              </label>
            </div>
            <Button className="w-full" onClick={saveLoc} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
