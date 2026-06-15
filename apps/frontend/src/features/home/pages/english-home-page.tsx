import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTheme } from 'next-themes'
import {
  BookOpen, Gift,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@/lib/cn'
import { ImmersiveBackground } from '@/components/common/immersive-background'
import { SpecialBanner } from '@/features/notification/components/special-banner'
import { useHomeStore } from '@/stores/home.store'
import { toast } from 'sonner'

function useClock() {
  const { t } = useTranslation()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const period = now.getHours() < 12 ? t('home.am') : t('home.pm')

  return { hours, minutes, period }
}

export function EnglishHomePage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { resolvedTheme, theme } = useTheme()
  const location = useLocation()
  const clock = useClock()
  const isDark = resolvedTheme === 'dark' || theme === 'dark'

  // 首页 store：每日句子 & 签到状态（同一天缓存，不重复请求）
  const dailySentence = useHomeStore((s) => s.dailySentence)
  const sentenceLoading = useHomeStore((s) => s.sentenceLoading)
  const checkInStatus = useHomeStore((s) => s.checkInStatus)
  const checkInLoading = useHomeStore((s) => s.checkInLoading)
  const fetchDailySentence = useHomeStore((s) => s.fetchDailySentence)
  const fetchCheckInStatus = useHomeStore((s) => s.fetchCheckInStatus)
  const fetchSpecialNotifications = useHomeStore((s) => s.fetchSpecialNotifications)
  const storeCheckIn = useHomeStore((s) => s.checkIn)

  // 🧪 检测 test=3（?test=3，兼容 HashRouter）
  const searchStr = location.search || (
    typeof window !== 'undefined'
      ? (() => { const i = window.location.hash.indexOf('?'); return i >= 0 ? window.location.hash.slice(i) : '' })()
      : ''
  )
  const isTestMode = new URLSearchParams(searchStr).get('test') === '3'

  // 进页面触发所有首页数据拉取（store 内部按日期/标志位缓存）
  useEffect(() => {
    fetchDailySentence()
    fetchCheckInStatus()
    fetchSpecialNotifications()
  }, [fetchDailySentence, fetchCheckInStatus, fetchSpecialNotifications])

  const handleCheckIn = async () => {
    try {
      const message = await storeCheckIn()
      toast.success(message)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('home.checkInFailed'))
    }
  }

  // 未登录
  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pb-24 pt-20 text-center">
        <BookOpen className="mb-4 size-16 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold text-foreground">{t('app.name')}</h1>
        <p className="mt-2 text-muted-foreground">{t('app.tagline')}</p>
        <Button className="mt-6" asChild><Link to="/auth/login">{t('auth.loginRegister')}</Link></Button>
        {isTestMode && <SpecialBanner />}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl overflow-hidden">
      <motion.section
        className="relative flex h-[100svh] flex-col items-center justify-center gap-5 overflow-hidden px-6 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.5rem+env(safe-area-inset-top,0px))] text-foreground"
      >
        <ImmersiveBackground />

        {/* 时钟 */}
        <motion.div
          className={cn(
            'relative z-10 flex items-baseline gap-1.5 rounded-[28px] border px-5 py-3 backdrop-blur-2xl',
            isDark
              ? 'border-white/20 bg-white/[0.12] shadow-[0_24px_70px_rgba(0,0,0,.42)]'
              : 'border-white/45 bg-white/28 shadow-[0_18px_55px_rgba(42,105,96,.16)]',
          )}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <span
            className={cn('text-[28px] font-semibold', isDark ? 'text-white' : 'text-slate-700')}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {clock.hours}
          </span>
          <motion.span
            className={cn('text-[24px] font-light', isDark ? 'text-rose-100/70' : 'text-teal-600/45')}
            animate={{ opacity: [0.28, 1, 0.28] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            :
          </motion.span>
          <span
            className={cn('text-[28px] font-semibold', isDark ? 'text-white' : 'text-slate-700')}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {clock.minutes}
          </span>
          <span className={cn('ml-1 text-[12px] font-medium', isDark ? 'text-white/64' : 'text-slate-500/70')}>{clock.period}</span>
        </motion.div>

        <motion.div
          className={cn(
            'relative z-10 w-full max-w-[330px] rounded-[24px] border px-5 py-5 text-center backdrop-blur-xl',
            isDark
              ? 'border-white/12 bg-white/[0.06] shadow-[0_20px_60px_rgba(0,0,0,.35)]'
              : 'border-white/20 bg-white/15 shadow-[0_16px_48px_rgba(42,105,96,.14)]',
          )}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {sentenceLoading ? (
            <>
              <Skeleton className="mx-auto h-5 w-3/4 rounded" />
              <Skeleton className="mx-auto mt-3 h-4 w-1/2 rounded" />
              <div className={cn('mx-auto mt-4 h-px w-10', isDark ? 'bg-rose-100/28' : 'bg-slate-400/30')} />
              <Skeleton className="mx-auto mt-3 h-3 w-1/3 rounded" />
            </>
          ) : (
            <>
              <p className={cn('text-[18px] font-semibold leading-7', isDark ? 'text-white' : 'text-slate-800')}>
                “{dailySentence.quote}”
              </p>
              <p className={cn('mx-auto mt-3 max-w-[250px] text-[13px] leading-5', isDark ? 'text-white/82' : 'text-slate-600')}>
                {dailySentence.translation}
              </p>
              <div className={cn('mx-auto mt-4 h-px w-10', isDark ? 'bg-rose-100/28' : 'bg-slate-400/30')} />
              <p className={cn('mx-auto mt-3 max-w-[220px] text-[10px] font-medium uppercase tracking-[0.14em]', isDark ? 'text-rose-100/58' : 'text-slate-500')}>
                {dailySentence.author}
              </p>
            </>
          )}
        </motion.div>

        {/* 特殊消息横幅 */}
        <SpecialBanner />

        {/* 签到按钮 — 签过则隐藏 */}
        {!checkInStatus?.checkedIn && (
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={checkInLoading}
              className={cn(
                'flex items-center gap-2 rounded-full border px-5 py-2.5 backdrop-blur-2xl transition-all active:scale-95',
                isDark
                  ? 'border-amber-400/30 bg-amber-400/[0.12] hover:bg-amber-400/[0.20]'
                  : 'border-amber-500/25 bg-amber-50/70 hover:bg-amber-100/80',
              )}
            >
              <Gift className="size-4 text-amber-500" />
              <span className={cn('text-sm font-medium', isDark ? 'text-amber-200' : 'text-amber-800')}>
                {checkInLoading ? t('home.checkingIn') : t('home.checkIn')}
              </span>
            </button>
        </motion.div>
        )}
      </motion.section>
    </div>
  )
}
