import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Zap, Volume2, Play, Loader2, ImageIcon, X } from 'lucide-react'
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

export interface VocabSentenceBuildingItem {
  id: string
  type: 'vocab_sentence_building'
  title: string
  vocabWord: string
  vocabMeaning: string
  direction?: 'zh_to_en' | 'en_to_zh'
  patterns: Array<{
    chunk: string
    items: Array<{ zh: string; answer: string; hint?: string; audioUrl?: string; imageUrl?: string }>
  }>
}

interface Props {
  value: VocabSentenceBuildingItem
  onChange: (value: VocabSentenceBuildingItem) => void
  onDelete: () => void
  vocabs?: { id: string; word: string; meaning: string }[]
  chunks?: { id: string; text: string; meaning: string }[]
}

const computeVocabSubTitle = (item: { vocabWord: string }) => {
  if (!item.vocabWord) return ''
  return `${item.vocabWord} 一词多句`
}

export function VocabSentenceBuildingForm({ value, onChange, onDelete, vocabs = [], chunks = [] }: Props) {
  const [local, setLocal] = useState<VocabSentenceBuildingItem>(value)
  const [ttsGenerating, setTtsGenerating] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState<string | null>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { setLocal(value) }, [value])

  const commit = (patch: Partial<VocabSentenceBuildingItem>) => {
    const next = { ...local, ...patch, title: computeVocabSubTitle({ ...local, ...patch }) } as VocabSentenceBuildingItem
    setLocal(next)
    onChange(next)
  }

  const addPattern = () => {
    commit({ patterns: [...local.patterns, { chunk: '', items: [{ zh: '', answer: '' }] }] })
  }

  const updatePattern = (pIdx: number, patch: Partial<{ chunk: string }>) => {
    const next = [...local.patterns]
    next[pIdx] = { ...next[pIdx], ...patch }
    commit({ patterns: next })
  }

  const addPatternItem = (pIdx: number) => {
    const next = [...local.patterns]
    next[pIdx] = { ...next[pIdx], items: [...next[pIdx].items, { zh: '', answer: '' }] }
    commit({ patterns: next })
  }

  const updatePatternItem = (pIdx: number, iIdx: number, field: 'zh' | 'answer' | 'hint', val: string) => {
    const next = [...local.patterns]
    const items = [...next[pIdx].items]
    items[iIdx] = { ...items[iIdx], [field]: val }
    next[pIdx] = { ...next[pIdx], items }
    commit({ patterns: next })
  }

  const removePatternItem = (pIdx: number, iIdx: number) => {
    const next = [...local.patterns]
    next[pIdx] = { ...next[pIdx], items: next[pIdx].items.filter((_, i) => i !== iIdx) }
    if (next[pIdx].items.length === 0) {
      commit({ patterns: next.filter((_, i) => i !== pIdx) })
    } else {
      commit({ patterns: next })
    }
  }

  const handleItemImageUpload = async (pIdx: number, iIdx: number, file: File) => {
    if (!file.type.startsWith('image/')) return
    const key = `img-${pIdx}-${iIdx}`
    setImageUploading(key)
    try {
      const asset = await uploadFileToCosAndComplete({ file, group: 'library' })
      const resolved = await getFileAssetLongLivedUrl(asset.id)
      const next = [...local.patterns]
      const items = [...next[pIdx].items]
      items[iIdx] = { ...items[iIdx], imageUrl: resolved.url }
      next[pIdx] = { ...next[pIdx], items }
      commit({ patterns: next })
    } catch (err: any) {
      toast.error(err?.message || '图片上传失败')
    } finally {
      setImageUploading(null)
    }
  }

  const removeItemImage = (pIdx: number, iIdx: number) => {
    const next = [...local.patterns]
    const items = [...next[pIdx].items]
    items[iIdx] = { ...items[iIdx], imageUrl: undefined }
    next[pIdx] = { ...next[pIdx], items }
    commit({ patterns: next })
  }

  const generateItemAudio = async (pIdx: number, iIdx: number) => {
    const text = local.patterns[pIdx]?.items[iIdx]?.answer?.trim()
    if (!text) return
    const key = `item-${pIdx}-${iIdx}`
    setTtsGenerating(key)
    try {
      const url = await synthesizeAdminAudio(text, 'warmup_vocab_build', `${local.id}-${pIdx}-${iIdx}`)
      const next = [...local.patterns]
      const items = [...next[pIdx].items]
      items[iIdx] = { ...items[iIdx], audioUrl: url }
      next[pIdx] = { ...next[pIdx], items }
      commit({ patterns: next })
      toast.success('题目音频已生成')
    } catch (err: any) {
      toast.error(err?.message || 'TTS 生成失败')
    } finally {
      setTtsGenerating(null)
    }
  }

  const aiGenerate = async () => {
    if (!local.vocabWord) { toast.error('请先输入核心词汇'); return }
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'vocab_sentence_building',
        keyword: local.vocabWord,
        meaning: local.vocabMeaning || '',
        direction: local.direction ?? 'zh_to_en',
        count: 3,
        chunks: chunks.map(c => c.text).slice(0, 10),
      })
      if (res?.patterns?.length) {
        commit({ patterns: res.patterns.map((p: any) => ({
          chunk: p.chunk,
          items: (p.items || []).map((it: any) => ({ zh: it.zh, answer: it.answer })),
        })) })
        toast.success(`已生成 ${res.patterns.length} 组搭配`)
      }
    } catch { toast.error('AI 生成失败') }
  }

  const aiGenerateHints = async () => {
    if (!local.vocabWord) { toast.error('请先输入核心词汇'); return }
    try {
      const { post } = await import('@/lib/request')
      const allItems = local.patterns.flatMap(p => p.items)
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'vocab_sentence_building',
        keyword: local.vocabWord,
        meaning: local.vocabMeaning || '',
        generateHints: true,
        itemCount: allItems.length,
        items: allItems.map(it => ({ zh: it.zh, answer: it.answer })),
      })
      if (res?.hints?.length) {
        let hintIdx = 0
        const updated = local.patterns.map(p => ({
          ...p,
          items: p.items.map(it => ({ ...it, hint: res.hints[hintIdx++] ?? it.hint ?? '' })),
        }))
        commit({ patterns: updated })
        toast.success(`已为 ${res.hints.length} 道题生成提示`)
      }
    } catch { toast.error('AI 生成提示失败') }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">练习名称</Label>
          <div className="h-8 flex items-center text-xs text-muted-foreground bg-muted/50 rounded-md px-3 truncate">
            {local.title || '输入核心词汇后自动生成'}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">核心词汇</Label>
          <div className="flex gap-2">
            <Input className="h-8 text-xs" value={local.vocabWord} onChange={e => commit({ vocabWord: e.target.value })} placeholder="e.g. check in" />
          </div>
          {vocabs.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {vocabs.slice(0, 10).map(v => (
                <Badge key={v.id} variant="outline" className={cn('cursor-pointer text-[10px]', local.vocabWord === v.word && 'border-primary')}
                  onClick={() => commit({ vocabWord: v.word, vocabMeaning: v.meaning })}>{v.word}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">含义</Label>
          <Input className="h-8 text-xs" value={local.vocabMeaning ?? ''} onChange={e => commit({ vocabMeaning: e.target.value })} placeholder="中文含义" />
        </div>
      </div>

      {/* Patterns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">句型搭配 ({local.patterns.length})</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerate}><Zap className="size-3" />AI 生成</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerateHints}><Zap className="size-3" />AI 提示</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={addPattern}><Plus className="size-3" />添加句型</Button>
          </div>
        </div>
        {local.patterns.map((pattern, pIdx) => (
          <div key={pIdx} className="space-y-2 rounded border border-border/40 bg-background/50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">句型 {pIdx + 1}</span>
              <Input className="h-7 flex-1 text-xs" value={pattern.chunk}
                onChange={e => updatePattern(pIdx, { chunk: e.target.value })} placeholder="e.g. I'd like to..." />
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => addPatternItem(pIdx)}><Plus className="size-3" /></Button>
            </div>
            {chunks.length > 0 && pIdx === 0 && (
              <div className="flex flex-wrap gap-1">
                {chunks.slice(0, 6).map(c => (
                  <Badge key={c.id} variant="outline" className={cn('cursor-pointer text-[10px]', pattern.chunk === c.text && 'border-primary')}
                    onClick={() => updatePattern(pIdx, { chunk: c.text })}>{c.text}</Badge>
                ))}
              </div>
            )}
            {pattern.items.map((item, iIdx) => (
              <div key={iIdx} className="flex gap-2 items-start">
                <span className="mt-2 text-[10px] text-muted-foreground w-4 text-right">{iIdx + 1}</span>
                <div className="flex-1 space-y-1.5">
                  <Input className="h-7 text-xs" value={item.zh} onChange={e => updatePatternItem(pIdx, iIdx, 'zh', e.target.value)} placeholder="中文提示..." />
                  <div className="flex gap-1">
                    <Input className="h-7 text-xs flex-1" value={item.answer} onChange={e => updatePatternItem(pIdx, iIdx, 'answer', e.target.value)} placeholder="英文答案..." />
                    {item.audioUrl && (
                      <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="试听题目音频"
                        onClick={() => playAudioUrl(item.audioUrl)}>
                        <Play className="size-3" />
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="生成题目 TTS"
                      disabled={!item.answer?.trim() || ttsGenerating === `item-${pIdx}-${iIdx}`}
                      onClick={() => generateItemAudio(pIdx, iIdx)}>
                      {ttsGenerating === `item-${pIdx}-${iIdx}` ? <Loader2 className="size-3 animate-spin" /> : <Volume2 className="size-3" />}
                    </Button>
                    {/* Image upload */}
                    <input
                    ref={(el) => { fileInputRefs.current[idx] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleItemImageUpload(pIdx, iIdx, f); e.target.value = '' }}
                    />
                    {item.imageUrl ? (
                      <div className="relative shrink-0">
                        <img src={item.imageUrl} alt="题目配图" className="size-7 rounded object-cover" />
                        <button
                          type="button"
                          onClick={() => removeItemImage(pIdx, iIdx)}
                          className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                        >
                          <X className="size-2" />
                        </button>
                      </div>
                    ) : (
                      <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="上传题目配图"
                        disabled={imageUploading === `img-${pIdx}-${iIdx}`}
                        onClick={() => fileInputRefs.current[idx]?.click()}>
                        {imageUploading === `img-${pIdx}-${iIdx}` ? <Loader2 className="size-3 animate-spin" /> : <ImageIcon className="size-3" />}
                      </Button>
                    )}
                  </div>
                  <Input className="h-7 text-xs text-muted-foreground" value={item.hint ?? ''} onChange={e => updatePatternItem(pIdx, iIdx, 'hint', e.target.value)} placeholder="教学提示（选填）" />
                  {/* Mobile preview for this item */}
                  <WarmupItemPreview
                    type="vocab_sentence_building"
                    displayText={pat.chunk}
                    displayMeaning={local.vocabMeaning}
                    promptZh={item.zh}
                    answer={item.answer}
                    imageUrl={item.imageUrl}
                    direction={local.direction}
                  />
                </div>
                <Button variant="ghost" size="icon-sm" className="text-destructive h-7 w-7 mt-1" onClick={() => removePatternItem(pIdx, iIdx)}><Trash2 className="size-3" /></Button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
