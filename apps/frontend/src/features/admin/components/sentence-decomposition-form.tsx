import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export interface SentenceDecompositionItem {
  id: string
  type: 'sentence_decomposition'
  title: string
  levels: Array<{
    level: number
    label: string
    en: string
    zh: string
    highlight?: string
    hint?: string
  }>
}

interface Props {
  value: SentenceDecompositionItem
  onChange: (value: SentenceDecompositionItem) => void
  onDelete: () => void
}

export function SentenceDecompositionForm({ value, onChange, onDelete }: Props) {
  const [local, setLocal] = useState<SentenceDecompositionItem>(value)

  useEffect(() => { setLocal(value) }, [value])

  const commit = (patch: Partial<SentenceDecompositionItem>) => {
    const next = { ...local, ...patch } as SentenceDecompositionItem
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

  const aiGenerate = async () => {
    if (local.levels.length === 0 || !local.levels[local.levels.length - 1].en) {
      toast.error('请先在最后一级填入完整长句')
      return
    }
    try {
      const { post } = await import('@/lib/request')
      const fullSentence = local.levels[local.levels.length - 1].en
      const fullZh = local.levels[local.levels.length - 1].zh
      const res: any = await post('/practice-ai/generate-drills', {
        type: 'sentence_decomposition',
        keyword: fullSentence,
        sentence: fullSentence,
        zh: fullZh,
        count: 5,
      })
      if (res?.levels?.length) {
        commit({ levels: res.levels })
        toast.success(`已生成 ${res.levels.length} 级拆解`)
      }
    } catch { toast.error('AI 生成失败') }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GripVertical className="size-4 text-muted-foreground" />
          <Badge variant="secondary" className="text-[10px]">句子拆解</Badge>
        </div>
        <Button variant="ghost" size="icon-sm" className="text-destructive size-7" onClick={onDelete}><Trash2 className="size-3.5" /></Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">练习名称</Label>
        <Input className="h-8 text-xs" value={local.title} onChange={e => commit({ title: e.target.value })} placeholder="句子拆解：从简单到复杂" />
      </div>

      {/* Levels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">拆解层级 ({local.levels.length})</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerate}><Zap className="size-3" />AI 拆解</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={addLevel}><Plus className="size-3" />添加层级</Button>
          </div>
        </div>
        {local.levels.map((level, idx) => (
          <div key={idx} className="space-y-2 rounded border border-border/40 bg-background/50 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">L{level.level}</Badge>
              <Input className="h-7 flex-1 text-xs" value={level.label}
                onChange={e => updateLevel(idx, { label: e.target.value })} placeholder="e.g. 核心句 / 加地点 / 加原因" />
              <Button variant="ghost" size="icon-sm" className="text-destructive h-7 w-7" onClick={() => removeLevel(idx)}><Trash2 className="size-3" /></Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">英文</Label>
                <Input className="h-7 text-xs" value={level.en}
                  onChange={e => updateLevel(idx, { en: e.target.value })} placeholder="She speaks well." />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">中文</Label>
                <Input className="h-7 text-xs" value={level.zh}
                  onChange={e => updateLevel(idx, { zh: e.target.value })} placeholder="她说得好。" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">高亮文本（新增部分）</Label>
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
  )
}
