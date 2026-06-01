import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'motion/react'
import {
  Mic, BookOpen, TrendingUp,
  ArrowRight, Star, GraduationCap,
  MessageSquare, Play, Globe, CheckCircle,
  Smartphone, Monitor, Cloud,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/providers/auth-provider'

/* ═══════════════════════════════════════════════════════════════
   数据
   ═══════════════════════════════════════════════════════════════ */

const whatWeHave = [
  { icon: Mic, title: 'AI 口语纠错', desc: 'DeepSeek 实时分析语法、搭配与自然度，精准到词级反馈' },
  { icon: BookOpen, title: 'Chunk 学习法', desc: '可迁移表达块，从「看得懂」到「说得出」的关键一步' },
  { icon: Play, title: '剧本模式', desc: '在剧情任务中实战，用英语推动故事，而非机械练习' },
]

const features = [
  { icon: Mic, title: 'AI 口语纠错', desc: 'DeepSeek 实时分析语法、搭配、自然度，精准定位每个可改进之处' },
  { icon: BookOpen, title: 'Chunk 学习法', desc: '学习可迁移表达块，从"I\'m here to check in"到即学即用' },
  { icon: Play, title: '剧本模式', desc: '在剧情任务中实战英语，入境、入住、认识室友——用英语推动故事' },
  { icon: Globe, title: '沉浸探索', desc: '小地图自由选择地点和 NPC，像在国外生活一样进行英语互动' },
  { icon: TrendingUp, title: '输出等级追踪', desc: '可视化你的口语进步曲线，清楚看到每个阶段的成长' },
  { icon: Star, title: '表达库收藏', desc: '把 AI 纠错后的地道表达一键收藏，随时复习巩固' },
]

const steps = [
  { num: '01', title: '选场景', desc: '从留学生活、日常社交、职场交流中选择你最需要的场景' },
  { num: '02', title: '学 Chunk', desc: '掌握 5~8 个高频表达块，理解结构，触类旁通' },
  { num: '03', title: '开口说', desc: '录音回答，AI 实时转写并给出精准的纠错反馈' },
  { num: '04', title: '复述升级', desc: '用更地道的表达重新说一遍，保存进步，进入剧本实战' },
]

const audience = [
  { icon: GraduationCap, title: '准备留学', desc: '雅思/托福备考中，想提前适应国外真实生活场景' },
  { icon: Globe, title: '旅行爱好者', desc: '不想再依赖翻译软件，自信应对各种旅行场景' },
  { icon: MessageSquare, title: '职场人士', desc: '工作中需要用英语交流，提升口语的自然度和流利度' },
  { icon: Star, title: '英语学习者', desc: '学了多年但不敢开口，突破心理障碍真正开始说' },
]

const platforms = [
  { icon: Smartphone, label: 'iOS' },
  { icon: Monitor, label: 'Web' },
  { icon: Cloud, label: 'PWA' },
]

/* ═══════════════════════════════════════════════════════════════
   动画工具
   ═══════════════════════════════════════════════════════════════ */

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Hero 背景装饰
   ═══════════════════════════════════════════════════════════════ */

function HeroBg() {
  return (
    <>
      <div className="absolute right-[-8rem] top-[-12rem] size-[36rem] rounded-full bg-primary/[0.08] blur-3xl" />
      <div className="absolute bottom-[-10rem] left-[-8rem] size-[28rem] rounded-full bg-amber-300/[0.09] blur-3xl" />
      <div className="absolute left-[38%] top-[18%] size-48 rounded-full bg-sky-300/[0.08] blur-3xl" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,rgba(148,163,184,.32)_1px,transparent_1px)] [background-size:22px_22px]" />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════ */

export function PortalPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const isLoggedIn = !!session

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 top-[32%] size-80 rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute -left-40 top-[62%] size-80 rounded-full bg-amber-300/[0.05] blur-3xl" />
      </div>

      {/* ═══════════════════════════════════════════════════════
          HERO — minimals 风格：左右双栏
          ═══════════════════════════════════════════════════════ */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-24 pb-16 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <HeroBg />

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── 左栏：文字 ── */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Badge variant="secondary" className="mb-6 text-[11px] font-medium tracking-wide uppercase">
                  沉浸式英语输出训练
                </Badge>

                {/* Logo */}
                <img
                  src="/logo.png"
                  alt="漫语町"
                  className="mb-5 h-12 w-auto dark:invert"
                />

                <h1 className="text-[2.5rem] sm:text-5xl lg:text-6xl font-extrabold leading-[1.06] tracking-tight text-foreground">
                  英语，
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                    真正说出口
                  </span>
                </h1>

                <p className="mt-6 max-w-lg text-base sm:text-lg text-muted-foreground leading-relaxed">
                  场景 + Chunk + AI 纠错 + 剧本。不是背单词、不是做选择题——从「看得懂」练到「说得出」。
                </p>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mt-10 flex flex-col sm:flex-row gap-3"
              >
                <Button
                  size="primary-lg"
                  className="shadow-[0_4px_24px_rgba(0,46,95,0.16)]"
                  onClick={() => navigate(isLoggedIn ? '/' : '/auth/login')}
                >
                  {isLoggedIn ? '开始练习' : '免费体验'}
                  <ArrowRight className="size-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(isLoggedIn ? '/script' : '/auth/register')}
                >
                  <Play className="size-5" />
                  体验剧本模式
                </Button>
              </motion.div>

              {/* 平台支持 — minimals "Available For" 风格 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="mt-12"
              >
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  随时随地可用
                </p>
                <div className="flex items-center gap-5">
                  {platforms.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* ── 右栏：视觉区 — 简洁的装饰性卡片群 ── */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block relative"
            >
              <div className="relative aspect-[4/3]">
                {/* 主卡片 */}
                <div className="absolute inset-0 rounded-2xl border border-border/80 bg-card shadow-[0_4px_32px_rgba(0,0,0,0.06)] p-8 flex flex-col justify-center">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-xl bg-primary/[0.07] flex items-center justify-center">
                        <Mic className="size-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">场景口语练习</div>
                        <div className="text-xs text-muted-foreground">AI 实时纠错反馈</div>
                      </div>
                    </div>

                    {/* 模拟对话气泡 */}
                    <div className="space-y-3 mt-6">
                      <div className="flex items-start gap-2.5">
                        <div className="shrink-0 size-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">Q</div>
                        <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-2.5 text-sm text-foreground">
                          Can you tell me about your travel experience?
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 justify-end">
                        <div className="rounded-2xl rounded-tr-sm bg-primary/10 px-4 py-2.5 text-sm text-foreground">
                          I went to Japan last year. It was very interesting...
                        </div>
                        <div className="shrink-0 size-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">A</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 浮动小卡片 */}
                <div className="absolute -bottom-4 -right-4 rounded-xl border border-border bg-card shadow-lg px-4 py-3 flex items-center gap-3">
                  <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="size-4 text-emerald-600" />
                  </div>
                  <div className="text-xs font-medium text-foreground">AI 评分 92/100</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ═══════════════════════════════════════════════════════
          WHAT'S IN MANYU — minimals "What's in Minimal" 风格
          ═══════════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 lg:pb-36">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── 左栏：迷你功能卡 ── */}
            <Reveal>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  核心能力
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-10">
                  What's in
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> 漫语町</span>
                </h2>

                <div className="space-y-4">
                  {whatWeHave.map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="flex gap-4 rounded-lg bg-muted/30 p-4 transition-colors duration-200 hover:bg-muted/50"
                    >
                      <div className="shrink-0 flex size-10 items-center justify-center rounded-lg bg-primary/[0.06]">
                        <item.icon className="size-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm">{item.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* ── 右栏：统计数据可视化 ── */}
            <Reveal delay={0.15}>
              <div className="hidden lg:block relative">
                <div className="rounded-2xl border border-border/60 bg-card p-10 shadow-[0_4px_32px_rgba(0,0,0,0.04)]">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-8">学习数据</p>
                  <div className="space-y-8">
                    {[
                      { label: '场景覆盖', value: '50+', pct: '100%' },
                      { label: '核心 Chunk', value: '300+', pct: '100%' },
                      { label: '学习等级', value: '6', pct: '100%' },
                      { label: '月活用户', value: '10,000+', pct: '100%' },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-muted-foreground">{stat.label}</span>
                          <span className="text-sm font-bold text-foreground">{stat.value}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: stat.pct }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 浮动小卡片 */}
                <div className="absolute -bottom-3 -left-3 rounded-xl border border-border bg-card shadow-lg px-4 py-3 flex items-center gap-3">
                  <TrendingUp className="size-4 text-emerald-500" />
                  <span className="text-xs font-medium text-foreground">学习进度 +24% 本周</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FEATURES GRID — minimals "Highlight features" 风格
          ═══════════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 lg:pb-36">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14 lg:mb-20">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              App Features
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
              Highlight
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> features</span>
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
              从场景激活到 AI 纠错，覆盖英语输出训练的每一个环节
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <Card className="group h-full rounded-lg bg-muted/30 shadow-none transition-colors duration-300 hover:bg-muted/50 dark:ring-0">
                  <CardContent className="p-5 lg:p-6">
                    <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-background/70 transition-colors group-hover:bg-background">
                      <f.icon className="size-5 text-primary" />
                    </div>
                    <h4 className="text-base font-bold text-foreground mb-2">{f.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          HOW IT WORKS — minimals 双栏风格
          ═══════════════════════════════════════════════════════ */}
      <section className="relative px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 lg:pb-36">
        <div className="absolute inset-0 bg-muted/30" />
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />

        <div className="relative max-w-6xl mx-auto">
          <Reveal className="text-center mb-14 lg:mb-20">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              四步上手
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
              从开口到
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> 通关</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 0.08}>
                <Card className="relative h-full overflow-hidden rounded-lg bg-background/75 shadow-none transition-colors duration-300 hover:bg-background dark:ring-0">
                  <CardContent className="p-5 lg:p-6">
                    <div className="text-5xl font-extrabold text-primary/[0.12] mb-4 leading-none select-none">
                      {s.num}
                    </div>
                    <h4 className="text-base font-bold text-foreground mb-2">{s.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOR YOU — 双栏布局
          ═══════════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 lg:pb-36">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* 左栏：标题 */}
            <Reveal>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  适合你吗
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-6">
                  无论你在哪个阶段，
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> 都能进步</span>
                </h2>
                <p className="text-muted-foreground leading-relaxed max-w-md">
                  从零基础到高级学习者，系统根据你的输出能力等级推荐合适的场景和 Chunk，循序渐进提升口语。
                </p>

                <Button
                  variant="outline"
                  size="lg"
                  className="mt-8"
                  onClick={() => navigate(isLoggedIn ? '/' : '/auth/login')}
                >
                  看看你适合从哪里开始
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </Reveal>

            {/* 右栏：人群卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {audience.map((a, i) => (
                <Reveal key={a.title} delay={i * 0.08}>
                  <div className="rounded-lg bg-muted/30 p-4 transition-colors duration-200 hover:bg-muted/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/[0.06]">
                        <a.icon className="size-4 text-primary" />
                      </div>
                      <h4 className="font-bold text-foreground text-sm">{a.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="漫语町" className="size-8 dark:invert" />
                <span className="font-extrabold text-foreground">漫语町</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">沉浸式英语输出训练 App</p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              <button onClick={() => navigate('/system/terms')} className="hover:text-foreground transition-colors">
                服务条款
              </button>
              <button onClick={() => navigate('/system/privacy')} className="hover:text-foreground transition-colors">
                隐私政策
              </button>
              <button onClick={() => navigate('/feedback')} className="hover:text-foreground transition-colors">
                意见反馈
              </button>
            </div>
          </div>

          <Separator className="my-6" />

          <p className="text-center text-[11px] text-muted-foreground/50">
            &copy; {new Date().getFullYear()} 漫语町 ManYu. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default PortalPage
