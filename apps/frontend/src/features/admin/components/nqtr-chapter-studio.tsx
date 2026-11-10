import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BookOpen, Check, ChevronsUpDown, MapPin, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import {
  createNqtrChapter,
  deleteNqtrChapter,
  listLibraryChunks,
  listLibraryPatterns,
  listLibraryVocabularies,
  listNqtrChapters,
  updateNqtrChapter,
  type ChunkFull,
  type GameCharacter,
  type GameLocationData,
  type NqtrChapter,
  type SentencePatternFull,
  type VocabularyFull,
} from '../api-content-admin'
import {
  ChapterMaterialShelf,
  type ChapterMaterialItem,
  type ChapterMaterialKind,
} from './ink-story-editor'

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

export function NqtrChapterStudio({
  sceneId,
  characters,
  locations,
  chapterId,
  onChapterId,
  onChapters,
}: {
  sceneId: string
  characters: GameCharacter[]
  locations: GameLocationData[]
  chapterId: string
  onChapterId: (id: string) => void
  onChapters: (chapters: NqtrChapter[]) => void
}) {
  const [chapters, setChapters] = useState<NqtrChapter[]>([])
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [teachingMarkdown, setTeachingMarkdown] = useState('')
  const [characterIds, setCharacterIds] = useState<string[]>([])
  const [locationIds, setLocationIds] = useState<string[]>([])
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const current = chapters.find((item) => item.id === chapterId) ?? chapters[0]
  const chapterRef = useRef(chapterId)
  chapterRef.current = chapterId
  const materialSearchSeq = useRef({ pattern: 0, chunk: 0, vocab: 0 })
  const selectedIdsRef = useRef({ vocab: selectedVocabIds, chunk: selectedChunkIds, pattern: selectedPatternIds })
  selectedIdsRef.current = { vocab: selectedVocabIds, chunk: selectedChunkIds, pattern: selectedPatternIds }

  const syncMaterials = (chapter: NqtrChapter | null) => {
    const vocabs = (chapter?.coreVocabularies ?? [])
      .map((item) => (item.vocab ? toVocabItem(item.vocab) : item.vocabId ? { id: item.vocabId, primary: item.vocabId, secondary: null } : null))
      .filter(Boolean) as ChapterMaterialItem[]
    const chunks = (chapter?.coreChunks ?? [])
      .map((item) => (item.chunk ? toChunkItem(item.chunk) : item.chunkId ? { id: item.chunkId, primary: item.chunkId, secondary: null } : null))
      .filter(Boolean) as ChapterMaterialItem[]
    const patterns = (chapter?.corePatterns ?? [])
      .map((item) => (item.pattern ? toPatternItem(item.pattern) : item.patternId ? { id: item.patternId, primary: item.patternId, secondary: null } : null))
      .filter(Boolean) as ChapterMaterialItem[]

    setSelectedVocabIds(vocabs.map((item) => item.id))
    setSelectedChunkIds(chunks.map((item) => item.id))
    setSelectedPatternIds(patterns.map((item) => item.id))
    setVocabItems(vocabs)
    setChunkItems(chunks)
    setPatternItems(patterns)
    setMaterialQueries({ pattern: '', chunk: '', vocab: '' })
  }

  const fill = (chapter: NqtrChapter) => {
    setTitle(chapter.title)
    setSummary(chapter.summary ?? '')
    setTeachingMarkdown(chapter.teachingMarkdown ?? '')
    setCharacterIds(chapter.characters.map((item) => item.characterId))
    setLocationIds(chapter.locations.map((item) => item.locationId))
    syncMaterials(chapter)
  }

  const load = useCallback(async () => {
    const next = await listNqtrChapters(sceneId)
    setChapters(next)
    onChapters(next)
    const selected = next.find((item) => item.id === chapterRef.current) ?? next[0]
    if (!selected) return
    if (selected.id !== chapterRef.current) onChapterId(selected.id)
    fill(selected)
  }, [onChapterId, onChapters, sceneId])

  useEffect(() => { void load().catch(() => toast.error('章节加载失败')) }, [load])

  useEffect(() => {
    const materialKind: ChapterMaterialKind = 'pattern'
    const query = materialQueries.pattern.trim()
    const seq = ++materialSearchSeq.current[materialKind]
    const timer = setTimeout(() => {
      void (async () => {
        if (!query) {
          if (seq !== materialSearchSeq.current[materialKind]) return
          setPatternItems((currentItems) => currentItems.filter((item) => selectedIdsRef.current.pattern.includes(item.id)))
          return
        }
        try {
          const result = await listLibraryPatterns({ search: query, page: 1, pageSize: 30 })
          if (seq !== materialSearchSeq.current[materialKind]) return
          setPatternItems((currentItems) => mergeMaterialItems(
            currentItems.filter((item) => selectedIdsRef.current.pattern.includes(item.id)),
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
          setChunkItems((currentItems) => currentItems.filter((item) => selectedIdsRef.current.chunk.includes(item.id)))
          return
        }
        try {
          const result = await listLibraryChunks({ search: query, page: 1, pageSize: 30 })
          if (seq !== materialSearchSeq.current[materialKind]) return
          setChunkItems((currentItems) => mergeMaterialItems(
            currentItems.filter((item) => selectedIdsRef.current.chunk.includes(item.id)),
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
          setVocabItems((currentItems) => currentItems.filter((item) => selectedIdsRef.current.vocab.includes(item.id)))
          return
        }
        try {
          const result = await listLibraryVocabularies({ search: query, page: 1, pageSize: 30 })
          if (seq !== materialSearchSeq.current[materialKind]) return
          setVocabItems((currentItems) => mergeMaterialItems(
            currentItems.filter((item) => selectedIdsRef.current.vocab.includes(item.id)),
            result.items.map(toVocabItem),
          ))
        } catch { /* keep shelf */ }
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [materialQueries.vocab])

  const select = (chapter: NqtrChapter) => {
    onChapterId(chapter.id)
    fill(chapter)
  }

  const create = async () => {
    const created = await createNqtrChapter({ sceneId, title: `第${chapters.length + 1}章` })
    const next = [...chapters, created]
    setChapters(next)
    onChapters(next)
    select(created)
    toast.success('章节已添加')
  }

  const persistMaterials = async (next: { vocabIds: string[]; chunkIds: string[]; patternIds: string[] }) => {
    if (!current) return
    setMaterialsSaving(true)
    try {
      const updated = await updateNqtrChapter(current.id, next)
      const chaptersNext = chapters.map((item) => (item.id === updated.id ? updated : item))
      setChapters(chaptersNext)
      onChapters(chaptersNext)
      setSelectedVocabIds((updated.coreVocabularies ?? []).map((item) => item.vocab?.id ?? item.vocabId!).filter(Boolean))
      setSelectedChunkIds((updated.coreChunks ?? []).map((item) => item.chunk?.id ?? item.chunkId!).filter(Boolean))
      setSelectedPatternIds((updated.corePatterns ?? []).map((item) => item.pattern?.id ?? item.patternId!).filter(Boolean))
    } catch {
      toast.error('语言材料保存失败')
      syncMaterials(current)
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

  const save = async () => {
    if (!current) return
    setSaving(true)
    try {
      const updated = await updateNqtrChapter(current.id, {
        title,
        summary,
        teachingMarkdown,
        characterIds,
        locationIds,
        vocabIds: selectedVocabIds,
        chunkIds: selectedChunkIds,
        patternIds: selectedPatternIds,
      })
      const next = chapters.map((item) => item.id === updated.id ? updated : item)
      setChapters(next)
      onChapters(next)
      fill(updated)
      toast.success('章节已保存')
    } catch {
      toast.error('章节保存失败')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!current) return
    try {
      await deleteNqtrChapter(current.id)
      const next = chapters.filter((item) => item.id !== current.id)
      setChapters(next)
      onChapters(next)
      const selected = next[0]
      if (selected) select(selected)
      else onChapterId('')
      setConfirmDelete(false)
      toast.success('章节已删除')
    } catch {
      toast.error('章节删除失败')
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>章节</CardTitle>
            <CardDescription>每一章是一段告一段落。</CardDescription>
          </div>
          <Button size="icon" variant="outline" aria-label="添加章节" onClick={() => void create().catch(() => toast.error('章节添加失败'))}>
            <Plus />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {chapters.length ? chapters.map((chapter, index) => (
            <Button
              key={chapter.id}
              variant={chapter.id === current?.id ? 'secondary' : 'ghost'}
              className="h-auto justify-start px-3 py-2"
              onClick={() => select(chapter)}
            >
              <span className="flex min-w-0 flex-col items-start">
                <span className="text-xs text-muted-foreground">第 {index + 1} 章</span>
                <span className="truncate">{chapter.title}</span>
              </span>
            </Button>
          )) : <p className="px-1 py-6 text-center text-sm text-muted-foreground">还没有章节</p>}
        </CardContent>
      </Card>

      {current ? (
        <Card>
          <CardHeader>
            <CardTitle>本章内容</CardTitle>
            <CardDescription>地图和素材仍属于整本剧情包。这里只决定这一章用谁、开放哪里，以及本章语言材料。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="chapter-title">名称</Label>
                <Input id="chapter-title" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="chapter-summary">这一章讲到哪</Label>
                <Textarea id="chapter-summary" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="例如：船上的第一天，把钥匙交给小悠" />
              </div>
            </div>
            <Separator />
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-start gap-2">
                  <BookOpen className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">本章教学文档</p>
                    <p className="text-xs text-muted-foreground">学员进入本章探索前可阅读；右侧可绑定单词 / 句型 / 句块。</p>
                  </div>
                </div>
                {materialsSaving && (
                  <Badge variant="secondary" className="h-7 gap-1 text-[10px]">材料保存中</Badge>
                )}
              </div>
              <div className="grid min-h-[420px] lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
                  <MarkdownEditor
                    value={teachingMarkdown}
                    onChange={setTeachingMarkdown}
                    height={420}
                    placeholder="## 这一章要练什么&#10;&#10;先说明场景目标，再讲关键表达怎么开口。"
                  />
                </div>
                <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/10">
                  <div className="shrink-0 border-b border-border px-2 py-2">
                    <p className="text-xs font-semibold">当前语言材料</p>
                    <p className="mt-0.5 text-[9px] leading-[0.875rem] text-muted-foreground">搜索库中内容即可添加；点击已选项可移除，会立即保存到本章。</p>
                  </div>
                  <Tabs defaultValue="pattern" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <TabsList className="grid h-8 w-full shrink-0 grid-cols-3 rounded-none border-b border-border bg-muted/30 p-0.5">
                      <TabsTrigger value="pattern" className="h-7 gap-1 px-1 text-[10px]">
                        句型 <Badge variant="secondary" className="h-4 px-1 text-[8px]">{selectedPatternIds.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="chunk" className="h-7 gap-1 px-1 text-[10px]">
                        句块 <Badge variant="secondary" className="h-4 px-1 text-[8px]">{selectedChunkIds.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="vocab" className="h-7 gap-1 px-1 text-[10px]">
                        单词 <Badge variant="secondary" className="h-4 px-1 text-[8px]">{selectedVocabIds.length}</Badge>
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="pattern" className="mt-0 min-h-0 min-w-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
                      <ChapterMaterialShelf
                        title="句型"
                        count={selectedPatternIds.length}
                        query={materialQueries.pattern}
                        onQueryChange={(query) => setMaterialQueries((currentQueries) => ({ ...currentQueries, pattern: query }))}
                        items={patternItems}
                        selectedIds={selectedPatternIds}
                        onToggle={(id) => toggleMaterial('pattern', id)}
                      />
                    </TabsContent>
                    <TabsContent value="chunk" className="mt-0 min-h-0 min-w-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
                      <ChapterMaterialShelf
                        title="句块"
                        count={selectedChunkIds.length}
                        query={materialQueries.chunk}
                        onQueryChange={(query) => setMaterialQueries((currentQueries) => ({ ...currentQueries, chunk: query }))}
                        items={chunkItems}
                        selectedIds={selectedChunkIds}
                        onToggle={(id) => toggleMaterial('chunk', id)}
                      />
                    </TabsContent>
                    <TabsContent value="vocab" className="mt-0 min-h-0 min-w-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
                      <ChapterMaterialShelf
                        title="单词"
                        count={selectedVocabIds.length}
                        query={materialQueries.vocab}
                        onQueryChange={(query) => setMaterialQueries((currentQueries) => ({ ...currentQueries, vocab: query }))}
                        items={vocabItems}
                        selectedIds={selectedVocabIds}
                        onToggle={(id) => toggleMaterial('vocab', id)}
                      />
                    </TabsContent>
                  </Tabs>
                </aside>
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 lg:grid-cols-2">
              <PickerCard
                icon={<Users className="size-4" />}
                title="出场人物"
                description="不选表示剧情包里的角色都可以用。"
                empty="选择出场人物"
                selected={characters.filter((item) => characterIds.includes(item.id)).map((item) => item.displayName)}
                options={characters.map((item) => ({ id: item.id, label: item.displayName, hint: item.role }))}
                selectedIds={characterIds}
                onToggle={(id) => setCharacterIds((currentIds) => currentIds.includes(id) ? currentIds.filter((item) => item !== id) : [...currentIds, id])}
              />
              <PickerCard
                icon={<MapPin className="size-4" />}
                title="开放地点"
                description="不选表示地图上的地点都开着。"
                empty="选择开放地点"
                selected={locations.filter((item) => locationIds.includes(item.id)).map((item) => item.displayName)}
                options={locations.map((item) => ({ id: item.id, label: item.displayName }))}
                selectedIds={locationIds}
                onToggle={(id) => setLocationIds((currentIds) => currentIds.includes(id) ? currentIds.filter((item) => item !== id) : [...currentIds, id])}
              />
            </div>
            <div className="flex gap-2">
              <Button disabled={saving || !title.trim()} onClick={() => void save()}>{saving ? '保存中…' : '保存本章'}</Button>
              <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                <Trash2 data-icon="inline-start" />
                删除本章
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>先加一章</CardTitle>
            <CardDescription>行为和日程、任务都会归到当前这一章。添加后可以从左边切换。</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void create().catch(() => toast.error('章节添加失败'))}>
              <Plus data-icon="inline-start" />
              添加第一章
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除{current?.title ?? '这一章'}？</DialogTitle>
            <DialogDescription>这一章里的日程、行为和任务会失去章节归属，不会被删掉。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>取消</Button>
            <Button variant="destructive" onClick={() => void remove()}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PickerCard({
  icon,
  title,
  description,
  empty,
  selected,
  options,
  selectedIds,
  onToggle,
}: {
  icon: ReactNode
  title: string
  description: string
  empty: string
  selected: string[]
  options: { id: string; label: string; hint?: string }[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between px-3 font-normal">
            <span className="truncate">{selected.length ? `已选 ${selected.length} 项` : empty}</span>
            <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder={`搜索${title}`} />
            <CommandList>
              <CommandEmpty>没有匹配项</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const checked = selectedIds.includes(option.id)
                  return (
                    <CommandItem key={option.id} value={`${option.label} ${option.hint ?? ''}`} onSelect={() => onToggle(option.id)}>
                      <Check className={cn('opacity-0', checked && 'opacity-100')} />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {option.hint && <span className="truncate text-xs text-muted-foreground">{option.hint}</span>}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex min-h-8 flex-wrap gap-1">
        {selected.length ? selected.map((label) => <Badge key={label} variant="secondary">{label}</Badge>) : <span className="text-xs text-muted-foreground">未限制</span>}
      </div>
    </div>
  )
}
