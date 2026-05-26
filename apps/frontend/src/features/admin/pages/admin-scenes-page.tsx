import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Edit3, Search, Layers, MapPin,
  BookOpen, ChevronRight, X,
  Volume2, Sparkles, ExternalLink, Loader2,
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
import {
  lookupWord, getBestPhonetic, getFirstAudio,
  type DictEntry,
} from '@/lib/dictionary-api'
import { enrichWord, type WordEnrichmentResult } from '@/lib/practice-ai-api'
import { AdminPagination, getPageItems, getTotalPages } from '../components/admin-pagination'
import {
  ChunkMultiSelect,
  SentencePatternEditor,
} from '../components/content-authoring-fields'
import {
  listSceneCategories, createSceneCategory, updateSceneCategory, deleteSceneCategory,
  listScenes, getScene, createScene, updateScene, deleteScene,
  listVocabularies, createVocabulary, updateVocabulary, deleteVocabulary,
  listTrainingTopics, createTrainingTopic, updateTrainingTopic, deleteTrainingTopic,
  listAllChunks, listStories,
  type SceneCategory, type Scene, type SceneVocabulary, type TrainingTopic, type Chunk, type StoryData,
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
      <DialogContent className="sm:max-w-lg">
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
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑场景' : '新增场景'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>所属分类</Label>
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
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
            <MarkdownEditor
              label="描述"
              value={form.description ?? ''}
              onChange={(value) => setForm({ ...form, description: value })}
              height={160}
              preview="edit"
              placeholder="这个场景面向什么任务、用户会遇到什么情境..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>输出等级要求</Label>
              <Select value={form.requiredOutputLevel} onChange={(e) => setForm({ ...form, requiredOutputLevel: e.target.value })}>
                  {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </Select>
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
  const [dictData, setDictData] = useState<DictEntry[] | null>(null)
  const [enrichData, setEnrichData] = useState<WordEnrichmentResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')

  useEffect(() => {
    if (edit) setForm(edit)
    else setForm({ sceneId, word: '', meaning: '', sortOrder: 0 })
    setDictData(null)
    setEnrichData(null)
    setLookupError('')
  }, [edit, open, sceneId])

  const handleLookup = async () => {
    const word = form.word?.trim()
    if (!word) return
    setLookupLoading(true)
    setLookupError('')
    try {
      const dict = await lookupWord(word)
      setDictData(dict)
      const summary = dict
        ? dict.flatMap((entry) => entry.meanings).slice(0, 3)
            .map((meaning) => `${meaning.partOfSpeech}: ${meaning.definitions[0]?.definition ?? ''}`)
            .join(' | ')
        : undefined
      const enriched = await enrichWord(word, summary)
      setEnrichData(enriched)
      if (!form.meaning?.trim() && enriched.chineseTranslation) {
        setForm((prev: any) => ({ ...prev, meaning: enriched.chineseTranslation }))
      }
    } catch (e: any) {
      setLookupError(e?.message ?? '查词失败')
      setDictData(null)
      setEnrichData(null)
    } finally {
      setLookupLoading(false)
    }
  }

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
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑词汇' : '新增词汇'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>英文</Label>
            <div className="flex gap-2">
              <Input value={form.word ?? ''} onChange={(e) => setForm({ ...form, word: e.target.value })} placeholder="dormitory" />
              <Button type="button" variant="outline" onClick={handleLookup} disabled={lookupLoading || !form.word?.trim()}>
                {lookupLoading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Sparkles className="mr-1.5 size-3.5" />}
                查词
              </Button>
            </div>
          </div>
          <div>
            <Label>中文含义</Label>
            <Input value={form.meaning ?? ''} onChange={(e) => setForm({ ...form, meaning: e.target.value })} placeholder="宿舍" />
          </div>
          <div>
            <MarkdownEditor
              label="词汇讲解"
              value={form.description ?? ''}
              onChange={(value) => setForm({ ...form, description: value })}
              height={140}
              preview="edit"
              placeholder="用法、搭配、易错点，可选..."
            />
          </div>
          {(lookupLoading || lookupError || dictData || enrichData) && (
            <VocabularyLookupPreview
              loading={lookupLoading}
              error={lookupError}
              dictData={dictData}
              enrichData={enrichData}
              onUseMeaning={(meaning) => setForm({ ...form, meaning })}
            />
          )}
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

function VocabularyLookupPreview({
  loading,
  error,
  dictData,
  enrichData,
  onUseMeaning,
}: {
  loading: boolean
  error: string
  dictData: DictEntry[] | null
  enrichData: WordEnrichmentResult | null
  onUseMeaning: (meaning: string) => void
}) {
  const mainEntry = dictData?.[0]
  const phonetic = mainEntry ? getBestPhonetic(mainEntry) : null
  const audioUrl = mainEntry ? getFirstAudio(mainEntry.phonetics) : null
  const firstMeaning = mainEntry?.meanings[0]
  const firstDefinition = firstMeaning?.definitions[0]

  const playAudio = () => {
    if (!audioUrl) return
    const audio = new Audio(audioUrl.startsWith('//') ? `https:${audioUrl}` : audioUrl)
    audio.play().catch(() => {})
  }

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!mainEntry && !enrichData) return null

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{mainEntry?.word}</span>
          {phonetic && <span className="rounded-md bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground">{phonetic}</span>}
          {firstMeaning && <Badge variant="outline" className="text-[10px]">{firstMeaning.partOfSpeech}</Badge>}
        </div>
        {audioUrl && (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={playAudio}>
            <Volume2 className="mr-1 size-3.5" />
            发音
          </Button>
        )}
      </div>

      {enrichData?.chineseTranslation && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-background/70 px-3 py-2">
          <div>
            <p className="text-xs text-muted-foreground">AI 中文释义</p>
            <p className="text-sm font-medium">{enrichData.chineseTranslation}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => onUseMeaning(enrichData.chineseTranslation)}>
            使用
          </Button>
        </div>
      )}

      {firstDefinition && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">词典释义</p>
          <p className="text-sm leading-relaxed">{firstDefinition.definition}</p>
          {firstDefinition.example && (
            <p className="text-xs italic text-muted-foreground">{firstDefinition.example}</p>
          )}
        </div>
      )}

      {enrichData?.examples?.length ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">AI 例句预览</p>
          <div className="rounded-md bg-background/70 px-3 py-2">
            <p className="text-sm">{enrichData.examples[0].en}</p>
            <p className="mt-1 text-xs text-muted-foreground">{enrichData.examples[0].zh}</p>
          </div>
        </div>
      ) : null}

      {mainEntry?.sourceUrls?.[0] && (
        <a
          href={mainEntry.sourceUrls[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          <ExternalLink className="size-3" />
          查看完整词条
        </a>
      )}
    </div>
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
  const [stories, setStories] = useState<StoryData[]>([])

  useEffect(() => {
    if (edit) setForm({ ...edit, chunkIds: edit.activeChunks?.map((ac: any) => ac.chunk.id) ?? [] })
    else setForm({ sceneId, title: '', description: '', promptEn: '', promptZh: '', difficulty: 'L2', suggestedDurationSec: 60, chunkIds: [], sentencePatterns: [], inkScriptId: '' })
  }, [edit, open, sceneId])

  // Load stories for binding
  useEffect(() => {
    if (open) {
      listStories().then(setStories).catch(() => {})
    }
  }, [open])

  const handleSave = async () => {
    if (!form.title?.trim() || !form.promptEn?.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        sentencePatterns: (form.sentencePatterns ?? []).filter((item: any) => item.pattern?.trim()),
      }
      if (edit) await updateTrainingTopic(edit.id, payload)
      else await createTrainingTopic(payload)
      toast.success('话题已保存')
      onSaved()
      onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑话题' : '新增话题'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>标题</Label>
            <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="自我介绍" />
          </div>
          <div>
            <MarkdownEditor
              label="话题说明"
              value={form.description ?? ''}
              onChange={(value) => setForm({ ...form, description: value })}
              height={140}
              preview="edit"
              placeholder="这个话题训练什么能力、回答时要注意什么..."
            />
          </div>
          <div>
            <MarkdownEditor
              label="英文提示"
              value={form.promptEn ?? ''}
              onChange={(value) => setForm({ ...form, promptEn: value })}
              height={160}
              preview="edit"
              placeholder="Tell me about yourself."
            />
          </div>
          <div>
            <MarkdownEditor
              label="中文提示"
              value={form.promptZh ?? ''}
              onChange={(value) => setForm({ ...form, promptZh: value })}
              height={160}
              preview="edit"
              placeholder="请介绍一下你自己。"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>难度</Label>
              <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                  {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </Select>
            </div>
            <div>
              <Label>建议时长 (秒)</Label>
              <Input type="number" value={form.suggestedDurationSec ?? 60}
                onChange={(e) => setForm({ ...form, suggestedDurationSec: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>绑定 Ink 故事脚本</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.inkScriptId ?? ''}
              onChange={(e) => setForm({ ...form, inkScriptId: e.target.value || null })}
            >
              <option value="">不绑定（使用默认 AI 对话模式）</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.key}) — {s.scriptType === 'practice' ? '练习' : s.scriptType === 'episode' ? '关卡' : s.scriptType}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              绑定后，用户练习该话题时将使用此 Ink 脚本驱动对话流程。在 NQTR 内容工坊中创建和管理故事脚本。
            </p>
          </div>
          <div>
            <SentencePatternEditor
              value={form.sentencePatterns ?? []}
              onChange={(sentencePatterns) => setForm({
                ...form,
                sentencePatterns,
                sentenceSkeleton: sentencePatterns
                  .filter((item: any) => item.pattern?.trim())
                  .map((item: any) => `- ${item.pattern}${item.meaning ? ` (${item.meaning})` : ''}`)
                  .join('\n'),
              })}
            />
          </div>
          <ChunkMultiSelect
            chunks={chunks}
            value={form.chunkIds ?? []}
            sceneId={sceneId}
            onChange={(chunkIds) => setForm({ ...form, chunkIds })}
          />
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
  const [vocabPage, setVocabPage] = useState(1)
  const [vocabPageSize, setVocabPageSize] = useState(10)
  const [topicPage, setTopicPage] = useState(1)
  const [topicPageSize, setTopicPageSize] = useState(10)

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
  useEffect(() => {
    setVocabPage(1)
    setTopicPage(1)
  }, [sceneId])

  const vocabTotalPages = getTotalPages(vocabs.length, vocabPageSize)
  const topicTotalPages = getTotalPages(topics.length, topicPageSize)
  const vocabItems = getPageItems(vocabs, Math.min(vocabPage, vocabTotalPages), vocabPageSize)
  const topicItems = getPageItems(topics, Math.min(topicPage, topicTotalPages), topicPageSize)

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  )
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
        <CardContent className="p-0">
          {vocabs.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground">暂无词汇</p>
              <p className="mt-1 text-xs text-muted-foreground/60">添加后会显示在这里</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">词汇</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">含义</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">排序</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vocabItems.map((v) => (
                    <tr key={v.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium">{v.word}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{v.meaning}</td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground sm:table-cell">{v.sortOrder}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8"
                            onClick={() => { setEditVocab(v); setVocabDialog(true) }}>
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8 text-destructive"
                            onClick={async () => { await deleteVocabulary(v.id); load() }}>
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
            total={vocabs.length}
            page={Math.min(vocabPage, vocabTotalPages)}
            pageSize={vocabPageSize}
            onPageChange={setVocabPage}
            onPageSizeChange={(size) => { setVocabPageSize(size); setVocabPage(1) }}
          />
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
        <CardContent className="p-0">
          {topics.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground">暂无话题</p>
              <p className="mt-1 text-xs text-muted-foreground/60">添加后会显示在这里</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">话题</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Chunk</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">配置</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topicItems.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{t.title}</span>
                            <Badge variant="outline" className="text-xs">{t.difficulty}</Badge>
                            <Badge variant="secondary" className="text-xs">{t.suggestedDurationSec}s</Badge>
                          </div>
                          <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">{t.promptEn}</p>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {(t.activeChunks ?? []).slice(0, 3).map((ac: any) => (
                            <Badge key={ac.id} variant="outline" className="text-[10px]">{ac.chunk.text}</Badge>
                          ))}
                          {(t.activeChunks?.length ?? 0) > 3 && (
                            <Badge variant="secondary" className="text-[10px]">+{(t.activeChunks?.length ?? 0) - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        排序 {t.sortOrder}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8"
                            onClick={() => { setEditTopic(t); setTopicDialog(true) }}>
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8 text-destructive"
                            onClick={async () => { await deleteTrainingTopic(t.id); load() }}>
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
            total={topics.length}
            page={Math.min(topicPage, topicTotalPages)}
            pageSize={topicPageSize}
            onPageChange={setTopicPage}
            onPageSizeChange={(size) => { setTopicPageSize(size); setTopicPage(1) }}
          />
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

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
  useEffect(() => { setPage(1) }, [selectedCat])

  const totalPages = getTotalPages(scenes.length, pageSize)
  const pageItems = getPageItems(scenes, Math.min(page, totalPages), pageSize)

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
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : scenes.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">暂无场景</p>
              <p className="mt-1 text-xs text-muted-foreground/60">新增后会显示在这里</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">场景</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">要求</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">内容量</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageItems.map((s) => (
                    <tr
                      key={s.id}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => setDetailSceneId(s.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{s.title}</span>
                            {s.category && <Badge variant="secondary" className="text-xs">{s.category.name}</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{s.location || '未设置地点'}</p>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{s.requiredOutputLevel}</Badge>
                          <span className="text-xs text-muted-foreground">Lv.{s.requiredUserLevel}</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        词汇 {s._count?.vocabularies ?? 0} · Chunk {s._count?.chunks ?? 0} · 话题 {s._count?.trainingTopics ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8"
                            onClick={(e) => { e.stopPropagation(); setEditScene(s); setSceneDialog(true) }}>
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8 text-destructive"
                            onClick={async (e) => { e.stopPropagation(); await deleteScene(s.id); load() }}>
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
            total={scenes.length}
            page={Math.min(page, totalPages)}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          />
        </CardContent>
      </Card>

      <CategoryDialog open={catDialog} onClose={() => setCatDialog(false)}
        edit={editCat} onSaved={load} />
      <SceneDialog open={sceneDialog} onClose={() => setSceneDialog(false)}
        edit={editScene} categories={categories} onSaved={load} />
    </div>
  )
}
