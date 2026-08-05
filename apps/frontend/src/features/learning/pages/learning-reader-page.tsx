import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { ReactReader, ReactReaderStyle, type IReactReaderStyle } from 'react-reader'
import {
  ArrowLeft, BookOpen, Info, List, Loader2, Minus, Plus,
  Settings, Sun, Moon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { localDb } from '@/lib/offline/unified-storage'
import { useLearningStore } from '@/stores/learning.store'

const PROGRESS_KEY = (unitId: string) => `manyu:novel-progress:${unitId}`
// 阅读器主题与全局主题统一：
//  - 深/浅模式跟随全局（next-themes），全局切深色 → 阅读器自动深色
//  - 浅色模式下可选手纸：白（light）/ 护眼（sepia）
const LIGHT_PAPER_KEY = 'manyu:reader-light-theme'
const LEGACY_THEME_KEY = 'manyu:reader-theme'
const SCROLL_KEY = 'manyu:reader-scroll'

type ReaderTheme = 'light' | 'sepia' | 'dark'

// 仅用于 epub 内容 iframe 的「纸面」颜色（iframe 内无法读取应用 CSS 变量），
// 深色与全局 --background/--card 对齐；周围 UI 一律使用语义化 token
const THEME_COLORS: Record<ReaderTheme, { bg: string; text: string; tocBg: string; tocText: string }> = {
  light: { bg: '#ffffff', text: '#1f2d3d', tocBg: '#f4faf7', tocText: '#1f2d3d' },
  sepia:  { bg: '#fdf6e3', text: '#5c4b3a', tocBg: '#f5ecd7', tocText: '#5c4b3a' },
  dark:   { bg: '#0a0712', text: '#e6e3eb', tocBg: '#161023', tocText: '#e6e3eb' },
}

const FONT_SIZES = [14, 16, 18, 20, 22, 24]
const DEFAULT_FONT_SIZE = 18

function updateRenditionTheme(rendition: any, theme: ReaderTheme) {
  const c = THEME_COLORS[theme]
  const themes = rendition.themes
  themes.override('color', c.text)
  themes.override('background', c.bg)
}

async function resolveEpubUrl(assetId: string): Promise<string> {
  const cached = await localDb.get<{ localUri?: string; status?: string }>('local_assets', assetId)
  if (cached?.status === 'ready' && cached.localUri) return cached.localUri
  return ''
}

export function LearningReaderPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const unit = useLearningStore((s) => s.unitDetail)
  const fetchUnitDetail = useLearningStore((s) => s.fetchUnitDetail)
  const [loading, setLoading] = useState(true)
  const [epubUrl, setEpubUrl] = useState<string>('')
  const [location, setLocation] = useState<string | number>(0)
  const { resolvedTheme, setTheme: setGlobalTheme } = useTheme()
  // 浅色模式下的「纸面」偏好（白 / 护眼）；深色模式直接跟随全局主题
  const [lightPaper, setLightPaper] = useState<'light' | 'sepia'>(() => {
    const legacy = localStorage.getItem(LEGACY_THEME_KEY)
    if (legacy === 'sepia') return 'sepia'
    return localStorage.getItem(LIGHT_PAPER_KEY) === 'sepia' ? 'sepia' : 'light'
  })
  // 有效主题：全局为深色 → 阅读器深色；全局为浅色 → 用户选择的纸面
  const theme: ReaderTheme = resolvedTheme === 'dark' ? 'dark' : lightPaper
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)
  const [pct, setPct] = useState(0)
  const [infoOpen, setInfoOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scrollMode, setScrollMode] = useState(() =>
    localStorage.getItem(SCROLL_KEY) === 'true',
  )
  const [pageLoading, setPageLoading] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renditionRef = useRef<any>(undefined)
  const readerRef = useRef<any>(null)

  useEffect(() => { if (!unitId) return; setLoading(true); fetchUnitDetail(unitId) }, [unitId, fetchUnitDetail])

  useEffect(() => {
    if (!unit || unit.id !== unitId) return
    const assetId = unit.novelPackage?.epubAssetId
    if (!assetId) { setLoading(false); return }
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY(unitId)) || '{}')
      if (saved.cfi) setLocation(saved.cfi)
      if (saved.percentage != null) setPct(Math.round(saved.percentage * 100))
    } catch { /* ignore */ }
    resolveEpubUrl(assetId).then((url) => { if (url) setEpubUrl(url); setLoading(false) })
      .catch(() => setLoading(false))
  }, [unit, unitId])

  useEffect(() => { localStorage.setItem(LIGHT_PAPER_KEY, lightPaper) }, [lightPaper])
  useEffect(() => { localStorage.setItem(SCROLL_KEY, String(scrollMode)) }, [scrollMode])

  // 主题切换时更新 epub.js 内部颜色
  useEffect(() => {
    if (renditionRef.current) {
      updateRenditionTheme(renditionRef.current, theme)
    }
  }, [theme])

  // 字号变化时更新 epub.js
  useEffect(() => {
    const rendition = renditionRef.current
    if (rendition?.themes?.fontSize) {
      rendition.themes.fontSize(`${fontSize}px`)
    }
  }, [fontSize])

  const handleLocation = useCallback((epubcfi: string) => {
    setLocation(epubcfi)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (!unitId) return
      const rendition = renditionRef.current
      const current = rendition?.currentLocation?.()
      const percentage = Number(current?.start?.percentage ??
        rendition?.book?.locations?.percentageFromCfi?.(epubcfi) ?? 0)
      const val = Number.isFinite(percentage) ? Math.max(0, Math.min(1, percentage)) : 0
      setPct(Math.round(val * 100))
      localStorage.setItem(PROGRESS_KEY(unitId), JSON.stringify({ cfi: epubcfi, percentage: val, updatedAt: Date.now() }))
    }, 800)
  }, [unitId])

  // 在阅读器内切换主题时同步切换全局主题，保证整站一致
  const selectTheme = useCallback((t: ReaderTheme) => {
    if (t === 'dark') {
      setGlobalTheme('dark')
    } else {
      setLightPaper(t)
      setGlobalTheme('light')
    }
  }, [setGlobalTheme])

  const c = THEME_COLORS[theme]
  const readerStyles: IReactReaderStyle = {
    ...ReactReaderStyle,
    container: { ...ReactReaderStyle.container, background: c.bg },
    readerArea: { ...ReactReaderStyle.readerArea, background: c.bg, transition: undefined },
    titleArea: { display: 'none' },
    reader: { ...ReactReaderStyle.reader, color: c.text, fontSize },
    arrow: { ...ReactReaderStyle.arrow, display: 'none' },
    arrowHover: { ...ReactReaderStyle.arrowHover, display: 'none' },
    tocBackground: { background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' },
    toc: {
      ...ReactReaderStyle.toc,
      background: c.tocBg, color: c.tocText,
      width: '80vw', maxWidth: 320,
      boxShadow: '-8px 0 24px rgba(0,0,0,0.15)', fontFamily: 'inherit',
    },
    tocArea: { ...ReactReaderStyle.tocArea, background: c.tocBg },
    tocAreaButton: {
      ...ReactReaderStyle.tocAreaButton,
      color: c.tocText, background: 'transparent',
      borderBottom: '1px solid rgba(128,128,128,0.15)',
      fontSize: 14, fontWeight: 500, lineHeight: 1.5,
    },
    tocButton: { display: 'none' },
    tocButtonExpanded: { display: 'none' },
    tocButtonBar: {},
    tocButtonBarTop: {},
    tocButtonBottom: {},
  }

  const novelMeta = unit?.novelPackage?.metadata
  const title = novelMeta?.title ?? unit?.title ?? '阅读'

  // epubOptions：滚动模式 vs 翻页模式
  const epubOptions = scrollMode
    ? { flow: 'scrolled' as const, manager: 'continuous' as const, spread: 'none' as const }
    : { flow: 'paginated' as const, manager: 'default' as const, spread: 'none' as const }

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!epubUrl && !novelMeta) {
    return (
      <div className="flex h-[100dvh] flex-col bg-background">
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
          <Button variant="ghost" size="icon" className="size-10" asChild>
            <Link to={`/learning/units/${unitId}`}><ArrowLeft className="size-6" /></Link>
          </Button>
          <span className="text-sm font-semibold">阅读</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
          <div><BookOpen className="mx-auto mb-3 size-10 text-muted-foreground/40" /><p>后台还没有上传 EPUB</p></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* ── Header（安全区 padding 已由根布局 main 提供，这里不再重复加 pt-safe）── */}
      <div className="flex shrink-0 items-center border-b border-border/60 bg-background px-2 pt-2">
        {/* 左：返回 + 目录 */}
        <div className="flex items-center gap-1 w-[88px] shrink-0 h-12 ">
          <Button variant="ghost" size="icon" className="size-10" asChild>
            <Link to={`/learning/units/${unitId}`}><ArrowLeft className="size-6" /></Link>
          </Button>
          <Button variant="ghost" size="icon" className="size-10" onClick={() => readerRef.current?.toggleToc?.()}>
            <List className="size-8" />
          </Button>
        </div>

        {/* 中：书名 */}
        <div className="min-w-0 flex-1 text-center px-1">
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>

        {/* 右：设置 + 信息 */}
        <div className="flex items-center justify-end gap-1 w-[88px] shrink-0">
          <Button variant="ghost" size="icon" className="size-10" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-6" />
          </Button>
          <Button variant="ghost" size="icon" className="size-10" onClick={() => setInfoOpen(true)}>
            <Info className="size-6" />
          </Button>
        </div>
      </div>

      {/* ── 阅读区 ── */}
      <div className="min-h-0 flex-1 relative [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        {pageLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: c.bg }}>
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {epubUrl ? (
          <ReactReader
            key={`${unitId}-${scrollMode}`}
            ref={readerRef}
            url={epubUrl}
            title={title}
            location={location}
            locationChanged={handleLocation}
            getRendition={(_rendition: any) => {
              renditionRef.current = _rendition
              updateRenditionTheme(_rendition, theme)
              void _rendition.book.locations.generate(1600).catch(() => undefined)
              // 章节切换时显示 loading
              _rendition.on('relocated', () => setPageLoading(false))
              _rendition.on('renderstarted', () => setPageLoading(true))
            }}
            readerStyles={readerStyles}
            epubOptions={epubOptions}
            showToc
            swipeable={!scrollMode}
            epubInitOptions={{ openAs: 'epub' }}
          />
        ) : (
          <div className="flex h-full items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        )}
      </div>

      {/* ── 底部进度条 ── */}
      <div className="shrink-0 border-t border-border/60 bg-background px-4 pb-safe">
        <div className="flex items-center gap-3 h-12">
          <span className="text-sm tabular-nums opacity-60 shrink-0">{pct}%</span>
          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted/60">
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* ── 设置 Drawer（底部） ── */}
      <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DrawerContent className="mx-auto max-w-md rounded-t-[28px] border-border/70 drawer-surface bg-background text-foreground">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-semibold">阅读设置</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 pb-8 space-y-6">
            {/* 字号 */}
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">字号</p>
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" size="icon" className="size-10 rounded-full" disabled={fontSize <= FONT_SIZES[0]}
                  onClick={() => setFontSize((s) => { const i = FONT_SIZES.indexOf(s); return i > 0 ? FONT_SIZES[i-1] : s })}>
                  <Minus className="size-4" /></Button>
                <span className="w-12 text-center text-xl font-bold tabular-nums">{fontSize}</span>
                <Button variant="outline" size="icon" className="size-10 rounded-full" disabled={fontSize >= FONT_SIZES[FONT_SIZES.length-1]}
                  onClick={() => setFontSize((s) => { const i = FONT_SIZES.indexOf(s); return i < FONT_SIZES.length-1 ? FONT_SIZES[i+1] : s })}>
                  <Plus className="size-4" /></Button>
              </div>
            </div>

            <Separator />

            {/* 主题预设 */}
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">阅读主题</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: 'light' as ReaderTheme, icon: Sun, label: '浅色', desc: '白底黑字', bg: '#ffffff', text: '#1f2d3d' },
                  { key: 'sepia' as ReaderTheme, icon: BookOpen, label: '护眼', desc: '暖黄柔和', bg: '#fdf6e3', text: '#5c4b3a' },
                  { key: 'dark' as ReaderTheme, icon: Moon, label: '深色', desc: '跟随全局深色', bg: '#0a0712', text: '#e6e3eb' },
                ]).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => selectTheme(t.key)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl p-3 transition-all',
                      theme === t.key
                        ? 'bg-accent/10 ring-2 ring-accent'
                        : 'bg-muted/40 hover:bg-muted/60',
                    )}
                  >
                    <div
                      className="flex size-10 items-center justify-center rounded-full border-none shadow-none"
                      style={{ background: t.bg, color: t.text }}
                    >
                      <t.icon className="size-5" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* 滚动模式 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">上下滚动阅读</p>
                <p className="text-xs text-muted-foreground">关闭则为左右翻页模式</p>
              </div>
              <Switch checked={scrollMode} onCheckedChange={setScrollMode} />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── 书籍信息 Sheet（右侧） ── */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="w-[80vw] max-w-sm border-border/60 bg-background p-0 text-foreground">
          <SheetHeader className="border-b border-border/60 px-5 py-4">
            <SheetTitle className="text-base font-semibold">书籍信息</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {unit?.coverImage && (
              <div className="mx-auto w-36 overflow-hidden rounded-xl shadow-md">
                <img src={unit.coverImage} alt={title} className="w-full object-cover" />
              </div>
            )}
            <div className="space-y-2.5 text-sm">
              <InfoRow label="书名" value={novelMeta?.title ?? title} bold />
              {novelMeta?.author && <InfoRow label="作者" value={novelMeta.author} />}
              {novelMeta?.publisher && <InfoRow label="出版社" value={novelMeta.publisher} />}
              <Separator />
              <InfoRow label="阅读进度" value={`${pct}%`} bold />
              <InfoRow label="章节数" value={`${(unit?.novelPackage?.toc as any[])?.length ?? '—'} 章`} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-right max-w-[60%] truncate', bold && 'font-semibold')}>{value}</span>
    </div>
  )
}
