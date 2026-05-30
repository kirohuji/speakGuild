import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Mic, BookOpen, Sparkles, TrendingUp,
  ArrowRight, Star, GraduationCap, ChevronRight,
  MessageSquare, Play, Globe, CheckCircle, Zap,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/auth-provider'
import { useTheme } from 'next-themes'

// ─── 数据 ────────────────────────────────────────────────────

const features = [
  { icon: Mic, title: 'AI 口语纠错', desc: 'DeepSeek 实时分析语法、搭配、自然度，精准定位每个可改进之处', color: 'from-violet-400 to-purple-500' },
  { icon: BookOpen, title: 'Chunk 学习法', desc: '学习可迁移表达块，从"I\'m here to check in"到即学即用', color: 'from-emerald-400 to-teal-500' },
  { icon: Play, title: '剧本模式', desc: '在剧情任务中实战英语，通过入境、入住、认识室友——用英语推动故事', color: 'from-amber-400 to-orange-500' },
  { icon: Globe, title: '沉浸探索', desc: '小地图自由选择地点和 NPC，像在国外生活一样进行英语互动', color: 'from-sky-400 to-blue-500' },
]

const steps = [
  { num: '01', icon: BookOpen, title: '选场景', desc: '从留学生活、日常社交中选话题' },
  { num: '02', icon: Sparkles, title: '学 Chunk', desc: '掌握 5~8 个高频表达块' },
  { num: '03', icon: Mic, title: '开口说', desc: '录音 → AI 实时转写纠错' },
  { num: '04', icon: TrendingUp, title: '复述升级', desc: '跟读 → 保存 → 剧本实战' },
]

const audience = [
  { icon: GraduationCap, title: '准备留学', desc: '雅思/托福备考，提前适应国外生活场景' },
  { icon: Globe, title: '旅行英语', desc: '摆脱翻译软件，自信应对旅行场景' },
  { icon: MessageSquare, title: '职场提升', desc: '提升口语表达的自然度和流利度' },
  { icon: Star, title: '社交突破', desc: '学了多年不敢开口？从这里开始' },
]

// ─── 装饰 ────────────────────────────────────────────────────

function GlassBg() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute -top-40 -right-40 size-96 bg-primary/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 size-80 bg-violet-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 size-64 bg-amber-500/8 rounded-full blur-3xl" />
      <div className={cn(
        'absolute inset-0 opacity-[0.02]',
        isDark && 'opacity-[0.04]',
      )} style={{
        backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
    </div>
  )
}

const glassCard = (isDark: boolean) => cn(
  'rounded-2xl border backdrop-blur-xl transition-all duration-300 hover:shadow-lg',
  isDark
    ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
    : 'border-white/30 bg-white/20 hover:bg-white/30',
)

// ─── 组件 ────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
      {children}
    </span>
  )
}

// ─── 首页 ────────────────────────────────────────────────────

export function PortalPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const isLoggedIn = !!session

  const textMain = isDark ? 'text-white' : 'text-slate-800'
  const textMuted = isDark ? 'text-white/64' : 'text-slate-500'

  return (
    <div className={cn('min-h-screen overflow-x-hidden', isDark ? 'bg-black' : 'bg-slate-50')}>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20 overflow-hidden">
        <GlassBg />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm backdrop-blur-xl',
              isDark ? 'border-white/15 bg-white/[0.06] text-white/80' : 'border-primary/20 bg-primary/5 text-primary',
            )}>
              <Globe className="size-3.5" />
              沉浸式英语输出训练
            </span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
            <h1 className={cn('text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight', textMain)}>
              英语，<br className="sm:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-400 to-amber-400">
                真正说出口
              </span>
            </h1>
            <p className={cn('mt-4 text-lg max-w-xl mx-auto', textMuted)}>
              场景 + Chunk + AI 纠错 + 剧本。不是背英语，是练到能开口。
            </p>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
            className={cn('text-sm italic', isDark ? 'text-white/36' : 'text-slate-400')}>
            "看得懂 ≠ 说得出。练到开口，才是你的。"
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button size="lg" className="rounded-full px-8 text-base gap-2 shadow-lg shadow-primary/20"
              onClick={() => navigate(isLoggedIn ? '/' : '/auth/login')}>
              {isLoggedIn ? '开始练习' : '免费体验'}
              <ArrowRight className="size-5" />
            </Button>
            <Button variant="outline" size="lg" className="rounded-full px-8 text-base gap-2"
              onClick={() => navigate(isLoggedIn ? '/script' : '/auth/register')}>
              <Play className="size-5" />
              剧本体验
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            className={cn('flex flex-wrap justify-center gap-3 pt-8', textMuted)}>
            {[
              { icon: CheckCircle, t: 'AI 精准评分' },
              { icon: Zap, t: '实时反馈' },
              { icon: BookOpen, t: '50+ 场景' },
            ].map(({ icon: Icon, t }) => (
              <span key={t} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs backdrop-blur">
                <Icon className="size-3 text-primary" />{t}
              </span>
            ))}
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="relative px-4 pb-24">
        <FadeIn className="max-w-4xl mx-auto text-center mb-12">
          <SectionTag>核心功能</SectionTag>
          <h2 className={cn('mt-4 text-3xl sm:text-4xl font-extrabold', textMain)}>场景化英语，真正说出口</h2>
        </FadeIn>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.1}>
              <div className={cn(glassCard(isDark), 'p-6 group')}>
                <div className={cn('inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br mb-4', f.color)}>
                  <f.icon className="size-5 text-white" />
                </div>
                <h3 className={cn('text-lg font-bold mb-2', textMain)}>{f.title}</h3>
                <p className={cn('text-sm leading-relaxed', textMuted)}>{f.desc}</p>
                <ChevronRight className="mt-3 size-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="relative px-4 pb-24">
        <div className="absolute inset-0 bg-muted/20" />
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

        <FadeIn className="relative max-w-4xl mx-auto text-center mb-12">
          <SectionTag>四步上手</SectionTag>
          <h2 className={cn('mt-4 text-3xl sm:text-4xl font-extrabold', textMain)}>从开口到通关</h2>
        </FadeIn>

        <div className="relative max-w-4xl mx-auto">
          <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <FadeIn key={s.num} delay={i * 0.12}>
                <div className="flex flex-col items-center text-center">
                  <div className="relative z-10 flex size-14 items-center justify-center rounded-full border-2 border-primary/20 bg-card shadow-lg mb-4">
                    <span className="text-lg font-extrabold text-primary">{s.num}</span>
                  </div>
                  <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 mb-3">
                    <s.icon className="size-5 text-primary" />
                  </div>
                  <h3 className={cn('font-bold mb-1', textMain)}>{s.title}</h3>
                  <p className={cn('text-sm max-w-[160px]', textMuted)}>{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AUDIENCE ═══ */}
      <section className="px-4 pb-24">
        <FadeIn className="max-w-4xl mx-auto text-center mb-12">
          <SectionTag>适合你吗？</SectionTag>
          <h2 className={cn('mt-4 text-3xl sm:text-4xl font-extrabold', textMain)}>无论你在哪，都能进步</h2>
        </FadeIn>

        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {audience.map((a, i) => (
            <FadeIn key={a.title} delay={i * 0.1}>
              <div className={cn(glassCard(isDark), 'p-5 text-center')}>
                <div className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
                  <a.icon className="size-6 text-primary" />
                </div>
                <h3 className={cn('font-bold mb-1', textMain)}>{a.title}</h3>
                <p className={cn('text-xs', textMuted)}>{a.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ═══ PRICING + CTA ═══ */}
      <section className="px-4 pb-24">
        <FadeIn className="max-w-md mx-auto">
          <div className={cn(glassCard(isDark), 'p-8 text-center')}>
            <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 shadow-lg mb-5">
              <Star className="size-7 text-white" />
            </div>
            <h2 className={cn('text-2xl font-extrabold mb-1', textMain)}>¥15/月</h2>
            <p className={cn('mb-2 text-sm', textMuted)}>一杯奶茶钱，无限畅练</p>
            <div className={cn('space-y-1.5 mb-6 text-xs text-left max-w-[260px] mx-auto', textMuted)}>
              {['AI 纠错 50次/天', '全部学习单元', '完整剧本模式', '探索模式全地点', '无限表达库'].map(f => (
                <div key={f} className="flex items-center gap-2"><CheckCircle className="size-3.5 text-green-500 shrink-0" />{f}</div>
              ))}
            </div>
            <Button className="w-full rounded-full gap-2" onClick={() => navigate(isLoggedIn ? '/member' : '/auth/register')}>
              立即开通 <ChevronRight className="size-4" />
            </Button>
          </div>
        </FadeIn>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border/40 px-4 py-8 text-center">
        <p className={cn('text-xs', isDark ? 'text-white/30' : 'text-slate-400')}>
          漫语町 ManYu — 沉浸式英语输出训练
        </p>
      </footer>
    </div>
  )
}
