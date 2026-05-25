import { useState } from 'react'
import { Download, Upload, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { GameSave } from '../api/explore-api'
import { gameSaveApi } from '../api/explore-api'
import { cn } from '@/lib/cn'

interface SaveLoadPanelProps {
  currentSlot: number
  saves: GameSave[]
  onSave: (slot: number) => void
  onLoad: (slot: number) => void
  onRefresh: () => void
}

/** 存档/读档面板 */
export function SaveLoadPanel({ currentSlot, saves, onSave, onLoad, onRefresh }: SaveLoadPanelProps) {
  const [mode, setMode] = useState<'save' | 'load'>('save')
  const [saving, setSaving] = useState(false)

  const handleSave = async (slot: number) => {
    setSaving(true)
    await onSave(slot)
    onRefresh()
    setSaving(false)
  }

  const handleDelete = async (slot: number) => {
    try { await gameSaveApi.delete(slot); onRefresh() } catch {}
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-2">
          <Button
            variant={mode === 'save' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-1"
            onClick={() => setMode('save')}
          >
            <Save className="size-3.5" /> 存档
          </Button>
          <Button
            variant={mode === 'load' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-1"
            onClick={() => setMode('load')}
          >
            <Download className="size-3.5" /> 读档
          </Button>
        </div>

        <div className="space-y-1.5">
          {[1, 2, 3].map((slot) => {
            const existing = saves.find((s) => s.slot === slot)
            const isCurrent = currentSlot === slot
            return (
              <div
                key={slot}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-2',
                  isCurrent ? 'border-primary/50 bg-primary/5' : 'border-border',
                )}
              >
                <Badge variant={isCurrent ? 'default' : 'outline'} className="shrink-0">
                  {slot}
                </Badge>
                <div className="min-w-0 flex-1">
                  {existing ? (
                    <>
                      <p className="truncate text-xs font-medium text-foreground">{existing.saveName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {existing.playTimeSeconds}s · {new Date(existing.updatedAt).toLocaleDateString()}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">空槽位</p>
                  )}
                </div>
                {mode === 'save' ? (
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => handleSave(slot)}>
                    <Save className="size-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" disabled={!existing} onClick={() => onLoad(slot)}>
                    <Download className="size-3.5" />
                  </Button>
                )}
                {existing && (
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(slot)}>
                    <Trash2 className="size-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
