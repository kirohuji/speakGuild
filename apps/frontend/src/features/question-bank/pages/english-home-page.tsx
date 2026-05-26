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

const HOME_SCENE = {
  quote: 'Say one real sentence today.',
  translation: '今天先说出一句真实会用的话。',
  author: 'EngJourney Daily',
}

const lightHomeBackground =
  'linear-gradient(135deg, rgba(255,255,255,.66), transparent 34%), linear-gradient(180deg, #d8f5ef 0%, #eefbf5 54%, #ffffff 100%)'

const darkHomeBackground =
  'radial-gradient(circle at 50% 8%, rgba(255,255,255,.18), transparent 22%), radial-gradient(circle at 18% 16%, rgba(244,114,182,.22), transparent 30%), radial-gradient(circle at 84% 76%, rgba(251,191,36,.13), transparent 30%), linear-gradient(155deg, #090713 0%, #161124 48%, #271226 100%)'

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

export function EnglishHomePage() {
  const { session } = useAuth()
  const { resolvedTheme, theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const clock = useClock()
  const isDark = resolvedTheme === 'dark' || theme === 'dark'

  useEffect(() => {
    setLoading(false)
  }, [session])

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
        <h1 className="text-2xl font-bold text-foreground">GuideReady</h1>
        <p className="mt-2 text-muted-foreground">多语种导游资格面试练习平台</p>
        <Button className="mt-6" asChild><Link to="/auth/login">登录 / 注册</Link></Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl overflow-hidden">
      <motion.section
        className="relative flex h-[100svh] flex-col items-center justify-center gap-5 overflow-hidden px-6 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.5rem+env(safe-area-inset-top,0px))] text-foreground"
        style={{
          backgroundImage: isDark ? darkHomeBackground : lightHomeBackground,
          backgroundSize: '160% 160%, 100% 100%',
        }}
        animate={{
          backgroundPosition: [
            '50% 0%, 0% 0%',
            '42% 12%, 0% 0%',
            '58% 4%, 0% 0%',
            '50% 0%, 0% 0%',
          ],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      >
        {isDark && (
          <div className="absolute inset-0" aria-hidden>
            <motion.div
              className="absolute left-[-24%] top-[-18%] h-[42rem] w-[42rem] rounded-full bg-pink-300/18 blur-3xl"
              animate={{
                opacity: [0.42, 0.68, 0.48, 0.42],
                x: ['0%', '8%', '2%', '0%'],
                y: ['0%', '5%', '10%', '0%'],
              }}
              transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute bottom-[-18%] right-[-26%] h-[38rem] w-[38rem] rounded-full bg-amber-200/12 blur-3xl"
              animate={{
                opacity: [0.34, 0.56, 0.42, 0.34],
                x: ['0%', '-7%', '-2%', '0%'],
                y: ['0%', '-5%', '-10%', '0%'],
              }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_16%,rgba(255,255,255,.16),transparent_24%),linear-gradient(180deg,transparent_0%,rgba(7,5,18,.38)_100%)]" />
          </div>
        )}

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
            “{HOME_SCENE.quote}”
          </p>
          <p className={cn('mx-auto mt-5 max-w-[250px] text-sm leading-6', isDark ? 'text-white/82' : 'text-slate-600')}>
            {HOME_SCENE.translation}
          </p>
          <div className={cn('mx-auto mt-6 h-px w-12', isDark ? 'bg-rose-100/28' : 'bg-slate-400/30')} />
          <p className={cn('mx-auto mt-5 max-w-[220px] text-[11px] font-medium uppercase tracking-[0.14em]', isDark ? 'text-rose-100/58' : 'text-slate-500')}>
            {HOME_SCENE.author}
          </p>
        </motion.div>
      </motion.section>
    </div>
  )
}
