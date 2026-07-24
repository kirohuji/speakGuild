import { useEffect, useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type LearningNotebook } from '@/features/practice/api/english-practice-api'
import { cn } from '@/lib/cn'
import { learningNotebookRepository } from '@/lib/offline'

const LAST_NOTEBOOK_KEY = 'learning-library:last-notebook-id'

export function SaveToNotebookDrawer({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (notebookIds: string[]) => Promise<void>
}) {
  const [notebooks, setNotebooks] = useState<LearningNotebook[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [lastNotebookId, setLastNotebookId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setCreating(false)
    setName('')
    learningNotebookRepository.list()
      .then((result) => {
        setNotebooks(result.items)
        const custom = result.items.filter((item) => item.kind === 'custom')
        const stored = window.localStorage.getItem(LAST_NOTEBOOK_KEY)
        const preferred = custom.find((item) => item.id === stored) ?? custom[0]
        const fallback = result.items.find((item) => item.kind === 'uncategorized')
        const initial = preferred ?? fallback
        setLastNotebookId(preferred?.id ?? null)
        setSelectedIds(initial ? [initial.id] : [])
      })
      .catch(() => toast.error('学习本加载失败'))
  }, [open])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const toggle = (id: string) => {
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ))
    setLastNotebookId(id)
  }

  const createNotebook = async () => {
    const value = name.trim()
    if (!value) {
      toast.error('请输入学习本名称')
      return
    }
    setSubmitting(true)
    try {
      const created = await learningNotebookRepository.create(value)
      const notebook = { ...created, counts: created.counts ?? { total: 0, word: 0, chunk: 0, pattern: 0 } }
      setNotebooks((current) => [...current, notebook])
      setSelectedIds([notebook.id])
      setLastNotebookId(notebook.id)
      setCreating(false)
      setName('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const save = async () => {
    setSubmitting(true)
    try {
      await onSave(selectedIds)
      const preferred = lastNotebookId && selectedIds.includes(lastNotebookId)
        ? lastNotebookId
        : selectedIds.find((id) => notebooks.some((item) => item.id === id && item.kind === 'custom'))
      if (preferred) window.localStorage.setItem(LAST_NOTEBOOK_KEY, preferred)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[86svh] rounded-t-[28px]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{creating ? '新建学习本' : '保存到学习本'}</DrawerTitle>
          <DrawerDescription>
            {creating ? '学习本可以同时收纳单词、句块和句型。' : '可以选择一本或多本；每本拥有独立学习进度。'}
          </DrawerDescription>
        </DrawerHeader>

        {creating ? (
          <div className="px-4">
            <Label htmlFor="new-learning-notebook">名称</Label>
            <Input
              id="new-learning-notebook"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：旅行英语"
              maxLength={30}
              autoFocus
              className="mt-2"
            />
          </div>
        ) : (
          <div className="min-h-0 overflow-y-auto px-4">
            <div className="flex flex-col gap-2">
              {notebooks.map((notebook) => {
                const checked = selectedSet.has(notebook.id)
                return (
                  <button
                    key={notebook.id}
                    type="button"
                    onClick={() => toggle(notebook.id)}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition-colors',
                      checked ? 'border-primary bg-primary/5' : 'border-border bg-card',
                    )}
                  >
                    <span className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md border',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}>
                      {checked && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{notebook.name}</span>
                        {notebook.id === lastNotebookId && notebook.kind === 'custom' && (
                          <span className="text-[10px] text-muted-foreground">上次使用</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{notebook.counts?.total ?? 0} 项内容</span>
                    </span>
                  </button>
                )
              })}
              <Button type="button" variant="outline" className="justify-start" onClick={() => setCreating(true)}>
                <Plus data-icon="inline-start" />
                新建学习本
              </Button>
            </div>
          </div>
        )}

        <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {creating ? (
            <>
              <Button onClick={() => void createNotebook()} disabled={submitting}>创建并选择</Button>
              <Button variant="outline" onClick={() => setCreating(false)}>返回</Button>
            </>
          ) : (
            <>
              <Button onClick={() => void save()} disabled={submitting}>
                {selectedIds.length === 0 ? '保存到未分类' : '保存'}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
