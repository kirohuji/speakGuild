import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Edit3, Search, Award,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { AdminPagination, getPageItems, getTotalPages } from '../components/admin-pagination'
import {
  listAchievementDefs, createAchievementDef, updateAchievementDef, deleteAchievementDef,
  type AchievementDef,
} from '../api-content-admin'

const RARITY_COLORS: Record<string, string> = {
  common: 'bg-muted text-muted-foreground',
  rare: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  epic: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  legendary: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
}

const CATEGORY_LABELS: Record<string, string> = {
  milestone: '里程碑',
  streak: '连续打卡',
  challenge: '挑战',
  mastery: '掌握',
  hidden: '隐藏',
  first_time: '首次体验',
}

export function AdminAchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementDef[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = async () => {
    setLoading(true)
    try {
      const list = await listAchievementDefs()
      setAchievements(list)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = achievements.filter((a) => {
    if (search && !a.title.includes(search) && !a.key.includes(search)) return false
    if (filterCat && a.category !== filterCat) return false
    return true
  })
  const totalPages = getTotalPages(filtered.length, pageSize)
  const pageItems = getPageItems(filtered, Math.min(page, totalPages), pageSize)

  useEffect(() => { setPage(1) }, [search, filterCat])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">成就定义管理</h1>
          <p className="text-sm text-muted-foreground">管理成就定义（里程碑、隐藏成就等）</p>
        </div>
        <AchievementCreateButton onCreated={load} />
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜索成就..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="w-40">
          <option value="">全部分类</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">成就列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Award className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                {search || filterCat ? '没有匹配的成就' : '暂无成就'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {search || filterCat ? '尝试调整筛选条件' : '新增后会显示在这里'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">成就</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">分类</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">解锁</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageItems.map((a) => (
                    <tr key={a.id} className={`transition-colors hover:bg-muted/30 ${a.isHidden ? 'opacity-70' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{a.title}</span>
                            <Badge className={RARITY_COLORS[a.rarity] ?? ''}>
                              {a.rarity ?? 'common'}
                            </Badge>
                            {a.isHidden && <Badge variant="secondary" className="text-[10px]">隐藏</Badge>}
                          </div>
                          <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">{a.description}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/60">{a.key}</p>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[a.category] ?? a.category}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        {a._count ? `${a._count.userAchievements} 位用户` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <AchievementEditButton achievement={a} onSaved={load} />
                          <Button size="icon" variant="ghost" className="size-8 text-destructive"
                            onClick={async () => { await deleteAchievementDef(a.id); load() }}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AdminPagination
            total={filtered.length}
            page={Math.min(page, totalPages)}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function AchievementCreateButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" /> 新增成就</Button>
      <AchievementDialog open={open} onClose={() => setOpen(false)} edit={null} onSaved={onCreated} />
    </>
  )
}

function AchievementEditButton({ achievement, onSaved }: { achievement: AchievementDef; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="icon" variant="ghost" className="size-8" onClick={() => setOpen(true)}>
        <Edit3 className="size-3.5" />
      </Button>
      <AchievementDialog open={open} onClose={() => setOpen(false)} edit={achievement} onSaved={onSaved} />
    </>
  )
}

function AchievementDialog({
  open, onClose, edit, onSaved,
}: {
  open: boolean; onClose: () => void; edit: AchievementDef | null; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) setForm(edit)
    else setForm({
      key: '', title: '', description: '',
      category: 'milestone', rarity: 'common',
      icon: '', rewardXp: 0, rewardTitle: '',
      sortOrder: 0, isHidden: false, hintText: '',
      condition: { type: 'recording_count', threshold: 1 },
    })
  }, [edit, open])

  const handleSave = async () => {
    if (!form.key?.trim() || !form.title?.trim()) return
    setSaving(true)
    try {
      if (edit) await updateAchievementDef(edit.id, form)
      else await createAchievementDef(form)
      toast.success('成就已保存')
      onSaved()
      onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑成就' : '新增成就'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Key（唯一标识）</Label>
              <Input value={form.key ?? ''} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="first_recording" />
            </div>
            <div>
              <Label>标题</Label>
              <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="初次开口" />
            </div>
          </div>
          <div>
            <Label>描述</Label>
            <Textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="完成第一次录音回答" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>分类</Label>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
            </div>
            <div>
              <Label>稀有度</Label>
              <Select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}>
                  <option value="common">普通 (灰色)</option>
                  <option value="rare">稀有 (蓝色)</option>
                  <option value="epic">史诗 (紫色)</option>
                  <option value="legendary">传说 (金色)</option>
                </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>图标 (lucide/emoji)</Label>
              <Input value={form.icon ?? ''} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Mic" />
            </div>
            <div>
              <Label>奖励 XP</Label>
              <Input type="number" value={form.rewardXp ?? 0}
                onChange={(e) => setForm({ ...form, rewardXp: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isHidden ?? false}
                onChange={(e) => setForm({ ...form, isHidden: e.target.checked })} />
              隐藏成就
            </label>
            {form.isHidden && (
              <div className="flex-1">
                <Label>隐藏提示</Label>
                <Input value={form.hintText ?? ''} onChange={(e) => setForm({ ...form, hintText: e.target.value })}
                  placeholder="在凌晨完成一次练习..." />
              </div>
            )}
          </div>
          <div>
            <Label>解锁条件 (JSON)</Label>
            <Textarea
              value={JSON.stringify(form.condition ?? {}, null, 2)}
              onChange={(e) => {
                try { setForm({ ...form, condition: JSON.parse(e.target.value) }) } catch {}
              }}
              rows={5}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              示例: {`{"type": "recording_count", "threshold": 1}`}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !form.key?.trim() || !form.title?.trim()}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
