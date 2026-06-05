import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Plus, Trash2, Edit3, BookOpen, Sparkles, Loader2,
  Type, Code2, ChevronLeft, ChevronRight, Play, Pause, Upload, Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { AdminPagination } from '../components/admin-pagination'
import * as api from '../api-content-admin'

const DIFFICULTIES = ['L1', 'L2', 'L3', 'L4', 'L5']
const DIFFICULTY_COLORS: Record<string, string> = {
  L1: 'bg-emerald-100 text-emerald-700', L2: 'bg-blue-100 text-blue-700',
  L3: 'bg-amber-100 text-amber-700', L4: 'bg-orange-100 text-orange-700',
  L5: 'bg-red-100 text-red-700',
}

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export function AdminContentLibraryPage() {
  const [tab, setTab] = useState('vocabularies')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">内容语料库</h1>
        <p className="text-sm text-muted-foreground">管理词汇、句块 (Chunk) 和句式，支持搜索、筛选、AI 富化</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="vocabularies"><BookOpen className="mr-1.5 size-4" />词汇</TabsTrigger>
          <TabsTrigger value="chunks"><Type className="mr-1.5 size-4" />句块 Chunk</TabsTrigger>
          <TabsTrigger value="patterns"><Code2 className="mr-1.5 size-4" />句式 Pattern</TabsTrigger>
        </TabsList>

        <TabsContent value="vocabularies" className="mt-4 space-y-4">
          <VocabularyTab />
        </TabsContent>
        <TabsContent value="chunks" className="mt-4 space-y-4">
          <ChunkTab />
        </TabsContent>
        <TabsContent value="patterns" className="mt-4 space-y-4">
          <PatternTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Vocabulary Tab
// ═══════════════════════════════════════════════════════════════

function VocabularyTab() {
  const [data, setData] = useState<api.PaginatedResult<api.VocabularyFull> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<api.VocabularyFull | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api.listLibraryVocabularies({ search, difficulty, page, pageSize })) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [search, difficulty, page, pageSize])

  useEffect(() => { load() }, [load])

  const totalPages = data?.totalPages ?? 1

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索词汇..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <Select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1) }} className="w-28">
            <option value="">全部等级</option>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="mr-1.5 size-4" />新增词汇
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">词汇列表 {data && <span className="ml-2 text-sm font-normal text-muted-foreground">共 {data.total} 个</span>}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          : !data || data.items.length === 0 ? <div className="flex flex-col items-center py-12 text-muted-foreground"><BookOpen className="mb-3 size-10 text-muted-foreground/40" /><p>暂无词汇</p></div>
          : <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="pb-2.5 px-4 font-medium">单词</th>
                <th className="pb-2.5 px-4 font-medium">释义</th>
                <th className="pb-2.5 px-4 font-medium hidden md:table-cell">音标</th>
                <th className="pb-2.5 px-4 font-medium hidden lg:table-cell">等级</th>
                <th className="pb-2.5 px-4 text-right font-medium">操作</th>
              </tr></thead>
              <tbody>
                {data.items.map(v => (
                  <tr key={v.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 px-4 font-medium">{v.word}</td>
                    <td className="py-2.5 px-4 text-muted-foreground truncate max-w-[200px]">{v.meaning}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs font-mono hidden md:table-cell">{v.phoneticUs || '-'}</td>
                    <td className="py-2.5 px-4 hidden lg:table-cell">
                      <Badge className={DIFFICULTY_COLORS[v.difficulty] ?? 'bg-muted text-muted-foreground'}>{v.difficulty}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" title="AI 富化"
                          onClick={async () => { await api.enrichVocabulary(v.id); toast.success('富化完成'); load() }}>
                          <Sparkles className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8"
                          onClick={() => { setEditing(v); setDialogOpen(true) }}>
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 text-destructive"
                          onClick={async () => { if (confirm(`删除 "${v.word}"？`)) { await api.deleteLibraryVocabulary(v.id); load() } }}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
          <AdminPagination total={data?.total ?? 0} page={Math.min(page, totalPages)} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} />
        </CardContent>
      </Card>

      <VocabularyDialog open={dialogOpen} onClose={() => setDialogOpen(false)}
        edit={editing} items={data?.items ?? []} onSaved={load} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Chunk Tab
// ═══════════════════════════════════════════════════════════════

function ChunkTab() {
  const [data, setData] = useState<api.PaginatedResult<api.ChunkFull> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<api.ChunkFull | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api.listLibraryChunks({ search, difficulty, page, pageSize })) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [search, difficulty, page, pageSize])

  useEffect(() => { load() }, [load])

  const totalPages = data?.totalPages ?? 1

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索句块..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <Select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1) }} className="w-28">
            <option value="">全部等级</option>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="mr-1.5 size-4" />新增句块
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">句块列表 {data && <span className="ml-2 text-sm font-normal text-muted-foreground">共 {data.total} 个</span>}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          : !data || data.items.length === 0 ? <div className="flex flex-col items-center py-12 text-muted-foreground"><Type className="mb-3 size-10 text-muted-foreground/40" /><p>暂无句块</p></div>
          : <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="pb-2.5 px-4 font-medium">句块</th>
                <th className="pb-2.5 px-4 font-medium">释义</th>
                <th className="pb-2.5 px-4 font-medium hidden lg:table-cell">例句数</th>
                <th className="pb-2.5 px-4 font-medium hidden md:table-cell">等级</th>
                <th className="pb-2.5 px-4 text-right font-medium">操作</th>
              </tr></thead>
              <tbody>
                {data.items.map(c => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 px-4 font-medium">{c.text}</td>
                    <td className="py-2.5 px-4 text-muted-foreground truncate max-w-[200px]">{c.meaning}</td>
                    <td className="py-2.5 px-4 hidden lg:table-cell text-muted-foreground">{c.examples?.length ?? 0}</td>
                    <td className="py-2.5 px-4 hidden md:table-cell">
                      <Badge className={DIFFICULTY_COLORS[c.difficulty] ?? 'bg-muted text-muted-foreground'}>{c.difficulty}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8"
                          onClick={() => { setEditing(c); setDialogOpen(true) }}>
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 text-destructive"
                          onClick={async () => { if (confirm(`删除 "${c.text}"？`)) { await api.deleteLibraryChunk(c.id); load() } }}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
          <AdminPagination total={data?.total ?? 0} page={Math.min(page, totalPages)} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} />
        </CardContent>
      </Card>

      <ChunkDialog open={dialogOpen} onClose={() => setDialogOpen(false)} edit={editing} onSaved={load} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Pattern Tab
// ═══════════════════════════════════════════════════════════════

function PatternTab() {
  const [data, setData] = useState<api.PaginatedResult<api.SentencePatternFull> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<api.SentencePatternFull | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api.listLibraryPatterns({ search, difficulty, page, pageSize })) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [search, difficulty, page, pageSize])

  useEffect(() => { load() }, [load])

  const totalPages = data?.totalPages ?? 1

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索句式..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <Select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1) }} className="w-28">
            <option value="">全部等级</option>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="mr-1.5 size-4" />新增句式
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">句式列表 {data && <span className="ml-2 text-sm font-normal text-muted-foreground">共 {data.total} 个</span>}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          : !data || data.items.length === 0 ? <div className="flex flex-col items-center py-12 text-muted-foreground"><Code2 className="mb-3 size-10 text-muted-foreground/40" /><p>暂无句式</p></div>
          : <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="pb-2.5 px-4 font-medium">句式</th>
                <th className="pb-2.5 px-4 font-medium">释义</th>
                <th className="pb-2.5 px-4 font-medium hidden lg:table-cell">例句</th>
                <th className="pb-2.5 px-4 font-medium hidden md:table-cell">等级</th>
                <th className="pb-2.5 px-4 text-right font-medium">操作</th>
              </tr></thead>
              <tbody>
                {data.items.map(p => (
                  <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 px-4 font-mono font-medium text-sm">{p.pattern}</td>
                    <td className="py-2.5 px-4 text-muted-foreground truncate max-w-[200px]">{p.meaning || '-'}</td>
                    <td className="py-2.5 px-4 hidden lg:table-cell text-muted-foreground truncate max-w-[300px]">{p.example || '-'}</td>
                    <td className="py-2.5 px-4 hidden md:table-cell">
                      <Badge className={DIFFICULTY_COLORS[p.difficulty] ?? 'bg-muted text-muted-foreground'}>{p.difficulty}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8"
                          onClick={() => { setEditing(p); setDialogOpen(true) }}>
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 text-destructive"
                          onClick={async () => { if (confirm(`删除 "${p.pattern}"？`)) { await api.deleteLibraryPattern(p.id); load() } }}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
          <AdminPagination total={data?.total ?? 0} page={Math.min(page, totalPages)} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} />
        </CardContent>
      </Card>

      <PatternDialog open={dialogOpen} onClose={() => setDialogOpen(false)} edit={editing} onSaved={load} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Vocabulary Dialog
// ═══════════════════════════════════════════════════════════════

function VocabularyDialog({ open, onClose, edit, items, onSaved }: {
  open: boolean; onClose: () => void; edit: api.VocabularyFull | null;
  items: api.VocabularyFull[]; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [dictLoading, setDictLoading] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [usAudioPlaying, setUsAudioPlaying] = useState(false)
  const [ukAudioPlaying, setUkAudioPlaying] = useState(false)
  const usAudioRef = useRef<HTMLAudioElement | null>(null)
  const ukAudioRef = useRef<HTMLAudioElement | null>(null)

  // Sync edit → form + index
  useEffect(() => {
    if (!open) return
    if (edit) {
      setForm(edit)
      const idx = items.findIndex(v => v.id === edit.id)
      setCurrentIdx(idx >= 0 ? idx : 0)
    } else {
      setForm({ word: '', meaning: '', difficulty: 'L1', sortOrder: 0, synonyms: [], examples: [] })
      setCurrentIdx(0)
    }
  }, [edit, open, items])

  // Navigate prev/next in current list
  const navigate = (dir: -1 | 1) => {
    if (!items.length) return
    const next = (currentIdx + dir + items.length) % items.length
    setCurrentIdx(next)
    setForm(items[next])
  }

  const handleSave = async () => {
    if (!form.word?.trim() || !form.meaning?.trim()) return
    setSaving(true)
    try {
      if (edit) await api.updateLibraryVocabulary(edit.id, form)
      else await api.createLibraryVocabulary(form)
      toast.success('已保存')
      onSaved(); onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  // Step 1: 查词典 (dictionaryapi.dev — 前端直调，免费即时)
  const handleDictionaryLookup = async () => {
    if (!form.word?.trim()) return
    setDictLoading(true)
    try {
      const { lookupWord, getBestPhonetic } = await import('@/lib/dictionary-api')
      const entries = await lookupWord(form.word)
      if (!entries?.length) { toast.info('词典未收录该词'); return }

      const entry = entries[0]
      const phonetic = getBestPhonetic(entry) || ''

      // 分离美式/英式发音：phonetics 数组通常第一条美音、第二条英音
      const phoneticsWithAudio = entry.phonetics?.filter((p: any) => p.audio) || []
      const usAudio = phoneticsWithAudio[0]?.audio || ''
      const ukAudio = phoneticsWithAudio[1]?.audio || ''

      const meanings = entry.meanings?.flatMap(m =>
        m.definitions.map(d => `${m.partOfSpeech}: ${d.definition}`)
      ).join('; ') || ''
      const pos = entry.meanings?.[0]?.partOfSpeech || ''

      // 提取例句
      const dictExamples: any[] = []
      const seenEx = new Set<string>()
      entry.meanings?.forEach(m =>
        m.definitions.forEach(d => {
          if (d.example && !seenEx.has(d.example)) {
            seenEx.add(d.example)
            dictExamples.push({ en: d.example, zh: '', level: 'intermediate' })
          }
        })
      )

      setForm((prev: any) => ({
        ...prev,
        meaning: prev.meaning || '',
        phoneticUs: phonetic,
        phoneticUk: '',
        audioUsUrl: usAudio || prev.audioUsUrl,
        audioUkUrl: ukAudio || prev.audioUkUrl,
        definitionEn: meanings || prev.definitionEn,
        partOfSpeech: pos || prev.partOfSpeech,
        examples: dictExamples.length ? dictExamples.slice(0, 5) : prev.examples,
      }))
      toast.success(`词典查询完成: ${entry.word}`)
    } catch { toast.error('词典查询失败') }
    finally { setDictLoading(false) }
  }

  // Step 2: AI 生成 (后端 enrichWord: DB 缓存 → dictionaryapi → DeepSeek)
  const handleAiEnrich = async () => {
    if (!form.word?.trim()) return
    setEnriching(true)
    try {
      const { enrichWord } = await import('@/lib/practice-ai-api')
      const enriched = await enrichWord(form.word)
      setForm((prev: any) => ({
        ...prev,
        meaning: enriched.chineseTranslation || prev.meaning,
        phoneticUs: enriched.phonetic || '',
        audioUsUrl: enriched.audioUrl || prev.audioUsUrl,
        definitionEn: enriched.meanings?.map((m: any) => `(${m.partOfSpeech}) ${m.chineseGloss}`).join('; ') || '',
        partOfSpeech: enriched.meanings?.[0]?.partOfSpeech || '',
        description: enriched.memoryTip || '',
        examples: enriched.examples?.length ? enriched.examples : prev.examples,
      }))
      toast.success('AI 生成完成')
    } catch { toast.error('AI 生成失败') }
    finally { setEnriching(false) }
  }

  // Audio playback toggle
  const toggleAudio = (url: string | undefined, setPlaying: (v: boolean) => void, ref: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (!url) return
    if (!ref.current) {
      ref.current = new Audio(url)
      ref.current.onended = () => setPlaying(false)
      ref.current.onerror = () => setPlaying(false)
    }
    if (ref.current.paused) {
      ref.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      ref.current.pause()
      setPlaying(false)
    }
  }

  // Upload audio handler
  const handleAudioUpload = async (side: 'us' | 'uk', file: File) => {
    const { uploadFileToCosAndComplete } = await import('@/features/file-assets/api')
    try {
      const asset = await uploadFileToCosAndComplete({ file, group: 'library' })
      const { getFileAssetLongLivedUrl } = await import('@/features/file-assets/api')
      const { url } = await getFileAssetLongLivedUrl(asset.id)
      setForm((prev: any) => ({ ...prev, [side === 'us' ? 'audioUsUrl' : 'audioUkUrl']: url }))
      toast.success(`${side === 'us' ? '美式' : '英式'}音频已上传`)
    } catch { toast.error('上传失败') }
  }

  const exs: any[] = form.examples ?? []
  const setEx = (idx: number, field: string, val: string) => {
    const arr = [...exs]; arr[idx] = { ...arr[idx], [field]: val }; setForm({ ...form, examples: arr })
  }
  const addEx = () => setForm({ ...form, examples: [...exs, { en: '', zh: '', level: 'basic' }] })
  const delEx = (idx: number) => setForm({ ...form, examples: exs.filter((_: any, i: number) => i !== idx) })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? `编辑词汇 (${currentIdx + 1}/${items.length})` : '新增词汇'}</DialogTitle>
          <DialogDescription>三步富化：本地 DB → dictionaryapi.dev → AI</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Word + Meaning */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="v-word">单词 *</Label>
              <Input id="v-word" value={form.word ?? ''} onChange={e => setForm({ ...form, word: e.target.value })} placeholder="dormitory" />
            </div>
            <div className="flex-1">
              <Label htmlFor="v-meaning">中文释义 *</Label>
              <Input id="v-meaning" value={form.meaning ?? ''} onChange={e => setForm({ ...form, meaning: e.target.value })} placeholder="宿舍" />
            </div>
          </div>

          {/* PartOfSpeech + Phonetic US + Phonetic UK */}
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="v-pos">词性</Label><Input id="v-pos" value={form.partOfSpeech ?? ''} onChange={e => setForm({ ...form, partOfSpeech: e.target.value })} placeholder="noun" /></div>
            <div><Label htmlFor="v-phus">美式音标</Label><Input id="v-phus" value={form.phoneticUs ?? ''} onChange={e => setForm({ ...form, phoneticUs: e.target.value })} placeholder="/ˈdɔːrməˌtɔri/" /></div>
            <div><Label htmlFor="v-phuk">英式音标</Label><Input id="v-phuk" value={form.phoneticUk ?? ''} onChange={e => setForm({ ...form, phoneticUk: e.target.value })} placeholder="/ˈdɔːmɪtri/" /></div>
          </div>

          {/* US Audio + UK Audio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>美式发音</Label>
              <div className="flex items-center gap-2">
                {form.audioUsUrl ? (
                  <>
                    <Button size="sm" variant="outline"
                      onClick={() => toggleAudio(form.audioUsUrl, setUsAudioPlaying, usAudioRef)}>
                      {usAudioPlaying ? <Pause className="size-3.5 mr-1" /> : <Play className="size-3.5 mr-1" />}
                      {usAudioPlaying ? '暂停' : '试听'}
                    </Button>
                    <span className="text-xs text-muted-foreground truncate flex-1">已上传</span>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setForm({ ...form, audioUsUrl: '' })}>清除</Button>
                  </>
                ) : (
                  <label className="cursor-pointer flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Upload className="size-3.5" />
                    上传 mp3
                    <input type="file" accept="audio/mp3,audio/mpeg,.mp3" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioUpload('us', f) }} />
                  </label>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>英式发音</Label>
              <div className="flex items-center gap-2">
                {form.audioUkUrl ? (
                  <>
                    <Button size="sm" variant="outline"
                      onClick={() => toggleAudio(form.audioUkUrl, setUkAudioPlaying, ukAudioRef)}>
                      {ukAudioPlaying ? <Pause className="size-3.5 mr-1" /> : <Play className="size-3.5 mr-1" />}
                      {ukAudioPlaying ? '暂停' : '试听'}
                    </Button>
                    <span className="text-xs text-muted-foreground truncate flex-1">已上传</span>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setForm({ ...form, audioUkUrl: '' })}>清除</Button>
                  </>
                ) : (
                  <label className="cursor-pointer flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Upload className="size-3.5" />
                    上传 mp3
                    <input type="file" accept="audio/mp3,audio/mpeg,.mp3" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioUpload('uk', f) }} />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Difficulty + SortOrder */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="v-diff">难度</Label>
              <Select id="v-diff" value={form.difficulty ?? 'L1'} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="v-sort">排序</Label>
              <Input id="v-sort" type="number" value={form.sortOrder ?? 0} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </div>
          </div>

          {/* Definition + Description */}
          <div><Label htmlFor="v-defen">英文释义</Label><Textarea id="v-defen" value={form.definitionEn ?? ''} onChange={e => setForm({ ...form, definitionEn: e.target.value })} placeholder="A large bedroom for a number of people..." rows={2} /></div>
          <div><Label htmlFor="v-desc">讲解 / 描述</Label><Textarea id="v-desc" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="用法、搭配、易错点（Markdown）" rows={2} /></div>

          {/* Examples */}
          <div>
            <Label>例句</Label>
            <div className="space-y-2 mt-1">
              {exs.map((ex: any, i: number) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input value={ex.en ?? ''} onChange={e => setEx(i, 'en', e.target.value)} placeholder={`英文例句 ${i + 1}`} className="text-sm" />
                    <Input value={ex.zh ?? ''} onChange={e => setEx(i, 'zh', e.target.value)} placeholder="中文翻译" className="text-sm" />
                  </div>
                  <Select value={ex.level ?? 'basic'} onChange={e => setEx(i, 'level', e.target.value)} className="w-24 text-xs">
                    <option value="basic">基础</option><option value="intermediate">中级</option><option value="advanced">高级</option>
                  </Select>
                  <Button size="icon" variant="ghost" className="size-8 text-destructive flex-shrink-0" onClick={() => delEx(i)}><Trash2 className="size-3" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addEx}><Plus className="mr-1 size-3" />添加例句</Button>
            </div>
          </div>

          {/* Bottom bar: prev/next + step buttons + save */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-2">
            {/* Left: prev/next navigation */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={!edit || items.length <= 1}
                onClick={() => navigate(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                {items.length ? `${currentIdx + 1} / ${items.length}` : '-'}
              </span>
              <Button variant="ghost" size="sm" disabled={!edit || items.length <= 1}
                onClick={() => navigate(1)}>
                <ChevronRight className="size-4" />
              </Button>
              {/* Manual step buttons */}
              <Button variant="outline" size="sm" onClick={handleDictionaryLookup}
                disabled={dictLoading || !form.word?.trim()}>
                {dictLoading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Globe className="mr-1 size-3.5" />}
                查词典
              </Button>
              <Button variant="outline" size="sm" onClick={handleAiEnrich}
                disabled={enriching || !form.word?.trim()}>
                {enriching ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}
                AI 生成
              </Button>
            </div>
            {/* Right: cancel + save */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>取消</Button>
              <Button onClick={handleSave} disabled={saving}>{edit ? '保存' : '创建'}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// Chunk Dialog
// ═══════════════════════════════════════════════════════════════

function ChunkDialog({ open, onClose, edit, onSaved }: {
  open: boolean; onClose: () => void; edit: api.ChunkFull | null; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) setForm(edit)
    else setForm({ text: '', meaning: '', difficulty: 'L2', category: '', examples: [] })
  }, [edit, open])

  const handleSave = async () => {
    if (!form.text?.trim() || !form.meaning?.trim()) return
    setSaving(true)
    try {
      if (edit) await api.updateLibraryChunk(edit.id, form)
      else await api.createLibraryChunk(form)
      toast.success('已保存')
      onSaved(); onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  const exs: any[] = form.examples ?? []
  const setEx = (idx: number, field: string, val: string) => {
    const arr = [...exs]
    arr[idx] = { ...arr[idx], [field]: val }
    setForm({ ...form, examples: arr })
  }
  const addEx = () => setForm({ ...form, examples: [...exs, { en: '', zh: '', level: 'basic' }] })
  const delEx = (idx: number) => setForm({ ...form, examples: exs.filter((_: any, i: number) => i !== idx) })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑句块' : '新增句块'}</DialogTitle>
          <DialogDescription>句块是可迁移的表达单元，如 "I'm here to check in"</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="c-text">句块 *</Label>
              <Input id="c-text" value={form.text ?? ''} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="I'm here to check in" />
            </div>
            <div className="flex-1">
              <Label htmlFor="c-meaning">中文释义 *</Label>
              <Input id="c-meaning" value={form.meaning ?? ''} onChange={e => setForm({ ...form, meaning: e.target.value })} placeholder="我来办理入住" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="c-cat">分类</Label>
              <Input id="c-cat" value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="酒店/旅行" />
            </div>
            <div>
              <Label htmlFor="c-diff">难度</Label>
              <Select id="c-diff" value={form.difficulty ?? 'L2'} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="c-desc">讲解 / 描述</Label>
            <Textarea id="c-desc" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="用法搭配说明（Markdown）" />
          </div>
          <div>
            <Label>例句</Label>
            <div className="space-y-2 mt-1">
              {exs.map((ex: any, i: number) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input value={ex.en ?? ''} onChange={e => setEx(i, 'en', e.target.value)} placeholder={`英文例句 ${i + 1}`} className="text-sm" />
                    <Input value={ex.zh ?? ''} onChange={e => setEx(i, 'zh', e.target.value)} placeholder="中文翻译" className="text-sm" />
                  </div>
                  <Select value={ex.level ?? 'basic'} onChange={e => setEx(i, 'level', e.target.value)} className="w-24 text-xs">
                    <option value="basic">基础</option>
                    <option value="intermediate">中级</option>
                    <option value="advanced">高级</option>
                  </Select>
                  <Button size="icon" variant="ghost" className="size-8 text-destructive flex-shrink-0" onClick={() => delEx(i)}><Trash2 className="size-3" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addEx}><Plus className="mr-1 size-3" />添加例句</Button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{edit ? '保存' : '创建'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// Pattern Dialog
// ═══════════════════════════════════════════════════════════════

function PatternDialog({ open, onClose, edit, onSaved }: {
  open: boolean; onClose: () => void; edit: api.SentencePatternFull | null; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) setForm(edit)
    else setForm({ pattern: '', meaning: '', difficulty: 'L2', example: '' })
  }, [edit, open])

  const handleSave = async () => {
    if (!form.pattern?.trim()) return
    setSaving(true)
    try {
      if (edit) await api.updateLibraryPattern(edit.id, form)
      else await api.createLibraryPattern(form)
      toast.success('已保存')
      onSaved(); onClose()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? '编辑句式' : '新增句式'}</DialogTitle>
          <DialogDescription>句式如 "__ is the __ I have ever __"，用 __ 表示可替换槽位</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="p-pattern">句式 *</Label>
              <Input id="p-pattern" value={form.pattern ?? ''} onChange={e => setForm({ ...form, pattern: e.target.value })} placeholder="__ is the __ I have ever __" className="font-mono" />
            </div>
            <div className="flex-1">
              <Label htmlFor="p-meaning">释义</Label>
              <Input id="p-meaning" value={form.meaning ?? ''} onChange={e => setForm({ ...form, meaning: e.target.value })} placeholder="这是我__过的最__的__" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-diff">难度</Label>
              <Select id="p-diff" value={form.difficulty ?? 'L2'} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="p-example">完整例句</Label>
            <Textarea id="p-example" value={form.example ?? ''} onChange={e => setForm({ ...form, example: e.target.value })} rows={2} placeholder="This is the best movie I have ever watched." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{edit ? '保存' : '创建'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
