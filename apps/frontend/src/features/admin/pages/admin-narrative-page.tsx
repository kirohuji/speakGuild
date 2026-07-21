import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Pencil, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectItem } from '@/components/ui/select'
import { toast } from 'sonner'
import { StoryChapterStudio } from '../components/story-chapter-studio'
import {
  listCharacters,
  listLocations,
  listScenes,
  listSceneCategories,
  createScene,
  updateScene,
  type GameCharacter,
  type GameLocationData,
  type Scene,
  type SceneCategory,
} from '../api-content-admin'

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
  const [packageForm, setPackageForm] = useState({ title: '', description: '', categoryId: '', isFree: false })
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
    const [nextCharacters, nextLocations, nextPackages, nextCategories] = await Promise.all([
      listCharacters().catch(() => []),
      listLocations().catch(() => []),
      listScenes(undefined, 'story').catch(() => []),
      listSceneCategories().catch(() => []),
    ])
    setCharacters(nextCharacters)
    setLocations(nextLocations)
    setPackages(nextPackages)
    setCategories(nextCategories)
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
    })
    setPackageDialogOpen(true)
  }

  const savePackage = async () => {
    if (!packageForm.title.trim() || !packageForm.categoryId) return
    setPackageSaving(true)
    try {
      if (editingPackage) {
        await updateScene(editingPackage.id, packageForm)
      } else {
        await createScene({
          ...packageForm,
          packageType: 'story',
          location: `story:${Date.now().toString(36)}`,
          requiredOutputLevel: 'L1',
          requiredUserLevel: 1,
        })
      }
      toast.success(editingPackage ? '剧情包已更新' : '剧情包已创建')
      setPackageDialogOpen(false)
      await loadAssets()
    } catch { toast.error('剧情包保存失败') }
    finally { setPackageSaving(false) }
  }

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {selectedPackage && <Button variant="ghost" size="icon" className="mt-0.5 size-8" onClick={leavePackage}><ArrowLeft className="size-4" /></Button>}
          <div><h1 className="text-2xl font-bold">{selectedPackage?.title ?? '剧情包内容'}</h1><p className="mt-1 text-sm text-muted-foreground">{selectedPackage ? '编辑章节、剧集及沉浸式输出体验。' : '管理沉浸式剧情包、章节与剧集内容。'}</p></div>
        </div>
        {!selectedPackage && <Button onClick={() => openPackageDialog()}><Plus className="mr-2 size-4" />新建剧情包</Button>}
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
            <Card key={item.id} className="group cursor-pointer transition-colors hover:bg-muted/30" onClick={() => openPackage(item.id)}>
              <CardContent className="p-5"><div className="flex items-start gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><BookOpen className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="min-w-0 flex-1 truncate font-semibold">{item.title}</h3><Button variant="ghost" size="icon" className="size-7" onClick={(event) => { event.stopPropagation(); openPackageDialog(item) }}><Pencil className="size-3.5" /></Button></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description || '尚未填写剧情包简介'}</p><p className="mt-3 text-xs text-muted-foreground">{item._count?.storyEpisodes ?? 0} 个剧集 · {item.isFree ? '免费体验' : '会员内容'}</p></div></div><Button size="sm" className="mt-4 w-full">编辑剧情</Button></CardContent>
            </Card>
          ))}</div> : <div className="rounded-xl border border-dashed py-16 text-center"><BookOpen className="mx-auto size-10 text-muted-foreground/25" /><p className="mt-3 text-sm font-medium">{packages.length ? '没有匹配的剧情包' : '还没有剧情包'}</p><p className="mt-1 text-xs text-muted-foreground">{packages.length ? '尝试调整搜索或筛选条件。' : '点击右上角新建第一本剧情包。'}</p></div>}
        </div>
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
            <div><Label>剧情简介</Label><Textarea rows={5} value={packageForm.description} onChange={(event) => setPackageForm({ ...packageForm, description: event.target.value })} placeholder="世界观、玩家身份、核心冲突和主要输出体验……" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={packageForm.isFree} onChange={(event) => setPackageForm({ ...packageForm, isFree: event.target.checked })} />作为免费体验剧情包</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPackageDialogOpen(false)}>取消</Button><Button onClick={() => void savePackage()} disabled={packageSaving || !packageForm.title.trim() || !packageForm.categoryId}>{packageSaving ? '保存中…' : '保存剧情包'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
