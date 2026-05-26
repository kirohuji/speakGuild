import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/providers/auth-provider'

const HOME_SCENE = {
  sentence: 'Could you tell me a little more about it?',
  hint: 'Try saying it slowly, then naturally.',
}

export function EnglishHomePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
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
      <style>{`
        @keyframes home-light-breathe {
          0%, 100% { opacity: .32; transform: translate3d(-10%, -4%, 0) scale(1); }
          50% { opacity: .54; transform: translate3d(8%, 5%, 0) scale(1.08); }
        }
      `}</style>

      <section className="relative -mt-[calc(3rem+env(safe-area-inset-top,0px))] flex h-[calc(100svh-4rem)] items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#d6eee9_0%,#eaf5f1_42%,#ffffff_100%)] px-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(3rem+env(safe-area-inset-top,0px))] text-foreground">
        <div
          className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-white/60 blur-3xl"
          style={{ animation: 'home-light-breathe 9s ease-in-out infinite' }}
        />
        <div className="absolute -left-20 top-28 h-64 w-64 rounded-full bg-cyan-100/50 blur-3xl" />
        <div className="absolute -right-24 bottom-24 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />

        <div className="relative w-full max-w-[320px] rounded-[28px] border border-white/70 bg-white/46 p-5 text-center shadow-[0_24px_80px_rgba(88,126,118,.16)] backdrop-blur-2xl">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-emerald-300/70" />
          <p className="text-[22px] font-semibold leading-8 tracking-normal text-slate-800">{HOME_SCENE.sentence}</p>
          <p className="mx-auto mt-3 max-w-[220px] text-xs leading-5 text-slate-500">{HOME_SCENE.hint}</p>
          <button
            type="button"
            onClick={() => navigate('/learning')}
            className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-full bg-slate-900/85 px-4 text-sm font-semibold text-white shadow-sm active:scale-[0.98]"
          >
            开始
            <ChevronRight className="size-4" />
          </button>
        </div>
      </section>
    </div>
  )
}


