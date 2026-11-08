import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type LibraryBatchMode = 'fill' | 'regenerate'
export type LibraryBatchField = 'meaning' | 'description' | 'examples' | 'definition' | 'pronunciation' | 'difficulty'

const FIELD_COPY: Record<LibraryBatchField, { label: string; fill: string; regenerate: string }> = {
  meaning: {
    label: '中文释义',
    fill: '补上空白、待补充、含 other 或缺词性前缀的释义。',
    regenerate: '按常用义重写已有释义，并统一词性前缀。',
  },
  description: {
    label: '讲解',
    fill: '为空的讲解生成学习笔记。',
    regenerate: '保留已有正文，只把小节排版对齐成同一格式。',
  },
  examples: {
    label: '例句',
    fill: '补上缺失的例句，或只补空的中文翻译。',
    regenerate: '用新的学习例句覆盖已有例句。',
  },
  definition: {
    label: '英文释义',
    fill: '给还没有中文的英文释义补上翻译。',
    regenerate: '按学习标准重写已有英文释义卡。',
  },
  pronunciation: {
    label: '音标与发音',
    fill: '从词典补上缺失的英/美音标和发音。',
    regenerate: '用词典里的英/美音标和发音覆盖已有内容。',
  },
  difficulty: {
    label: '难度',
    fill: '补上缺失或无效的 L1–L5。',
    regenerate: '重新判断已有难度。',
  },
}

export function LibraryFieldBatchDialog({
  open,
  onOpenChange,
  title,
  fields,
  matchedCount,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: LibraryBatchField[]
  matchedCount: number
  onSubmit: (mode: LibraryBatchMode, fields: LibraryBatchField[]) => Promise<void>
}) {
  const [mode, setMode] = useState<LibraryBatchMode>('fill')
  const [selected, setSelected] = useState<LibraryBatchField[]>(fields)
  const [submitting, setSubmitting] = useState(false)

  const toggle = (field: LibraryBatchField) => {
    setSelected((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field])
  }

  const submit = async () => {
    if (!selected.length || submitting) return
    const names = selected.map((field) => FIELD_COPY[field].label).join('、')
    const action = mode === 'fill' ? '补全缺失' : '重新生成'
    if (!confirm(`将对当前筛选命中的全部 ${matchedCount} 条（跨分页）执行「${action}」：${names}。未勾选的字段不会改动。`)) return
    setSubmitting(true)
    try {
      await onSubmit(mode, selected)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            当前筛选命中 {matchedCount} 条，处理全部命中记录，不受当前页限制。先勾选字段，再选择怎么处理。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ToggleGroup type="single" value={mode} onValueChange={(value) => { if (value === 'fill' || value === 'regenerate') setMode(value) }}>
            <ToggleGroupItem value="fill" className="flex-1">补全缺失</ToggleGroupItem>
            <ToggleGroupItem value="regenerate" className="flex-1">重新生成</ToggleGroupItem>
          </ToggleGroup>
          <div className="space-y-2">
            {fields.map((field) => {
              const copy = FIELD_COPY[field]
              const checked = selected.includes(field)
              return (
                <label key={field} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${checked ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={checked}
                    onChange={() => toggle(field)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{copy.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{mode === 'fill' ? copy.fill : copy.regenerate}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!selected.length || submitting} onClick={() => void submit()}>
            {submitting ? '提交中…' : '执行'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
