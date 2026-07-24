import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookCopy, ChevronRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  type LearningNotebook,
} from '@/features/practice/api/english-practice-api'
import { cn } from '@/lib/cn'
import { learningNotebookRepository } from '@/lib/offline'

type EditorMode = 'create' | 'manage' | 'rename' | 'delete' | null

const coverStyles: Record<string, string> = {
  ocean: 'from-sky-600 to-cyan-700',
  forest: 'from-emerald-600 to-teal-800',
  amber: 'from-amber-500 to-orange-700',
  rose: 'from-rose-500 to-red-700',
  violet: 'from-violet-600 to-indigo-800',
  slate: 'from-slate-500 to-slate-700',
}

function BookCover({ notebook }: { notebook: LearningNotebook }) {
  const shortName = notebook.kind === 'uncategorized'
    ? '待整理'
    : notebook.name.trim().slice(0, 2).toUpperCase()
  return (
    <div
      className={cn(
        'relative flex h-16 w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-r-md bg-gradient-to-br text-white shadow-[4px_5px_12px_rgba(15,23,42,0.20)] transition-transform duration-200 group-active:translate-x-0.5',
        coverStyles[notebook.color] ?? coverStyles.ocean,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-y-0 left-0 w-2.5 bg-black/15 shadow-[inset_-1px_0_rgba(255,255,255,0.20)]" />
      <div className="absolute inset-x-3 bottom-1 h-px bg-white/30" />
      <span className="pl-1 text-[11px] font-semibold tracking-wider">{shortName}</span>
    </div>
  )
}

function NotebookRow({
  notebook,
  onOpen,
  onManage,
}: {
  notebook: LearningNotebook
  onOpen: () => void
  onManage?: () => void
}) {
  return (
    <div className="group relative flex min-h-[88px] w-full items-center gap-4 rounded-2xl border border-border/60 bg-card/72 px-4 py-3 text-left shadow-sm transition-[transform,background-color] active:scale-[0.99]">
      <button type="button" className="absolute inset-0 rounded-2xl" onClick={onOpen}>
        <span className="sr-only">打开{notebook.name}</span>
      </button>
      <BookCover notebook={notebook} />
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{notebook.name}</h2>
          {notebook.kind === 'uncategorized' && <Badge variant="secondary">系统</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{notebook.counts.total} 项内容</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground/80">
          {notebook.counts.word} 单词 · {notebook.counts.chunk} 句块 · {notebook.counts.pattern} 句型
        </p>
      </div>
      {onManage ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0 rounded-full"
          onClick={onManage}
          aria-label={`管理${notebook.name}`}
        >
          <MoreHorizontal />
        </Button>
      ) : (
        <ChevronRight className="pointer-events-none relative size-4 shrink-0 text-muted-foreground" />
      )}
    </div>
  )
}

export function LearningNotebooksPage() {
  const navigate = useNavigate()
  const [notebooks, setNotebooks] = useState<LearningNotebook[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<EditorMode>(null)
  const [selected, setSelected] = useState<LearningNotebook | null>(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await learningNotebookRepository.list()
      setNotebooks(result.items)
    } catch {
      toast.error('学习本加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const systemNotebook = useMemo(
    () => notebooks.find((item) => item.kind === 'uncategorized') ?? null,
    [notebooks],
  )
  const customNotebooks = useMemo(
    () => notebooks.filter((item) => item.kind === 'custom'),
    [notebooks],
  )

  const openCreate = () => {
    setSelected(null)
    setName('')
    setMode('create')
  }

  const openManage = (notebook: LearningNotebook) => {
    setSelected(notebook)
    setMode('manage')
  }

  const submitName = async () => {
    const value = name.trim()
    if (!value) {
      toast.error('请输入学习本名称')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await learningNotebookRepository.create(value)
        toast.success('学习本已创建')
      } else if (mode === 'rename' && selected) {
        await learningNotebookRepository.rename(selected.id, value)
        toast.success('名称已修改')
      }
      setMode(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const removeNotebook = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await learningNotebookRepository.remove(selected.id)
      toast.success('学习本已删除')
      setMode(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-24 pt-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">MY STUDY BOOKS</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">我的学习本</h1>
        </div>
        <Button type="button" size="icon" className="rounded-full" onClick={openCreate} aria-label="新建学习本">
          <Plus />
        </Button>
      </header>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-[88px] rounded-2xl" />)}
        </div>
      ) : (
        <>
          {systemNotebook && (
            <section className="flex flex-col gap-3">
              <p className="px-1 text-xs font-medium text-muted-foreground">待整理</p>
              <NotebookRow
                notebook={systemNotebook}
                onOpen={() => navigate(`/expressions/${systemNotebook.id}`)}
              />
            </section>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-medium text-muted-foreground">学习本</p>
              <span className="text-xs text-muted-foreground">{customNotebooks.length} 本</span>
            </div>
            {customNotebooks.length > 0 ? customNotebooks.map((notebook) => (
              <NotebookRow
                key={notebook.id}
                notebook={notebook}
                onOpen={() => navigate(`/expressions/${notebook.id}`)}
                onManage={() => openManage(notebook)}
              />
            )) : (
              <button
                type="button"
                onClick={openCreate}
                className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center"
              >
                <BookCopy className="size-8 text-muted-foreground" />
                <span className="text-sm font-medium">创建第一本学习本</span>
                <span className="text-xs text-muted-foreground">把单词、句块和句型放进同一本里学习</span>
              </button>
            )}
          </section>
        </>
      )}

      <Drawer open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DrawerContent className="rounded-t-[28px]">
          {(mode === 'create' || mode === 'rename') && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle>{mode === 'create' ? '新建学习本' : '修改学习本名称'}</DrawerTitle>
                <DrawerDescription>学习本可以同时收纳单词、句块和句型。</DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <Label htmlFor="notebook-name">名称</Label>
                <Input
                  id="notebook-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={30}
                  autoFocus
                  className="mt-2"
                  placeholder="例如：旅行英语"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submitName()
                  }}
                />
              </div>
              <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <Button onClick={() => void submitName()} disabled={submitting}>
                  {mode === 'create' ? '创建' : '保存'}
                </Button>
                <Button variant="outline" onClick={() => setMode(null)}>取消</Button>
              </DrawerFooter>
            </>
          )}

          {mode === 'manage' && selected && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle>管理“{selected.name}”</DrawerTitle>
                <DrawerDescription>{selected.counts.total} 项学习内容</DrawerDescription>
              </DrawerHeader>
              <div className="flex flex-col gap-2 px-4">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    setName(selected.name)
                    setMode('rename')
                  }}
                >
                  修改名称
                </Button>
                <Button variant="destructive" className="justify-start" onClick={() => setMode('delete')}>
                  <Trash2 data-icon="inline-start" />
                  删除学习本
                </Button>
              </div>
              <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <Button variant="outline" onClick={() => setMode(null)}>取消</Button>
              </DrawerFooter>
            </>
          )}

          {mode === 'delete' && selected && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle>删除“{selected.name}”？</DrawerTitle>
                <DrawerDescription>
                  该学习本中的独立学习进度会一并删除，相同内容在其他学习本中的进度不受影响。
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <Button variant="destructive" onClick={() => void removeNotebook()} disabled={submitting}>
                  删除学习本
                </Button>
                <Button variant="outline" onClick={() => setMode('manage')}>取消</Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
