import { useState, useEffect } from 'react'
import { Megaphone, X, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  getSpecialNotifications, markAsRead,
  type SpecialNotification,
} from '@/features/notification/api'
import { useNotificationStore } from '@/features/notification/store'

export function SpecialBanner() {
  const [notifs, setNotifs] = useState<SpecialNotification[]>([])
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    getSpecialNotifications().then(setNotifs).catch(() => {})
  }, [])

  const currentNotification = notifs[currentIndex] ?? null

  const handleClick = () => {
    if (!currentNotification) return
    setDetailOpen(true)
  }

  const handleClose = async () => {
    if (!currentNotification) return
    await markAsRead(currentNotification.id).catch(() => {})
    void fetchUnreadCount()
    const remaining = notifs.filter((_, i) => i !== currentIndex)
    setNotifs(remaining)
    setDetailOpen(false)
    setCurrentIndex(0)
  }

  if (notifs.length === 0) return null

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.button
          key={currentNotification?.id}
          type="button"
          onClick={handleClick}
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto mt-2 w-full max-w-[330px] overflow-hidden rounded-2xl bg-amber-400/[0.08] backdrop-blur-xl active:scale-[0.98] transition-transform"
        >
          {/* 内容 */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
            {/* 图标徽章 */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_3px_10px_rgba(245,158,11,.3)]">
              <Megaphone className="size-[15px] text-white" />
            </div>

            {/* 文字 */}
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[13px] font-semibold text-amber-100">
                {currentNotification.title}
              </p>
              <p className="mt-0.5 text-[10px] text-amber-400/50">点击查看详情</p>
            </div>

            {/* 右侧指示器 */}
            <div className="flex shrink-0 items-center gap-2">
              {notifs.length > 1 && (
                <div className="flex items-center gap-1">
                  {notifs.slice(0, Math.min(notifs.length, 3)).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'size-1.5 rounded-full transition-colors',
                        i === currentIndex ? 'bg-amber-400' : 'bg-amber-400/25',
                      )}
                    />
                  ))}
                </div>
              )}
              <ChevronRight className="size-4 text-amber-400/50" />
            </div>
          </div>
        </motion.button>
      </AnimatePresence>

      {/* 详情 Drawer */}
      <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-border/70 bg-background">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <div className="flex items-start justify-between gap-3">
              <DrawerTitle className="text-base">{currentNotification?.title}</DrawerTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full"
                onClick={handleClose}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-8">
            {currentNotification && (
              <div className="prose prose-sm max-w-none text-muted-foreground [&_img]:rounded-xl [&_img]:w-full"
                dangerouslySetInnerHTML={{ __html: currentNotification.content }}
              />
            )}
            <div className="mt-6 flex justify-center">
              <Button onClick={handleClose} className="gap-2">
                我知道了
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
