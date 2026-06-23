import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Layers3, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/cn'
import type { GameLocationData, GameMapData, GameRoomData } from '../../api-content-admin'

export function MapDirectory({
  maps,
  selectedMap,
  selectedLocationId,
  locsForMap,
  roomsForLoc,
  onSelectMap,
  onSelectLocation,
}: {
  maps: GameMapData[]
  selectedMap: GameMapData | null
  selectedLocationId: string
  locsForMap: (mapId: string) => GameLocationData[]
  roomsForLoc: (locId: string) => GameRoomData[]
  onSelectMap: (mapId: string, firstLocationId: string) => void
  onSelectLocation: (locationId: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(selectedMap?.id ? [selectedMap.id] : []))

  useEffect(() => {
    if (!selectedMap?.id) return
    setExpanded((prev) => new Set(prev).add(selectedMap.id))
  }, [selectedMap?.id])

  const toggleMap = (map: GameMapData, firstLocationId: string) => {
    onSelectMap(map.id, firstLocationId)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(map.id)) next.delete(map.id)
      else next.add(map.id)
      return next
    })
  }

  return (
    <Card className="overflow-hidden rounded-none">
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers3 className="size-4" />
          地图目录
        </CardTitle>
        <CardDescription>按地图、地点、房间浏览空间结构</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[720px]">
          <div className="divide-y divide-border/70">
            {maps.map((map) => {
              const mapLocs = locsForMap(map.id)
              const mapRooms = mapLocs.flatMap((loc) => roomsForLoc(loc.id))
              const isActive = selectedMap?.id === map.id
              const isExpanded = expanded.has(map.id)
              return (
                <div key={map.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-3 text-left transition hover:bg-muted/40',
                      isActive && 'bg-muted/55',
                    )}
                    onClick={() => toggleMap(map, mapLocs[0]?.id || '')}
                  >
                    {isExpanded ? <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{map.displayName}</p>
                        <Badge variant="outline" className="shrink-0 rounded-none">需 {map.requiredOutputLevel}</Badge>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{map.name}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                        <span className="bg-muted px-2 py-0.5">{mapLocs.length} 地点</span>
                        <span className="bg-muted px-2 py-0.5">{mapRooms.length} 房间</span>
                        <span className="bg-muted px-2 py-0.5">{mapRooms.reduce((sum, rm) => sum + (rm.npcs?.length ?? 0), 0)} NPC</span>
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border/60 bg-muted/15 py-1">
                      {mapLocs.length === 0 ? (
                        <p className="px-9 py-2 text-xs text-muted-foreground">暂无地点</p>
                      ) : mapLocs.map((loc) => {
                        const locRooms = roomsForLoc(loc.id)
                        const isLocationActive = selectedLocationId === loc.id
                        return (
                          <button
                            key={loc.id}
                            type="button"
                            className={cn(
                              'flex w-full items-center gap-2 px-9 py-2 text-left text-sm transition hover:bg-background/70',
                              isLocationActive && 'bg-background font-medium',
                            )}
                            onClick={() => {
                              if (selectedMap?.id !== map.id) onSelectMap(map.id, loc.id)
                              onSelectLocation(loc.id)
                            }}
                          >
                            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">{loc.displayName}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{locRooms.length} 房间</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
