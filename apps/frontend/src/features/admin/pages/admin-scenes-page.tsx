import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Trash2, Edit3, Search, Layers, MapPin,
  ChevronRight, X, Code2, Type, BookOpen,
  Volume2, Sparkles, ExternalLink, Loader2,
  CheckCircle2, Link2, Clock3, FileText, Settings2,
  Film, Target, Dumbbell, Upload, Download, FileArchive, RefreshCw, ClipboardCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { FileUploadField } from '@/features/admin/components/file-upload-field'
import {
  lookupWord, getBestPhonetic, getFirstAudio,
  type DictEntry,
} from '@/lib/dictionary-api'
import { enrichWord, type WordEnrichmentResult } from '@/lib/practice-ai-api'
import { AdminPagination, getPageItems, getTotalPages } from '../components/admin-pagination'
import {
  SearchSelectTable,
  type SearchSelectColumn,
} from '../components/content-authoring-fields'
import {
  listSceneCategories, createSceneCategory, updateSceneCategory, deleteSceneCategory,
  listScenes, getScene, createScene, updateScene, deleteScene,
  listVocabularies, createVocabulary, updateVocabulary, deleteVocabulary,
  listTrainingTopics, createTrainingTopic, updateTrainingTopic, deleteTrainingTopic,
  getTrainingTopic, listAllChunks, listStories, getStory, listScriptEpisodes, deleteScriptEpisode,
  listLibraryPatterns, createLibraryPattern, createLibraryChunk, generateTopicTeachingMarkdown,
  suggestTopicSupports, suggestTopicVocabs,
  enqueueWarmupPipelineGeneration,
  enqueueSceneTopicBatchGeneration,
  type SceneCategory, type Scene, type Vocabulary, type TrainingTopic, type Chunk, type StoryData, type SentencePatternFull, type StoryEpisode,
  type TopicClaimConflict, type SuggestedTopicSupportItem, type SuggestedVocabItem, type TopicSupportKind,
} from '../api-content-admin'
import { EpisodeEditDialog } from './admin-script-page'
import { WarmupPipelineTab, buildWarmupMaterialUsage, type WarmupPipelineData } from '../components/warmup-pipeline-tab'
import { packageDataAdminApi } from '../api-package-data'
import { ContentExperiencePanel } from '../components/content-experience-panel'
import { TopicExperienceFields } from '../components/topic-experience-fields'
import { LearningPackageQualityDialog } from '../components/learning-package-quality-dialog'
import { contentExperienceAdminApi, type PackageGroup } from '../api-content-experiences'

function packageTypeLabel(type?: Scene['packageType']) {
  if (type === 'exam') return '考试'
  if (type === 'story') return '故事'
  if (type === 'course') return '课程'
  if (type === 'foundation') return '零基础'
  return '日常'
}

function kindLabel(kind: TopicClaimConflict['kind']) {
  if (kind === 'vocab') return '单词'
  if (kind === 'chunk') return '句块'
  return '句型'
}

function contentModeLabel(mode?: Scene['contentMode']) {
  if (mode === 'writing') return '写作'
  if (mode === 'reading') return '阅读'
  if (mode === 'listening') return '听力'
  if (mode === 'novel') return '小说'
  if (mode === 'story') return '剧情'
  return '知识点练习'
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function serializeTrainingTopicForm(form: Record<string, any>) {
  const payload = { ...form }
  delete payload.sentencePatterns
  if (payload.metadata?.outputTraining?.materialUsage?.generatedAt) {
    payload.metadata = {
      ...payload.metadata,
      outputTraining: {
        ...payload.metadata.outputTraining,
        materialUsage: {
          ...payload.metadata.outputTraining.materialUsage,
          generatedAt: '__ignored__',
        },
      },
    }
  }
  return stableStringify(payload)
}

function mergeById<T extends { id: string }>(...groups: Array<Array<T | null | undefined> | null | undefined>) {
  const map = new Map<string, T>()
  groups.flatMap((group) => group ?? []).forEach((item) => {
    if (item?.id && !map.has(item.id)) map.set(item.id, item)
  })
  return [...map.values()]
}

function normalizeTopicPattern(item: any): SentencePatternFull | null {
  const pattern = (item as any)?.pattern
  if (!pattern?.id) return null
  return {
    id: pattern.id,
    pattern: pattern.pattern,
    meaning: pattern.meaning ?? null,
    category: pattern.category ?? null,
    description: pattern.description ?? null,
    slots: pattern.slots,
    examples: pattern.examples,
    difficulty: pattern.difficulty ?? 'L1',
    createdAt: pattern.createdAt ?? '',
    updatedAt: pattern.updatedAt ?? '',
  }
}

async function listAllLibraryPatternsForAdmin() {
  const first = await listLibraryPatterns({ page: 1, pageSize: 100 })
  if (first.totalPages <= 1) return first.items
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      listLibraryPatterns({ page: index + 2, pageSize: 100 }).then((result) => result.items),
    ),
  )
  return [...first.items, ...rest.flat()]
}

const PACKAGE_TYPE_FILTERS: Array<{ id: Scene['packageType']; label: string }> = [
  { id: 'daily', label: '日常' },
  { id: 'exam', label: '考试' },
  { id: 'course', label: '课程' },
  { id: 'foundation', label: '零基础' },
]

type PackageTypeFilter = Scene['packageType'] | 'all'

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
          <DialogDescription className="sr-only">
            {edit ? '修改分类名称和图标。' : '创建一个新的学习包分类。'}
          </DialogDescription>
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
    else setForm({ categoryId: categories[0]?.id, packageType: 'daily', contentMode: 'practice', requiredOutputLevel: 'L1', requiredUserLevel: 1 })
  }, [edit, open, categories])

  const handleSave = async () => {
    if (!form.title?.trim() || !form.categoryId) return
    setSaving(true)
    try {
      if (edit) await updateScene(edit.id, form)
      else await createScene(form)
      toast.success(edit ? '学习包已更新' : '学习包已创建')
      onSaved()
      onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑学习包' : '新增学习包'}</DialogTitle>
          <DialogDescription className="sr-only">
            {edit ? '修改学习包的标题、分类、类型和其他配置。' : '创建一个新的学习包。'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>所属分类</Label>
              <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
            </div>
            <div>
              <Label>学习包类型</Label>
              <Select value={form.packageType ?? 'daily'} onChange={(e) => setForm({ ...form, packageType: e.target.value })}>
                <option value="daily">日常练习</option>
                <option value="exam">考试专项</option>
                <option value="course">付费课程</option>
                <option value="foundation">零基础</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>内容体验</Label>
            <Select value={form.contentMode ?? 'practice'} onChange={(e) => setForm({ ...form, contentMode: e.target.value })}>
              <option value="practice">知识点练习</option>
              <option value="writing">写作包</option>
              <option value="reading">阅读包</option>
              <option value="listening">听力包</option>
              <option value="novel">小说包（EPUB）</option>
              <option value="story">剧情包</option>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">决定话题题型和用户端主交互；日常、考试、课程等分类仍保留。</p>
          </div>
          <div>
            <Label>标题</Label>
            <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="宿舍入住" />
          </div>
          <div>
            <MarkdownEditor
              label="描述"
              value={form.description ?? ''}
              onChange={(value) => setForm({ ...form, description: value })}
              height={160}
              preview="edit"
              placeholder="这个学习包面向什么任务、用户会遇到什么情境..."
            />
          </div>
          <div>
            <Label>封面图片</Label>
            <FileUploadField
              value={form.coverImage ?? ''}
              onChange={(url) => setForm({ ...form, coverImage: url })}
              accept="image/*"
              uploadLabel="上传封面"
              placeholder="输入封面图片 URL 或点击上传"
              previewSize="lg"
              group="scene_cover"
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
  edit: Vocabulary | null
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
          <DialogDescription className="sr-only">
            {edit ? '修改词汇的英文、中文释义和讲解。' : '添加一个新词汇到词汇库。'}
          </DialogDescription>
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
          {phonetic && <span className="rounded-md bg-background px-2 py-0.5 font-ipa text-xs text-muted-foreground">{phonetic}</span>}
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

function TopicSupportSuggestionPanel({
  kind,
  summary,
  items,
  selectedIds,
  addingId,
  onAdd,
  onClose,
}: {
  kind: TopicSupportKind
  summary: string
  items: SuggestedTopicSupportItem[]
  selectedIds: string[]
  addingId: string | null
  onAdd: (item: SuggestedTopicSupportItem) => void
  onClose: () => void
}) {
  const label = kind === 'pattern' ? '句型' : 'Chunk'
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border/70 bg-background">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">教学支架审查 · {label}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{summary}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 text-[10px] text-muted-foreground" onClick={onClose}>收起</Button>
      </div>
      {items.length ? (
        <div className="max-h-56 divide-y divide-border/60 overflow-y-auto">
          {items.map((item) => {
            const added = selectedIds.includes(item.materialId)
            return (
              <div key={item.materialId} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn('text-sm font-medium', kind === 'pattern' ? 'font-mono' : 'font-english')}>{item.text}</span>
                    <Badge variant="outline" className="text-[10px]">{item.difficulty}</Badge>
                    {item.category && <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>}
                    {item.status === 'earlier' && <Badge variant="secondary" className="text-[10px]">前序已学·仅复习</Badge>}
                    {item.status === 'new' && <Badge className="text-[10px]">建议新建</Badge>}
                  </div>
                  {item.meaning && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.meaning}</p>}
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={added ? 'ghost' : 'outline'}
                  className="h-7 shrink-0 text-xs"
                  disabled={added || addingId !== null}
                  onClick={() => onAdd(item)}
                >
                  {addingId === item.materialId && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  {added ? '已加入' : item.status === 'new' ? '新建并加入' : '加入'}
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary" />当前已选材料无需补充
        </div>
      )}
    </div>
  )
}

function TrainingTopicDialog({
  open, onClose, edit, sceneId, packageType, contentMode, chunks, patterns, topicIndex, topicTotal, onPrevTopic, onNextTopic, onSaved, initialTab = 'basic', onTabChange,
}: {
  open: boolean
  onClose: () => void
  edit: TrainingTopic | null
  sceneId: string
  packageType: Scene['packageType']
  contentMode: Scene['contentMode']
  chunks: Chunk[]
  patterns: SentencePatternFull[]
  topicIndex?: number
  topicTotal?: number
  onPrevTopic?: () => void
  onNextTopic?: () => void
  onSaved: (topic: TrainingTopic) => void
  initialTab?: 'basic' | 'warmup'
  onTabChange?: (tab: string) => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [teachingGenerating, setTeachingGenerating] = useState(false)
  const [teachingMode, setTeachingMode] = useState<'edit' | 'preview'>('edit')
  const [activeTab, setActiveTab] = useState('basic')
  // 引用冲突：保存被拦截时记录冲突与待保存 payload，供“改为复习并保存”重试
  const [claimConflicts, setClaimConflicts] = useState<TopicClaimConflict[] | null>(null)
  const [conflictPayload, setConflictPayload] = useState<any>(null)
  // 关联词汇推荐（根据句型和句块）
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedVocabItem[] | null>(null)
  const [supportSuggesting, setSupportSuggesting] = useState<TopicSupportKind | null>(null)
  const [supportAdding, setSupportAdding] = useState<string | null>(null)
  const [supportSuggestions, setSupportSuggestions] = useState<Record<TopicSupportKind, { summary: string; items: SuggestedTopicSupportItem[] } | null>>({
    pattern: null,
    chunk: null,
  })
  const groupedSuggestions = useMemo(() => {
    if (!suggestions?.length) return []
    const core = suggestions.filter((item) => item.group !== 'extension')
    const ext = suggestions.filter((item) => item.group === 'extension')
    return [
      { label: '核心推荐词', items: core },
      ...(ext.length ? [{ label: '扩展词（进阶）', items: ext }] : []),
    ]
  }, [suggestions])
  const [stories, setStories] = useState<StoryData[]>([])
  const [storiesLoading, setStoriesLoading] = useState(false)
  const [storySearch, setStorySearch] = useState('')
  const [storyType, setStoryType] = useState('all')
  const [storyPage, setStoryPage] = useState(1)
  const [storyPageSize, setStoryPageSize] = useState(20)
  const [storyTotal, setStoryTotal] = useState(0)
  const storiesLoadedRef = useRef(false)
  const nextInitialTabRef = useRef<'basic' | 'warmup'>('basic')
  const savedFormSnapshotRef = useRef('')
  // Fetch the bound story individually (bypasses pagination)
  const [boundStory, setBoundStory] = useState<StoryData | null>(null)
  // Stable key to only re-init form when a different topic is opened, not on prop reference change
  const editKey = edit?.id ?? '__new__'
  const [lastInitKey, setLastInitKey] = useState<string | null>(null)
  const [createdPatterns, setCreatedPatterns] = useState<SentencePatternFull[]>([])
  const [createdChunks, setCreatedChunks] = useState<Chunk[]>([])

  // 过滤为当前话题绑定的材料（而非全系统材料），供 AI 生成使用
  const topicBoundPatterns = useMemo(
    () => (edit?.topicPatterns ?? []).map(normalizeTopicPattern).filter(Boolean) as SentencePatternFull[],
    [edit?.topicPatterns],
  )
  const selectablePatterns = useMemo(
    () => mergeById(patterns, topicBoundPatterns, createdPatterns),
    [patterns, topicBoundPatterns, createdPatterns],
  )
  // 词汇远程搜索池：打开时预拉前 100 条 + 话题绑定词条，搜索时按需补充（不加载全量词汇库）
  const [vocabPool, setVocabPool] = useState<Vocabulary[]>([])
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const bound = (edit?.topicVocabs ?? []).map((tv: any) => tv.vocab).filter(Boolean) as Vocabulary[]
    setVocabPool(bound)
    listVocabularies()
      .then((items) => { if (!cancelled) setVocabPool(mergeById(bound, items)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, editKey])
  const remoteVocabSearch = useCallback(async (query: string) => {
    const items = await listVocabularies(query)
    setVocabPool((prev) => mergeById(prev, items))
    return items
  }, [])
  const selectableVocabs = useMemo(
    () => mergeById(vocabPool, (edit?.topicVocabs ?? []).map((tv: any) => tv.vocab).filter(Boolean)),
    [vocabPool, edit?.topicVocabs],
  )
  const selectableChunks = useMemo(
    () => mergeById(chunks, (edit?.activeChunks ?? []).map((ac: any) => ac.chunk).filter(Boolean), createdChunks),
    [chunks, edit?.activeChunks, createdChunks],
  )
  const boundVocabs = useMemo(
    () => selectableVocabs.filter(v => (form.vocabIds ?? []).includes(v.id)),
    [selectableVocabs, form.vocabIds],
  )
  const boundChunks = useMemo(
    () => selectableChunks.filter(c => (form.chunkIds ?? []).includes(c.id)),
    [selectableChunks, form.chunkIds],
  )
  const boundPatterns = useMemo(
    () => selectablePatterns.filter(p => (form.patternIds ?? []).includes(p.id)),
    [selectablePatterns, form.patternIds],
  )

  // Only re-init form when a genuinely different topic is opened (keyed by edit.id)
  // This prevents form reset when parent re-fetches data after save
  useEffect(() => {
    if (!open) {
      setLastInitKey(null)
      return
    }
    if (lastInitKey === editKey) return // already initialized for this topic, skip

    if (edit) {
      const nextForm = {
        ...edit,
        chunkIds: edit.activeChunks?.map((ac: any) => ac.chunk.id) ?? [],
        vocabIds: edit.topicVocabs?.map((tv: any) => tv.vocab.id) ?? [],
        patternIds: edit.topicPatterns?.map((tp: any) => tp.pattern.id) ?? [],
        metadata: {
          ...(edit.metadata ?? {}),
          outputTraining: edit.metadata?.outputTraining ?? { version: 1, enabled: true, pipeline: [] },
        },
      }
      setForm(nextForm)
      savedFormSnapshotRef.current = serializeTrainingTopicForm(nextForm)
    }
    else {
      const nextForm = {
        sceneId,
        type: packageType === 'exam' ? 'ielts' : 'daily',
        activityType: ['writing', 'reading', 'listening'].includes(contentMode) ? contentMode : 'practice',
        metadata: {
          ...(packageType === 'exam'
            ? contentMode === 'writing'
              ? { exam: 'IELTS', section: 'writing', part: 2, bandTarget: '6.5', questionType: 'task_2_essay' }
              : { exam: 'IELTS', section: 'speaking', part: 1, bandTarget: '6.5', questionType: 'interview' }
            : {}),
          outputTraining: { version: 1, enabled: true, pipeline: [] },
        },
        title: '',
        description: '',
        teachingMarkdown: '',
        promptEn: '',
        promptZh: '',
        difficulty: 'L2',
        suggestedDurationSec: 60,
        sortOrder: 0,
        chunkIds: [],
        vocabIds: [],
        patternIds: [],
        inkScriptId: '',
      }
      setForm(nextForm)
      savedFormSnapshotRef.current = serializeTrainingTopicForm(nextForm)
    }
    setStorySearch('')
    setStoryType('all')
    setSuggestions(null)
    setSupportSuggestions({ pattern: null, chunk: null })
    setActiveTab(initialTab === 'warmup' ? 'warmup' : nextInitialTabRef.current)
    nextInitialTabRef.current = 'basic'
    setLastInitKey(editKey)
  }, [open, editKey, sceneId, packageType, contentMode, lastInitKey, initialTab])

  const saveAndNavigateTopicFromWarmup = async (navigate?: () => void) => {
    if (!navigate || saving) return
    nextInitialTabRef.current = 'warmup'
    setActiveTab('warmup')
    if (serializeTrainingTopicForm(form) === savedFormSnapshotRef.current) {
      navigate()
      return
    }
    const saved = await saveTopic()
    if (!saved) {
      nextInitialTabRef.current = 'basic'
      return
    }
    navigate()
  }

  // Fetch the currently bound story individually (bypasses pagination)
  useEffect(() => {
    if (form.inkScriptId) {
      getStory(form.inkScriptId).then(setBoundStory).catch(() => setBoundStory(null))
    } else {
      setBoundStory(null)
    }
  }, [form.inkScriptId])

  // 弹窗关闭时重置加载标记
  useEffect(() => {
    if (!open) {
      storiesLoadedRef.current = false
      setStories([])
    }
  }, [open])

  const storyTotalPages = Math.max(1, Math.ceil(storyTotal / storyPageSize))

  // 切换到 Ink 故事 tab 时才懒加载
  const loadStoriesIfNeeded = (page = 1) => {
    if (!storiesLoadedRef.current && page === 1) {
      storiesLoadedRef.current = true
    }
    setStoriesLoading(true)
    listStories({ page, pageSize: storyPageSize })
      .then((res) => {
        setStories(res.items)
        setStoryTotal(res.total)
        setStoryPage(res.page)
      })
      .catch(() => toast.error('Ink 故事加载失败'))
      .finally(() => setStoriesLoading(false))
  }

  const selectedStory = useMemo(
    () => stories.find((story) => story.id === form.inkScriptId) ?? null,
    [form.inkScriptId, stories],
  )

  // Prefer individually-fetched bound story, fall back to list
  const displayStory = boundStory ?? selectedStory

  const storyTypes = useMemo(
    () => Array.from(new Set(stories.map((story) => story.scriptType).filter(Boolean))),
    [stories],
  )

  const filteredStories = useMemo(() => {
    const keyword = storySearch.trim().toLowerCase()
    return stories.filter((story) => {
      const matchesType = storyType === 'all' || story.scriptType === storyType
      if (!matchesType) return false
      if (!keyword) return true
      return [story.title, story.key, story.scriptType, story.trainingTopic?.title]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(keyword))
    })
  }, [stories, storySearch, storyType])

  const storyTypeLabel = (type?: string | null) => {
    if (type === 'practice') return '练习'
    if (type === 'episode') return '关卡'
    if (type === 'side_quest') return '支线'
    if (type === 'free') return '自由'
    return type || '未分类'
  }

  const updateMetadata = (patch: Record<string, any>) => {
    setForm({
      ...form,
      metadata: {
        ...(form.metadata ?? {}),
        ...patch,
        ...(form.type === 'ielts' ? { exam: 'IELTS', section: contentMode === 'writing' ? 'writing' : 'speaking' } : {}),
      },
    })
  }

  const withRecomputedWarmupUsage = (sourceForm: Record<string, any>) => {
    const outputTraining = sourceForm.metadata?.outputTraining as WarmupPipelineData | undefined
    if (!outputTraining?.pipeline) return sourceForm
    const materialUsage = buildWarmupMaterialUsage(outputTraining, boundVocabs, boundChunks, boundPatterns)
    return {
      ...sourceForm,
      metadata: {
        ...(sourceForm.metadata ?? {}),
        outputTraining: {
          ...outputTraining,
          materialUsage,
        },
      },
    }
  }

  const saveTopic = async (opts?: { forceReview?: boolean }) => {
    if (!form.title?.trim() || !form.promptEn?.trim()) {
      toast.error('请先填写标题和英文提示')
      return null
    }
    setSaving(true)
    try {
      const formWithUsage = withRecomputedWarmupUsage(form)
      const payload = { ...formWithUsage }
      delete payload.sentencePatterns // no longer used; patternIds is the new way
      if (contentMode !== 'practice') delete payload.inkScriptId
      else if (!payload.inkScriptId?.trim()) payload.inkScriptId = null
      if (!payload.mediaAssetId?.trim()) payload.mediaAssetId = null
      if (opts?.forceReview) payload.forceReview = true
      const saved = edit ? await updateTrainingTopic(edit.id, payload) : await createTrainingTopic(payload)
      // 材料引用冲突：返回 { conflicts }（不落库），弹窗让管理员选择处理方式
      if (!('id' in saved)) {
        setClaimConflicts(saved.conflicts ?? [])
        setConflictPayload(payload)
        return null
      }
      setForm((prev: any) => ({
        ...prev,
        metadata: formWithUsage.metadata,
        id: saved.id,
        sceneId: saved.sceneId,
        sortOrder: saved.sortOrder,
      }))
      setLastInitKey(saved.id)
      savedFormSnapshotRef.current = serializeTrainingTopicForm({ ...payload, id: saved.id, sceneId: saved.sceneId, sortOrder: saved.sortOrder })
      toast.success('话题已保存')
      onSaved(saved)
      return saved
    } catch {
      toast.error('保存失败')
      return null
    }
    finally { setSaving(false) }
  }

  const handleSave = async () => {
    await saveTopic()
  }

  const saveAsReview = async () => {
    const payload = conflictPayload
    setClaimConflicts(null)
    setConflictPayload(null)
    if (!payload) return
    await saveTopic({ forceReview: true })
  }

  const handleGenerateTopicTeaching = async () => {
    const topicId = form.id ?? edit?.id
    const topic = topicId ? { id: topicId } : await saveTopic()
    if (!topic?.id) return null
    const result = await generateTopicTeachingMarkdown(topic.id)
    return result.markdown
  }

  const runSuggestVocabs = async () => {
    if (suggesting) return
    let topicId = form.id ?? edit?.id
    if (!topicId) {
      const saved = await saveTopic()
      topicId = saved?.id
      if (!topicId) return
    }
    const patternIds = form.patternIds ?? []
    const chunkIds = form.chunkIds ?? []
    if (!patternIds.length && !chunkIds.length) {
      toast.error('请先绑定句型或句块，再推荐搭配词汇')
      return
    }
    setSuggesting(true)
    try {
      const result = await suggestTopicVocabs(topicId, {
        patternIds,
        chunkIds,
        difficulty: form.difficulty ?? 'L2',
        teachingMarkdown: form.teachingMarkdown ?? '',
      })
      setSuggestions(result.items)
      if (!result.items.length) toast.info('未找到合适的搭配词汇，可调整句型/句块后重试')
    } catch (error: any) {
      toast.error(error?.message || '词汇推荐失败')
    } finally {
      setSuggesting(false)
    }
  }

  const addSuggestedVocab = (vocabularyId: string) => {
    const ids = form.vocabIds ?? []
    if (ids.includes(vocabularyId)) return
    // 推荐词条并入词汇池，保证 boundVocabs 统计不遗漏
    const suggestion = suggestions?.find((s) => s.vocabularyId === vocabularyId)
    if (suggestion) {
      setVocabPool((prev) => mergeById(prev, [{
        id: vocabularyId,
        word: suggestion.word,
        meaning: suggestion.meaning ?? '',
        description: null,
        sortOrder: 0,
      } as Vocabulary]))
    }
    setForm({ ...form, vocabIds: [...ids, vocabularyId] })
    toast.success('已加入关联词汇')
  }

  const runSuggestSupports = async (kind: TopicSupportKind) => {
    if (supportSuggesting) return
    if (!(form.teachingMarkdown ?? '').trim()) {
      toast.error('请先填写或生成教学文档，再检查语言支架')
      return
    }
    let topicId = form.id ?? edit?.id
    if (!topicId) {
      const saved = await saveTopic()
      topicId = saved?.id
      if (!topicId) return
    }
    setSupportSuggesting(kind)
    try {
      const result = await suggestTopicSupports(topicId, {
        kind,
        patternIds: form.patternIds ?? [],
        chunkIds: form.chunkIds ?? [],
        vocabIds: form.vocabIds ?? [],
        difficulty: form.difficulty ?? 'L2',
        teachingMarkdown: form.teachingMarkdown ?? '',
        count: 6,
      })
      setSupportSuggestions((current) => ({
        ...current,
        [kind]: { summary: result.summary, items: result.items },
      }))
      if (!result.items.length) toast.info(result.summary || '当前语言支架已足够，无需补充')
    } catch (error: any) {
      toast.error(error?.message || `${kind === 'pattern' ? '句型' : 'Chunk'}推荐失败`)
    } finally {
      setSupportSuggesting(null)
    }
  }

  const addSuggestedSupport = async (kind: TopicSupportKind, item: SuggestedTopicSupportItem) => {
    if (supportAdding) return
    setSupportAdding(item.materialId)
    try {
      let materialId = item.materialId
      if (item.status === 'new') {
        if (kind === 'pattern') {
          const created = await createLibraryPattern({
            pattern: item.text,
            meaning: item.meaning,
            description: item.description || item.reason,
            category: item.category,
            difficulty: item.difficulty,
            examples: item.examples ?? [],
          })
          materialId = created.id
          setCreatedPatterns((current) => mergeById(current, [created]))
        } else {
          const created = await createLibraryChunk({
            text: item.text,
            meaning: item.meaning,
            description: item.description || item.reason,
            category: item.category,
            difficulty: item.difficulty,
            examples: (item.examples ?? []).map((example) => ({ ...example, level: 'basic' })),
          })
          materialId = created.id
          setCreatedChunks((current) => mergeById(current, [created as Chunk]))
        }
        setSupportSuggestions((current) => ({
          ...current,
          [kind]: current[kind]
            ? {
                ...current[kind]!,
                items: current[kind]!.items.map((entry) => entry.materialId === item.materialId
                  ? { ...entry, materialId, status: 'available', source: 'library' }
                  : entry),
              }
            : null,
        }))
      }
      const field = kind === 'pattern' ? 'patternIds' : 'chunkIds'
      setForm((current: any) => {
        const ids = current[field] ?? []
        return ids.includes(materialId) ? current : { ...current, [field]: [...ids, materialId] }
      })
      toast.success(item.status === 'new'
        ? `已新建并加入关联${kind === 'pattern' ? '句型' : ' Chunk'}`
        : `已加入关联${kind === 'pattern' ? '句型' : ' Chunk'}`)
    } catch (error: any) {
      toast.error(error?.message || `新增${kind === 'pattern' ? '句型' : ' Chunk'}失败`)
    } finally {
      setSupportAdding(null)
    }
  }

  const generateTeaching = async () => {
    if (teachingGenerating) return
    setTeachingGenerating(true)
    try {
      const markdown = await handleGenerateTopicTeaching()
      if (markdown != null) {
        setForm((current: any) => ({ ...current, teachingMarkdown: markdown }))
        toast.success('教学文档已生成，请检查后保存')
      }
    } catch (error: any) {
      toast.error(error?.message || 'AI 生成教学文档失败')
    } finally {
      setTeachingGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[72rem]">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="sr-only">{edit ? '编辑话题' : '新增话题'}</DialogTitle>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <p className="text-base font-semibold leading-none tracking-tight">{edit ? '编辑话题' : '新增话题'}</p>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                {contentMode === 'writing' ? '设计完整写作题面、作答边界和评分标准，并实时检查考生视图。' : '组织练习提示、句型 Chunk，并为话题绑定可交互 Ink 故事。'}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">{form.difficulty ?? 'L2'}</Badge>
              <Badge variant="secondary" className="text-xs">{form.suggestedDurationSec ?? 60}s</Badge>
              {displayStory && <Badge variant="outline" className="gap-1 text-xs"><Link2 className="size-3" />已绑定 Ink</Badge>}
            </div>
          </div>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); onTabChange?.(v); if (v === 'ink') loadStoriesIfNeeded() }} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b bg-muted/20 px-5 py-2.5">
            <TabsList className="h-9 w-full justify-start overflow-x-auto bg-background/80">
              <TabsTrigger value="basic" className="gap-1.5">
                <FileText className="size-3.5" />基础信息
              </TabsTrigger>
              <TabsTrigger value="training" className="gap-1.5">
                <Settings2 className="size-3.5" />练习配置
              </TabsTrigger>
              {contentMode !== 'practice' && <TabsTrigger value="experience" className="gap-1.5">
                <BookOpen className="size-3.5" />{contentModeLabel(contentMode)}题型
              </TabsTrigger>}
              {['writing', 'reading', 'listening'].includes(contentMode) && <TabsTrigger value="teaching" className="gap-1.5">
                <FileText className="size-3.5" />教学文档
              </TabsTrigger>}
              {contentMode === 'practice' && <TabsTrigger value="ink" className="gap-1.5">
                <Link2 className="size-3.5" />Ink 故事
              </TabsTrigger>}
              {contentMode === 'practice' && <TabsTrigger value="warmup" className="gap-1.5">
                <Dumbbell className="size-3.5" />知识点练习
              </TabsTrigger>}
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <TabsContent value="basic" className="mt-0 space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
                <div className="space-y-1">
                  <Label>标题</Label>
                  <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="自我介绍" />
                </div>
                <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label>话题类型</Label>
                    <Select
                      value={form.type ?? (packageType === 'exam' ? 'ielts' : 'daily')}
                      onChange={(e) => {
                        const type = e.target.value
                        const existingWarmup = form.metadata?.outputTraining
                        setForm({
                          ...form,
                          type,
                          metadata: type === 'ielts'
                            ? contentMode === 'writing'
                              ? { exam: 'IELTS', section: 'writing', part: 2, bandTarget: '6.5', questionType: 'task_2_essay', timeLimitMinutes: 40, outputTraining: existingWarmup ?? { version: 1, enabled: true, pipeline: [] } }
                              : { exam: 'IELTS', section: 'speaking', part: 1, bandTarget: '6.5', questionType: 'interview', outputTraining: existingWarmup ?? { version: 1, enabled: true, pipeline: [] } }
                            : { outputTraining: existingWarmup ?? { version: 1, enabled: true, pipeline: [] } },
                        })
                      }}
                    >
                      <option value="daily">日常话题</option>
                      <option value="ielts">{contentMode === 'writing' ? '雅思写作' : '雅思口语'}</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>排序</Label>
                    <Input type="number" value={form.sortOrder ?? 0}
                      onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>难度</Label>
                    <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                      {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>建议时长</Label>
                    <div className="relative">
                      <Clock3 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-8" type="number" value={form.suggestedDurationSec ?? 60}
                        onChange={(e) => setForm({ ...form, suggestedDurationSec: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </div>
              {(form.type ?? (packageType === 'exam' ? 'ielts' : 'daily')) === 'ielts' && (
                contentMode === 'writing' ? (
                <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Writing Task</Label>
                    <Select value={String(form.metadata?.part ?? 2)} onChange={(e) => updateMetadata({ part: Number(e.target.value) })}>
                      <option value="1">Task 1</option>
                      <option value="2">Task 2</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>目标分数</Label>
                    <Input value={form.metadata?.bandTarget ?? ''} onChange={(e) => updateMetadata({ bandTarget: e.target.value })} placeholder="6.5" />
                  </div>
                  <div className="space-y-1">
                    <Label>题型</Label>
                    <Select value={form.metadata?.questionType ?? 'task_2_essay'} onChange={(e) => updateMetadata({ questionType: e.target.value })}>
                      <option value="task_1_letter">Task 1 Letter</option>
                      <option value="task_1_report">Task 1 Report</option>
                      <option value="task_2_essay">Task 2 Essay</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>考试时限（分钟）</Label>
                    <Input type="number" min={1} value={form.metadata?.timeLimitMinutes ?? 40} onChange={(e) => updateMetadata({ timeLimitMinutes: Number(e.target.value) })} />
                  </div>
                </div>
                ) : (
                <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-5">
                  <div className="space-y-1">
                    <Label>Part</Label>
                    <Select value={String(form.metadata?.part ?? 1)} onChange={(e) => updateMetadata({ part: Number(e.target.value) })}>
                      <option value="1">Part 1</option>
                      <option value="2">Part 2</option>
                      <option value="3">Part 3</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>目标分数</Label>
                    <Input value={form.metadata?.bandTarget ?? ''} onChange={(e) => updateMetadata({ bandTarget: e.target.value })} placeholder="6.5" />
                  </div>
                  <div className="space-y-1">
                    <Label>题型</Label>
                    <Select value={form.metadata?.questionType ?? 'interview'} onChange={(e) => updateMetadata({ questionType: e.target.value })}>
                      <option value="interview">Interview</option>
                      <option value="cue_card">Cue card</option>
                      <option value="discussion">Discussion</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>准备秒数</Label>
                    <Input type="number" value={form.metadata?.prepSeconds ?? ''} onChange={(e) => updateMetadata({ prepSeconds: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="space-y-1">
                    <Label>回答秒数</Label>
                    <Input type="number" value={form.metadata?.answerSeconds ?? ''} onChange={(e) => updateMetadata({ answerSeconds: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                )
              )}
              <MarkdownEditor
                label="话题说明"
                value={form.description ?? ''}
                onChange={(value) => setForm({ ...form, description: value })}
                height={130}
                preview="edit"
                placeholder="这个话题训练什么能力、回答时要注意什么..."
              />
              <div className="grid gap-3 lg:grid-cols-2">
                <MarkdownEditor
                  label="英文提示"
                  value={form.promptEn ?? ''}
                  onChange={(value) => setForm({ ...form, promptEn: value })}
                  height={160}
                  preview="edit"
                  placeholder="Tell me about yourself."
                />
                <MarkdownEditor
                  label="中文提示"
                  value={form.promptZh ?? ''}
                  onChange={(value) => setForm({ ...form, promptZh: value })}
                  height={160}
                  preview="edit"
                  placeholder="请介绍一下你自己。"
                />
              </div>
            </TabsContent>

            {['writing', 'reading', 'listening'].includes(contentMode) && (
              <TabsContent value="experience" className="mt-0">
                <TopicExperienceFields
                  mode={contentMode as 'writing' | 'reading' | 'listening'}
                  sceneId={sceneId}
                  value={form.contentConfig ?? {}}
                  mediaAssetId={form.mediaAssetId}
                  transcript={form.transcript}
                  draftContext={{
                    title: form.title,
                    promptEn: form.promptEn,
                    promptZh: form.promptZh,
                    difficulty: form.difficulty,
                    suggestedDurationSec: form.suggestedDurationSec,
                    vocabulary: boundVocabs.map((item) => item.word),
                    chunks: boundChunks.map((item) => item.text),
                    sentencePatterns: boundPatterns.map((item) => item.pattern),
                  }}
                  onApplyDraft={(draft) => setForm((current: any) => ({
                    ...current,
                    ...draft,
                    contentConfig: { ...(current.contentConfig ?? {}), ...(draft.contentConfig ?? {}) },
                  }))}
                  onChange={(next) => setForm({ ...form, ...next })}
                />
              </TabsContent>
            )}

            {['writing', 'reading', 'listening'].includes(contentMode) && (
              <TabsContent value="teaching" className="mt-0 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.045] p-3">
                  <div>
                    <p className="text-sm font-semibold">课前教学文档</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">学习者开始写作、阅读或听力任务前会先看到这份 Markdown 指导。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tabs value={teachingMode} onValueChange={(value) => setTeachingMode(value as 'edit' | 'preview')}>
                      <TabsList className="h-8 bg-background/80">
                        <TabsTrigger value="edit" className="h-7 px-3 text-xs">编辑</TabsTrigger>
                        <TabsTrigger value="preview" className="h-7 px-3 text-xs">预览</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={generateTeaching} disabled={teachingGenerating}>
                      {teachingGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}AI 生成
                    </Button>
                  </div>
                </div>
                <MarkdownEditor
                  value={form.teachingMarkdown ?? ''}
                  onChange={(teachingMarkdown) => setForm({ ...form, teachingMarkdown })}
                  height={440}
                  preview={teachingMode}
                  placeholder="写明任务目标、可直接使用的表达、组织思路和易错提醒……"
                />
              </TabsContent>
            )}

            <TabsContent value="training" className="mt-0">
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                <p className="text-sm font-medium">语言支架</p>
                <p className="mt-1 text-xs text-muted-foreground">句型负责表达框架，Chunk 负责可复用表达，词汇夯实基础。</p>
              </div>
              <Tabs defaultValue="patterns" className="mt-3">
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="patterns" className="gap-1.5">
                    <Code2 className="size-3.5" />句型骨架
                  </TabsTrigger>
                  <TabsTrigger value="chunks" className="gap-1.5">
                    <Type className="size-3.5" />关联 Chunk
                  </TabsTrigger>
                  <TabsTrigger value="vocabs" className="gap-1.5">
                    <BookOpen className="size-3.5" />关联词汇
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="patterns" className="mt-0">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">结合教学文档、已选句型、Chunk 和词汇，检查是否还缺少表达骨架。</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => void runSuggestSupports('pattern')}
                      disabled={supportSuggesting !== null}
                    >
                      {supportSuggesting === 'pattern'
                        ? <Loader2 data-icon="inline-start" className="animate-spin" />
                        : <Sparkles data-icon="inline-start" />}
                      检查是否需要补充
                    </Button>
                  </div>
                  {supportSuggestions.pattern && (
                    <TopicSupportSuggestionPanel
                      kind="pattern"
                      summary={supportSuggestions.pattern.summary}
                      items={supportSuggestions.pattern.items}
                      selectedIds={form.patternIds ?? []}
                      addingId={supportAdding}
                      onAdd={(item) => void addSuggestedSupport('pattern', item)}
                      onClose={() => setSupportSuggestions((current) => ({ ...current, pattern: null }))}
                    />
                  )}
                  <SearchSelectTable
                    items={selectablePatterns}
                    selectedIds={form.patternIds ?? []}
                    onToggle={(id) => {
                      const ids = form.patternIds ?? []
                      setForm({ ...form, patternIds: ids.includes(id) ? ids.filter((i: string) => i !== id) : [...ids, id] })
                    }}
                    searchPlaceholder="搜索句型或含义..."
                    searchFn={(item, q) =>
                      item.pattern.toLowerCase().includes(q) || (item.meaning ?? '').includes(q)
                    }
                    emptyText="没有匹配的句型"
                    getBadgeLabel={(item) => item.pattern}
                    columns={[
                      { key: 'pattern', header: '句型', className: 'font-mono text-sm font-medium', render: (p) => p.pattern },
                      { key: 'meaning', header: '含义', className: 'text-xs text-muted-foreground max-w-[200px] truncate', render: (p) => p.meaning || '-' },
                      { key: 'difficulty', header: '等级', className: 'hidden md:table-cell', render: (p) => <Badge variant="outline" className="text-[10px]">{p.difficulty}</Badge> },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="chunks" className="mt-0">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">结合教学文档和现有语言支架，检查是否还需要补充可直接复用的表达块。</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => void runSuggestSupports('chunk')}
                      disabled={supportSuggesting !== null}
                    >
                      {supportSuggesting === 'chunk'
                        ? <Loader2 data-icon="inline-start" className="animate-spin" />
                        : <Sparkles data-icon="inline-start" />}
                      检查是否需要补充
                    </Button>
                  </div>
                  {supportSuggestions.chunk && (
                    <TopicSupportSuggestionPanel
                      kind="chunk"
                      summary={supportSuggestions.chunk.summary}
                      items={supportSuggestions.chunk.items}
                      selectedIds={form.chunkIds ?? []}
                      addingId={supportAdding}
                      onAdd={(item) => void addSuggestedSupport('chunk', item)}
                      onClose={() => setSupportSuggestions((current) => ({ ...current, chunk: null }))}
                    />
                  )}
                  <SearchSelectTable
                    items={selectableChunks}
                    selectedIds={form.chunkIds ?? []}
                    onToggle={(id) => {
                      const ids = form.chunkIds ?? []
                      setForm({ ...form, chunkIds: ids.includes(id) ? ids.filter((i: string) => i !== id) : [...ids, id] })
                    }}
                    searchPlaceholder="搜索英文、中文含义或分类..."
                    searchFn={(item, q) =>
                      item.text.toLowerCase().includes(q) || item.meaning.includes(q) || (item.category ?? '').includes(q)
                    }
                    emptyText="没有匹配的 Chunk"
                    getBadgeLabel={(item) => item.text}
                    columns={[
                      { key: 'text', header: '句块', className: 'text-sm font-medium', render: (c) => c.text },
                      { key: 'meaning', header: '含义', className: 'text-xs text-muted-foreground max-w-[200px] truncate', render: (c) => c.meaning },
                      { key: 'difficulty', header: '等级', className: 'hidden md:table-cell', render: (c) => <Badge variant="outline" className="text-[10px]">{c.difficulty}</Badge> },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="vocabs" className="mt-0">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">从词汇库挑选本话题的新学词汇；可让 AI 根据已绑句型/句块推荐搭配词（自动排除后序包知识点与语法功能词）。</p>
                    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={runSuggestVocabs} disabled={suggesting}>
                      {suggesting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      根据句型和句块推荐
                    </Button>
                  </div>
                  {suggestions && (
                    <div className="mb-3 overflow-hidden rounded-lg border border-border/70 bg-background">
                      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold">推荐搭配词汇（{suggestions.length}）</p>
                          <Badge variant="outline" className="text-[10px]">新词 {suggestions.filter((item) => item.status === 'available').length}</Badge>
                          <Badge variant="secondary" className="text-[10px]">复习 {suggestions.filter((item) => item.status === 'earlier').length}</Badge>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={() => setSuggestions(null)}>收起</Button>
                      </div>
                      <div className="max-h-56 divide-y divide-border/60 overflow-y-auto">
                        {groupedSuggestions.map((group) => (
                          <div key={group.label} className="divide-y divide-border/60">
                            <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5">
                              <span className="text-[10px] font-semibold text-muted-foreground">{group.label}</span>
                              <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
                            </div>
                            {group.items.map((item) => {
                              const added = (form.vocabIds ?? []).includes(item.vocabularyId)
                              return (
                                <div key={item.vocabularyId} className="flex items-center gap-3 px-3 py-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-sm font-medium">{item.word}</span>
                                      <Badge variant="outline" className="text-[10px]">{item.difficulty}</Badge>
                                      {item.partOfSpeech && <Badge variant="secondary" className="text-[10px]">{item.partOfSpeech}</Badge>}
                                      {item.group === 'extension' && <Badge variant="secondary" className="text-[10px]">扩展</Badge>}
                                      {item.status === 'earlier' && <Badge variant="secondary" className="text-[10px]">前序已学·仅复习</Badge>}
                                    </div>
                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.reason}</p>
                                  </div>
                                  <Button type="button" size="sm" variant={added ? 'ghost' : 'outline'} className="h-7 shrink-0 text-xs"
                                    disabled={added} onClick={() => addSuggestedVocab(item.vocabularyId)}>
                                    {added ? '已加入' : '加入'}
                                  </Button>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <SearchSelectTable
                    items={selectableVocabs}
                    selectedIds={form.vocabIds ?? []}
                    onToggle={(id) => {
                      const ids = form.vocabIds ?? []
                      setForm({ ...form, vocabIds: ids.includes(id) ? ids.filter((i: string) => i !== id) : [...ids, id] })
                    }}
                    searchPlaceholder="搜索英文或中文含义..."
                    searchFn={(item, q) =>
                      item.word.toLowerCase().includes(q) || item.meaning.includes(q)
                    }
                    remoteSearch={remoteVocabSearch}
                    emptyText="没有匹配的词汇"
                    getBadgeLabel={(item) => item.word}
                    columns={[
                      { key: 'word', header: '词汇', className: 'text-sm font-medium', render: (v) => v.word },
                      { key: 'meaning', header: '含义', className: 'text-xs text-muted-foreground max-w-[200px] truncate', render: (v) => v.meaning },
                    ]}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="ink" className="mt-0 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">当前绑定</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          不绑定时，练习会继续使用默认 AI 对话模式。
                        </p>
                      </div>
                      {selectedStory && (
                        <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, inkScriptId: null })}>
                          解绑
                        </Button>
                      )}
                    </div>
                    {displayStory ? (
                      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{displayStory.title}</p>
                            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{displayStory.key}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{storyTypeLabel(displayStory.scriptType)}</Badge>
                              <Badge variant="secondary" className="text-[10px]">v{displayStory.version}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                                onClick={() => { window.location.hash = `#/admin/nqtr?tab=stories&storyId=${displayStory.id}` }}
                              >
                                <ExternalLink className="size-3" />
                                在故事工坊中编辑
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-md border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                        还没有绑定 Ink 故事。
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>搜索故事</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={storySearch}
                        onChange={(e) => setStorySearch(e.target.value)}
                        placeholder="搜索标题、key、类型或已绑定话题"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>类型筛选</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={storyType === 'all' ? 'default' : 'outline'} onClick={() => setStoryType('all')}>
                        全部
                      </Button>
                      {storyTypes.map((type) => (
                        <Button key={type} type="button" size="sm" variant={storyType === type ? 'default' : 'outline'} onClick={() => setStoryType(type)}>
                          {storyTypeLabel(type)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70">
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                    <p className="text-sm font-medium">故事列表</p>
                    <span className="text-xs text-muted-foreground">共 {storyTotal} 个</span>
                  </div>
                  <div className="h-[350px] overflow-y-auto">
                    {storiesLoading ? (
                      <div className="space-y-2 p-3">
                        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                      </div>
                    ) : filteredStories.length === 0 ? (
                      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                        没有匹配的 Ink 故事
                      </div>
                    ) : (
                      <div className="divide-y divide-border/70">
                        {filteredStories.map((story) => {
                          const active = form.inkScriptId === story.id
                          return (
                            <button
                              key={story.id}
                              type="button"
                              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 ${active ? 'bg-primary/5' : ''}`}
                              onClick={() => setForm({ ...form, inkScriptId: story.id })}
                            >
                              <span className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}>
                                {active && <CheckCircle2 className="size-3.5" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-medium">{story.title}</span>
                                  <Badge variant={story.scriptType === 'practice' ? 'default' : 'outline'} className="text-[10px]">
                                    {storyTypeLabel(story.scriptType)}
                                  </Badge>
                                </span>
                                <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{story.key}</span>
                                <span className="mt-2 flex flex-wrap gap-1.5">
                                  <Badge variant="secondary" className="text-[10px]">v{story.version}</Badge>
                                  {story.trainingTopic && (
                                    <Badge variant="outline" className="max-w-[220px] truncate text-[10px]">
                                      已绑定：{story.trainingTopic.title}
                                    </Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground">
                                    {new Date(story.updatedAt).toLocaleDateString('zh-CN')}
                                  </span>
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <AdminPagination
                    total={storyTotal}
                    page={storyPage}
                    pageSize={storyPageSize}
                    onPageChange={(p) => loadStoriesIfNeeded(p)}
                    onPageSizeChange={(size) => { setStoryPageSize(size); setStoryPage(1); loadStoriesIfNeeded(1) }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="warmup" className="mt-0">
              <WarmupPipelineTab
                value={form.metadata?.outputTraining ?? { version: 1, enabled: true, pipeline: [] }}
                onChange={(v) => setForm({ ...form, metadata: { ...(form.metadata ?? {}), outputTraining: v } })}
                sceneId={sceneId}
                vocabs={boundVocabs}
                chunks={boundChunks}
                patterns={boundPatterns}
                topicTitle={form.title || edit?.title || ''}
                difficulty={form.difficulty ?? edit?.difficulty ?? 'L2'}
                teachingMarkdown={form.teachingMarkdown ?? ''}
                onTeachingMarkdownChange={(teachingMarkdown) => setForm({ ...form, teachingMarkdown })}
                onGenerateTeaching={handleGenerateTopicTeaching}
                onGenerateInBackground={async () => {
                  const saved = await saveTopic()
                  if (!saved) throw new Error('请先保存完整的话题信息')
                  const task = await enqueueWarmupPipelineGeneration(saved.id)
                  toast.success(task.reused ? '该话题已有生成任务正在执行' : '已发送到任务中心，可继续编辑或离开页面', {
                    action: { label: '查看任务', onClick: () => window.location.hash = '#/admin/tasks' },
                  })
                }}
                topicIndex={topicIndex}
                topicTotal={topicTotal}
                onPrevTopic={onPrevTopic && !saving ? () => saveAndNavigateTopicFromWarmup(onPrevTopic) : undefined}
                onNextTopic={onNextTopic && !saving ? () => saveAndNavigateTopicFromWarmup(onNextTopic) : undefined}
              />
            </TabsContent>
          </div>
        </Tabs>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <p className="text-xs text-muted-foreground">
            标题和英文提示为必填；Ink 可稍后绑定。
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !form.title?.trim() || !form.promptEn?.trim()}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* 材料引用冲突：按顺序约束阻止保存，可选择降级为复习保存 */}
      <Dialog open={claimConflicts !== null} onOpenChange={(open) => { if (!open) { setClaimConflicts(null); setConflictPayload(null) } }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>材料引用冲突</DialogTitle>
            <DialogDescription className="sr-only">部分材料已被前序学习内容认领</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              以下材料已被<b>前序学习包或本包前序话题</b>作为新学知识点使用，按顺序约束不能再作为本话题的新学目标：
            </p>
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border/70 bg-muted/20 p-3">
              {(claimConflicts ?? []).map((conflict, index) => (
                <div key={`${conflict.materialId}-${index}`} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{conflict.text}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{kindLabel(conflict.kind)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    已用于「{conflict.source}」{conflict.sourceType === 'pack' ? `（第 ${conflict.sourceSortOrder + 1} 包）` : '（本包前序话题）'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              选择「改为复习并保存」后，这些材料仍可出现在本话题的例句/练习题中，但不再作为新学知识点（不会占用后续学习名额）。
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setClaimConflicts(null); setConflictPayload(null) }}>返回修改</Button>
            <Button onClick={saveAsReview} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              改为复习并保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// ─── Scene Detail View ──────────────────────────────────────

function SceneDetailView({ sceneId, onBack, chunks }: { sceneId: string; onBack: () => void; chunks: Chunk[] }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [scene, setScene] = useState<Scene | null>(null)
  const [vocabs, setVocabs] = useState<Vocabulary[]>([])
  const [patterns, setPatterns] = useState<SentencePatternFull[]>([])
  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [topicTotal, setTopicTotal] = useState(0)
  const [storyEpisodes, setStoryEpisodes] = useState<StoryEpisode[]>([])
  const [loading, setLoading] = useState(true)

  const [vocabDialog, setVocabDialog] = useState(false)
  const [editVocab, setEditVocab] = useState<Vocabulary | null>(null)
  const [topicDialog, setTopicDialog] = useState(false)
  const [editTopic, setEditTopic] = useState<TrainingTopic | null>(null)
  const [openingTopicId, setOpeningTopicId] = useState<string | null>(null)
  const [topicInitialTab, setTopicInitialTab] = useState<'basic' | 'warmup'>('basic')
  const openedDeepLinkRef = useRef<string | null>(null)
  const [storyDialog, setStoryDialog] = useState(false)
  const [editStoryEpisode, setEditStoryEpisode] = useState<StoryEpisode | null>(null)
  const [topicPage, setTopicPage] = useState(1)
  const [topicPageSize, setTopicPageSize] = useState(10)
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [qualityDialog, setQualityDialog] = useState(false)
  const [batchGenerating, setBatchGenerating] = useState(false)
  const materialsLoadedRef = useRef(false)

  // 词汇/句型库只在打开话题编辑器时按需加载（词汇库上万条，进详情页不预拉）
  // needVocabs=false 时只拉句型（话题编辑器词汇改为远程搜索）；小说包知识选择器才拉全量词汇
  const ensureMaterialsLoaded = useCallback(async (needVocabs = false) => {
    if (materialsLoadedRef.current) return
    materialsLoadedRef.current = true
    setMaterialsLoading(true)
    try {
      const jobs: Promise<unknown>[] = [listAllLibraryPatternsForAdmin().then(setPatterns)]
      if (needVocabs) jobs.push(listVocabularies().then(setVocabs))
      await Promise.all(jobs)
    } catch {
      materialsLoadedRef.current = false // 失败允许重试
    } finally {
      setMaterialsLoading(false)
    }
  }, [])

  const loadScene = async () => {
    setLoading(true)
    try {
      const [s, e] = await Promise.all([getScene(sceneId), listScriptEpisodes(sceneId)])
      setScene(s)
      setStoryEpisodes(e)
      // 小说包需要包级知识选择器，提前加载材料库（含全量词汇）
      if (s?.contentMode === 'novel') void ensureMaterialsLoaded(true)
    } catch {}
    finally { setLoading(false) }
  }

  const loadTopics = async (nextTopicPage = topicPage, nextTopicPageSize = topicPageSize) => {
    try {
      const topicResult = await listTrainingTopics(sceneId, { page: nextTopicPage, pageSize: nextTopicPageSize })
      setTopics(topicResult.items)
      setTopicTotal(topicResult.total)
    } catch {}
  }

  useEffect(() => { void loadScene() }, [sceneId])
  useEffect(() => { setTopicPage(1) }, [sceneId])
  useEffect(() => { void loadTopics() }, [sceneId, topicPage, topicPageSize])

  const topicTotalPages = getTotalPages(topicTotal, topicPageSize)
  const topicItems = topics
  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [topics],
  )
  const editTopicIndex = editTopic ? sortedTopics.findIndex((topic) => topic.id === editTopic.id) : -1
  const currentPackageTypeLabel = packageTypeLabel(scene?.packageType)

  const handleTopicSaved = (saved: TrainingTopic) => {
    void loadTopics(topicPage, topicPageSize)
    setTopics((prev) => {
      const existingIndex = prev.findIndex((topic) => topic.id === saved.id)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = saved
        return next
      }
      return [...prev, saved].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    })
    if (!topics.some((topic) => topic.id === saved.id)) setTopicTotal((total) => total + 1)
    setEditTopic(saved)
  }

  /** 批量生成：为该场景所有话题补齐教学文档 + 知识点训练（后台任务） */
  const handleBatchGenerate = async () => {
    if (batchGenerating) return
    setBatchGenerating(true)
    try {
      const task = await enqueueSceneTopicBatchGeneration(sceneId)
      toast.success(task.reused ? '该学习包已有批量生成任务正在执行' : '批量生成任务已发送到任务中心', {
        action: { label: '查看任务', onClick: () => window.location.hash = '#/admin/tasks' },
      })
    } catch (error: any) {
      toast.error(error?.message || '批量生成任务创建失败')
    } finally {
      setBatchGenerating(false)
    }
  }

  const syncTopicLink = (topicId?: string, tab: string = 'basic') => {
    const next = new URLSearchParams(searchParams)
    next.set('sceneId', sceneId)
    if (topicId) {
      openedDeepLinkRef.current = `${topicId}:${tab === 'warmup' ? 'warmup' : 'basic'}`
      next.set('topicId', topicId)
      next.set('dialog', 'topic')
      next.set('tab', tab)
    } else {
      next.delete('topicId')
      next.delete('dialog')
      next.delete('tab')
    }
    setSearchParams(next, { replace: true })
  }

  const closeTopicEditor = () => {
    setTopicDialog(false)
    openedDeepLinkRef.current = null
    syncTopicLink()
  }

  const openTopicEditor = async (topic: TrainingTopic | null, initialTab: 'basic' | 'warmup' = 'basic') => {
    // 打开编辑器前确保句型库已就绪（词汇选择器为远程搜索，无需全量加载）
    await ensureMaterialsLoaded(false)
    if (!topic) {
      setEditTopic(null)
      setTopicInitialTab('basic')
      setTopicDialog(true)
      return
    }
    setTopicInitialTab(initialTab)
    syncTopicLink(topic.id, initialTab)
    setOpeningTopicId(topic.id)
    try {
      const fullTopic = await getTrainingTopic(topic.id)
      if (!fullTopic) throw new Error('话题不存在')
      setEditTopic(fullTopic)
      setTopicDialog(true)
    } catch (error: any) {
      toast.error(error?.message || '话题详情加载失败')
    } finally {
      setOpeningTopicId(null)
    }
  }

  useEffect(() => {
    const linkedTopicId = searchParams.get('topicId')
    if (searchParams.get('sceneId') !== sceneId || searchParams.get('dialog') !== 'topic' || !linkedTopicId) return
    const tab = searchParams.get('tab') === 'warmup' ? 'warmup' : 'basic'
    const key = `${linkedTopicId}:${tab}`
    if (openedDeepLinkRef.current === key) return
    openedDeepLinkRef.current = key
    void openTopicEditor({ id: linkedTopicId } as TrainingTopic, tab)
    // openTopicEditor also normalizes the URL; this effect intentionally keys off URL values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, searchParams])

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  )
  if (!scene) return <p className="text-muted-foreground py-8 text-center">学习包未找到</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ChevronRight className="size-4 rotate-180" /></Button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{scene.title}</h2>
            <p className="text-sm text-muted-foreground">{currentPackageTypeLabel} · {contentModeLabel(scene.contentMode)} · {scene.requiredOutputLevel}</p>
          </div>
        </div>
        {!['story', 'novel'].includes(scene.contentMode) && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setQualityDialog(true)}>
              <ClipboardCheck data-icon="inline-start" />
              质量审查
            </Button>
            <Button variant="outline" onClick={() => void handleBatchGenerate()} disabled={batchGenerating || !topicTotal}>
              {batchGenerating ? <Loader2 className="size-4 animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
              批量生成
            </Button>
          </div>
        )}
      </div>

      <ContentExperiencePanel scene={scene} vocabularies={vocabs} chunks={chunks} patterns={patterns} />

      {/* Training Topics — 非 story 类型的学习包 */}
      {!['story', 'novel'].includes(scene.contentMode) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="size-4" /> 训练话题 ({topicTotal})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => openTopicEditor(null)} disabled={materialsLoading}>
              {materialsLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Plus className="size-3.5 mr-1" />} 添加
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {topicTotal === 0 ? (
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
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">关联内容</th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">配置</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topicItems.map((t) => (
                      <tr key={t.id} className="cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => openTopicEditor(t)}>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{t.title}</span>
                              <Badge variant={t.type === 'ielts' ? 'default' : 'outline'} className="text-xs">
                                {t.type === 'ielts' ? '雅思' : '日常'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{t.difficulty}</Badge>
                              <Badge variant="secondary" className="text-xs">{t.suggestedDurationSec}s</Badge>
                            </div>
                            <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">{t.promptEn}</p>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {(t.topicPatterns ?? []).slice(0, 2).map((tp: any) => (
                              <Badge key={tp.id} variant="outline" className="font-mono text-[10px]">{tp.pattern.pattern}</Badge>
                            ))}
                            {(t.activeChunks ?? []).slice(0, 2).map((ac: any) => (
                              <Badge key={ac.id} variant="outline" className="text-[10px]">{ac.chunk.text}</Badge>
                            ))}
                            {(t.topicVocabs ?? []).slice(0, 2).map((tv: any) => (
                              <Badge key={tv.id} variant="secondary" className="text-[10px]">{tv.vocab.word}</Badge>
                            ))}
                            {((t.topicPatterns?.length ?? 0) + (t.activeChunks?.length ?? 0) + (t.topicVocabs?.length ?? 0)) > 6 && (
                              <Badge variant="secondary" className="text-[10px]">+{(t.topicPatterns?.length ?? 0) + (t.activeChunks?.length ?? 0) + (t.topicVocabs?.length ?? 0) - 6}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                          排序 {t.sortOrder}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="size-8"
                              disabled={openingTopicId === t.id}
                              onClick={(e) => { e.stopPropagation(); openTopicEditor(t) }}>
                              {openingTopicId === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Edit3 className="size-3.5" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8 text-destructive"
                              onClick={async (e) => { e.stopPropagation(); await deleteTrainingTopic(t.id); loadTopics() }}>
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
              total={topicTotal}
              page={Math.min(topicPage, topicTotalPages)}
              pageSize={topicPageSize}
              onPageChange={setTopicPage}
              onPageSizeChange={(size) => { setTopicPageSize(size); setTopicPage(1) }}
            />
          </CardContent>
        </Card>
      )}

      {/* Story Episodes — 仅 story 类型的学习包 */}
      {scene.contentMode === 'story' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="size-4" /> 故事关卡 ({storyEpisodes.length})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setEditStoryEpisode(null); setStoryDialog(true) }}>
              <Plus className="mr-1 size-3.5" /> 添加
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {storyEpisodes.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-muted-foreground">暂无故事关卡</p>
                <p className="mt-1 text-xs text-muted-foreground/60">在这里配置互动剧情对话关卡，包含 NPC 角色、任务目标和通关条件。</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">关卡</th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">章节</th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">通关目标</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {storyEpisodes.map((episode) => (
                      <tr key={episode.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{episode.title}</span>
                              {episode.isPreview && <Badge variant="secondary" className="text-xs">体验</Badge>}
                              <Badge variant="outline" className="text-xs">{episode.requiredOutputLevel}</Badge>
                            </div>
                            <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
                              {episode.npcName || '未设置角色'} · {episode.description || '未设置说明'}
                            </p>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <div className="text-sm font-medium">{episode.chapterTitle}</div>
                          <div className="text-xs text-muted-foreground">{episode.chapterId} · 第 {episode.episodeOrder} 关</div>
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                          <div className="flex items-center gap-2">
                            <Target className="size-3.5" />
                            {episode.passObjectiveCount} 目标 · {episode.passChunkCount} Chunk · {episode.passMinDialogues} 轮
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => { setEditStoryEpisode(episode); setStoryDialog(true) }}>
                              <Edit3 className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive"
                              onClick={async () => { if (confirm('确认删除这个故事关卡？')) { await deleteScriptEpisode(episode.id); loadScene() } }}
                            >
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
          </CardContent>
        </Card>
      )}

      <TrainingTopicDialog open={topicDialog} onClose={closeTopicEditor}
        edit={editTopic} sceneId={sceneId} packageType={scene.packageType} contentMode={scene.contentMode} chunks={chunks} patterns={patterns}
        initialTab={topicInitialTab}
        onTabChange={(tab) => { if (editTopic?.id) syncTopicLink(editTopic.id, tab) }}
        topicIndex={editTopicIndex >= 0 ? editTopicIndex : undefined}
        topicTotal={sortedTopics.length}
        onPrevTopic={editTopicIndex > 0 ? () => openTopicEditor(sortedTopics[editTopicIndex - 1], 'warmup') : undefined}
        onNextTopic={editTopicIndex >= 0 && editTopicIndex < sortedTopics.length - 1 ? () => openTopicEditor(sortedTopics[editTopicIndex + 1], 'warmup') : undefined}
        onSaved={handleTopicSaved} />
      <EpisodeEditDialog
        open={storyDialog}
        onClose={() => setStoryDialog(false)}
        edit={editStoryEpisode}
        defaultSceneId={sceneId}
        onSaved={loadScene}
      />
      <LearningPackageQualityDialog
        open={qualityDialog}
        scene={scene}
        onOpenChange={setQualityDialog}
        onApplied={() => void loadTopics(topicPage, topicPageSize)}
      />
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────

export function AdminScenesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState<SceneCategory[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [groups, setGroups] = useState<PackageGroup[]>([])
  // 数据包导入/导出
  const uploadRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [selectedPackageType, setSelectedPackageType] = useState<PackageTypeFilter>('all')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [catDialog, setCatDialog] = useState(false)
  const [editCat, setEditCat] = useState<SceneCategory | null>(null)
  const [sceneDialog, setSceneDialog] = useState(false)
  const [editScene, setEditScene] = useState<Scene | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [cats, scns] = await Promise.all([
        listSceneCategories(selectedPackageType === 'all' ? undefined : selectedPackageType, 'story'),
        listScenes(selectedCat ?? undefined, selectedPackageType === 'all' ? undefined : selectedPackageType, 'story'),
      ])
      setCategories(cats); setScenes(scns)
    } catch {}
    finally { setLoading(false) }
  }

  // 句块库（含例句）与系列列表只加载一次，切换筛选不重复拉取
  useEffect(() => {
    listAllChunks().then(setChunks).catch(() => {})
    contentExperienceAdminApi.listGroups().then(setGroups).catch(() => {})
  }, [])

  const notifyContentTask = (taskId?: string) => {
    if (!taskId) return
    toast.success('学习包已导入，内容准备任务已开始')
  }

  const handlePaidChange = async (scene: Scene, paid: boolean) => {
    setUpdatingId(scene.id)
    try {
      const nextIsFree = !paid
      await updateScene(scene.id, { isFree: nextIsFree })
      setScenes((items) => items.map((item) => (
        item.id === scene.id ? { ...item, isFree: nextIsFree } : item
      )))
      toast.success(paid ? '已设为付费学习包' : '已设为免费学习包')
    } catch {
      toast.error('付费状态更新失败')
    } finally {
      setUpdatingId(null)
    }
  }

  useEffect(() => { load() }, [selectedCat, selectedPackageType])
  // 详情视图以 URL 的 sceneId 为唯一数据源，避免 state 与 URL 异步竞争导致返回后页面不切换
  const detailSceneId = searchParams.get('sceneId')
  useEffect(() => { setPage(1) }, [selectedCat, selectedPackageType, selectedGroup])
  useEffect(() => {
    if (selectedCat && !categories.some((category) => category.id === selectedCat)) {
      setSelectedCat(null)
    }
  }, [categories, selectedCat])

  // 按所属系列过滤：只显示选中组的包，过滤掉其他
  const filteredScenes = useMemo(
    () => (selectedGroup ? scenes.filter((scene) => scene.groupId === selectedGroup) : scenes),
    [scenes, selectedGroup],
  )
  const groupNameById = useMemo(() => {
    const map = new Map<string, string>()
    groups.forEach((group) => map.set(group.id, group.name))
    return map
  }, [groups])

  const totalPages = getTotalPages(filteredScenes.length, pageSize)
  const pageItems = getPageItems(filteredScenes, Math.min(page, totalPages), pageSize)

  if (detailSceneId) {
    return (
      <div className="space-y-4">
        <SceneDetailView sceneId={detailSceneId} onBack={() => {
          const next = new URLSearchParams(searchParams)
          for (const key of ['sceneId', 'topicId', 'dialog', 'tab']) next.delete(key)
          setSearchParams(next, { replace: true })
        }} chunks={chunks} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">学习包内容管理</h1>
          <p className="text-sm text-muted-foreground">统一管理日常练习、考试、课程和零基础话题内容</p>
        </div>
        <Button onClick={() => { setEditCat(null); setCatDialog(true) }}>
          <Plus className="size-4 mr-1" /> 新增分类
        </Button>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">筛选</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">一级类型</p>
            <div className="flex flex-wrap gap-2">
              {[{ id: 'all' as const, label: '全部' }, ...PACKAGE_TYPE_FILTERS].map((item) => (
                <Badge
                  key={item.id}
                  variant={selectedPackageType === item.id ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedPackageType(item.id)
                    setSelectedCat(null)
                  }}
                >
                  {item.label}
                </Badge>
              ))}
            </div>
          </div>
          {categories.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">二级主题</p>
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
            </div>
          )}
          {groups.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">所属系列</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant={!selectedGroup ? 'default' : 'outline'}
                  className="cursor-pointer" onClick={() => setSelectedGroup(null)}>
                  全部
                </Badge>
                {groups.map((group) => (
                  <Badge key={group.id} variant={selectedGroup === group.id ? 'default' : 'outline'}
                    className="cursor-pointer flex items-center gap-1"
                    onClick={() => setSelectedGroup(group.id)}>
                    {group.name}
                    <span className="text-xs opacity-60">({group.items?.length ?? 0})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scenes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="size-4" /> 学习包列表 ({filteredScenes.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <input
              ref={uploadRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploading(true)
                // 从文件名推断包目录名：去掉 .zip 后缀
                const pkgName = file.name.replace(/\.zip$/, '')
                if (!pkgName) { toast.error('无法识别文件名'); setUploading(false); return }
                try {
                  const res = await packageDataAdminApi.import(file, pkgName)
                  notifyContentTask((res as any).contentPrepareTaskId)
                  toast.success(`导入成功：${(res as any).sceneTitle ?? pkgName}（词汇${(res as any).vocabCount ?? 0} 话题${(res as any).topicCount ?? 0}）`)
                  load()
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || err?.message || '导入失败')
                } finally {
                  setUploading(false)
                  if (uploadRef.current) uploadRef.current.value = ''
                }
              }}
            />
            <Button size="sm" variant="outline" disabled={uploading}
              onClick={() => uploadRef.current?.click()}>
              {uploading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
              上传数据包
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/tasks')}>
              <Clock3 className="size-3.5 mr-1" /> 任务中心
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditScene(null); setSceneDialog(true) }}>
              <Plus className="size-3.5 mr-1" /> 新增学习包
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredScenes.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">暂无学习包</p>
              <p className="mt-1 text-xs text-muted-foreground/60">新增后会显示在这里</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">学习包</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">要求</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">付费</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">内容量</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageItems.map((s) => (
                    <tr
                      key={s.id}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => {
                        const next = new URLSearchParams(searchParams)
                        next.set('sceneId', s.id)
                        for (const key of ['topicId', 'dialog', 'tab']) next.delete(key)
                        setSearchParams(next, { replace: true })
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <span className="truncate text-sm font-medium" title={s.title}>{s.title}</span>
                          <div className="flex flex-wrap items-center gap-1">
                            {s.category && (
                              <Badge className="bg-purple-100 text-[11px] text-purple-700">{s.category.name}</Badge>
                            )}
                            <Badge className="bg-blue-100 text-[11px] text-blue-700">
                              {packageTypeLabel(s.packageType)}
                            </Badge>
                            <Badge className="bg-emerald-100 text-[11px] text-emerald-700">
                              {contentModeLabel(s.contentMode)}
                            </Badge>
                            {s.groupId && (
                              <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                {groupNameById.get(s.groupId) ?? '未命名系列'} · 第 {(s.sortOrder ?? 0) + 1} 包
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {s.requiredOutputLevel} · 用户 Lv.{s.requiredUserLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={!s.isFree}
                            disabled={updatingId === s.id}
                            onCheckedChange={(checked) => handlePaidChange(s, checked)}
                            aria-label={s.isFree ? '设为付费' : '设为免费'}
                            title={s.isFree ? '点击设为付费' : '点击设为免费'}
                          />
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className="text-[11px] font-normal">词 {s.contentStats?.vocabCount ?? 0}</Badge>
                            <Badge variant="outline" className="text-[11px] font-normal">句块 {s.contentStats?.chunkCount ?? 0}</Badge>
                            <Badge variant="outline" className="text-[11px] font-normal">句型 {s.contentStats?.patternCount ?? 0}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            话题 {s._count?.trainingTopics ?? 0} · 练习 {s.contentStats?.exerciseCount ?? 0} 题
                            {s._count?.storyEpisodes ? ` · 故事 ${s._count.storyEpisodes}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8" title="导出数据包"
                            disabled={exportingId === s.id}
                            onClick={async (e) => {
                              e.stopPropagation()
                              setExportingId(s.id)
                              try {
                                const buffer = await packageDataAdminApi.export(s.id)
                                const blob = new Blob([buffer], { type: 'application/zip' })
                                const url = URL.createObjectURL(blob)
                                const link = document.createElement('a')
                                link.href = url
                                link.download = `${s.packageType || 'daily'}-${(s.title || s.id).replace(/[^a-z0-9]+/g, '-').substring(0, 40)}.zip`
                                document.body.appendChild(link)
                                link.click()
                                link.remove()
                                URL.revokeObjectURL(url)
                                toast.success('导出成功')
                              } catch (err: any) {
                                toast.error(err?.message || '导出失败')
                              } finally {
                                setExportingId(null)
                              }
                            }}>
                            {exportingId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8" title="发送到任务中心执行内容准备"
                            disabled={updatingId === s.id}
                            onClick={async (e) => {
                              e.stopPropagation()
                              setUpdatingId(s.id)
                              try {
                                const result = await packageDataAdminApi.prepareContent(s.id)
                                notifyContentTask(result.taskId)
                                toast.success('已发送到任务中心', {
                                  action: { label: '查看', onClick: () => navigate('/admin/tasks') },
                                })
                              } catch (err: any) {
                                toast.error(err?.response?.data?.message || err?.message || '任务创建失败')
                              } finally {
                                setUpdatingId(null)
                              }
                            }}>
                            {updatingId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8" title="重新上传覆盖数据"
                            disabled={updatingId === s.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              const titleSlug = s.title?.replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/-+$/g, '') || s.id
                              const pkgName = `${s.packageType || 'daily'}-${titleSlug}`
                              const input = document.createElement('input')
                              input.type = 'file'
                              input.accept = '.zip'
                              input.onchange = async () => {
                                const file = input.files?.[0]
                                if (!file) return
                                setUpdatingId(s.id)
                                try {
                                  const res = await packageDataAdminApi.import(file, pkgName)
                                  notifyContentTask((res as any).contentPrepareTaskId)
                                  toast.success(`已覆盖：${(res as any).sceneTitle ?? pkgName}`)
                                  load()
                                } catch (err: any) {
                                  toast.error(err?.response?.data?.message || err?.message || '更新失败')
                                } finally {
                                  setUpdatingId(null)
                                }
                              }
                              input.click()
                            }}>
                            {updatingId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8"
                            onClick={(e) => { e.stopPropagation(); setEditScene(s); setSceneDialog(true) }}>
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8 text-destructive"
                            onClick={async (e) => { e.stopPropagation(); if (!confirm('确认删除此学习包？关联数据将一并清除。')) return; setUpdatingId(s.id); try { await packageDataAdminApi.delete(s.id); toast.success('已删除'); load(); } catch (err: any) { toast.error(err?.response?.data?.message || err?.message || '删除失败'); } finally { setUpdatingId(null); } }}>
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
            total={filteredScenes.length}
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
