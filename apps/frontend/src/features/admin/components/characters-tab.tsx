import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Edit3, MapPin, Layers3, Volume2, Loader2, Play, Square, UserCircle, Eye, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
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
import { VnPlayer } from '@/features/vn-engine/vn-player'
import { cn } from '@/lib/cn'

/** 支持的角色状态预设 */
const EXPRESSION_PRESETS = ['default', 'happy', 'sad', 'angry', 'surprised', 'thinking', 'shy', 'confident']

interface ExpressionEntry {
  name: string
  spriteUrl: string
  avatarUrl: string
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
  const [previewStateIndex, setPreviewStateIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewBackgroundUrl, setPreviewBackgroundUrl] = useState('')
  const [previewDialogue, setPreviewDialogue] = useState('你好，很高兴在这里见到你。')

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
    setName(''); setDisplayName(''); setRole('')
    setAvatarUrl('')
    setExpressions([{ name: 'default', spriteUrl: '', avatarUrl: '' }])
    setVoiceAssetId(''); setVoiceModel('')
    setTestText(''); setAudioUrl(null); setDialogTab('basic'); setPreviewStateIndex(0)
    setDialogOpen(true)
  }

  const openEdit = (item: GameCharacter) => {
    setEditItem(item)
    setName(item.name)
    setDisplayName(item.displayName)
    setRole(item.role)
    setAvatarUrl(item.avatarUrl ?? '')
    // Parse expressions from JSON
    const exps: ExpressionEntry[] = []
    if (item.expressions && typeof item.expressions === 'object') {
      for (const [k, value] of Object.entries(item.expressions as Record<string, unknown>)) {
        if (typeof value === 'string') {
          exps.push({ name: k, spriteUrl: value, avatarUrl: '' })
        } else if (value && typeof value === 'object') {
          const state = value as { spriteUrl?: string; avatarUrl?: string }
          exps.push({ name: k, spriteUrl: state.spriteUrl ?? '', avatarUrl: state.avatarUrl ?? '' })
        }
      }
    }
    if (!exps.some((exp) => exp.name === 'default')) {
      exps.unshift({ name: 'default', spriteUrl: item.spriteBaseUrl ?? '', avatarUrl: item.avatarUrl ?? '' })
    }
    setExpressions(exps)

    const defaultBinding = item.voiceBindings?.find((binding) => binding.isDefault) ?? item.voiceBindings?.[0]
    setVoiceAssetId(defaultBinding?.voiceAssetId ?? '')
    setVoiceModel(defaultBinding?.model ?? '')
    setTestText(''); setAudioUrl(null); setDialogTab('basic'); setPreviewStateIndex(0)
    setDialogOpen(true)
  }

  const addExpression = () => {
    setExpressions([...expressions, { name: '', spriteUrl: '', avatarUrl: '' }])
  }

  const removeExpression = (index: number) => {
    setExpressions(expressions.filter((_, i) => i !== index))
    setPreviewStateIndex((current) => Math.max(0, Math.min(current, expressions.length - 2)))
  }

  const updateExpression = (index: number, field: keyof ExpressionEntry, value: string) => {
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
      const expressionsObj: Record<string, { spriteUrl: string; avatarUrl?: string }> = {}
      for (const exp of expressions) {
        if (exp.name && (exp.spriteUrl || exp.avatarUrl)) {
          expressionsObj[exp.name] = {
            spriteUrl: exp.spriteUrl,
            ...(exp.avatarUrl ? { avatarUrl: exp.avatarUrl } : {}),
          }
        }
      }
      const resolvedName = editItem?.name || name || buildCharacterKey(displayName, items.map((item) => item.name))
      const data = {
        name: resolvedName, displayName, role, avatarUrl,
        // Keep the legacy field in sync for clients that still use it as a fallback.
        spriteBaseUrl: expressionsObj.default?.spriteUrl ?? null,
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
            <Card key={item.id} className="transition-colors hover:bg-muted/20">
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
                  {item.expressions && typeof item.expressions === 'object' && (
                    <Badge variant="outline" className="text-[10px]">
                      <Layers3 className="mr-0.5 size-2.5" />
                      {Object.keys(item.expressions as object).length} 个状态
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
        <DialogContent className="h-[88vh] w-[calc(100vw-32px)] max-w-[1180px] overflow-hidden p-0">
          <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="hidden min-h-0 flex-col border-r bg-muted/20 md:flex">
              <div className="border-b px-5 py-4">
                <DialogTitle className="text-base">{editItem ? '编辑角色' : '新建角色'}</DialogTitle>
                <DialogDescription className="mt-1 text-xs">角色设定、视觉资产与声音配置</DialogDescription>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
                    {avatarUrl ? <img src={avatarUrl} alt="角色头像预览" className="size-full object-cover" /> : <UserCircle className="size-8" />}
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="truncate text-lg font-semibold">{displayName || '未命名角色'}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {editItem?.name || (/[a-z0-9]/i.test(displayName) ? buildCharacterKey(displayName, items.map((item) => item.name)) : '保存时生成 Key')}
                    </p>
                    <Badge variant="secondary" className="mt-2 text-[10px]">全局角色资产</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-background px-3 py-2.5"><p className="text-[11px] text-muted-foreground">角色状态</p><p className="mt-1 text-xl font-bold text-amber-500">{expressions.length}</p></div>
                  <div className="rounded-lg bg-background px-3 py-2.5"><p className="text-[11px] text-muted-foreground">音色绑定</p><p className="mt-1 text-xl font-bold text-emerald-500">{editItem?.voiceBindings?.length || (voiceAssetId ? 1 : 0)}</p></div>
                </div>
                <div className="rounded-lg bg-background px-3 py-3">
                  <p className="text-xs font-medium">角色定位</p>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{role || '还未填写角色描述'}</p>
                </div>
                <div className="rounded-lg border border-dashed px-3 py-3 text-xs leading-5 text-muted-foreground">
                  角色资产可被多个剧情包复用。角色 Key 创建后固定，剧情中可按状态切换对应的立绘和头像。
                </div>
              </div>
              <div className="border-t p-4">
                <Button className="w-full" onClick={save} disabled={saving || !displayName.trim() || !role.trim()}>
                  {saving ? '保存中…' : editItem ? '保存角色修改' : '创建角色'}
                </Button>
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <DialogHeader className="border-b px-5 py-4 md:hidden">
                <DialogTitle>{editItem ? '编辑角色' : '新建角色'}</DialogTitle>
                <DialogDescription>角色设定、视觉资产与声音配置</DialogDescription>
              </DialogHeader>
              <Tabs value={dialogTab} onValueChange={setDialogTab} className="flex min-h-0 flex-1 flex-col">
                <div className="border-b px-5 py-3">
                  <TabsList className="grid w-full max-w-xl grid-cols-3">
                    <TabsTrigger value="basic">基础设定</TabsTrigger>
                    <TabsTrigger value="expressions" className="gap-1.5"><Layers3 className="size-3.5" />角色状态</TabsTrigger>
                    <TabsTrigger value="voice" className="gap-1.5"><Volume2 className="size-3.5" />音色配置</TabsTrigger>
                  </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  <TabsContent value="basic" className="m-0 space-y-5">
                    <div><h3 className="text-sm font-semibold">角色身份</h3><p className="mt-1 text-xs text-muted-foreground">用于后台识别、剧情引用和 AI 对话生成。</p></div>
                    <div className="grid gap-4">
                      <div><Label>显示名称</Label><Input className="mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：Alex / 小满" /></div>
                      <div className="sm:col-span-2"><Label>角色描述</Label><Input className="mt-1" value={role} onChange={(e) => setRole(e.target.value)} placeholder="室友，大一新生，友好健谈" /><p className="mt-1 text-[11px] text-muted-foreground">简短说明角色的身份、关系和剧情职能。</p></div>
                    </div>
                    <Separator />
                    <div><h3 className="text-sm font-semibold">头像资产</h3><p className="mt-1 text-xs text-muted-foreground">用于角色列表、对话头像和后台识别。</p></div>
                    <ImageUploadField value={avatarUrl} onChange={setAvatarUrl} placeholder="输入头像 URL 或上传" previewSize="md" group="avatar" />
                  </TabsContent>

                  <TabsContent value="expressions" className="m-0 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div><h3 className="text-sm font-semibold">角色状态</h3><p className="mt-1 text-xs text-muted-foreground">每个状态对应一套场景立绘和对话头像，剧情播放时按当前状态切换。</p></div>
                      <div className="flex shrink-0 gap-2">
                        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!expressions.length} onClick={() => setPreviewOpen(true)}><Eye className="size-3.5" />预览角色</Button>
                        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addExpression}><Layers3 className="size-3.5" />添加状态</Button>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">每个状态可分别配置场景立绘和对话头像；头像未配置时使用角色默认头像。可用预设：{EXPRESSION_PRESETS.join(' · ')}</div>
                    <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold">已配置 {expressions.length} 个状态</Label>
                </div>
                {expressions.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-16 text-center"><Layers3 className="mx-auto size-8 text-muted-foreground/40" /><p className="mt-3 text-sm text-muted-foreground">暂无角色状态</p><p className="mt-1 text-xs text-muted-foreground/60">建议先添加 default 作为默认状态</p></div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {expressions.map((exp, i) => (
                      <div key={i} className={cn('cursor-pointer rounded-xl border bg-muted/20 p-3 transition-colors', i === previewStateIndex ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border hover:border-primary/30')} onClick={() => setPreviewStateIndex(i)}>
                        <div className="flex items-center gap-2 border-b pb-3">
                            <Input
                              value={exp.name}
                              onChange={(e) => updateExpression(i, 'name', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="状态名（如 happy）"
                              className="h-8 min-w-0 flex-1 text-xs"
                              list="expression-presets"
                            />
                            <datalist id="expression-presets">
                              {EXPRESSION_PRESETS.map((p) => (
                                <option key={p} value={p} />
                              ))}
                            </datalist>
                            <code className="hidden rounded bg-muted px-1.5 py-1 text-[10px] text-muted-foreground sm:block">#{exp.name || '?'}</code>
                            <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={(e) => { e.stopPropagation(); removeExpression(i) }}><Trash2 className="size-3.5 text-destructive" /></Button>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="min-w-0"><Label className="text-[11px] text-muted-foreground">场景立绘</Label><div className="mt-1"><ImageUploadField value={exp.spriteUrl} onChange={(url) => updateExpression(i, 'spriteUrl', url)} placeholder="上传立绘" previewSize="md" overlayUpload /></div></div>
                          <div className="min-w-0"><Label className="text-[11px] text-muted-foreground">对话头像（可选）</Label><div className="mt-1"><ImageUploadField value={exp.avatarUrl} onChange={(url) => updateExpression(i, 'avatarUrl', url)} placeholder="上传头像" previewSize="md" group="avatar" overlayUpload /></div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                  </TabsContent>

            {/* Tab: 音色配置 */}
            <TabsContent value="voice" className="m-0 space-y-5">
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
                </div>
              </Tabs>
              <div className="border-t p-4 md:hidden"><Button className="w-full" onClick={save} disabled={saving || !displayName.trim() || !role.trim()}>{saving ? '保存中…' : editItem ? '保存角色修改' : '创建角色'}</Button></div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[86vh] w-[calc(100vw-32px)] max-w-[1120px] overflow-hidden p-0">
          {expressions.length > 0 && (() => {
            const activeIndex = Math.min(previewStateIndex, expressions.length - 1)
            const activeState = expressions[activeIndex]
            const previewLine = { speaker: displayName || '角色名称', text: previewDialogue || '输入一句预览台词' }
            return (
              <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)]">
                <aside className="flex min-h-0 flex-col border-r bg-muted/20">
                  <div className="border-b px-5 py-4">
                    <DialogTitle className="text-base">角色状态预览</DialogTitle>
                    <DialogDescription className="mt-1 text-xs">切换状态，检查立绘与对话头像的组合效果</DialogDescription>
                  </div>
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2">
                      <GitBranch className="size-4 text-primary" />
                      <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">currentState</p><p className="truncate font-mono text-sm font-semibold text-primary">{activeState.name || `state_${activeIndex + 1}`}</p></div>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">状态树</p>
                    <div className="relative space-y-1.5 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
                      {expressions.map((state, index) => (
                        <button key={`${state.name}-${index}`} type="button" onClick={() => setPreviewStateIndex(index)} className={cn('relative flex w-full items-center gap-3 rounded-lg border px-2.5 py-2.5 text-left transition-colors', index === activeIndex ? 'border-primary/40 bg-primary/10' : 'border-transparent hover:bg-background')}>
                          <span className={cn('relative z-10 size-2.5 shrink-0 rounded-full ring-4', index === activeIndex ? 'bg-primary ring-primary/15' : 'bg-muted-foreground/35 ring-muted')} />
                          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                            {state.avatarUrl || state.spriteUrl ? <img src={state.avatarUrl || state.spriteUrl} alt="" className="size-full object-cover" /> : <Layers3 className="size-4 text-muted-foreground/40" />}
                          </div>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{state.name || `状态 ${index + 1}`}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{state.spriteUrl ? '有立绘' : '无立绘'} · {state.avatarUrl ? '有头像' : '默认头像'}</p></div>
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>

                <section className="flex min-h-0 flex-col bg-background">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b px-5 py-3">
                    <div><Label className="text-xs">预览台词</Label><Input className="mt-1" value={previewDialogue} onChange={(e) => setPreviewDialogue(e.target.value)} placeholder="输入角色台词" /></div>
                    <div><Label className="text-xs">场景背景</Label><div className="mt-1"><ImageUploadField value={previewBackgroundUrl} onChange={setPreviewBackgroundUrl} placeholder="上传背景" previewSize="sm" overlayUpload /></div></div>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/20 p-5">
                    <VnPlayer
                      className="aspect-[9/16] h-full max-h-[680px] w-auto max-w-full overflow-hidden shadow-xl"
                      frameVariant="portrait"
                      backgroundUrl={previewBackgroundUrl || undefined}
                      currentLine={previewLine}
                      history={[previewLine]}
                      currentSpriteUrl={activeState.spriteUrl || undefined}
                      spriteAlt={displayName || '角色立绘'}
                      spritePosition="center"
                      currentAvatarUrl={activeState.avatarUrl || avatarUrl || undefined}
                      currentAvatarAlt={displayName || '角色头像'}
                      showHistoryButton={false}
                    />
                  </div>
                </section>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
