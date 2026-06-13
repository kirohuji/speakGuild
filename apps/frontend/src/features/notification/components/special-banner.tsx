import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  markAsRead,
  type NotificationItem,
  type SpecialNotification,
} from '@/features/notification/api'
import { useNotificationStore } from '@/features/notification/store'
import { useHomeStore } from '@/stores/home.store'
import { NotificationDetailSheet } from './notification-detail-sheet'

function toNotificationItem(item: SpecialNotification | null): NotificationItem | null {
  if (!item) return null
  return {
    ...item,
    type: 'broadcast',
    sentById: '',
    updatedAt: item.createdAt,
    isRead: false,
    readAt: null,
  }
}

export function SpecialBanner() {
  // 数据来源：home.store（首页统一管理）
  const storeNotifs = useHomeStore((s) => s.specialNotifications)
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount)

  // 🧪 test=3 注入模拟通知
  const location = useLocation()
  const searchStr = location.search || (
    typeof window !== 'undefined'
      ? (() => { const i = window.location.hash.indexOf('?'); return i >= 0 ? window.location.hash.slice(i) : '' })()
      : ''
  )
  const isTestMode = new URLSearchParams(searchStr).get('test') === '3'
  const testInjectedRef = useRef(false)

  useEffect(() => {
    if (isTestMode && !testInjectedRef.current) {
      testInjectedRef.current = true
      const timer = setTimeout(() => {
        useHomeStore.setState({
          specialNotifications: [
            {
              id: 'test-notification-3',
              title: '🎉 测试活动通知',
              content: '这是一条测试用的活动通知。\n\n你可以在此查看活动详情内容，图片和文字都可以正常展示。',
              imageUrl: 'https://picsum.photos/400/300?random=1',
              createdAt: new Date().toISOString(),
            },
          ],
        })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isTestMode])

  // 本地 UI 状态
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [popupOpen, setPopupOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const autoPopped = useRef(false)

  // 过滤已 dismiss 的通知
  const notifs = storeNotifs.filter((n) => !dismissedIds.has(n.id))

  const currentNotification = notifs[currentIndex] ?? null
  const detailItem = toNotificationItem(currentNotification)

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
    setDismissedIds((prev) => new Set(prev).add(currentNotification.id))
    setPopupOpen(false)
    setDetailOpen(false)
    setCurrentIndex(0)
    autoPopped.current = false
  }, [currentNotification, fetchUnreadCount])

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

      <NotificationDetailSheet
        item={detailItem}
        open={detailOpen}
        onClose={dismissAndMarkRead}
      />
    </>
  )
}
