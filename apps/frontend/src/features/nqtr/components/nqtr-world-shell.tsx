import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Loader2, MessageCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { resolveFileAssetUrl } from '@/lib/file-asset-reference'
import { getExplorationObjects, getRoomLayout } from '../model/exploration-read'
import { formatNqtrTime, parseNqtrChrome, type NqtrChrome, type NqtrTimeSettings } from '../model/nqtr-time-chrome'
import {
  addSpent,
  applyQuest,
  dayLabel,
  freshSession,
  sessionFromSave,
  slotName,
  syncStages,
  timeContains,
  windowOf,
} from '../model/nqtr-session'
import {
  chapterQuestsCompleted,
  markChapterPassedInFlags,
} from '../lib/nqtr-chapter-progress'
import type {
  NqtrActivity,
  NqtrCharacter,
  NqtrCommitment,
  NqtrDialogueDebug,
  NqtrDialogueRenderProps,
  NqtrLocation,
  NqtrMap,
  NqtrPlace,
  NqtrQuest,
  NqtrRoom,
  NqtrSave,
  NqtrSaveWrite,
  NqtrSession,
  NqtrStoryPayload,
  NqtrTalk,
} from '../model/types'
import { NqtrCommandIcon } from './nqtr-command-icon'
import { NqtrPinLabel } from './nqtr-pin-label'
import { NqtrStatusBadge } from './nqtr-status-badge'

export type NqtrWorldShellRuntime = {
  session: NqtrSession
  place: NqtrPlace
  slot: string
  visibleActivities: NqtrActivity[]
  visibleCommitments: NqtrCommitment[]
  currentRoom?: NqtrRoom
  currentLocation?: NqtrLocation
  debug: NqtrDialogueDebug | null
  metCommitmentKeys: string[]
}

export type NqtrWorldShellProps = {
  sceneId: string
  chapterId?: string
  map: NqtrMap | null
  time: NqtrTimeSettings
  chrome: NqtrChrome
  characters: NqtrCharacter[]
  locations: NqtrLocation[]
  rooms: NqtrRoom[]
  activities: NqtrActivity[]
  commitments: NqtrCommitment[]
  quests: NqtrQuest[]
  loading?: boolean
  loadStory: (scriptId: string) => Promise<NqtrStoryPayload>
  readSave: (sceneId: string, slot?: number) => Promise<NqtrSave | null>
  writeSave: (data: NqtrSaveWrite) => Promise<NqtrSave>
  renderDialogue: (props: NqtrDialogueRenderProps) => ReactNode
  toolbarExtra?: ReactNode
  showDebugToolbar?: boolean
  /** admin：保留调试工具条；player：全屏沉浸，对齐轻量剧本 VN。 */
  variant?: 'admin' | 'player'
  /** 供退出页调用：立刻把当前进度写入 hybrid 存档。 */
  onFlushReady?: (flush: () => Promise<void>) => void
  onRuntimeChange?: (runtime: NqtrWorldShellRuntime) => void
  className?: string
  frameClassName?: string
}

function normalizeAssetMap(assetMap?: NqtrStoryPayload['assetMap']): NqtrDialogueRenderProps['assetMap'] {
  if (!assetMap) return undefined
  return Object.fromEntries(Object.entries(assetMap).map(([alias, entry]) => {
    if (typeof entry === 'string') return [alias, { signedUrl: entry }]
    return [alias, entry]
  }))
}

function characterSprite(character?: NqtrCharacter) {
  const raw = character?.expressions
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw)
      : []
  for (const item of entries) {
    if (typeof item === 'string' && item) return item
    if (!item || typeof item !== 'object') continue
    const spriteUrl = (item as { spriteUrl?: unknown }).spriteUrl
    if (typeof spriteUrl === 'string' && spriteUrl) return spriteUrl
  }
  return character?.spriteBaseUrl || character?.avatarUrl || ''
}

function characterImage(character: NqtrCharacter | undefined, commitment: NqtrCommitment | undefined, slot: string) {
  const slotted = commitment?.slotImages?.[slot]
  const raw = (typeof slotted === 'string' ? slotted : '') || commitment?.imageUrl || characterSprite(character)
  return raw ? resolveFileAssetUrl(raw) : ''
}

export function NqtrWorldShell({
  sceneId,
  chapterId,
  map,
  time,
  chrome,
  characters,
  locations,
  rooms,
  activities,
  commitments,
  quests,
  loading = false,
  loadStory,
  readSave,
  writeSave,
  renderDialogue,
  toolbarExtra,
  showDebugToolbar = false,
  variant = 'admin',
  onFlushReady,
  onRuntimeChange,
  className,
  frameClassName,
}: NqtrWorldShellProps) {
  const isPlayer = variant === 'player'
  const look = parseNqtrChrome(chrome)
  const [session, setSession] = useState<NqtrSession>(() => freshSession(time))
  const [place, setPlace] = useState<NqtrPlace>({ mode: 'map' })
  const [inkJson, setInkJson] = useState<Record<string, unknown> | null>(null)
  const [inkSource, setInkSource] = useState('')
  const [inkAssetMap, setInkAssetMap] = useState<NqtrStoryPayload['assetMap']>(null)
  const [debug, setDebug] = useState<NqtrDialogueDebug | null>(null)
  const [hotspotsOpen, setHotspotsOpen] = useState(false)
  const [talkListOpen, setTalkListOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [metCommitmentKeys, setMetCommitmentKeys] = useState<string[]>([])
  /** 切场景时先保留旧底，新图预载完再一起露出文字层。 */
  const [displayedBg, setDisplayedBg] = useState('')
  const [sceneReady, setSceneReady] = useState(true)
  const questsRef = useRef(quests)
  const closedTalk = useRef<string | null>(null)
  const autoFired = useRef(new Set<string>())
  const sessionRef = useRef(session)
  const placeRef = useRef(place)
  const metRef = useRef(metCommitmentKeys)
  const talkedOnceRef = useRef(false)
  const saveReadyRef = useRef(false)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  questsRef.current = quests
  sessionRef.current = session
  placeRef.current = place
  metRef.current = metCommitmentKeys

  const handleDebug = useCallback((state: NqtrDialogueDebug) => {
    setDebug((prev) => {
      if (
        prev
        && prev.isReady === state.isReady
        && prev.isWaiting === state.isWaiting
        && prev.isEnded === state.isEnded
        && prev.history === state.history
        && prev.currentTags === state.currentTags
        && prev.choices === state.choices
        && prev.activeBackground?.url === state.activeBackground?.url
        && prev.activeBackground?.fit === state.activeBackground?.fit
        && prev.aiPayload === state.aiPayload
      ) return prev
      return state
    })
  }, [])

  const dialogueAssetMap = useMemo(() => normalizeAssetMap(inkAssetMap), [inkAssetMap])

  const reset = useCallback((nextRooms: NqtrRoom[]) => {
    const entrance = nextRooms.find((item) => item.isEntrance) ?? nextRooms[0]
    autoFired.current = new Set()
    closedTalk.current = null
    talkedOnceRef.current = false
    setMetCommitmentKeys([])
    setSession(freshSession(time))
    setInkJson(null)
    setInkSource('')
    setInkAssetMap(null)
    setDebug(null)
    setPlace(entrance ? { mode: 'room', roomId: entrance.id } : { mode: 'map' })
  }, [time])

  const applySave = useCallback(async (announce: boolean) => {
    const save = await readSave(sceneId)
    if (!save) {
      if (announce) toast.message('还没有存档')
      else reset(rooms)
      saveReadyRef.current = true
      return
    }
    const sameChapter = !chapterId || save.chapterId === chapterId
    setSession(sessionFromSave({
      gameDay: save.gameDay,
      gameTime: save.gameTime,
      questProgress: save.questProgress,
      flags: save.flags,
      runtime: save.runtime,
      sameChapter,
    }))
    setMetCommitmentKeys(sameChapter ? save.runtime?.metCommitmentKeys ?? [] : [])
    talkedOnceRef.current = Boolean(sameChapter && (save.runtime?.metCommitmentKeys?.length || save.runtime?.applied?.length))
    autoFired.current = new Set()
    closedTalk.current = null
    setInkJson(null)
    setInkSource('')
    setInkAssetMap(null)
    setDebug(null)
    setTalkListOpen(false)
    setHotspotsOpen(false)
    if (sameChapter && save.currentRoomId) setPlace({ mode: 'room', roomId: save.currentRoomId })
    else if (sameChapter && save.currentLocationId) setPlace({ mode: 'location', locationId: save.currentLocationId })
    else setPlace({ mode: 'map' })
    saveReadyRef.current = true
    if (announce) toast.success(sameChapter ? '已读取存档' : '已读档。这一章还没有单独的进度，标记和任务带了过来')
  }, [chapterId, readSave, reset, rooms, sceneId])

  useEffect(() => {
    if (loading) return
    let cancelled = false
    saveReadyRef.current = false
    void applySave(false)
      .catch(() => { if (!cancelled) reset(rooms) })
      .finally(() => { if (!cancelled) saveReadyRef.current = true })
    return () => { cancelled = true }
  }, [applySave, loading, reset, rooms])

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

  useEffect(() => {
    onRuntimeChange?.({
      session,
      place,
      slot,
      visibleActivities,
      visibleCommitments,
      currentRoom,
      currentLocation,
      debug,
      metCommitmentKeys,
    })
  }, [currentLocation, currentRoom, debug, metCommitmentKeys, onRuntimeChange, place, session, slot, visibleActivities, visibleCommitments])

  const withChapterPass = useCallback((next: NqtrSession): NqtrSession => {
    if (!chapterId) return next
    const questsNow = questsRef.current
    if (!(chapterQuestsCompleted(questsNow, next.questProgress) || (questsNow.length === 0 && talkedOnceRef.current))) {
      return next
    }
    const flags = markChapterPassedInFlags(next.flags, chapterId)
    return flags === next.flags ? next : { ...next, flags }
  }, [chapterId])

  const remember = useCallback((next: NqtrSession, met: string[], roomId: string | null, locationId: string | null) => {
    if (!chapterId) return Promise.reject(new Error('还没有章节，进度没法保存'))
    const saved = withChapterPass(next)
    sessionRef.current = saved
    return writeSave({
      sceneId,
      chapterId,
      slot: 1,
      gameDay: saved.gameDay,
      gameTime: saved.gameTime,
      currentMapId: map?.id ?? null,
      currentLocationId: locationId,
      currentRoomId: roomId,
      visitedRoomIds: roomId ? [roomId] : [],
      flags: saved.flags,
      questProgress: saved.questProgress,
      inkState: null,
      runtime: {
        enabledCommitmentIds: saved.enabledCommitmentIds,
        attached: saved.attached,
        applied: saved.applied,
        metCommitmentKeys: met,
      },
    })
  }, [chapterId, map?.id, sceneId, withChapterPass, writeSave])

  const placeIds = useCallback((current: NqtrPlace) => {
    const roomId = current.mode === 'room' || current.mode === 'talk' ? current.roomId : null
    const locationId = current.mode === 'location'
      ? current.locationId
      : roomId ? rooms.find((item) => item.id === roomId)?.locationId ?? null : null
    return { roomId, locationId }
  }, [rooms])

  const flushSave = useCallback(async () => {
    if (!chapterId || !saveReadyRef.current) return
    const current = placeRef.current
    const { roomId, locationId } = placeIds(current)
    await remember(sessionRef.current, metRef.current, roomId, locationId)
  }, [chapterId, placeIds, remember])

  const schedulePersist = useCallback(() => {
    if (!chapterId || !saveReadyRef.current) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void flushSave().catch(() => undefined)
    }, 400)
  }, [chapterId, flushSave])

  useEffect(() => {
    onFlushReady?.(flushSave)
  }, [flushSave, onFlushReady])

  useEffect(() => {
    if (!isPlayer || !chapterId) return
    const onHide = () => {
      void flushSave().catch(() => undefined)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      if (persistTimer.current) clearTimeout(persistTimer.current)
      void flushSave().catch(() => undefined)
    }
  }, [chapterId, flushSave, isPlayer])

  useEffect(() => {
    if (!saveReadyRef.current || place.mode === 'talk') return
    schedulePersist()
  }, [place, schedulePersist])

  const finishTalk = useCallback((talk: NqtrTalk) => {
    talkedOnceRef.current = true
    const met = talk.metKey && !metCommitmentKeys.includes(talk.metKey) ? [...metCommitmentKeys, talk.metKey] : metCommitmentKeys
    if (talk.metKey) setMetCommitmentKeys(met)
    setSession((prev) => {
      let next = applyQuest(prev, questsRef.current, talk.questId, talk.questAction)
      next = addSpent(next, talk.spend, time)
      next = syncStages(next, questsRef.current)
      next = withChapterPass(next)
      void remember(next, met, talk.roomId, rooms.find((item) => item.id === talk.roomId)?.locationId ?? null).catch(() => toast.error('进度保存失败'))
      return next
    })
    setInkJson(null)
    setInkSource('')
    setInkAssetMap(null)
    setHistoryOpen(false)
    setPlace({ mode: 'room', roomId: talk.roomId })
  }, [metCommitmentKeys, remember, rooms, time, withChapterPass])

  const openTalk = useCallback(async (talk: Omit<NqtrTalk, 'token'>) => {
    const token = `${Date.now().toString(36)}`
    const nextTalk = { ...talk, token }
    closedTalk.current = null
    setDebug(null)
    setHistoryOpen(false)
    if (!talk.scriptId) {
      closedTalk.current = token
      finishTalk(nextTalk)
      toast.message('这条没有对白，只推进了任务和时间')
      return
    }
    setPlace({ mode: 'talk', roomId: talk.roomId, talk: nextTalk })
    setInkJson(null)
    setInkSource('')
    setInkAssetMap(null)
    try {
      const story = await loadStory(talk.scriptId)
      setInkJson(story.inkJson ?? null)
      setInkSource(story.inkJson ? '' : story.inkSource ?? '')
      setInkAssetMap(story.assetMap ?? null)
      if (!story.inkJson && !story.inkSource) toast.error('这段 Ink 是空的')
    } catch {
      toast.error('对白加载失败')
      setPlace({ mode: 'room', roomId: talk.roomId })
    }
  }, [finishTalk, loadStory])

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
      metKey: `commitment:${autoCommitment.id}:${session.gameDay}:${slot}`,
    })
  }, [characters, openTalk, place, session.gameDay, slot, time.defaultTimeSpent, visibleActivities, visibleCommitments])

  const jumpSlot = () => {
    const ordered = [...time.timeSlots].sort((a, b) => a.startTime - b.startTime)
    const nextSlot = ordered.find((item) => item.startTime > session.gameTime + 0.001)
    setSession((prev) => {
      const next = syncStages({
        ...prev,
        gameTime: nextSlot?.startTime ?? ordered[0]?.startTime ?? prev.gameTime,
        gameDay: nextSlot ? prev.gameDay : prev.gameDay + 1,
      }, questsRef.current)
      sessionRef.current = next
      schedulePersist()
      return next
    })
  }

  const jumpDay = () => {
    setSession((prev) => {
      const next = syncStages({
        ...prev,
        gameDay: prev.gameDay + 1,
        gameTime: time.dayStartTime,
      }, questsRef.current)
      sessionRef.current = next
      schedulePersist()
      return next
    })
  }

  const showHotspots = hotspotsOpen && place.mode !== 'map' && Boolean(place.mode === 'location' ? currentLocation : currentRoom)
  const background = place.mode === 'map'
    ? map?.backgroundUrl
    : place.mode === 'location'
      ? currentLocation?.backgroundUrl || map?.backgroundUrl
      : currentRoom?.backgroundUrl || currentLocation?.backgroundUrl || map?.backgroundUrl
  const backgroundUrl = background ? resolveFileAssetUrl(background) : ''
  const inkOpen = place.mode === 'talk'
  const hideChrome = talkListOpen || inkOpen || hotspotsOpen
  const statusPlaceText = currentRoom
    ? (currentLocation?.displayName
      ? `${currentLocation.displayName} / ${currentRoom.displayName}`
      : currentRoom.displayName)
    : (currentLocation?.displayName || '')
  const statusTimeText = `${dayLabel(time, session.gameDay)} ${formatNqtrTime(session.gameTime)}`
  const showStatusBadge = Boolean(statusPlaceText) && sceneReady && (place.mode === 'room' || place.mode === 'talk') && !talkListOpen && !hotspotsOpen && !historyOpen

  useEffect(() => {
    if (!backgroundUrl) {
      setDisplayedBg('')
      setSceneReady(true)
      return
    }
    if (backgroundUrl === displayedBg) {
      setSceneReady(true)
      return
    }
    let cancelled = false
    const image = new Image()
    const reveal = () => {
      if (cancelled) return
      setDisplayedBg(backgroundUrl)
      setSceneReady(true)
    }
    image.onload = reveal
    image.onerror = reveal
    image.src = backgroundUrl
    // 缓存命中时立刻换底，不要先藏图标再显示（会闪一下）。
    if (image.complete) {
      reveal()
    } else {
      setSceneReady(false)
    }
    return () => { cancelled = true }
  }, [backgroundUrl, displayedBg])

  return (
    <div className={className ?? (isPlayer ? 'flex min-h-0 flex-1 flex-col' : 'min-w-0 space-y-3')}>
      {!isPlayer && !talkListOpen && !inkOpen && (
        <div className="mx-auto flex w-full max-w-[420px] flex-wrap items-center gap-1.5">
          {!hotspotsOpen && <Badge variant="secondary">{map?.displayName || '未绑定地图'}</Badge>}
          {!hotspotsOpen && <Badge variant="secondary">{dayLabel(time, session.gameDay)} · {slot} · {formatNqtrTime(session.gameTime)}</Badge>}
          <div className="flex w-full flex-wrap gap-1">
            {!hotspotsOpen && place.mode !== 'map' && <Button size="sm" variant="outline" onClick={() => { setHotspotsOpen(false); setPlace({ mode: 'map' }) }}>地图</Button>}
            {place.mode !== 'map' && <Button size="sm" variant="outline" onClick={() => setHotspotsOpen((open) => !open)}>热点</Button>}
            {!hotspotsOpen && place.mode === 'location' && <Button size="sm" variant="outline" onClick={() => setPlace({ mode: 'map' })}>返回</Button>}
            {showDebugToolbar && !hotspotsOpen && <Button size="sm" variant="outline" onClick={jumpSlot}>下一时段</Button>}
            {showDebugToolbar && !hotspotsOpen && <Button size="sm" variant="outline" onClick={jumpDay}>下一天</Button>}
            {showDebugToolbar && !hotspotsOpen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  reset(rooms)
                  const fresh = freshSession(time)
                  void remember(fresh, [], null, null).catch(() => toast.error('进度保存失败'))
                }}
              >
                重置
              </Button>
            )}
            {!hotspotsOpen && (
              <Button size="sm" variant="outline" onClick={() => void applySave(true).catch(() => toast.error('读取存档失败'))}>
                读取存档
              </Button>
            )}
            {!hotspotsOpen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const roomId = place.mode === 'room' ? place.roomId : null
                  const locationId = place.mode === 'location'
                    ? place.locationId
                    : roomId ? rooms.find((item) => item.id === roomId)?.locationId ?? null : null
                  void remember(session, metCommitmentKeys, roomId, locationId)
                    .then(() => toast.success('进度已保存'))
                    .catch((error: Error) => toast.error(error.message || '进度保存失败'))
                }}
              >
                保存进度
              </Button>
            )}
            {toolbarExtra}
          </div>
        </div>
      )}
      <div className={frameClassName ?? (isPlayer
        ? 'relative min-h-0 flex-1 overflow-hidden bg-slate-950'
        : 'relative mx-auto h-[78vh] max-h-[760px] w-full max-w-[420px] overflow-hidden rounded-lg border border-border bg-slate-950')}>
        {displayedBg ? (
          <img src={displayedBg} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,#1c2836,#0d141c)]" />
        )}
        {place.mode !== 'map' && !talkListOpen && !inkOpen && (
          <div className="absolute right-3 top-3 z-30 flex items-start gap-2">
            <NqtrCommandIcon chrome={look} command="place" label="热点" onClick={() => setHotspotsOpen((open) => !open)} />
            {!hotspotsOpen && (
              <NqtrCommandIcon
                chrome={look}
                command="map"
                label="地图"
                onClick={() => { setHotspotsOpen(false); setPlace({ mode: 'map' }) }}
              />
            )}
          </div>
        )}

        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-white"><Loader2 className="size-6 animate-spin" /></div>
        ) : place.mode === 'talk' && (inkJson || inkSource) ? (
          <div className="absolute inset-0 z-10">
            {renderDialogue({
              token: place.talk.token,
              inkJson: inkJson ?? undefined,
              inkSource: inkSource || undefined,
              assetMap: dialogueAssetMap,
              characters,
              defaultBackgroundUrl: displayedBg || backgroundUrl || undefined,
              onDismiss: () => finishTalk(place.talk),
              onDebugChange: handleDebug,
              onHistoryOpenChange: setHistoryOpen,
            })}
          </div>
        ) : place.mode === 'map' ? (
          <div className={`absolute inset-0 z-10 transition-opacity duration-700 ease-out ${sceneReady ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            {locations.map((location) => (
              <button
                key={location.id}
                type="button"
                className="absolute -translate-x-1/2 -translate-y-1/2 bg-transparent"
                style={{ left: `${location.posX}%`, top: `${location.posY}%` }}
                onClick={() => setPlace({ mode: 'location', locationId: location.id })}
              >
                <NqtrPinLabel chrome={look} label={location.displayName} />
              </button>
            ))}
            {!map && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-white/80">先在设定里绑定一张地图</p>}
            {map && !locations.length && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-white/80">这张地图还没有地点</p>}
          </div>
        ) : place.mode === 'room' && currentRoom ? (
          <>
            <div className="absolute inset-x-0 bottom-24 z-10 flex items-end justify-center gap-6 px-4">
              {visibleCommitments.filter((item) => item.trigger === 'auto' && !metCommitmentKeys.includes(`commitment:${item.id}:${session.gameDay}:${slot}`)).map((item) => {
                const character = characters.find((entry) => entry.id === item.characterId)
                const image = characterImage(character, item, slot)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="group flex max-w-40 flex-col items-center bg-transparent"
                    onClick={() => void openTalk({
                      roomId: currentRoom.id,
                      scriptId: item.inkScriptId ?? '',
                      label: character?.displayName ?? '角色',
                      spend: time.defaultTimeSpent,
                      questId: item.questId ?? null,
                      questAction: item.questAction ?? null,
                      metKey: `commitment:${item.id}:${session.gameDay}:${slot}`,
                    })}
                  >
                    {image ? <img src={image} alt="" className="max-h-[42vh] object-contain drop-shadow-xl transition-transform group-hover:-translate-y-1" /> : <span className="flex size-24 items-center justify-center rounded-full bg-white/90 text-lg font-semibold">{(character?.displayName || '?').slice(0, 1)}</span>}
                  </button>
                )
              })}
            </div>
            {!hideChrome && (
              <div className="absolute inset-x-0 bottom-0 z-10 flex gap-3 overflow-x-auto p-4 pr-20">
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
            )}
          </>
        ) : null}
        {showStatusBadge ? (
          <NqtrStatusBadge
            chrome={look}
            timeText={statusTimeText}
            placeText={statusPlaceText}
          />
        ) : null}
        {place.mode === 'room' && currentRoom && !hideChrome && (
          <button type="button" aria-label="对话" className="absolute bottom-4 right-4 z-30 bg-transparent" onClick={() => setTalkListOpen(true)}>
            {look.talkIcon
              ? <img src={resolveFileAssetUrl(look.talkIcon)} alt="" className="object-contain" style={{ width: look.talkIconSize, height: look.talkIconSize }} />
              : <MessageCircle className="text-white drop-shadow" style={{ width: look.talkIconSize, height: look.talkIconSize }} />}
          </button>
        )}
        {talkListOpen && place.mode === 'room' && currentRoom && (
          <div className="absolute inset-0 z-40 flex justify-end bg-background/80 p-4 backdrop-blur-sm" onClick={() => setTalkListOpen(false)}>
            <Card className="flex h-full w-full max-w-[360px] flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">对话</p>
                  <p className="text-xs text-muted-foreground">点一个角色开始搭话</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="关闭" onClick={() => setTalkListOpen(false)}>
                  <X />
                </Button>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <CardContent className="flex flex-col gap-2 p-4">
                  {visibleCommitments.filter((item) => item.trigger !== 'auto' || metCommitmentKeys.includes(`commitment:${item.id}:${session.gameDay}:${slot}`)).length ? visibleCommitments.filter((item) => item.trigger !== 'auto' || metCommitmentKeys.includes(`commitment:${item.id}:${session.gameDay}:${slot}`)).map((item) => {
                    const character = characters.find((entry) => entry.id === item.characterId)
                    const name = character?.displayName ?? '角色'
                    const avatar = character?.avatarUrl ? resolveFileAssetUrl(character.avatarUrl) : ''
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        variant="ghost"
                        className="h-auto justify-start gap-3 px-3 py-2"
                        onClick={() => {
                          setTalkListOpen(false)
                          void openTalk({
                            roomId: currentRoom.id,
                            scriptId: item.inkScriptId ?? '',
                            label: name,
                            spend: time.defaultTimeSpent,
                            questId: item.questId ?? null,
                            questAction: item.questAction ?? null,
                          })
                        }}
                      >
                        <Avatar>
                          {avatar ? <AvatarImage src={avatar} alt="" /> : null}
                          <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 text-left">
                          <span className="block truncate text-sm font-semibold">{name}</span>
                          <span className="block truncate text-xs font-normal text-muted-foreground">发呆</span>
                        </span>
                      </Button>
                    )
                  }) : <p className="py-10 text-center text-sm text-muted-foreground">现在没有可以搭话的人。</p>}
                </CardContent>
              </ScrollArea>
            </Card>
          </div>
        )}
        {showHotspots && (
          <div className="absolute inset-0 z-20">
            {activeHotspots.map((item) => (
              <button
                key={item.id}
                type="button"
                className="absolute -translate-x-1/2 -translate-y-1/2 bg-transparent"
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                onClick={() => {
                  if (!item.roomId) return
                  setHotspotsOpen(false)
                  setPlace({ mode: 'room', roomId: item.roomId })
                }}
              >
                <NqtrPinLabel chrome={look} label={item.title} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
