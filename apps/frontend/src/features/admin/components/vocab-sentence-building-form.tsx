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
import { deleteFileReference, getFileAssetLongLivedUrl, uploadFileToCosAndComplete } from '@/features/file-assets/api'
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
    items: Array<{ zh?: string; en?: string; answer: string; hint?: string; audioUrl?: string; audioAssetId?: string; imageUrl?: string }>
  }>
}

interface Props {
  value: VocabSentenceBuildingItem
  onChange: (value: VocabSentenceBuildingItem) => void
  onDelete: () => void
  vocabs?: { id: string; word: string; meaning: string }[]
  chunks?: { id: string; text: string; meaning: string }[]
  generationContext?: Record<string, unknown>
}

const computeVocabSubTitle = (item: { vocabWord: string }) => {
  if (!item.vocabWord) return ''
  return `${item.vocabWord} 一词多句`
}

export function VocabSentenceBuildingForm({ value, onChange, onDelete, vocabs = [], chunks = [], generationContext }: Props) {
  const [local, setLocal] = useState<VocabSentenceBuildingItem>(value)
  const [ttsGenerating, setTtsGenerating] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState<'generate' | 'hints' | null>(null)
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

  const looksEnglish = (text?: string) => /[A-Za-z]/.test(text ?? '')

  const isLegacyEnToZhItem = (item: VocabSentenceBuildingItem['patterns'][number]['items'][number]) => (
    local.direction === 'en_to_zh' && !item.en && looksEnglish(item.answer) && Boolean(item.zh)
  )

  const getPromptText = (item: VocabSentenceBuildingItem['patterns'][number]['items'][number]) => {
    if (local.direction !== 'en_to_zh') return item.zh ?? item.en ?? ''
    if (item.en) return item.en
    if (isLegacyEnToZhItem(item)) return item.answer
    return item.zh ?? item.answer ?? ''
  }

  const getAnswerText = (item: VocabSentenceBuildingItem['patterns'][number]['items'][number]) => {
    if (local.direction !== 'en_to_zh') return item.answer ?? ''
    if (item.en) return item.answer ?? item.zh ?? ''
    if (isLegacyEnToZhItem(item)) return item.zh ?? ''
    return item.answer ?? ''
  }

  const updatePromptText = (pIdx: number, iIdx: number, val: string) => {
    const current = local.patterns[pIdx].items[iIdx]
    if (local.direction !== 'en_to_zh') {
      updatePatternItem(pIdx, iIdx, 'zh', val)
      return
    }
    const next = [...local.patterns]
    const items = [...next[pIdx].items]
    items[iIdx] = isLegacyEnToZhItem(current)
      ? { ...current, en: val, answer: current.zh ?? '', zh: undefined }
      : { ...current, en: val }
    next[pIdx] = { ...next[pIdx], items }
    commit({ patterns: next })
  }

  const updateAnswerText = (pIdx: number, iIdx: number, val: string) => {
    const current = local.patterns[pIdx].items[iIdx]
    if (local.direction !== 'en_to_zh') {
      updatePatternItem(pIdx, iIdx, 'answer', val)
      return
    }
    const next = [...local.patterns]
    const items = [...next[pIdx].items]
    items[iIdx] = isLegacyEnToZhItem(current)
      ? { ...current, en: current.answer, answer: val, zh: undefined }
      : { ...current, answer: val }
    next[pIdx] = { ...next[pIdx], items }
    commit({ patterns: next })
  }

  const updatePatternItem = (pIdx: number, iIdx: number, field: 'zh' | 'en' | 'answer' | 'hint', val: string) => {
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
    const item = local.patterns[pIdx]?.items[iIdx]
    const text = (local.direction === 'en_to_zh' ? getPromptText(item) : getAnswerText(item)).trim()
    if (!text) return
    const key = `item-${pIdx}-${iIdx}`
    setTtsGenerating(key)
    try {
      const audio = await synthesizeAdminAudio(text, 'warmup_vocab_build', `${local.id}-${pIdx}-${iIdx}`)
      const next = [...local.patterns]
      const items = [...next[pIdx].items]
      items[iIdx] = { ...items[iIdx], audioUrl: audio.url, audioAssetId: audio.assetId }
      next[pIdx] = { ...next[pIdx], items }
      commit({ patterns: next })
      toast.success('题目音频已生成')
    } catch (err: any) {
      toast.error(err?.message || 'TTS 生成失败')
    } finally {
      setTtsGenerating(null)
    }
  }

  const removeItemAudio = async (pIdx: number, iIdx: number) => {
    const item = local.patterns[pIdx]?.items[iIdx]
    if (item?.audioAssetId) {
      await deleteFileReference(item.audioAssetId, 'warmup_vocab_build', `${local.id}-${pIdx}-${iIdx}`).catch(() => undefined)
    }
    const next = [...local.patterns]
    const items = [...next[pIdx].items]
    items[iIdx] = { ...items[iIdx], audioUrl: undefined, audioAssetId: undefined }
    next[pIdx] = { ...next[pIdx], items }
    commit({ patterns: next })
    toast.success('题目音频已移除')
  }

  const aiGenerate = async () => {
    if (!local.vocabWord) { toast.error('请先输入核心词汇'); return }
    setAiBusy('generate')
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'vocab_sentence_building',
        keyword: local.vocabWord,
        meaning: local.vocabMeaning || '',
        direction: local.direction ?? 'zh_to_en',
        count: 3,
        chunks: chunks.map(c => c.text).slice(0, 10),
        ...(generationContext ?? {}),
      })
      if (res?.patterns?.length) {
        const newPatterns: VocabSentenceBuildingItem['patterns'] = res.patterns.map((p: any) => ({
          chunk: p.chunk,
          items: (p.items || []).map((it: any) => (
            (local.direction ?? 'zh_to_en') === 'en_to_zh'
              ? { en: it.en ?? it.zh, answer: it.answer, hint: it.hint ?? '' }
              : { zh: it.zh ?? it.en, answer: it.answer, hint: it.hint ?? '' }
          )),
        }))
        commit({ patterns: newPatterns })
        toast.success(`已生成 ${res.patterns.length} 组搭配`)
        // 自动触发 AI 提示生成
        await aiGenerateHints(newPatterns, local.vocabWord)
      }
    } catch { toast.error('AI 生成失败') }
    finally { setAiBusy(null) }
  }

  const aiGenerateHints = async (patterns?: VocabSentenceBuildingItem['patterns'], overrideWord?: string) => {
    const word = overrideWord || local.vocabWord
    const targetPatterns = patterns ?? local.patterns
    if (!word) { toast.error('请先输入核心词汇'); return }
    const allItems = targetPatterns.flatMap(p => p.items)
    if (!allItems.length) return
    setAiBusy('hints')
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'vocab_sentence_building',
        keyword: word,
        meaning: local.vocabMeaning || '',
        direction: local.direction ?? 'zh_to_en',
        generateHints: true,
        itemCount: allItems.length,
        items: allItems.map(it => ({ zh: getPromptText(it), answer: getAnswerText(it) })),
        ...(generationContext ?? {}),
      })
      if (res?.hints?.length) {
        let hintIdx = 0
        const updated = targetPatterns.map(p => ({
          ...p,
          items: p.items.map(it => ({ ...it, hint: res.hints[hintIdx++] ?? it.hint ?? '' })),
        }))
        commit({ patterns: updated })
        toast.success(`已为 ${res.hints.length} 道题生成提示`)
      } else {
        // 自动触发时不弹错误 toast，静默处理
        if (!patterns) toast.error('AI 未返回教学提示，请稍后重试')
      }
    } catch {
      if (!patterns) toast.error('AI 生成提示失败')
    }
    finally { setAiBusy(null) }
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
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerate} disabled={aiBusy !== null}>
              {aiBusy === 'generate' ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
              {aiBusy === 'generate' ? '生成中' : 'AI 生成'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => aiGenerateHints()} disabled={aiBusy !== null}>
              {aiBusy === 'hints' ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
              {aiBusy === 'hints' ? '提示中' : 'AI 提示'}
            </Button>
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
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-2">
                {pattern.items.map((item, iIdx) => (
                  <div key={iIdx} className="w-[21rem] shrink-0 rounded-md border border-border/60 bg-muted/10 p-2">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">题 {iIdx + 1}</Badge>
                      <Button variant="ghost" size="icon-sm" className="text-destructive size-6" onClick={() => removePatternItem(pIdx, iIdx)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Input className="h-7 text-xs" value={getPromptText(item)} onChange={e => updatePromptText(pIdx, iIdx, e.target.value)} placeholder={local.direction === 'en_to_zh' ? '英文原文...' : '中文提示...'} />
                      <div className="flex gap-1">
                        <Input className="h-7 text-xs flex-1" value={getAnswerText(item)} onChange={e => updateAnswerText(pIdx, iIdx, e.target.value)} placeholder={local.direction === 'en_to_zh' ? '中文答案...' : '英文答案...'} />
                        {item.audioUrl && (
                          <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="试听题目音频"
                            onClick={() => playAudioUrl(item.audioUrl, item.audioAssetId)}>
                            <Play className="size-3" />
                          </Button>
                        )}
                        {(item.audioUrl || item.audioAssetId) && (
                          <Button size="icon-sm" variant="ghost" className="size-7 shrink-0 text-destructive" title="移除题目音频"
                            onClick={() => removeItemAudio(pIdx, iIdx)}>
                            <X className="size-3" />
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="生成题目 TTS"
                          disabled={!(local.direction === 'en_to_zh' ? getPromptText(item) : getAnswerText(item)).trim() || ttsGenerating === `item-${pIdx}-${iIdx}`}
                          onClick={() => generateItemAudio(pIdx, iIdx)}>
                          {ttsGenerating === `item-${pIdx}-${iIdx}` ? <Loader2 className="size-3 animate-spin" /> : <Volume2 className="size-3" />}
                        </Button>
                        <input
                          ref={(el) => { fileInputRefs.current[pIdx * 1000 + iIdx] = el }}
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
                            onClick={() => fileInputRefs.current[pIdx * 1000 + iIdx]?.click()}>
                            {imageUploading === `img-${pIdx}-${iIdx}` ? <Loader2 className="size-3 animate-spin" /> : <ImageIcon className="size-3" />}
                          </Button>
                        )}
                      </div>
                      <Input className="h-7 text-xs text-muted-foreground" value={item.hint ?? ''} onChange={e => updatePatternItem(pIdx, iIdx, 'hint', e.target.value)} placeholder="教学提示（选填）" />
                      <WarmupItemPreview
                        type="vocab_sentence_building"
                        displayText={pattern.chunk}
                        displayMeaning={local.vocabMeaning}
                        promptZh={getPromptText(item)}
                        answer={getAnswerText(item)}
                        imageUrl={item.imageUrl}
                        direction={local.direction}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
