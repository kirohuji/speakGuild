import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Map as MapIcon, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { resolveFileAssetUrl } from '@/lib/file-asset-reference'
import {
  getStory,
  listActivities,
  listCommitments,
  listLocations,
  listQuests,
  listRooms,
  type GameCharacter,
  type GameLocationData,
  type GameMapData,
  type GameRoomData,
  type NqtrActivity,
  type NqtrCommitment,
  type NqtrQuest,
  type NqtrQuestStage,
} from '../api-content-admin'
import { VnStoryPreview } from './vn-story-preview'
import { formatNqtrTime, parseNqtrChrome, type NqtrChrome, type NqtrCommandKey, type NqtrTimeSettings, type QuestProgress } from './maps/nqtr-model'
import { getExplorationObjects, getRoomLayout } from './maps/exploration-map-model'

type Talk = {
  token: string
  roomId: string
  scriptId: string
  label: string
  spend: number
  questId: string | null
  questAction: 'start' | 'continue' | null
}

type Place =
  | { mode: 'map' }
  | { mode: 'location'; locationId: string }
  | { mode: 'room'; roomId: string }
  | { mode: 'talk'; roomId: string; talk: Talk }

type Session = {
  gameDay: number
  gameTime: number
  attached: { activityId: string; roomId: string }[]
  enabledCommitmentIds: string[]
  questProgress: QuestProgress
  applied: string[]
  log: string[]
}

type PreviewDebug = {
  isReady: boolean
  isWaiting: boolean
  isEnded: boolean
  currentTags: string[]
  history: { speaker: string; text: string }[]
  choices: { index: number; text: string }[]
  activeBackground?: { url?: string; fit?: string }
  aiPayload?: Record<string, unknown>
}

function freshSession(time: NqtrTimeSettings): Session {
  const first = [...time.timeSlots].sort((a, b) => a.startTime - b.startTime)[0]
  return {
    gameDay: 1,
    gameTime: first?.startTime ?? time.dayStartTime,
    attached: [],
    enabledCommitmentIds: [],
    questProgress: {},
    applied: [],
    log: ['试玩开始'],
  }
}

function minutesToNqtr(total: number) {
  const hour = Math.floor(total / 60)
  const minute = total % 60
  return hour + minute / 100
}

function windowOf(item: { timeFrom?: number | null; timeTo?: number | null; startMinute?: number | null; endMinute?: number | null }) {
  if (item.timeFrom != null || item.timeTo != null) return { from: item.timeFrom ?? null, to: item.timeTo ?? null }
  if (item.startMinute != null || item.endMinute != null) {
    return {
      from: item.startMinute == null ? null : minutesToNqtr(item.startMinute),
      to: item.endMinute == null ? null : minutesToNqtr(item.endMinute),
    }
  }
  return { from: null, to: null }
}

function timeContains(now: number, from: number | null, to: number | null) {
  if (from == null && to == null) return true
  if (from == null) return now < (to as number)
  if (to == null) return now >= from
  if (from <= to) return now >= from && now < to
  return now >= from || now < to
}

function slotName(time: NqtrTimeSettings, now: number) {
  const ordered = [...time.timeSlots].sort((a, b) => a.startTime - b.startTime)
  if (!ordered.length) return '全天'
  if (now < ordered[0].startTime) return ordered[ordered.length - 1].name
  return ordered.reduce((name, slot) => (slot.startTime <= now ? slot.name : name), ordered[0].name)
}

function dayLabel(time: NqtrTimeSettings, day: number) {
  if (!time.dayNames.length) return `第 ${day} 天`
  return time.dayNames[(day - 1) % time.dayNames.length]
}

function pushLog(session: Session, line: string): Session {
  return { ...session, log: [line, ...session.log].slice(0, 40) }
}

function stageReady(stage: NqtrQuestStage, startedOnDay: number, gameDay: number) {
  if (!stage.deltaDays) return true
  return gameDay >= startedOnDay + stage.deltaDays
}

function applyActions(session: Session, stage: NqtrQuestStage, phase: 'on_start' | 'on_continue') {
  let next = session
  for (const action of stage.actions ?? []) {
    if ((action.phase ?? 'on_start') !== phase) continue
    if (action.kind === 'add_activity' && action.activityId && action.roomId) {
      const exists = next.attached.some((item) => item.activityId === action.activityId && item.roomId === action.roomId)
      if (!exists) next = { ...next, attached: [...next.attached, { activityId: action.activityId, roomId: action.roomId }] }
      next = pushLog(next, `挂上行为到房间`)
    }
    if (action.kind === 'add_commitment' && action.commitmentId && !next.enabledCommitmentIds.includes(action.commitmentId)) {
      next = { ...next, enabledCommitmentIds: [...next.enabledCommitmentIds, action.commitmentId] }
      next = pushLog(next, `启用一条日程`)
    }
  }
  return next
}

function syncStages(session: Session, quests: NqtrQuest[]) {
  let next = session
  for (const quest of quests) {
    const progress = next.questProgress[quest.key]
    if (!progress || progress.status !== 'active') continue
    const stage = [...quest.stages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).find((item) => item.stageKey === progress.stageKey)
    if (!stage) continue
    const key = `${quest.key}:${stage.stageKey}:on_start`
    if (next.applied.includes(key)) continue
    if (!stageReady(stage, progress.startedOnDay ?? next.gameDay, next.gameDay)) continue
    next = applyActions(next, stage, 'on_start')
    next = { ...next, applied: [...next.applied, key] }
    next = pushLog(next, `${quest.title} 进入「${stage.title || stage.stageKey}」`)
  }
  return next
}

function applyQuest(session: Session, quests: NqtrQuest[], questId: string | null, questAction: 'start' | 'continue' | null) {
  if (!questId || !questAction) return session
  const quest = quests.find((item) => item.id === questId)
  if (!quest) return pushLog(session, '找不到关联任务')
  const stages = [...quest.stages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const progress = session.questProgress[quest.key]
  if (questAction === 'start') {
    if (progress) return pushLog(session, `${quest.title} 已经领过`)
    const first = stages[0]
    if (!first) return pushLog(session, `${quest.title} 没有阶段`)
    let next: Session = {
      ...session,
      questProgress: { ...session.questProgress, [quest.key]: { stageKey: first.stageKey, status: 'active', startedOnDay: session.gameDay } },
    }
    next = pushLog(next, `领取任务「${quest.title}」`)
    return syncStages(next, quests)
  }
  if (!progress || progress.status !== 'active') return pushLog(session, `${quest.title} 还没开始`)
  const index = stages.findIndex((item) => item.stageKey === progress.stageKey)
  const current = stages[index]
  if (!current) return session
  if (!stageReady(current, progress.startedOnDay ?? session.gameDay, session.gameDay)) {
    return pushLog(session, `${quest.title} 的「${current.title}」天数还没到`)
  }
  const continueKey = `${quest.key}:${current.stageKey}:on_continue`
  let next = session.applied.includes(continueKey) ? session : applyActions(session, current, 'on_continue')
  if (!next.applied.includes(continueKey)) next = { ...next, applied: [...next.applied, continueKey] }
  const following = stages[index + 1]
  if (!following) {
    next = {
      ...next,
      questProgress: { ...next.questProgress, [quest.key]: { ...progress, status: 'completed' } },
    }
    return pushLog(next, `完成任务「${quest.title}」`)
  }
  next = {
    ...next,
    questProgress: {
      ...next.questProgress,
      [quest.key]: { stageKey: following.stageKey, status: 'active', startedOnDay: next.gameDay },
    },
  }
  next = pushLog(next, `${quest.title} 进入下一阶段`)
  return syncStages(next, quests)
}

function addSpent(session: Session, spent: number, time: NqtrTimeSettings) {
  if (!spent) return session
  let gameTime = session.gameTime + spent
  let gameDay = session.gameDay
  const span = Math.max(0.01, time.dayEndTime - time.dayStartTime)
  while (gameTime >= time.dayEndTime) {
    gameTime = time.dayStartTime + (gameTime - time.dayEndTime)
    gameDay += 1
    if (gameTime - time.dayStartTime > span) break
  }
  return pushLog({ ...session, gameDay, gameTime: Math.round(gameTime * 100) / 100 }, `时间推进 ${spent}`)
}

function characterImage(character: GameCharacter | undefined, commitment: NqtrCommitment | undefined, slot: string) {
  const slotted = commitment?.slotImages?.[slot]
  const raw = slotted || commitment?.imageUrl || characterSprite(character)
  return raw ? resolveFileAssetUrl(raw) : ''
}

function characterSprite(character?: GameCharacter) {
  const expressions = Array.isArray(character?.expressions) ? character.expressions : []
  const sprite = expressions.find((item: { spriteUrl?: string }) => item?.spriteUrl)?.spriteUrl
  return sprite || character?.spriteBaseUrl || character?.avatarUrl || ''
}

export function NqtrPackagePreview({
  sceneId,
  map,
  time,
  chrome,
  characters,
}: {
  sceneId: string
  map: GameMapData | null
  time: NqtrTimeSettings
  chrome: NqtrChrome
  characters: GameCharacter[]
}) {
  const look = parseNqtrChrome(chrome)
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<GameLocationData[]>([])
  const [rooms, setRooms] = useState<GameRoomData[]>([])
  const [activities, setActivities] = useState<NqtrActivity[]>([])
  const [commitments, setCommitments] = useState<NqtrCommitment[]>([])
  const [quests, setQuests] = useState<NqtrQuest[]>([])
  const [session, setSession] = useState<Session>(() => freshSession(time))
  const [place, setPlace] = useState<Place>({ mode: 'map' })
  const [inkJson, setInkJson] = useState<Record<string, any> | null>(null)
  const [inkSource, setInkSource] = useState('')
  const [debug, setDebug] = useState<PreviewDebug | null>(null)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [hotspotsOpen, setHotspotsOpen] = useState(false)
  const questsRef = useRef(quests)
  const closedTalk = useRef<string | null>(null)
  const autoFired = useRef(new Set<string>())
  questsRef.current = quests
  const handleDebug = useCallback((state: PreviewDebug) => {
    setDebug((prev) => {
      if (
        prev
        && prev.isReady === state.isReady
        && prev.isWaiting === state.isWaiting
        && prev.isEnded === state.isEnded
        && prev.history === state.history
        && prev.currentTags === state.currentTags
        && prev.choices === state.choices
        && prev.activeBackground === state.activeBackground
        && prev.aiPayload === state.aiPayload
      ) return prev
      return {
        isReady: state.isReady,
        isWaiting: state.isWaiting,
        isEnded: state.isEnded,
        currentTags: state.currentTags,
        history: state.history,
        choices: state.choices,
        activeBackground: state.activeBackground,
        aiPayload: state.aiPayload,
      }
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextLocations, nextRooms, nextActivities, nextCommitments, nextQuests] = await Promise.all([
        map ? listLocations(map.id) : Promise.resolve([]),
        listRooms(),
        listActivities(sceneId),
        listCommitments(sceneId),
        listQuests(sceneId),
      ])
      const locationIds = new Set(nextLocations.map((item) => item.id))
      setLocations(nextLocations.filter((item) => !item.hidden && !item.disabled))
      setRooms(nextRooms.filter((item) => locationIds.has(item.locationId) && !item.hidden && !item.disabled))
      setActivities(nextActivities)
      setCommitments(nextCommitments)
      setQuests(nextQuests)
    } catch {
      toast.error('总预览加载失败')
    } finally {
      setLoading(false)
    }
  }, [map, sceneId])

  useEffect(() => { void load() }, [load])

  const reset = useCallback((nextRooms: GameRoomData[]) => {
    const entrance = nextRooms.find((item) => item.isEntrance) ?? nextRooms[0]
    autoFired.current = new Set()
    closedTalk.current = null
    setSession(freshSession(time))
    setInkJson(null)
    setInkSource('')
    setDebug(null)
    setPlace(entrance ? { mode: 'room', roomId: entrance.id } : { mode: 'map' })
  }, [time])

  useEffect(() => { if (!loading) reset(rooms) }, [loading, rooms, reset])

  const roomOf = useCallback((roomId: string) => rooms.find((item) => item.id === roomId), [rooms])
  const locationOf = useCallback((locationId: string) => locations.find((item) => item.id === locationId), [locations])
  const currentRoom = place.mode === 'room' || place.mode === 'talk' ? roomOf(place.roomId) : undefined
  const currentLocation = place.mode === 'location'
    ? locationOf(place.locationId)
    : currentRoom ? locationOf(currentRoom.locationId) : undefined
  const slot = slotName(time, session.gameTime)
  const activeHotspots = useMemo(() => {
    if (!map) return []
    if ((place.mode === 'room' || place.mode === 'talk') && currentRoom) {
      return getExplorationObjects(map, `room:${currentRoom.id}`)
        .filter((item) => !item.hidden)
        .map((item) => ({
          id: item.id,
          title: item.title,
          imageUrl: item.imageUrl,
          x: item.x,
          y: item.y,
          roomId: item.interactionType === 'exit' ? item.targetRoomId : undefined,
        }))
    }
    if (place.mode !== 'location' || !currentLocation) return []
    const roomPins = rooms
      .filter((room) => room.locationId === currentLocation.id)
      .map((room, index) => {
        const layout = getRoomLayout(map, currentLocation.id, room.id, index)
        return { id: room.id, title: room.displayName, imageUrl: room.icon, x: layout.x, y: layout.y, roomId: room.id }
      })
    const interactions = getExplorationObjects(map, `location:${currentLocation.id}`)
      .filter((item) => !item.hidden)
      .map((item) => ({
        id: item.id,
        title: item.title,
        imageUrl: item.imageUrl,
        x: item.x,
        y: item.y,
        roomId: item.targetRoomId,
      }))
    return [...roomPins, ...interactions]
  }, [currentLocation, currentRoom, map, place.mode, rooms])

  const gatedCommitments = useMemo(() => new Set(
    quests.flatMap((quest) => quest.stages.flatMap((stage) => (stage.actions ?? [])
      .filter((action) => action.kind === 'add_commitment' && action.commitmentId)
      .map((action) => action.commitmentId as string))),
  ), [quests])

  const visibleActivities = useMemo(() => {
    if (!currentRoom) return []
    return activities.filter((activity) => {
      const linked = activity.roomLinks?.some((link) => link.roomId === currentRoom.id)
        || session.attached.some((item) => item.activityId === activity.id && item.roomId === currentRoom.id)
      if (!linked) return false
      const span = windowOf(activity)
      if (!timeContains(session.gameTime, span.from, span.to)) return false
      if (activity.availableFromDate && session.gameDay < activity.availableFromDate) return false
      if (activity.availableUntilDate && session.gameDay > activity.availableUntilDate) return false
      return true
    })
  }, [activities, currentRoom, session.attached, session.gameDay, session.gameTime])

  const visibleCommitments = useMemo(() => {
    if (!currentRoom) return []
    const matched = commitments.filter((item) => {
      if (item.roomId !== currentRoom.id) return false
      if (gatedCommitments.has(item.id) && !session.enabledCommitmentIds.includes(item.id)) return false
      const span = windowOf(item)
      return timeContains(session.gameTime, span.from, span.to)
    })
    const byCharacter = new Map<string, NqtrCommitment>()
    for (const item of matched.sort((a, b) => b.priority - a.priority)) {
      if (!byCharacter.has(item.characterId)) byCharacter.set(item.characterId, item)
    }
    return [...byCharacter.values()]
  }, [commitments, currentRoom, gatedCommitments, session.enabledCommitmentIds, session.gameTime])

  const finishTalk = useCallback((talk: Talk) => {
    setSession((prev) => {
      let next = applyQuest(prev, questsRef.current, talk.questId, talk.questAction)
      next = addSpent(next, talk.spend, time)
      return syncStages(next, questsRef.current)
    })
    setInkJson(null)
    setInkSource('')
    setPlace({ mode: 'room', roomId: talk.roomId })
  }, [time])

  const openTalk = useCallback(async (talk: Omit<Talk, 'token'>) => {
    const token = `${Date.now().toString(36)}`
    const nextTalk = { ...talk, token }
    closedTalk.current = null
    setDebug(null)
    if (!talk.scriptId) {
      closedTalk.current = token
      finishTalk(nextTalk)
      toast.message('这条没有对白，只推进了任务和时间')
      return
    }
    setPlace({ mode: 'talk', roomId: talk.roomId, talk: nextTalk })
    setInkJson(null)
    setInkSource('')
    try {
      const story = await getStory(talk.scriptId)
      setInkJson(story.inkJson ?? null)
      setInkSource(story.inkJson ? '' : story.inkSource ?? '')
      if (!story.inkJson && !story.inkSource) toast.error('这段 Ink 是空的')
    } catch {
      toast.error('对白加载失败')
      setPlace({ mode: 'room', roomId: talk.roomId })
    }
  }, [finishTalk])

  useEffect(() => {
    if (place.mode !== 'room') return
    const autoActivity = visibleActivities.find((item) => item.trigger === 'auto')
    const autoCommitment = visibleCommitments.find((item) => item.trigger === 'auto')
    const key = autoActivity
      ? `activity:${autoActivity.id}:${session.gameDay}:${slot}`
      : autoCommitment
        ? `commitment:${autoCommitment.id}:${session.gameDay}:${slot}`
        : ''
    if (!key || autoFired.current.has(key)) return
    autoFired.current.add(key)
    if (autoActivity) {
      void openTalk({
        roomId: place.roomId,
        scriptId: autoActivity.inkScriptId ?? '',
        label: autoActivity.title,
        spend: autoActivity.minutes || time.defaultTimeSpent,
        questId: autoActivity.questId ?? null,
        questAction: autoActivity.questAction ?? null,
      })
      return
    }
    if (!autoCommitment) return
    const character = characters.find((item) => item.id === autoCommitment.characterId)
    void openTalk({
      roomId: place.roomId,
      scriptId: autoCommitment.inkScriptId ?? '',
      label: character?.displayName ?? '角色',
      spend: time.defaultTimeSpent,
      questId: autoCommitment.questId ?? null,
      questAction: autoCommitment.questAction ?? null,
    })
  }, [characters, openTalk, place, session.gameDay, slot, time.defaultTimeSpent, visibleActivities, visibleCommitments])

  const jumpSlot = () => {
    const ordered = [...time.timeSlots].sort((a, b) => a.startTime - b.startTime)
    const nextSlot = ordered.find((item) => item.startTime > session.gameTime + 0.001)
    setSession((prev) => syncStages({
      ...prev,
      gameTime: nextSlot?.startTime ?? ordered[0]?.startTime ?? prev.gameTime,
      gameDay: nextSlot ? prev.gameDay : prev.gameDay + 1,
    }, questsRef.current))
  }

  const jumpDay = () => {
    setSession((prev) => syncStages({
      ...prev,
      gameDay: prev.gameDay + 1,
      gameTime: time.dayStartTime,
    }, questsRef.current))
  }

  const showHotspots = hotspotsOpen && place.mode !== 'map' && Boolean(place.mode === 'location' ? currentLocation : currentRoom)
  const background = place.mode === 'map'
    ? map?.backgroundUrl
    : place.mode === 'location'
      ? currentLocation?.backgroundUrl || map?.backgroundUrl
      : currentRoom?.backgroundUrl || currentLocation?.backgroundUrl || map?.backgroundUrl
  const backgroundUrl = background ? resolveFileAssetUrl(background) : ''

  const activeQuests = quests.filter((quest) => session.questProgress[quest.key])

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <div className="mx-auto flex w-full max-w-[420px] flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{map?.displayName || '未绑定地图'}</Badge>
          <Badge variant="secondary">{dayLabel(time, session.gameDay)} · {slot} · {formatNqtrTime(session.gameTime)}</Badge>
          <div className="flex w-full flex-wrap gap-1">
            {place.mode !== 'map' && <Button size="sm" variant="outline" onClick={() => { setHotspotsOpen(false); setPlace({ mode: 'map' }) }}>地图</Button>}
            {place.mode !== 'map' && <Button size="sm" variant="outline" onClick={() => setHotspotsOpen((open) => !open)}>热点</Button>}
            {place.mode === 'talk' && <Button size="sm" variant="outline" onClick={() => { if (debug?.isEnded) finishTalk(place.talk); else { closedTalk.current = place.talk.token; setPlace({ mode: 'room', roomId: place.roomId }) } }}>{debug?.isEnded ? '关闭对白' : '返回房间'}</Button>}
            {place.mode === 'location' && <Button size="sm" variant="outline" onClick={() => setPlace({ mode: 'map' })}>返回</Button>}
            <Button size="sm" variant="outline" onClick={jumpSlot}>下一时段</Button>
            <Button size="sm" variant="outline" onClick={jumpDay}>下一天</Button>
            <Button size="sm" variant="outline" onClick={() => reset(rooms)}>重置</Button>
          </div>
        </div>
        <div className="relative mx-auto h-[78vh] max-h-[760px] w-full max-w-[420px] overflow-hidden rounded-lg border border-border bg-slate-950">
          {backgroundUrl ? (
            <img src={backgroundUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,#1c2836,#0d141c)]" />
          )}
          {place.mode !== 'map' && (
            <div className="absolute right-3 top-3 z-30 flex items-start gap-2">
              <CommandIcon
                chrome={look}
                command="place"
                label="热点"
                onClick={() => setHotspotsOpen((open) => !open)}
              />
              <CommandIcon
                chrome={look}
                command="map"
                label="地图"
                onClick={() => { setHotspotsOpen(false); setPlace({ mode: 'map' }) }}
              />
            </div>
          )}

          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-white"><Loader2 className="size-6 animate-spin" /></div>
          ) : place.mode === 'talk' && (inkJson || inkSource) ? (
            <div className="absolute inset-0 z-10">
              <VnStoryPreview
                key={place.talk.token}
                inkJson={inkJson ?? undefined}
                inkSource={inkSource || undefined}
                characters={characters}
                defaultBackgroundUrl={backgroundUrl || undefined}
                previewLayout="portrait"
                aiEvaluationEnabled={aiEnabled}
                holdLastLine
                onDismiss={() => finishTalk(place.talk)}
                className="h-full max-h-full w-full max-w-none"
                onDebugChange={handleDebug}
              />
            </div>
          ) : place.mode === 'map' ? (
            <div className="absolute inset-0 z-10">
              {locations.map((location) => {
                const icon = location.icon ? resolveFileAssetUrl(location.icon) : ''
                return (
                  <button
                    key={location.id}
                    type="button"
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center bg-transparent"
                    style={{ left: `${location.posX}%`, top: `${location.posY}%` }}
                    onClick={() => setPlace({ mode: 'location', locationId: location.id })}
                  >
                    {icon ? <img src={icon} alt="" className="object-contain" style={{ width: look.locationIconSize, height: look.locationIconSize }} /> : null}
                    <span
                      className="text-sm font-semibold leading-none"
                      style={{ color: '#111', WebkitTextStroke: '4px #fff', paintOrder: 'stroke fill' }}
                    >
                      {location.displayName}
                    </span>
                  </button>
                )
              })}
              {!map && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-white/80">先在设定里绑定一张地图</p>}
              {map && !locations.length && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-white/80">这张地图还没有地点</p>}
            </div>
          ) : place.mode === 'room' && currentRoom ? (
            <>
              <div className="absolute inset-x-0 bottom-24 z-10 flex items-end justify-center gap-6 px-4">
                {visibleCommitments.map((item) => {
                  const character = characters.find((entry) => entry.id === item.characterId)
                  const image = characterImage(character, item, slot)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="group flex max-w-40 flex-col items-center"
                      onClick={() => void openTalk({
                        roomId: currentRoom.id,
                        scriptId: item.inkScriptId ?? '',
                        label: character?.displayName ?? '角色',
                        spend: time.defaultTimeSpent,
                        questId: item.questId ?? null,
                        questAction: item.questAction ?? null,
                      })}
                    >
                      {image ? <img src={image} alt="" className="max-h-[42vh] object-contain drop-shadow-xl transition-transform group-hover:-translate-y-1" /> : <span className="flex size-24 items-center justify-center rounded-full bg-white/90 text-lg font-semibold">{(character?.displayName || '?').slice(0, 1)}</span>}
                      <span className="mt-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">{character?.displayName ?? '角色'}{item.trigger === 'auto' ? ' · 自动' : ''}</span>
                    </button>
                  )
                })}
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 flex gap-3 overflow-x-auto p-4">
                {visibleActivities.map((activity) => {
                  const icon = activity.iconUrl ? resolveFileAssetUrl(activity.iconUrl) : look.activityIcon ? resolveFileAssetUrl(look.activityIcon) : ''
                  return (
                    <button
                      key={activity.id}
                      type="button"
                      aria-label={activity.title}
                      className="shrink-0 bg-transparent transition-transform hover:-translate-y-0.5"
                      onClick={() => void openTalk({
                        roomId: currentRoom.id,
                        scriptId: activity.inkScriptId ?? '',
                        label: activity.title,
                        spend: activity.minutes || time.defaultTimeSpent,
                        questId: activity.questId ?? null,
                        questAction: activity.questAction ?? null,
                      })}
                    >
                      {icon ? <img src={icon} alt="" className="object-contain" style={{ width: look.activityIconSize, height: look.activityIconSize }} /> : <span style={{ width: look.activityIconSize, height: look.activityIconSize }} />}
                    </button>
                  )
                })}
              </div>
              <p className="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2 py-1 text-xs text-white">{currentLocation?.displayName} / {currentRoom.displayName}</p>
            </>
          ) : null}
          {showHotspots && (
            <div className="absolute inset-0 z-20">
              {activeHotspots.map((item) => {
                const icon = item.imageUrl ? resolveFileAssetUrl(item.imageUrl) : look.hotspotIcon ? resolveFileAssetUrl(look.hotspotIcon) : ''
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center bg-transparent"
                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                    onClick={() => {
                      if (!item.roomId) return
                      setHotspotsOpen(false)
                      setPlace({ mode: 'room', roomId: item.roomId })
                    }}
                  >
                    {icon ? <img src={icon} alt="" className="object-contain" style={{ width: look.locationIconSize, height: look.locationIconSize }} /> : null}
                    <span className="text-sm font-semibold leading-none" style={{ color: '#111', WebkitTextStroke: '4px #fff', paintOrder: 'stroke fill' }}>{item.title}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="min-w-0 rounded-lg border border-border bg-background">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">实时状态与评估数据</p>
            <p className="mt-1 text-xs text-muted-foreground">对白和章节预览是同一套。这里多看房间、时间和任务有没有接上。</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs">
            <span className="text-muted-foreground">AI 实时评估</span>
            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </label>
        </div>
        <div className="grid grid-cols-4 gap-px border-b border-border bg-border">
          <Metric label="地点" value={currentRoom?.displayName || currentLocation?.displayName || '地图'} />
          <Metric label="时间" value={`${session.gameDay}天 ${formatNqtrTime(session.gameTime)}`} />
          <Metric label="任务" value={String(activeQuests.length)} />
          <Metric label="对白" value={place.mode === 'talk' ? (debug?.isEnded ? '结束' : debug?.isWaiting ? '等待输入' : '播放中') : '未打开'} />
        </div>
        <Tabs defaultValue="world">
          <TabsList className="mx-3 mt-3 grid h-8 grid-cols-4 p-0.5">
            <TabsTrigger value="world" className="px-2 py-1 text-xs">世界</TabsTrigger>
            <TabsTrigger value="dialogue" className="px-2 py-1 text-xs">对话记录</TabsTrigger>
            <TabsTrigger value="log" className="px-2 py-1 text-xs">推进记录</TabsTrigger>
            <TabsTrigger value="debug" className="px-2 py-1 text-xs">调试数据</TabsTrigger>
          </TabsList>
          <ScrollArea className="h-[calc(78vh-150px)] max-h-[610px]">
            <TabsContent value="world" className="mt-0 space-y-2 p-3">
              <section className="rounded-md border border-border bg-card px-3 py-2">
                <p className="text-[11px] font-semibold text-muted-foreground">此刻房间里</p>
                <div className="mt-1 space-y-1">
                  {visibleActivities.map((item) => <p key={item.id} className="text-sm leading-5">{item.title}{item.questAction === 'start' ? ' · 领取任务' : item.questAction === 'continue' ? ' · 完成阶段' : ''}</p>)}
                  {visibleCommitments.map((item) => <p key={item.id} className="text-sm leading-5">{characters.find((entry) => entry.id === item.characterId)?.displayName ?? '角色'}</p>)}
                  {!visibleActivities.length && !visibleCommitments.length && <p className="text-xs text-muted-foreground">没有可交互的内容。</p>}
                </div>
              </section>
              <section className="space-y-2">
                <p className="px-1 text-[11px] font-semibold text-muted-foreground">任务</p>
                {activeQuests.length ? activeQuests.map((quest) => {
                  const progress = session.questProgress[quest.key]
                  const stage = quest.stages.find((item) => item.stageKey === progress?.stageKey)
                  return (
                    <div key={quest.id} className="rounded-md border border-border bg-card px-3 py-2">
                      <p className="text-sm font-medium">{quest.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{stage?.title || progress?.stageKey} · {progress?.status === 'completed' ? '已完成' : '进行中'}</p>
                    </div>
                  )
                }) : <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">还没有领到任务。</p>}
              </section>
            </TabsContent>
            <TabsContent value="dialogue" className="mt-0 space-y-2 p-3">
              {debug?.history.length ? debug.history.map((line, index) => (
                <div key={`${line.speaker}-${index}`} className="rounded-md border border-border bg-card px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">{index + 1}. {line.speaker || '旁白'}</p>
                  <p className="mt-0.5 text-sm leading-5">{line.text}</p>
                </div>
              )) : <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">点房间里的角色或行为后，这里显示台词。</p>}
            </TabsContent>
            <TabsContent value="log" className="mt-0 space-y-2 p-3">
              {session.log.map((line, index) => (
                <div key={`${line}-${index}`} className="rounded-md border border-border bg-card px-3 py-2 text-sm leading-5">{line}</div>
              ))}
            </TabsContent>
            <TabsContent value="debug" className="mt-0 space-y-2 p-3">
              <details open className="rounded-md border border-border bg-card">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">当前 Tags</summary>
                <div className="flex min-h-8 flex-wrap gap-1 border-t border-border p-2">
                  {debug?.currentTags.length ? debug.currentTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">#{tag}</Badge>
                  )) : <span className="text-xs text-muted-foreground">暂无 tags</span>}
                </div>
              </details>
              <details className="rounded-md border border-border bg-card">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">背景</summary>
                <div className="border-t border-border p-2 text-xs">
                  <p>fit: <span className="font-mono">{debug?.activeBackground?.fit ?? '-'}</span></p>
                  <p className="mt-1 break-all">url: <span className="font-mono">{debug?.activeBackground?.url ?? '-'}</span></p>
                </div>
              </details>
              <details className="rounded-md border border-border bg-card">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">AI 评估 Payload</summary>
                <pre className="max-h-[420px] overflow-auto border-t border-border bg-muted/30 p-2 text-[11px] leading-relaxed">
                  {JSON.stringify(debug?.aiPayload ?? {}, null, 2)}
                </pre>
              </details>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </aside>
    </div>
  )
}

function CommandIcon({
  chrome,
  command,
  label,
  onClick,
  className,
}: {
  chrome: NqtrChrome
  command: NqtrCommandKey
  label: string
  onClick: () => void
  className?: string
}) {
  const style = chrome.commands[command]
  const icon = style.icon ? resolveFileAssetUrl(style.icon) : ''
  const Fallback = COMMAND_FALLBACK[command]
  return (
    <button type="button" aria-label={label} title={label} className={`bg-transparent ${className ?? ''}`} onClick={onClick}>
      {icon
        ? <img src={icon} alt="" style={{ width: style.size, height: style.size }} className="object-contain" />
        : <Fallback className="text-white drop-shadow" style={{ width: style.size, height: style.size }} />}
    </button>
  )
}

const COMMAND_FALLBACK = {
  map: MapIcon,
  place: MapPin,
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  )
}
