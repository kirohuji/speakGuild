import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { resolveFileAssetUrl } from '@/lib/file-asset-reference'
import {
  createMap,
  deleteMap,
  listMaps,
  type GameMapData,
} from '../api-content-admin'
import { AdminPagination, getPageItems, getTotalPages } from './admin-pagination'
import { ImageUploadField } from './image-upload-field'
import { makeExplorationKey } from './maps/exploration-map-model'

export function NarrativeMapList({
  onMapsChange,
}: {
  onMapsChange?: (maps: GameMapData[]) => void
}) {
  const navigate = useNavigate()
  const onMapsChangeRef = useRef(onMapsChange)
  onMapsChangeRef.current = onMapsChange
  const [maps, setMaps] = useState<GameMapData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<GameMapData | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [form, setForm] = useState({ displayName: '', thumbnailUrl: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const nextMaps = await listMaps()
      setMaps(nextMaps)
      onMapsChangeRef.current?.(nextMaps)
    } catch {
      toast.error('地图世界加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return maps
    return maps.filter((item) =>
      `${item.displayName} ${item.name}`.toLowerCase().includes(keyword),
    )
  }, [maps, search])

  const totalPages = getTotalPages(filtered.length, pageSize)
  const currentPage = Math.min(page, totalPages)
  const pageItems = getPageItems(filtered, currentPage, pageSize)

  const openCreate = () => {
    setForm({ displayName: '', thumbnailUrl: '' })
    setDialogOpen(true)
  }

  const saveMap = async () => {
    const displayName = form.displayName.trim()
    if (!displayName) return
    setSaving(true)
    try {
      const created = await createMap({
        displayName,
        thumbnailUrl: form.thumbnailUrl,
        name: makeExplorationKey(displayName, 'map'),
        width: 1920,
        height: 1080,
        requiredOutputLevel: 'L1',
        editorData: { version: 4, explorationObjects: {} },
        sortOrder: maps.length,
      })
      setDialogOpen(false)
      toast.success('地图已创建')
      navigate(`/admin/narrative-assets/maps/${created.id}`)
    } catch {
      toast.error('地图创建失败')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const locationCount = deleting.locations?.length ?? 0
    if (locationCount > 0) {
      toast.error('这张世界下还有地点，请先在编辑器里删除地点')
      setDeleting(null)
      return
    }
    setDeletingBusy(true)
    try {
      await deleteMap(deleting.id)
      toast.success('地图已删除')
      setDeleting(null)
      await load()
    } catch {
      toast.error('地图删除失败')
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[280px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="搜索世界地图..."
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">共 {filtered.length} 张世界</span>
        <Button className="ml-auto" onClick={openCreate}>
          <Plus data-icon="inline-start" />
          新建世界
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[88px] pl-4">缩略图</TableHead>
              <TableHead>世界</TableHead>
              <TableHead className="w-[120px]">尺寸</TableHead>
              <TableHead className="w-[88px]">地点</TableHead>
              <TableHead className="w-[88px]">房间</TableHead>
              <TableHead className="w-[140px]">状态</TableHead>
              <TableHead className="w-[160px] pr-4 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7} className="px-4">
                    <Skeleton className="h-12 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : pageItems.length ? (
              pageItems.map((item) => {
                const locationCount = item.locations?.length ?? 0
                const roomCount = item.locations?.reduce((sum, location) => sum + (location.rooms?.length ?? 0), 0) ?? 0
                const preview = resolveFileAssetUrl(item.thumbnailUrl || item.backgroundUrl)
                return (
                  <TableRow key={item.id}>
                    <TableCell className="pl-4">
                      <div className="flex size-14 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {preview ? (
                          <img src={preview} alt="" className="size-full object-cover" />
                        ) : (
                          <Map className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{item.displayName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.name}</p>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {item.width} × {item.height}
                    </TableCell>
                    <TableCell className="tabular-nums">{locationCount}</TableCell>
                    <TableCell className="tabular-nums">{roomCount}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.disabled && <Badge variant="secondary">停用</Badge>}
                        {item.hidden && <Badge variant="secondary">隐藏</Badge>}
                        {item.isPreview && <Badge variant="outline">预览</Badge>}
                        {!item.disabled && !item.hidden && !item.isPreview && <Badge variant="outline">可用</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/narrative-assets/maps/${item.id}`)}
                        >
                          <Pencil data-icon="inline-start" />
                          编辑
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="删除世界"
                          onClick={() => setDeleting(item)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-16 text-center">
                  <Map className="mx-auto size-8 text-muted-foreground/40" />
                  <p className="mt-3 text-sm font-medium">{maps.length ? '没有匹配的世界地图' : '还没有世界地图'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {maps.length ? '换一个关键词再找。' : '新建一张世界后，再进入编辑器放置地点和房间。'}
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > pageSize && (
        <AdminPagination
          total={filtered.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建世界地图</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="map-display-name">地图名称</Label>
              <Input
                id="map-display-name"
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                placeholder="例如：海港学院"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>世界缩略图</Label>
              <ImageUploadField
                value={form.thumbnailUrl}
                onChange={(url) => setForm({ ...form, thumbnailUrl: url })}
                previewSize="lg"
                group="library"
                placeholder="上传世界列表缩略图"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button disabled={saving || !form.displayName.trim()} onClick={() => void saveMap()}>
              {saving ? '创建中...' : '创建并编辑'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除世界「{deleting?.displayName}」？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {(deleting?.locations?.length ?? 0) > 0
              ? '这张世界下还有地点。先进入编辑器删掉地点后，才能删除世界。'
              : '删除后不能恢复。地点、房间和热点都挂在这张世界上。'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>取消</Button>
            <Button
              variant="destructive"
              disabled={deletingBusy || (deleting?.locations?.length ?? 0) > 0}
              onClick={() => void confirmDelete()}
            >
              {deletingBusy ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
