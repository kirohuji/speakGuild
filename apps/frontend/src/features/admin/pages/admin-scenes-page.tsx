import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Edit3, Search, Layers, MapPin,
  BookOpen, ChevronDown, ChevronRight, Save, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  listSceneCategories, createSceneCategory, updateSceneCategory, deleteSceneCategory,
  listScenes, getScene, createScene, updateScene, deleteScene,
  listVocabularies, createVocabulary, updateVocabulary, deleteVocabulary,
  listTrainingTopics, createTrainingTopic, updateTrainingTopic, deleteTrainingTopic,
  listAllChunks,
  type SceneCategory, type Scene, type SceneVocabulary, type TrainingTopic, type Chunk,
} from '../api-content-admin'

// ─── Category Dialog ────────────────────────────────────────

function CategoryDialog({
  open, onClose, edit, onSaved,
}: {
  open: boolean
  onClose: () => void
  edit: SceneCategory | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) { setName(edit.name); setIcon(edit.icon ?? '') }
    else { setName(''); setIcon('') }
  }, [edit, open])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (edit) await updateSceneCategory(edit.id, { name, icon })
      else await createSceneCategory({ name, icon })
      toast.success(edit ? '分类已更新' : '分类已创建')
      onSaved()
      onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{edit ? '编辑分类' : '新增分类'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="留学生活" />
          </div>
          <div>
            <Label>图标名 (lucide)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="GraduationCap" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Scene Dialog ───────────────────────────────────────────

function SceneDialog({
  open, onClose, edit, categories, onSaved,
}: {
  open: boolean
  onClose: () => void
  edit: Scene | null
  categories: SceneCategory[]
  onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) setForm(edit)
    else setForm({ categoryId: categories[0]?.id, requiredOutputLevel: 'L1', requiredUserLevel: 1 })
  }, [edit, open, categories])

  const handleSave = async () => {
    if (!form.title?.trim() || !form.categoryId) return
    setSaving(true)
    try {
      if (edit) await updateScene(edit.id, form)
      else await createScene(form)
      toast.success(edit ? '场景已更新' : '场景已创建')
      onSaved()
      onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑场景' : '新增场景'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>所属分类</Label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
          </div>
          <div>
            <Label>标题</Label>
            <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="宿舍入住" />
          </div>
          <div>
            <Label>地点</Label>
            <Input value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="宿舍前台" />
          </div>
          <div>
            <Label>描述</Label>
            <Textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>输出等级要求</Label>
              <select value={form.requiredOutputLevel} onChange={(e) => setForm({ ...form, requiredOutputLevel: e.target.value })}>
                  {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
            </div>
            <div>
              <Label>用户等级要求</Label>
              <Input type="number" min={1} value={form.requiredUserLevel ?? 1}
                onChange={(e) => setForm({ ...form, requiredUserLevel: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !form.title?.trim()}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Vocabulary Dialog ──────────────────────────────────────

function VocabularyDialog({
  open, onClose, edit, sceneId, onSaved,
}: {
  open: boolean
  onClose: () => void
  edit: SceneVocabulary | null
  sceneId: string
  onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) setForm(edit)
    else setForm({ sceneId, word: '', meaning: '', sortOrder: 0 })
  }, [edit, open, sceneId])

  const handleSave = async () => {
    if (!form.word?.trim() || !form.meaning?.trim()) return
    setSaving(true)
    try {
      if (edit) await updateVocabulary(edit.id, form)
      else await createVocabulary(form)
      toast.success('词汇已保存')
      onSaved()
      onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{edit ? '编辑词汇' : '新增词汇'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>英文</Label>
            <Input value={form.word ?? ''} onChange={(e) => setForm({ ...form, word: e.target.value })} placeholder="dormitory" />
          </div>
          <div>
            <Label>中文含义</Label>
            <Input value={form.meaning ?? ''} onChange={(e) => setForm({ ...form, meaning: e.target.value })} placeholder="宿舍" />
          </div>
          <div>
            <Label>排序</Label>
            <Input type="number" value={form.sortOrder ?? 0}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Training Topic Dialog ──────────────────────────────────

function TrainingTopicDialog({
  open, onClose, edit, sceneId, chunks, onSaved,
}: {
  open: boolean
  onClose: () => void
  edit: TrainingTopic | null
  sceneId: string
  chunks: Chunk[]
  onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) setForm({ ...edit, chunkIds: edit.activeChunks?.map((ac: any) => ac.chunk.id) ?? [] })
    else setForm({ sceneId, title: '', promptEn: '', promptZh: '', difficulty: 'L2', suggestedDurationSec: 60, chunkIds: [] })
  }, [edit, open, sceneId])

  const handleSave = async () => {
    if (!form.title?.trim() || !form.promptEn?.trim()) return
    setSaving(true)
    try {
      if (edit) await updateTrainingTopic(edit.id, form)
      else await createTrainingTopic(form)
      toast.success('话题已保存')
      onSaved()
      onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑话题' : '新增话题'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>标题</Label>
            <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="自我介绍" />
          </div>
          <div>
            <Label>英文提示</Label>
            <Textarea value={form.promptEn ?? ''} onChange={(e) => setForm({ ...form, promptEn: e.target.value })} placeholder="Tell me about yourself." />
          </div>
          <div>
            <Label>中文提示</Label>
            <Textarea value={form.promptZh ?? ''} onChange={(e) => setForm({ ...form, promptZh: e.target.value })} placeholder="请介绍一下你自己。" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>难度</Label>
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                  {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
            </div>
            <div>
              <Label>建议时长 (秒)</Label>
              <Input type="number" value={form.suggestedDurationSec ?? 60}
                onChange={(e) => setForm({ ...form, suggestedDurationSec: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>句型骨架</Label>
            <Textarea value={form.sentenceSkeleton ?? ''} onChange={(e) => setForm({ ...form, sentenceSkeleton: e.target.value })}
              placeholder="I'm from ___. It's a ___ city in ___." />
          </div>
          <div>
            <Label>关联 Chunk（可多选）</Label>
            <div className="flex flex-wrap gap-1.5 border rounded-lg p-3 max-h-40 overflow-y-auto">
              {chunks.filter((c) => !c.sceneId || c.sceneId === sceneId).map((c) => (
                <Badge key={c.id}
                  variant={form.chunkIds?.includes(c.id) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    const ids = form.chunkIds ?? []
                    setForm({
                      ...form,
                      chunkIds: ids.includes(c.id) ? ids.filter((i: string) => i !== c.id) : [...ids, c.id],
                    })
                  }}
                >
                  {c.text}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Scene Detail View ──────────────────────────────────────

function SceneDetailView({ sceneId, onBack, chunks }: { sceneId: string; onBack: () => void; chunks: Chunk[] }) {
  const [scene, setScene] = useState<Scene | null>(null)
  const [vocabs, setVocabs] = useState<SceneVocabulary[]>([])
  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [loading, setLoading] = useState(true)

  const [vocabDialog, setVocabDialog] = useState(false)
  const [editVocab, setEditVocab] = useState<SceneVocabulary | null>(null)
  const [topicDialog, setTopicDialog] = useState(false)
  const [editTopic, setEditTopic] = useState<TrainingTopic | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [s, v, t] = await Promise.all([
        getScene(sceneId), listVocabularies(sceneId), listTrainingTopics(sceneId),
      ])
      setScene(s); setVocabs(v); setTopics(t)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [sceneId])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!scene) return <p className="text-muted-foreground py-8 text-center">场景未找到</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ChevronRight className="size-4 rotate-180" /></Button>
        <div>
          <h2 className="text-lg font-bold">{scene.title}</h2>
          <p className="text-sm text-muted-foreground">{scene.location} · {scene.requiredOutputLevel}</p>
        </div>
      </div>

      {/* Vocabulary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="size-4" /> 场景词汇 ({vocabs.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setEditVocab(null); setVocabDialog(true) }}>
            <Plus className="size-3.5 mr-1" /> 添加
          </Button>
        </CardHeader>
        <CardContent>
          {vocabs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">暂无词汇</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {vocabs.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50">
                  <div>
                    <span className="text-sm font-medium">{v.word}</span>
                    <span className="text-xs text-muted-foreground ml-2">{v.meaning}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="size-7"
                      onClick={() => { setEditVocab(v); setVocabDialog(true) }}>
                      <Edit3 className="size-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive"
                      onClick={async () => { await deleteVocabulary(v.id); load() }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training Topics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="size-4" /> 训练话题 ({topics.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setEditTopic(null); setTopicDialog(true) }}>
            <Plus className="size-3.5 mr-1" /> 添加
          </Button>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">暂无话题</p>
          ) : (
            <div className="space-y-2">
              {topics.map((t) => (
                <div key={t.id} className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t.title}</span>
                      <Badge variant="outline" className="text-xs">{t.difficulty}</Badge>
                      <Badge variant="secondary" className="text-xs">{t.suggestedDurationSec}s</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{t.promptEn}</p>
                    {t.activeChunks && t.activeChunks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.activeChunks.map((ac: any) => (
                          <Badge key={ac.id} variant="outline" className="text-[10px]">{ac.chunk.text}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button size="icon" variant="ghost" className="size-7"
                      onClick={() => { setEditTopic(t); setTopicDialog(true) }}>
                      <Edit3 className="size-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive"
                      onClick={async () => { await deleteTrainingTopic(t.id); load() }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <VocabularyDialog open={vocabDialog} onClose={() => setVocabDialog(false)}
        edit={editVocab} sceneId={sceneId} onSaved={load} />
      <TrainingTopicDialog open={topicDialog} onClose={() => setTopicDialog(false)}
        edit={editTopic} sceneId={sceneId} chunks={chunks} onSaved={load} />
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────

export function AdminScenesPage() {
  const [categories, setCategories] = useState<SceneCategory[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [detailSceneId, setDetailSceneId] = useState<string | null>(null)

  const [catDialog, setCatDialog] = useState(false)
  const [editCat, setEditCat] = useState<SceneCategory | null>(null)
  const [sceneDialog, setSceneDialog] = useState(false)
  const [editScene, setEditScene] = useState<Scene | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [cats, scns, chks] = await Promise.all([
        listSceneCategories(), listScenes(selectedCat ?? undefined), listAllChunks(),
      ])
      setCategories(cats); setScenes(scns); setChunks(chks)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [selectedCat])

  if (detailSceneId) {
    return (
      <div className="space-y-4">
        <SceneDetailView sceneId={detailSceneId} onBack={() => setDetailSceneId(null)} chunks={chunks} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">场景管理</h1>
          <p className="text-sm text-muted-foreground">管理场景分类、场景、词汇和训练话题</p>
        </div>
        <Button onClick={() => { setEditCat(null); setCatDialog(true) }}>
          <Plus className="size-4 mr-1" /> 新增分类
        </Button>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">场景分类</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant={!selectedCat ? 'default' : 'outline'}
              className="cursor-pointer" onClick={() => setSelectedCat(null)}>
              全部
            </Badge>
            {categories.map((c) => (
              <Badge key={c.id} variant={selectedCat === c.id ? 'default' : 'outline'}
                className="cursor-pointer flex items-center gap-1"
                onClick={() => setSelectedCat(c.id)}>
                {c.name}
                <span className="text-xs opacity-60">({c._count?.scenes ?? 0})</span>
                <button className="ml-1 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setEditCat(c); setCatDialog(true) }}>
                  <Edit3 className="size-2.5" />
                </button>
                <button className="hover:text-destructive"
                  onClick={async (e) => { e.stopPropagation(); if (confirm('确认删除？')) { await deleteSceneCategory(c.id); load() } }}>
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scenes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="size-4" /> 场景列表 ({scenes.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setEditScene(null); setSceneDialog(true) }}>
            <Plus className="size-3.5 mr-1" /> 新增场景
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : scenes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">暂无场景</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scenes.map((s) => (
                <div key={s.id}
                  className="p-4 rounded-xl border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setDetailSceneId(s.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="text-xs">{s.requiredOutputLevel}</Badge>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="size-7"
                        onClick={(e) => { e.stopPropagation(); setEditScene(s); setSceneDialog(true) }}>
                        <Edit3 className="size-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 text-destructive"
                        onClick={async (e) => { e.stopPropagation(); await deleteScene(s.id); load() }}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm">{s.title}</h3>
                  <p className="text-xs text-muted-foreground">{s.location}</p>
                  <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                    <span>词汇 {s._count?.vocabularies ?? 0}</span>
                    <span>Chunk {s._count?.chunks ?? 0}</span>
                    <span>话题 {s._count?.trainingTopics ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CategoryDialog open={catDialog} onClose={() => setCatDialog(false)}
        edit={editCat} onSaved={load} />
      <SceneDialog open={sceneDialog} onClose={() => setSceneDialog(false)}
        edit={editScene} categories={categories} onSaved={load} />
    </div>
  )
}
