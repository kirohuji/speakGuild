import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Edit3, MapPin, SmilePlus, Volume2, Loader2, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  listCharacters, createCharacter, updateCharacter, deleteCharacter,
  type GameCharacter,
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

  // Voice config
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsModel, setTtsModel] = useState('speech-2.8-hd')
  const [ttsSpeed, setTtsSpeed] = useState(1)
  const [ttsPitch, setTtsPitch] = useState(0)
  const [ttsVol, setTtsVol] = useState(1)

  // Voice test
  const [testText, setTestText] = useState('')
  const [testing, setTesting] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [dialogTab, setDialogTab] = useState('basic')

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
    setAvatarUrl('')
    setExpressions([{ name: 'default', url: '' }])
    setTtsVoice(''); setTtsModel('speech-2.8-hd')
    setTtsSpeed(1); setTtsPitch(0); setTtsVol(1)
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

    // Voice config
    setTtsVoice(item.ttsVoice ?? '')
    setTtsModel(item.ttsModel ?? 'speech-2.8-hd')
    const params = item.ttsParams
    setTtsSpeed(typeof params?.speed === 'number' ? params.speed : 1)
    setTtsPitch(typeof params?.pitch === 'number' ? params.pitch : 0)
    setTtsVol(typeof params?.vol === 'number' ? params.vol : 1)
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
      const data = {
        name, displayName, role, personality, avatarUrl,
        // Keep the legacy field in sync for clients that still use it as a fallback.
        spriteBaseUrl: expressionsObj.default ?? null,
        expressions: expressionsObj,
        // Voice config
        ttsVoice: ttsVoice || null,
        ttsModel: ttsModel || null,
        ttsParams: { speed: ttsSpeed, pitch: ttsPitch, vol: ttsVol },
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

  const testVoice = async () => {
    if (!testText.trim()) {
      toast.error('请输入测试文本')
      return
    }
    setTesting(true)
    setAudioUrl(null)
    try {
      const result = await synthesizeText({
        text: testText.trim(),
        provider: 'minimax' as TtsProviderKey,
        model: ttsModel || 'speech-2.8-hd',
        voiceId: ttsVoice || undefined,
        params: { speed: ttsSpeed, pitch: ttsPitch, vol: ttsVol },
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
                为此角色配置 MiniMax TTS 音色，用于故事对话中的语音合成。
              </p>

              {/* Voice ID */}
              <div>
                <Label className="text-xs font-semibold">音色 ID (Voice ID)</Label>
                <Input
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  placeholder="如 female-chengshu 或 English_Trustworthy_Man"
                  className="mt-1"
                  list="minimax-voices"
                />
                <datalist id="minimax-voices">
                  <option value="female-chengshu" >成熟女声 (female-chengshu)</option>
                  <option value="female-shaonv" >少女 (female-shaonv)</option>
                  <option value="male-qingse" >青年男声 (male-qingse)</option>
                  <option value="male-shuoye" >说业男声 (male-shuoye)</option>
                  <option value="English_Trustworthy_Man" >English Trustworthy Man</option>
                  <option value="English_Elegant_Woman" >English Elegant Woman</option>
                  <option value="English_Young_Male" >English Young Male</option>
                  <option value="English_Young_Female" >English Young Female</option>
                </datalist>
                <p className="text-[11px] text-muted-foreground mt-1">
                  留空则由系统根据文本语言自动选择默认音色
                </p>
              </div>

              {/* Model */}
              <div>
                <Label className="text-xs font-semibold">TTS 模型</Label>
                <select
                  value={ttsModel}
                  onChange={(e) => setTtsModel(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="speech-2.8-hd">speech-2.8-hd (高清)</option>
                  <option value="speech-2.8-turbo">speech-2.8-turbo (高速)</option>
                  <option value="speech-02-hd">speech-02-hd (高清 v2)</option>
                  <option value="speech-02-turbo">speech-02-turbo (高速 v2)</option>
                  <option value="speech-01-hd">speech-01-hd (高清 v1)</option>
                  <option value="speech-01-turbo">speech-01-turbo (高速 v1)</option>
                </select>
              </div>

              <Separator />

              {/* Params */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">语速 (Speed): {ttsSpeed.toFixed(1)}</Label>
                  <Slider
                    value={[ttsSpeed]}
                    onValueChange={([v]) => setTtsSpeed(v)}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">音高 (Pitch): {ttsPitch.toFixed(1)}</Label>
                  <Slider
                    value={[ttsPitch]}
                    onValueChange={([v]) => setTtsPitch(v)}
                    min={-12}
                    max={12}
                    step={0.5}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">音量 (Volume): {ttsVol.toFixed(1)}</Label>
                  <Slider
                    value={[ttsVol]}
                    onValueChange={([v]) => setTtsVol(v)}
                    min={0.1}
                    max={2}
                    step={0.1}
                    className="mt-1"
                  />
                </div>
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
                    disabled={testing || !testText.trim()}
                    className="shrink-0 gap-1.5"
                  >
                    {testing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    {testing ? '合成中...' : '试听'}
                  </Button>
                </div>
                {audioUrl && (
                  <div className="flex items-center gap-2">
                    <audio ref={audioRef} src={audioUrl} controls className="h-8 flex-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
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
