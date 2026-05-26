import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit3, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  listCharacters, createCharacter, updateCharacter, deleteCharacter,
  type GameCharacter,
} from '../api-content-admin'

interface CharactersTabProps {
  /** 当角色列表变化时回调，供故事工坊刷新绑定选项 */
  onCharactersChange?: (characters: GameCharacter[]) => void
}

export function CharactersTab({ onCharactersChange }: CharactersTabProps) {
  const [items, setItems] = useState<GameCharacter[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<GameCharacter | null>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('')
  const [personality, setPersonality] = useState('')
  const [defaultPosition, setDefaultPosition] = useState('left')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [spriteBaseUrl, setSpriteBaseUrl] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listCharacters()
      setItems(data)
      onCharactersChange?.(data)
    } catch { toast.error('加载角色失败') }
    finally { setLoading(false) }
  }, [onCharactersChange])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditItem(null)
    setName(''); setDisplayName(''); setRole(''); setPersonality('')
    setDefaultPosition('left'); setAvatarUrl(''); setSpriteBaseUrl('')
    setDialogOpen(true)
  }

  const openEdit = (item: GameCharacter) => {
    setEditItem(item)
    setName(item.name)
    setDisplayName(item.displayName)
    setRole(item.role)
    setPersonality(item.personality ?? '')
    setDefaultPosition(item.defaultPosition ?? 'left')
    setAvatarUrl(item.avatarUrl ?? '')
    setSpriteBaseUrl(item.spriteBaseUrl ?? '')
    setDialogOpen(true)
  }

  const save = async () => {
    if (!name || !displayName || !role) {
      toast.error('名称、显示名和角色描述必填')
      return
    }
    setSaving(true)
    try {
      const data = { name, displayName, role, personality, defaultPosition, avatarUrl, spriteBaseUrl }
      if (editItem) {
        await updateCharacter(editItem.id, data)
        toast.success('角色已更新')
      } else {
        await createCharacter(data)
        toast.success('角色已创建')
      }
      setDialogOpen(false)
      load()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  const remove = async (item: GameCharacter) => {
    if (!confirm(`确定删除角色 "${item.displayName}"？此操作不可撤销。`)) return
    try {
      await deleteCharacter(item.id)
      toast.success('已删除')
      load()
    } catch { toast.error('删除失败') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            管理 NPC 角色，每个角色可在故事对话中使用。共 {items.length} 个角色。
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />新建角色
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <p className="text-sm text-muted-foreground">暂无角色</p>
          <p className="mt-1 text-xs text-muted-foreground/60">点击「新建角色」开始创建</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="transition-colors hover:border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {item.avatarUrl ? (
                      <img src={item.avatarUrl} alt={item.displayName} className="size-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {item.displayName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{item.displayName}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{item.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(item)}>
                      <Edit3 className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(item)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{item.role}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {item.personality && (
                    <Badge variant="outline" className="text-[10px]">{item.personality}</Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">位置: {item.defaultPosition ?? 'left'}</Badge>
                  {item.locationNpcs?.length ? (
                    <Badge variant="outline" className="text-[10px]">
                      <MapPin className="mr-0.5 size-2.5" />
                      {item.locationNpcs.length} 个地点
                    </Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? '编辑角色' : '新建角色'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>英文名 (key)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="alex" />
              </div>
              <div>
                <Label>显示名称</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex" />
              </div>
            </div>
            <div>
              <Label>角色描述</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="室友，大一新生，友好健谈" />
            </div>
            <div>
              <Label>性格 (AI prompt 用)</Label>
              <Input value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="friendly, curious about your culture" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>立绘位置</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={defaultPosition}
                  onChange={(e) => setDefaultPosition(e.target.value)}
                >
                  <option value="left">左</option>
                  <option value="center">中</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div>
                <Label>头像 URL</Label>
                <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div>
              <Label>立绘 URL</Label>
              <Input value={spriteBaseUrl} onChange={(e) => setSpriteBaseUrl(e.target.value)} placeholder="https://..." />
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
