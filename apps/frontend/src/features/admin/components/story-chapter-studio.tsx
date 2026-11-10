import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, FilePlus2, Loader2, Pencil, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import {
  createScriptEpisode,
  createStory,
  getScriptEpisode,
  getStory,
  listLibraryChunks,
  listLibraryPatterns,
  listLibraryVocabularies,
  listScriptEpisodes,
  updateScriptEpisode,
  updateStory,
  type ChunkFull,
  type GameCharacter,
  type GameLocationData,
  type SentencePatternFull,
  type StoryData,
  type StoryEpisode,
  type VocabularyFull,
} from '../api-content-admin'
import {
  InkStoryEditor,
  type ChapterMaterialItem,
  type ChapterMaterialKind,
} from './ink-story-editor'

interface StoryChapterStudioProps {
  packageId: string
  characters: GameCharacter[]
  locations: GameLocationData[]
}

function storyKey(chapter: StoryEpisode) {
  return `story.${chapter.sceneId}.${chapter.chapterId}`
}

function toVocabItem(item: VocabularyFull | { id: string; word: string; meaning: string }): ChapterMaterialItem {
  return { id: item.id, primary: item.word, secondary: item.meaning }
}

function toChunkItem(item: ChunkFull | { id: string; text: string; meaning: string }): ChapterMaterialItem {
  return { id: item.id, primary: item.text, secondary: item.meaning }
}

function toPatternItem(item: SentencePatternFull | { id: string; pattern: string; meaning?: string | null }): ChapterMaterialItem {
  return { id: item.id, primary: item.pattern, secondary: item.meaning ?? null }
}

function mergeMaterialItems(selected: ChapterMaterialItem[], candidates: ChapterMaterialItem[]) {
  const map = new Map<string, ChapterMaterialItem>()
  ;[...selected, ...candidates].forEach((item) => {
    if (!map.has(item.id)) map.set(item.id, item)
  })
  return [...map.values()]
}

export function StoryChapterStudio({ packageId, characters, locations }: StoryChapterStudioProps) {
  const [chapters, setChapters] = useState<StoryEpisode[]>([])
  const [selected, setSelected] = useState<StoryEpisode | null>(null)
  const [story, setStory] = useState<StoryData | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingStory, setSavingStory] = useState(false)
  const [savingChapter, setSavingChapter] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '', order: 1 })
  const [chapterForm, setChapterForm] = useState({ name: '', description: '', order: 1 })

  const [selectedVocabIds, setSelectedVocabIds] = useState<string[]>([])
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([])
  const [selectedPatternIds, setSelectedPatternIds] = useState<string[]>([])
  const [vocabItems, setVocabItems] = useState<ChapterMaterialItem[]>([])
  const [chunkItems, setChunkItems] = useState<ChapterMaterialItem[]>([])
  const [patternItems, setPatternItems] = useState<ChapterMaterialItem[]>([])
  const [materialQueries, setMaterialQueries] = useState<Record<ChapterMaterialKind, string>>({
    pattern: '',
    chunk: '',
    vocab: '',
  })
  const [materialsSaving, setMaterialsSaving] = useState(false)
  const materialSearchSeq = useRef({ pattern: 0, chunk: 0, vocab: 0 })
  const selectedIdsRef = useRef({ vocab: selectedVocabIds, chunk: selectedChunkIds, pattern: selectedPatternIds })
  selectedIdsRef.current = { vocab: selectedVocabIds, chunk: selectedChunkIds, pattern: selectedPatternIds }

  const syncMaterialsFromEpisode = useCallback((episode: StoryEpisode | null) => {
    const vocabs = (episode?.coreVocabularies ?? [])
      .map((item) => item.vocab ? toVocabItem(item.vocab) : item.vocabId ? { id: item.vocabId, primary: item.vocabId, secondary: null } : null)
      .filter(Boolean) as ChapterMaterialItem[]
    const chunks = (episode?.coreChunks ?? [])
      .map((item) => item.chunk ? toChunkItem(item.chunk) : item.chunkId ? { id: item.chunkId, primary: item.chunkId, secondary: null } : null)
      .filter(Boolean) as ChapterMaterialItem[]
    const patterns = (episode?.corePatterns ?? [])
      .map((item) => item.pattern ? toPatternItem(item.pattern) : item.patternId ? { id: item.patternId, primary: item.patternId, secondary: null } : null)
      .filter(Boolean) as ChapterMaterialItem[]

    setSelectedVocabIds(vocabs.map((item) => item.id))
    setSelectedChunkIds(chunks.map((item) => item.id))
    setSelectedPatternIds(patterns.map((item) => item.id))
    setVocabItems(vocabs)
    setChunkItems(chunks)
    setPatternItems(patterns)
    setMaterialQueries({ pattern: '', chunk: '', vocab: '' })
  }, [])

  const loadChapters = useCallback(async (selectId?: string) => {
    setLoading(true)
    try {
      const items = await listScriptEpisodes(packageId)
      setChapters(items)
      const target = items.find((item) => item.id === selectId) ?? items[0]
      const detail = target ? await getScriptEpisode(target.id) : null
      setSelected(detail)
      syncMaterialsFromEpisode(detail)
      setStory(null)
    } finally { setLoading(false) }
  }, [packageId, syncMaterialsFromEpisode])

  useEffect(() => { void loadChapters() }, [loadChapters])

  useEffect(() => {
    if (!selected) return
    setChapterForm({ name: selected.chapterTitle || selected.title, description: selected.description ?? '', order: selected.episodeOrder })
    if (!selected.inkScriptId) { setStory(null); return }
    getStory(selected.inkScriptId).then(setStory).catch(() => setStory(null))
  }, [selected])

  useEffect(() => {
    const materialKind: ChapterMaterialKind = 'pattern'
    const query = materialQueries.pattern.trim()
    const seq = ++materialSearchSeq.current[materialKind]
    const timer = setTimeout(() => {
      void (async () => {
        if (!query) {
          if (seq !== materialSearchSeq.current[materialKind]) return
          setPatternItems((current) => current.filter((item) => selectedIdsRef.current.pattern.includes(item.id)))
          return
        }
        try {
          const result = await listLibraryPatterns({ search: query, page: 1, pageSize: 30 })
          if (seq !== materialSearchSeq.current[materialKind]) return
          setPatternItems((current) => mergeMaterialItems(
            current.filter((item) => selectedIdsRef.current.pattern.includes(item.id)),
            result.items.map(toPatternItem),
          ))
        } catch { /* keep shelf */ }
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [materialQueries.pattern])

  useEffect(() => {
    const materialKind: ChapterMaterialKind = 'chunk'
    const query = materialQueries.chunk.trim()
    const seq = ++materialSearchSeq.current[materialKind]
    const timer = setTimeout(() => {
      void (async () => {
        if (!query) {
          if (seq !== materialSearchSeq.current[materialKind]) return
          setChunkItems((current) => current.filter((item) => selectedIdsRef.current.chunk.includes(item.id)))
          return
        }
        try {
          const result = await listLibraryChunks({ search: query, page: 1, pageSize: 30 })
          if (seq !== materialSearchSeq.current[materialKind]) return
          setChunkItems((current) => mergeMaterialItems(
            current.filter((item) => selectedIdsRef.current.chunk.includes(item.id)),
            result.items.map(toChunkItem),
          ))
        } catch { /* keep shelf */ }
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [materialQueries.chunk])

  useEffect(() => {
    const materialKind: ChapterMaterialKind = 'vocab'
    const query = materialQueries.vocab.trim()
    const seq = ++materialSearchSeq.current[materialKind]
    const timer = setTimeout(() => {
      void (async () => {
        if (!query) {
          if (seq !== materialSearchSeq.current[materialKind]) return
          setVocabItems((current) => current.filter((item) => selectedIdsRef.current.vocab.includes(item.id)))
          return
        }
        try {
          const result = await listLibraryVocabularies({ search: query, page: 1, pageSize: 30 })
          if (seq !== materialSearchSeq.current[materialKind]) return
          setVocabItems((current) => mergeMaterialItems(
            current.filter((item) => selectedIdsRef.current.vocab.includes(item.id)),
            result.items.map(toVocabItem),
          ))
        } catch { /* keep shelf */ }
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [materialQueries.vocab])

  const filtered = useMemo(() => chapters.filter((item) =>
    !search || `${item.chapterTitle} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  ), [chapters, search])

  const selectChapter = async (item: StoryEpisode) => {
    try {
      const detail = await getScriptEpisode(item.id)
      setSelected(detail)
      syncMaterialsFromEpisode(detail)
    } catch {
      setSelected(item)
      syncMaterialsFromEpisode(item)
    }
  }

  const openCreate = () => {
    setCreateForm({ name: '', description: '', order: Math.max(0, ...chapters.map((item) => item.episodeOrder)) + 1 })
    setCreateOpen(true)
  }

  const createChapter = async () => {
    if (!createForm.name.trim()) return
    setSavingChapter(true)
    try {
      const created = await createScriptEpisode({
        sceneId: packageId,
        chapterId: `chapter_${Date.now().toString(36)}`,
        chapterTitle: createForm.name.trim(),
        episodeOrder: createForm.order,
        title: createForm.name.trim(),
        description: createForm.description,
        objectives: [],
        prerequisiteEpisodes: [],
        npcName: '',
        npcRole: '',
        vocabRequiredCount: 0,
        vocabTotalCount: 0,
        chunkRequiredCount: 0,
        chunkTotalCount: 0,
        passObjectiveCount: 0,
        passChunkCount: 0,
        passMinDialogues: 0,
        passRetellRequired: false,
        rewards: {},
      })
      setCreateOpen(false)
      await loadChapters(created.id)
      toast.success('章节已创建，可以开始编写剧情')
    } catch { toast.error('章节创建失败') }
    finally { setSavingChapter(false) }
  }

  const saveChapter = async () => {
    if (!selected || !chapterForm.name.trim()) return
    setSavingChapter(true)
    try {
      await updateScriptEpisode(selected.id, {
        chapterTitle: chapterForm.name.trim(),
        title: chapterForm.name.trim(),
        description: chapterForm.description,
        episodeOrder: Number(chapterForm.order),
      })
      await loadChapters(selected.id)
      toast.success('章节信息已保存')
      setEditOpen(false)
    } catch { toast.error('章节保存失败') }
    finally { setSavingChapter(false) }
  }

  const persistMaterials = async (next: {
    vocabIds: string[]
    chunkIds: string[]
    patternIds: string[]
  }) => {
    if (!selected) return
    setMaterialsSaving(true)
    try {
      await updateScriptEpisode(selected.id, next)
      const detail = await getScriptEpisode(selected.id)
      setSelected(detail)
      // Keep local shelf candidates; only refresh selection from server truth.
      setSelectedVocabIds((detail.coreVocabularies ?? []).map((item) => item.vocab?.id ?? item.vocabId!).filter(Boolean))
      setSelectedChunkIds((detail.coreChunks ?? []).map((item) => item.chunk?.id ?? item.chunkId!).filter(Boolean))
      setSelectedPatternIds((detail.corePatterns ?? []).map((item) => item.pattern?.id ?? item.patternId!).filter(Boolean))
    } catch {
      toast.error('语言材料保存失败')
      syncMaterialsFromEpisode(selected)
    } finally {
      setMaterialsSaving(false)
    }
  }

  const toggleMaterial = (kind: ChapterMaterialKind, id: string) => {
    const nextVocabIds = kind === 'vocab'
      ? (selectedVocabIds.includes(id) ? selectedVocabIds.filter((item) => item !== id) : [...selectedVocabIds, id])
      : selectedVocabIds
    const nextChunkIds = kind === 'chunk'
      ? (selectedChunkIds.includes(id) ? selectedChunkIds.filter((item) => item !== id) : [...selectedChunkIds, id])
      : selectedChunkIds
    const nextPatternIds = kind === 'pattern'
      ? (selectedPatternIds.includes(id) ? selectedPatternIds.filter((item) => item !== id) : [...selectedPatternIds, id])
      : selectedPatternIds

    setSelectedVocabIds(nextVocabIds)
    setSelectedChunkIds(nextChunkIds)
    setSelectedPatternIds(nextPatternIds)
    void persistMaterials({
      vocabIds: nextVocabIds,
      chunkIds: nextChunkIds,
      patternIds: nextPatternIds,
    })
  }

  const saveStory = async (data: {
    key: string
    title: string
    inkSource: string
    inkJson: Record<string, unknown>
    locationId?: string
    characterId?: string
  }, options?: { silent?: boolean }) => {
    if (!selected) return
    setSavingStory(true)
    try {
      const payload = {
        ...data,
        title: chapterForm.name || data.title,
        scriptType: 'episode',
        episodeId: selected.id,
        version: (story?.version ?? 0) + 1,
        locationId: data.locationId ?? null,
        characterId: data.characterId ?? null,
      }
      const saved = story ? await updateStory(story.id, payload) : await createStory(payload)
      if (selected.inkScriptId !== saved.id) {
        await updateScriptEpisode(selected.id, { inkScriptId: saved.id })
        setSelected({ ...selected, inkScriptId: saved.id })
      }
      setStory(saved)
      if (!options?.silent) toast.success('章节剧情已保存')
    } catch {
      if (!options?.silent) toast.error('章节剧情保存失败')
      throw new Error('章节剧情保存失败')
    } finally { setSavingStory(false) }
  }

  return (
    <>
      <div className="grid min-h-[720px] overflow-hidden rounded-xl border bg-background xl:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="border-b bg-muted/20 xl:border-b-0 xl:border-r">
          <div className="space-y-3 border-b p-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索章节..." className="h-9 pl-8 text-xs" /></div>
            <Button size="sm" className="w-full" onClick={openCreate}><Plus className="mr-1.5 size-3.5" />新建章节</Button>
          </div>
          <div className="max-h-[650px] overflow-y-auto p-2">
            {loading ? <Loader2 className="mx-auto mt-8 size-5 animate-spin text-muted-foreground" /> : filtered.length ? filtered.map((chapter) => (
              <div key={chapter.id} className={cn('mb-1 flex items-center rounded-lg', selected?.id === chapter.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                <button onClick={() => void selectChapter(chapter)} className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2.5 text-left">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-black/5 text-[10px] font-bold">{chapter.episodeOrder}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{chapter.chapterTitle}</span>
                  {chapter.inkScriptId ? <Check className="size-3.5 opacity-70" /> : <FilePlus2 className="size-3.5 opacity-45" />}
                </button>
                <button type="button" className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-black/10" title="编辑章节信息" onClick={async () => { await selectChapter(chapter); setEditOpen(true) }}><Pencil className="size-3.5" /></button>
              </div>
            )) : <div className="px-3 py-12 text-center"><BookOpen className="mx-auto size-8 text-muted-foreground/25" /><p className="mt-3 text-xs text-muted-foreground">还没有章节</p></div>}
          </div>
        </aside>

        <main className="min-w-0 p-4">
          {!selected ? <div className="flex h-full flex-col items-center justify-center text-muted-foreground"><BookOpen className="size-9 opacity-25" /><p className="mt-3 text-sm">新建章节后，在这里编写剧情</p></div> : <>
            <div className="mb-4 flex items-center gap-2"><Badge variant="outline">第 {selected.episodeOrder} 章</Badge><span className="text-sm font-semibold">{selected.chapterTitle}</span>{!story && <Badge variant="secondary" className="ml-auto">尚未编写剧情</Badge>}</div>
            <InkStoryEditor
              storyId={story?.id}
              initialSource={story?.inkSource ?? undefined}
              initialKey={story?.key ?? storyKey(selected)}
              initialTitle={selected.chapterTitle}
              initialTeachingMarkdown={story?.teachingMarkdown}
              locations={locations}
              characters={characters}
              chapterMaterials={{
                patterns: patternItems,
                chunks: chunkItems,
                vocabs: vocabItems,
                selectedPatternIds,
                selectedChunkIds,
                selectedVocabIds,
                queries: materialQueries,
                onQueryChange: (kind, query) => setMaterialQueries((current) => ({ ...current, [kind]: query })),
                onToggle: toggleMaterial,
                saving: materialsSaving,
              }}
              onSave={saveStory}
              onSaveTeachingMarkdown={async (teachingMarkdown) => {
                if (!story?.id) {
                  toast.error('请先保存章节剧情，再编写教学文档')
                  throw new Error('story missing')
                }
                try {
                  const saved = await updateStory(story.id, { teachingMarkdown })
                  setStory(saved)
                  toast.success('教学文档已保存')
                } catch {
                  toast.error('教学文档保存失败')
                  throw new Error('teaching save failed')
                }
              }}
              saving={savingStory}
            />
          </>}
        </main>

      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>编辑章节信息</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>章节名称</Label><Input value={chapterForm.name} onChange={(event) => setChapterForm({ ...chapterForm, name: event.target.value })} /></div><div><Label>章节顺序</Label><Input type="number" min={1} value={chapterForm.order} onChange={(event) => setChapterForm({ ...chapterForm, order: Number(event.target.value) })} /></div><div><Label>章节简介</Label><Textarea rows={6} value={chapterForm.description} onChange={(event) => setChapterForm({ ...chapterForm, description: event.target.value })} placeholder="本章发生什么、核心冲突是什么……" /></div></div><DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button><Button onClick={() => void saveChapter()} disabled={savingChapter || !chapterForm.name.trim()}>{savingChapter ? '保存中…' : '保存章节'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>新建章节</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>章节名称</Label><Input value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} placeholder="例如：第一章 · 初到漫语町" /></div><div><Label>章节顺序</Label><Input type="number" min={1} value={createForm.order} onChange={(event) => setCreateForm({ ...createForm, order: Number(event.target.value) })} /></div><div><Label>章节简介</Label><Textarea rows={5} value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} placeholder="本章的剧情背景和主要冲突……" /></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={() => void createChapter()} disabled={savingChapter || !createForm.name.trim()}>{savingChapter ? '创建中…' : '创建并编辑剧情'}</Button></DialogFooter></DialogContent></Dialog>
    </>
  )
}
