import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Edit3, Search, BookOpen,
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
  listAllChunks, createChunk, updateChunk, deleteChunk,
  listSceneCategories, listScenes,
  type Chunk, type SceneCategory, type Scene,
} from '../api-content-admin'

export function AdminChunksPage() {
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [categories, setCategories] = useState<SceneCategory[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [dialog, setDialog] = useState(false)
  const [edit, setEdit] = useState<Chunk | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [chks, cats] = await Promise.all([listAllChunks(), listSceneCategories()])
      setChunks(chks); setCategories(cats)
      const allScenes = await listScenes()
      setScenes(allScenes)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = chunks.filter((c) =>
    !search || c.text.toLowerCase().includes(search.toLowerCase()) || c.meaning.includes(search)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chunk 管理</h1>
          <p className="text-sm text-muted-foreground">管理核心表达块（Chunk）</p>
        </div>
        <Button onClick={() => { setEdit(null); setDialog(true) }}>
          <Plus className="size-4 mr-1" /> 新增 Chunk
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="搜索 Chunk..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{c.text}</span>
                      <Badge variant="outline" className="text-xs">{c.difficulty}</Badge>
                      {c.category && <Badge variant="secondary" className="text-xs">{c.category}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.meaning}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {c.scene && <span className="text-[11px] text-muted-foreground/60">{c.scene.title}</span>}
                      {c._count && (
                        <span className="text-[11px] text-muted-foreground/60">
                          {c._count.userProgresses} 位用户在学习
                        </span>
                      )}
                    </div>
                    {c.example && (
                      <p className="text-xs text-muted-foreground/60 mt-1 italic truncate">{c.example}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button size="icon" variant="ghost" className="size-7"
                      onClick={() => { setEdit(c); setDialog(true) }}>
                      <Edit3 className="size-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive"
                      onClick={async () => { await deleteChunk(c.id); load() }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ChunkDialog open={dialog} onClose={() => setDialog(false)}
        edit={edit} categories={categories} scenes={scenes} onSaved={load} />
    </div>
  )
}

function ChunkDialog({
  open, onClose, edit, categories, scenes, onSaved,
}: {
  open: boolean; onClose: () => void; edit: Chunk | null
  categories: SceneCategory[]; scenes: Scene[]; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) setForm(edit)
    else setForm({ text: '', meaning: '', difficulty: 'L2', category: '', applicableSceneIds: [] })
  }, [edit, open])

  const handleSave = async () => {
    if (!form.text?.trim() || !form.meaning?.trim()) return
    setSaving(true)
    try {
      if (edit) await updateChunk(edit.id, form)
      else await createChunk(form)
      toast.success('Chunk 已保存')
      onSaved()
      onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑 Chunk' : '新增 Chunk'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>英文表达</Label>
            <Input value={form.text ?? ''} onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="I'm here to check in." />
          </div>
          <div>
            <Label>中文含义</Label>
            <Input value={form.meaning ?? ''} onChange={(e) => setForm({ ...form, meaning: e.target.value })}
              placeholder="我是来办理入住的。" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>难度</Label>
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                  {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
            </div>
            <div className="col-span-2">
              <Label>分类标签</Label>
              <Input value={form.category ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="宿舍入住 / 自我介绍" />
            </div>
          </div>
          <div>
            <Label>关联场景</Label>
            <select value={form.sceneId ?? ''} onChange={(e) => setForm({ ...form, sceneId: e.target.value || null })}>
                <option value="">不关联场景</option>
                {categories.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    {scenes.filter((s) => s.categoryId === cat.id).map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
          </div>
          <div>
            <Label>示例句子</Label>
            <Textarea value={form.example ?? ''} onChange={(e) => setForm({ ...form, example: e.target.value })}
              placeholder="Hi, I'm here to check in. My booking is under the name Li." />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !form.text?.trim() || !form.meaning?.trim()}>
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
