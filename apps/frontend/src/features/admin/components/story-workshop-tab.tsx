import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Edit3, MapPin, Users, BookOpen, Play,
  ChevronRight, ScrollText, X, Search, ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  listStories, createStory, updateStory, deleteStory, getStory, getStoryFilters,
  listLocations, listCharacters, updateTrainingTopic,
  type StoryData, type StoryFilters, type GameLocationData, type GameCharacter,
} from '../api-content-admin'
import { InkStoryEditor } from './ink-story-editor'
import { cn } from '@/lib/cn'

const PAGE_SIZE = 12

interface StoryWorkshopTabProps {
  locations: GameLocationData[]
  characters: GameCharacter[]
}

export function StoryWorkshopTab({ locations, characters }: StoryWorkshopTabProps) {
  const [stories, setStories] = useState<StoryData[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingStory, setEditingStory] = useState<StoryData | null>(null)
  const [saving, setSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // ── List filters ──
  const [search, setSearch] = useState('')
  const [packageTypeFilter, setPackageTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<StoryFilters>({ scriptTypes: [], packageTypes: [], categories: [] })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, pageSize: PAGE_SIZE }
      if (search) params.search = search
      if (packageTypeFilter !== 'all') params.packageType = packageTypeFilter
      if (categoryFilter !== 'all') params.categoryId = categoryFilter
      const data = await listStories(params)
      setStories(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch { toast.error('加载故事列表失败') }
    finally { setLoading(false) }
  }, [page, search, packageTypeFilter, categoryFilter])

  useEffect(() => { load() }, [load])

  // Load filter options once
  useEffect(() => {
    getStoryFilters().then(setFilters).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  // Load full story for editing
  const openEditor = useCallback(async (story: StoryData) => {
    try {
      const full = await getStory(story.id)
      setEditingStory(full)
      setSelectedId(full.id)
      setIsCreating(false)
    } catch {
      setEditingStory(story)
      setSelectedId(story.id)
      setIsCreating(false)
    }
  }, [])

  const openCreate = useCallback(() => {
    setEditingStory(null)
    setSelectedId(null)
    setIsCreating(true)
  }, [])

  const closeEditor = useCallback(() => {
    setEditingStory(null)
    setSelectedId(null)
    setIsCreating(false)
  }, [])

  const handleSave = useCallback(async (data: {
    key: string
    title: string
    inkSource: string
    inkJson: Record<string, any>
    locationId?: string
    characterId?: string
  }, options?: { silent?: boolean }) => {
    setSaving(true)
    try {
      const payload: any = {
        key: data.key,
        title: data.title,
        inkJson: data.inkJson,
        inkSource: data.inkSource,
        scriptType: 'practice',
        version: (editingStory?.version ?? 0) + 1,
        locationId: data.locationId ?? null,
        characterId: data.characterId ?? null,
      }

      if (editingStory) {
        const saved = await updateStory(editingStory.id, payload)
        setEditingStory({
          ...saved,
          trainingTopic: saved.trainingTopic ?? editingStory.trainingTopic,
        })
        if (!options?.silent) toast.success('故事已更新')
      } else {
        const saved = await createStory(payload)
        setEditingStory(saved)
        setSelectedId(saved.id)
        if (!options?.silent) toast.success('故事已创建')
        setIsCreating(false)
      }
      await load()
    } catch {
      if (!options?.silent) toast.error('保存失败')
      throw new Error('保存失败')
    }
    finally { setSaving(false) }
  }, [editingStory, load])

  const handleDelete = useCallback(async (story: StoryData) => {
    if (!confirm(`确定删除故事 "${story.title}"？此操作不可撤销。`)) return
    try {
      await deleteStory(story.id)
      toast.success('已删除')
      if (selectedId === story.id) closeEditor()
      load()
    } catch { toast.error('删除失败') }
  }, [selectedId, closeEditor, load])

  const handleSaveTeachingMarkdown = useCallback(async (teachingMarkdown: string) => {
    const topic = editingStory?.trainingTopic
    if (!topic) throw new Error('当前故事尚未绑定训练话题')
    try {
      const updated = await updateTrainingTopic(topic.id, { teachingMarkdown })
      setEditingStory((current) => current ? {
        ...current,
        trainingTopic: { ...topic, teachingMarkdown: updated.teachingMarkdown ?? teachingMarkdown },
      } : current)
      toast.success('教学文档已保存')
    } catch {
      toast.error('教学文档保存失败')
    }
  }, [editingStory?.trainingTopic])

  const getLocationName = (id?: string | null) =>
    locations.find((l) => l.id === id)?.displayName ?? null

  const getCharacterName = (id?: string | null) =>
    characters.find((c) => c.id === id)?.displayName ?? null

  // ── Filters & pagination (must be before any early return!) ──
  useEffect(() => { setPage(1) }, [search, packageTypeFilter, categoryFilter])

  // ─── packageType label helper ───
  const packageTypeLabel = (t: string) =>
    t === 'daily' ? '日常' : t === 'exam' ? '考试' : t === 'story' ? '故事' : t === 'course' ? '课程' : t === 'foundation' ? '零基础' : t

  // ─── Editor View ─────────────────────────────

  if (isCreating || editingStory) {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeEditor}>
            <ChevronRight className="size-4 rotate-180" />
          </Button>
          <div>
            <h2 className="text-lg font-bold">
              {isCreating ? '新建故事' : `编辑: ${editingStory?.title}`}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isCreating
                ? '使用 Ink 脚本语法编写对话，右侧实时编译预览 VN 效果'
                : `Key: ${editingStory?.key} · 版本 ${(editingStory?.version ?? 0) + 1}`}
            </p>
          </div>
        </div>

        <InkStoryEditor
          storyId={editingStory?.id}
          initialSource={editingStory?.inkSource ?? undefined}
          initialKey={editingStory?.key ?? ''}
          initialTitle={editingStory?.title ?? ''}
          locations={locations}
          characters={characters}
          trainingTopic={editingStory?.trainingTopic}
          onSaveTeachingMarkdown={handleSaveTeachingMarkdown}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    )
  }

  // ─── List View ───────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题、Key 或关联话题..."
            className="pl-9"
          />
        </div>
        <Select value={packageTypeFilter} onChange={(e) => setPackageTypeFilter((e.target as HTMLSelectElement).value)} className="w-[110px]">
          <SelectItem value="all">一级分类</SelectItem>
          {filters.packageTypes.map((t) => (
            <SelectItem key={t} value={t}>{packageTypeLabel(t)}</SelectItem>
          ))}
        </Select>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter((e.target as HTMLSelectElement).value)} className="w-[140px]">
          <SelectItem value="all">二级分类</SelectItem>
          {filters.categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>共 {total} 个</span>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />新建故事
        </Button>
      </div>

      {stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <ScrollText className="size-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search || packageTypeFilter !== 'all' || categoryFilter !== 'all' ? '没有匹配的故事' : '暂无故事'}
          </p>
          {!search && packageTypeFilter === 'all' && categoryFilter === 'all' && (
            <>
              <p className="mt-1 text-xs text-muted-foreground/60">
                点击「新建故事」开始编写第一个对话脚本
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="mr-1 size-3.5" />
                新建故事
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <Card
                key={story.id}
                className={cn(
                  'cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm',
                  selectedId === story.id && 'border-primary ring-1 ring-primary/20',
                )}
                onClick={() => openEditor(story)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                        <ScrollText className="size-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{story.title}</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">{story.key}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleDelete(story) }}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {story.scriptType === 'practice' ? '练习' :
                       story.scriptType === 'episode' ? '关卡' :
                       story.scriptType === 'side_quest' ? '支线' : '自由'}
                    </Badge>
                    {story.trainingTopic && (
                      <Badge className="text-[10px] bg-green-500/10 text-green-600">
                        <BookOpen className="mr-0.5 size-2.5" />
                        {story.trainingTopic.title}
                      </Badge>
                    )}
                    {story.locationId && getLocationName(story.locationId) && (
                      <Badge variant="outline" className="text-[10px]">
                        <MapPin className="mr-0.5 size-2.5" />
                        {getLocationName(story.locationId)}
                      </Badge>
                    )}
                    {story.characterId && getCharacterName(story.characterId) && (
                      <Badge variant="outline" className="text-[10px]">
                        <Users className="mr-0.5 size-2.5" />
                        {getCharacterName(story.characterId)}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    版本 {story.version} · {new Date(story.updatedAt).toLocaleDateString('zh-CN')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronLeft className="size-4 rotate-180" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* NQTR Architecture Guide */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">NQTR 架构说明</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              故事需要<strong>地点</strong>（在地图管理中创建）和<strong>角色</strong>（在角色管理中创建）。
              完成故事编写后，前往<strong>场景管理</strong> → 选择场景 → 训练话题 →
              绑定 Ink 脚本，用户即可在练习中使用该故事进行对话练习。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
