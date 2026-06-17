import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'

export interface PatternDrillItem {
  id: string
  type: 'pattern_drill'
  title: string
  pattern: string
  patternMeaning?: string
  direction?: 'zh_to_en' | 'en_to_zh'
  items: Array<{ zh: string; answer: string }>
}

interface Props {
  value: PatternDrillItem
  onChange: (value: PatternDrillItem) => void
  onDelete: () => void
  patterns?: { id: string; pattern: string; meaning?: string }[]
}

export function PatternDrillForm({ value, onChange, onDelete, patterns = [] }: Props) {
  const [local, setLocal] = useState<PatternDrillItem>(value)

  useEffect(() => { setLocal(value) }, [value])

  const commit = (patch: Partial<PatternDrillItem>) => {
    const next = { ...local, ...patch } as PatternDrillItem
    setLocal(next)
    onChange(next)
  }

  const addItem = () => {
    commit({ items: [...local.items, { zh: '', answer: '' }] })
  }

  const updateItem = (idx: number, field: 'zh' | 'answer', val: string) => {
    const next = [...local.items]
    next[idx] = { ...next[idx], [field]: val }
    commit({ items: next })
  }

  const removeItem = (idx: number) => {
    commit({ items: local.items.filter((_, i) => i !== idx) })
  }

  const aiGenerate = async () => {
    if (!local.pattern) { toast.error('请先输入或选择句型'); return }
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
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GripVertical className="size-4 text-muted-foreground" />
          <Badge variant="secondary" className="text-[10px]">句型操练</Badge>
          <Badge variant="outline" className="text-[10px]">{local.direction === 'en_to_zh' ? '英→中' : '中→英'}</Badge>
        </div>
        <Button variant="ghost" size="icon-sm" className="text-destructive size-7" onClick={onDelete}><Trash2 className="size-3.5" /></Button>
      </div>

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
          <Input className="h-8 text-xs" value={local.title} onChange={e => commit({ title: e.target.value })} placeholder="I'd like to 句型操练" />
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
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={aiGenerate}><Zap className="size-3" />AI 生成</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={addItem}><Plus className="size-3" />添加</Button>
          </div>
        </div>
        {local.items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <span className="mt-2 text-[10px] text-muted-foreground w-4 text-right">{idx + 1}</span>
            <div className="flex-1 space-y-1.5">
              <Input className="h-7 text-xs" value={item.zh} onChange={e => updateItem(idx, 'zh', e.target.value)}
                placeholder={local.direction === 'en_to_zh' ? '中文答案...' : `用「${local.pattern || '句型'}」表达...`} />
              <Input className="h-7 text-xs" value={item.answer} onChange={e => updateItem(idx, 'answer', e.target.value)}
                placeholder={local.direction === 'en_to_zh' ? '英文原文...' : '英文答案...'} />
            </div>
            <Button variant="ghost" size="icon-sm" className="text-destructive h-7 w-7 mt-1" onClick={() => removeItem(idx)}><Trash2 className="size-3" /></Button>
          </div>
        ))}
      </div>
    </div>
  )
}
