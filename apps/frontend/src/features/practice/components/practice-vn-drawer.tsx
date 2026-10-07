import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronDown, ListTree, X } from 'lucide-react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { cn } from '@/lib/cn'

const CONTENT_MOUNT_DELAY_MS = 180

interface PracticeVnDrawerProps {
  teachingMarkdown?: string
  loading?: boolean
  onOpen?: () => void | Promise<void>
  hideToggles?: boolean
  triggerClassName?: string
  plainTrigger?: boolean
  showTriggerIcon?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type TeachingSection = { key: string; markdown: string; heading?: { text: string; level: 1 | 2 | 3 } }
type TocItem = { text: string; level: 1 | 2 | 3; sectionIndex: number }
type TocRow = { item: TocItem; expandable: boolean; expanded: boolean }

/** Split headings before rendering so a long document is never one huge DOM tree. */
function splitTeachingDocument(markdown: string): { sections: TeachingSection[]; toc: TocItem[] } {
  const lines = markdown.split(/\r?\n/)
  const sections: TeachingSection[] = []
  const toc: TocItem[] = []
  let start = 0
  let currentHeading: TeachingSection['heading']
  let fence: '`' | '~' | null = null
  const push = (end: number) => {
    const text = lines.slice(start, end).join('\n').trim()
    if (!text) return
    const sectionIndex = sections.length
    sections.push({ key: `section-${start}`, markdown: text, heading: currentHeading })
    if (currentHeading) toc.push({ ...currentHeading, sectionIndex })
  }
  lines.forEach((line, index) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as '`' | '~'
      fence = fence === marker ? null : fence ?? marker
      return
    }
    if (fence) return
    const match = line.match(/^\s*(#{1,3})[ \t]+(.+?)[ \t]*#*[ \t]*$/)
    if (!match) return
    push(index)
    currentHeading = { level: match[1].length as 1 | 2 | 3, text: match[2].replace(/[`*_~]/g, '').trim() }
    start = index
  })
  push(lines.length)
  if (!sections.length && markdown.trim()) sections.push({ key: 'section-0', markdown })
  return { sections, toc }
}

export function PracticeVnDrawer({ teachingMarkdown, loading = false, onOpen, hideToggles = false, triggerClassName, plainTrigger = false, showTriggerIcon = true, open: controlledOpen, onOpenChange: controlledOnOpenChange }: PracticeVnDrawerProps) {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [expandedTocSections, setExpandedTocSections] = useState<Set<number>>(() => new Set())
  const [contentReady, setContentReady] = useState(false)
  const closingRef = useRef(false)
  const documentRef = useRef<VirtuosoHandle>(null)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen
  const document = useMemo(() => splitTeachingDocument(teachingMarkdown ?? ''), [teachingMarkdown])
  const tocRows = useMemo<TocRow[]>(() => {
    const hasChildren = (index: number) => {
      const level = document.toc[index].level
      for (const next of document.toc.slice(index + 1)) {
        if (next.level <= level) return false
        return true
      }
      return false
    }
    let activeH1: TocItem | null = null
    let activeH2: TocItem | null = null
    return document.toc.flatMap((item, index) => {
      const expandable = hasChildren(index)
      if (item.level === 1) {
        activeH1 = item
        activeH2 = null
        return [{ item, expandable, expanded: expandedTocSections.has(item.sectionIndex) }]
      }
      if (item.level === 2) {
        activeH2 = item
        const visible = !activeH1 || expandedTocSections.has(activeH1.sectionIndex)
        return visible ? [{ item, expandable, expanded: expandedTocSections.has(item.sectionIndex) }] : []
      }
      const visible = (!activeH1 || expandedTocSections.has(activeH1.sectionIndex)) && (!activeH2 || expandedTocSections.has(activeH2.sectionIndex))
      return visible ? [{ item, expandable: false, expanded: false }] : []
    })
  }, [document.toc, expandedTocSections])
  const tocHeight = Math.min(Math.max(tocRows.length * 42, 48), 288)

  useEffect(() => {
    if (!open) { setTocOpen(false); setContentReady(false); closingRef.current = false; return }
    const timer = window.setTimeout(() => startTransition(() => setContentReady(true)), CONTENT_MOUNT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  const beginClose = useCallback(() => {
    if (closingRef.current || !open) return
    closingRef.current = true
    setTocOpen(false)
    setOpen(false)
    startTransition(() => setContentReady(false))
  }, [open, setOpen])
  const onDrawerOpenChange = useCallback((next: boolean) => next ? (closingRef.current = false, setOpen(true)) : beginClose(), [beginClose, setOpen])
  const handleTocSelect = useCallback((sectionIndex: number) => {
    setTocOpen(false)
    requestAnimationFrame(() => documentRef.current?.scrollToIndex({ index: sectionIndex, align: 'start', behavior: 'smooth' }))
  }, [])
  const toggleTocSection = useCallback((sectionIndex: number) => {
    setExpandedTocSections((current) => {
      const next = new Set(current)
      if (next.has(sectionIndex)) next.delete(sectionIndex)
      else next.add(sectionIndex)
      return next
    })
  }, [])

  return <>
    {!hideToggles && <button type="button" onClick={() => { closingRef.current = false; setOpen(true); void onOpen?.() }} className={cn(!plainTrigger && 'flex items-center gap-2 rounded-full border border-border/20 bg-background/60 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg transition-transform active:scale-[0.97]', triggerClassName)}>{showTriggerIcon && <BookOpen className="size-3.5 text-foreground/70" />}<span>{t('practiceVn.teaching')}</span></button>}
    <Drawer open={open} onOpenChange={onDrawerOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="h-[82vh] max-h-[82vh] rounded-t-[28px] border-border/20 bg-background text-foreground shadow-[0_-12px_40px_rgba(0,0,0,.28)] contain-paint !z-[10001]" overlayClassName="!z-[10001]">
        <DrawerHeader className="shrink-0 border-b border-border/45 px-5 pb-4 pt-3 text-left">
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3">
            {document.toc.length > 0 ? <Popover open={tocOpen} onOpenChange={setTocOpen}><PopoverTrigger asChild><button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.09] text-primary transition-colors hover:bg-primary/[0.14]" aria-label={t('practiceVn.contents')}><ListTree className="size-5" /></button></PopoverTrigger><PopoverContent align="start" sideOffset={8} collisionPadding={12} data-vaul-no-drag className="!z-[10002] w-[min(20rem,calc(100vw-2rem))] overflow-hidden border-0 bg-background p-0 text-foreground shadow-[0_18px_50px_rgba(0,0,0,.28)]" onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()} onPointerMove={(event) => event.stopPropagation()}><p className="bg-muted/45 px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground">{t('practiceVn.contents')}</p><div data-vaul-no-drag className="min-h-0 touch-pan-y overscroll-contain" style={{ height: tocHeight, maxHeight: '50dvh' }}><Virtuoso data={tocRows} fixedItemHeight={42} className="h-full" style={{ height: '100%' }} itemContent={(_, row) => <div className={cn('mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center rounded-lg text-sm leading-5 transition-colors hover:bg-accent hover:text-accent-foreground', row.item.level === 2 && 'pl-3', row.item.level === 3 && 'pl-8 text-muted-foreground')}><button type="button" className="min-w-0 flex-1 px-2 py-2 text-left" onClick={() => handleTocSelect(row.item.sectionIndex)}>{row.item.text}</button>{row.expandable && <button type="button" className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => toggleTocSection(row.item.sectionIndex)} aria-label={row.expanded ? '收起三级标题' : '展开三级标题'}><ChevronDown className={cn('size-4 transition-transform', row.expanded && 'rotate-180')} /></button>}</div>} /></div></PopoverContent></Popover> : <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.09] text-primary"><ListTree className="size-5" /></div>}
            <div className="min-w-0"><DrawerTitle className="text-base font-semibold tracking-tight">{t('practiceVn.teaching')}</DrawerTitle><DrawerDescription className="mt-1 text-xs">{t('practiceVn.teachingDesc')}</DrawerDescription></div>
          </div><Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 rounded-full" aria-label={t('common.close')} onClick={beginClose}><X /></Button></div>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-hidden">{loading ? <TeachingStatus text={t('practiceVn.loadingTeaching')} /> : teachingMarkdown ? contentReady ? <Virtuoso ref={documentRef} className="h-full" data={document.sections} increaseViewportBy={{ top: 600, bottom: 900 }} itemContent={(_, section) => <TeachingSectionView section={section} />} /> : <div className="px-4 pt-4"><TeachingContentPlaceholder /></div> : <TeachingStatus text={t('practiceVn.noTeaching')} />}</div>
      </DrawerContent>
    </Drawer>
  </>
}

const TeachingSectionView = memo(function TeachingSectionView({ section }: { section: TeachingSection }) { return <section className="px-4 py-3 first:pt-4 last:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"><MarkdownRenderer content={section.markdown} variant="teaching" /></section> })
function TeachingStatus({ text }: { text: string }) { return <div className="flex h-full items-center justify-center px-5"><p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-xs text-muted-foreground">{text}</p></div> }
function TeachingContentPlaceholder() { return <div className="flex flex-col gap-3" aria-hidden="true"><div className="h-5 w-2/5 rounded-md bg-muted/60" /><div className="h-4 w-full rounded-md bg-muted/40" /><div className="h-4 w-[92%] rounded-md bg-muted/40" /><div className="h-4 w-[85%] rounded-md bg-muted/40" /></div> }
