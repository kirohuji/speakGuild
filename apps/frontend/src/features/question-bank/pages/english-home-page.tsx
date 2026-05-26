import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/providers/auth-provider'

const HOME_SCENE = {
  quote: 'The limits of my language mean the limits of my world.',
  translation: '我的语言边界，就是我的世界边界。',
  author: 'Ludwig Wittgenstein',
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

export function EnglishHomePage() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const clock = useClock()

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
        className="relative flex h-[100svh] flex-col items-center justify-center gap-5 overflow-hidden bg-[linear-gradient(180deg,#bcece4_0%,#e4f6ef_48%,#ffffff_100%)] px-6 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.5rem+env(safe-area-inset-top,0px))] text-foreground"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 50% 8%, rgba(255,255,255,.62), transparent 34%), linear-gradient(180deg,#bcece4 0%,#e4f6ef 48%,#ffffff 100%)',
          backgroundSize: '140% 140%, 100% 100%',
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
        <div className="absolute inset-[-18%] blur-3xl saturate-[1.45]">
          <motion.div
            className="absolute left-[2%] top-[4%] h-[32rem] w-[32rem] rounded-[43%_57%_46%_54%/52%_44%_56%_48%] bg-teal-300/58 mix-blend-multiply"
            animate={{
              x: ['-8%', '22%', '4%', '-8%'],
              y: ['0%', '16%', '34%', '0%'],
              rotate: [0, 42, 18, 0],
              scale: [1, 1.18, 0.96, 1],
              borderRadius: [
                '43% 57% 46% 54% / 52% 44% 56% 48%',
                '58% 42% 62% 38% / 43% 61% 39% 57%',
                '48% 52% 37% 63% / 62% 44% 56% 38%',
                '43% 57% 46% 54% / 52% 44% 56% 48%',
              ],
            }}
            transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute right-[-8%] top-[12%] h-[34rem] w-[34rem] rounded-[55%_45%_52%_48%/46%_58%_42%_54%] bg-sky-300/56 mix-blend-multiply"
            animate={{
              x: ['4%', '-28%', '-8%', '4%'],
              y: ['8%', '2%', '32%', '8%'],
              rotate: [12, -34, -8, 12],
              scale: [1.04, 0.94, 1.2, 1.04],
              borderRadius: [
                '55% 45% 52% 48% / 46% 58% 42% 54%',
                '39% 61% 44% 56% / 59% 37% 63% 41%',
                '62% 38% 55% 45% / 42% 64% 36% 58%',
                '55% 45% 52% 48% / 46% 58% 42% 54%',
              ],
            }}
            transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[-12%] left-[18%] h-[30rem] w-[30rem] rounded-[50%_50%_40%_60%/58%_42%_58%_42%] bg-emerald-200/70 mix-blend-multiply"
            animate={{
              x: ['0%', '18%', '42%', '0%'],
              y: ['8%', '-18%', '-2%', '8%'],
              rotate: [-18, 24, 52, -18],
              scale: [1.1, 1, 1.22, 1.1],
              borderRadius: [
                '50% 50% 40% 60% / 58% 42% 58% 42%',
                '65% 35% 56% 44% / 40% 64% 36% 60%',
                '38% 62% 47% 53% / 63% 39% 61% 37%',
                '50% 50% 40% 60% / 58% 42% 58% 42%',
              ],
            }}
            transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-[34%] top-[30%] h-[22rem] w-[22rem] rounded-[48%_52%_62%_38%/46%_54%_42%_58%] bg-white/72 mix-blend-screen"
            animate={{
              x: ['0%', '-14%', '18%', '0%'],
              y: ['0%', '18%', '-12%', '0%'],
              rotate: [0, -26, 18, 0],
              scale: [1, 1.32, 0.92, 1],
            }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* 时钟 */}
        <motion.div
          className="flex items-baseline gap-1.5"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <span
            className="text-[28px] font-semibold tracking-[0.02em] text-slate-700"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {clock.hours}
          </span>
          <span className="text-[24px] font-light text-slate-400 animate-pulse">:</span>
          <span
            className="text-[28px] font-semibold tracking-[0.02em] text-slate-700"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {clock.minutes}
          </span>
          <span className="ml-1 text-[12px] font-medium text-slate-500/70">{clock.period}</span>
        </motion.div>

        <motion.div
          className="relative w-full max-w-[330px] rounded-[30px] border border-white/75 bg-white/48 px-6 py-7 text-center shadow-[0_24px_80px_rgba(42,105,96,.18)] backdrop-blur-2xl"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[20px] font-semibold leading-8 tracking-normal text-slate-800">
            “{HOME_SCENE.quote}”
          </p>
          <p className="mx-auto mt-5 max-w-[250px] text-sm leading-6 text-slate-600">
            {HOME_SCENE.translation}
          </p>
          <div className="mx-auto mt-6 h-px w-12 bg-slate-400/30" />
          <p className="mx-auto mt-5 max-w-[220px] text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {HOME_SCENE.author}
          </p>
        </motion.div>
      </motion.section>
    </div>
  )
}


