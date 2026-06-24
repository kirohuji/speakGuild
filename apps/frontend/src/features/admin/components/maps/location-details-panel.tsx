import { Edit3, EyeOff, Lock, MapPin, Plus, ScrollText, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { GameLocationData, GameRoomData } from '../../api-content-admin'
import { hasAsset, locationTypeLabel, roomTypeLabel } from './map-management-shared'

export function LocationDetailsPanel({
  selectedLocation,
  selectedLocationRooms,
  onEditLocation,
  onCreateRoom,
  onEditRoom,
  onRemoveNpc,
}: {
  selectedLocation: GameLocationData | null
  selectedLocationRooms: GameRoomData[]
  onEditLocation: (location: GameLocationData) => void
  onCreateRoom: (locationId: string) => void
  onEditRoom: (room: GameRoomData) => void
  onRemoveNpc: (id: string) => void
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4" />
          {selectedLocation ? selectedLocation.displayName : '地点详情'}
        </CardTitle>
        <CardDescription>
          {selectedLocation ? `${selectedLocation.name} · (${selectedLocation.posX}, ${selectedLocation.posY})` : '选择一个地点查看房间'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {selectedLocation ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{locationTypeLabel[selectedLocation.locationType] ?? selectedLocation.locationType}</Badge>
              <Badge variant="outline">需 {selectedLocation.requiredOutputLevel}</Badge>
              {selectedLocation.hidden && <Badge variant="outline"><EyeOff className="mr-1 size-3" />隐藏</Badge>}
              {selectedLocation.disabled && <Badge variant="outline"><Lock className="mr-1 size-3" />禁用</Badge>}
            </div>
            {selectedLocation.description && (
              <p className="text-sm text-muted-foreground">{selectedLocation.description}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEditLocation(selectedLocation)}>
                <Edit3 data-icon="inline-start" />
                编辑地点
              </Button>
              <Button variant="outline" size="sm" onClick={() => onCreateRoom(selectedLocation.id)}>
                <Plus data-icon="inline-start" />
                添加房间
              </Button>
            </div>
            <Separator />
            <div className="flex flex-col gap-2">
              {selectedLocationRooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">这个地点还没有房间。</p>
              ) : selectedLocationRooms.map((room) => (
                <div key={room.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{room.displayName}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{room.name}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => onEditRoom(room)}>
                      <Edit3 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{roomTypeLabel[room.roomType] ?? room.roomType}</Badge>
                    {room.isEntrance && <Badge>入口</Badge>}
                    {hasAsset(room.inkScriptId) ? <Badge variant="outline"><ScrollText className="mr-1 size-3" />脚本</Badge> : <Badge variant="outline">未绑脚本</Badge>}
                    <Badge variant="outline"><Users className="mr-1 size-3" />{room.npcs?.length ?? 0}</Badge>
                  </div>
                  {(room.npcs?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {room.npcs?.map((npc) => (
                        <button
                          key={npc.id}
                          type="button"
                          className="bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                          title="点击移除 NPC"
                          onClick={() => onRemoveNpc(npc.id)}
                        >
                          {npc.character.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">还没有可查看的地点。</p>
        )}
      </CardContent>
    </Card>
  )
}
