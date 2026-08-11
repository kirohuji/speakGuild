import { useState, useEffect, useCallback } from 'react'
import {
  Search, Copy, Check, Loader2, ShieldCheck,
  Image, FileAudio, FileVideo, File, HardDrive,
  LayoutGrid, Rows3,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectItem } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import {
  listFileAssets, getFileAssetDetail, getFileAssetGroupStats,
  inspectUnusedFileAssets, cleanupInspectedFileAssets,
  type FileAssetItem, type FileAssetDetail, type FileAssetGroupStat,
} from '../api-content-admin'
import { AdminPagination } from '../components/admin-pagination'
import { adminTasksApi, type AdminTaskDetail } from '../api-admin-tasks'

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const GROUP_LABELS: Record<string, string> = {
  avatar: '头像',
  library: '资源库',
  tts: 'TTS',
  notification: '通知',
  mobile_bundle: 'OTA 安装包',
  learning_pack: '学习包',
  learning_pack_delta: '增量包',
  user_recording: '用户录音',
  scene_cover: '场景封面',
}

const GROUP_COLORS: Record<string, string> = {
  avatar: 'bg-pink-100 text-pink-700',
  library: 'bg-blue-100 text-blue-700',
  tts: 'bg-purple-100 text-purple-700',
  notification: 'bg-orange-100 text-orange-700',
  mobile_bundle: 'bg-cyan-100 text-cyan-700',
  learning_pack: 'bg-emerald-100 text-emerald-700',
  learning_pack_delta: 'bg-teal-100 text-teal-700',
  user_recording: 'bg-amber-100 text-amber-700',
  scene_cover: 'bg-indigo-100 text-indigo-700',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function shortSha(sha: string): string {
  return sha.length > 12 ? `${sha.slice(0, 6)}...${sha.slice(-6)}` : sha
}

function mimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.startsWith('audio/')) return FileAudio
  if (mimeType.startsWith('video/')) return FileVideo
  return File
}

type ViewMode = 'table' | 'card'

export function AdminFileAssetsPage() {
  const [data, setData] = useState<{ items: FileAssetItem[]; total: number; page: number; pageSize: number; totalPages: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [groupStats, setGroupStats] = useState<FileAssetGroupStat[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailAsset, setDetailAsset] = useState<FileAssetDetail | null>(null)

  const [maintenanceTask, setMaintenanceTask] = useState<AdminTaskDetail | null>(null)
  const [maintenanceBusy, setMaintenanceBusy] = useState(false)

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listFileAssets({
        group: groupFilter === 'all' ? undefined : groupFilter,
        search: search || undefined,
        page,
        pageSize,
      })
      setData(result)
    } catch {
      toast.error('加载文件资产列表失败')
    } finally {
      setLoading(false)
    }
  }, [search, groupFilter, page, pageSize])

  useEffect(() => { load() }, [load])

  // Load group stats once
  useEffect(() => {
    getFileAssetGroupStats().then(setGroupStats).catch(() => {})
  }, [])

  const openDetail = async (item: FileAssetItem) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailAsset(null)
    try {
      const detail = await getFileAssetDetail(item.id)
      setDetailAsset(detail)
    } catch {
      toast.error('加载详情失败')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const waitForTask = async (taskId: string) => {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      const task = await adminTasksApi.get(taskId)
      setMaintenanceTask(task)
      if (['completed', 'failed', 'canceled'].includes(task.status)) return task
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
    throw new Error('任务仍在后台执行，请前往任务中心查看')
  }

  const handleInspect = async () => {
    setMaintenanceBusy(true)
    try {
      const task = await inspectUnusedFileAssets(7)
      const completed = await waitForTask(task.id)
      if (completed.status === 'completed') {
        toast.success(`检查完成：发现 ${completed.summary?.candidateCount ?? 0} 个未使用资源`)
      } else {
        toast.error(completed.errorMessage || '资源检查失败')
      }
    } catch (err: any) {
      toast.error(err?.message || '资源检查失败')
    } finally {
      setMaintenanceBusy(false)
    }
  }

  const handleCleanup = async () => {
    if (!maintenanceTask || maintenanceTask.type !== 'file-asset-inspect') return
    setMaintenanceBusy(true)
    try {
      const task = await cleanupInspectedFileAssets(maintenanceTask.id)
      const completed = await waitForTask(task.id)
      if (completed.status === 'completed') {
        toast.success(`清理完成：删除 ${completed.summary?.purged ?? 0} 个资源`)
        await load()
      } else {
        toast.error(completed.errorMessage || '资源清理失败')
      }
    } catch (err: any) {
      toast.error(err?.message || '资源清理失败')
    } finally {
      setMaintenanceBusy(false)
    }
  }

  const handleCopySha = (sha: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(sha).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => toast.error('复制失败'))
  }

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">资源库管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            统一管理所有上传到 COS 的文件资产；清理必须先检查，再由任务中心安全执行
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleInspect} disabled={maintenanceBusy}>
            {maintenanceBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}
            检查未使用资源
          </Button>
          {maintenanceTask?.type === 'file-asset-inspect'
            && maintenanceTask.status === 'completed'
            && Number(maintenanceTask.summary?.candidateCount ?? 0) > 0 && (
            <Button variant="destructive" onClick={handleCleanup} disabled={maintenanceBusy}>
              清理 {maintenanceTask.summary.candidateCount} 项（{formatSize(maintenanceTask.summary.candidateBytes ?? 0)}）
            </Button>
          )}
        </div>
      </div>

      {/* Search + Filter + View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索文件名、SHA256 或 COS Key..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Select
            value={groupFilter}
            onChange={(e) => { setGroupFilter(e.target.value); setPage(1) }}
          >
            <SelectItem value="all">全部分组 ({data?.total ?? 0})</SelectItem>
            {groupStats.map((gs) => (
              <SelectItem key={gs.group} value={gs.group}>
                {GROUP_LABELS[gs.group] || gs.group} ({gs.count})
              </SelectItem>
            ))}
          </Select>
        </div>
        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-border/60 bg-card p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'table'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="表格视图"
          >
            <Rows3 className="size-4" />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'card'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="卡片视图"
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
      </div>

      <Separator />

      {/* Loading */}
      {loading && (
        viewMode === 'table' ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
          </div>
        )
      )}

      {/* Table View */}
      {!loading && viewMode === 'table' && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">文件名</th>
                <th className="px-4 py-3 text-left font-medium">SHA256</th>
                <th className="px-4 py-3 text-left font-medium">分组</th>
                <th className="px-4 py-3 text-left font-medium">类型</th>
                <th className="px-4 py-3 text-right font-medium">大小</th>
                <th className="px-4 py-3 text-center font-medium">引用</th>
                <th className="px-4 py-3 text-right font-medium">上传时间</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => {
                const Icon = mimeIcon(item.mimeType)
                return (
                  <tr
                    key={item.id}
                    className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openDetail(item)}
                  >
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium" title={item.filename}>
                          {item.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <button
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => handleCopySha(item.sha256, item.id, e)}
                        title="点击复制完整 SHA256"
                      >
                        {shortSha(item.sha256)}
                        {copiedId === item.id
                          ? <Check className="size-3 text-emerald-500" />
                          : <Copy className="size-3" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('text-xs', GROUP_COLORS[item.group] || 'bg-slate-100 text-slate-700')}>
                        {GROUP_LABELS[item.group] || item.group}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.mimeType.split('/')[1]?.toUpperCase() || item.mimeType}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatSize(item.size)}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      <span className={cn(
                        'font-medium',
                        item.referenceCount > 0 ? 'text-emerald-600' : 'text-muted-foreground',
                      )}>
                        {item.referenceCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString('zh-CN', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                )
              })}
              {data?.items.length === 0 && (
                <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    暂无文件资产
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <AdminPagination
            total={data?.total ?? 0}
            page={Math.min(page, totalPages)}
            pageSize={pageSize}
            pageSizes={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          />
        </div>
      )}

      {/* Card View */}
      {!loading && viewMode === 'card' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((item) => {
              const Icon = mimeIcon(item.mimeType)
              const isImage = item.mimeType.startsWith('image/')
              return (
                <div
                  key={item.id}
                  className="group cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-card transition-colors hover:border-primary/30 hover:bg-muted/20"
                  onClick={() => openDetail(item)}
                >
                  {/* Card top: preview thumbnail or icon */}
                  {isImage && item.previewUrl ? (
                    <div className="relative h-40 w-full bg-muted/30">
                      <img
                        src={item.previewUrl}
                        alt={item.filename}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute right-2 top-2">
                        <Badge className={cn('text-[10px]', GROUP_COLORS[item.group] || 'bg-slate-100 text-slate-700')}>
                          {GROUP_LABELS[item.group] || item.group}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="relative flex h-40 w-full items-center justify-center bg-muted/20">
                      <Icon className="size-12 text-muted-foreground/40" />
                      <div className="absolute right-2 top-2">
                        <Badge className={cn('text-[10px]', GROUP_COLORS[item.group] || 'bg-slate-100 text-slate-700')}>
                          {GROUP_LABELS[item.group] || item.group}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Card body */}
                  <div className="p-4">
                    {/* Filename */}
                    <p className="mb-1 text-sm font-medium truncate" title={item.filename}>
                      {item.filename}
                    </p>

                    {/* Meta row */}
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="uppercase">{item.mimeType.split('/')[1] || item.mimeType}</span>
                      <span>·</span>
                      <span>{formatSize(item.size)}</span>
                      <span>·</span>
                      <span className={item.referenceCount > 0 ? 'text-emerald-600' : ''}>
                        {item.referenceCount} 引用
                      </span>
                    </div>

                    {/* SHA */}
                    <div className="mb-1 font-mono text-[10px] text-muted-foreground/60 truncate">
                      {item.sha256}
                    </div>

                    {/* Bottom: time + actions */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString('zh-CN', {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            {data?.items.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                暂无文件资产
              </div>
            )}
          </div>
          <AdminPagination
            total={data?.total ?? 0}
            page={Math.min(page, totalPages)}
            pageSize={pageSize}
            pageSizes={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          />
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="size-5" />
              文件资产详情
            </DialogTitle>
            <DialogDescription>
              查看文件基本信息、预览和引用记录
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="grid gap-5 lg:grid-cols-5">
              <Skeleton className="h-64 lg:col-span-2" />
              <div className="space-y-3 lg:col-span-3">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-40 w-full" />
              </div>
            </div>
          ) : detailAsset ? (
            <div className="grid gap-5 lg:grid-cols-5">
              {/* Left: preview */}
              <div className="lg:col-span-2">
                {detailAsset.previewUrl ? (
                  <div className="overflow-hidden rounded-lg border bg-muted/20">
                    {detailAsset.mimeType.startsWith('image/') && (
                      <img
                        src={detailAsset.previewUrl}
                        alt={detailAsset.filename}
                        className="w-full object-contain"
                      />
                    )}
                    {detailAsset.mimeType.startsWith('audio/') && (
                      <div className="flex min-h-40 items-center p-4">
                        <audio controls className="w-full">
                          <source src={detailAsset.previewUrl} type={detailAsset.mimeType} />
                        </audio>
                      </div>
                    )}
                    {detailAsset.mimeType.startsWith('video/') && (
                      <video controls className="w-full">
                        <source src={detailAsset.previewUrl} type={detailAsset.mimeType} />
                      </video>
                    )}
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-lg border bg-muted/20">
                    {(() => {
                      const Icon = mimeIcon(detailAsset.mimeType)
                      return <Icon className="size-14 text-muted-foreground/40" />
                    })()}
                  </div>
                )}
              </div>

              {/* Right: info + references */}
              <div className="min-w-0 space-y-5 lg:col-span-3">
                {/* Filename + group */}
                <div>
                  <p className="truncate text-lg font-semibold" title={detailAsset.filename}>{detailAsset.filename}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge className={cn('text-xs', GROUP_COLORS[detailAsset.group] || 'bg-slate-100 text-slate-700')}>
                      {GROUP_LABELS[detailAsset.group] || detailAsset.group}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">{detailAsset.mimeType}</span>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">文件大小</span>
                    <p>{formatSize(detailAsset.size)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">引用数</span>
                    <p className={detailAsset.referenceCount > 0 ? 'font-medium text-emerald-600' : 'text-muted-foreground'}>
                      {detailAsset.referenceCount}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">上传时间</span>
                    <p className="text-xs">
                      {new Date(detailAsset.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">存储桶</span>
                    <p className="text-xs">{detailAsset.bucket} · {detailAsset.region}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">SHA256</span>
                    <p className="break-all font-mono text-xs">{detailAsset.sha256}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">COS Key</span>
                    <p className="break-all font-mono text-xs text-muted-foreground">{detailAsset.cosKey}</p>
                  </div>
                </div>

                {/* References */}
                {detailAsset.references.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 text-sm font-medium">
                        引用记录 ({detailAsset.references.length})
                      </h4>
                      <div className="max-h-40 overflow-y-auto rounded-md border">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-muted/30">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">业务</th>
                              <th className="px-3 py-2 text-left font-medium">用户</th>
                              <th className="px-3 py-2 text-left font-medium">时间</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailAsset.references.map((ref) => (
                              <tr key={ref.id} className="border-t">
                                <td className="px-3 py-2">
                                  <p className="font-mono">{ref.bizType}</p>
                                  <p className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground" title={ref.bizId}>
                                    {ref.bizId}
                                  </p>
                                </td>
                                <td className="px-3 py-2">
                                  {ref.createdByName || ref.createdById || 'system'}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                                  {new Date(ref.createdAt).toLocaleString('zh-CN', {
                                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

    </div>
  )
}
