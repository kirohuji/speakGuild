import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, ChevronRight, FilePlus2, Loader2, Save, Search, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import {
  createStory,
  getScriptEpisode,
  getStory,
  listScriptEpisodes,
  updateScriptEpisode,
  updateStory,
  type GameCharacter,
  type GameLocationData,
  type StoryData,
  type StoryEpisode,
} from '../api-content-admin'
import { InkStoryEditor } from './ink-story-editor'

interface EpisodeStudioProps {
  packageId: string
  characters: GameCharacter[]
  locations: GameLocationData[]
  onOpenAdvanced: () => void
}

function scriptKey(episode: StoryEpisode) {
  const safe = `${episode.chapterId}.${episode.episodeOrder}.${episode.title}`
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
  return `story.${safe || episode.id}`
}

export function EpisodeStudio({ packageId, characters, locations, onOpenAdvanced }: EpisodeStudioProps) {
  const [episodes, setEpisodes] = useState<StoryEpisode[]>([])
  const [selected, setSelected] = useState<StoryEpisode | null>(null)
  const [story, setStory] = useState<StoryData | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingScript, setSavingScript] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [form, setForm] = useState<StoryEpisode | null>(null)

  const loadEpisodes = useCallback(async (sceneId: string) => {
    setLoading(true)
    try {
      const next = await listScriptEpisodes(sceneId)
      setEpisodes(next)
      setSelected(next[0] ? await getScriptEpisode(next[0].id) : null)
      setStory(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (packageId) void loadEpisodes(packageId)
  }, [loadEpisodes, packageId])

  useEffect(() => {
    if (!selected) return
    setForm(selected)
    if (!selected.inkScriptId) {
      setStory(null)
      return
    }
    getStory(selected.inkScriptId).then(setStory).catch(() => setStory(null))
  }, [selected])

  const groups = useMemo(() => {
    const result = new Map<string, StoryEpisode[]>()
    for (const episode of episodes.filter((item) =>
      !search || `${item.title} ${item.chapterTitle} ${item.npcName}`.toLowerCase().includes(search.toLowerCase()),
    )) {
      const items = result.get(episode.chapterId) ?? []
      items.push(episode)
      result.set(episode.chapterId, items)
    }
    return Array.from(result.entries())
  }, [episodes, search])

  const chooseEpisode = async (episode: StoryEpisode) => {
    try { setSelected(await getScriptEpisode(episode.id)) }
    catch { setSelected(episode) }
  }

  const saveScript = async (data: {
    key: string
    title: string
    inkSource: string
    inkJson: Record<string, unknown>
    locationId?: string
    characterId?: string
  }, options?: { silent?: boolean }) => {
    if (!selected) return
    setSavingScript(true)
    try {
      const payload = {
        ...data,
        scriptType: 'episode',
        episodeId: selected.id,
        version: (story?.version ?? 0) + 1,
        locationId: data.locationId ?? null,
        characterId: data.characterId ?? null,
      }
      const saved = story
        ? await updateStory(story.id, payload)
        : await createStory(payload)
      if (!story) {
        const updated = await updateScriptEpisode(selected.id, { inkScriptId: saved.id })
        setSelected({ ...selected, ...updated, inkScriptId: saved.id })
      }
      setStory(saved)
      if (!options?.silent) toast.success('剧情与剧集绑定已保存')
    } catch {
      if (!options?.silent) toast.error('剧情保存失败')
      throw new Error('剧情保存失败')
    } finally {
      setSavingScript(false)
    }
  }

  const saveMeta = async () => {
    if (!form) return
    setSavingMeta(true)
    try {
      await updateScriptEpisode(form.id, {
        title: form.title,
        chapterId: form.chapterId,
        chapterTitle: form.chapterTitle,
        episodeOrder: Number(form.episodeOrder),
        description: form.description,
        requiredOutputLevel: form.requiredOutputLevel,
        requiredUserLevel: Number(form.requiredUserLevel),
        objectives: form.objectives,
        passObjectiveCount: Number(form.passObjectiveCount),
        passChunkCount: Number(form.passChunkCount),
        passMinDialogues: Number(form.passMinDialogues),
        passRetellRequired: form.passRetellRequired,
        isPreview: form.isPreview,
      })
      const fresh = await getScriptEpisode(form.id)
      setSelected(fresh)
      setEpisodes((items) => items.map((item) => item.id === fresh.id ? fresh : item))
      toast.success('剧集配置已保存')
    } catch { toast.error('剧集配置保存失败') }
    finally { setSavingMeta(false) }
  }

  return (
    <div className="grid min-h-[720px] overflow-hidden rounded-xl border border-border/70 bg-background xl:grid-cols-[250px_minmax(0,1fr)_300px]">
      <aside className="border-b border-border/70 bg-muted/20 xl:border-b-0 xl:border-r">
        <div className="border-b border-border/70 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索剧集" className="h-9 pl-8 text-xs" />
          </div>
        </div>
        <div className="max-h-[650px] overflow-y-auto p-2">
          {loading ? <Loader2 className="mx-auto mt-8 size-5 animate-spin text-muted-foreground" /> : groups.map(([chapterId, items]) => (
            <section key={chapterId} className="mb-4">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {items[0]?.chapterTitle} <span className="opacity-50">· {items.length}</span>
              </div>
              {items.map((episode) => (
                <button key={episode.id} onClick={() => void chooseEpisode(episode)} className={cn(
                  'mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  selected?.id === episode.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-black/5 text-[10px] font-bold">{episode.episodeOrder}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{episode.title}</span>
                  {episode.inkScriptId ? <Check className="size-3.5 opacity-70" /> : <FilePlus2 className="size-3.5 opacity-45" />}
                </button>
              ))}
            </section>
          ))}
          <Button variant="outline" size="sm" className="mt-2 w-full gap-1.5" onClick={onOpenAdvanced}>
            <Settings2 className="size-3.5" />管理 / 新建剧集
          </Button>
        </div>
      </aside>

      <main className="min-w-0 p-4">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground"><BookOpen className="size-9 opacity-25" /><p className="mt-3 text-sm">先创建或选择一个剧集</p></div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="outline">{selected.chapterTitle}</Badge>
              <ChevronRight className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold">{selected.title}</span>
              {!story && <Badge variant="secondary" className="ml-auto">尚未创建 Ink</Badge>}
            </div>
            <InkStoryEditor
              storyId={story?.id}
              initialSource={story?.inkSource ?? undefined}
              initialKey={story?.key ?? scriptKey(selected)}
              initialTitle={story?.title ?? selected.title}
              locations={locations}
              characters={characters}
              onSave={saveScript}
              saving={savingScript}
            />
          </>
        )}
      </main>

      <aside className="border-t border-border/70 bg-muted/10 p-4 xl:border-l xl:border-t-0">
        {form && <div className="space-y-4">
          <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">剧集配置</p><p className="text-[11px] text-muted-foreground">与 Ink 同屏编辑</p></div><Button size="sm" className="gap-1" onClick={() => void saveMeta()} disabled={savingMeta}>{savingMeta ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}保存</Button></div>
          <div><Label className="text-xs">标题</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">章节 Key</Label><Input value={form.chapterId} onChange={(e) => setForm({ ...form, chapterId: e.target.value })} /></div><div><Label className="text-xs">集序</Label><Input type="number" value={form.episodeOrder} onChange={(e) => setForm({ ...form, episodeOrder: Number(e.target.value) })} /></div></div>
          <div><Label className="text-xs">章节名称</Label><Input value={form.chapterTitle} onChange={(e) => setForm({ ...form, chapterTitle: e.target.value })} /></div>
          <div><Label className="text-xs">剧情简介</Label><Textarea rows={3} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label className="text-xs">任务目标（一行一个）</Label><Textarea rows={5} value={form.objectives.join('\n')} onChange={(e) => setForm({ ...form, objectives: e.target.value.split('\n').filter(Boolean) })} /></div>
          <div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">输出等级</Label><Input value={form.requiredOutputLevel} onChange={(e) => setForm({ ...form, requiredOutputLevel: e.target.value })} /></div><div><Label className="text-xs">用户等级</Label><Input type="number" value={form.requiredUserLevel} onChange={(e) => setForm({ ...form, requiredUserLevel: Number(e.target.value) })} /></div></div>
          <div className="grid grid-cols-3 gap-2"><div><Label className="text-xs">目标数</Label><Input type="number" value={form.passObjectiveCount} onChange={(e) => setForm({ ...form, passObjectiveCount: Number(e.target.value) })} /></div><div><Label className="text-xs">句块数</Label><Input type="number" value={form.passChunkCount} onChange={(e) => setForm({ ...form, passChunkCount: Number(e.target.value) })} /></div><div><Label className="text-xs">轮次</Label><Input type="number" value={form.passMinDialogues} onChange={(e) => setForm({ ...form, passMinDialogues: Number(e.target.value) })} /></div></div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.isPreview} onChange={(e) => setForm({ ...form, isPreview: e.target.checked })} />允许免费预览</label>
        </div>}
      </aside>
    </div>
  )
}
