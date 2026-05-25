import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Plus, Send, Search, Users, Globe, X, Eye, Pencil, Trash2,
  Loader2, ArrowLeft, UserPlus, ImageIcon, Library, Check,
  ChevronLeft, ChevronRight, Megaphone, Target, MessageSquare,
} from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { VirtuosoGrid } from 'react-virtuoso'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import {
  listNotifications, createNotification, updateNotification, deleteNotification,
  searchUsers, uploadNotificationImage, listNotificationImages, getNotificationStats,
  type AdminNotificationItem, type SearchUserResult, type NotificationImageItem, type NotificationStats,
} from '@/features/admin/api-notifications'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { useAuth } from '@/providers/auth-provider'

const noRingInput = 'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none'

// ========== 图片库弹窗（不变） ==========
function ImageLibraryPopover({
  onSelect,
}: {
  onSelect: (url: string, filename: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<NotificationImageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const pageSize = 20

  const loadImages = useCallback(async (pg: number, append: boolean) => {
    setLoading(true)
    try {
      const res = await listNotificationImages({ page: pg, pageSize })
      if (append) setImages((prev) => [...prev, ...res.list])
      else setImages(res.list)
      setHasMore(res.list.length === pageSize)
    } catch { if (!append) setImages([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (open) { setPage(1); setImages([]); setHasMore(true); loadImages(1, false) }
  }, [open, loadImages])

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    const nextPage = page + 1; setPage(nextPage); loadImages(nextPage, true)
  }, [loading, hasMore, page, loadImages])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground">
          <Library className="h-3 w-3" />图片库
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-[380px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-xs font-medium">已上传图片</span>
          <span className="text-[10px] text-muted-foreground">{images.length} 张 · 点击插入</span>
        </div>
        <div className="h-[320px]">
          {loading && images.length === 0 ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="h-8 w-8 mb-2 opacity-30" /><p className="text-xs">暂无图片</p>
            </div>
          ) : (
            <VirtuosoGrid style={{ height: '100%' }} totalCount={images.length} endReached={loadMore} overscan={200}
              components={{ List: React.forwardRef((props, ref) => (<div ref={ref} {...props} className="grid grid-cols-3 gap-2 px-4" />)) }}
              itemContent={(index) => {
                const img = images[index]
                return (
                  <button type="button" onClick={() => { onSelect(img.url, img.filename); setOpen(false) }}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted/30 hover:border-primary/40 transition-colors" title={img.filename}>
                    <img src={img.url} alt={img.filename} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Check className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                )
              }}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ========== 查看通知弹窗 ==========
function ViewNotificationDialog({ item, open, onClose }: { item: AdminNotificationItem | null; open: boolean; onClose: () => void }) {
  if (!item) return null
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-0">
          <DialogTitle className="text-base">{item.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 mt-1">
            <Badge variant={item.type === 'broadcast' ? 'default' : 'secondary'} className="text-[10px]">
              {item.type === 'broadcast' ? '广播' : '定向'}
            </Badge>
            <span className="text-xs">发送者：{item.sentBy.name || item.sentBy.email}</span>
            <span className="text-xs">{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
          </DialogDescription>
        </DialogHeader>

        {/* 统计数据 */}
        <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-border">
          <div className="rounded-xl border border-border/60 p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">{item._count.reads}</p>
            <p className="text-xs text-muted-foreground">已读次数</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3 text-center">
            <p className="text-2xl font-bold text-purple-500">
              {item.type === 'broadcast' ? '全部' : item._count.targets}
            </p>
            <p className="text-xs text-muted-foreground">目标用户</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3 text-center">
            <p className="text-lg font-bold text-emerald-500 leading-tight">
              {new Date(item.createdAt).toLocaleDateString('zh-CN')}
            </p>
            <p className="text-xs text-muted-foreground">创建日期</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <MarkdownRenderer content={item.content} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ========== 编辑通知弹窗 ==========
function EditNotificationDialog({
  item, open, onClose, onSaved,
}: {
  item: AdminNotificationItem | null; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<'broadcast' | 'targeted'>('broadcast')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) { setTitle(item.title); setContent(item.content); setType(item.type) }
  }, [item])

  const handleSave = async () => {
    if (!item || !title.trim() || !content.trim()) return
    setSaving(true)
    try {
      await updateNotification(item.id, { title: title.trim(), content: content.trim(), type })
      onSaved()
      onClose()
    } catch {} finally { setSaving(false) }
  }

  if (!item) return null
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-0">
          <DialogTitle>编辑通知</DialogTitle>
          <DialogDescription>修改通知的标题、内容和发送范围</DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">标题</label>
            <Input placeholder="通知标题" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className={noRingInput} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">内容（Markdown）</label>
            <div data-color-mode="light" className="[&_.w-md-editor]:shadow-none [&_.w-md-editor]:border [&_.w-md-editor]:border-border [&_.w-md-editor]:rounded-lg">
              <MDEditor value={content} onChange={(val) => setContent(val || '')} height={300} preview="live" visibleDragbar={false} hideToolbar={false} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">发送范围</label>
            <div className="flex rounded-lg bg-muted p-0.5">
              {([{ value: 'broadcast' as const, label: '全部用户', icon: Globe }, { value: 'targeted' as const, label: '指定用户', icon: Users }]).map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" onClick={() => setType(value)}
                  className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all',
                    type === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-shrink-0 px-6 pb-5 pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ========== 主页面 ==========
export function AdminNotificationsPage() {
  const navigate = useNavigate()
  const { session } = useAuth()

  const [data, setData] = useState<AdminNotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  // Search
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Stats
  const [stats, setStats] = useState<NotificationStats | null>(null)

  // Create
  const [createOpen, setCreateOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formType, setFormType] = useState<'broadcast' | 'targeted'>('broadcast')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([])
  const [selectedUsers, setSelectedUsers] = useState<SearchUserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // View / Edit / Delete
  const [viewItem, setViewItem] = useState<AdminNotificationItem | null>(null)
  const [editItem, setEditItem] = useState<AdminNotificationItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<AdminNotificationItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listNotifications({ page, pageSize, keyword: keyword || undefined })
      setData(result.list)
      setTotal(result.total)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [page, pageSize, keyword])

  const fetchStats = useCallback(async () => {
    try { setStats(await getNotificationStats()) } catch {}
  }, [])

  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { fetchStats() }, [fetchStats])

  const handleSearch = () => {
    setPage(1)
    setKeyword(searchInput)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    setDeleting(true)
    try {
      await deleteNotification(deleteItem.id)
      setDeleteItem(null)
      fetchList()
      fetchStats()
    } catch {} finally { setDeleting(false) }
  }

  // ----- Create helpers -----
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploadingImage(true)
    try {
      const { url } = await uploadNotificationImage(file)
      setFormContent((prev) => prev + `\n![${file.name}](${url})\n`)
    } catch {} finally { setUploadingImage(false) }
  }

  const handleEditorPaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file) await handleImageFile(file)
        return
      }
    }
  }, [])

  const handleSearchUsers = async () => {
    if (!searchKeyword.trim()) return
    setSearching(true)
    try {
      const results = await searchUsers(searchKeyword.trim())
      setSearchResults(results.filter((u) => !selectedUsers.find((s) => s.id === u.id)))
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }

  const addUser = (user: SearchUserResult) => {
    setSelectedUsers((prev) => [...prev, user])
    setSearchResults((prev) => prev.filter((u) => u.id !== user.id))
  }

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) return
    setSending(true)
    try {
      await createNotification({ title: formTitle.trim(), content: formContent.trim(), type: formType, targetUserIds: formType === 'targeted' ? selectedUsers.map((u) => u.id) : undefined })
      setCreateOpen(false); resetForm(); fetchList(); fetchStats()
    } catch {} finally { setSending(false) }
  }

  const resetForm = () => {
    setFormTitle(''); setFormContent(''); setFormType('broadcast'); setSelectedUsers([]); setSearchKeyword(''); setSearchResults([])
  }

  if (session && session.user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-lg font-semibold text-muted-foreground">需要管理员权限</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}><ArrowLeft className="mr-2 h-4 w-4" />返回首页</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">消息通知管理</h1>
          <p className="text-sm text-muted-foreground">创建和管理系统通知</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true) }}><Plus className="mr-2 h-4 w-4" />新建通知</Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Megaphone className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total ?? '--'}</p>
                <p className="text-xs text-muted-foreground">通知总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Globe className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.broadcast ?? '--'}</p>
                <p className="text-xs text-muted-foreground">广播通知</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <Target className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.targeted ?? '--'}</p>
                <p className="text-xs text-muted-foreground">定向通知</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <MessageSquare className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalReads ?? '--'}</p>
                <p className="text-xs text-muted-foreground">总阅读数</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索通知标题或内容..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} size="sm">搜索</Button>
        {keyword && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('')
              setKeyword('')
              setPage(1)
            }}
          >
            清除
          </Button>
        )}
      </div>

      {/* 表格卡片 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">通知列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Bell className="h-12 w-12 opacity-20" />
              <p className="mt-4 text-sm font-medium">{keyword ? '没有匹配的通知' : '暂无通知'}</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {keyword ? '尝试更换搜索关键词' : '创建通知后会显示在这里'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <Badge variant={item.type === 'broadcast' ? 'default' : 'secondary'} className="text-[10px]">
                        {item.type === 'broadcast' ? <Globe className="mr-0.5 h-3 w-3 inline" /> : <Users className="mr-0.5 h-3 w-3 inline" />}
                        {item.type === 'broadcast' ? '广播' : '定向'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {item.content.replace(/[#*`>\[\]()!\-]/g, '').substring(0, 100)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                      <span>阅读 {item._count.reads} · 目标 {item.type === 'broadcast' ? '全部用户' : `${item._count.targets} 人`}</span>
                      <span>发送者 {item.sentBy.name || item.sentBy.email}</span>
                      <span>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setViewItem(item)}>
                      <Eye className="h-3.5 w-3.5 mr-1" />查看
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditItem(item)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />编辑
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteItem(item)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 分页 */}
          {total > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">每页</span>
                <Select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="h-8 w-[72px] text-xs">
                  <option value={10}>10</option><option value={15}>15</option><option value={20}>20</option><option value={50}>50</option>
                </Select>
                <span className="text-xs text-muted-foreground whitespace-nowrap">条</span>
              </div>
              <p className="text-xs text-muted-foreground">共 {total} 条，第 {page}/{Math.ceil(total / pageSize)} 页</p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 text-xs"><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p + 1)} className="h-8 text-xs"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== 新建通知 ====== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[92vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-0">
            <DialogTitle>新建通知</DialogTitle>
            <DialogDescription>向用户发送系统通知，支持 Markdown 与图片嵌入</DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">标题</label>
              <Input placeholder="通知标题" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} maxLength={100} className={noRingInput} />
            </div>
            <div className="space-y-1.5" onPaste={handleEditorPaste}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">内容（Markdown）</label>
                <div className="flex items-center gap-1.5">
                  {uploadingImage && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />上传中...</span>}
                  <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                    <ImageIcon className="h-3 w-3" />上传图片
                  </Button>
                  <ImageLibraryPopover onSelect={(url, filename) => setFormContent((prev) => prev + `\n![${filename}](${url})\n`)} />
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />
              <div data-color-mode="light" className="[&_.w-md-editor]:shadow-none [&_.w-md-editor]:border [&_.w-md-editor]:border-border [&_.w-md-editor]:rounded-lg [&_.w-md-editor-toolbar]:rounded-t-lg [&_.w-md-editor-text-pre>code]:!text-sm [&_.w-md-editor-text-input]:!text-sm">
                <MDEditor value={formContent} onChange={(val) => setFormContent(val || '')} height={360} preview="live" visibleDragbar={false} hideToolbar={false} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">发送范围</label>
              <div className="flex rounded-lg bg-muted p-0.5">
                {([{ value: 'broadcast' as const, label: '全部用户', icon: Globe }, { value: 'targeted' as const, label: '指定用户', icon: Users }]).map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" onClick={() => setFormType(value)}
                    className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all', formType === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>
            {formType === 'targeted' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="搜索用户邮箱或姓名..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()} className={cn('pl-8 h-8 text-xs', noRingInput)} />
                  </div>
                  <Button size="sm" onClick={handleSearchUsers} disabled={searching} className="h-8 text-xs">{searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '搜索'}</Button>
                </div>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUsers.map((u) => (<Badge key={u.id} variant="secondary" className="gap-1 pr-1 text-xs">{u.name || u.email}<button type="button" onClick={() => removeUser(u.id)}><X className="h-3 w-3" /></button></Badge>))}
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="rounded-lg border border-border/60 max-h-40 overflow-y-auto">
                    {searchResults.map((u) => (<button key={u.id} type="button" onClick={() => addUser(u)} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border/40 last:border-b-0"><UserPlus className="h-3.5 w-3.5 text-muted-foreground" /><span>{u.name || u.email}</span><span className="text-xs text-muted-foreground">{u.email}</span></button>))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 px-6 pb-5 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={sending || !formTitle.trim() || !formContent.trim()}>{sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}发送通知</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== 查看 / 编辑 / 删除 弹窗 ====== */}
      <ViewNotificationDialog item={viewItem} open={!!viewItem} onClose={() => setViewItem(null)} />

      <EditNotificationDialog item={editItem} open={!!editItem} onClose={() => setEditItem(null)} onSaved={() => { fetchList(); fetchStats() }} />

      <Dialog open={!!deleteItem} onOpenChange={(v) => !v && setDeleteItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除通知「{deleteItem?.title}」吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
