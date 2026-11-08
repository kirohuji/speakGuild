import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type LibraryBatchMode = 'fill' | 'regenerate' | 'normalize'
export type LibraryBatchField = 'meaning' | 'description' | 'examples' | 'definition' | 'pronunciation' | 'difficulty'

const FIELD_COPY: Record<LibraryBatchField, { label: string; fill: string; regenerate: string; normalize: string }> = {
  meaning: {
    label: '中文释义',
    fill: '补上空白、待补充、含 other 或缺词性前缀的释义。',
    regenerate: '按常用义重写已有释义，并统一词性前缀。',
    normalize: '检查规范只整理讲解排版。',
  },
  description: {
    label: '讲解',
    fill: '为空的讲解生成学习笔记。',
    regenerate: '让 AI 重写已有讲解。',
    normalize: '找出标题、空行或常见搭配不规范的讲解，只重排成标准四段，不改写正文。',
  },
  examples: {
    label: '例句',
    fill: '补上缺失的例句，或只补空的中文翻译。',
    regenerate: '用新的学习例句覆盖已有例句。',
    normalize: '检查规范只整理讲解排版。',
  },
  definition: {
    label: '英文释义',
    fill: '给还没有中文的英文释义补上翻译。',
    regenerate: '按学习标准重写已有英文释义卡。',
    normalize: '检查规范只整理讲解排版。',
  },
  pronunciation: {
    label: '音标与发音',
    fill: '从词典补上缺失的英/美音标和发音。',
    regenerate: '用词典里的英/美音标和发音覆盖已有内容。',
    normalize: '检查规范只整理讲解排版。',
  },
  difficulty: {
    label: '难度',
    fill: '补上缺失或无效的 L1–L5。',
    regenerate: '重新判断已有难度。',
    normalize: '检查规范只整理讲解排版。',
  },
}

export function LibraryFieldBatchDialog({
  open,
  onOpenChange,
  title,
  fields,
  matchedCount,
  fillHints,
  purpose = 'execute',
  screenedSelection,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: LibraryBatchField[]
  matchedCount: number
  fillHints?: Partial<Record<LibraryBatchField, string>>
  purpose?: 'execute' | 'screen'
  screenedSelection?: { mode: LibraryBatchMode; fields: LibraryBatchField[] } | null
  onSubmit: (mode: LibraryBatchMode, fields: LibraryBatchField[]) => Promise<void>
}) {
  const [mode, setMode] = useState<LibraryBatchMode>('fill')
  const [selected, setSelected] = useState<LibraryBatchField[]>(fields)
  const [submitting, setSubmitting] = useState(false)

  const fieldKey = fields.join(',')
  useEffect(() => {
    if (!open || !screenedSelection) return
    const allowed = new Set(fieldKey.split(','))
    setMode(screenedSelection.mode)
    setSelected(screenedSelection.fields.filter((field) => allowed.has(field)))
  }, [open, screenedSelection, fieldKey])

  const toggle = (field: LibraryBatchField) => {
    setSelected((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field])
  }

  const submit = async () => {
    if (!selected.length || submitting) return
    const names = selected.map((field) => FIELD_COPY[field].label).join('、')
    const action = mode === 'fill' ? '补全缺失' : mode === 'normalize' ? '检查规范' : '重新生成'
    const confirmText = mode === 'normalize'
      ? screenedSelection
        ? `将直接整理筛查出的 ${matchedCount} 条讲解排版，不调用 AI，也不改写正文。`
        : `将把当前筛选里排版不规范的讲解整理成标准四段，不调用 AI，也不改写正文。`
      : screenedSelection
        ? `将直接处理筛查出的 ${matchedCount} 条「${action}」：${names}。这批记录不再重新过滤。`
        : `将对当前筛选命中的全部 ${matchedCount} 条（跨分页）执行「${action}」：${names}。未勾选的字段不会改动。`
    if (purpose === 'execute' && !confirm(confirmText)) return
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
            {purpose === 'screen'
              ? '勾选字段后只过滤当前列表，规则和批量处理完全一致。不会创建任务，也不会改数据。'
              : screenedSelection
                ? `列表里这 ${matchedCount} 条已经筛好。执行时按原样带过去，不再重新过滤。`
                : `当前筛选命中 ${matchedCount} 条，处理全部命中记录，不受当前页限制。先勾选字段，再选择怎么处理。`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ToggleGroup type="single" value={mode} onValueChange={(value) => {
            if (value !== 'fill' && value !== 'regenerate' && value !== 'normalize') return
            setMode(value)
            if (value === 'normalize') setSelected(fields.includes('description') ? ['description'] : [])
          }}>
            <ToggleGroupItem value="fill" className="flex-1">补全缺失</ToggleGroupItem>
            <ToggleGroupItem value="regenerate" className="flex-1">重新生成</ToggleGroupItem>
            <ToggleGroupItem value="normalize" className="flex-1">检查规范</ToggleGroupItem>
          </ToggleGroup>
          <div className="space-y-2">
            {fields.map((field) => {
              const copy = FIELD_COPY[field]
              const locked = mode === 'normalize' && field !== 'description'
              const checked = !locked && selected.includes(field)
              return (
                <label key={field} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${checked ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggle(field)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{copy.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{mode === 'fill' ? (fillHints?.[field] ?? copy.fill) : copy[mode]}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!selected.length || submitting} onClick={() => void submit()}>
            {submitting ? '提交中…' : purpose === 'screen' ? '筛查' : '执行'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
