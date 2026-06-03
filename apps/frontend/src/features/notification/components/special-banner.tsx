import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  getSpecialNotifications, markAsRead,
  type SpecialNotification,
} from '@/features/notification/api'
import { useNotificationStore } from '@/features/notification/store'
import { useIsMobile } from '@/hooks/use-mobile'

export function SpecialBanner() {
  const [notifs, setNotifs] = useState<SpecialNotification[]>([])
  const isMobile = useIsMobile()
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [popupOpen, setPopupOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const autoPopped = useRef(false)

  useEffect(() => {
    getSpecialNotifications().then(setNotifs).catch(() => {})
  }, [])

  const currentNotification = notifs[currentIndex] ?? null

  // ── 自动弹出居中卡片 ──
  useEffect(() => {
    if (autoPopped.current) return
    if (notifs.length === 0) return
    const firstWithImage = notifs.findIndex((n) => n.imageUrl)
    if (firstWithImage !== -1) {
      autoPopped.current = true
      setCurrentIndex(firstWithImage)
      // 延迟等页面入场动画走完再弹出
      const timer = setTimeout(() => setPopupOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [notifs])

  // ── 关闭弹窗并标记已读 ──
  const dismissAndMarkRead = useCallback(async () => {
    if (!currentNotification) return
    await markAsRead(currentNotification.id).catch(() => {})
    void fetchUnreadCount()
    const remaining = notifs.filter((_, i) => i !== currentIndex)
    setNotifs(remaining)
    setPopupOpen(false)
    setDetailOpen(false)
    setCurrentIndex(0)
    autoPopped.current = false
  }, [currentNotification, currentIndex, notifs, fetchUnreadCount])

  // ── "立即查看"：关闭弹窗，打开详情 ──
  const handleViewDetail = useCallback(() => {
    setPopupOpen(false)
    // 等弹窗关闭动画完成后再打开详情
    setTimeout(() => setDetailOpen(true), 200)
  }, [])

  // ── 无图片的横幅卡片 ──
  const bannerNotifs = notifs.filter((n) => !n.imageUrl)
  const showBanner = bannerNotifs.length > 0 && !popupOpen && !detailOpen
  const bannerNotification = bannerNotifs[0] ?? null

  return (
    <>
      {/* 无图片的横幅卡片 */}
      {showBanner && bannerNotification && (
        <AnimatePresence mode="wait">
          <motion.button
            key={bannerNotification.id}
            type="button"
            onClick={() => {
              const idx = notifs.findIndex((n) => n.id === bannerNotification.id)
              if (idx !== -1) setCurrentIndex(idx)
              setDetailOpen(true)
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 mx-auto mt-2 w-[88vw] max-w-[360px] overflow-hidden rounded-2xl border border-border/50 bg-card text-left shadow-xs active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-center px-5 py-8 text-center">
              <p className="text-[15px] font-semibold text-foreground">
                {bannerNotification.title}
              </p>
            </div>
          </motion.button>
        </AnimatePresence>
      )}

      {/* ── 居中弹窗卡片（有图片的特殊通知） ── */}
      <Dialog open={popupOpen} onOpenChange={(v) => { if (!v) dismissAndMarkRead() }}>
        <DialogContent
          className="flex flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-xl size-[80vw] max-w-[400px] max-h-[400px] [&>button]:hidden"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">{currentNotification?.title}</DialogTitle>
          <DialogDescription className="sr-only">
            {currentNotification?.createdAt ?? ''}
          </DialogDescription>

          {/* 关闭按钮 */}
          <div className="absolute right-3 top-3 z-10">
            <button
              type="button"
              onClick={dismissAndMarkRead}
              className="flex size-7 items-center justify-center rounded-full bg-white text-muted-foreground/60 shadow-sm transition-colors hover:bg-gray-100"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* 图片 — 点击打开详情 */}
          {currentNotification?.imageUrl && (
            <div
              role="button"
              tabIndex={0}
              onClick={handleViewDetail}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleViewDetail() }}
              className="block w-full overflow-hidden cursor-pointer focus-visible:outline-none"
            >
              <img
                src={currentNotification.imageUrl}
                alt={currentNotification.title}
                className="w-full object-cover pointer-events-none"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 详情页（"立即查看"后打开） ── */}
      {isMobile ? (
        <Dialog open={detailOpen} onOpenChange={(v) => { if (!v) dismissAndMarkRead() }}>
          <DialogContent
            className="left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 pt-safe text-foreground shadow-none sm:rounded-none [&>button]:hidden"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogTitle className="sr-only">{currentNotification?.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {currentNotification?.createdAt ?? ''}
            </DialogDescription>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-border/45 bg-background/95 px-4 pb-3 pt-3 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 rounded-full"
                    onClick={dismissAndMarkRead}
                    aria-label="关闭"
                  >
                    <ArrowLeft className="size-5" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold tracking-tight text-foreground">
                      {currentNotification?.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {currentNotification?.createdAt
                        ? new Date(currentNotification.createdAt).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-5">
                {currentNotification?.imageUrl && (
                  <div className="mb-5 overflow-hidden rounded-xl">
                    <img
                      src={currentNotification.imageUrl}
                      alt={currentNotification.title}
                      className="w-full object-cover"
                    />
                  </div>
                )}
                {currentNotification && (
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground [&_img]:w-full [&_img]:rounded-xl"
                    dangerouslySetInnerHTML={{ __html: currentNotification.content }}
                  />
                )}
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline"
                    className="rounded-full px-6 text-sm"
                    onClick={dismissAndMarkRead}
                  >
                    我知道了
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={detailOpen} onOpenChange={(v) => { if (!v) dismissAndMarkRead() }}>
          <SheetContent
            side="right"
            className="flex flex-col bg-background p-0 text-foreground sm:max-w-[480px] [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:p-2"
          >
            <SheetHeader className="flex-shrink-0 border-b border-border/45 px-5 pb-4 pt-3 text-left">
              <div className="flex items-start gap-3 pr-10">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="line-clamp-2 text-base font-semibold leading-tight tracking-tight">
                      {currentNotification?.title}
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-xs">
                      {currentNotification?.createdAt
                        ? new Date(currentNotification.createdAt).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </SheetDescription>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4">
              {currentNotification?.imageUrl && (
                <div className="mb-5 overflow-hidden rounded-xl">
                  <img
                    src={currentNotification.imageUrl}
                    alt={currentNotification.title}
                    className="w-full object-cover"
                  />
                </div>
              )}
              {currentNotification && (
                <div
                  className="prose prose-sm max-w-none text-muted-foreground [&_img]:w-full [&_img]:rounded-xl"
                  dangerouslySetInnerHTML={{ __html: currentNotification.content }}
                />
              )}
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-full px-6 text-sm"
                  onClick={dismissAndMarkRead}
                >
                  我知道了
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
