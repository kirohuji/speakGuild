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
import { DictionaryPreview } from '../components/dictionary-preview'
import { getDictionaryEntry } from '../api-dictionary'
import type { DictionaryEntry } from '../api-dictionary'

const DIFFICULTIES = ['L1', 'L2', 'L3', 'L4', 'L5']
const DIFFICULTY_COLORS: Record<string, string> = {
  L1: 'bg-emerald-100 text-emerald-700', L2: 'bg-blue-100 text-blue-700',
  L3: 'bg-amber-100 text-amber-700', L4: 'bg-orange-100 text-orange-700',
  L5: 'bg-red-100 text-red-700',
}

/** Simple Markdown → HTML for description field */
function renderMd(text: string): string {
  return text
    // 1. 转义 HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // 2. 行内代码 `word` → 高亮英文术语
    .replace(/`([^`]+)`/g, '<code class="text-[13px] font-medium text-foreground/75 bg-muted px-1 py-0.5 rounded">$1</code>')
    // 3. 加粗
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground/80">$1</strong>')
    // 4. 无序列表
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // 5. 自动识别小节标题（注意：/ 易错点：/ 常见搭配/ 用法：/ 提示：）→ 加粗 + 前置间距
    .replace(/(?:^|(?<=\。)|(?<=<br\/>))\s*(注意|易错点|常见搭配|用法|提示|同义词|反义词|辨析)([:：])/g,
      '<br/><strong class="font-semibold text-foreground/75">$1$2</strong> ')
    // 6. 双换行 → 段落分隔
    .replace(/\n\n/g, '</p><p class="mb-2">')
    // 7. 单换行 → 行内换行
    .replace(/\n/g, '<br/>')
    // 8. 包裹为段落
    .replace(/^/, '<p class="mb-2 leading-relaxed">')
    .replace(/$/, '</p>');
}

/** 从英文释义中提取按词性分组的中文意思（兜底——去括号注释） */
function deriveMeaning(definitionsEn: string): string {
  if (!definitionsEn?.includes('; ')) return ''
  const zhByPos: Record<string, string[]> = {}
  definitionsEn.split('; ').forEach(d => {
    const colonIdx = d.indexOf(': ')
    const posRaw = colonIdx > 0 ? d.slice(0, colonIdx) : ''
    const pos = posRaw === 'verb' ? 'v.' : posRaw === 'noun' ? 'n.' : posRaw === 'adj' ? 'adj.' : posRaw === 'adv' ? 'adv.' : posRaw
    const zhMatch = d.match(/\s\s\[(.+?)\]$/)
    if (zhMatch && pos) {
      if (!zhByPos[pos]) zhByPos[pos] = []
      // 去掉括号注释和首尾标点，保留完整核心词
      const zhClean = zhMatch[1]
        .replace(/[（(][^)）]*[)）]/g, '')
        .replace(/^[。，,、\s]+|[。，,、\s]+$/g, '')
      if (zhClean && !zhByPos[pos].includes(zhClean)) zhByPos[pos].push(zhClean)
    }
  })
  if (Object.keys(zhByPos).length === 0) return ''
  return Object.entries(zhByPos)
    .map(([pos, zhs]) => `${pos} ${zhs.join('；')}`)
    .join('；')
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
  const [xfdLoading, setXfdLoading] = useState(false)
  const [wikiLoading, setWikiLoading] = useState(false)
  const [mwLoading, setMwLoading] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [usAudioPlaying, setUsAudioPlaying] = useState(false)
  const [ukAudioPlaying, setUkAudioPlaying] = useState(false)
  const [pendingDiff, setPendingDiff] = useState<any>(null) // { source, fields: { key: { old, new } } }
  const usAudioRef = useRef<HTMLAudioElement | null>(null)
  const ukAudioRef = useRef<HTMLAudioElement | null>(null)

  // Dictionary preview
  const [dictEntry, setDictEntry] = useState<DictionaryEntry | null>(null)
  const [dictPreview, setDictPreview] = useState(false)
  const [editExamples, setEditExamples] = useState(false)

  // Fetch dictionary entry when word changes
  useEffect(() => {
    if (!form.word?.trim() || !open) { setDictEntry(null); return }
    let cancelled = false
    getDictionaryEntry(form.word.trim()).then((e: any) => {
      if (!cancelled && e && e.word) setDictEntry(e)
      else if (!cancelled) setDictEntry(null)
    }).catch(() => { if (!cancelled) setDictEntry(null) })
    return () => { cancelled = true }
  }, [form.word, open])

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
    setPendingDiff(null)
  }

  /** 展示 diff：对比旧值和新值，只保留有变化的字段 */
  const showDiff = (source: string, newFields: Record<string, any>) => {
    const fields: Record<string, { old: any; new: any }> = {}
    for (const [key, newVal] of Object.entries(newFields)) {
      const oldVal = form[key]
      // 跳过无变化或空新值
      if (newVal === oldVal) continue
      if (newVal === '' || newVal === null || newVal === undefined) continue
      if (Array.isArray(newVal) && Array.isArray(oldVal) && JSON.stringify(newVal) === JSON.stringify(oldVal)) continue
      if (Array.isArray(newVal) && newVal.length === 0) continue
      fields[key] = { old: oldVal, new: newVal }
    }
    if (Object.keys(fields).length === 0) {
      toast.info(`${source}: 无新内容`)
      return
    }
    setPendingDiff({ source, fields })
  }

  /** 接受 diff 中的某个字段 */
  const acceptField = (key: string) => {
    if (!pendingDiff) return
    const newVal = pendingDiff.fields[key]?.new
    setForm((prev: any) => {
      const next = { ...prev, [key]: newVal }
      // 若采用了英文释义，自动推导中文释义
      if (key === 'definitionEn' && !next.meaning) {
        const derived = deriveMeaning(newVal)
        if (derived) next.meaning = derived
      }
      return next
    })
    const remaining = { ...pendingDiff.fields }
    delete remaining[key]
    if (Object.keys(remaining).length === 0) {
      setPendingDiff(null)
      toast.success(`${pendingDiff.source}: 全部已应用`)
    } else {
      setPendingDiff({ ...pendingDiff, fields: remaining })
    }
  }

  /** 接受 diff 全部字段 */
  const acceptAll = () => {
    if (!pendingDiff) return
    const updates: Record<string, any> = {}
    for (const [key, val] of Object.entries(pendingDiff.fields)) {
      updates[key] = (val as any).new
    }
    // 若更新了英文释义，自动推导中文释义
    if (updates.definitionEn && !updates.meaning) {
      const derived = deriveMeaning(updates.definitionEn)
      if (derived) updates.meaning = derived
    }
    setForm((prev: any) => ({ ...prev, ...updates }))
    setPendingDiff(null)
    toast.success(`${pendingDiff.source}: 已全部应用`)
  }

  /** 丢弃 diff */
  const dismissDiff = () => setPendingDiff(null)

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

  // Step 1: 查词典 + AI 翻译（合并执行）
  const handleDictionaryLookup = async () => {
    if (!form.word?.trim()) return
    setDictLoading(true)
    try {
      const { lookupWord, getBestPhonetic } = await import('@/lib/dictionary-api')
      const entries = await lookupWord(form.word)
      if (!entries?.length) { toast.info('词典未收录该词'); setDictLoading(false); return }

      const entry = entries[0]
      const phonetic = getBestPhonetic(entry) || ''

      // 分离美式/英式发音，规范化 URL（处理 // 协议相对路径）
      const normalizeAudio = (url: string) => {
        if (!url) return ''
        if (url.startsWith('//')) return `https:${url}`
        return url
      }
      const phoneticsWithAudio = entry.phonetics?.filter((p: any) => p.audio) || []
      const usAudio = normalizeAudio(phoneticsWithAudio[0]?.audio || '')
      const ukAudio = normalizeAudio(phoneticsWithAudio[1]?.audio || '')

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
      const examples = dictExamples.slice(0, 5)

      // 提取纯英文释义（不含中文），用于 AI 翻译
      const defs = entry.meanings?.flatMap(m =>
        m.definitions.map(d => `${m.partOfSpeech}: ${d.definition}`)
      ) || []
      const exsForAi = examples.map((e: any) => ({ en: e.en }))

      // 并行调用 AI 翻译
      let aiResult: any = null
      try {
        const { aiEnrichVocabulary } = await import('../api-content-admin')
        aiResult = await aiEnrichVocabulary({
          word: form.word.trim(),
          definitions: defs,
          examples: exsForAi,
        })
      } catch { /* AI 翻译失败不影响词典结果 */ }

      // 合并词典 + AI 翻译
      const defsWithZh = defs.map((d, i) => {
        const zh = aiResult?.definitionTranslations?.[i] ?? ''
        return zh ? `${d}  [${zh}]` : d
      }).join('; ')

      const translatedExs = examples.map((ex: any, i: number) => ({
        ...ex,
        zh: aiResult?.exampleTranslations?.[i] || ex.zh || '',
      }))

      const diffFields: Record<string, any> = {
        phoneticUs: phonetic,
        audioUsUrl: usAudio,
        audioUkUrl: ukAudio,
        definitionEn: defsWithZh,
        partOfSpeech: pos,
        examples: translatedExs,
      }
      if (aiResult?.description) diffFields.description = aiResult.description
      // 优先 AI 生成的简洁中文释义，兜底推导
      diffFields.meaning = aiResult?.meaning || deriveMeaning(defsWithZh)

      showDiff('词典+AI', diffFields)
    } catch { toast.error('词典查询失败') }
    finally { setDictLoading(false) }
  }

  // Step 2: XF 词典 (xfd.plus — 英英，含美/英音频分离)
  const handleXfdLookup = async () => {
    if (!form.word?.trim()) return
    setXfdLoading(true)
    try {
      const { lookupXfdWord } = await import('@/lib/xfd-dict-api')
      const result = await lookupXfdWord(form.word)
      if (!result) { toast.info('XF 词典未收录或未配置 API Key'); return }

      showDiff('XF 词典', {
        phoneticUs: result.phonetic,
        phoneticUk: result.phoneticUk,
        definitionEn: result.meanings?.map((m: any) => `${m.partOfSpeech}: ${m.definition}`).join('; '),
        partOfSpeech: result.meanings?.[0]?.partOfSpeech,
        examples: result.examples?.length
          ? result.examples.map((e: any) => ({ en: e.en, zh: e.zh || '', level: e.level || 'intermediate' }))
          : undefined,
      })
    } catch { toast.error('XF 词典查询失败') }
    finally { setXfdLoading(false) }
  }

  // Step 3: Wiktionary (免费，无 API Key)
  const handleWiktionaryLookup = async () => {
    if (!form.word?.trim()) return
    setWikiLoading(true)
    try {
      const { lookupWiktionary } = await import('@/lib/wiktionary-api')
      const result = await lookupWiktionary(form.word)
      if (!result) { toast.info('Wiktionary 未收录该词'); return }

      showDiff('Wiktionary', {
        partOfSpeech: result.partOfSpeech,
        audioUsUrl: result.audioUsUrl,
        audioUkUrl: result.audioUkUrl,
        definitionEn: result.definitions.map(d =>
          `${result.partOfSpeech || ''}: ${d.definition}${d.examples.length ? ` (e.g. ${d.examples[0]})` : ''}`
        ).join('; '),
        examples: result.definitions.flatMap(d =>
          d.examples.map(ex => ({ en: ex, zh: '', level: 'intermediate' as const }))
        ).slice(0, 5),
      })
    } catch { toast.error('Wiktionary 查询失败') }
    finally { setWikiLoading(false) }
  }

  // Step 4: Merriam-Webster (需 API Key)
  const handleMwLookup = async () => {
    if (!form.word?.trim()) return
    setMwLoading(true)
    try {
      const { lookupMwWord } = await import('@/lib/merriam-webster-api')
      const result = await lookupMwWord(form.word)
      if (!result) { toast.info('MW 词典未收录或未配置 API Key'); return }

      showDiff('Merriam-Webster', {
        partOfSpeech: result.partOfSpeech,
        phoneticUs: result.phonetic,
        audioUsUrl: result.audioUrl,
        definitionEn: result.definitions.map(d => `${result.partOfSpeech || ''}: ${d.definition}`).join('; '),
      })
    } catch { toast.error('MW 词典查询失败') }
    finally { setMwLoading(false) }
  }

  // Step 5: AI 翻译 + 讲解 (DeepSeek) — 独立补全按钮
  const handleAiEnrich = async () => {
    if (!form.word?.trim()) return
    setEnriching(true)
    try {
      const { aiEnrichVocabulary } = await import('../api-content-admin')

      // Parse current definitions from the semicolon-separated string
      const defs = (form.definitionEn ?? '').split('; ').filter(Boolean)
      const exs: { en: string }[] = (form.examples ?? []).map((e: any) => ({ en: e.en }))

      if (!defs.length && !exs.length) { toast.info('请先查词典获取英文释义'); return }

      const result = await aiEnrichVocabulary({
        word: form.word.trim(),
        definitions: defs,
        examples: exs,
      })

      // Merge definition translations back (format: "POS: def  [zh]")
      const defsWithZh = defs.map((d, i) => {
        const zh = result.definitionTranslations[i] ?? ''
        return zh ? `${d}  [${zh}]` : d
      }).join('; ')

      // Merge example translations
      const translatedExs = (form.examples ?? []).map((ex: any, i: number) => ({
        ...ex,
        zh: ex.zh || result.exampleTranslations[i] || '',
      }))

      const diffFields: Record<string, any> = {
        definitionEn: defsWithZh,
        description: result.description,
        examples: translatedExs,
        meaning: result.meaning || deriveMeaning(defsWithZh),
      }

      showDiff('AI 翻译', diffFields)
    } catch { toast.error('AI 翻译失败') }
    finally { setEnriching(false) }
  }

  // Audio playback — XF 音频需要 RapidAPI 认证，先 fetch 为 blob 再播放
  const toggleAudio = async (url: string | undefined, setPlaying: (v: boolean) => void, ref: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (!url) return
    setPlaying(true)
    try {
      // 如果已有缓存的 audio 且 URL 没变，直接切换播放/暂停
      if (ref.current && ref.current.src === url) {
        if (ref.current.paused) {
          await ref.current.play()
        } else {
          ref.current.pause()
          setPlaying(false)
        }
        return
      }
      // 停止旧音频
      if (ref.current) { ref.current.pause(); ref.current.src = '' }

      // XF (RapidAPI) 音频需要认证头，先下载为 blob
      const key = (import.meta as any).env?.VITE_XFD_API_KEY || ''
      const isXfdAudio = url.includes('rapidapi.com')
      let playableUrl = url
      if (isXfdAudio && key) {
        const res = await fetch(url, {
          headers: {
            'X-RapidAPI-Key': key,
            'X-RapidAPI-Host': 'xf-english-dictionary1.p.rapidapi.com',
          },
        })
        if (!res.ok) throw new Error('Failed to fetch audio')
        const blob = await res.blob()
        playableUrl = URL.createObjectURL(blob)
      }

      const audio = new Audio(playableUrl)
      audio.onended = () => setPlaying(false)
      audio.onerror = () => { setPlaying(false); toast.error('音频播放失败') }
      ref.current = audio
      await audio.play()
    } catch {
      setPlaying(false)
      toast.error('音频加载失败')
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? `编辑词汇 (${currentIdx + 1}/${items.length})` : '新增词汇'}</DialogTitle>
          <DialogDescription>词典+AI（一键查词+翻译）| XF · Wiki · MW 补充查询</DialogDescription>
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

          {/* Phonetic US + Phonetic UK */}
          <div className="grid grid-cols-2 gap-3">
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

          {/* English definition — formatted display + textarea fallback */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="v-defen">英文释义</Label>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-[11px] h-6 text-muted-foreground hover:text-foreground"
                  disabled={enriching || !form.word?.trim() || !form.definitionEn?.trim()}
                  onClick={handleAiEnrich}>
                  {enriching ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Sparkles className="mr-1 size-3" />}
                  AI 翻译补全
                </Button>
                {dictEntry && (
                  <button onClick={() => setDictPreview(!dictPreview)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    {dictPreview ? '编辑纯文本' : '查看词典预览'}
                  </button>
                )}
              </div>
            </div>
            {dictPreview && dictEntry ? (
              <div className="rounded-md border max-h-[60vh] overflow-y-auto">
                <DictionaryPreview entry={dictEntry} />
              </div>
            ) : form.definitionEn?.includes('; ') ? (
              (() => {
                // 解析每条释义：POS, 英文定义, 内联例句, 中文翻译
                const defs = form.definitionEn.split('; ').map((d: string) => {
                  const colonIdx = d.indexOf(': ');
                  const posRaw = colonIdx > 0 ? d.slice(0, colonIdx) : '';
                  const pos = posRaw === 'verb' ? 'v.' : posRaw === 'noun' ? 'n.' : posRaw === 'adj' ? 'adj.' : posRaw === 'adv' ? 'adv.' : posRaw;
                  const defWithZh = colonIdx > 0 ? d.slice(colonIdx + 2) : d;
                  // 提取末尾中文翻译 [...]
                  const zhMatch = defWithZh.match(/\s\s\[(.+?)\]$/);
                  const defBody = zhMatch ? defWithZh.slice(0, defWithZh.lastIndexOf('  [')).trim() : defWithZh;
                  const zh = zhMatch ? zhMatch[1] : '';
                  // 提取内联例句 (e.g. ...) 或 (eg. ...)
                  const egMatch = defBody.match(/\s\(e\.?g\.?,?\s(.+?)\)$/i);
                  const defClean = egMatch ? defBody.slice(0, defBody.lastIndexOf('(')).trim() : defBody;
                  const inlineEg = egMatch ? egMatch[1].replace(/\.$/, '') : '';
                  return { pos, def: defClean, inlineEg, zh };
                });

                // 按词性分组的中文释义摘要
                const zhByPos: Record<string, string[]> = {};
                defs.forEach(d => {
                  if (d.zh && d.pos) {
                    if (!zhByPos[d.pos]) zhByPos[d.pos] = [];
                    if (!zhByPos[d.pos].includes(d.zh)) zhByPos[d.pos].push(d.zh);
                  }
                });

                return (
                  <div className="rounded-md border bg-muted/20 p-3 max-h-[50vh] overflow-y-auto space-y-3">
                    {defs.map((d, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        {d.pos && (
                          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded min-w-[3rem] text-center shrink-0 mt-0.5">
                            {d.pos}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-relaxed">{d.def}</p>
                          {d.inlineEg && (
                            <p className="text-xs text-muted-foreground/50 italic mt-0.5 ml-0">
                              <span className="text-[10px] text-muted-foreground/30 not-italic mr-1">例</span>
                              {d.inlineEg}
                            </p>
                          )}
                          {d.zh && <p className="text-sm text-primary font-medium mt-0.5">{d.zh}</p>}
                        </div>
                      </div>
                    ))}

                    {/* 中文释义摘要（按词性分组） */}
                    {Object.keys(zhByPos).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <p className="text-[10px] text-muted-foreground/40 mb-1.5">中文释义摘要</p>
                        <div className="space-y-1">
                          {Object.entries(zhByPos).map(([pos, zhs]) => (
                            <div key={pos} className="flex gap-2 items-baseline text-xs">
                              <span className="text-[11px] font-bold uppercase text-muted-foreground/60 min-w-[2rem] shrink-0">{pos}</span>
                              <span className="text-muted-foreground">{zhs.join('；')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setForm((f: any) => ({ ...f, definitionEn: '' }))}
                      className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground"
                    >
                      清除并手动编辑
                    </button>
                  </div>
                );
              })()
            ) : (
              <Textarea id="v-defen" value={form.definitionEn ?? ''} onChange={e => setForm({ ...form, definitionEn: e.target.value })} placeholder="A large bedroom for a number of people..." rows={2} />
            )}
          </div>
          <div>
            <Label htmlFor="v-desc">讲解 / 描述</Label>
            {form.description ? (
              <div className="rounded-md border bg-muted/20 p-3 max-h-[30vh] overflow-y-auto">
                <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMd(form.description) }} />
                <button
                  onClick={() => setForm((f: any) => ({ ...f, description: '' }))}
                  className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground mt-2"
                >
                  清除
                </button>
              </div>
            ) : (
              <Textarea id="v-desc" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="用法、搭配、易错点（支持 Markdown）" rows={3} />
            )}
          </div>

          {/* Examples */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>例句</Label>
              <div className="flex items-center gap-2">
                {exs.length > 0 && (
                  <button onClick={() => setEditExamples(!editExamples)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    {editExamples ? '预览' : '编辑'}
                  </button>
                )}
              </div>
            </div>
            {exs.length > 0 && !editExamples ? (
              <div className="rounded-md border bg-muted/20 p-3 max-h-[40vh] overflow-y-auto space-y-2.5">
                {exs.map((ex: any, i: number) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-[10px] text-muted-foreground/30 tabular-nums min-w-[1.25rem] text-right pt-0.5 select-none">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground/80 italic leading-relaxed">{ex.en || '(空)'}</p>
                      {ex.zh && <p className="text-xs text-muted-foreground/60 mt-0.5">{ex.zh}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground/50 flex-shrink-0 ml-auto">
                      {ex.level === 'basic' ? '基础' : ex.level === 'advanced' ? '高级' : '中级'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
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
            )}
          </div>

          {/* Diff Panel — 查询结果对比 */}
          {pendingDiff && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-600">{pendingDiff.source} 返回了 {Object.keys(pendingDiff.fields).length} 项更新</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={acceptAll}>全部应用</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={dismissDiff}>忽略</Button>
                </div>
              </div>
              {Object.entries(pendingDiff.fields).map(([key, val]: [string, any]) => {
                const label: Record<string, string> = {
                  meaning: '中文释义', phoneticUs: '美式音标', audioUsUrl: '美式音频', audioUkUrl: '英式音频',
                  definitionEn: '英文释义', partOfSpeech: '词性', description: '讲解', examples: '例句',
                }
                const fmtDefs = (v: any) => {
                  if (Array.isArray(v)) return `${v.length} 条`
                  if (typeof v === 'string' && v.includes('; ')) return `${v.split('; ').length} 条释义`
                  return (v || '(空)')
                }
                const oldDisplay = fmtDefs(val.old)
                const newDisplay = fmtDefs(val.new)
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-muted-foreground flex-shrink-0">{label[key] || key}</span>
                    <span className="flex-1 truncate text-muted-foreground/60 line-through">{typeof oldDisplay === 'string' ? oldDisplay.slice(0, 40) : oldDisplay}</span>
                    <span className="text-amber-600 mx-1">→</span>
                    <span className="flex-1 truncate font-medium">{typeof newDisplay === 'string' ? newDisplay.slice(0, 40) : newDisplay}</span>
                    <Button size="sm" variant="outline" className="text-xs h-6 flex-shrink-0" onClick={() => acceptField(key)}>采用</Button>
                  </div>
                )
              })}
            </div>
          )}

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
                {dictLoading ? '翻译中...' : '查词典+AI'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleXfdLookup}
                disabled={xfdLoading || !form.word?.trim()}>
                {xfdLoading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <BookOpen className="mr-1 size-3.5" />}
                XF 词典
              </Button>
              <Button variant="outline" size="sm" onClick={handleWiktionaryLookup}
                disabled={wikiLoading || !form.word?.trim()}>
                {wikiLoading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Globe className="mr-1 size-3.5" />}
                Wiki
              </Button>
              <Button variant="outline" size="sm" onClick={handleMwLookup}
                disabled={mwLoading || !form.word?.trim()}>
                {mwLoading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <BookOpen className="mr-1 size-3.5" />}
                MW
              </Button>
              <Button variant="outline" size="sm" onClick={handleAiEnrich}
                disabled={enriching || !form.word?.trim()}>
                {enriching ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}
                翻译
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
