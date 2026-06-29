import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ArrowRightLeft, Zap, Sparkles, Volume2, Play, Loader2, ImageIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { synthesizeAdminAudio, playAudioUrl } from '@/lib/admin-tts-helpers'
import { getFileAssetLongLivedUrl, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import { WarmupItemPreview } from './warmup-item-preview'

export interface ChunkSubstitutionItem {
  id: string
  type: 'chunk_substitution'
  title: string
  chunk: string
  chunkMeaning?: string
  direction?: 'zh_to_en' | 'en_to_zh'
  kind?: 'chunk' | 'word'
  items: Array<{ zh: string; answer: string; hint?: string; audioUrl?: string; imageUrl?: string }>
}

interface Props {
  value: ChunkSubstitutionItem
  onChange: (value: ChunkSubstitutionItem) => void
  onDelete: () => void
  vocabs?: { id: string; word: string; meaning: string }[]
  chunks?: { id: string; text: string; meaning: string }[]
}

const computeChunkSubTitle = (item: { chunk: string; kind?: string }) => {
  if (!item.chunk) return ''
  const typeLabel = item.kind === 'word' ? '单词替换' : '句块替换'
  return `${item.chunk} ${typeLabel}`
}

export function ChunkSubstitutionForm({ value, onChange, onDelete, vocabs = [], chunks = [] }: Props) {
  const [local, setLocal] = useState<ChunkSubstitutionItem>(value)
  const [ttsGenerating, setTtsGenerating] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState<string | null>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { setLocal(value) }, [value])

  const commit = (patch: Partial<ChunkSubstitutionItem>) => {
    const next = { ...local, ...patch }
    next.title = computeChunkSubTitle(next)
    setLocal(next as ChunkSubstitutionItem)
    onChange(next as ChunkSubstitutionItem)
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
      const url = await synthesizeAdminAudio(text, 'warmup_chunk_sub', `${local.id}-${idx}`)
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

  // AI 生成：根据选中的词汇和方向批量生成题目
  const aiGenerate = async () => {
    const selectedVocab = vocabs.find(v => v.word === local.chunk)
    const selectedChunk = chunks.find(c => c.text === local.chunk)
    const source = selectedVocab?.word || selectedChunk?.text || local.chunk
    if (!source) { toast.error('请先输入或选择核心词/句块'); return }
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'chunk_substitution',
        keyword: source,
        meaning: local.chunkMeaning || selectedVocab?.meaning || selectedChunk?.meaning || '',
        direction: local.direction ?? 'zh_to_en',
        kind: local.kind ?? 'chunk',
        count: 4,
      })
      if (res?.items?.length) {
        commit({ items: res.items.map((it: any) => ({ zh: it.zh, answer: it.answer })) })
        toast.success(`已生成 ${res.items.length} 道题目`)
      }
    } catch { toast.error('AI 生成失败') }
  }

  // AI 为所有题目生成提示
  const aiGenerateHints = async () => {
    const source = local.chunk
    if (!source) { toast.error('请先输入核心词/句块'); return }
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'chunk_substitution',
        keyword: source,
        meaning: local.chunkMeaning || '',
        kind: local.kind ?? 'chunk',
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
  }

  // AI 润色：改进现有题目的中文提示和英文答案
  const aiPolish = async () => {
    const source = local.chunk
    if (!source) { toast.error('请先输入核心词/句块'); return }
    if (!local.items.length) { toast.error('请先添加题目'); return }
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'chunk_substitution',
        keyword: source,
        meaning: local.chunkMeaning || '',
        direction: local.direction ?? 'zh_to_en',
        kind: local.kind ?? 'chunk',
        polish: true,
        items: local.items.map(it => ({ zh: it.zh, answer: it.answer })),
      })
      if (res?.items?.length) {
        commit({ items: local.items.map((it, i) => ({ ...it, zh: res.items[i]?.zh ?? it.zh, answer: res.items[i]?.answer ?? it.answer })) })
        toast.success(`已润色 ${res.items.length} 道题目`)
      }
    } catch { toast.error('AI 润色失败') }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">类型</Label>
          <div className="flex gap-2">
            <Button size="sm" variant={local.kind === 'word' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => commit({ kind: 'word' })}>单词</Button>
            <Button size="sm" variant={local.kind !== 'word' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => commit({ kind: 'chunk' })}>句块</Button>
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">方向</Label>
          <div className="flex gap-2">
            <Button size="sm" variant={local.direction !== 'en_to_zh' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => commit({ direction: 'zh_to_en' })}>中→英</Button>
            <Button size="sm" variant={local.direction === 'en_to_zh' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => commit({ direction: 'en_to_zh' })}>英→中</Button>
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">练习名称</Label>
          <div className="h-8 flex items-center text-xs text-muted-foreground bg-muted/50 rounded-md px-3 truncate">
            {local.title || '输入核心词/句块后自动生成'}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">核心{local.kind === 'word' ? '单词' : '句块'}</Label>
          <div className="flex gap-2">
            <Input className="h-8 text-xs" value={local.chunk} onChange={e => commit({ chunk: e.target.value })}
              placeholder={local.kind === 'word' ? 'e.g. carefully' : 'e.g. I\'d like to...'} />
          </div>
          {local.kind === 'word' && vocabs.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {vocabs.slice(0, 8).map(v => (
                <Badge key={v.id} variant="outline" className={cn('cursor-pointer text-[10px]', local.chunk === v.word && 'border-primary')}
                  onClick={() => commit({ chunk: v.word, chunkMeaning: v.meaning })}>{v.word}</Badge>
              ))}
            </div>
          )}
          {local.kind !== 'word' && chunks.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {chunks.slice(0, 8).map(c => (
                <Badge key={c.id} variant="outline" className={cn('cursor-pointer text-[10px] truncate max-w-[180px]', local.chunk === c.text && 'border-primary')}
                  onClick={() => commit({ chunk: c.text, chunkMeaning: c.meaning })}>{c.text}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">含义</Label>
          <Input className="h-8 text-xs" value={local.chunkMeaning ?? ''} onChange={e => commit({ chunkMeaning: e.target.value })} placeholder="中文含义" />
        </div>
      </div>

      {/* 题目列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">练习题目 ({local.items.length})</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerate}><Zap className="size-3" />AI 生成</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerateHints}><Zap className="size-3" />AI 提示</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiPolish} disabled={!local.items.length}><Sparkles className="size-3" />AI 润色</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={addItem}><Plus className="size-3" />添加</Button>
          </div>
        </div>
        {local.items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <span className="mt-2 text-[10px] text-muted-foreground w-4 text-right">{idx + 1}</span>
            <div className="flex-1 space-y-1.5">
              <Input className="h-7 text-xs" value={item.zh} onChange={e => updateItem(idx, 'zh', e.target.value)}
                placeholder={local.direction === 'en_to_zh' ? '中文答案...' : '中文提示...'} />
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
                {/* Image upload */}
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
              {/* Mobile preview for this item */}
              <WarmupItemPreview
                type="chunk_substitution"
                displayText={local.chunk}
                displayMeaning={local.chunkMeaning}
                promptZh={item.zh}
                answer={item.answer}
                imageUrl={item.imageUrl}
                direction={local.direction}
                kind={local.kind}
              />
            </div>
            <Button variant="ghost" size="icon-sm" className="text-destructive h-7 w-7 mt-1" onClick={() => removeItem(idx)}><Trash2 className="size-3" /></Button>
          </div>
        ))}
      </div>
    </div>
  )
}
