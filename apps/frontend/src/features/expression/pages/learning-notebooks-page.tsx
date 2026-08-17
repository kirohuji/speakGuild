import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookCopy, ChevronRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { useOnboardingStore } from '@/stores/onboarding.store'

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
  const { t } = useTranslation()
  const shortName = notebook.kind === 'uncategorized'
    ? t('learningNotebooks.uncategorized')
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
      <span className="pl-1 text-[11px] font-semibold tracking-wider">{shortName}</span>
    </div>
  )
}

function NotebookRow({
  notebook,
  onOpen,
  onManage,
  spotlight,
}: {
  notebook: LearningNotebook
  onOpen: () => void
  onManage?: () => void
  /** 引导高亮标记 */
  spotlight?: string
}) {
  const { t } = useTranslation()
  return (
    <div
      className="group relative flex min-h-[88px] w-full items-center gap-4 rounded-2xl border border-border/60 bg-card/72 px-4 py-3 text-left transition-[transform,background-color] active:scale-[0.99]"
      {...(spotlight ? { 'data-spotlight': spotlight } : {})}
    >
      <button type="button" className="absolute inset-0 rounded-2xl" onClick={onOpen}>
        <span className="sr-only">{t('learningNotebooks.open', { name: notebook.name })}</span>
      </button>
      <BookCover notebook={notebook} />
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{notebook.name}</h2>
          {notebook.kind === 'uncategorized' && <Badge variant="secondary">{t('learningNotebooks.system')}</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('learningNotebooks.totalItems', { count: notebook.counts.total })}</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground/80">
          {t('learningNotebooks.itemBreakdown', {
            words: notebook.counts.word,
            chunks: notebook.counts.chunk,
            patterns: notebook.counts.pattern,
          })}
        </p>
      </div>
      {onManage ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0 rounded-full"
          onClick={onManage}
          aria-label={t('learningNotebooks.manage', { name: notebook.name })}
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [notebooks, setNotebooks] = useState<LearningNotebook[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<EditorMode>(null)
  const [selected, setSelected] = useState<LearningNotebook | null>(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const onboardingCompletedSegments = useOnboardingStore((state) => state.completedSegments)

  const load = useCallback(async () => {
    const cached = await learningNotebookRepository.listCached()
    if (cached.items.length > 0) {
      setNotebooks(cached.items)
      setLoading(false)
    } else {
      setLoading(true)
    }

    try {
      const result = await learningNotebookRepository.refresh()
      setNotebooks(result.items)
    } catch {
      if (cached.items.length === 0) toast.error(t('learningNotebooks.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  // 有学习本数据时触发「学习本」引导（条件式分段，仅首次）
  useEffect(() => {
    if (!loading && notebooks.length > 0) {
      useOnboardingStore.getState().tryStartSegment('notebooks')
    }
  }, [loading, notebooks.length, onboardingCompletedSegments])

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
      toast.error(t('learningNotebooks.nameRequired'))
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await learningNotebookRepository.create(value)
        toast.success(t('learningNotebooks.created'))
      } else if (mode === 'rename' && selected) {
        await learningNotebookRepository.rename(selected.id, value)
        toast.success(t('learningNotebooks.renamed'))
      }
      setMode(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learningNotebooks.operationFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const removeNotebook = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await learningNotebookRepository.remove(selected.id)
      toast.success(t('learningNotebooks.deleted'))
      setMode(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learningNotebooks.deleteFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-24 pt-5">
      <header className="flex justify-end">
        <Button type="button" variant="ghost" size="icon" className="size-10 rounded-full bg-muted text-foreground hover:bg-muted/80" onClick={openCreate} aria-label={t('learningNotebooks.createNew')}>
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
              <p className="px-1 text-xs font-medium text-muted-foreground">{t('learningNotebooks.uncategorized')}</p>
              <NotebookRow
                notebook={systemNotebook}
                onOpen={() => navigate(`/expressions/${systemNotebook.id}`)}
                spotlight="first-notebook-row"
              />
            </section>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-medium text-muted-foreground">{t('learningNotebooks.notebooks')}</p>
              <span className="text-xs text-muted-foreground">{t('learningNotebooks.notebookCount', { count: customNotebooks.length })}</span>
            </div>
            {customNotebooks.length > 0 ? customNotebooks.map((notebook, index) => (
              <NotebookRow
                key={notebook.id}
                notebook={notebook}
                onOpen={() => navigate(`/expressions/${notebook.id}`)}
                onManage={() => openManage(notebook)}
                {...(index === 0 && !systemNotebook ? { spotlight: 'first-notebook-row' } : {})}
              />
            )) : (
              <button
                type="button"
                onClick={openCreate}
                className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center"
              >
                <BookCopy className="size-8 text-muted-foreground" />
                <span className="text-sm font-medium">{t('learningNotebooks.createFirst')}</span>
                <span className="text-xs text-muted-foreground">{t('learningNotebooks.createFirstDesc')}</span>
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
                <DrawerTitle>{mode === 'create' ? t('learningNotebooks.createNew') : t('learningNotebooks.rename')}</DrawerTitle>
                <DrawerDescription>{t('learningNotebooks.description')}</DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <Label htmlFor="notebook-name">{t('learningNotebooks.name')}</Label>
                <Input
                  id="notebook-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={30}
                  autoFocus
                  className="mt-2"
                  placeholder={t('learningNotebooks.namePlaceholder')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submitName()
                  }}
                />
              </div>
              <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <Button onClick={() => void submitName()} disabled={submitting}>
                  {mode === 'create' ? t('learningNotebooks.create') : t('learningNotebooks.save')}
                </Button>
                <Button variant="outline" onClick={() => setMode(null)}>{t('learningNotebooks.cancel')}</Button>
              </DrawerFooter>
            </>
          )}

          {mode === 'manage' && selected && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle>{t('learningNotebooks.manageTitle', { name: selected.name })}</DrawerTitle>
                <DrawerDescription>{t('learningNotebooks.totalItems', { count: selected.counts.total })}</DrawerDescription>
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
                  {t('learningNotebooks.renameAction')}
                </Button>
                <Button variant="destructive" className="justify-start" onClick={() => setMode('delete')}>
                  <Trash2 data-icon="inline-start" />
                  {t('learningNotebooks.deleteAction')}
                </Button>
              </div>
              <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <Button variant="outline" onClick={() => setMode(null)}>{t('learningNotebooks.cancel')}</Button>
              </DrawerFooter>
            </>
          )}

          {mode === 'delete' && selected && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle>{t('learningNotebooks.deleteTitle', { name: selected.name })}</DrawerTitle>
                <DrawerDescription>
                  {t('learningNotebooks.deleteDescription')}
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <Button variant="destructive" onClick={() => void removeNotebook()} disabled={submitting}>
                  {t('learningNotebooks.deleteAction')}
                </Button>
                <Button variant="outline" onClick={() => setMode('manage')}>{t('learningNotebooks.cancel')}</Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
