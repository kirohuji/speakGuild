import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
import { NotificationStickerImage } from './notification-sticker'

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
  const { t } = useTranslation()
  const storeNotifs = useHomeStore((s) => s.specialNotifications)
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount)

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
              title: '测试活动通知',
              content: '这是一条测试用的活动通知。\n\n你可以在此查看活动详情内容，图片和文字都可以正常展示。',
              imageUrl: '/special-sticker-test.png',
              createdAt: new Date().toISOString(),
            },
          ],
        })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isTestMode])

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [popupOpen, setPopupOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const autoPopped = useRef(false)

  const notifs = storeNotifs.filter((n) => !dismissedIds.has(n.id))

  const currentNotification = notifs[currentIndex] ?? null
  const detailItem = toNotificationItem(currentNotification)

  useEffect(() => {
    if (autoPopped.current) return
    if (notifs.length === 0) return
    const firstWithImage = notifs.findIndex((n) => n.imageUrl)
    if (firstWithImage !== -1) {
      autoPopped.current = true
      setCurrentIndex(firstWithImage)
      const timer = setTimeout(() => setPopupOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [notifs])

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

  const handleViewDetail = useCallback(() => {
    setPopupOpen(false)
    setTimeout(() => setDetailOpen(true), 200)
  }, [])

  const bannerNotifs = notifs.filter((n) => !n.imageUrl)
  const showBanner = bannerNotifs.length > 0 && !popupOpen && !detailOpen
  const bannerNotification = bannerNotifs[0] ?? null

  return (
    <>
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

      {/* 有图：透明贴图浮层（不规则边缘靠素材 alpha + drop-shadow） */}
      <Dialog open={popupOpen} onOpenChange={(v) => { if (!v) dismissAndMarkRead() }}>
        <DialogContent
          overlayClassName="bg-black/20"
          className="flex w-auto max-w-none translate-x-[-50%] translate-y-[-50%] flex-col items-center gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none sm:rounded-none [&>button]:hidden"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">{currentNotification?.title}</DialogTitle>
          <DialogDescription className="sr-only">
            {currentNotification?.createdAt ?? ''}
          </DialogDescription>

          <div className="relative">
            <button
              type="button"
              onClick={dismissAndMarkRead}
              className="absolute -right-1 -top-1 z-10 flex size-11 items-center justify-center border-0 bg-transparent p-0 text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] transition-opacity hover:opacity-80"
              aria-label={t('common.close')}
            >
              <X className="size-7" strokeWidth={2.25} />
            </button>

            {currentNotification?.imageUrl && (
              <NotificationStickerImage
                src={currentNotification.imageUrl}
                alt={currentNotification.title}
                onClick={handleViewDetail}
              />
            )}
          </div>
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
