import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit3, MapPin, SmilePlus, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  listCharacters, createCharacter, updateCharacter, deleteCharacter,
  type GameCharacter,
} from '../api-content-admin'
import { ImageUploadField } from './image-upload-field'

/** 支持的立绘表情类型 */
const EXPRESSION_PRESETS = ['default', 'happy', 'sad', 'angry', 'surprised', 'thinking', 'shy', 'confident']

interface ExpressionEntry {
  name: string
  url: string
}

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
  const [expressions, setExpressions] = useState<ExpressionEntry[]>([])

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
    setExpressions([{ name: 'default', url: '' }])
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
    // Parse expressions from JSON
    const exps: ExpressionEntry[] = []
    if (item.expressions && typeof item.expressions === 'object') {
      for (const [k, v] of Object.entries(item.expressions as Record<string, string>)) {
        exps.push({ name: k, url: v as string })
      }
    }
    if (exps.length === 0) exps.push({ name: 'default', url: item.spriteBaseUrl ?? '' })
    setExpressions(exps)
    setDialogOpen(true)
  }

  const addExpression = () => {
    setExpressions([...expressions, { name: '', url: '' }])
  }

  const removeExpression = (index: number) => {
    setExpressions(expressions.filter((_, i) => i !== index))
  }

  const updateExpression = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...expressions]
    updated[index] = { ...updated[index], [field]: value }
    setExpressions(updated)
  }

  const save = async () => {
    if (!name || !displayName || !role) {
      toast.error('名称、显示名和角色描述必填')
      return
    }
    setSaving(true)
    try {
      // Convert expressions array to JSON object
      const expressionsObj: Record<string, string> = {}
      for (const exp of expressions) {
        if (exp.name && exp.url) {
          expressionsObj[exp.name] = exp.url
        }
      }
      // If no expressions defined, use default from spriteBaseUrl
      if (Object.keys(expressionsObj).length === 0 && spriteBaseUrl) {
        expressionsObj['default'] = spriteBaseUrl
      }

      const data = {
        name, displayName, role, personality, defaultPosition,
        avatarUrl, spriteBaseUrl,
        expressions: Object.keys(expressionsObj).length > 0 ? expressionsObj : undefined,
      }
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
                  {item.expressions && typeof item.expressions === 'object' && (
                    <Badge variant="outline" className="text-[10px]">
                      <SmilePlus className="mr-0.5 size-2.5" />
                      {Object.keys(item.expressions as object).length} 个表情
                    </Badge>
                  )}
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
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? '编辑角色' : '新建角色'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            </div>

            <Separator />

            {/* Avatar upload */}
            <div>
              <Label className="text-xs font-semibold">头像</Label>
              <ImageUploadField
                value={avatarUrl}
                onChange={setAvatarUrl}
                placeholder="输入头像 URL 或上传"
                previewSize="md"
              />
            </div>

            {/* Default sprite upload */}
            <div>
              <Label className="text-xs font-semibold">默认立绘</Label>
              <ImageUploadField
                value={spriteBaseUrl}
                onChange={setSpriteBaseUrl}
                placeholder="输入立绘 URL 或上传（Ink 中 #expression:default 使用此图）"
                previewSize="lg"
              />
            </div>

            <Separator />

            {/* Expression Manager */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold">表情立绘管理</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={addExpression}
                >
                  <SmilePlus className="size-3" />
                  添加表情
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                在 Ink 脚本中使用 <code className="rounded bg-muted px-1 text-[11px]">#expression:happy</code> 标签切换表情。
                预设表情：{EXPRESSION_PRESETS.join(', ')}
              </p>

              {expressions.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">暂无表情配置，将使用默认立绘</p>
              ) : (
                <div className="space-y-3">
                  {expressions.map((exp, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={exp.name}
                            onChange={(e) => updateExpression(i, 'name', e.target.value)}
                            placeholder="表情名 (如 happy)"
                            className="h-7 text-xs w-28"
                            list="expression-presets"
                          />
                          <datalist id="expression-presets">
                            {EXPRESSION_PRESETS.map((p) => (
                              <option key={p} value={p} />
                            ))}
                          </datalist>
                          <span className="text-[11px] text-muted-foreground">
                            Ink 标签: <code className="rounded bg-muted px-1">#expression:{exp.name || '?'}</code>
                          </span>
                        </div>
                        <ImageUploadField
                          value={exp.url}
                          onChange={(url) => updateExpression(i, 'url', url)}
                          placeholder={exp.name === 'default' ? '默认立绘 URL' : `${exp.name || '表情'} 立绘 URL`}
                          previewSize="md"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 mt-1"
                        onClick={() => removeExpression(i)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
