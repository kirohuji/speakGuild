import { useEffect, useMemo, useState } from 'react'
import { ReactReader } from 'react-reader'
import { BookOpen, Check, FileArchive, FolderKanban, Link2, Loader2, Plus, Save, Search, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import type { Chunk, Scene, SentencePatternFull, Vocabulary } from '../api-content-admin'
import { contentExperienceAdminApi, type AdminSceneExperience, type PackageGroup } from '../api-content-experiences'
import { FileUploadField } from './file-upload-field'

function modeName(mode: Scene['contentMode']) {
  return ({ practice: '知识点练习', writing: '写作', reading: '阅读', listening: '听力', novel: '小说', story: '剧情' } as const)[mode]
}

function KnowledgePicker({
  items,
  selectedIds,
  onChange,
  placeholder,
}: {
  items: Array<{ id: string; label: string; description: string }>
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(normalized))
  }, [items, query])
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
      <div className="relative border-b border-border/70">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className="border-0 pl-9 shadow-none focus-visible:ring-0" />
      </div>
      <div className="max-h-64 divide-y divide-border/60 overflow-y-auto">
        {filtered.map((item) => {
          const selected = selectedIds.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(selected ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id])}
              className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50', selected && 'bg-primary/[0.06]')}
            >
              <span className={cn('flex size-5 shrink-0 items-center justify-center rounded border', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                {selected && <Check className="size-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">没有匹配内容</p>}
      </div>
    </div>
  )
}

export function ContentExperiencePanel({
  scene,
  vocabularies,
  chunks,
  patterns,
}: {
  scene: Scene
  vocabularies: Vocabulary[]
  chunks: Chunk[]
  patterns: SentencePatternFull[]
}) {
  const [experience, setExperience] = useState<AdminSceneExperience | null>(null)
  const [groups, setGroups] = useState<PackageGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [epubUploading, setEpubUploading] = useState(false)
  const [readerLocation, setReaderLocation] = useState<string | number>(0)
  const [groupId, setGroupId] = useState('')
  const [volumeLabel, setVolumeLabel] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [requiredPrevious, setRequiredPrevious] = useState(false)
  const [vocabularyIds, setVocabularyIds] = useState<string[]>([])
  const [chunkIds, setChunkIds] = useState<string[]>([])
  const [patternIds, setPatternIds] = useState<string[]>([])
  const [seriesDialog, setSeriesDialog] = useState(false)
  const [groupDialog, setGroupDialog] = useState(false)
  const [groupForm, setGroupForm] = useState({ name: '', slug: '', description: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [nextExperience, nextGroups] = await Promise.all([
        contentExperienceAdminApi.getScene(scene.id),
        contentExperienceAdminApi.listGroups(),
      ])
      setExperience(nextExperience)
      setGroups(nextGroups)
      setGroupId(nextExperience.groupItem?.group.id ?? '')
      setVolumeLabel(nextExperience.groupItem?.volumeLabel ?? '')
      setSortOrder(nextExperience.groupItem?.sortOrder ?? 0)
      setRequiredPrevious(nextExperience.groupItem?.requiredPrevious ?? false)
      setVocabularyIds(nextExperience.sceneVocabularies.map((item) => item.vocabularyId))
      setChunkIds(nextExperience.sceneChunks.map((item) => item.chunkId))
      setPatternIds(nextExperience.scenePatterns.map((item) => item.patternId))
    } catch (error: any) {
      toast.error(error?.message || '内容能力配置加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [scene.id])

  const saveGroupSettings = async () => {
    setSaving(true)
    try {
      await contentExperienceAdminApi.assignGroup(scene.id, {
        groupId: groupId || null,
        sortOrder,
        volumeLabel,
        requiredPrevious,
      })
      toast.success('系列设置已保存')
      setSeriesDialog(false)
      await load()
    } catch (error: any) {
      toast.error(error?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const saveNovelKnowledge = async () => {
    setSaving(true)
    try {
      await contentExperienceAdminApi.updateKnowledge(scene.id, { vocabularyIds, chunkIds, patternIds })
      toast.success('小说知识已保存')
      await load()
    } catch (error: any) {
      toast.error(error?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const createGroup = async () => {
    if (!groupForm.name.trim() || !groupForm.slug.trim()) return
    try {
      const group = await contentExperienceAdminApi.createGroup({
        ...groupForm,
        contentMode: scene.contentMode,
        status: 'draft',
      })
      setGroups((current) => [group, ...current])
      setGroupId(group.id)
      setGroupDialog(false)
      setGroupForm({ name: '', slug: '', description: '' })
      toast.success('系列已创建，保存后加入当前学习包')
    } catch (error: any) {
      toast.error(error?.message || '系列创建失败')
    }
  }

  const resetSeriesDraft = () => {
    setGroupId(experience?.groupItem?.group.id ?? '')
    setVolumeLabel(experience?.groupItem?.volumeLabel ?? '')
    setSortOrder(experience?.groupItem?.sortOrder ?? 0)
    setRequiredPrevious(experience?.groupItem?.requiredPrevious ?? false)
  }

  const openSeriesSettings = () => {
    resetSeriesDraft()
    setSeriesDialog(true)
  }

  if (loading) return <Card><CardContent className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></CardContent></Card>

  const persistedGroup = experience?.groupItem

  return (
    <>
      <Card className="overflow-hidden border-border/70">
        <CardHeader className={cn('bg-gradient-to-r from-amber-500/[0.08] via-background to-background', scene.contentMode === 'novel' && 'border-b border-border/60')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><FolderKanban className="size-4 text-amber-600" />统一包配置</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {persistedGroup
                  ? `${persistedGroup.group.name}${persistedGroup.volumeLabel ? ` · ${persistedGroup.volumeLabel}` : ''} · 顺序 ${persistedGroup.sortOrder + 1}${persistedGroup.requiredPrevious ? ' · 需完成前一包' : ''}`
                  : `${modeName(scene.contentMode)}体验 · 暂未加入强关联系列`}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={openSeriesSettings}>
              <Settings2 className="mr-1.5 size-3.5" />系列设置
            </Button>
          </div>
        </CardHeader>
        {scene.contentMode === 'novel' && <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-semibold">整本小说知识</p><p className="text-xs text-muted-foreground">小说没有训练话题，因此在这里维护整书的单词、句块和句型。</p></div>
            <Button size="sm" onClick={saveNovelKnowledge} disabled={saving}>{saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}保存小说知识</Button>
          </div>
          <Tabs defaultValue="vocabulary">
            <TabsList>
              <TabsTrigger value="vocabulary">包级单词 <Badge variant="secondary" className="ml-1.5">{vocabularyIds.length}</Badge></TabsTrigger>
              <TabsTrigger value="chunks">句块 <Badge variant="secondary" className="ml-1.5">{chunkIds.length}</Badge></TabsTrigger>
              <TabsTrigger value="patterns">句型 <Badge variant="secondary" className="ml-1.5">{patternIds.length}</Badge></TabsTrigger>
            </TabsList>
            <TabsContent value="vocabulary"><KnowledgePicker items={vocabularies.map((item) => ({ id: item.id, label: item.word, description: item.meaning }))} selectedIds={vocabularyIds} onChange={setVocabularyIds} placeholder="搜索包级单词" /></TabsContent>
            <TabsContent value="chunks"><KnowledgePicker items={chunks.map((item) => ({ id: item.id, label: item.text, description: item.meaning }))} selectedIds={chunkIds} onChange={setChunkIds} placeholder="搜索包级句块" /></TabsContent>
            <TabsContent value="patterns"><KnowledgePicker items={patterns.map((item) => ({ id: item.id, label: item.pattern, description: item.meaning ?? '' }))} selectedIds={patternIds} onChange={setPatternIds} placeholder="搜索包级句型" /></TabsContent>
          </Tabs>
        </CardContent>}
      </Card>

      {scene.contentMode === 'novel' && (
        <Card className="overflow-hidden border-border/70">
          <CardHeader className="border-b border-border/60"><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="size-4" />EPUB 内容</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-5">
            <FileUploadField
              value={experience?.novelPackage?.epubUrl ?? ''}
              accept=".epub,application/epub+zip"
              uploadLabel="上传并分析 EPUB"
              group="epub"
              disabled={epubUploading}
              onUploaded={async (_url, assetId) => {
                setEpubUploading(true)
                try {
                  await contentExperienceAdminApi.attachEpub(scene.id, assetId)
                  toast.success('EPUB 已解析，可以预览目录和正文')
                  await load()
                } catch (error: any) {
                  toast.error(error?.message || 'EPUB 解析失败')
                } finally {
                  setEpubUploading(false)
                }
              }}
            />
            {experience?.novelPackage && (
              <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <div className="mb-3 flex items-center gap-2"><FileArchive className="size-4" /><span className="text-sm font-semibold">{experience.novelPackage.metadata?.title ?? 'EPUB 目录'}</span></div>
                  <div className="max-h-[520px] space-y-1 overflow-y-auto">
                    {(experience.novelPackage.toc ?? []).map((item, index) => <div key={`${item.href}-${index}`} className="rounded-md px-2 py-1.5 text-xs hover:bg-muted">{index + 1}. {item.label}</div>)}
                  </div>
                </div>
                <div className="h-[620px] overflow-hidden rounded-xl border border-border/70 bg-white text-black">
                  <ReactReader
                    url={experience.novelPackage.epubUrl}
                    location={readerLocation}
                    locationChanged={setReaderLocation}
                    title={experience.novelPackage.metadata?.title ?? scene.title}
                    showToc
                    epubInitOptions={{ openAs: 'epub' }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={seriesDialog} onOpenChange={(open) => { if (!open) resetSeriesDraft(); setSeriesDialog(open) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>强关联系列（Group）</DialogTitle><DialogDescription>设置当前学习包在系列中的位置和解锁关系。Group 不会替代分类或标签。</DialogDescription></DialogHeader>
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between"><Label>所属系列</Label><Button type="button" variant="ghost" size="sm" onClick={() => setGroupDialog(true)}><Plus className="mr-1 size-3.5" />新建系列</Button></div>
              <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                <option value="">不加入系列</option>
                {groups.filter((group) => !group.contentMode || group.contentMode === scene.contentMode).map((group) => (
                  <option key={group.id} value={group.id}>{group.name} · {group.items?.length ?? 0} 包</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>卷册名称</Label><Input value={volumeLabel} onChange={(event) => setVolumeLabel(event.target.value)} placeholder="第 2 册 / 进阶篇" disabled={!groupId} /></div>
              <div><Label>系列顺序</Label><Input type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} disabled={!groupId} /><p className="mt-1 text-xs text-muted-foreground">后台从 0 开始排序，Header 中按自然序号展示。</p></div>
            </div>
            <label className={cn('flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3', !groupId && 'opacity-50')}>
              <Switch checked={requiredPrevious} onCheckedChange={setRequiredPrevious} disabled={!groupId} />
              <span><span className="block text-sm font-medium">需要完成上一包</span><span className="block text-xs text-muted-foreground">关闭时仍按系列顺序展示，但不会锁定当前包。</span></span>
            </label>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { resetSeriesDraft(); setSeriesDialog(false) }}>取消</Button><Button onClick={saveGroupSettings} disabled={saving}>{saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}保存系列设置</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>新建内容系列</DialogTitle><DialogDescription>系列表示有顺序的强学习关联，不用于替代分类标签。</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>系列名称</Label><Input value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="商务听力进阶" /></div>
            <div><Label>唯一标识</Label><Input value={groupForm.slug} onChange={(event) => setGroupForm({ ...groupForm, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="business-listening" /></div>
            <div><Label>说明</Label><Textarea value={groupForm.description} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setGroupDialog(false)}>取消</Button><Button onClick={createGroup}><Link2 className="mr-1.5 size-3.5" />创建</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
