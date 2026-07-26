import { forwardRef, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BookMarked, Search, Trash2, BookOpen,
  BookText, MessageSquareText, ExternalLink, Layers,
  RotateCcw, CheckCheck, ArrowRightFromLine,
  ArrowLeft, CalendarDays, Check, CheckSquare, Download, Expand, FileText, Languages, Loader2, Minimize2, Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { MarkdownContent } from '@/features/system/components/markdown-content'
import { toast } from 'sonner'
import { expressionApi, type MasteryStatus } from '@/features/practice/api/english-practice-api'
import { LearningInsightDialog, type LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'
import { ImmersivePlayerDialog, mapInsightItemsToImmersiveItems, type ImmersivePlayerItem } from '@/features/learning/components/immersive-player'
import { cn } from '@/lib/cn'
import { extractCoreUsage } from '@/lib/markdown-utils'
import { isNative } from '@/lib/native'
import { learningNotebookRepository } from '@/lib/offline'
import type { LearningNotebook } from '@/features/practice/api/english-practice-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useLayoutStore } from '@/stores/layout.store'
import { useIsMobile } from '@/hooks/use-mobile'
import { Virtuoso } from 'react-virtuoso'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

type LibraryTab = 'words' | 'chunk' | 'pattern'
type LibraryReviewState = MasteryStatus | 'all'
const LIBRARY_TABS: LibraryTab[] = ['words', 'chunk', 'pattern']
const TAB_SWIPE_DISTANCE = 70

const VirtualListScroller = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} {...props} className={cn(className, 'scrollbar-hide')} />
  ),
)
VirtualListScroller.displayName = 'VirtualListScroller'

interface Expression {
  id: string; type: string; original: string | null; corrected: string | null
  notebookItemId?: string
  notebookId?: string
  chunkText: string | null; sceneName: string | null; masteryStatus: string
  reviewCount: number; nextReviewAt?: string | null; lastReviewedAt?: string | null
  createdAt: string
  vocabulary?: {
    id: string; word: string; meaning: string; partOfSpeech?: string | null;
    phoneticUs?: string | null; phoneticUk?: string | null;
    audioUsUrl?: string | null; audioUkUrl?: string | null;
    definitionEn?: string | null; synonyms?: string[];
    examples?: unknown; description?: string | null;
    difficulty?: string;
  } | null
}

interface PageResult {
  items: Expression[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const PAGE_SIZE = 30

type ExportMode = 'zh-to-en' | 'en-to-zh' | 'bilingual'

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!))
}

function printPracticeSheet(popup: Window, name: string, items: Expression[], mode: ExportMode, modeLabel: string, hint: string, countLabel: string, labels: { english: string; chinese: string; answer: string; date: string }, date: string) {
  const title = `${name} · ${modeLabel}`
  const itemsPerPage = mode === 'bilingual' ? 9 : 12
  const pages = Array.from({ length: Math.max(1, Math.ceil(items.length / itemsPerPage)) }, (_, index) => items.slice(index * itemsPerPage, (index + 1) * itemsPerPage))
  const table = (tableItems: Expression[], offset: number, bilingualColumn?: 'english' | 'chinese') => {
    const firstLabel = bilingualColumn === 'chinese' || mode === 'zh-to-en' ? labels.chinese : labels.english
    const rows = tableItems.map((item, index) => {
      const english = item.type === 'word' ? (item.original ?? '') : (item.chunkText ?? item.corrected ?? '')
      const chinese = item.type === 'word' ? (item.vocabulary?.meaning ?? item.corrected ?? '') : (item.original ?? '')
      const prompt = bilingualColumn === 'chinese' || mode === 'zh-to-en' ? chinese : english
      return `<tr><td>${offset + index + 1}</td><td>${escapeHtml(prompt || english)}</td><td></td><td>□</td></tr>`
    }).join('')
    return `<table><thead><tr><th>#</th><th>${escapeHtml(firstLabel)}</th><th>${escapeHtml(labels.answer)}</th><th>□</th></tr></thead><tbody>${rows}</tbody></table>`
  }
  const pagesHtml = pages.map((pageItems, index) => {
    const offset = index * itemsPerPage
    const tables = mode === 'bilingual'
      ? `<div class="two-columns">${table(pageItems.slice(0, Math.ceil(pageItems.length / 2)), offset, 'english')}${table(pageItems.slice(Math.ceil(pageItems.length / 2)), offset + Math.ceil(pageItems.length / 2), 'chinese')}</div>`
      : table(pageItems, offset)
    return `<section class="page"><header><span class="date">${escapeHtml(labels.date)}: ${escapeHtml(date)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(countLabel)} · ${escapeHtml(hint)}</p></header>${tables}<footer>${index + 1} / ${pages.length}</footer></section>`
  }).join('')
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { size: A4; margin: 14mm; } * { box-sizing:border-box; } body { color:#000; background:#fff; font-family: "PingFang SC", "Noto Sans SC", sans-serif; } .page { min-height:267mm; break-after:page; } .page:last-child { break-after:auto; } header { position:relative; border:1px solid #000; padding:16px 18px; color:#000; background:#fff; margin-bottom:18px; } h1{text-align:center;font-size:20px;margin:0 0 5px} header p{margin:0;text-align:center;font-size:12px}.date{position:absolute;right:18px;top:18px;font-size:10px}.two-columns{display:grid;grid-template-columns:1fr 1fr;gap:8px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#fee2d5;text-align:left;font-weight:700}th,td{border:1px solid #fed7c3;padding:6px 5px;height:24px}th:first-child,td:first-child,th:last-child,td:last-child{text-align:center;width:24px}footer{margin-top:16px;border-top:1px solid #d1d5db;padding-top:6px;text-align:right;font-size:10px;color:#444}</style></head><body>${pagesHtml}</body></html>`)
  popup.document.close()
  popup.focus()
  window.setTimeout(() => popup.print(), 250)
}

export function ExpressionLibraryPage() {
  const { t, i18n } = useTranslation()
  const isMobile = useIsMobile()
  const setBottomNavVisible = useLayoutStore((state) => state.setBottomNavVisible)
  const { notebookId } = useParams<{ notebookId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [notebookName, setNotebookName] = useState(() => t('learningNotebooks.notebooks'))
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('words')
  const [reviewState, setReviewState] = useState<LibraryReviewState>('all')
  const [search, setSearch] = useState('')
  const [groupByDate, setGroupByDate] = useState(false)

  // 后端分页数据
  const [result, setResult] = useState<PageResult>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogItems, setDialogItems] = useState<LearningInsightItem[]>([])
  const [immersiveOpen, setImmersiveOpen] = useState(false)
  const [immersiveIndex, setImmersiveIndex] = useState(0)
  const [immersiveItems, setImmersiveItems] = useState<ImmersivePlayerItem[]>([])

  // 展开的列表项
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchAction, setBatchAction] = useState<'status' | 'notebook' | null>(null)
  const [batchStatus, setBatchStatus] = useState<MasteryStatus>('learning')
  const [targetNotebookId, setTargetNotebookId] = useState('')
  const [newNotebookName, setNewNotebookName] = useState('')
  const [batchCreatingNotebook, setBatchCreatingNotebook] = useState(false)
  const [notebooks, setNotebooks] = useState<LearningNotebook[]>([])
  const [batchBusy, setBatchBusy] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportMode, setExportMode] = useState<ExportMode>('bilingual')
  const [exportItems, setExportItems] = useState<Expression[]>([])
  const [exportLoading, setExportLoading] = useState(false)
  const [shuffleExport, setShuffleExport] = useState(false)
  const [exportDate, setExportDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [exportColumns, setExportColumns] = useState<1 | 2>(2)
  const [handledDeepLink, setHandledDeepLink] = useState('')
  const tabSwipeRef = useRef({ x: 0, y: 0, blocked: false })
  const exportPageRefs = useRef(new Map<number, HTMLElement>())
  const listScrollTopRef = useRef(0)
  const headerScrollIntentRef = useRef({ down: 0, up: 0 })
  const [headerCondensed, setHeaderCondensed] = useState(false)
  const exportItemsPerPage = exportColumns === 2 ? 40 : 20
  const displayExportItems = useMemo(() => {
    if (!shuffleExport) return exportItems
    return exportItems.map((item) => ({ item, order: Math.random() })).sort((a, b) => a.order - b.order).map(({ item }) => item)
  }, [exportItems, shuffleExport])
  const exportPages = useMemo(() => Array.from(
    { length: Math.max(1, Math.ceil(displayExportItems.length / exportItemsPerPage)) },
    (_, index) => displayExportItems.slice(index * exportItemsPerPage, (index + 1) * exportItemsPerPage),
  ), [displayExportItems, exportItemsPerPage])
  const exportWordCount = useMemo(() => displayExportItems.filter((item) => item.type === 'word').length, [displayExportItems])

  // 学习本内容是二级页，移动端只保留返回入口，避免与列表操作争夺屏幕空间。
  useEffect(() => {
    if (isMobile) setBottomNavVisible(false)
    return () => {
      if (isMobile) setBottomNavVisible(true)
    }
  }, [isMobile, setBottomNavVisible])

  const localListRequest = useMemo(() => ({
    type: libraryTab === 'words' ? 'word' as const : libraryTab === 'pattern' ? 'scene_phrase' as const : 'chunk' as const,
    reviewState: reviewState === 'all' ? undefined : reviewState,
    notebookId: notebookId ?? '',
    search: search.trim() || undefined,
    sort: 'newest' as const,
  }), [libraryTab, notebookId, reviewState, search])

  const refreshLocalList = useCallback(async (remote?: PageResult) => {
    if (!notebookId) return []
    const items = await learningNotebookRepository.listCachedExpressionItems(localListRequest)
    setResult({
      items: items as Expression[],
      total: Math.max(remote?.total ?? 0, items.length),
      page: remote?.page ?? 1,
      pageSize: remote?.pageSize ?? PAGE_SIZE,
      totalPages: remote?.totalPages ?? 0,
    })
    return items
  }, [localListRequest, notebookId])

  // ---- The notebook detail is SQLite-only. Sync is handled outside the view. ----
  const fetchData = useCallback(async () => {
    if (!notebookId) {
      setResult({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 })
      setLoading(false)
      return
    }
    setLoading(true)
    setHeaderCondensed(false)
    listScrollTopRef.current = 0
    headerScrollIntentRef.current = { down: 0, up: 0 }
    try {
      await refreshLocalList()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('learningNotebooks.operationFailed')
      console.warn('[expression-library] local list failed', { notebookId, error })
      toast.error(`${t('learningNotebooks.loadFailed')}: ${message}`)
    } finally {
      setLoading(false)
    }
  }, [notebookId, refreshLocalList, t])

  useEffect(() => {
    if (!notebookId) return
    learningNotebookRepository.getCached(notebookId)
      .then((notebook) => {
        if (notebook) setNotebookName(notebook.name)
      })
      .catch(() => undefined)
    learningNotebookRepository.refresh()
      .then((data) => {
        const notebook = data.items.find((item) => item.id === notebookId)
        if (notebook) setNotebookName(notebook.name)
      })
      .catch(() => undefined)
  }, [notebookId])

  const deepLinkKind = searchParams.has('word')
    ? 'word'
    : searchParams.has('chunk')
      ? 'chunk'
      : searchParams.has('pattern')
        ? 'pattern'
        : null
  const deepLinkValue = deepLinkKind ? searchParams.get(deepLinkKind)?.trim() ?? '' : ''

  useEffect(() => {
    if (!deepLinkKind || !deepLinkValue) return
    setLibraryTab(deepLinkKind === 'word' ? 'words' : deepLinkKind)
    setReviewState('all')
    setExpandedItemIds(new Set())
  }, [deepLinkKind, deepLinkValue])

  // 一级 tab 或二级 tab 变化时重新请求
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 切换一级 tab 时重置二级 tab
  const handleLibraryTabChange = useCallback((value: string) => {
    setLibraryTab(value as LibraryTab)
    setReviewState('all')
    setExpandedItemIds(new Set())
    setHandledDeepLink('')
    setSearchParams({})
  }, [setSearchParams])

  useEffect(() => {
    document.body.dataset.mobileExpressionTab = libraryTab
    return () => {
      delete document.body.dataset.mobileExpressionTab
    }
  }, [libraryTab])

  useEffect(() => {
    if (!isNative()) return

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      tabSwipeRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        blocked: Boolean(
          event.target instanceof HTMLElement
            && event.target.closest('button,a,input,textarea,select,[role="button"],[role="dialog"],[data-mobile-gesture-block]'),
        ),
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      const start = tabSwipeRef.current
      if (start.blocked) return
      const touch = event.changedTouches[0]
      if (!touch) return

      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (Math.abs(dx) < TAB_SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.4) return

      const currentIndex = LIBRARY_TABS.indexOf(libraryTab)
      const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1
      const nextTab = LIBRARY_TABS[nextIndex]
      if (!nextTab) return

      handleLibraryTabChange(nextTab)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [handleLibraryTabChange, libraryTab])

  // ---- dialog ----
  const apiType = libraryTab === 'words' ? 'word' : libraryTab === 'pattern' ? 'scene_phrase' : 'chunk'
  const visibleDialogItems: LearningInsightItem[] = result.items.map((expr) => {
    if (apiType === 'word') {
      const vocab = expr.vocabulary
      return {
        kind: 'word' as const,
        id: `word:${expr.original ?? expr.id}`,
        word: vocab?.word ?? expr.original ?? '',
        meaning: vocab?.meaning ?? expr.chunkText ?? expr.corrected ?? undefined,
        partOfSpeech: vocab?.partOfSpeech,
        phoneticUs: vocab?.phoneticUs,
        phoneticUk: vocab?.phoneticUk,
        audioUsUrl: vocab?.audioUsUrl,
        audioUkUrl: vocab?.audioUkUrl,
        definitionEn: vocab?.definitionEn,
        synonyms: vocab?.synonyms,
        examples: vocab?.examples,
        description: vocab?.description ?? (expr.corrected && expr.corrected !== expr.chunkText ? expr.corrected : undefined),
        difficulty: vocab?.difficulty,
        sceneName: expr.sceneName ?? undefined,
      }
    }
    if (apiType === 'scene_phrase') {
      const remoteData = (expr as any).contentData
      return {
        kind: 'pattern' as const,
        id: expr.id,
        pattern: expr.chunkText ?? expr.corrected ?? '',
        meaning: expr.original ?? '',
        slots: remoteData?.slots,
        example: remoteData?.example,
        description: remoteData?.description,
        examples: remoteData?.examples,
        difficulty: remoteData?.difficulty,
        sceneName: expr.sceneName ?? undefined,
      }
    }
    const remoteData = (expr as any).contentData
    return {
      kind: 'chunk' as const,
      id: expr.id,
      text: expr.chunkText ?? expr.corrected ?? '',
      meaning: expr.original ?? '',
      description: remoteData?.description,
      examples: remoteData?.examples as any,
      sceneName: expr.sceneName ?? undefined,
      saved: true, // 已在学习库中
    }
  })

  const openDialog = useCallback((items: LearningInsightItem[], startIndex: number) => {
    if (items.length === 0) return
    setDialogItems(items)
    setDialogIndex(Math.min(startIndex, items.length - 1))
    setDialogOpen(true)
  }, [])

  const openImmersivePlayer = useCallback((items: LearningInsightItem[], startIndex: number) => {
    const mappedItems = mapInsightItemsToImmersiveItems(items)
    if (mappedItems.length === 0) return
    setImmersiveItems(mappedItems)
    setImmersiveIndex(Math.min(startIndex, mappedItems.length - 1))
    setImmersiveOpen(true)
  }, [])

  useEffect(() => {
    if (!deepLinkKind || !deepLinkValue || loading) return
    const key = `${deepLinkKind}:${deepLinkValue}`
    if (handledDeepLink === key) return

    const target = deepLinkValue.toLowerCase()
    const index = visibleDialogItems.findIndex((item) => {
      if (item.kind === 'word') return item.word.toLowerCase() === target
      if (item.kind === 'chunk') return item.text.toLowerCase() === target
      return item.pattern.toLowerCase() === target
    })
    const fallbackItem: LearningInsightItem =
      deepLinkKind === 'word'
        ? { kind: 'word', id: `word:${deepLinkValue}`, word: deepLinkValue }
        : deepLinkKind === 'chunk'
          ? { kind: 'chunk', id: `chunk:${deepLinkValue}`, text: deepLinkValue, meaning: '' }
          : { kind: 'pattern', id: `pattern:${deepLinkValue}`, pattern: deepLinkValue }

    if (index >= 0) {
      openDialog(visibleDialogItems, index)
    } else {
      openDialog([fallbackItem], 0)
    }
    setHandledDeepLink(key)
  }, [deepLinkKind, deepLinkValue, handledDeepLink, loading, openDialog, visibleDialogItems])

  // ---- 状态变更 ----
  const handleUpdateStatus = useCallback(async (id: string, status: MasteryStatus) => {
    const target = result.items.find((item) => item.id === id)
    if (!target?.notebookItemId) return
    try {
      await expressionApi.updateNotebookItemStatus(target.notebookItemId, status)
      await learningNotebookRepository.updateCachedNotebookItemStatus(target.notebookItemId, status)
      await refreshLocalList()
      toast.success(status === 'learning' ? t('expressionLib.movedToLearning') : status === 'reviewing' ? t('expressionLib.movedToReview') : t('expressionLib.movedToMastered'))
    } catch {
      toast.error(t('expressionLib.operationFailed'))
    }
  }, [refreshLocalList, result.items, t])

  // ---- 删除操作 ----
  const handleRemove = useCallback(async (id: string) => {
    const target = result.items.find((item) => item.id === id)
    try {
      if (!target?.notebookItemId) return
      await expressionApi.removeNotebookItem(target.notebookItemId)
      await learningNotebookRepository.removeCachedNotebookItem(target.notebookItemId)
      await refreshLocalList()
      toast.success(t('expressionLib.removed'))
    } catch {
      toast.error(t('expressionLib.removeFailed'))
    }
  }, [refreshLocalList, result.items, t])

  const selectedNotebookItemIds = useMemo(
    () => result.items.filter((item) => selectedIds.has(item.id)).map((item) => item.notebookItemId).filter((id): id is string => Boolean(id)),
    [result.items, selectedIds],
  )
  const allVisibleSelected = result.items.length > 0 && result.items.every((item) => selectedIds.has(item.id))
  const allExpanded = result.items.length > 0 && result.items.every((item) => {
    const key = item.type === 'word' ? (item.original ?? item.id) : item.id
    return expandedItemIds.has(key)
  })

  const openBatch = useCallback(async () => {
    if (selectedNotebookItemIds.length === 0) return
    setBatchOpen(true)
    setBatchAction(null)
    setBatchCreatingNotebook(false)
    setNewNotebookName('')
    try {
      const data = await learningNotebookRepository.refresh()
      const available = data.items.filter((item) => item.id !== notebookId)
      setNotebooks(available)
      setTargetNotebookId(available[0]?.id ?? '')
    } catch {
      toast.error(t('learningNotebooks.loadFailed'))
    }
  }, [notebookId, selectedNotebookItemIds.length, t])

  const createBatchNotebook = useCallback(async () => {
    const name = newNotebookName.trim()
    if (!name) {
      toast.error(t('learningNotebooks.nameRequired'))
      return
    }
    setBatchBusy(true)
    try {
      const notebook = await learningNotebookRepository.create(name)
      setNotebooks((current) => [...current, notebook])
      setTargetNotebookId(notebook.id)
      setNewNotebookName('')
      setBatchCreatingNotebook(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('learningNotebooks.createFailed'))
    } finally {
      setBatchBusy(false)
    }
  }, [newNotebookName, t])

  const applyBatch = useCallback(async () => {
    if (!batchAction || selectedNotebookItemIds.length === 0) return
    setBatchBusy(true)
    try {
      if (batchAction === 'status') {
        await expressionApi.updateNotebookItemsStatus(selectedNotebookItemIds, batchStatus)
        await Promise.all(selectedNotebookItemIds.map((id) => learningNotebookRepository.updateCachedNotebookItemStatus(id, batchStatus)))
      } else {
        if (!targetNotebookId) {
          toast.error(t('expressionLib.chooseNotebook'))
          return
        }
        await expressionApi.addNotebookItemsToNotebook(selectedNotebookItemIds, targetNotebookId)
      }
      toast.success(t('expressionLib.batchSuccess'))
      setBatchOpen(false)
      setSelectionMode(false)
      setSelectedIds(new Set())
      await refreshLocalList()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('expressionLib.operationFailed'))
    } finally {
      setBatchBusy(false)
    }
  }, [batchAction, batchStatus, refreshLocalList, selectedNotebookItemIds, t, targetNotebookId])

  const openExportPreview = useCallback(async () => {
    if (!notebookId) return
    setExportOpen(true)
    setExportLoading(true)
    try {
      const items = await learningNotebookRepository.listCachedExpressionItems(localListRequest) as Expression[]
      if (!items.length) {
        setExportOpen(false)
        toast.error(t('expressionLib.nothingToExport'))
        return
      }
      setExportItems(items)
    } catch {
      toast.error(t('expressionLib.operationFailed'))
    } finally {
      setExportLoading(false)
    }
  }, [localListRequest, notebookId, t])

  const printExportPreview = useCallback(async () => {
    if (!exportPageRefs.current.size || !displayExportItems.length) return
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      for (let pageIndex = 0; pageIndex < exportPages.length; pageIndex += 1) {
        const page = exportPageRefs.current.get(pageIndex)
        if (!page) continue
        const clone = page.cloneNode(true) as HTMLElement
        clone.style.position = 'fixed'
        clone.style.left = '0'
        clone.style.top = '0'
        clone.style.transform = 'none'
        clone.style.transformOrigin = 'top left'
        clone.style.zIndex = '-1'
        document.body.appendChild(clone)
        if (pageIndex > 0) pdf.addPage('a4', 'portrait')
        const canvas = await html2canvas(clone, { scale: 2, backgroundColor: '#ffffff', useCORS: true, width: clone.offsetWidth, height: clone.offsetHeight })
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
        clone.remove()
      }
      const filename = `${notebookName}-${exportDate}.pdf`
      if (isNative()) {
        const data = pdf.output('datauristring').split(',')[1]
        const file = await Filesystem.writeFile({ path: `exports/${filename}`, data, directory: Directory.Cache, recursive: true })
        await Share.share({ title: notebookName, url: file.uri, dialogTitle: t('expressionLib.exportPdfAction') })
      } else {
        pdf.save(filename)
      }
    } catch (error) {
      console.warn('[expression-library] PDF export failed', error)
      toast.error(t('expressionLib.operationFailed'))
    }
  }, [displayExportItems.length, exportDate, exportPages.length, notebookName, t])

  // ---- 二级状态过滤 ----
  const filterPills = [
    { value: 'all' as const, label: t('expressionLib.all') },
    { value: 'learning' as MasteryStatus, label: t('expressionLib.done') },
    { value: 'reviewing' as MasteryStatus, label: t('expressionLib.reviewing') },
    { value: 'mastered' as MasteryStatus, label: t('expressionLib.mastered') },
  ]

  // ---- empty state ----
  const emptyState = (icon: React.ReactNode, title: string, hint?: string) => (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="text-muted-foreground/40">{icon}</div>
      <p className="mt-4 text-muted-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground/70">{hint}</p>}
    </div>
  )

  // ---- 列表项渲染 ----
  const renderExpressionItem = (expr: Expression, index: number) => {
    const isWord = expr.type === 'word'
    const isPattern = expr.type === 'scene_phrase'
    const text = isWord ? (expr.original ?? '') : (expr.chunkText ?? expr.corrected ?? '')
    const displayKey = isWord ? (expr.original ?? expr.id) : expr.id
    const isExpanded = expandedItemIds.has(displayKey)
    const isSelected = selectedIds.has(expr.id)
    const insight = visibleDialogItems[index]
    const meaning = insight?.kind === 'word'
      ? insight.meaning
      : insight?.kind === 'chunk'
        ? insight.meaning
        : insight?.kind === 'pattern'
          ? insight.meaning
          : undefined

    const iconEl = isWord ? (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <BookText className="size-4" />
      </div>
    ) : isPattern ? (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
        <Layers className="size-4" />
      </div>
    ) : (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <MessageSquareText className="size-4" />
      </div>
    )

    return (
      <Card key={displayKey} className={cn(
        'border-0 bg-muted/30 shadow-none transition-colors',
        isExpanded && 'bg-primary/[0.06]',
      )}>
        <CardContent className="p-0">
          <button
            type="button"
            className="flex w-full items-center gap-3 p-3 text-left"
            onClick={() => {
              if (selectionMode) {
                setSelectedIds((current) => {
                  const next = new Set(current)
                  if (next.has(expr.id)) next.delete(expr.id)
                  else next.add(expr.id)
                  return next
                })
                return
              }
              setExpandedItemIds((current) => {
                const next = new Set(current)
                if (next.has(displayKey)) next.delete(displayKey)
                else next.add(displayKey)
                return next
              })
            }}
          >
            {selectionMode && <span className={cn('flex size-5 shrink-0 items-center justify-center rounded border', isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/45')}><CheckCheck className={cn('size-3.5', !isSelected && 'invisible')} /></span>}
            {iconEl}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{text}</p>
                {expr.reviewCount > 0 && (
                  <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">
                    {t('expressionLib.reviewedCount', { count: expr.reviewCount })}
                  </Badge>
                )}
              </div>
              {meaning && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{meaning}</p>
              )}
              {isWord && expr.createdAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('expressionLib.collectedAt', { date: new Date(expr.createdAt).toLocaleDateString('zh-CN') })}
                </p>
              )}
            </div>
            {!selectionMode && <div className="grid shrink-0 grid-cols-2 gap-0.5">
              {(expr.masteryStatus === 'learning' || expr.masteryStatus === 'activated') && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(expr.id, 'reviewing') }}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-primary hover:bg-primary/10"
                >
                  <ArrowRightFromLine className="size-3.5" />
                </span>
              )}
              {expr.masteryStatus === 'reviewing' && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(expr.id, 'learning') }}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-amber-500 hover:bg-amber-500/10"
                >
                  <RotateCcw className="size-3.5" />
                </span>
              )}
              {expr.masteryStatus === 'mastered' && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(expr.id, 'reviewing') }}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                </span>
              )}
              {(expr.masteryStatus === 'learning' || expr.masteryStatus === 'activated' || expr.masteryStatus === 'reviewing') && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(expr.id, 'mastered') }}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-emerald-500 hover:bg-emerald-500/10"
                >
                  <CheckCheck className="size-3.5" />
                </span>
              )}
              {expr.masteryStatus === 'mastered' && <span />}
              <span
                onClick={(e) => { e.stopPropagation(); openDialog(visibleDialogItems, index) }}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Search className="size-3.5" />
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); handleRemove(expr.id) }}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-500"
              >
                <Trash2 className="size-3.5" />
              </span>
            </div>}
          </button>

          {isExpanded && (
            <div className="border-t border-border/50 px-3 pb-3 pt-2">
              {/* 显示简要意思 */}
              {insight?.kind === 'word' && insight.description && (
                <div className="line-clamp-3 text-xs leading-5 text-muted-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:my-0">
                  <MarkdownContent content={extractCoreUsage(insight.description)} />
                </div>
              )}
              {insight?.kind === 'chunk' && (
                <div className="space-y-2">
                  {insight.description && (
                    <div className="line-clamp-3 text-xs leading-5 text-muted-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:my-0">
                      <MarkdownContent content={extractCoreUsage(insight.description)} />
                    </div>
                  )}
                  {insight.examples?.slice(0, 1).map((example, exampleIndex) => (
                    <div key={`${insight.id}-${exampleIndex}`} className="rounded-md bg-muted/60 p-2.5">
                      <p className="text-xs font-medium text-foreground">{example.en}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{example.zh}</p>
                      {example.note && <p className="mt-1 text-[11px] text-muted-foreground">{example.note}</p>}
                    </div>
                  ))}
                </div>
              )}
              {insight?.kind === 'pattern' && insight.example && (
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('practiceSession.example')}: {insight.example}
                </p>
              )}
              {!insight && (
                <p className="text-xs leading-5 text-muted-foreground">{expr.chunkText || expr.corrected || t('expressionLib.noMeaning')}</p>
              )}

              {/* 展开后显示复习信息 */}
              {/* {expr.lastReviewedAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('expressionLib.lastReview')}{new Date(expr.lastReviewedAt).toLocaleDateString('zh-CN')}
                </p>
              )} */}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const emptyHintMap: Record<string, { icon: React.ReactNode; title: string; hint?: string }> = {
    'words-all': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyWords'), hint: t('expressionLib.hintCollectInUnit') },
    'words-reviewing': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyWords'), hint: t('expressionLib.hintCollectInUnit') },
    'words-learning': { icon: <BookOpen className="size-12" />, title: t('expressionLib.emptyWordsDone') },
    'words-mastered': { icon: <BookOpen className="size-12" />, title: t('expressionLib.emptyWordsDone') },
    'chunk-all': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunks'), hint: t('expressionLib.hintAutoCollect') },
    'chunk-reviewing': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunks'), hint: t('expressionLib.hintAutoCollect') },
    'chunk-learning': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunksDone') },
    'chunk-mastered': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyChunksMastered') },
    'pattern-all': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyPatterns'), hint: t('expressionLib.hintCollectPatterns') },
    'pattern-reviewing': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyPatterns'), hint: t('expressionLib.hintCollectPatterns') },
    'pattern-learning': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyPatternsDone') },
    'pattern-mastered': { icon: <BookMarked className="size-12" />, title: t('expressionLib.emptyPatternsMastered') },
  }

  const emptyKey = `${libraryTab}-${reviewState}`
  const empty = emptyHintMap[emptyKey]
  const virtualRows = useMemo<Array<
    | { kind: 'item'; expression: Expression; index: number; id: string }
    | { kind: 'date'; key: string; label: string; ids: string[] }
  >>(() => {
    if (!groupByDate) return result.items.map((expression, index) => ({ kind: 'item', expression, index, id: expression.id }))
    const formatter = new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
    const groups = new Map<string, { label: string; items: Array<{ expression: Expression; index: number }> }>()
    result.items.forEach((expression, index) => {
      const date = new Date(expression.createdAt)
      const key = Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString().slice(0, 10)
      const label = Number.isNaN(date.getTime()) ? t('expressionLib.unknownDate') : formatter.format(date)
      const group = groups.get(key) ?? { label, items: [] }
      group.items.push({ expression, index })
      groups.set(key, group)
    })
    return Array.from(groups.entries()).flatMap(([key, group]) => [
      { kind: 'date' as const, key, label: group.label, ids: group.items.map(({ expression }) => expression.id) },
      ...group.items.map(({ expression, index }) => ({ kind: 'item' as const, expression, index, id: expression.id })),
    ])
  }, [groupByDate, i18n.language, result.items, t])

  const renderVirtualList = (immersiveClassName: string) => (
    <Virtuoso
      data={virtualRows}
      className="h-full md:h-[calc(100dvh-17rem)]"
      increaseViewportBy={{ top: 360, bottom: 720 }}
      onScroll={(event) => {
        const scroller = event.currentTarget
        const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
        const top = Math.min(maxTop, Math.max(0, scroller.scrollTop))
        const atTop = top <= 2
        const atBottom = top >= maxTop - 2

        // iOS rubber-band scrolling reports tiny reverse deltas at both edges.
        // Treat an edge as stable and require deliberate travel before changing chrome.
        if (atTop) {
          setHeaderCondensed(false)
          headerScrollIntentRef.current = { down: 0, up: 0 }
          listScrollTopRef.current = top
          return
        }
        if (atBottom) {
          listScrollTopRef.current = top
          return
        }

        const delta = top - listScrollTopRef.current
        if (delta > 0.5) {
          headerScrollIntentRef.current.down += delta
          headerScrollIntentRef.current.up = 0
          if (headerScrollIntentRef.current.down >= 24) setHeaderCondensed(true)
        } else if (delta < -0.5) {
          headerScrollIntentRef.current.up -= delta
          headerScrollIntentRef.current.down = 0
          if (headerScrollIntentRef.current.up >= 24) setHeaderCondensed(false)
        }
        listScrollTopRef.current = top
      }}
      components={{
        Scroller: VirtualListScroller,
        Header: () => (
          <div className="mb-2 flex items-center justify-between px-0 pt-0">
            <span className="text-xs text-muted-foreground">{t('expressionLib.tapToExpand')}</span>
            <button onClick={() => openImmersivePlayer(visibleDialogItems, 0)} className={cn('flex items-center gap-1 text-xs', immersiveClassName)}>
              <ExternalLink className="size-3" /> {t('expressionLib.immersive')}
            </button>
          </div>
        ),
        Footer: () => (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {t('expressionLib.totalItems', { count: result.total })}
          </div>
        ),
      }}
      itemContent={(_, row) => {
        if (row.kind === 'item') return <div className="pb-2">{renderExpressionItem(row.expression, row.index)}</div>
        const groupSelected = row.ids.length > 0 && row.ids.every((id) => selectedIds.has(id))
        return <div className="relative flex items-center justify-center py-2">
          <span className="absolute inset-x-0 h-px bg-border/70" />
          <span className="app-surface relative px-3 text-xs font-medium text-muted-foreground">{row.label}</span>
          {selectionMode && <button type="button" className="absolute right-0 pl-3 text-[11px] font-medium text-primary" onClick={() => setSelectedIds((current) => {
            const next = new Set(current)
            if (groupSelected) row.ids.forEach((id) => next.delete(id))
            else row.ids.forEach((id) => next.add(id))
            return next
          })}>{groupSelected ? t('expressionLib.clearSelection') : t('expressionLib.selectDateGroup')}</button>}
        </div>
      }}
    />
  )

  return (
    <div className={cn('mx-auto max-w-2xl px-4 pt-3 md:h-auto', isMobile && 'flex h-full min-h-0 flex-col overflow-hidden pb-0', selectionMode ? 'md:pb-28' : 'md:pb-10')}>
      <header className={cn('mb-4 flex shrink-0 items-center gap-3 transition-[margin] duration-200', headerCondensed && 'mb-2')}>
        <button
          type="button"
          onClick={() => navigate('/expressions')}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
          aria-label={t('learningNotebooks.notebooks')}
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
          <p className={cn('text-xs text-muted-foreground transition-all duration-200', headerCondensed && 'hidden')}>{t('learningNotebooks.notebooks')}</p>
          <h1 className="truncate text-lg font-semibold tracking-tight">{notebookName}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setExpandedItemIds(allExpanded ? new Set() : new Set(result.items.map((item) => item.type === 'word' ? (item.original ?? item.id) : item.id)))} className={cn('flex size-10 items-center justify-center rounded-full transition-colors', allExpanded ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')} aria-label={allExpanded ? t('expressionLib.collapseAll') : t('expressionLib.expandAll')}>
            {allExpanded ? <Minimize2 className="size-4" /> : <Expand className="size-4" />}
          </button>
          <button type="button" onClick={() => { setSelectionMode((value) => !value); setSelectedIds(new Set()) }} className={cn('flex size-10 items-center justify-center rounded-full transition-colors', selectionMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')} aria-label={selectionMode ? t('expressionLib.cancelSelection') : t('expressionLib.batchEdit')}><CheckSquare className="size-4" /></button>
        </div>
      </header>
      <Tabs value={libraryTab} onValueChange={handleLibraryTabChange} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mb-3 w-full rounded-full bg-background/54 backdrop-blur-2xl">
          <TabsTrigger value="words" className="flex-1 rounded-full">{t('expressionLib.words')}</TabsTrigger>
          <TabsTrigger value="chunk" className="flex-1 rounded-full">{t('expressionLib.chunks')}</TabsTrigger>
          <TabsTrigger value="pattern" className="flex-1 rounded-full">{t('expressionLib.patterns')}</TabsTrigger>
        </TabsList>

        <div className={cn('mb-3 flex items-center gap-2 transition-all duration-200', headerCondensed && 'hidden')}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 rounded-xl border-border/60 bg-muted/45 pl-9 text-sm shadow-none focus-visible:bg-background" placeholder={t('expressionLib.searchPlaceholder')} />
          </div>
          <button type="button" onClick={() => setGroupByDate((value) => !value)} className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors', groupByDate ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-muted/45 text-muted-foreground active:bg-muted')} aria-label={t('expressionLib.groupByDate')} aria-pressed={groupByDate}>
            <CalendarDays className="size-4" />
          </button>
          <button type="button" onClick={() => void openExportPreview()} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/45 text-muted-foreground active:bg-muted" aria-label={t('expressionLib.exportPdf')}><Download className="size-4" /></button>
        </div>

        {/* ---- 二级状态过滤 ---- */}
        <div className={cn('mb-4 flex gap-2 overflow-x-auto transition-all duration-200', headerCondensed && 'mb-2')}>
          {filterPills.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setReviewState(item.value)
                setExpandedItemIds(new Set())
              }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                reviewState === item.value
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 两个 TabsContent 共享同一套渲染逻辑 */}
        <TabsContent value="words" forceMount className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          {loading ? (
            <MobilePageLoading rows={3} minHeightClassName="min-h-[32vh]" />
          ) : result.items.length === 0 ? (
            emptyState(empty.icon, empty.title, empty.hint)
          ) : (
            renderVirtualList('text-blue-500 hover:text-blue-600')
          )}
        </TabsContent>

        <TabsContent value="chunk" forceMount className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          {loading ? (
            <MobilePageLoading rows={3} minHeightClassName="min-h-[32vh]" />
          ) : result.items.length === 0 ? (
            emptyState(empty.icon, empty.title, empty.hint)
          ) : (
            renderVirtualList('text-purple-500 hover:text-purple-600')
          )}
        </TabsContent>

        <TabsContent value="pattern" forceMount className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          {loading ? (
            <MobilePageLoading rows={3} minHeightClassName="min-h-[32vh]" />
          ) : result.items.length === 0 ? (
            emptyState(empty.icon, empty.title, empty.hint)
          ) : (
            renderVirtualList('text-violet-500 hover:text-violet-600')
          )}
        </TabsContent>
      </Tabs>

      {selectionMode && <div className="fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-40 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-border/70 bg-background/95 px-3 py-2 shadow-[0_12px_32px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <button type="button" onClick={() => setSelectedIds(allVisibleSelected ? new Set() : new Set(result.items.map((item) => item.id)))} className="shrink-0 text-xs font-medium text-primary">{allVisibleSelected ? t('expressionLib.clearSelection') : t('expressionLib.selectAll')}</button>
        <span className="min-w-0 flex-1 truncate text-center text-xs text-muted-foreground">{t('expressionLib.selectedCount', { count: selectedIds.size })}</span>
        <Button size="sm" className="h-9 shrink-0 rounded-xl px-3 text-xs" disabled={selectedIds.size === 0} onClick={() => void openBatch()}>{t('expressionLib.batchEdit')}</Button>
      </div>}

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="[&>button:last-child]:top-[calc(0.75rem+env(safe-area-inset-top,0px))] flex h-[100svh] max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 text-foreground sm:h-[92svh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-border/60">
          <DialogTitle className="sr-only">{t('expressionLib.exportPdf')}</DialogTitle>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-6 pb-5 pt-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:px-8 sm:pt-5">
            {exportLoading ? <div className="flex h-full min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />{t('expressionLib.loadingPreview')}</div> : (
              <div className="mx-auto flex w-full max-w-[500px] flex-col gap-4">
                <div className="grid grid-cols-3 divide-x divide-border/70 rounded-xl border border-border/70 bg-background text-center text-xs text-foreground">
                  <div className="py-2"><span className="block text-[10px] text-muted-foreground">{t('expressionLib.pdfPages')}</span><strong>{t('expressionLib.pdfPagesCount', { count: exportPages.length })}</strong></div>
                  <div className="py-2"><span className="block text-[10px] text-muted-foreground">{t('expressionLib.pdfItems')}</span><strong>{t('expressionLib.practiceSheetCount', { count: displayExportItems.length })}</strong></div>
                  <div className="py-2"><span className="block text-[10px] text-muted-foreground">{t('expressionLib.pdfWords')}</span><strong>{t('expressionLib.pdfWordsCount', { count: exportWordCount })}</strong></div>
                </div>
                {exportPages.map((pageItems, pageIndex) => <div key={pageIndex} className="mx-auto h-[449px] w-[318px] sm:h-[618px] sm:w-[436px]">
                  <article ref={(node) => { if (node) exportPageRefs.current.set(pageIndex, node); else exportPageRefs.current.delete(pageIndex) }} className="h-[297mm] w-[210mm] origin-top-left scale-[0.4] overflow-hidden rounded-xl bg-white px-5 py-5 text-black shadow-[0_8px_22px_rgba(15,23,42,0.05)] sm:scale-[0.55] sm:px-8">
                  <header className="relative mb-3 border-b border-black/15 px-1 pb-2 text-center">
                    <h2 className="mx-20 text-sm font-semibold">{notebookName} · {exportMode === 'zh-to-en' ? t('expressionLib.chineseList') : exportMode === 'en-to-zh' ? t('expressionLib.englishList') : t('expressionLib.bilingualList')}</h2>
                    <p className="mt-0.5 text-[10px] text-black/70">{t('expressionLib.practiceSheetHint')}</p>
                    <label className="absolute right-0 top-0 flex items-center gap-1 text-[9px] text-black/60"><span>{t('expressionLib.date')}</span><input type="date" value={exportDate} onChange={(event) => setExportDate(event.target.value)} className="h-5 w-[82px] border-0 bg-transparent p-0 text-[8px] text-black outline-none" /></label>
                  </header>
                  <div className={cn('grid gap-2', exportColumns === 2 && 'grid-cols-2')}>
                    {(exportColumns === 2 ? [pageItems.slice(0, Math.ceil(pageItems.length / 2)), pageItems.slice(Math.ceil(pageItems.length / 2))] : [pageItems]).map((tableItems, tableIndex) => <table key={tableIndex} className="w-full table-fixed border-collapse text-[8px]">
                      <thead className="bg-orange-100"><tr><th className="w-5 border border-orange-200 py-1 text-center">#</th><th className="border border-orange-200 px-1 text-left">{exportMode === 'bilingual' ? (exportColumns === 1 ? t('expressionLib.tableBilingual') : tableIndex === 0 ? t('expressionLib.tableEnglish') : t('expressionLib.tableChinese')) : exportMode === 'zh-to-en' ? t('expressionLib.tableChinese') : t('expressionLib.tableEnglish')}</th><th className="w-[42%] border border-orange-200 px-1 text-left">{t('expressionLib.tableAnswer')}</th><th className="w-5 border border-orange-200 text-center">□</th></tr></thead>
                      <tbody>{tableItems.map((item, index) => {
                        const absoluteIndex = pageIndex * exportItemsPerPage + (tableIndex === 0 ? index : Math.ceil(pageItems.length / 2) + index)
                        const english = item.type === 'word' ? (item.original ?? '') : (item.chunkText ?? item.corrected ?? '')
                        const chinese = item.type === 'word' ? (item.vocabulary?.meaning ?? item.corrected ?? '') : (item.original ?? '')
                        const prompt = exportMode === 'bilingual' ? (exportColumns === 1 ? `${english} · ${chinese}` : tableIndex === 0 ? english : chinese) : exportMode === 'zh-to-en' ? chinese : english
                        return <tr key={item.id} className="h-6"><td className="border border-orange-100 text-center text-black/55">{absoluteIndex + 1}</td><td className="border border-orange-100 px-1 font-medium">{prompt || english}</td><td className="border border-orange-100 px-1" /><td className="border border-orange-100 text-center text-black/55">□</td></tr>
                      })}</tbody>
                    </table>)}
                  </div>
                  <footer className="mt-3 pt-1.5 text-right text-[9px] text-black/60">{t('expressionLib.pdfPageNumber', { current: pageIndex + 1, total: exportPages.length })}</footer>
                  </article>
                </div>)}
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-border/60 bg-background px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4">
            <div className="grid grid-cols-3 gap-2">
              {(['zh-to-en', 'en-to-zh', 'bilingual'] as ExportMode[]).map((mode) => <button key={mode} type="button" onClick={() => setExportMode(mode)} className={cn('min-h-[76px] rounded-xl border px-2 py-2 text-left transition-colors', exportMode === mode ? 'border-primary bg-primary/8 text-primary' : 'border-border/70 bg-background text-muted-foreground')}>
                {mode === 'bilingual' ? <FileText className="size-3.5" /> : <Languages className="size-3.5" />}
                <span className="mt-1 block text-xs font-semibold">{mode === 'zh-to-en' ? t('expressionLib.chineseList') : mode === 'en-to-zh' ? t('expressionLib.englishList') : t('expressionLib.bilingualList')}</span>
                <span className="mt-0.5 block text-[10px] leading-3 text-muted-foreground">{mode === 'zh-to-en' ? t('expressionLib.chineseListDesc') : mode === 'en-to-zh' ? t('expressionLib.englishListDesc') : t('expressionLib.bilingualListDesc')}</span>
              </button>)}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border/70 px-4 py-2.5">
              <span className="text-sm font-semibold">{t('expressionLib.exportColumns')}</span>
              <div className="flex rounded-lg bg-muted p-0.5"><button type="button" onClick={() => setExportColumns(1)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium', exportColumns === 1 ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>{t('expressionLib.oneColumn')}</button><button type="button" onClick={() => setExportColumns(2)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium', exportColumns === 2 ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>{t('expressionLib.twoColumns')}</button></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
              <span className="text-sm font-semibold">{t('expressionLib.shuffleExport')}</span>
              <Switch checked={shuffleExport} onCheckedChange={setShuffleExport} />
            </div>
            <Button className="mt-3 h-12 w-full rounded-xl text-base font-semibold" onClick={printExportPreview} disabled={exportLoading || displayExportItems.length === 0}>{t('expressionLib.exportPdfAction')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Drawer open={batchOpen} onOpenChange={(open) => { setBatchOpen(open); if (!open) setBatchCreatingNotebook(false) }}>
        <DrawerContent className="max-h-[86svh] rounded-t-[28px]">
          <DrawerHeader className="text-left"><DrawerTitle>{t('expressionLib.batchEdit')}</DrawerTitle><DrawerDescription>{t('expressionLib.selectedCount', { count: selectedNotebookItemIds.length })}</DrawerDescription></DrawerHeader>
          {!batchAction ? (
            <div className="grid gap-2 px-4">
              <Button variant="outline" className="justify-start" onClick={() => setBatchAction('notebook')}>{t('expressionLib.addToNotebook')}</Button>
              <Button variant="outline" className="justify-start" onClick={() => setBatchAction('status')}>{t('expressionLib.changeStatus')}</Button>
            </div>
          ) : batchAction === 'status' ? (
            <div className="grid grid-cols-3 gap-2 px-4">
              {(['learning', 'reviewing', 'mastered'] as MasteryStatus[]).map((status) => <button key={status} type="button" onClick={() => setBatchStatus(status)} className={cn('rounded-xl border px-2 py-3 text-xs font-medium', batchStatus === status ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>{status === 'learning' ? t('expressionLib.learning') : status === 'reviewing' ? t('expressionLib.reviewing') : t('expressionLib.mastered')}</button>)}
            </div>
          ) : batchCreatingNotebook ? (
            <div className="px-4">
              <Label htmlFor="new-notebook">{t('learningNotebooks.name')}</Label>
              <Input id="new-notebook" value={newNotebookName} onChange={(event) => setNewNotebookName(event.target.value)} className="mt-2" maxLength={30} autoFocus placeholder={t('learningNotebooks.namePlaceholder')} />
            </div>
          ) : (
            <div className="min-h-0 overflow-y-auto px-4">
              <div className="flex flex-col gap-2">
                {notebooks.map((notebook) => {
                  const checked = targetNotebookId === notebook.id
                  return <button key={notebook.id} type="button" onClick={() => setTargetNotebookId(notebook.id)} className={cn('flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition-colors', checked ? 'border-primary bg-primary/5' : 'border-border bg-card')}>
                    <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md border', checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                      {checked && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">{notebook.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{t('learningNotebooks.totalItems', { count: notebook.counts?.total ?? 0 })}</span>
                    </span>
                  </button>
                })}
                <Button type="button" variant="outline" className="justify-start" onClick={() => setBatchCreatingNotebook(true)}><Plus data-icon="inline-start" />{t('learningNotebooks.createNew')}</Button>
              </div>
            </div>
          )}
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {batchAction && (batchAction !== 'notebook' || !batchCreatingNotebook) && <Button onClick={() => void applyBatch()} disabled={batchBusy || (batchAction === 'notebook' && !targetNotebookId)}>{t('expressionLib.apply')}</Button>}
            {batchAction === 'notebook' && batchCreatingNotebook && <Button onClick={() => void createBatchNotebook()} disabled={batchBusy}>{t('learningNotebooks.createAndSelect')}</Button>}
            <Button variant="outline" onClick={() => batchCreatingNotebook ? setBatchCreatingNotebook(false) : batchAction ? setBatchAction(null) : setBatchOpen(false)}>{batchCreatingNotebook || batchAction ? t('learningNotebooks.back') : t('learningNotebooks.cancel')}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <LearningInsightDialog
        items={dialogItems} index={dialogIndex} open={dialogOpen}
        onOpenChange={setDialogOpen} onIndexChange={setDialogIndex}
        hideSaveActions
      />
      <ImmersivePlayerDialog
        items={immersiveItems}
        index={Math.min(immersiveIndex, Math.max(immersiveItems.length - 1, 0))}
        open={immersiveOpen}
        onOpenChange={setImmersiveOpen}
        onIndexChange={setImmersiveIndex}
      />
    </div>
  )
}
