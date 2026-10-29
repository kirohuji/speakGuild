import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronDown, ChevronsDown, ChevronsUp, Download, Expand, FileText, ListTree, Loader2, X } from 'lucide-react'
import { Virtuoso, type StateSnapshot, type VirtuosoHandle } from 'react-virtuoso'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { cn } from '@/lib/cn'
import { localDateKey } from '@/lib/date/calendar-date'
import { isNative } from '@/lib/native'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  TeachingDocumentPage,
  TeachingDocumentPreviewFrame,
  buildTeachingDocumentPages,
  buildTeachingDocumentPdfBlob,
  teachingDocumentTitle,
} from './teaching-document-export'

const CONTENT_MOUNT_DELAY_MS = 180
const READING_POSITION_PREFIX = 'speak-guild:teaching-reading-position:'

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

interface TeachingTocProps {
  rows: TocRow[]
  activeSectionIndex: number
  onSelect: (sectionIndex: number) => void
  onToggle: (sectionIndex: number) => void
  className?: string
}

/** iPadOS can report a desktop UA, so screen size alone is not enough here. */
function useInlineTeachingToc() {
  const getValue = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    const isIPad = /iPad/i.test(navigator.userAgent)
      || /iPad/i.test(navigator.platform)
      || ((navigator.platform === 'MacIntel' || /Macintosh/i.test(navigator.userAgent)) && navigator.maxTouchPoints > 1)
    const isTouchTablet = (navigator.maxTouchPoints > 1 || window.matchMedia('(any-pointer: coarse)').matches)
      && Math.min(window.innerWidth, window.innerHeight) >= 600
    return isIPad || isTouchTablet || window.innerWidth >= 700
  }

  const [inlineToc, setInlineToc] = useState(getValue)
  useEffect(() => {
    const update = () => setInlineToc(getValue())
    window.addEventListener('resize', update)
    update()
    return () => window.removeEventListener('resize', update)
  }, [])
  return inlineToc
}

function documentStorageKey(markdown: string) {
  let hash = 5381
  for (let index = 0; index < markdown.length; index += 1) hash = ((hash << 5) + hash) ^ markdown.charCodeAt(index)
  return `${READING_POSITION_PREFIX}${hash >>> 0}`
}

type SavedReadingPosition = { version: 2; sectionIndex: number; virtuosoState: StateSnapshot }

function readSavedPosition(key: string, sectionCount: number): { sectionIndex: number; virtuosoState: StateSnapshot | null } {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return { sectionIndex: 0, virtuosoState: null }
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const sectionIndex = Number(parsed.sectionIndex)
      const state = parsed.virtuosoState
      const virtuosoState = parsed.version === 2 && state && typeof state === 'object'
        && Number.isFinite(Number(state.scrollTop)) && Array.isArray(state.ranges)
        ? state as StateSnapshot
        : null
      return {
        sectionIndex: Number.isFinite(sectionIndex) ? Math.max(0, Math.min(Math.round(sectionIndex), Math.max(0, sectionCount - 1))) : 0,
        virtuosoState,
      }
    }
    // Keep positions saved by the first release of this feature usable.
    const sectionIndex = Number(raw)
    return { sectionIndex: Number.isFinite(sectionIndex) ? Math.max(0, Math.min(Math.round(sectionIndex), Math.max(0, sectionCount - 1))) : 0, virtuosoState: null }
  } catch { return { sectionIndex: 0, virtuosoState: null } }
}

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

function expandedPathFor(toc: TocItem[], sectionIndex: number) {
  const targetIndex = toc.findIndex((item) => item.sectionIndex === sectionIndex)
  const target = toc[targetIndex]
  if (!target) return new Set<number>()
  const expanded = new Set<number>([sectionIndex])
  let neededParentLevel = target.level
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const candidate = toc[index]!
    if (candidate.level < neededParentLevel) {
      expanded.add(candidate.sectionIndex)
      neededParentLevel = candidate.level
    }
  }
  return expanded
}

function TeachingToc({ rows, activeSectionIndex, onSelect, onToggle, className }: TeachingTocProps) {
  const tocRef = useRef<VirtuosoHandle>(null)
  const activeRowIndex = rows.findIndex((row) => row.item.sectionIndex === activeSectionIndex)

  useEffect(() => {
    if (activeRowIndex >= 0) tocRef.current?.scrollIntoView({ index: activeRowIndex, align: 'center', behavior: 'auto' })
  }, [activeRowIndex])

  return <Virtuoso
    ref={tocRef}
    data={rows}
    fixedItemHeight={42}
    className={cn('h-full', className)}
    itemContent={(_, row) => <div className={cn(
      'mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center rounded-lg text-sm leading-5',
      row.item.level === 2 && 'pl-3',
      row.item.level === 3 && 'pl-8 text-muted-foreground',
      row.item.sectionIndex === activeSectionIndex && 'bg-primary/[0.10] text-primary',
    )}>
      <button
        type="button"
        className="min-w-0 flex-1 px-2 py-2 text-left"
        onClick={() => onSelect(row.item.sectionIndex)}
        aria-current={row.item.sectionIndex === activeSectionIndex ? 'location' : undefined}
      >
        {row.item.text}
      </button>
      {row.expandable && <button type="button" className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onToggle(row.item.sectionIndex)} aria-label={row.expanded ? '收起三级标题' : '展开三级标题'}><ChevronDown className={cn('size-4 transition-transform', row.expanded && 'rotate-180')} /></button>}
    </div>}
  />
}

export function PracticeVnDrawer({ teachingMarkdown, loading = false, onOpen, hideToggles = false, triggerClassName, plainTrigger = false, showTriggerIcon = true, open: controlledOpen, onOpenChange: controlledOnOpenChange }: PracticeVnDrawerProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const inlineToc = useInlineTeachingToc()
  const [internalOpen, setInternalOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [zoomPreviewPage, setZoomPreviewPage] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [expandedTocSections, setExpandedTocSections] = useState<Set<number>>(() => new Set())
  const [contentReady, setContentReady] = useState(false)
  const [restoringReadingPosition, setRestoringReadingPosition] = useState(false)
  const [visibleSectionIndex, setVisibleSectionIndex] = useState(0)
  const [savedVirtuosoState, setSavedVirtuosoState] = useState<StateSnapshot | null>(null)
  const closingRef = useRef(false)
  const ignoreInitialRangeRef = useRef(false)
  const restoringRef = useRef(false)
  const navigatingToTocRef = useRef(false)
  const persistTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const navigationTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const scrollSyncFrameRef = useRef<number | null>(null)
  const wasOpenRef = useRef(false)
  const documentRef = useRef<VirtuosoHandle>(null)
  const scrollerElementRef = useRef<HTMLElement | null>(null)
  const visibleSectionIndexRef = useRef(0)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen
  const document = useMemo(() => splitTeachingDocument(teachingMarkdown ?? ''), [teachingMarkdown])
  const storageKey = useMemo(() => documentStorageKey(teachingMarkdown ?? ''), [teachingMarkdown])
  const printDate = useMemo(() => localDateKey(), [previewOpen])
  const printTitle = useMemo(() => teachingDocumentTitle(teachingMarkdown ?? '', t('practiceVn.teaching')), [t, teachingMarkdown])
  const printPages = useMemo(() => buildTeachingDocumentPages(teachingMarkdown ?? ''), [teachingMarkdown])
  const previewScale = isMobile ? 0.43 : 0.58
  const zoomScale = isMobile ? 0.72 : 0.92
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

  const expandableTocSectionIndexes = useMemo(() => document.toc.flatMap((item, index) => {
    const next = document.toc[index + 1]
    return next && next.level > item.level ? [item.sectionIndex] : []
  }), [document.toc])

  const activateSection = useCallback((index: number) => {
    const nextIndex = Math.max(0, index)
    if (visibleSectionIndexRef.current !== nextIndex) {
      visibleSectionIndexRef.current = nextIndex
      setVisibleSectionIndex(nextIndex)
    }
    let currentH1: number | null = null
    let currentH2: number | null = null
    for (const item of document.toc) {
      if (item.sectionIndex > nextIndex) break
      if (item.level === 1) { currentH1 = item.sectionIndex; currentH2 = null }
      if (item.level === 2) currentH2 = item.sectionIndex
    }
    if (currentH1 !== null || currentH2 !== null) {
      setExpandedTocSections((current) => {
        const next = new Set(current)
        if (currentH1 !== null) next.add(currentH1)
        if (currentH2 !== null) next.add(currentH2)
        return next.size === current.size ? current : next
      })
    }
  }, [document.toc])

  const syncVisibleSection = useCallback(() => {
    if (navigatingToTocRef.current) return
    const scroller = scrollerElementRef.current
    if (!scroller) return
    const top = scroller.getBoundingClientRect().top + 12
    const firstVisible = Array.from(scroller.querySelectorAll<HTMLElement>('[data-teaching-section-index]'))
      .map((element) => ({ index: Number(element.dataset.teachingSectionIndex), rect: element.getBoundingClientRect() }))
      .filter(({ index, rect }) => Number.isFinite(index) && rect.bottom > top)
      .sort((left, right) => left.rect.top - right.rect.top)[0]
    if (firstVisible) activateSection(firstVisible.index)
  }, [activateSection])

  useEffect(() => {
    if (!open) { setTocOpen(false); setContentReady(false); setRestoringReadingPosition(false); closingRef.current = false; return }
    const savedPosition = readSavedPosition(storageKey, document.sections.length)
    setSavedVirtuosoState(savedPosition.virtuosoState)
    setVisibleSectionIndex(0)
    visibleSectionIndexRef.current = 0
    restoringRef.current = true
    setRestoringReadingPosition(true)
    ignoreInitialRangeRef.current = true
    const timer = window.setTimeout(() => startTransition(() => setContentReady(true)), CONTENT_MOUNT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [document.sections.length, open, storageKey])

  // Virtuoso restores its own size map and scroll position atomically. Keeping a
  // brief cover over the first layout prevents a 0% frame from ever being shown.
  useEffect(() => {
    if (!open || !contentReady) return
    const timer = window.setTimeout(() => {
      restoringRef.current = false
      setRestoringReadingPosition(false)
      syncVisibleSection()
    }, 420)
    return () => window.clearTimeout(timer)
  }, [contentReady, open, savedVirtuosoState, syncVisibleSection])

  const persistReadingPosition = useCallback(() => {
    documentRef.current?.getState((virtuosoState) => {
      try {
        const position: SavedReadingPosition = {
          version: 2,
          sectionIndex: visibleSectionIndexRef.current,
          virtuosoState,
        }
        window.localStorage.setItem(storageKey, JSON.stringify(position))
      } catch { /* storage unavailable */ }
    })
  }, [storageKey])

  useEffect(() => {
    const scroller = scrollerElementRef.current
    if (!open || !contentReady || !scroller) return
    const onScroll = () => {
      if (restoringRef.current) return
      if (scrollSyncFrameRef.current === null) {
        scrollSyncFrameRef.current = requestAnimationFrame(() => {
          scrollSyncFrameRef.current = null
          syncVisibleSection()
        })
      }
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = window.setTimeout(persistReadingPosition, 180)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
      if (scrollSyncFrameRef.current !== null) cancelAnimationFrame(scrollSyncFrameRef.current)
    }
  }, [contentReady, open, persistReadingPosition, syncVisibleSection])

  // Some callers control this Drawer from outside. Capture the position before
  // that external close unmounts the Virtuoso instance as well.
  useEffect(() => {
    if (wasOpenRef.current && !open) persistReadingPosition()
    wasOpenRef.current = open
  }, [open, persistReadingPosition])

  const beginClose = useCallback(() => {
    if (closingRef.current || !open) return
    closingRef.current = true
    navigatingToTocRef.current = false
    if (navigationTimerRef.current) window.clearTimeout(navigationTimerRef.current)
    persistReadingPosition()
    setTocOpen(false)
    setOpen(false)
    startTransition(() => setContentReady(false))
  }, [open, setOpen])
  const onDrawerOpenChange = useCallback((next: boolean) => next ? (closingRef.current = false, setOpen(true)) : beginClose(), [beginClose, setOpen])
  const handleTocSelect = useCallback((sectionIndex: number) => {
    setTocOpen(false)
    const tocIndex = document.toc.findIndex((item) => item.sectionIndex === sectionIndex)
    const nextTocItem = document.toc[tocIndex + 1]
    if (tocIndex >= 0 && nextTocItem && nextTocItem.level > document.toc[tocIndex]!.level) {
      setExpandedTocSections(expandedPathFor(document.toc, sectionIndex))
    }
    const distance = Math.abs(sectionIndex - visibleSectionIndexRef.current)
    navigatingToTocRef.current = true
    if (navigationTimerRef.current) window.clearTimeout(navigationTimerRef.current)
    activateSection(sectionIndex)
    const behavior = distance <= 3 ? 'smooth' : 'auto'
    requestAnimationFrame(() => {
      documentRef.current?.scrollToIndex({ index: sectionIndex, align: 'start', behavior })
      navigationTimerRef.current = window.setTimeout(() => {
        navigatingToTocRef.current = false
        syncVisibleSection()
      }, behavior === 'smooth' ? 420 : 120)
    })
  }, [activateSection, document.toc, syncVisibleSection])
  const handleRangeChanged = useCallback(() => {
    if (navigatingToTocRef.current) return
    if (ignoreInitialRangeRef.current) {
      ignoreInitialRangeRef.current = false
      return
    }
    requestAnimationFrame(syncVisibleSection)
  }, [syncVisibleSection])
  const setScrollerRef = useCallback((element: HTMLElement | null | Window) => {
    scrollerElementRef.current = element instanceof HTMLElement ? element : null
  }, [])
  const readingProgress = document.sections.length <= 1 ? 0 : Math.round((visibleSectionIndex / (document.sections.length - 1)) * 100)
  const toggleTocSection = useCallback((sectionIndex: number) => {
    setExpandedTocSections((current) => {
      const targetIndex = document.toc.findIndex((item) => item.sectionIndex === sectionIndex)
      const target = document.toc[targetIndex]
      if (!target) return current
      if (current.has(sectionIndex)) {
        const next = new Set(current)
        next.delete(sectionIndex)
        for (const child of document.toc.slice(targetIndex + 1)) {
          if (child.level <= target.level) break
          next.delete(child.sectionIndex)
        }
        return next
      }
      // Accordion behavior: retain only the path that makes this item visible.
      return expandedPathFor(document.toc, sectionIndex)
    })
  }, [document.toc])
  const expandAllTocSections = useCallback(() => setExpandedTocSections(new Set(expandableTocSectionIndexes)), [expandableTocSectionIndexes])
  const collapseAllTocSections = useCallback(() => setExpandedTocSections(new Set()), [])

  const exportTeachingDocument = useCallback(async () => {
    if (!teachingMarkdown?.trim() || exporting) return
    setExporting(true)
    try {
      // Let the loading state paint before react-pdf starts its CPU-heavy layout work.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const blob = await buildTeachingDocumentPdfBlob({ markdown: teachingMarkdown, title: printTitle, date: printDate })
      const safeTitle = printTitle.replace(/[\\/:*?"<>|]/g, '-').trim() || '教学文档'
      const filename = `${safeTitle}-${printDate}.pdf`
      if (isNative()) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let binary = ''
        for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!)
        const file = await Filesystem.writeFile({ path: `exports/${filename}`, data: btoa(binary), directory: Directory.Cache, recursive: true })
        await Share.share({ title: printTitle, url: file.uri, dialogTitle: t('practiceVn.exportPdf') })
      } else {
        const url = URL.createObjectURL(blob)
        const anchor = window.document.createElement('a')
        anchor.href = url
        anchor.download = filename
        anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      }
    } catch (error) {
      console.warn('[teaching-document] PDF export failed', error)
      toast.error(t('practiceVn.exportFailed'))
    } finally {
      setExporting(false)
    }
  }, [exporting, printDate, printTitle, t, teachingMarkdown])

  return <>
    {!hideToggles && <button type="button" onClick={() => { closingRef.current = false; setOpen(true); void onOpen?.() }} className={cn(!plainTrigger && 'flex items-center gap-2 rounded-full border border-border/20 bg-background/60 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg transition-transform active:scale-[0.97]', triggerClassName)}>{showTriggerIcon && <BookOpen className="size-3.5 text-foreground/70" />}<span>{t('practiceVn.teaching')}</span></button>}
    <Drawer open={open} onOpenChange={onDrawerOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="h-[82vh] max-h-[82vh] rounded-t-[28px] border-border/20 bg-background text-foreground shadow-[0_-12px_40px_rgba(0,0,0,.28)] contain-paint !z-[10001]" overlayClassName="!z-[10001]">
        <DrawerHeader className="shrink-0 border-b border-border/45 px-5 pb-3 pt-3 text-left">
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 items-center gap-2">{!inlineToc && (document.toc.length > 0 ? <button type="button" onClick={() => setTocOpen(true)} className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.09] text-primary transition-colors hover:bg-primary/[0.14]" aria-label={t('practiceVn.contents')}><ListTree className="size-5" /></button> : <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.09] text-primary"><ListTree className="size-5" /></div>)}<button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.09] text-primary transition-colors hover:bg-primary/[0.14] disabled:opacity-40" aria-label={t('practiceVn.previewPdf')} disabled={!teachingMarkdown?.trim() || loading} onClick={() => setPreviewOpen(true)}><FileText className="size-5" /></button></div>
            <div className="min-w-0"><DrawerTitle className="text-base font-semibold tracking-tight">{t('practiceVn.teaching')}</DrawerTitle><DrawerDescription className="mt-1 text-xs">{t('practiceVn.teachingDesc')}</DrawerDescription></div>
          </div><Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 rounded-full" aria-label={t('common.close')} onClick={beginClose}><X /></Button></div>
          <div className="mt-3">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${readingProgress}%` }} /></div>
            <div className="mt-1.5 text-center"><span className="text-[10px] tabular-nums text-muted-foreground/80">{t('practiceVn.readingProgress', { progress: readingProgress })}</span></div>
          </div>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          {/* On tablets the outline and Markdown renderer share this reading row;
              the header remains outside it rather than becoming part of a sidebar. */}
          <div className={cn('h-full min-h-0', inlineToc && 'flex')}>
            {inlineToc && document.toc.length > 0 && <aside className="flex w-60 shrink-0 flex-col border-r border-border/45"><div className="flex shrink-0 items-center justify-between border-b border-border/45 bg-muted/35 px-3 py-2"><p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">{t('practiceVn.contents')}</p><div className="flex items-center"><button type="button" onClick={expandAllTocSections} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="全部展开"><ChevronsDown className="size-4" /></button><button type="button" onClick={collapseAllTocSections} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="全部收起"><ChevronsUp className="size-4" /></button></div></div><TeachingToc rows={tocRows} activeSectionIndex={visibleSectionIndex} onSelect={handleTocSelect} onToggle={toggleTocSection} className="flex-1" /></aside>}
            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">{loading ? <TeachingStatus text={t('practiceVn.loadingTeaching')} /> : teachingMarkdown ? contentReady ? <><Virtuoso ref={documentRef} scrollerRef={setScrollerRef} className="h-full" data={document.sections} restoreStateFrom={savedVirtuosoState ?? undefined} increaseViewportBy={{ top: 900, bottom: 1200 }} rangeChanged={handleRangeChanged} isScrolling={(isScrolling) => { if (!isScrolling && !restoringRef.current) persistReadingPosition() }} itemContent={(index, section) => <TeachingSectionView section={section} sectionIndex={index} />} />{restoringReadingPosition && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background"><Loader2 className="size-5 animate-spin text-muted-foreground" /><p className="text-xs text-muted-foreground">{t('common.loading')}</p></div>}</> : <div className="px-4 pt-4"><TeachingContentPlaceholder /></div> : <TeachingStatus text={t('practiceVn.noTeaching')} />}</div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
    <Sheet open={tocOpen && !inlineToc} onOpenChange={setTocOpen}>
      <SheetContent side="left" className="!z-[10002] flex h-full w-[min(20rem,86vw)] max-w-none flex-col gap-0 border-border/45 bg-background p-0 text-foreground shadow-2xl">
        <SheetHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border/45 px-5 py-3 text-left"><SheetTitle className="text-base">{t('practiceVn.contents')}</SheetTitle><div className="mr-9 flex items-center"><button type="button" onClick={expandAllTocSections} className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="全部展开"><ChevronsDown className="size-4" /></button><button type="button" onClick={collapseAllTocSections} className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="全部收起"><ChevronsUp className="size-4" /></button></div></SheetHeader>
        <TeachingToc rows={tocRows} activeSectionIndex={visibleSectionIndex} onSelect={handleTocSelect} onToggle={toggleTocSection} className="min-h-0 flex-1" />
      </SheetContent>
    </Sheet>
    <Dialog open={previewOpen} onOpenChange={(next) => { if (!next && zoomPreviewPage !== null) { setZoomPreviewPage(null); return } setPreviewOpen(next) }}>
      <DialogContent onEscapeKeyDown={(event) => { if (zoomPreviewPage !== null) { event.preventDefault(); setZoomPreviewPage(null) } }} overlayClassName="!z-[10003]" className={cn('[&>button:last-child]:top-[calc(0.75rem+env(safe-area-inset-top,0px))] !z-[10004] flex h-[100svh] max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 text-foreground sm:h-[92svh] sm:max-w-5xl sm:rounded-2xl', zoomPreviewPage !== null && '[&>button:last-child]:hidden')}>
        <DialogTitle className="sr-only">{t('practiceVn.previewPdf')}</DialogTitle>
        <div className="flex shrink-0 items-center gap-3 bg-background px-4 pb-3 pr-16 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{printTitle}</p><p className="mt-0.5 text-xs text-muted-foreground">{t('practiceVn.a4Summary', { count: printPages.length })}</p></div>
          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">A4</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-0 pb-5 pt-3 sm:px-4 sm:pt-4">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
            <p className="text-center text-xs text-muted-foreground">{t('practiceVn.tapToZoom')}</p>
            {printPages.map((blocks, pageIndex) => <div key={pageIndex} className="relative mx-auto w-fit">
              <TeachingDocumentPreviewFrame scale={previewScale}><TeachingDocumentPage blocks={blocks} title={printTitle} date={printDate} pageNumber={`${pageIndex + 1} / ${printPages.length}`} /></TeachingDocumentPreviewFrame>
              <button type="button" className="absolute inset-0 rounded-xl" onClick={() => setZoomPreviewPage(pageIndex)} aria-label={t('practiceVn.tapToZoom')} />
              <span className="pointer-events-none absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"><Expand /></span>
            </div>)}
          </div>
        </div>
        <div className="shrink-0 bg-background px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4">
          <Button className="h-12 w-full rounded-xl text-base font-semibold" onClick={() => void exportTeachingDocument()} disabled={exporting || !teachingMarkdown?.trim()}>{exporting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}{exporting ? t('practiceVn.exporting') : t('practiceVn.exportPdf')}</Button>
        </div>
        {zoomPreviewPage !== null && printPages[zoomPreviewPage] && <div className="absolute inset-0 flex flex-col bg-background">
          <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
            <p className="text-sm font-semibold text-muted-foreground">{zoomPreviewPage + 1} / {printPages.length}</p>
            <Button type="button" variant="ghost" size="icon" className="size-10 rounded-full" aria-label={t('common.close')} onClick={() => setZoomPreviewPage(null)}><X /></Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/30 px-3 pb-5 sm:px-6">
            <div className="mx-auto w-fit"><TeachingDocumentPreviewFrame scale={zoomScale}><TeachingDocumentPage blocks={printPages[zoomPreviewPage]!} title={printTitle} date={printDate} pageNumber={`${zoomPreviewPage + 1} / ${printPages.length}`} /></TeachingDocumentPreviewFrame></div>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </>
}

const TeachingSectionView = memo(function TeachingSectionView({ section, sectionIndex }: { section: TeachingSection; sectionIndex: number }) { return <section data-teaching-section-index={sectionIndex} className="px-4 py-1.5 first:pt-3 last:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"><MarkdownRenderer content={section.markdown} variant="teaching" /></section> })
function TeachingStatus({ text }: { text: string }) { return <div className="flex h-full items-center justify-center px-5"><p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-xs text-muted-foreground">{text}</p></div> }
function TeachingContentPlaceholder() { return <div className="flex flex-col gap-3" aria-hidden="true"><div className="h-5 w-2/5 rounded-md bg-muted/60" /><div className="h-4 w-full rounded-md bg-muted/40" /><div className="h-4 w-[92%] rounded-md bg-muted/40" /><div className="h-4 w-[85%] rounded-md bg-muted/40" /></div> }
