import { useState, useEffect } from 'react'
import { Plus, Trash2, Zap, Volume2, Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { synthesizeAdminAudio, playAudioUrl } from '@/lib/admin-tts-helpers'

export interface SentenceDecompositionItem {
  id: string
  type: 'sentence_decomposition'
  title: string
  fullSentence: string
  fullSentenceZh: string
  levels: Array<{
    level: number
    label: string
    en: string
    zh: string
    highlight?: string
    hint?: string
    audioUrl?: string
  }>
}

interface Props {
  value: SentenceDecompositionItem
  onChange: (value: SentenceDecompositionItem) => void
  onDelete: () => void
  chunks?: { id: string; text: string; meaning: string }[]
  patterns?: { id: string; pattern: string; meaning?: string }[]
}

const computeDecompTitle = (item: { fullSentence: string }) => {
  if (!item.fullSentence) return ''
  const truncated = item.fullSentence.length > 20 ? item.fullSentence.slice(0, 20) + '…' : item.fullSentence
  return `${truncated} 句子拆解`
}

export function SentenceDecompositionForm({ value, onChange, onDelete, chunks = [], patterns = [] }: Props) {
  const [local, setLocal] = useState<SentenceDecompositionItem>(value)
  // Local state for source chunk (not persisted, used for AI generation)
  const [sourceChunk, setSourceChunk] = useState('')
  const [generatingLong, setGeneratingLong] = useState(false)
  const [decomposing, setDecomposing] = useState(false)
  const [ttsGenerating, setTtsGenerating] = useState<string | null>(null)

  useEffect(() => {
    // Backward compat: migrate old data (levels[last].en → fullSentence)
    const v = { ...value }
    if (!v.fullSentence && v.levels?.length > 0) {
      const last = v.levels[v.levels.length - 1]
      if (last?.en) {
        v.fullSentence = last.en
        v.fullSentenceZh = last.zh || ''
      }
    }
    v.title = computeDecompTitle(v)
    setLocal(v)
  }, [value])

  const commit = (patch: Partial<SentenceDecompositionItem>) => {
    const next = { ...local, ...patch, title: computeDecompTitle({ ...local, ...patch }) } as SentenceDecompositionItem
    setLocal(next)
    onChange(next)
  }

  const addLevel = () => {
    const nextLevel = local.levels.length + 1
    commit({
      levels: [...local.levels, {
        level: nextLevel,
        label: `第 ${nextLevel} 级`,
        en: '',
        zh: '',
        highlight: '',
        hint: '',
      }]
    })
  }

  const updateLevel = (idx: number, patch: Partial<{ level: number; label: string; en: string; zh: string; highlight: string; hint: string }>) => {
    const next = [...local.levels]
    next[idx] = { ...next[idx], ...patch }
    commit({ levels: next })
  }

  const removeLevel = (idx: number) => {
    // Re-number remaining levels
    const next = local.levels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 }))
    commit({ levels: next })
  }

  const generateLevelAudio = async (idx: number) => {
    const text = local.levels[idx]?.en?.trim()
    if (!text) return
    const key = `level-${idx}`
    setTtsGenerating(key)
    try {
      const url = await synthesizeAdminAudio(text, 'warmup_sent_decomp', `${local.id}-${idx}`)
      const next = [...local.levels]
      next[idx] = { ...next[idx], audioUrl: url }
      commit({ levels: next })
      toast.success('层级音频已生成')
    } catch (err: any) {
      toast.error(err?.message || 'TTS 生成失败')
    } finally {
      setTtsGenerating(null)
    }
  }

  const aiGenerateLongSentence = async () => {
    if (!sourceChunk.trim()) { toast.error('请先输入源句块或句型'); return }
    setGeneratingLong(true)
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'sentence_decomposition',
        keyword: sourceChunk.trim(),
        generateSentence: true,
      })
      if (res?.fullSentence) {
        commit({ fullSentence: res.fullSentence, fullSentenceZh: res.fullSentenceZh ?? '' })
        toast.success('已生成长句')
      } else {
        toast.error('AI 未能生成长句')
      }
    } catch { toast.error('AI 生成失败') }
    finally { setGeneratingLong(false) }
  }

  const aiGenerate = async () => {
    if (!local.fullSentence) {
      toast.error('请先输入完整长句或使用 AI 生成长句')
      return
    }
    setDecomposing(true)
    try {
      const { post } = await import('@/lib/request')
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'sentence_decomposition',
        keyword: local.fullSentence,
        sentence: local.fullSentence,
        zh: local.fullSentenceZh,
        count: 5,
      })
      if (res?.levels?.length) {
        commit({ levels: res.levels })
        toast.success(`已生成 ${res.levels.length} 级拆解`)
      }
    } catch { toast.error('AI 生成失败') }
    finally { setDecomposing(false) }
  }

  return (
    <div className="space-y-3">
      {/* Auto-generated title */}
      <div className="space-y-1.5">
        <Label className="text-xs">练习名称</Label>
        <div className="h-8 flex items-center text-xs text-muted-foreground bg-muted/50 rounded-md px-3 truncate">
          {local.title || '输入完整长句后自动生成'}
        </div>
      </div>

      {/* Source chunk — select from available chunks/patterns, or type manually */}
      <div className="space-y-1.5">
        <Label className="text-xs">源句块（可选）</Label>
        {(chunks.length > 0 || patterns.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {chunks.slice(0, 6).map(c => (
              <Badge
                key={c.id}
                variant="outline"
                className={cn('cursor-pointer text-[10px] truncate max-w-[180px]', sourceChunk === c.text && 'border-primary')}
                onClick={() => setSourceChunk(c.text)}
              >
                {c.text}
              </Badge>
            ))}
            {patterns.slice(0, 4).map(p => (
              <Badge
                key={p.id}
                variant="outline"
                className={cn('cursor-pointer text-[10px] font-mono truncate max-w-[180px]', sourceChunk === p.pattern && 'border-primary')}
                onClick={() => setSourceChunk(p.pattern)}
              >
                {p.pattern}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            className="h-8 flex-1 text-xs font-mono"
            value={sourceChunk}
            onChange={(e) => setSourceChunk(e.target.value)}
            placeholder="e.g. I'd like to order..."
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[11px] gap-1 shrink-0"
            onClick={aiGenerateLongSentence}
            disabled={generatingLong || !sourceChunk.trim()}
          >
            {generatingLong ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            {generatingLong ? '生成中...' : 'AI 生成长句'}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">选择上方句块或手动输入，AI 将扩展为适合拆解的完整长句。</p>
      </div>

      {/* Full sentence display + edit */}
      <div className="space-y-2 rounded border border-border/40 bg-background/50 p-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] shrink-0">完整长句</Badge>
          <span className="text-[10px] text-muted-foreground">用于拆解的目标句子</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">英文</Label>
            <Input
              className="h-8 text-xs font-mono"
              value={local.fullSentence}
              onChange={(e) => commit({ fullSentence: e.target.value })}
              placeholder="e.g. She speaks English very well at the hotel every morning."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">中文</Label>
            <Input
              className="h-8 text-xs"
              value={local.fullSentenceZh}
              onChange={(e) => commit({ fullSentenceZh: e.target.value })}
              placeholder="她每天早上在酒店英语说得很好。"
            />
          </div>
        </div>
      </div>

      {/* Levels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">拆解层级 ({local.levels.length})</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerate} disabled={decomposing || generatingLong}>
              {decomposing ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
              {decomposing ? '拆解中' : 'AI 拆解'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={addLevel}>
              <Plus className="size-3" />添加层级
            </Button>
          </div>
        </div>
        {local.levels.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            输入完整长句后，点击「AI 拆解」自动生成渐进式层级。
          </p>
        )}
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2">
            {local.levels.map((level, idx) => (
              <div key={idx} className="w-[24rem] shrink-0 space-y-2 rounded border border-border/40 bg-background/50 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">L{level.level}</Badge>
                  <Input className="h-7 flex-1 text-xs" value={level.label}
                    onChange={e => updateLevel(idx, { label: e.target.value })} placeholder="e.g. 核心句 / 加地点 / 加原因" />
                  <Button variant="ghost" size="icon-sm" className="text-destructive h-7 w-7" onClick={() => removeLevel(idx)}><Trash2 className="size-3" /></Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">英文</Label>
                  <div className="flex gap-1">
                    <Input className="h-7 text-xs flex-1" value={level.en}
                      onChange={e => updateLevel(idx, { en: e.target.value })} placeholder="She speaks well." />
                    {level.audioUrl && (
                      <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="试听层级音频"
                        onClick={() => playAudioUrl(level.audioUrl)}>
                        <Play className="size-3" />
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" title="生成层级 TTS"
                      disabled={!level.en?.trim() || ttsGenerating === `level-${idx}`}
                      onClick={() => generateLevelAudio(idx)}>
                      {ttsGenerating === `level-${idx}` ? <Loader2 className="size-3 animate-spin" /> : <Volume2 className="size-3" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">中文</Label>
                  <Input className="h-7 text-xs" value={level.zh}
                    onChange={e => updateLevel(idx, { zh: e.target.value })} placeholder="她说得好。" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">高亮文本</Label>
                    <Input className="h-7 text-xs" value={level.highlight ?? ''}
                      onChange={e => updateLevel(idx, { highlight: e.target.value })} placeholder="e.g. at the hotel" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">提示文字</Label>
                    <Input className="h-7 text-xs" value={level.hint ?? ''}
                      onChange={e => updateLevel(idx, { hint: e.target.value })} placeholder="试着加入地点" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
