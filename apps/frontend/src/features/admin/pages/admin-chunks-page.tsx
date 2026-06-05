import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Edit3, Search, BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { AdminPagination, getPageItems, getTotalPages } from '../components/admin-pagination'
import { ChunkExamplesEditor } from '../components/content-authoring-fields'
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

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
  const totalPages = getTotalPages(filtered.length, pageSize)
  const pageItems = getPageItems(filtered, Math.min(page, totalPages), pageSize)

  useEffect(() => { setPage(1) }, [search])

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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chunk 列表</CardTitle>
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
              <BookOpen className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                {search ? '没有匹配的 Chunk' : '暂无 Chunk'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {search ? '尝试更换搜索关键词' : '新增后会显示在这里'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">表达</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">场景</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">学习人数</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageItems.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{c.text}</span>
                            <Badge variant="outline" className="text-xs">{c.difficulty}</Badge>
                            {c.category && <Badge variant="secondary" className="text-xs">{c.category}</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{c.meaning}</p>
                          {c.description && (
                            <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground/60">{c.description}</p>
                          )}
                          {c.examples?.[0] && (
                            <p className="mt-1 max-w-xl truncate text-xs italic text-muted-foreground/60">
                              {c.examples[0].en}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                        -
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        {c._count ? `${c._count.userProgresses} 位` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8"
                            onClick={() => { setEdit(c); setDialog(true) }}>
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8 text-destructive"
                            onClick={async () => { await deleteChunk(c.id); load() }}>
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
    if (edit) {
      setForm({
        ...edit,
        examples: edit.examples ?? [],
      })
    }
    else setForm({ text: '', meaning: '', description: '', difficulty: 'L2', category: '', examples: [] })
  }, [edit, open])

  const handleSave = async () => {
    if (!form.text?.trim() || !form.meaning?.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        examples: (form.examples ?? []).filter((item: any) => item.en?.trim() && item.zh?.trim()),
      }
      if (edit) await updateChunk(edit.id, payload)
      else await createChunk(payload)
      toast.success('Chunk 已保存')
      onSaved()
      onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-y-auto">
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
              <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                  {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </Select>
            </div>
            <div className="col-span-2">
              <Label>分类标签</Label>
              <Input value={form.category ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="宿舍入住 / 自我介绍" />
            </div>
          </div>
          <div>
            <MarkdownEditor
              label="讲解 / 使用说明"
              value={form.description ?? ''}
              onChange={(value) => setForm({ ...form, description: value })}
              height={160}
              preview="edit"
              placeholder="说明这个 Chunk 的使用场景、语气、常见搭配..."
            />
          </div>
          <ChunkExamplesEditor
            value={form.examples ?? []}
            onChange={(examples) => setForm({ ...form, examples })}
          />
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
