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

export function EnglishHomePage() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)

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
        className="relative flex h-[100svh] items-center justify-center overflow-hidden px-6 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.5rem+env(safe-area-inset-top,0px))] text-foreground"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 16% 10%, rgba(20, 184, 166, .72), transparent 36%), radial-gradient(ellipse at 84% 24%, rgba(56, 189, 248, .62), transparent 38%), radial-gradient(ellipse at 34% 78%, rgba(74, 222, 128, .48), transparent 40%), linear-gradient(180deg, #9ce7dc 0%, #d8f4ee 48%, #ffffff 100%)',
          backgroundSize: '210% 210%, 220% 220%, 190% 190%, 100% 100%',
        }}
        animate={{
          backgroundPosition: [
            '0% 0%, 100% 8%, 38% 92%, 0% 0%',
            '58% 22%, 46% 62%, 4% 48%, 0% 0%',
            '10% 72%, 92% 0%, 86% 72%, 0% 0%',
            '0% 0%, 100% 8%, 38% 92%, 0% 0%',
          ],
        }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute inset-0 opacity-70 mix-blend-screen"
          style={{
            backgroundImage:
              'linear-gradient(112deg, transparent 0 20%, rgba(255,255,255,.46) 32%, transparent 48% 100%), linear-gradient(64deg, transparent 0 34%, rgba(34,211,238,.28) 48%, transparent 64% 100%), repeating-linear-gradient(128deg, rgba(255,255,255,0) 0 28px, rgba(255,255,255,.16) 38px, rgba(255,255,255,0) 58px)',
            backgroundSize: '210% 210%, 190% 190%, 180% 180%',
          }}
          animate={{
            backgroundPosition: ['0% 20%, 100% 0%, 0% 0%', '95% 70%, 0% 90%, 72% 46%', '0% 20%, 100% 0%, 0% 0%'],
            opacity: [0.45, 0.78, 0.52],
          }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-x-[-30%] bottom-[-10%] h-80 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,.92),rgba(186,230,253,.46)_38%,rgba(255,255,255,0)_72%)] blur-2xl"
          animate={{ opacity: [0.44, 0.78, 0.52], y: ['2%', '-10%', '3%'], scaleX: [1, 1.18, 1.04] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-white/50 blur-3xl"
          animate={{ opacity: [0.24, 0.56, 0.28], scale: [1, 1.28, 1.04] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="relative w-full max-w-[330px] rounded-[30px] border border-white/75 bg-white/48 px-6 py-6 text-center shadow-[0_24px_80px_rgba(42,105,96,.18)] backdrop-blur-2xl"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[21px] font-semibold leading-8 tracking-normal text-slate-800">
            “{HOME_SCENE.quote}”
          </p>
          <p className="mx-auto mt-4 max-w-[250px] text-sm leading-6 text-slate-600">
            {HOME_SCENE.translation}
          </p>
          <div className="mx-auto mt-5 h-px w-12 bg-slate-400/30" />
          <p className="mx-auto mt-4 max-w-[220px] text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            {HOME_SCENE.author}
          </p>
        </motion.div>
      </motion.section>
    </div>
  )
}


