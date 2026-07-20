import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Edit3, MapPin, SmilePlus, Volume2, Loader2, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  listCharacters, createCharacter, updateCharacter, deleteCharacter,
  listTtsVoices, saveCharacterVoiceBinding, deleteCharacterVoiceBinding,
  type GameCharacter, type TtsVoiceAsset,
} from '../api-content-admin'
import { synthesizeText } from '@/lib/tts-api'
import type { TtsProviderKey } from '@/lib/tts-api'
import { ImageUploadField } from './image-upload-field'

/** 支持的立绘表情类型 */
const EXPRESSION_PRESETS = ['default', 'happy', 'sad', 'angry', 'surprised', 'thinking', 'shy', 'confident']

interface ExpressionEntry {
  name: string
  url: string
}

function buildCharacterKey(displayName: string, existingNames: string[]) {
  const base = displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `character_${Date.now().toString(36)}`
  let candidate = base
  let suffix = 2
  while (existingNames.includes(candidate)) candidate = `${base}_${suffix++}`
  return candidate
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
  const [avatarUrl, setAvatarUrl] = useState('')
  const [expressions, setExpressions] = useState<ExpressionEntry[]>([])

  // Voice asset reference
  const [voiceAssets, setVoiceAssets] = useState<TtsVoiceAsset[]>([])
  const [voiceAssetId, setVoiceAssetId] = useState('')
  const [voiceModel, setVoiceModel] = useState('')

  // Voice test
  const [testText, setTestText] = useState('')
  const [testing, setTesting] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [dialogTab, setDialogTab] = useState('basic')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, voices] = await Promise.all([listCharacters(), listTtsVoices()])
      setItems(data)
      setVoiceAssets(voices.filter((voice) => voice.isAvailable))
      onCharactersChange?.(data)
    } catch { toast.error('加载角色失败') }
    finally { setLoading(false) }
  }, [onCharactersChange])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditItem(null)
    setName(''); setDisplayName(''); setRole(''); setPersonality('')
    setAvatarUrl('')
    setExpressions([{ name: 'default', url: '' }])
    setVoiceAssetId(''); setVoiceModel('')
    setTestText(''); setAudioUrl(null); setDialogTab('basic')
    setDialogOpen(true)
  }

  const openEdit = (item: GameCharacter) => {
    setEditItem(item)
    setName(item.name)
    setDisplayName(item.displayName)
    setRole(item.role)
    setPersonality(item.personality ?? '')
    setAvatarUrl(item.avatarUrl ?? '')
    // Parse expressions from JSON
    const exps: ExpressionEntry[] = []
    if (item.expressions && typeof item.expressions === 'object') {
      for (const [k, v] of Object.entries(item.expressions as Record<string, string>)) {
        exps.push({ name: k, url: v as string })
      }
    }
    if (!exps.some((exp) => exp.name === 'default')) {
      exps.unshift({ name: 'default', url: item.spriteBaseUrl ?? '' })
    }
    setExpressions(exps)

    const defaultBinding = item.voiceBindings?.find((binding) => binding.isDefault) ?? item.voiceBindings?.[0]
    setVoiceAssetId(defaultBinding?.voiceAssetId ?? '')
    setVoiceModel(defaultBinding?.model ?? '')
    setTestText(''); setAudioUrl(null); setDialogTab('basic')
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
    if (!displayName || !role) {
      toast.error('显示名称和角色描述必填')
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
      const resolvedName = editItem?.name || name || buildCharacterKey(displayName, items.map((item) => item.name))
      const data = {
        name: resolvedName, displayName, role, personality, avatarUrl,
        // Keep the legacy field in sync for clients that still use it as a fallback.
        spriteBaseUrl: expressionsObj.default ?? null,
        expressions: expressionsObj,
      }
      let savedCharacter: GameCharacter
      if (editItem) {
        savedCharacter = await updateCharacter(editItem.id, data)
        toast.success('角色已更新')
      } else {
        savedCharacter = await createCharacter(data)
        toast.success('角色已创建')
      }
      if (voiceAssetId) {
        await saveCharacterVoiceBinding(savedCharacter.id, { voiceAssetId, model: voiceModel || undefined, isDefault: true })
      }
      setDialogOpen(false)
      load()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  const testVoice = async () => {
    if (!testText.trim()) {
      toast.error('请输入测试文本')
      return
    }
    setTesting(true)
    setAudioUrl(null)
    try {
      const selectedVoice = voiceAssets.find((voice) => voice.id === voiceAssetId)
      if (!selectedVoice) throw new Error('请先选择音色资产')
      const result = await synthesizeText({
        text: testText.trim(),
        provider: selectedVoice.provider.provider as TtsProviderKey,
        model: voiceModel || selectedVoice.provider.model,
        voiceId: selectedVoice.externalVoiceId,
      })
      // Create blob URL from base64
      const byteChars = atob(result.audioBase64)
      const byteNums = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i)
      }
      const byteArr = new Uint8Array(byteNums)
      const blob = new Blob([byteArr], { type: result.mimeType })
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      toast.success('合成成功，点击播放按钮试听')
    } catch (e: any) {
      toast.error(e?.message || '语音合成失败')
    } finally {
      setTesting(false)
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const removeVoiceBinding = async (bindingId: string) => {
    if (!editItem) return
    try {
      await deleteCharacterVoiceBinding(editItem.id, bindingId)
      const next = items.find((item) => item.id === editItem.id)?.voiceBindings?.filter((binding) => binding.id !== bindingId) ?? []
      setEditItem({ ...editItem, voiceBindings: next })
      if (!next.some((binding) => binding.voiceAssetId === voiceAssetId)) setVoiceAssetId('')
      await load()
      toast.success('已解除音色引用')
    } catch { toast.error('解除音色引用失败') }
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
                  {item.expressions && typeof item.expressions === 'object' && (
                    <Badge variant="outline" className="text-[10px]">
                      <SmilePlus className="mr-0.5 size-2.5" />
                      {Object.keys(item.expressions as object).length} 个表情
                    </Badge>
                  )}
                  {item.roomNpcs?.length ? (
                    <Badge variant="outline" className="text-[10px]">
                      <MapPin className="mr-0.5 size-2.5" />
                      {item.roomNpcs.length} 个房间
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

          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="basic" className="flex-1">基本信息</TabsTrigger>
              <TabsTrigger value="voice" className="flex-1 gap-1.5">
                <Volume2 className="size-3.5" />
                音色配置
              </TabsTrigger>
            </TabsList>

            {/* Tab: 基本信息 */}
            <TabsContent value="basic" className="space-y-4">
              <div>
                <Label>显示名称</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：Alex / 小满" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">角色 Key（自动生成）</Label>
                <Input value={editItem?.name || (/[a-z0-9]/i.test(displayName) ? buildCharacterKey(displayName, items.map((item) => item.name)) : 'character_…（保存时生成）')} readOnly className="mt-1 bg-muted/40 font-mono text-xs text-muted-foreground" />
                <p className="mt-1 text-[11px] text-muted-foreground">创建后保持不变，用于 Ink 角色引用。</p>
              </div>
              <div>
                <Label>角色描述</Label>
                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="室友，大一新生，友好健谈" />
              </div>
              <div>
                <Label>性格 (AI prompt 用)</Label>
                <Input value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="friendly, curious about your culture" />
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
                  group="avatar"
                />
              </div>

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
                  <p className="text-xs text-muted-foreground/60 italic">暂无表情配置，请添加 default 表情作为默认立绘</p>
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
            </TabsContent>

            {/* Tab: 音色配置 */}
            <TabsContent value="voice" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                从全局音色资产库为角色选择音色。Voice ID 与厂商参数由音色资产统一维护。
              </p>

              {editItem?.voiceBindings?.length ? <div className="space-y-2"><Label className="text-xs font-semibold">已引用音色</Label>{editItem.voiceBindings.map((binding) => <div key={binding.id} className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3"><div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><Volume2 className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{binding.voiceAsset.displayName}</p><p className="truncate text-[11px] text-muted-foreground">{binding.voiceAsset.provider.label} · {binding.model || binding.voiceAsset.provider.model}</p></div>{binding.isDefault && <Badge variant="secondary">默认</Badge>}<Button type="button" variant="ghost" size="icon" className="size-8" aria-label="解除音色引用" onClick={() => void removeVoiceBinding(binding.id)}><Trash2 className="size-3.5 text-destructive" /></Button></div>)}</div> : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>引用音色资产</Label><select value={voiceAssetId} onChange={(e) => { setVoiceAssetId(e.target.value); setVoiceModel('') }} className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">暂不配置音色</option>{voiceAssets.map((voice) => <option key={voice.id} value={voice.id}>{voice.provider.label} · {voice.displayName}</option>)}</select><p className="mt-1 text-[11px] text-muted-foreground">请先在“剧情共享资产 → 音色资产”添加厂商音色。</p></div>
                <div className="sm:col-span-2"><Label>模型覆盖（可选）</Label><Input value={voiceModel} onChange={(e) => setVoiceModel(e.target.value)} placeholder={voiceAssets.find((voice) => voice.id === voiceAssetId)?.provider.model || '留空使用厂商默认模型'} /><p className="mt-1 text-[11px] text-muted-foreground">一般保持为空；只有该角色必须使用特定模型时才覆盖。</p></div>
              </div>

              <Separator />

              {/* Test area */}
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">音色测试</p>
                <p className="text-xs text-muted-foreground">
                  输入测试文本，点击试听按钮测试当前音色配置效果。
                </p>
                <div className="flex gap-2">
                  <Input
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="输入测试文本，如：Hello! How are you today?"
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === 'Enter') testVoice() }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testVoice}
                    disabled={testing || !testText.trim() || !voiceAssetId}
                    className="shrink-0 gap-1.5"
                  >
                    {testing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    {testing ? '合成中…' : '试听'}
                  </Button>
                </div>
                {audioUrl && (
                  <div className="flex items-center gap-2">
                    <audio ref={audioRef} src={audioUrl} controls className="h-8 flex-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="停止播放"
                      onClick={stopAudio}
                    >
                      <Square className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="pt-2">
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
