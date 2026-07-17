import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Plus, Trash2, Edit3, MapPin, Users, BookOpen, Play,
  ChevronRight, ScrollText, X, Search, ChevronLeft, PackageOpen, Layers3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  listStories, createStory, updateStory, deleteStory, getStory, getStoryFilters,
  deleteStoriesByScene,
  listSceneCategories, getTrainingTopic,
  listLocations, listCharacters, updateTrainingTopic,
  type StoryData, type StoryFilters, type GameLocationData, type GameCharacter, type SceneCategory,
} from '../api-content-admin'
import { InkStoryEditor } from './ink-story-editor'
import { cn } from '@/lib/cn'

const PAGE_SIZE = 50

interface StoryWorkshopTabProps {
  locations: GameLocationData[]
  characters: GameCharacter[]
  initialStoryId?: string
  workspace?: 'practice' | 'narrative'
}

export function StoryWorkshopTab({ locations, characters, initialStoryId, workspace = 'practice' }: StoryWorkshopTabProps) {
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
  // 二级分类 — 按一级分类过滤（与学习包内容管理一致，使用 listSceneCategories）
  const [categories, setCategories] = useState<SceneCategory[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, pageSize: PAGE_SIZE, scope: workspace }
      if (search) params.search = search
      if (packageTypeFilter !== 'all') params.packageType = packageTypeFilter
      if (categoryFilter !== 'all') params.categoryId = categoryFilter
      const data = await listStories(params)
      setStories(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch { toast.error('加载故事列表失败') }
    finally { setLoading(false) }
  }, [page, search, packageTypeFilter, categoryFilter, workspace])

  useEffect(() => { load() }, [load])

  // Load scriptTypes + packageTypes once (static)
  useEffect(() => {
    getStoryFilters().then(setFilters).catch(() => {})
  }, [])

  // Load categories filtered by packageType (same pattern as admin-scenes-page)
  useEffect(() => {
    listSceneCategories(packageTypeFilter !== 'all' ? packageTypeFilter as any : undefined)
      .then(setCategories)
      .catch(() => {})
  }, [packageTypeFilter])

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

  // Auto-open story from URL param (cross-page navigation) — fetch directly to bypass pagination
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (!initialStoryId || autoOpenedRef.current) return
    autoOpenedRef.current = true
    getStory(initialStoryId)
      .then((full) => {
        setEditingStory(full)
        setSelectedId(full.id)
        setIsCreating(false)
      })
      .catch(() => {})
  }, [initialStoryId])

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
        scriptType: editingStory?.scriptType ?? (workspace === 'practice' ? 'practice' : 'episode'),
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
  }, [editingStory, load, workspace])

  const handleDelete = useCallback(async (story: StoryData) => {
    if (!confirm(`确定删除故事 "${story.title}"？此操作不可撤销。`)) return
    try {
      await deleteStory(story.id)
      toast.success('已删除')
      if (selectedId === story.id) closeEditor()
      load()
    } catch { toast.error('删除失败') }
  }, [selectedId, closeEditor, load])

  const handleDeleteSceneStories = useCallback(async (sceneId: string, sceneTitle: string, count: number) => {
    if (!confirm(`确定删除学习包「${sceneTitle}」下的 ${count} 个故事？此操作不可撤销。`)) return
    try {
      const result = await deleteStoriesByScene(sceneId)
      toast.success(`已删除 ${result.count} 个故事`)
      if (editingStory?.trainingTopic?.scene?.id === sceneId) closeEditor()
      await load()
    } catch {
      toast.error('批量删除失败')
    }
  }, [closeEditor, editingStory?.trainingTopic?.scene?.id, load])

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
  // Reset secondary filter when primary filter changes
  useEffect(() => { setCategoryFilter('all') }, [packageTypeFilter])
  // Safeguard: reset category if it no longer exists in filtered list
  useEffect(() => {
    if (categoryFilter !== 'all' && !categories.some((c) => c.id === categoryFilter)) {
      setCategoryFilter('all')
    }
  }, [categories, categoryFilter])

  // ─── packageType label helper ───
  const packageTypeLabel = (t: string) =>
    t === 'daily' ? '日常' : t === 'exam' ? '考试' : t === 'story' ? '故事' : t === 'course' ? '课程' : t === 'foundation' ? '零基础' : t

  const storyGroups = useMemo(() => {
    const map = new Map<string, {
      key: string
      sceneId?: string
      sceneTitle: string
      packageType?: string
      categoryName?: string
      stories: StoryData[]
    }>()
    for (const story of stories) {
      const scene = story.trainingTopic?.scene
      const key = scene?.id ?? 'unbound'
      const current = map.get(key) ?? {
        key,
        sceneId: scene?.id,
        sceneTitle: scene?.title ?? '未绑定学习包',
        packageType: scene?.packageType,
        categoryName: scene?.category?.name,
        stories: [],
      }
      current.stories.push(story)
      map.set(key, current)
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === 'unbound') return 1
      if (b.key === 'unbound') return -1
      return a.sceneTitle.localeCompare(b.sceneTitle, 'zh-CN')
    })
  }, [stories])

  const allGroupsCollapsed = storyGroups.length > 0 && storyGroups.every((group) => collapsedGroups.has(group.key))

  useEffect(() => {
    setCollapsedGroups((current) => {
      const validKeys = new Set(storyGroups.map((group) => group.key))
      const next = new Set(Array.from(current).filter((key) => validKeys.has(key)))
      return next.size === current.size ? current : next
    })
  }, [storyGroups])

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleAllGroups = useCallback(() => {
    setCollapsedGroups((current) => {
      if (storyGroups.length > 0 && storyGroups.every((group) => current.has(group.key))) return new Set()
      return new Set(storyGroups.map((group) => group.key))
    })
  }, [storyGroups])

  // ─── Editor View ─────────────────────────────

  if (isCreating || editingStory) {
    const handleGoToLearningPacks = async () => {
      const topicId = editingStory?.trainingTopic?.id
      if (topicId) {
        try {
          const topic = await getTrainingTopic(topicId)
          const params = new URLSearchParams()
          if (topic.scene?.packageType) params.set('packageType', topic.scene.packageType)
          // Navigate with scene context
          window.location.hash = '#/admin/learning-packs' + (params.toString() ? '?' + params.toString() : '')
        } catch {
          window.location.hash = '#/admin/learning-packs'
        }
      } else {
        window.location.hash = '#/admin/learning-packs'
      }
    }

    return (
      <div className="space-y-4">
        {/* Back button */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeEditor}>
            <ChevronRight className="size-4 rotate-180" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-bold">
              {isCreating
                ? workspace === 'practice' ? '新建话题实战' : '新建剧情脚本'
                : `编辑: ${editingStory?.title}`}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isCreating
                ? '使用 Ink 脚本语法编写对话，右侧实时编译预览 VN 效果'
                : `Key: ${editingStory?.key} · 版本 ${(editingStory?.version ?? 0) + 1}`}
            </p>
          </div>
          {editingStory?.trainingTopic && (
            <Button size="sm" variant="outline" className="gap-1" onClick={handleGoToLearningPacks}>
              <PackageOpen className="size-3.5" />
              学习包管理
            </Button>
          )}
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
            placeholder={workspace === 'practice' ? '搜索标题、Key 或关联话题...' : '搜索剧情标题或 Key...'}
            className="pl-9"
          />
        </div>
        <Select value={packageTypeFilter} onChange={(e) => setPackageTypeFilter((e.target as HTMLSelectElement).value)} className="w-[110px]">
          <SelectItem value="all">全部一级分类</SelectItem>
          {filters.packageTypes.map((t) => (
            <SelectItem key={t} value={t}>{packageTypeLabel(t)}</SelectItem>
          ))}
        </Select>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter((e.target as HTMLSelectElement).value)} className="w-[140px]">
          <SelectItem value="all">全部二级分类</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>共 {total} 个</span>
        </div>
        {storyGroups.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1" onClick={toggleAllGroups}>
            <ChevronRight className={cn('size-3.5 transition-transform', allGroupsCollapsed ? '' : 'rotate-90')} />
            {allGroupsCollapsed ? '全部展开' : '全部收起'}
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1" onClick={() => {
          const params = new URLSearchParams()
          if (packageTypeFilter !== 'all') params.set('packageType', packageTypeFilter)
          if (categoryFilter !== 'all') params.set('categoryId', categoryFilter)
          const qs = params.toString()
          window.location.hash = '#/admin/learning-packs' + (qs ? '?' + qs : '')
        }}>
          <PackageOpen className="size-3.5" />
          学习包管理
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />{workspace === 'practice' ? '新建话题实战' : '新建剧情脚本'}
        </Button>
      </div>

      {stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <ScrollText className="size-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search || packageTypeFilter !== 'all' || categoryFilter !== 'all'
              ? '没有匹配的内容'
              : workspace === 'practice' ? '暂无话题实战' : '暂无剧情脚本'}
          </p>
          {!search && packageTypeFilter === 'all' && categoryFilter === 'all' && (
            <>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {workspace === 'practice' ? '从学习包话题创建练习 VN' : '创建剧情关卡、支线或 NPC 对话脚本'}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="mr-1 size-3.5" />
                {workspace === 'practice' ? '新建话题实战' : '新建剧情脚本'}
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {storyGroups.map((group) => (
              <section key={group.key} className="rounded-lg border border-border/70 bg-background">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => toggleGroup(group.key)}
                    >
                      <ChevronRight className={cn(
                        'size-4 transition-transform',
                        !collapsedGroups.has(group.key) && 'rotate-90',
                      )} />
                    </Button>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Layers3 className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">{group.sceneTitle}</h3>
                        {group.packageType && (
                          <Badge variant="outline" className="text-[10px]">{packageTypeLabel(group.packageType)}</Badge>
                        )}
                        {group.categoryName && (
                          <Badge variant="secondary" className="text-[10px]">{group.categoryName}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{group.stories.length} 个故事脚本</p>
                    </div>
                  </div>
                  {group.sceneId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => void handleDeleteSceneStories(group.sceneId!, group.sceneTitle, group.stories.length)}
                    >
                      <Trash2 className="size-3.5" />
                      删除本组
                    </Button>
                  )}
                </div>
                {!collapsedGroups.has(group.key) && (
                  <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.stories.map((story) => (
                      <Card
                        key={story.id}
                        className={cn(
                          'cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm',
                          selectedId === story.id && 'border-primary ring-1 ring-primary/20',
                        )}
                        onClick={() => openEditor(story)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                                <ScrollText className="size-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <CardTitle className="truncate text-base">{story.title}</CardTitle>
                                <p className="truncate font-mono text-xs text-muted-foreground">{story.key}</p>
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
                              <Badge className="max-w-full bg-green-500/10 text-[10px] text-green-600">
                                <BookOpen className="mr-0.5 size-2.5 shrink-0" />
                                <span className="truncate">{story.trainingTopic.title}</span>
                              </Badge>
                            )}
                            {story.locationId && getLocationName(story.locationId) && (
                              <Badge variant="outline" className="max-w-full text-[10px]">
                                <MapPin className="mr-0.5 size-2.5 shrink-0" />
                                <span className="truncate">{getLocationName(story.locationId)}</span>
                              </Badge>
                            )}
                            {story.characterId && getCharacterName(story.characterId) && (
                              <Badge variant="outline" className="max-w-full text-[10px]">
                                <Users className="mr-0.5 size-2.5 shrink-0" />
                                <span className="truncate">{getCharacterName(story.characterId)}</span>
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
                )}
              </section>
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

      {/* Workspace guide */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{workspace === 'practice' ? '练习 VN 归属规则' : '剧情脚本归属规则'}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {workspace === 'practice' ? (
                <>这里仅管理学习包话题的<strong>练习型 VN</strong>。脚本应绑定 TrainingTopic，角色和地点只是可选素材；完成后回到学习包话题确认绑定关系。</>
              ) : (
                <>这里管理剧情关卡、地图支线和 NPC 对话。角色与地图在同一个“剧情包内容”工作区维护，所有类型复用当前这一套 Ink 编辑器。</>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
