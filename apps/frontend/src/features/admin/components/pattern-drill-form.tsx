import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Zap, Sparkles, Volume2, Play, Loader2, ImageIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { synthesizeAdminAudio, playAudioUrl } from '@/lib/admin-tts-helpers'
import { getFileAssetLongLivedUrl, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import { WarmupItemPreview } from './warmup-item-preview'

export interface PatternDrillItem {
  id: string
  type: 'pattern_drill'
  title: string
  pattern: string
  patternMeaning?: string
  direction?: 'zh_to_en' | 'en_to_zh'
  items: Array<{ zh: string; answer: string; hint?: string; audioUrl?: string; imageUrl?: string }>
}

interface Props {
  value: PatternDrillItem
  onChange: (value: PatternDrillItem) => void
  onDelete: () => void
  patterns?: { id: string; pattern: string; meaning?: string }[]
}

const computePatternDrillTitle = (item: { pattern: string }) => {
  if (!item.pattern) return ''
  return `${item.pattern} 句型操练`
}

export function PatternDrillForm({ value, onChange, onDelete, patterns = [] }: Props) {
  const [local, setLocal] = useState<PatternDrillItem>(value)
  const [ttsGenerating, setTtsGenerating] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState<'generate' | 'hints' | 'polish' | null>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { setLocal(value) }, [value])

  const commit = (patch: Partial<PatternDrillItem>) => {
    const next = { ...local, ...patch, title: computePatternDrillTitle({ ...local, ...patch }) } as PatternDrillItem
    setLocal(next)
    onChange(next)
  }

  const addItem = () => {
    commit({ items: [...local.items, { zh: '', answer: '', hint: '' }] })
  }

  const updateItem = (idx: number, field: 'zh' | 'answer' | 'hint', val: string) => {
    const next = [...local.items]
    next[idx] = { ...next[idx], [field]: val }
    commit({ items: next })
  }

  const removeItem = (idx: number) => {
    commit({ items: local.items.filter((_, i) => i !== idx) })
  }

  const handleItemImageUpload = async (idx: number, file: File) => {
    if (!file.type.startsWith('image/')) return
    const key = `img-${idx}`
    setImageUploading(key)
    try {
      const asset = await uploadFileToCosAndComplete({ file, group: 'library' })
      const resolved = await getFileAssetLongLivedUrl(asset.id)
      const next = [...local.items]
      next[idx] = { ...next[idx], imageUrl: resolved.url }
      commit({ items: next })
    } catch (err: any) {
      toast.error(err?.message || '图片上传失败')
    } finally {
      setImageUploading(null)
    }
  }

  const removeItemImage = (idx: number) => {
    const next = [...local.items]
    next[idx] = { ...next[idx], imageUrl: undefined }
    commit({ items: next })
  }

  const generateItemAudio = async (idx: number) => {
    const text = local.items[idx]?.answer?.trim()
    if (!text) return
    const key = `item-${idx}`
    setTtsGenerating(key)
    try {
      const url = await synthesizeAdminAudio(text, 'warmup_pattern_drill', `${local.id}-${idx}`)
      const next = [...local.items]
      next[idx] = { ...next[idx], audioUrl: url }
      commit({ items: next })
      toast.success('题目音频已生成')
    } catch (err: any) {
      toast.error(err?.message || 'TTS 生成失败')
    } finally {
      setTtsGenerating(null)
    }
  }

  const aiGenerate = async () => {
    if (!local.pattern) { toast.error('请先输入或选择句型'); return }
    setAiBusy('generate')
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'pattern_drill',
        keyword: local.pattern,
        meaning: local.patternMeaning || '',
        direction: local.direction ?? 'zh_to_en',
        count: 4,
      })
      if (res?.items?.length) {
        commit({ items: res.items.map((it: any) => ({ zh: it.zh, answer: it.answer })) })
        toast.success(`已生成 ${res.items.length} 道题目`)
      }
    } catch { toast.error('AI 生成失败') }
    finally { setAiBusy(null) }
  }

  const aiGenerateHints = async () => {
    if (!local.pattern) { toast.error('请先输入句型模板'); return }
    setAiBusy('hints')
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'pattern_drill',
        keyword: local.pattern,
        meaning: local.patternMeaning || '',
        generateHints: true,
        itemCount: local.items.length,
        items: local.items.map(it => ({ zh: it.zh, answer: it.answer })),
      })
      if (res?.hints?.length) {
        const updated = local.items.map((it, i) => ({ ...it, hint: res.hints[i] ?? it.hint ?? '' }))
        commit({ items: updated })
        toast.success(`已为 ${res.hints.length} 道题生成提示`)
      }
    } catch { toast.error('AI 生成提示失败') }
    finally { setAiBusy(null) }
  }

  const aiPolish = async () => {
    if (!local.pattern) { toast.error('请先输入句型模板'); return }
    if (!local.items.length) { toast.error('请先添加题目'); return }
    setAiBusy('polish')
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'pattern_drill',
        keyword: local.pattern,
        meaning: local.patternMeaning || '',
        direction: local.direction ?? 'zh_to_en',
        polish: true,
        items: local.items.map(it => ({ zh: it.zh, answer: it.answer })),
      })
      if (res?.items?.length) {
        commit({ items: local.items.map((it, i) => ({ ...it, zh: res.items[i]?.zh ?? it.zh, answer: res.items[i]?.answer ?? it.answer })) })
        toast.success(`已润色 ${res.items.length} 道题目`)
      }
    } catch { toast.error('AI 润色失败') }
    finally { setAiBusy(null) }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">方向</Label>
          <div className="flex gap-2">
            <Button size="sm" variant={local.direction !== 'en_to_zh' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => commit({ direction: 'zh_to_en' })}>中→英</Button>
            <Button size="sm" variant={local.direction === 'en_to_zh' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => commit({ direction: 'en_to_zh' })}>英→中</Button>
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">练习名称</Label>
          <div className="h-8 flex items-center text-xs text-muted-foreground bg-muted/50 rounded-md px-3 truncate">
            {local.title || '输入句型模板后自动生成'}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">句型模板</Label>
          <Input className="h-8 font-mono text-xs" value={local.pattern} onChange={e => commit({ pattern: e.target.value })}
            placeholder="e.g. I'd like to [verb]..." />
          {patterns.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {patterns.slice(0, 8).map(p => (
                <Badge key={p.id} variant="outline" className={cn('cursor-pointer text-[10px] font-mono truncate max-w-[220px]', local.pattern === p.pattern && 'border-primary')}
                  onClick={() => commit({ pattern: p.pattern, patternMeaning: p.meaning })}>{p.pattern}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">句型含义</Label>
          <Input className="h-8 text-xs" value={local.patternMeaning ?? ''} onChange={e => commit({ patternMeaning: e.target.value })} placeholder="中文含义" />
        </div>
      </div>

      {/* 题目列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">练习题目 ({local.items.length})</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerate} disabled={aiBusy !== null}>
              {aiBusy === 'generate' ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
              {aiBusy === 'generate' ? '生成中' : 'AI 生成'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerateHints} disabled={aiBusy !== null}>
              {aiBusy === 'hints' ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
              {aiBusy === 'hints' ? '提示中' : 'AI 提示'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiPolish} disabled={!local.items.length || aiBusy !== null}>
              {aiBusy === 'polish' ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              {aiBusy === 'polish' ? '润色中' : 'AI 润色'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={addItem}><Plus className="size-3" />添加</Button>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2">
            {local.items.map((item, idx) => (
              <div key={idx} className="w-[21rem] shrink-0 rounded-md border border-border/60 bg-muted/10 p-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px]">题 {idx + 1}</Badge>
                  <Button variant="ghost" size="icon-sm" className="text-destructive size-6" onClick={() => removeItem(idx)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Input className="h-7 text-xs" value={item.zh} onChange={e => updateItem(idx, 'zh', e.target.value)}
                    placeholder={local.direction === 'en_to_zh' ? '中文答案...' : `用「${local.pattern || '句型'}」表达...`} />
                  <div className="flex gap-1">
                    <Input className="h-7 text-xs flex-1" value={item.answer} onChange={e => updateItem(idx, 'answer', e.target.value)}
                      placeholder={local.direction === 'en_to_zh' ? '英文原文...' : '英文答案...'} />
                    {item.audioUrl && (
                      <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="试听题目音频"
                        onClick={() => playAudioUrl(item.audioUrl)}>
                        <Play className="size-3" />
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="生成题目 TTS"
                      disabled={!item.answer?.trim() || ttsGenerating === `item-${idx}`}
                      onClick={() => generateItemAudio(idx)}>
                      {ttsGenerating === `item-${idx}` ? <Loader2 className="size-3 animate-spin" /> : <Volume2 className="size-3" />}
                    </Button>
                    <input
                      ref={(el) => { fileInputRefs.current[idx] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleItemImageUpload(idx, f); e.target.value = '' }}
                    />
                    {item.imageUrl ? (
                      <div className="relative shrink-0">
                        <img src={item.imageUrl} alt="题目配图" className="size-7 rounded object-cover" />
                        <button
                          type="button"
                          onClick={() => removeItemImage(idx)}
                          className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                        >
                          <X className="size-2" />
                        </button>
                      </div>
                    ) : (
                      <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="上传题目配图"
                        disabled={imageUploading === `img-${idx}`}
                        onClick={() => fileInputRefs.current[idx]?.click()}>
                        {imageUploading === `img-${idx}` ? <Loader2 className="size-3 animate-spin" /> : <ImageIcon className="size-3" />}
                      </Button>
                    )}
                  </div>
                  <Input className="h-7 text-xs text-muted-foreground" value={item.hint ?? ''} onChange={e => updateItem(idx, 'hint', e.target.value)}
                    placeholder="教学提示（选填）" />
                  <WarmupItemPreview
                    type="pattern_drill"
                    displayText={local.pattern}
                    displayMeaning={local.patternMeaning}
                    promptZh={item.zh}
                    answer={item.answer}
                    imageUrl={item.imageUrl}
                    direction={local.direction}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
