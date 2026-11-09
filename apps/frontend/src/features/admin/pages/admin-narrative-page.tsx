import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Loader2, PackageCheck, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectItem } from '@/components/ui/select'
import { toast } from 'sonner'
import { StoryChapterStudio } from '../components/story-chapter-studio'
import { NarrativeActivityList, NarrativeCommitmentList, NarrativeQuestList } from '../components/narrative-nqtr-registries'
import { NqtrPackageSetup } from '../components/nqtr-package-setup'
import { NqtrPackagePreview } from '../components/nqtr-package-preview'
import { NqtrPackageChrome } from '../components/nqtr-package-chrome'
import { NqtrChapterStudio } from '../components/nqtr-chapter-studio'
import { parseNqtrTime, parseNqtrChrome, type NqtrChrome, type NqtrTimeSettings } from '../components/maps/nqtr-model'
import { FileUploadField } from '../components/file-upload-field'
import {
  listCharacters,
  listLocations,
  listScenes,
  listMaps,
  listSceneCategories,
  listNqtrChapters,
  createScene,
  deleteScene,
  updateScene,
  type GameCharacter,
  type NqtrChapter,
  type GameLocationData,
  type GameMapData,
  type Scene,
  type SceneCategory,
} from '../api-content-admin'

type NqtrSection = 'segments' | 'chapters' | 'activities' | 'commitments' | 'quests' | 'setup' | 'preview' | 'chrome'

/** 剧情包工作区：只管理剧情包与章节，并引用全局角色、地图资产。 */
export function AdminNarrativePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [characters, setCharacters] = useState<GameCharacter[]>([])
  const [locations, setLocations] = useState<GameLocationData[]>([])
  const [packages, setPackages] = useState<Scene[]>([])
  const [categories, setCategories] = useState<SceneCategory[]>([])
  const [packageDialogOpen, setPackageDialogOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<Scene | null>(null)
  const [packageSaving, setPackageSaving] = useState(false)
  const [deletingPackage, setDeletingPackage] = useState<Scene | null>(null)
  const [packageDeleting, setPackageDeleting] = useState(false)
  const [maps, setMaps] = useState<GameMapData[]>([])
  const [nqtrSection, setNqtrSection] = useState<NqtrSection>('setup')
  const [packageForm, setPackageForm] = useState({ title: '', description: '', categoryId: '', isFree: false, coverImage: '', kind: 'story' as 'story' | 'nqtr' })
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [accessFilter, setAccessFilter] = useState('all')
  const packageId = searchParams.get('packageId') || ''
  const selectedPackage = packages.find((item) => item.id === packageId)
  const filteredPackages = packages.filter((item) => {
    const matchesSearch = !search || `${item.title} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || item.categoryId === categoryFilter
    const matchesAccess = accessFilter === 'all' || (accessFilter === 'free' ? item.isFree : !item.isFree)
    return matchesSearch && matchesCategory && matchesAccess
  })

  const loadAssets = useCallback(async () => {
    const [nextCharacters, nextLocations, storyPackages, nqtrPackages, nextCategories, nextMaps] = await Promise.all([
      listCharacters().catch(() => []),
      listLocations().catch(() => []),
      listScenes(undefined, 'story').catch(() => []),
      listScenes(undefined, 'nqtr').catch(() => []),
      listSceneCategories().catch(() => []),
      listMaps().catch(() => []),
    ])
    setCharacters(nextCharacters)
    setLocations(nextLocations)
    setPackages([...storyPackages, ...nqtrPackages])
    setCategories(nextCategories)
    setMaps(nextMaps)
  }, [])

  useEffect(() => { void loadAssets() }, [loadAssets])

  const openPackage = (id: string) => {
    setSearchParams({ packageId: id })
  }

  const leavePackage = () => setSearchParams({})

  const openPackageDialog = (item?: Scene) => {
    setEditingPackage(item ?? null)
    setPackageForm({
      title: item?.title ?? '',
      description: item?.description ?? '',
      categoryId: item?.categoryId ?? categories[0]?.id ?? '',
      isFree: item?.isFree ?? false,
      coverImage: item?.coverImage ?? '',
      kind: item?.packageType === 'nqtr' ? 'nqtr' : 'story',
    })
    setPackageDialogOpen(true)
  }

  const savePackage = async () => {
    if (!packageForm.title.trim() || !packageForm.categoryId) return
    setPackageSaving(true)
    try {
      const saved = editingPackage
        ? await updateScene(editingPackage.id, packageForm)
        : await createScene({
          ...packageForm,
          packageType: packageForm.kind,
          location: `${packageForm.kind}:${Date.now().toString(36)}`,
          requiredOutputLevel: 'L1',
          requiredUserLevel: 1,
        })
      toast.success(editingPackage ? '剧情包已更新' : '剧情包已创建')
      setPackageDialogOpen(false)
      await loadAssets()
      if (!editingPackage) setSearchParams({ packageId: saved.id })
    } catch { toast.error('剧情包保存失败') }
    finally { setPackageSaving(false) }
  }

  const confirmDeletePackage = async () => {
    if (!deletingPackage) return
    setPackageDeleting(true)
    try {
      await deleteScene(deletingPackage.id)
      if (packageId === deletingPackage.id) leavePackage()
      setDeletingPackage(null)
      await loadAssets()
      toast.success('剧情包及关联章节已删除')
    } catch (error: any) {
      toast.error(error?.message || '剧情包删除失败')
    } finally {
      setPackageDeleting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {selectedPackage && <Button variant="ghost" size="icon" className="mt-0.5 size-8" onClick={leavePackage}><ArrowLeft className="size-4" /></Button>}
          <div><h1 className="text-2xl font-bold">{selectedPackage?.title ?? '剧情包内容'}</h1><p className="mt-1 text-sm text-muted-foreground">{selectedPackage ? '编辑章节、剧集及沉浸式输出体验。' : '管理沉浸式剧情包、章节与剧集内容。'}</p></div>
        </div>
        {selectedPackage ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDeletingPackage(selectedPackage)} className="text-destructive hover:text-destructive">
              <Trash2 className="mr-2 size-4" />删除剧情包
            </Button>
            <Button variant="outline" onClick={() => { window.location.hash = '#/admin/script-packs' }}>
              <PackageCheck className="mr-2 size-4" />剧本包发布
            </Button>
          </div>
        ) : <Button onClick={() => openPackageDialog()}><Plus className="mr-2 size-4" />新建剧情包</Button>}
      </header>

      {!selectedPackage ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-[280px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索剧情包..." className="pl-9" /></div>
            <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-[150px]"><SelectItem value="all">全部分类</SelectItem>{categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</Select>
            <Select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value)} className="w-[130px]"><SelectItem value="all">全部权限</SelectItem><SelectItem value="free">免费体验</SelectItem><SelectItem value="member">会员内容</SelectItem></Select>
            <span className="text-sm text-muted-foreground">共 {filteredPackages.length} 个剧情包</span>
          </div>
          {filteredPackages.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredPackages.map((item) => (
            <Card key={item.id} className="group cursor-pointer overflow-hidden transition-colors hover:bg-muted/30" onClick={() => openPackage(item.id)}>
              {item.coverImage ? (
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <img src={item.coverImage} alt={item.title} className="size-full object-cover" />
                </div>
              ) : null}
              <CardContent className="p-5"><div className="flex items-start gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><BookOpen className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-1"><h3 className="min-w-0 flex-1 truncate font-semibold">{item.title}</h3><Button variant="ghost" size="icon" className="size-7" title="编辑剧情包" onClick={(event) => { event.stopPropagation(); openPackageDialog(item) }}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="删除剧情包" onClick={(event) => { event.stopPropagation(); setDeletingPackage(item) }}><Trash2 className="size-3.5" /></Button></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description || '尚未填写剧情包简介'}</p><p className="mt-3 text-xs text-muted-foreground">{item.packageType === 'nqtr' ? 'NQTR 探索' : '轻量剧情'} · {item._count?.storyEpisodes ?? 0} 个剧集 · {item.isFree ? '免费体验' : '会员内容'}</p></div></div><Button size="sm" className="mt-4 w-full">编辑剧情</Button></CardContent>
            </Card>
          ))}</div> : <div className="rounded-xl border border-dashed py-16 text-center"><BookOpen className="mx-auto size-10 text-muted-foreground/25" /><p className="mt-3 text-sm font-medium">{packages.length ? '没有匹配的剧情包' : '还没有剧情包'}</p><p className="mt-1 text-xs text-muted-foreground">{packages.length ? '尝试调整搜索或筛选条件。' : '点击右上角新建第一本剧情包。'}</p></div>}
        </div>
      ) : selectedPackage.packageType === 'nqtr' ? (
        <NqtrPackageWorkspace
          packageId={selectedPackage.id}
          mapId={selectedPackage.nqtrMapId}
          timeSettings={selectedPackage.nqtrTime}
          chromeSettings={selectedPackage.nqtrChrome}
          characterIds={selectedPackage.nqtrCast?.map((item) => item.characterId) ?? []}
          maps={maps}
          characters={characters}
          locations={locations}
          section={nqtrSection}
          onSection={setNqtrSection}
          onSaved={loadAssets}
        />
      ) : <StoryChapterStudio
        packageId={selectedPackage.id}
        locations={locations}
        characters={characters}
      />}

      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPackage ? '编辑剧情包' : '新建剧情包'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>剧情包名称</Label><Input value={packageForm.title} onChange={(event) => setPackageForm({ ...packageForm, title: event.target.value })} placeholder="例如：漫语町奇遇记" /></div>
            <div><Label>剧情分类</Label><Select value={packageForm.categoryId} onChange={(event) => setPackageForm({ ...packageForm, categoryId: event.target.value })}><option value="">选择分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>{!categories.length && <p className="mt-1 text-xs text-destructive">当前没有可用的内容分类。</p>}</div>
            <div><Label>剧情包类型</Label><Select value={packageForm.kind} onChange={(event) => setPackageForm({ ...packageForm, kind: event.target.value === 'nqtr' ? 'nqtr' : 'story' })} disabled={Boolean(editingPackage)}><SelectItem value="story">轻量剧情</SelectItem><SelectItem value="nqtr">NQTR 探索</SelectItem></Select></div>
            <div><Label>剧情简介</Label><Textarea rows={5} value={packageForm.description} onChange={(event) => setPackageForm({ ...packageForm, description: event.target.value })} placeholder="世界观、玩家身份、核心冲突和主要输出体验……" /></div>
            <div>
              <Label>封面图片</Label>
              <FileUploadField
                value={packageForm.coverImage}
                onChange={(url) => setPackageForm({ ...packageForm, coverImage: url })}
                accept="image/*"
                uploadLabel="上传封面"
                placeholder="输入封面图片 URL 或点击上传"
                previewSize="lg"
                group="scene_cover"
              />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={packageForm.isFree} onChange={(event) => setPackageForm({ ...packageForm, isFree: event.target.checked })} />作为免费体验剧情包</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPackageDialogOpen(false)}>取消</Button><Button onClick={() => void savePackage()} disabled={packageSaving || !packageForm.title.trim() || !packageForm.categoryId}>{packageSaving ? '保存中…' : '保存剧情包'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingPackage)} onOpenChange={(open) => { if (!open && !packageDeleting) setDeletingPackage(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除剧情包“{deletingPackage?.title}”？</DialogTitle>
            <DialogDescription>
              将同时删除该剧情包下的 {deletingPackage?._count?.storyEpisodes ?? 0} 个章节，以及关联的剧情脚本、练习记录和作品。共享角色、地图与音色资产不会被删除。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={packageDeleting} onClick={() => setDeletingPackage(null)}>取消</Button>
            <Button variant="destructive" disabled={packageDeleting} onClick={() => void confirmDeletePackage()}>
              {packageDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              {packageDeleting ? '删除中…' : '确认关联删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NqtrPackageWorkspace({
  packageId,
  mapId,
  timeSettings,
  chromeSettings,
  characterIds,
  maps,
  characters,
  locations,
  section,
  onSection,
  onSaved,
}: {
  packageId: string
  mapId?: string | null
  timeSettings?: NqtrTimeSettings | null
  chromeSettings?: NqtrChrome | null
  characterIds: string[]
  maps: GameMapData[]
  characters: GameCharacter[]
  locations: GameLocationData[]
  section: NqtrSection
  onSection: (section: NqtrSection) => void
  onSaved: () => Promise<void>
}) {
  const [draftMapId, setDraftMapId] = useState(mapId ?? '')
  const [draftCharacters, setDraftCharacters] = useState(characterIds)
  const [time, setTime] = useState<NqtrTimeSettings>(() => parseNqtrTime(timeSettings))
  const [chrome, setChrome] = useState<NqtrChrome>(() => parseNqtrChrome(chromeSettings))
  const [chapters, setChapters] = useState<NqtrChapter[]>([])
  const [chapterId, setChapterId] = useState('')
  const [saving, setSaving] = useState(false)
  const rememberChapters = useCallback((next: NqtrChapter[]) => setChapters(next), [])
  const rememberChapter = useCallback((id: string) => setChapterId(id), [])
  useEffect(() => {
    let cancelled = false
    void listNqtrChapters(packageId).then((next) => {
      if (cancelled) return
      setChapters(next)
      setChapterId((current) => current && next.some((item) => item.id === current) ? current : (next[0]?.id ?? ''))
    }).catch(() => toast.error('章节加载失败'))
    return () => { cancelled = true }
  }, [packageId])
  const chapter = chapters.find((item) => item.id === chapterId)
  const sections = [
    ['setup', '设定'],
    ['segments', '章节'],
    ['chapters', '对白章节'],
    ['activities', '行为'],
    ['commitments', '日程'],
    ['quests', '任务'],
    ['preview', '总预览'],
    ['chrome', '外观'],
  ] as const

  const saveChrome = async () => {
    setSaving(true)
    try {
      await updateScene(packageId, { nqtrChrome: chrome })
      await onSaved()
      toast.success('外观已保存')
    } catch {
      toast.error('外观保存失败')
    } finally {
      setSaving(false)
    }
  }

  const saveSetup = async () => {
    setSaving(true)
    try {
      await updateScene(packageId, { nqtrMapId: draftMapId || null, characterIds: draftCharacters, nqtrTime: time })
      await onSaved()
      toast.success('剧情包设定已保存')
    } catch {
      toast.error('剧情包设定保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sections.map(([key, label]) => (
          <Button key={key} variant={section === key ? 'default' : 'outline'} onClick={() => onSection(key)}>{label}</Button>
        ))}
      </div>
      {section === 'setup' && (
        <NqtrPackageSetup
          maps={maps}
          characters={characters}
          mapId={draftMapId}
          characterIds={draftCharacters}
          time={time}
          saving={saving}
          onMapId={setDraftMapId}
          onCharacterIds={setDraftCharacters}
          onTime={setTime}
          onSave={() => void saveSetup()}
        />
      )}
      {section === 'segments' && (
        <NqtrChapterStudio
          sceneId={packageId}
          characters={characters.filter((character) => draftCharacters.includes(character.id) || !draftCharacters.length)}
          locations={locations.filter((location) => !draftMapId && !mapId || location.mapId === (draftMapId || mapId))}
          chapterId={chapterId}
          onChapterId={rememberChapter}
          onChapters={rememberChapters}
        />
      )}
      {section === 'chapters' && <StoryChapterStudio packageId={packageId} locations={locations} characters={characters.filter((character) => draftCharacters.includes(character.id) || !draftCharacters.length)} />}
      {section === 'activities' && <NarrativeActivityList sceneId={packageId} mapId={draftMapId || mapId} chapterId={chapterId} timeSlots={time.timeSlots} />}
      {section === 'commitments' && <NarrativeCommitmentList sceneId={packageId} mapId={draftMapId || mapId} chapterId={chapterId} timeSlots={time.timeSlots} />}
      {section === 'quests' && <NarrativeQuestList sceneId={packageId} mapId={draftMapId || mapId} chapterId={chapterId} />}
      {section === 'preview' && (
        <NqtrPackagePreview
          sceneId={packageId}
          map={maps.find((item) => item.id === (draftMapId || mapId)) ?? null}
          time={time}
          chrome={chrome}
          characters={characters}
          chapterId={chapterId}
          chapterLocationIds={chapter?.locations.map((item) => item.locationId) ?? []}
        />
      )}
      {section === 'chrome' && (
        <NqtrPackageChrome
          chrome={chrome}
          saving={saving}
          onChange={setChrome}
          onSave={() => void saveChrome()}
        />
      )}
    </div>
  )
}
