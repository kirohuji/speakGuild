import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NqtrWorldShell, type NqtrWorldShellRuntime } from '@/features/nqtr/components/nqtr-world-shell'
import { readNqtrSave, writeNqtrSave } from '@/features/nqtr/api/nqtr-save-api'
import { formatNqtrTime, parseNqtrChrome, type NqtrChrome, type NqtrTimeSettings } from '@/features/nqtr/model/nqtr-time-chrome'
import type { NqtrDialogueRenderProps } from '@/features/nqtr/model/types'
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
} from '../api-content-admin'
import { VnStoryPreview } from './vn-story-preview'

export function NqtrPackagePreview({
  sceneId,
  map,
  time,
  chrome,
  characters,
  chapterId,
  chapterLocationIds = [],
}: {
  sceneId: string
  map: GameMapData | null
  time: NqtrTimeSettings
  chrome: NqtrChrome
  characters: GameCharacter[]
  chapterId?: string
  chapterLocationIds?: string[]
}) {
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<GameLocationData[]>([])
  const [rooms, setRooms] = useState<GameRoomData[]>([])
  const [activities, setActivities] = useState<NqtrActivity[]>([])
  const [commitments, setCommitments] = useState<NqtrCommitment[]>([])
  const [quests, setQuests] = useState<NqtrQuest[]>([])
  const [aiEnabled, setAiEnabled] = useState(false)
  const [runtime, setRuntime] = useState<NqtrWorldShellRuntime | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextLocations, nextRooms, nextActivities, nextCommitments, nextQuests] = await Promise.all([
        map ? listLocations(map.id) : Promise.resolve([]),
        listRooms(),
        listActivities(sceneId, chapterId),
        listCommitments(sceneId, chapterId),
        listQuests(sceneId, chapterId),
      ])
      const openLocations = new Set(chapterLocationIds)
      const visibleLocations = nextLocations.filter((item) => !item.hidden && !item.disabled && (!openLocations.size || openLocations.has(item.id)))
      setLocations(visibleLocations)
      setRooms(nextRooms.filter((item) => visibleLocations.some((location) => location.id === item.locationId) && !item.hidden && !item.disabled))
      setActivities(nextActivities)
      setCommitments(nextCommitments)
      setQuests(nextQuests)
    } catch {
      toast.error('总预览加载失败')
    } finally {
      setLoading(false)
    }
  }, [chapterId, chapterLocationIds.join(','), map, sceneId])

  useEffect(() => { void load() }, [load])

  const renderDialogue = useCallback((props: NqtrDialogueRenderProps) => (
    <VnStoryPreview
      key={props.token}
      inkJson={props.inkJson}
      inkSource={props.inkSource}
      characters={characters}
      defaultBackgroundUrl={props.defaultBackgroundUrl}
      previewLayout="portrait"
      aiEvaluationEnabled={aiEnabled}
      holdLastLine
      hideDisplayMode
      onDismiss={props.onDismiss}
      className="h-full max-h-full w-full max-w-none"
      onDebugChange={props.onDebugChange}
      onHistoryOpenChange={props.onHistoryOpenChange}
    />
  ), [aiEnabled, characters])

  const loadStory = useCallback(async (scriptId: string) => {
    const story = await getStory(scriptId)
    return { inkJson: story.inkJson ?? null, inkSource: story.inkSource ?? null }
  }, [])

  const activeQuests = quests.filter((quest) => runtime?.session.questProgress[quest.key])
  const look = parseNqtrChrome(chrome)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]">
      <NqtrWorldShell
        sceneId={sceneId}
        chapterId={chapterId}
        map={map}
        time={time}
        chrome={look}
        characters={characters}
        locations={locations}
        rooms={rooms}
        activities={activities}
        commitments={commitments}
        quests={quests}
        loading={loading}
        loadStory={loadStory}
        readSave={readNqtrSave}
        writeSave={writeNqtrSave}
        renderDialogue={renderDialogue}
        showDebugToolbar
        onRuntimeChange={setRuntime}
      />

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
          <Metric label="地点" value={runtime?.currentRoom?.displayName || runtime?.currentLocation?.displayName || '地图'} />
          <Metric label="时间" value={runtime ? `${runtime.session.gameDay}天 ${formatNqtrTime(runtime.session.gameTime)}` : '-'} />
          <Metric label="任务" value={String(activeQuests.length)} />
          <Metric label="对白" value={runtime?.place.mode === 'talk' ? (runtime.debug?.isEnded ? '结束' : runtime.debug?.isWaiting ? '等待输入' : '播放中') : '未打开'} />
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
                  {runtime?.visibleActivities.map((item) => <p key={item.id} className="text-sm leading-5">{item.title}{item.questAction === 'start' ? ' · 领取任务' : item.questAction === 'continue' ? ' · 完成阶段' : ''}</p>)}
                  {runtime?.visibleCommitments.map((item) => <p key={item.id} className="text-sm leading-5">{characters.find((entry) => entry.id === item.characterId)?.displayName ?? '角色'}</p>)}
                  {!runtime?.visibleActivities.length && !runtime?.visibleCommitments.length && <p className="text-xs text-muted-foreground">没有可交互的内容。</p>}
                </div>
              </section>
              <section className="space-y-2">
                <p className="px-1 text-[11px] font-semibold text-muted-foreground">任务</p>
                {activeQuests.length ? activeQuests.map((quest) => {
                  const progress = runtime?.session.questProgress[quest.key]
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
              {runtime?.debug?.history.length ? runtime.debug.history.map((line, index) => (
                <div key={`${line.speaker}-${index}`} className="rounded-md border border-border bg-card px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">{index + 1}. {line.speaker || '旁白'}</p>
                  <p className="mt-0.5 text-sm leading-5">{line.text}</p>
                </div>
              )) : <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">点房间里的角色或行为后，这里显示台词。</p>}
            </TabsContent>
            <TabsContent value="log" className="mt-0 space-y-2 p-3">
              {(runtime?.session.log ?? []).map((line, index) => (
                <div key={`${line}-${index}`} className="rounded-md border border-border bg-card px-3 py-2 text-sm leading-5">{line}</div>
              ))}
            </TabsContent>
            <TabsContent value="debug" className="mt-0 space-y-2 p-3">
              <details open className="rounded-md border border-border bg-card">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">当前 Tags</summary>
                <div className="flex min-h-8 flex-wrap gap-1 border-t border-border p-2">
                  {runtime?.debug?.currentTags.length ? runtime.debug.currentTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">#{tag}</Badge>
                  )) : <span className="text-xs text-muted-foreground">暂无 tags</span>}
                </div>
              </details>
              <details className="rounded-md border border-border bg-card">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">背景</summary>
                <div className="border-t border-border p-2 text-xs">
                  <p>fit: <span className="font-mono">{runtime?.debug?.activeBackground?.fit ?? '-'}</span></p>
                  <p className="mt-1 break-all">url: <span className="font-mono">{runtime?.debug?.activeBackground?.url ?? '-'}</span></p>
                </div>
              </details>
              <details className="rounded-md border border-border bg-card">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">AI 评估 Payload</summary>
                <pre className="max-h-[420px] overflow-auto border-t border-border bg-muted/30 p-2 text-[11px] leading-relaxed">
                  {JSON.stringify(runtime?.debug?.aiPayload ?? {}, null, 2)}
                </pre>
              </details>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </aside>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  )
}
