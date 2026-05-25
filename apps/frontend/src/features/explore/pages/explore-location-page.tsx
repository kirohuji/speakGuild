import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageCircle, MapPin, Users, Mic, Send, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { VnScene } from '@/features/vn-engine/vn-scene'
import { DialogueBox } from '@/features/vn-engine/dialogue-box'
import { SaveLoadPanel } from '../components/save-load-panel'
import { exploreApi, gameSaveApi, type LocationDetail, type GameCharacter, type GameSave } from '../api/explore-api'
import { cn } from '@/lib/cn'

type Tab = 'scene' | 'npcs' | 'saves'

export function ExploreLocationPage() {
  const { locationId } = useParams<{ locationId: string }>()
  const navigate = useNavigate()

  const [location, setLocation] = useState<LocationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('scene')

  // Dialogue state
  const [selectedNpc, setSelectedNpc] = useState<GameCharacter | null>(null)
  const [dialogueLines, setDialogueLines] = useState<{ speaker: string; text: string }[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [inputText, setInputText] = useState('')

  // Save state
  const [saves, setSaves] = useState<GameSave[]>([])
  const [currentSlot, setCurrentSlot] = useState(1)

  useEffect(() => {
    if (!locationId) return
    Promise.all([
      exploreApi.getLocation(locationId),
      gameSaveApi.list().catch(() => []),
    ]).then(([loc, svs]) => {
      setLocation(loc)
      setSaves(Array.isArray(svs) ? svs : [])
      // Initial scene greeting
      if (loc?.npcs?.length) {
        const npc = loc.npcs[0].character
        setDialogueLines([{ speaker: npc.displayName, text: `Welcome to ${loc.displayName}! How can I help you today?` }])
      }
    }).catch(() => {})
    .finally(() => setLoading(false))
  }, [locationId])

  const startTalking = useCallback((npc: GameCharacter) => {
    setSelectedNpc(npc)
    setDialogueLines((prev) => [
      ...prev,
      { speaker: npc.displayName, text: `Hi! I'm ${npc.displayName}. ${npc.role}. What would you like to talk about?` },
    ])
    setTab('scene')
  }, [])

  const sendMessage = () => {
    if (!inputText.trim() || !selectedNpc) return
    const userMsg = inputText.trim()
    setDialogueLines((prev) => [...prev, { speaker: 'You', text: userMsg }])
    setInputText('')

    // Simulate NPC response
    setTimeout(() => {
      const replies = [
        "That's interesting! Tell me more about that.",
        "I see. Well, let me think about that for a moment.",
        "Oh, that reminds me of something. Have you been here long?",
        "Great question! Let me help you with that.",
      ]
      const reply = replies[Math.floor(Math.random() * replies.length)]
      setDialogueLines((prev) => [...prev, { speaker: selectedNpc.displayName, text: reply }])
    }, 800)
  }

  const handleSave = async (slot: number) => {
    try {
      await gameSaveApi.save(slot, {
        currentLocationId: locationId,
        saveName: location?.displayName ?? `存档 ${slot}`,
        playTimeSeconds: 0,
      })
    } catch {}
  }

  const handleLoad = async (slot: number) => {
    try {
      const save = await gameSaveApi.get(slot)
      if (save?.currentLocationId && save.currentLocationId !== locationId) {
        navigate(`/explore/${save.currentLocationId}`)
      }
    } catch {}
  }

  const refreshSaves = async () => {
    try {
      const svs = await gameSaveApi.list()
      setSaves(Array.isArray(svs) ? svs : [])
    } catch {}
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>
  if (!location) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8"><p className="text-destructive">地点不存在</p><Button variant="outline" onClick={() => navigate(-1)}>返回</Button></div>

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{location.map?.displayName ?? '地图'}</p>
          <h1 className="text-lg font-bold text-foreground">{location.displayName}</h1>
        </div>
        <Badge variant="secondary">{location.npcs?.length ?? 0} NPCs</Badge>
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex gap-2">
        {[
          { id: 'scene' as Tab, icon: MessageCircle, label: '对话' },
          { id: 'npcs' as Tab, icon: Users, label: 'NPC' },
          { id: 'saves' as Tab, icon: Menu, label: '存档' },
        ].map((t) => {
          const Icon = t.icon
          return (
            <Button
              key={t.id}
              variant={tab === t.id ? 'default' : 'outline'}
              size="sm"
              className="flex-1 gap-1"
              onClick={() => setTab(t.id)}
            >
              <Icon className="size-3.5" /> {t.label}
            </Button>
          )
        })}
      </div>

      {/* Tab: Scene (dialogue) */}
      {tab === 'scene' && (
        <div className="space-y-4">
          <VnScene backgroundUrl={location.backgroundUrl} className="min-h-[350px]">
            <div className="space-y-3">
              {dialogueLines.map((line, i) => (
                <DialogueBox
                  key={i}
                  speaker={line.speaker}
                  text={line.text}
                  isCurrent={i === dialogueLines.length - 1}
                />
              ))}
              {isRecording && (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-destructive/10 py-3">
                  <Mic className="size-4 animate-pulse text-destructive" />
                  <span className="text-sm text-destructive">录音中...</span>
                </div>
              )}
            </div>
          </VnScene>

          {/* Input area */}
          {selectedNpc && (
            <div className="flex gap-2">
              <Button
                variant={isRecording ? 'destructive' : 'outline'}
                size="icon"
                onClick={() => setIsRecording(!isRecording)}
              >
                <Mic className="size-4" />
              </Button>
              <input
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="输入英文回复..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <Button size="icon" onClick={sendMessage} disabled={!inputText.trim()}>
                <Send className="size-4" />
              </Button>
            </div>
          )}

          {!selectedNpc && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <Users className="size-10 text-muted-foreground/40" />
                <p className="text-muted-foreground">在「NPC」标签中选择一个角色开始对话</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab: NPCs */}
      {tab === 'npcs' && (
        <div className="space-y-2">
          {location.npcs?.map((npcRel) => {
            const npc = npcRel.character
            return (
              <Card
                key={npc.id}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50',
                  selectedNpc?.id === npc.id && 'border-primary/50 bg-primary/5',
                )}
                onClick={() => startTalking(npc)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                    {npc.avatarUrl ? (
                      <img src={npc.avatarUrl} alt={npc.name} className="size-full rounded-full object-cover" />
                    ) : (
                      npc.displayName.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{npc.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{npc.role}</p>
                  </div>
                  <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Tab: Saves */}
      {tab === 'saves' && (
        <SaveLoadPanel
          currentSlot={currentSlot}
          saves={saves}
          onSave={handleSave}
          onLoad={handleLoad}
          onRefresh={refreshSaves}
        />
      )}

      {/* Exits / Navigation */}
      {location.exits && location.exits.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">可前往</p>
          <div className="flex flex-wrap gap-2">
            {location.exits.map((exit) => (
              <Button
                key={exit.to.id}
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => navigate(`/explore/${exit.to.id}`)}
              >
                <MapPin className="size-3" /> {exit.to.displayName}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
