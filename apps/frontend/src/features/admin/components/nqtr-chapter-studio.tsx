import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronsUpDown, MapPin, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import {
  createNqtrChapter,
  deleteNqtrChapter,
  listNqtrChapters,
  updateNqtrChapter,
  type GameCharacter,
  type GameLocationData,
  type NqtrChapter,
} from '../api-content-admin'

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
  const [characterIds, setCharacterIds] = useState<string[]>([])
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const current = chapters.find((item) => item.id === chapterId) ?? chapters[0]
  const chapterRef = useRef(chapterId)
  chapterRef.current = chapterId

  const fill = (chapter: NqtrChapter) => {
    setTitle(chapter.title)
    setSummary(chapter.summary ?? '')
    setCharacterIds(chapter.characters.map((item) => item.characterId))
    setLocationIds(chapter.locations.map((item) => item.locationId))
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

  const save = async () => {
    if (!current) return
    setSaving(true)
    try {
      const updated = await updateNqtrChapter(current.id, { title, summary, characterIds, locationIds })
      const next = chapters.map((item) => item.id === updated.id ? updated : item)
      setChapters(next)
      onChapters(next)
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
            <CardDescription>地图和素材仍属于整本剧情包。这里只决定这一章用谁、开放哪里。</CardDescription>
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
