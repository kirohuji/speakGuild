import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectItem } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  createActivity,
  createCommitment,
  createQuest,
  deleteActivity,
  deleteCommitment,
  deleteQuest,
  listActivities,
  listCharacters,
  listCommitments,
  listQuests,
  listRooms,
  listStories,
  updateActivity,
  updateCommitment,
  updateQuest,
  type GameCharacter,
  type GameRoomData,
  type NqtrActivity,
  type NqtrCommitment,
  type NqtrQuest,
  type NqtrQuestStage,
  type StoryData,
} from '../api-content-admin'
import { ImageUploadField } from './image-upload-field'
import { formatNqtrTime, nqtrTimeToMinutes, type NqtrTimeSlot } from './maps/nqtr-model'

function slugKey(value: string, prefix: string) {
  const key = value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return key || `${prefix}_${Date.now().toString(36)}`
}

function clock(total: number) {
  const hour = Math.floor(total / 60)
  const minute = total % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function SlotFields({
  slots,
  startTime,
  endTime,
  onChange,
}: {
  slots: NqtrTimeSlot[]
  startTime: number | null
  endTime: number | null
  onChange: (start: number | null, end: number | null) => void
}) {
  const ordered = [...slots].sort((a, b) => a.startTime - b.startTime)
  const indexOf = (time: number | null) => {
    const index = ordered.findIndex((slot) => slot.startTime === time)
    return index < 0 ? '' : String(index)
  }
  const pick = (index: string) => index === '' ? null : ordered[Number(index)]?.startTime ?? null
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label>从哪个时段</Label>
        <Select value={indexOf(startTime)} onChange={(event) => onChange(pick(event.target.value), endTime)}>
          <SelectItem value="">不限</SelectItem>
          {ordered.map((slot, index) => <SelectItem key={`${slot.name}-${index}`} value={String(index)}>{slot.name} · {formatNqtrTime(slot.startTime)}</SelectItem>)}
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>到哪个时段</Label>
        <Select value={indexOf(endTime)} onChange={(event) => onChange(startTime, pick(event.target.value))}>
          <SelectItem value="">不限</SelectItem>
          {ordered.map((slot, index) => <SelectItem key={`${slot.name}-end-${index}`} value={String(index)}>{slot.name} · {formatNqtrTime(slot.startTime)}</SelectItem>)}
        </Select>
      </div>
    </div>
  )
}

function useNqtrOptions() {
  const [characters, setCharacters] = useState<GameCharacter[]>([])
  const [rooms, setRooms] = useState<GameRoomData[]>([])
  const [stories, setStories] = useState<StoryData[]>([])
  useEffect(() => {
    void Promise.all([
      listCharacters(),
      listRooms(),
      listStories({ scope: 'narrative', page: 1, pageSize: 100 }),
    ]).then(([nextCharacters, nextRooms, nextStories]) => {
      setCharacters(Array.isArray(nextCharacters) ? nextCharacters : nextCharacters.items)
      setRooms(nextRooms)
      setStories(nextStories.items)
    }).catch(() => toast.error('引用数据加载失败'))
  }, [])
  return { characters, rooms, stories }
}

function InkSelect({ value, stories, onChange }: { value: string; stories: StoryData[]; onChange: (id: string) => void }) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <SelectItem value="">不播放 Ink</SelectItem>
      {stories.map((story) => <SelectItem key={story.id} value={story.id}>{story.title}</SelectItem>)}
    </Select>
  )
}

export function NarrativeActivityList({ sceneId, mapId, timeSlots = [] }: { sceneId: string; mapId?: string | null; timeSlots?: NqtrTimeSlot[] }) {
  const { rooms, stories } = useNqtrOptions()
  const visibleRooms = mapId ? rooms.filter((room) => room.location?.map?.id === mapId) : rooms
  const [items, setItems] = useState<NqtrActivity[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<NqtrActivity | null>(null)
  const [quests, setQuests] = useState<NqtrQuest[]>([])
  const [form, setForm] = useState({ title: '', minutes: 1, timeFrom: null as number | null, timeTo: null as number | null, trigger: 'click', inkScriptId: '', iconUrl: '', availableFromDate: '' as number | '', availableUntilDate: '' as number | '', questId: '', questAction: '', roomIds: [] as string[] })

  const load = useCallback(async () => {
    const [nextItems, nextQuests] = await Promise.all([listActivities(sceneId), listQuests(sceneId)])
    setItems(nextItems)
    setQuests(nextQuests)
  }, [sceneId])
  useEffect(() => { void load().catch(() => toast.error('行为加载失败')) }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', minutes: 1, timeFrom: null, timeTo: null, trigger: 'click', inkScriptId: '', iconUrl: '', availableFromDate: '', availableUntilDate: '', questId: '', questAction: '', roomIds: [] })
    setOpen(true)
  }
  const openEdit = (item: NqtrActivity) => {
    setEditing(item)
    setForm({
      title: item.title,
      minutes: item.minutes,
      timeFrom: item.timeFrom ?? null,
      timeTo: item.timeTo ?? null,
      trigger: item.trigger,
      inkScriptId: item.inkScriptId ?? '',
      iconUrl: item.iconUrl ?? '',
      availableFromDate: item.availableFromDate ?? '',
      availableUntilDate: item.availableUntilDate ?? '',
      questId: item.questId ?? '',
      questAction: item.questAction ?? '',
      roomIds: item.roomLinks?.map((link) => link.roomId) ?? [],
    })
    setOpen(true)
  }
  const save = async () => {
    const payload = {
      ...form,
      sceneId,
      key: editing?.key ?? slugKey(form.title, 'activity'),
      inkScriptId: form.inkScriptId || null,
      iconUrl: form.iconUrl || null,
      questId: form.questId || null,
      questAction: form.questAction || null,
      availableFromDate: form.availableFromDate === '' ? null : Number(form.availableFromDate),
      availableUntilDate: form.availableUntilDate === '' ? null : Number(form.availableUntilDate),
      startMinute: form.timeFrom == null ? null : nqtrTimeToMinutes(form.timeFrom),
      endMinute: form.timeTo == null ? null : nqtrTimeToMinutes(form.timeTo),
    }
    if (editing) await updateActivity(editing.id, payload)
    else await createActivity(payload)
    setOpen(false)
    await load()
    toast.success('行为已保存')
  }

  return (
    <RegistryFrame title="玩家行为" hint="全局登记。同一行为可以挂到多间房，执行时才打开 Ink。" onCreate={openCreate}>
      <RegistryTable
        columns={['行为', '耗时', '时段', '触发', '房间']}
        empty="还没有行为"
        rows={items.map((item) => ({
          id: item.id,
          cells: [
            item.title,
            String(item.minutes),
            item.timeFrom != null ? `${formatNqtrTime(item.timeFrom)}–${formatNqtrTime(item.timeTo ?? item.timeFrom)}` : item.startMinute == null ? '全天' : `${clock(item.startMinute)}–${clock(item.endMinute ?? item.startMinute)}`,
            item.trigger === 'auto' ? '自动' : '点击',
            String(item.roomLinks?.length ?? 0),
          ],
          onEdit: () => openEdit(item),
          onDelete: async () => { await deleteActivity(item.id); await load() },
        }))}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? '编辑行为' : '新建行为'}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label>名称</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：看手机" /></div>
            <div className="flex flex-col gap-2"><Label>推进时间</Label><Input type="number" step="0.01" min={0} value={form.minutes} onChange={(event) => setForm({ ...form, minutes: Number(event.target.value) })} /><p className="text-xs text-muted-foreground">与时钟同一单位。1 表示推进 1，默认流逝也是这个单位。</p></div>
            {timeSlots.length ? <SlotFields slots={timeSlots} startTime={form.timeFrom} endTime={form.timeTo} onChange={(timeFrom, timeTo) => setForm({ ...form, timeFrom, timeTo })} /> : null}
            <div className="flex flex-col gap-2">
              <Label>怎么触发</Label>
              <Select value={form.trigger} onChange={(event) => setForm({ ...form, trigger: event.target.value })}>
                <SelectItem value="click">点击</SelectItem>
                <SelectItem value="auto">自动</SelectItem>
              </Select>
            </div>
            <div className="flex flex-col gap-2"><Label>打开的 Ink</Label><InkSelect value={form.inkScriptId} stories={stories} onChange={(inkScriptId) => setForm({ ...form, inkScriptId })} /></div>
            <div className="flex flex-col gap-2"><Label>图标</Label><ImageUploadField value={form.iconUrl} onChange={(iconUrl) => setForm({ ...form, iconUrl })} placeholder="上传行为图标" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2"><Label>从第几天出现</Label><Input type="number" min={1} value={form.availableFromDate} onChange={(event) => setForm({ ...form, availableFromDate: event.target.value === '' ? '' : Number(event.target.value) })} /></div>
              <div className="flex flex-col gap-2"><Label>到第几天消失</Label><Input type="number" min={1} value={form.availableUntilDate} onChange={(event) => setForm({ ...form, availableUntilDate: event.target.value === '' ? '' : Number(event.target.value) })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>关联任务</Label>
                <Select value={form.questId} onChange={(event) => setForm({ ...form, questId: event.target.value })}>
                  <SelectItem value="">不关联</SelectItem>
                  {quests.map((quest) => <SelectItem key={quest.id} value={quest.id}>{quest.title}</SelectItem>)}
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>执行后</Label>
                <Select value={form.questAction} onChange={(event) => setForm({ ...form, questAction: event.target.value })}>
                  <SelectItem value="">不推进任务</SelectItem>
                  <SelectItem value="start">领取任务</SelectItem>
                  <SelectItem value="continue">完成当前阶段</SelectItem>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>出现在这些房间</Label>
              <div className="flex max-h-40 flex-col gap-1 overflow-auto">
                {visibleRooms.map((room) => (
                  <label key={room.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.roomIds.includes(room.id)}
                      onChange={(event) => setForm({
                        ...form,
                        roomIds: event.target.checked ? [...form.roomIds, room.id] : form.roomIds.filter((id) => id !== room.id),
                      })}
                    />
                    <span className="truncate">{room.location?.displayName ? `${room.location.displayName} / ` : ''}{room.displayName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button disabled={!form.title.trim()} onClick={() => void save().catch(() => toast.error('行为保存失败'))}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RegistryFrame>
  )
}

export function NarrativeCommitmentList({ sceneId, mapId, timeSlots = [] }: { sceneId: string; mapId?: string | null; timeSlots?: NqtrTimeSlot[] }) {
  const { characters, rooms, stories } = useNqtrOptions()
  const visibleRooms = mapId ? rooms.filter((room) => room.location?.map?.id === mapId) : rooms
  const [items, setItems] = useState<NqtrCommitment[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<NqtrCommitment | null>(null)
  const [quests, setQuests] = useState<NqtrQuest[]>([])
  const [form, setForm] = useState({ characterId: '', roomId: '', timeFrom: null as number | null, timeTo: null as number | null, priority: 0, trigger: 'click', inkScriptId: '', imageUrl: '', slotImages: {} as Record<string, string>, questId: '', questAction: '' })

  const load = useCallback(async () => {
    const [nextItems, nextQuests] = await Promise.all([listCommitments(sceneId), listQuests(sceneId)])
    setItems(nextItems)
    setQuests(nextQuests)
  }, [sceneId])
  useEffect(() => { void load().catch(() => toast.error('日程加载失败')) }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ characterId: characters[0]?.id ?? '', roomId: visibleRooms[0]?.id ?? '', timeFrom: null, timeTo: null, priority: 0, trigger: 'click', inkScriptId: '', imageUrl: '', slotImages: {}, questId: '', questAction: '' })
    setOpen(true)
  }
  const openEdit = (item: NqtrCommitment) => {
    setEditing(item)
    setForm({
      characterId: item.characterId,
      roomId: item.roomId,
      timeFrom: item.timeFrom ?? null,
      timeTo: item.timeTo ?? null,
      priority: item.priority,
      trigger: item.trigger,
      inkScriptId: item.inkScriptId ?? '',
      imageUrl: item.imageUrl ?? '',
      slotImages: item.slotImages ?? {},
      questId: item.questId ?? '',
      questAction: item.questAction ?? '',
    })
    setOpen(true)
  }
  const save = async () => {
    const character = characters.find((item) => item.id === form.characterId)
    const payload = {
      ...form,
      sceneId,
      key: editing?.key ?? slugKey(`${character?.displayName ?? 'npc'}_${form.timeFrom ?? 0}`, 'commitment'),
      inkScriptId: form.inkScriptId || null,
      imageUrl: form.imageUrl || null,
      questId: form.questId || null,
      questAction: form.questAction || null,
      startMinute: form.timeFrom == null ? 0 : nqtrTimeToMinutes(form.timeFrom),
      endMinute: form.timeTo == null ? 0 : nqtrTimeToMinutes(form.timeTo),
    }
    if (editing) await updateCommitment(editing.id, payload)
    else await createCommitment(payload)
    setOpen(false)
    await load()
    toast.success('日程已保存')
  }

  return (
    <RegistryFrame title="角色日程" hint="一条日程只描述一个角色、一间房、一个时间段。同一时刻一个角色只应有一条生效。" onCreate={openCreate}>
      <RegistryTable
        columns={['角色', '房间', '时间', '优先级', '触发']}
        empty="还没有日程"
        rows={items.map((item) => ({
          id: item.id,
          cells: [
            item.character?.displayName ?? item.characterId,
            `${item.room?.location?.displayName ? `${item.room.location.displayName} / ` : ''}${item.room?.displayName ?? ''}`,
            item.timeFrom != null ? `${formatNqtrTime(item.timeFrom)}–${formatNqtrTime(item.timeTo ?? item.timeFrom)}` : `${clock(item.startMinute)}–${clock(item.endMinute)}`,
            String(item.priority),
            item.trigger === 'auto' ? '自动' : '点击',
          ],
          onEdit: () => openEdit(item),
          onDelete: async () => { await deleteCommitment(item.id); await load() },
        }))}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? '编辑日程' : '新建日程'}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>角色</Label>
              <Select value={form.characterId} onChange={(event) => setForm({ ...form, characterId: event.target.value })}>
                {characters.map((character) => <SelectItem key={character.id} value={character.id}>{character.displayName}</SelectItem>)}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>房间</Label>
              <Select value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}>
                {visibleRooms.map((room) => <SelectItem key={room.id} value={room.id}>{room.location?.displayName ? `${room.location.displayName} / ` : ''}{room.displayName}</SelectItem>)}
              </Select>
            </div>
            {timeSlots.length ? <SlotFields slots={timeSlots} startTime={form.timeFrom} endTime={form.timeTo} onChange={(timeFrom, timeTo) => setForm({ ...form, timeFrom, timeTo })} /> : null}
            <div className="flex flex-col gap-2"><Label>优先级</Label><Input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /></div>
            <div className="flex flex-col gap-2">
              <Label>怎么触发</Label>
              <Select value={form.trigger} onChange={(event) => setForm({ ...form, trigger: event.target.value })}>
                <SelectItem value="click">点击</SelectItem>
                <SelectItem value="auto">到点自动</SelectItem>
              </Select>
            </div>
            <div className="flex flex-col gap-2"><Label>打开的 Ink</Label><InkSelect value={form.inkScriptId} stories={stories} onChange={(inkScriptId) => setForm({ ...form, inkScriptId })} /></div>
            <div className="flex flex-col gap-2"><Label>默认立绘</Label><ImageUploadField value={form.imageUrl} onChange={(imageUrl) => setForm({ ...form, imageUrl })} placeholder="上传角色在这个日程的图" /></div>
            {timeSlots.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>各时段立绘</Label>
                {timeSlots.map((slot) => (
                  <div key={slot.name} className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">{slot.name}</span>
                    <ImageUploadField value={form.slotImages[slot.name] ?? ''} onChange={(url) => setForm({ ...form, slotImages: { ...form.slotImages, [slot.name]: url } })} placeholder={`${slot.name}的图片`} />
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>关联任务</Label>
                <Select value={form.questId} onChange={(event) => setForm({ ...form, questId: event.target.value })}>
                  <SelectItem value="">不关联</SelectItem>
                  {quests.map((quest) => <SelectItem key={quest.id} value={quest.id}>{quest.title}</SelectItem>)}
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>执行后</Label>
                <Select value={form.questAction} onChange={(event) => setForm({ ...form, questAction: event.target.value })}>
                  <SelectItem value="">不推进任务</SelectItem>
                  <SelectItem value="start">领取任务</SelectItem>
                  <SelectItem value="continue">完成当前阶段</SelectItem>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button disabled={!form.characterId || !form.roomId} onClick={() => void save().catch(() => toast.error('日程保存失败'))}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RegistryFrame>
  )
}

const emptyStage = (): NqtrQuestStage => ({
  stageKey: `stage_${Date.now().toString(36)}`,
  title: '',
  deltaDays: null,
  startNote: '',
  actions: [],
})

export function NarrativeQuestList({ sceneId, mapId }: { sceneId: string; mapId?: string | null }) {
  const { rooms } = useNqtrOptions()
  const visibleRooms = mapId ? rooms.filter((room) => room.location?.map?.id === mapId) : rooms
  const [items, setItems] = useState<NqtrQuest[]>([])
  const [activities, setActivities] = useState<NqtrActivity[]>([])
  const [commitments, setCommitments] = useState<NqtrCommitment[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<NqtrQuest | null>(null)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [stages, setStages] = useState<NqtrQuestStage[]>([])

  const load = useCallback(async () => {
    const [nextQuests, nextActivities, nextCommitments] = await Promise.all([listQuests(sceneId), listActivities(sceneId), listCommitments(sceneId)])
    setItems(nextQuests)
    setActivities(nextActivities)
    setCommitments(nextCommitments)
  }, [sceneId])
  useEffect(() => { void load().catch(() => toast.error('任务加载失败')) }, [load])

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setSummary('')
    setImageUrl('')
    setStages([emptyStage()])
    setOpen(true)
  }
  const openEdit = (quest: NqtrQuest) => {
    setEditing(quest)
    setTitle(quest.title)
    setSummary(quest.summary ?? '')
    setImageUrl(quest.imageUrl ?? '')
    setStages(quest.stages.length ? quest.stages : [emptyStage()])
    setOpen(true)
  }
  const save = async () => {
    const payload = {
      key: editing?.key ?? slugKey(title, 'quest'),
      title,
      summary,
      imageUrl: imageUrl || null,
      sceneId,
      stages: stages.map((stage, index) => ({ ...stage, sortOrder: index, stageKey: stage.stageKey || slugKey(stage.title, 'stage') })),
    }
    if (editing) await updateQuest(editing.id, payload)
    else await createQuest(payload)
    setOpen(false)
    await load()
    toast.success('任务已保存')
  }

  return (
    <RegistryFrame title="任务" hint="任务不挂在地图上。阶段开始时，把一个行为挂进房间，或启用一条已有日程。对白写在那个行为或日程的 Ink 里。" onCreate={openCreate}>
      <RegistryTable
        columns={['任务', '阶段']}
        empty="还没有任务"
        rows={items.map((item) => ({
          id: item.id,
          cells: [item.title, String(item.stages.length)],
          onEdit: () => openEdit(item),
          onDelete: async () => { await deleteQuest(item.id); await load() },
        }))}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? '编辑任务' : '新建任务'}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label>名称</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：小悠的邀约" /></div>
            <div className="flex flex-col gap-2"><Label>说明</Label><Textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></div>
            <div className="flex flex-col gap-2"><Label>封面</Label><ImageUploadField value={imageUrl} onChange={setImageUrl} placeholder="上传任务封面" /></div>
            {stages.map((stage, index) => (
              <div key={stage.stageKey} className="flex flex-col gap-3 bg-muted/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">阶段 {index + 1}</p>
                  <Button size="icon-xs" variant="ghost" aria-label="删除阶段" onClick={() => setStages(stages.filter((_, item) => item !== index))}><Trash2 /></Button>
                </div>
                <Input value={stage.title} placeholder="阶段名称" onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} />
                <div className="flex flex-col gap-2">
                  <Label>进入前要等的天数</Label>
                  <Input type="number" min={0} value={stage.deltaDays ?? ''} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, deltaDays: event.target.value === '' ? null : Number(event.target.value) } : item))} />
                </div>
                <Input value={stage.startNote ?? ''} placeholder="天数未到时的说明" onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, startNote: event.target.value } : item))} />
                {(stage.actions ?? []).map((action, actionIndex) => (
                  <div key={actionIndex} className="grid gap-2 sm:grid-cols-4">
                    <Select value={action.phase ?? 'on_start'} onChange={(event) => {
                      const phase = event.target.value === 'on_continue' ? 'on_continue' : 'on_start'
                      setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, actions: item.actions?.map((row, rowIndex) => rowIndex === actionIndex ? { ...row, phase } : row) } : item))
                    }}>
                      <SelectItem value="on_start">阶段开始</SelectItem>
                      <SelectItem value="on_continue">阶段完成后</SelectItem>
                    </Select>
                    <Select value={action.kind} onChange={(event) => {
                      const kind = event.target.value === 'add_commitment' ? 'add_commitment' : 'add_activity'
                      setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, actions: item.actions?.map((row, rowIndex) => rowIndex === actionIndex ? { ...row, kind } : row) } : item))
                    }}>
                      <SelectItem value="add_activity">挂上行为</SelectItem>
                      <SelectItem value="add_commitment">启用日程</SelectItem>
                    </Select>
                    {action.kind === 'add_activity' ? (
                      <Select value={action.activityId ?? ''} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, actions: item.actions?.map((row, rowIndex) => rowIndex === actionIndex ? { ...row, activityId: event.target.value } : row) } : item))}>
                        <SelectItem value="">选择行为</SelectItem>
                        {activities.map((activity) => <SelectItem key={activity.id} value={activity.id}>{activity.title}</SelectItem>)}
                      </Select>
                    ) : (
                      <Select value={action.commitmentId ?? ''} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, actions: item.actions?.map((row, rowIndex) => rowIndex === actionIndex ? { ...row, commitmentId: event.target.value } : row) } : item))}>
                        <SelectItem value="">选择日程</SelectItem>
                        {commitments.map((commitment) => <SelectItem key={commitment.id} value={commitment.id}>{commitment.character?.displayName ?? '角色'} {clock(commitment.startMinute)}</SelectItem>)}
                      </Select>
                    )}
                    {action.kind === 'add_activity' ? (
                      <Select value={action.roomId ?? ''} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, actions: item.actions?.map((row, rowIndex) => rowIndex === actionIndex ? { ...row, roomId: event.target.value } : row) } : item))}>
                        <SelectItem value="">挂到房间</SelectItem>
                        {visibleRooms.map((room) => <SelectItem key={room.id} value={room.id}>{room.displayName}</SelectItem>)}
                      </Select>
                    ) : <span />}
                  </div>
                ))}
                <Button variant="outline" onClick={() => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, actions: [...(item.actions ?? []), { kind: 'add_activity', phase: 'on_start', activityId: '', roomId: '' }] } : item))}>
                  <Plus data-icon="inline-start" />添加阶段动作
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={() => setStages([...stages, emptyStage()])}><Plus data-icon="inline-start" />添加阶段</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button disabled={!title.trim() || stages.some((stage) => !stage.title.trim())} onClick={() => void save().catch(() => toast.error('任务保存失败'))}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RegistryFrame>
  )
}

function RegistryFrame({ title, hint, onCreate, children }: { title: string; hint: string; onCreate: () => void; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Button onClick={onCreate}><Plus data-icon="inline-start" />新建</Button>
      </div>
      {children}
    </div>
  )
}

function RegistryTable({
  columns,
  rows,
  empty,
}: {
  columns: string[]
  empty: string
  rows: { id: string; cells: string[]; onEdit: () => void; onDelete: () => Promise<void> }[]
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
            <TableHead className="w-[140px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, index) => <TableCell key={index} className="max-w-[240px] truncate">{cell}</TableCell>)}
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={row.onEdit}><Pencil data-icon="inline-start" />编辑</Button>
                  <Button size="icon-xs" variant="ghost" aria-label="删除" onClick={() => void row.onDelete().catch(() => toast.error('删除失败'))}><Trash2 /></Button>
                </div>
              </TableCell>
            </TableRow>
          )) : (
            <TableRow><TableCell colSpan={columns.length + 1} className="py-12 text-center text-sm text-muted-foreground">{empty}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
