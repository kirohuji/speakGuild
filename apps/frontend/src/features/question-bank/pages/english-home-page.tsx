import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTheme } from 'next-themes'
import {
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@/lib/cn'
import { ImmersiveBackground } from '@/components/common/immersive-background'
import { get } from '@/lib/request'

interface DailySentence {
  quote: string
  translation: string
  author: string
}

function useClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const period = now.getHours() < 12 ? '上午' : '下午'

  return { hours, minutes, period }
}

const FALLBACK_SENTENCE: DailySentence = {
  quote: 'Say one real sentence today.',
  translation: '今天先说出一句真实会用的话。',
  author: 'EngJourney Daily',
}

export function EnglishHomePage() {
  const { session } = useAuth()
  const { resolvedTheme, theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [dailySentence, setDailySentence] = useState<DailySentence>(FALLBACK_SENTENCE)
  const clock = useClock()
  const isDark = resolvedTheme === 'dark' || theme === 'dark'

  useEffect(() => {
    // 获取每日句子
    get<DailySentence>('/daily-sentences/today')
      .then((data) => {
        if (data?.quote) {
          setDailySentence(data)
        }
      })
      .catch(() => {
        // 使用默认句子作为 fallback
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-3">
        <Skeleton className="mb-4 h-6 w-32 rounded-full" />
        <Skeleton className="mb-3 h-28 w-full rounded-lg" />
        <Skeleton className="mb-3 h-20 w-full rounded-lg" />
        <Skeleton className="mb-3 h-20 w-full rounded-lg" />
      </div>
    )
  }

  // 未登录
  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pb-24 pt-20 text-center">
        <BookOpen className="mb-4 size-16 text-muted-foreground/30" />
        <h1 className="text-2xl font-bold text-foreground">ManYu</h1>
        <p className="mt-2 text-muted-foreground">多语种口语练习平台</p>
        <Button className="mt-6" asChild><Link to="/auth/login">登录 / 注册</Link></Button>
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
            'relative z-10 w-full max-w-[330px] rounded-[30px] border px-6 py-7 text-center backdrop-blur-2xl',
            isDark
              ? 'border-white/18 bg-white/[0.12] shadow-[0_30px_90px_rgba(0,0,0,.4)]'
              : 'border-white/35 bg-white/30 shadow-[0_24px_80px_rgba(42,105,96,.18)]',
          )}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className={cn('text-[20px] font-semibold leading-8 tracking-normal', isDark ? 'text-white' : 'text-slate-800')}>
            “{dailySentence.quote}”
          </p>
          <p className={cn('mx-auto mt-5 max-w-[250px] text-sm leading-6', isDark ? 'text-white/82' : 'text-slate-600')}>
            {dailySentence.translation}
          </p>
          <div className={cn('mx-auto mt-6 h-px w-12', isDark ? 'bg-rose-100/28' : 'bg-slate-400/30')} />
          <p className={cn('mx-auto mt-5 max-w-[220px] text-[11px] font-medium uppercase tracking-[0.14em]', isDark ? 'text-rose-100/58' : 'text-slate-500')}>
            {dailySentence.author}
          </p>
        </motion.div>
      </motion.section>
    </div>
  )
}
