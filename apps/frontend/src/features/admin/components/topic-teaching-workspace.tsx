import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Check, GitCompareArrows, Link2, Loader2, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { cn } from '@/lib/cn'
import {
  getSceneMaterialUsage,
  type GroupMaterialUsageEntry,
  listTopicTeachingDocuments,
  type TopicTeachingDocument,
} from '@/features/admin/api-content-admin'

type WorkspaceMode = 'edit' | 'preview' | 'compare'

interface TopicTeachingWorkspaceProps {
  sceneId: string
  currentTopicId?: string
  currentTitle: string
  currentDifficulty: string
  value: string
  onChange: (value: string) => void
  onOpenDocument?: (topicId: string) => void
  patterns: Array<{ id: string; pattern: string; meaning?: string | null }>
  chunks: Array<{ id: string; text: string; meaning?: string | null }>
  vocabs: Array<{ id: string; word: string; meaning?: string | null }>
  selectedPatternIds: string[]
  selectedChunkIds: string[]
  selectedVocabIds: string[]
  onToggleMaterial: (kind: MaterialKind, id: string) => void
  onCreateMaterial: (kind: MaterialKind) => void
  onSearchVocabs?: (query: string) => Promise<unknown>
}

type MaterialKind = 'pattern' | 'chunk' | 'vocab'

interface MaterialShelfProps {
  title: string
  count: number
  query: string
  onQueryChange: (value: string) => void
  items: Array<{ id: string; primary: string; secondary?: string | null; selected: boolean; usages: GroupMaterialUsageEntry[] }>
  onToggle: (id: string) => void
  onCreate: () => void
}

function formatMaterialLocations(usages: GroupMaterialUsageEntry[]) {
  if (!usages.length) return '未引用'
  return usages.map((usage) =>
    `${usage.sceneTitle} / ${usage.topicTitle ?? '包级'}${usage.role === 'review' ? ' · 复' : ''}`,
  ).join('；')
}

function MaterialShelf({ title, count, query, onQueryChange, items, onToggle, onCreate }: MaterialShelfProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-1.5 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <p className="truncate text-[11px] font-semibold">{title}</p>
          <Badge variant="secondary" className="h-4 shrink-0 px-1 text-[8px]">{count}</Badge>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-[9px]" onClick={onCreate}>
          <Plus data-icon="inline-start" />新建
        </Button>
      </div>
      <div className="px-1.5 pb-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-6 px-6 text-[10px]"
            placeholder={`查询并添加${title}`}
          />
          {query && (
            <button type="button" aria-label={`清除${title}查询`} onClick={() => onQueryChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5">
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                'group flex w-full items-start gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors',
                item.selected ? 'border-primary/25 bg-primary/[0.05]' : 'border-border/60 bg-background hover:border-primary/30 hover:bg-muted/40',
              )}
            >
              <span className={cn(
                'mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                item.selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
              )}>
                {item.selected ? <Check className="size-2" /> : <Plus className="size-2" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-medium leading-[0.875rem]">{item.primary}</span>
                {item.secondary && <span className="block truncate text-[9px] leading-[0.875rem] text-muted-foreground">{item.secondary}</span>}
              </span>
              <span className="flex max-w-[11.5rem] shrink-0 self-end items-center justify-end gap-1">
                <span className="text-right text-[7px] leading-[0.625rem] text-muted-foreground">
                  {formatMaterialLocations(item.usages)}
                </span>
                <Badge
                  variant={item.usages.length ? 'secondary' : 'outline'}
                  className="h-3.5 shrink-0 gap-0.5 px-1 text-[7px] [&_svg]:size-2"
                  aria-label={`组内引用 ${item.usages.length} 次`}
                >
                  <Link2 data-icon="inline-start" />{item.usages.length}
                </Badge>
              </span>
            </button>
          ))}
          {!items.length && (
            <p className="py-4 text-center text-[9px] text-muted-foreground">{query ? '没有匹配项' : `暂未添加${title}`}</p>
          )}
        </div>
      </div>
    </section>
  )
}

const draftId = '__current_draft__'

function formatCreatedAt(value?: string) {
  if (!value) return '尚未保存'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '已保存'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function TopicTeachingWorkspace({
  sceneId,
  currentTopicId,
  currentTitle,
  currentDifficulty,
  value,
  onChange,
  onOpenDocument,
  patterns,
  chunks,
  vocabs,
  selectedPatternIds,
  selectedChunkIds,
  selectedVocabIds,
  onToggleMaterial,
  onCreateMaterial,
  onSearchVocabs,
}: TopicTeachingWorkspaceProps) {
  const [documents, setDocuments] = useState<TopicTeachingDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<WorkspaceMode>('edit')
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [materialQueries, setMaterialQueries] = useState<Record<MaterialKind, string>>({ pattern: '', chunk: '', vocab: '' })
  const [savedMaterialUsage, setSavedMaterialUsage] = useState<Record<string, GroupMaterialUsageEntry[]>>({})
  const [currentSceneTitle, setCurrentSceneTitle] = useState('当前学习包')

  useEffect(() => {
    let cancelled = false
    getSceneMaterialUsage(sceneId)
      .then((usage) => {
        if (cancelled) return
        setSavedMaterialUsage(usage.materials)
        setCurrentSceneTitle(usage.currentScene.title)
      })
      .catch(() => {
        if (!cancelled) setSavedMaterialUsage({})
      })
    return () => { cancelled = true }
  }, [sceneId])

  useEffect(() => {
    const query = materialQueries.vocab.trim()
    if (!query || !onSearchVocabs) return
    const timer = window.setTimeout(() => { void onSearchVocabs(query) }, 300)
    return () => window.clearTimeout(timer)
  }, [materialQueries.vocab, onSearchVocabs])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listTopicTeachingDocuments(sceneId)
      .then((items) => {
        if (cancelled) return
        setDocuments(items.map((document) => document.id === currentTopicId
          ? {
              ...document,
              title: currentTitle || document.title,
              difficulty: currentDifficulty || document.difficulty,
              teachingMarkdown: value,
            }
          : document))
      })
      .catch(() => { if (!cancelled) setDocuments([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sceneId])

  useEffect(() => {
    if (!currentTopicId) return
    setDocuments((current) => current.map((document) => document.id === currentTopicId
      ? {
          ...document,
          title: currentTitle || document.title,
          difficulty: currentDifficulty || document.difficulty,
          teachingMarkdown: value,
        }
      : document))
  }, [currentDifficulty, currentTitle, currentTopicId, value])

  const currentId = currentTopicId || draftId
  const mergedDocuments = useMemo(() => {
    const current: TopicTeachingDocument = {
      id: currentId,
      title: currentTitle || '未命名话题',
      difficulty: currentDifficulty || 'L2',
      sortOrder: documents.find((item) => item.id === currentTopicId)?.sortOrder ?? -1,
      teachingMarkdown: value,
      createdAt: documents.find((item) => item.id === currentTopicId)?.createdAt ?? '',
    }
    if (!currentTopicId) return [current, ...documents]
    const exists = documents.some((item) => item.id === currentTopicId)
    return exists
      ? documents.map((item) => item.id === currentTopicId ? current : item)
      : [current, ...documents]
  }, [currentDifficulty, currentId, currentTitle, currentTopicId, documents, value])

  const visibleDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return mergedDocuments
    return mergedDocuments.filter((item) =>
      item.title.toLowerCase().includes(keyword)
      || item.difficulty.toLowerCase().includes(keyword)
      || (item.teachingMarkdown ?? '').toLowerCase().includes(keyword),
    )
  }, [mergedDocuments, search])

  const compareDocuments = compareIds
    .map((id) => mergedDocuments.find((item) => item.id === id))
    .filter((item): item is TopicTeachingDocument => Boolean(item))

  const completedCount = mergedDocuments.filter((item) => (item.teachingMarkdown ?? '').trim()).length

  const materialUsage = useMemo(() => {
    const next = Object.fromEntries(Object.entries(savedMaterialUsage).map(([key, usages]) => [
      key,
      currentTopicId ? usages.filter((usage) => usage.topicId !== currentTopicId) : usages,
    ])) as Record<string, GroupMaterialUsageEntry[]>
    const addCurrent = (kind: MaterialKind, ids: string[]) => ids.forEach((id) => {
      const key = `${kind}:${id}`
      const savedRole = currentTopicId
        ? savedMaterialUsage[key]?.find((usage) => usage.topicId === currentTopicId)?.role
        : undefined
      next[key] = [...(next[key] ?? []), {
        sceneId,
        sceneTitle: currentSceneTitle,
        topicId: currentTopicId ?? null,
        topicTitle: currentTitle || '当前话题',
        role: savedRole ?? 'learn',
      }]
    })
    addCurrent('pattern', selectedPatternIds)
    addCurrent('chunk', selectedChunkIds)
    addCurrent('vocab', selectedVocabIds)
    return next
  }, [currentSceneTitle, currentTitle, currentTopicId, savedMaterialUsage, sceneId, selectedChunkIds, selectedPatternIds, selectedVocabIds])

  const materialShelves = useMemo(() => {
    const filter = <T extends { id: string }>(items: T[], query: string, label: (item: T) => string, selectedIds: string[]) => {
      const keyword = query.trim().toLowerCase()
      const visible = keyword
        ? items.filter((item) => label(item).toLowerCase().includes(keyword))
        : items.filter((item) => selectedIds.includes(item.id))
      return visible.slice(0, keyword ? 30 : undefined)
    }
    return {
      pattern: filter(patterns, materialQueries.pattern, (item) => `${item.pattern} ${item.meaning ?? ''}`, selectedPatternIds)
        .map((item) => ({ id: item.id, primary: item.pattern, secondary: item.meaning, selected: selectedPatternIds.includes(item.id), usages: materialUsage[`pattern:${item.id}`] ?? [] })),
      chunk: filter(chunks, materialQueries.chunk, (item) => `${item.text} ${item.meaning ?? ''}`, selectedChunkIds)
        .map((item) => ({ id: item.id, primary: item.text, secondary: item.meaning, selected: selectedChunkIds.includes(item.id), usages: materialUsage[`chunk:${item.id}`] ?? [] })),
      vocab: filter(vocabs, materialQueries.vocab, (item) => `${item.word} ${item.meaning ?? ''}`, selectedVocabIds)
        .map((item) => ({ id: item.id, primary: item.word, secondary: item.meaning, selected: selectedVocabIds.includes(item.id), usages: materialUsage[`vocab:${item.id}`] ?? [] })),
    }
  }, [chunks, materialQueries, materialUsage, patterns, selectedChunkIds, selectedPatternIds, selectedVocabIds, vocabs])

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id)
        if (mode === 'compare') setMode('preview')
        return next
      }
      const next = current.length >= 2 ? [current[1], id] : [...current, id]
      if (next.length === 2) {
        setMode('compare')
        setSidebarOpen(false)
      }
      return next
    })
  }

  const exitCompare = () => {
    setCompareMode(false)
    setCompareIds([])
    setMode('edit')
    setSidebarOpen(true)
  }

  const enterCompare = () => {
    setCompareMode(true)
    setCompareIds([])
    setMode('preview')
    setSidebarOpen(true)
  }

  return (
    <div className={cn(
      'grid h-[calc(97vh-10.5rem)] min-h-[32rem] overflow-hidden rounded-xl border border-border/70 bg-background',
      sidebarOpen
        ? 'lg:grid-cols-[12rem_minmax(0,1fr)_22rem]'
        : 'lg:grid-cols-[minmax(0,1fr)_22rem]',
    )}>
      <aside className={cn('min-h-0 flex-col border-b border-border/70 bg-muted/20 lg:border-b-0 lg:border-r', sidebarOpen ? 'flex' : 'hidden')}>
        <div className="border-b border-border/70 px-2.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">教学文档库</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">已完成 {completedCount}/{mergedDocuments.length}</p>
            </div>
            {compareMode ? (
              <Button type="button" size="sm" variant="secondary" className="h-7 gap-1 px-2 text-[10px]" onClick={exitCompare}>
                <X className="size-3" />退出对比
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10px]" onClick={enterCompare}>
                <GitCompareArrows className="size-3" />对比模式
              </Button>
            )}
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 pl-8 text-xs" placeholder="搜索话题或文档内容" />
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
            {compareMode ? `对比模式：请选择两份文档（${compareIds.length}/2）。` : '点击卡片切换当前编辑文档；需要比较时再开启对比模式。'}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />加载文档列表…
            </div>
          )}
          {!loading && visibleDocuments.map((document, index) => {
            const selectedIndex = compareIds.indexOf(document.id)
            const current = document.id === currentId
            const hasContent = Boolean(document.teachingMarkdown?.trim())
            return (
              <button
                key={document.id}
                type="button"
                aria-pressed={selectedIndex >= 0}
                onClick={() => compareMode ? toggleCompare(document.id) : (!current && onOpenDocument?.(document.id))}
                className={cn(
                  'group w-full rounded-lg border px-2.5 py-2 text-left transition-colors',
                  selectedIndex >= 0 ? 'border-primary/50 bg-primary/[0.06]' : 'border-border/70 bg-background hover:border-primary/30 hover:bg-muted/30',
                  current && 'ring-1 ring-inset ring-primary/20',
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-[10px] font-semibold',
                    compareMode && selectedIndex >= 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
                  )}>
                    {compareMode && selectedIndex >= 0 ? selectedIndex + 1 : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-semibold">{document.title}</p>
                      {current && <Badge variant="secondary" className="shrink-0 text-[9px]">当前</Badge>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px]">{document.difficulty}</Badge>
                      <span className={cn('text-[10px]', hasContent ? 'text-emerald-600' : 'text-amber-600')}>
                        {hasContent ? `${document.teachingMarkdown!.length} 字符` : '待编写'}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">{document.createdAt ? `创建于 ${formatCreatedAt(document.createdAt)}` : '尚未保存'}</p>
                  </div>
                  {compareMode ? (
                    <span className={cn('mt-0.5 flex size-4 items-center justify-center rounded-full border', selectedIndex >= 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent')}>
                      <Check className="size-2.5" />
                    </span>
                  ) : (
                    <ArrowRight className={cn('mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5', current && 'opacity-0')} />
                  )}
                </div>
              </button>
            )
          })}
          {!loading && !visibleDocuments.length && <p className="py-10 text-center text-xs text-muted-foreground">没有匹配的教学文档</p>}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col">
        <div className="border-b border-border/70 bg-gradient-to-r from-sky-500/[0.07] via-background to-background px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-sky-600" />
                <p className="truncate text-sm font-semibold">{mode === 'compare' ? '教学文档左右对比' : currentTitle || '未命名话题'}</p>
              </div>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                {mode === 'compare' ? '并排检查目标范围、表达递进与内容重复。' : '先完成教学设计，再向后派生语言支架和知识点练习。'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {mode === 'compare' ? (
                <>
                  {!sidebarOpen && <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setSidebarOpen(true)}><PanelLeftOpen className="size-3.5" />选择文档</Button>}
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={exitCompare}><X className="size-3.5" />退出对比</Button>
                </>
              ) : (
                <>
                  <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => setSidebarOpen((open) => !open)}>
                    {sidebarOpen ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />}
                    {sidebarOpen ? '收起文档库' : '展开文档库'}
                  </Button>
                  <div className="flex rounded-md border border-border/70 bg-background p-0.5">
                    <Button type="button" size="sm" variant={mode === 'edit' ? 'secondary' : 'ghost'} className="h-7 px-3 text-xs" onClick={() => setMode('edit')}>编辑</Button>
                    <Button type="button" size="sm" variant={mode === 'preview' ? 'secondary' : 'ghost'} className="h-7 px-3 text-xs" onClick={() => setMode('preview')}>预览</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {mode === 'compare' && compareDocuments.length === 2 ? (
            <div className="grid gap-2 lg:grid-cols-2">
              {compareDocuments.map((document, index) => (
                <div key={document.id} className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-background">
                  <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/25 px-2.5 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{index + 1}. {document.title}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{document.difficulty} · {document.teachingMarkdown?.length ?? 0} 字符</p>
                    </div>
                    <GitCompareArrows className="size-3.5 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="p-1.5">
                    <MarkdownEditor value={document.teachingMarkdown ?? ''} height={640} preview="preview" minimal />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MarkdownEditor
              value={value}
              onChange={onChange}
              height={650}
              preview={mode === 'preview' ? 'preview' : 'edit'}
              placeholder="从教学目标开始，依次写明核心概念、表达结构、示例、易错点和练习迁移……"
            />
          )}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col border-t border-border/70 bg-muted/10 lg:border-l lg:border-t-0">
        <div className="shrink-0 border-b border-border/70 px-2 py-2">
          <p className="text-xs font-semibold">当前语言材料</p>
          <p className="mt-0.5 text-[9px] leading-[0.875rem] text-muted-foreground">搜索库中内容即可添加；点击已选内容可移除。</p>
        </div>
        <Tabs defaultValue="pattern" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid h-8 w-full shrink-0 grid-cols-3 rounded-none border-b border-border/70 bg-muted/30 p-0.5">
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
          <TabsContent value="pattern" className="mt-0 min-h-0 flex-1 data-[state=active]:flex">
            <MaterialShelf
              title="句型"
              count={selectedPatternIds.length}
              query={materialQueries.pattern}
              onQueryChange={(query) => setMaterialQueries((current) => ({ ...current, pattern: query }))}
              items={materialShelves.pattern}
              onToggle={(id) => onToggleMaterial('pattern', id)}
              onCreate={() => onCreateMaterial('pattern')}
            />
          </TabsContent>
          <TabsContent value="chunk" className="mt-0 min-h-0 flex-1 data-[state=active]:flex">
            <MaterialShelf
              title="句块"
              count={selectedChunkIds.length}
              query={materialQueries.chunk}
              onQueryChange={(query) => setMaterialQueries((current) => ({ ...current, chunk: query }))}
              items={materialShelves.chunk}
              onToggle={(id) => onToggleMaterial('chunk', id)}
              onCreate={() => onCreateMaterial('chunk')}
            />
          </TabsContent>
          <TabsContent value="vocab" className="mt-0 min-h-0 flex-1 data-[state=active]:flex">
            <MaterialShelf
              title="单词"
              count={selectedVocabIds.length}
              query={materialQueries.vocab}
              onQueryChange={(query) => setMaterialQueries((current) => ({ ...current, vocab: query }))}
              items={materialShelves.vocab}
              onToggle={(id) => onToggleMaterial('vocab', id)}
              onCreate={() => onCreateMaterial('vocab')}
            />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  )
}
