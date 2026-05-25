import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Edit3, Search, Award, Trophy, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
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
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="w-40">
          <option value="">全部分类</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">暂无数据</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((a) => (
                <div key={a.id} className={`p-4 rounded-xl border hover:shadow-md transition-shadow ${
                  a.isHidden ? 'opacity-70' : ''
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={RARITY_COLORS[a.rarity] ?? ''}>
                      {a.rarity ?? 'common'}
                    </Badge>
                    <div className="flex gap-1">
                      <AchievementEditButton achievement={a} onSaved={load} />
                      <Button size="icon" variant="ghost" className="size-7 text-destructive"
                        onClick={async () => { await deleteAchievementDef(a.id); load() }}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm">{a.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[a.category] ?? a.category}</Badge>
                    <span>{a.key}</span>
                    {a.isHidden && <Badge variant="secondary" className="text-[10px]">隐藏</Badge>}
                  </div>
                  {a._count && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {a._count.userAchievements} 位用户解锁
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
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
      <Button size="icon" variant="ghost" className="size-7" onClick={() => setOpen(true)}>
        <Edit3 className="size-3" />
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
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
            </div>
            <div>
              <Label>稀有度</Label>
              <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}>
                  <option value="common">普通 (灰色)</option>
                  <option value="rare">稀有 (蓝色)</option>
                  <option value="epic">史诗 (紫色)</option>
                  <option value="legendary">传说 (金色)</option>
                </select>
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
