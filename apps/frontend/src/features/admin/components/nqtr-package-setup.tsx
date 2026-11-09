import { useState } from 'react'
import { Check, ChevronsUpDown, Layers3, Map, Plus, Trash2, UserCircle, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/cn'
import { resolveFileAssetUrl } from '@/lib/file-asset-reference'
import type { GameCharacter, GameMapData } from '../api-content-admin'
import { formatNqtrTime, type NqtrTimeSettings } from './maps/nqtr-model'

export function NqtrPackageSetup({
  maps,
  characters,
  mapId,
  characterIds,
  time,
  saving,
  onMapId,
  onCharacterIds,
  onTime,
  onSave,
}: {
  maps: GameMapData[]
  characters: GameCharacter[]
  mapId: string
  characterIds: string[]
  time: NqtrTimeSettings
  saving: boolean
  onMapId: (mapId: string) => void
  onCharacterIds: (ids: string[]) => void
  onTime: (time: NqtrTimeSettings) => void
  onSave: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const selectedMap = maps.find((item) => item.id === mapId) ?? null
  const selectedCharacters = characters.filter((item) => characterIds.includes(item.id))
  const mapPreview = resolveFileAssetUrl(selectedMap?.thumbnailUrl || selectedMap?.backgroundUrl)
  const locationCount = selectedMap?.locations?.length ?? 0

  const toggleCharacter = (id: string, checked: boolean) => {
    onCharacterIds(checked ? [...characterIds, id] : characterIds.filter((item) => item !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>世界地图</CardTitle>
            <CardDescription>这本探索包只绑定一张世界。地点和房间都从这张地图来。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nqtr-map">选择地图</Label>
              <Select id="nqtr-map" value={mapId} onChange={(event) => onMapId(event.target.value)}>
                <SelectItem value="">先不绑定</SelectItem>
                {maps.map((map) => <SelectItem key={map.id} value={map.id}>{map.displayName}</SelectItem>)}
              </Select>
            </div>
            {selectedMap ? (
              <div className="flex gap-4 bg-muted/40 p-3">
                <div className="flex h-28 w-44 shrink-0 items-center justify-center overflow-hidden bg-muted">
                  {mapPreview ? <img src={mapPreview} alt="" className="size-full object-cover" /> : <Map className="size-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex flex-col gap-2">
                  <div>
                    <p className="truncate font-medium">{selectedMap.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{selectedMap.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{selectedMap.width} × {selectedMap.height}</Badge>
                    <Badge variant="outline">{locationCount} 个地点</Badge>
                    {selectedMap.disabled && <Badge variant="secondary">停用</Badge>}
                    {selectedMap.hidden && <Badge variant="secondary">隐藏</Badge>}
                  </div>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">还没有绑定地图。</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>出演角色</CardTitle>
            <CardDescription>从共享角色库多选。日程里只能用这份名单。</CardDescription>
          </CardHeader>
          <CardContent>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between px-3 font-normal">
                  <span className="truncate">{selectedCharacters.length ? `已选 ${selectedCharacters.length} 人` : '选择出演角色'}</span>
                  <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="搜索角色名称或身份" />
                  <CommandList>
                    <CommandEmpty>没有匹配的角色</CommandEmpty>
                    <CommandGroup>
                      {characters.map((character) => {
                        const checked = characterIds.includes(character.id)
                        return (
                          <CommandItem
                            key={character.id}
                            value={`${character.displayName} ${character.name} ${character.role}`}
                            onSelect={() => toggleCharacter(character.id, !checked)}
                          >
                            <Check className={cn('opacity-0', checked && 'opacity-100')} />
                            <span className="min-w-0 flex-1 truncate">{character.displayName}</span>
                            <span className="truncate text-xs text-muted-foreground">{character.role}</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已选角色</CardTitle>
          <CardDescription>共 {selectedCharacters.length} 人，展示方式和角色资产一致。</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedCharacters.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedCharacters.map((character) => {
                const avatar = resolveFileAssetUrl(character.avatarUrl)
                const expressionCount = character.expressions && typeof character.expressions === 'object' ? Object.keys(character.expressions).length : 0
                return (
                  <Card key={character.id} className="bg-muted/20">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          {avatar ? (
                            <img src={avatar} alt={character.displayName} className="size-12 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                              {character.displayName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">{character.displayName}</CardTitle>
                            <p className="truncate font-mono text-xs text-muted-foreground">{character.name}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="size-7" aria-label={`移除${character.displayName}`} onClick={() => toggleCharacter(character.id, false)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{character.role}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {expressionCount > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            <Layers3 className="mr-0.5 size-2.5" />
                            {expressionCount} 个状态
                          </Badge>
                        )}
                        {character.voiceBindings?.length ? (
                          <Badge variant="outline" className="text-[10px]"><Volume2 className="mr-0.5 size-2.5" />{character.voiceBindings.length} 个音色</Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10">
              <UserCircle className="size-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">还没有选择角色</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>游戏时间</CardTitle>
          <CardDescription>对应 Pixi-VN 的 timeTracker。时段数量不限，18.30 表示 18:30。下一段时间开始前，都属于上一段。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField label="一天开始" value={time.dayStartTime} onChange={(dayStartTime) => onTime({ ...time, dayStartTime })} />
            <NumberField label="一天结束" value={time.dayEndTime} onChange={(dayEndTime) => onTime({ ...time, dayEndTime })} />
            <NumberField label="默认流逝" value={time.defaultTimeSpent} onChange={(defaultTimeSpent) => onTime({ ...time, defaultTimeSpent })} />
            <NumberField label="一周几天" value={time.weekLength} min={1} onChange={(weekLength) => {
              const nextLength = Math.max(1, weekLength)
              onTime({
                ...time,
                weekLength: nextLength,
                dayNames: Array.from({ length: nextLength }, (_, index) => time.dayNames[index] || `第${index + 1}天`),
                weekendStartDay: Math.min(time.weekendStartDay, nextLength),
              })
            }} />
            <NumberField label="周末从第几天" value={time.weekendStartDay} min={1} onChange={(weekendStartDay) => onTime({ ...time, weekendStartDay })} />
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Label>每天的名字</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {time.dayNames.map((name, index) => (
                <Input key={index} aria-label={`第${index + 1}天`} value={name} onChange={(event) => onTime({ ...time, dayNames: time.dayNames.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>时段</Label>
            <Button type="button" variant="outline" onClick={() => onTime({ ...time, timeSlots: [...time.timeSlots, { name: '新时段', startTime: time.dayStartTime }] })}>
              <Plus data-icon="inline-start" />添加时段
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead className="w-40">开始时间</TableHead>
                <TableHead className="w-28">显示</TableHead>
                <TableHead className="w-16 text-right">删除</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {time.timeSlots.map((slot, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input aria-label={`时段${index + 1}名称`} value={slot.name} onChange={(event) => onTime({ ...time, timeSlots: time.timeSlots.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} />
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`时段${index + 1}开始`} type="number" step="0.01" value={slot.startTime} onChange={(event) => onTime({ ...time, timeSlots: time.timeSlots.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: Number(event.target.value) } : item) })} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatNqtrTime(slot.startTime)}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="icon-xs" variant="ghost" aria-label="删除时段" disabled={time.timeSlots.length <= 1} onClick={() => onTime({ ...time, timeSlots: time.timeSlots.filter((_, itemIndex) => itemIndex !== index) })}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div>
            <Button disabled={saving} onClick={onSave}>{saving ? '保存中…' : '保存设定'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function NumberField({ label, value, min, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input type="number" step="0.01" min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}
