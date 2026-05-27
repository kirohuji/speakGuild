import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'motion/react'
import {
  Mic, BookOpen, Sparkles, TrendingUp,
  Trophy, Users, Map, Headphones, ArrowRight,
  CheckCircle, Star, Globe, GraduationCap,
  ChevronRight, Languages, MessageSquare, Plane, Coffee, Play, Zap,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { NumberTicker } from '@/components/ui/number-ticker'
import { WordRotate } from '@/components/ui/word-rotate'
import { useAuth } from '@/providers/auth-provider'

// ─── 动画工具 ────────────────────────────────────────────────────────────────

function FadeInSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── 数据 ────────────────────────────────────────────────────────────────────

const stats = [
  { value: 50, suffix: '+', label: '生活场景', icon: Map },
  { value: 300, suffix: '+', label: '核心 Chunk', icon: BookOpen },
  { value: 6, suffix: '', label: '学习等级', icon: TrendingUp },
  { value: 10000, suffix: '+', label: '开口练习者', icon: Users },
]

const features = [
  {
    icon: Map,
    title: '场景化训练',
    description: '从机场入境到宿舍 Check-in，从咖啡店点餐到课堂辩论——50+ 真实留学生活场景，让你在需要用的时候说得出口',
    gradient: 'from-blue-500 to-cyan-400',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
  },
  {
    icon: Mic,
    title: 'AI 口语纠错',
    description: '基于 DeepSeek 大模型，实时分析你的口语回答。语法、搭配、中式表达、自然度——精准定位每个可改进的地方',
    gradient: 'from-violet-500 to-purple-400',
    bgGradient: 'from-violet-500/10 to-purple-500/10',
  },
  {
    icon: BookOpen,
    title: 'Chunk 学习法',
    description: '不是背单词，不是背句子——学习可迁移的表达块（Chunk），从\"I\'m here to check in\"到\"I was wondering if...\"，即学即用',
    gradient: 'from-emerald-500 to-teal-400',
    bgGradient: 'from-emerald-500/10 to-teal-500/10',
  },
  {
    icon: Play,
    title: '剧本模式',
    description: 'Chapter 0 免费体验！在固定剧情中用英语完成任务——通过入境、办理入住、认识室友——用英语推动故事发展',
    gradient: 'from-amber-500 to-orange-400',
    bgGradient: 'from-amber-500/10 to-orange-500/10',
  },
  {
    icon: TrendingUp,
    title: '成长追踪',
    description: '输出能力等级 + 场景熟练度 + Chunk 掌握度，三维追踪你的进步。不是\"学了多少\"，而是\"能说多少\"',
    gradient: 'from-rose-500 to-pink-400',
    bgGradient: 'from-rose-500/10 to-pink-500/10',
  },
  {
    icon: Globe,
    title: '沉浸式探索',
    description: '在小地图中自由选择地点和 NPC，像在国外生活一样进行英语互动。宿舍大厅、校园咖啡店、图书馆等你来探索',
    gradient: 'from-sky-500 to-blue-400',
    bgGradient: 'from-sky-500/10 to-blue-500/10',
  },
]

const steps = [
  {
    number: '01',
    icon: BookOpen,
    title: '选择场景话题',
    description: '从留学生活、日常社交、旅行英语等场景中选择想练的话题',
  },
  {
    number: '02',
    icon: Sparkles,
    title: '激活核心 Chunk',
    description: '学习 5~8 个高频表达块，掌握句型骨架，降低开口难度',
  },
  {
    number: '03',
    icon: Mic,
    title: '开口录音回答',
    description: 'AI 实时转写你的录音，从语法、自然度、逻辑等多维度精准纠错',
  },
  {
    number: '04',
    icon: TrendingUp,
    title: '复述 & 升级 & 沉淀',
    description: '遮挡复述升级表达 → 保存到表达库 → 在剧本任务中实战使用',
  },
]

const testimonials = [
  {
    text: '以前学英语就是背单词，从来不敢开口说。用了英游记的 Chunk 激活法，现在去咖啡店点餐一点都不慌了，店员还夸我英语好！',
    name: '小陈',
    role: '大三学生 · 准备出国留学',
  },
  {
    text: '剧本模式太有意思了！像玩游戏一样练口语，Chapter 0 的宿舍 Check-in 关卡我练了 3 遍，现在真的会说了。',
    name: 'Ashley',
    role: '工作 2 年 · 想提升职场英语',
  },
  {
    text: 'AI 纠错特别准，以前从来不知道自己说的英语有那么多中式表达。表达升级功能让我看到了真正的差距和提升方向。',
    name: 'David',
    role: '雅思备考中 · 目标口语 7 分',
  },
]

// ─── 装饰组件 ────────────────────────────────────────────────────────────────

function FloatingDecorations() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* 网格背景 */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* 装饰性渐变光斑 */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-accent/15 rounded-full blur-3xl" />
      <div className="absolute top-1/3 left-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className="mb-4 text-xs font-medium tracking-wide uppercase">
      {children}
    </Badge>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export function PortalPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { session } = useAuth()
  const isLoggedIn = !!session

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ═══════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 py-20 lg:py-32 overflow-hidden">
        <FloatingDecorations />

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <Badge
              variant="outline"
              className="px-4 py-1.5 text-sm border-primary/30 bg-primary/5 text-primary gap-2"
            >
              <Globe className="h-3.5 w-3.5" />
              场景化沉浸式英语输出训练平台
            </Badge>
          </motion.div>

          {/* 主标题 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="space-y-4"
          >
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-foreground">
              英语，
              <br className="sm:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-amber-500">
                真正说出口
              </span>
            </h1>

            <div className="flex items-center justify-center gap-2 text-2xl sm:text-3xl md:text-4xl font-display font-bold text-muted-foreground">
              <span>在</span>
              <WordRotate
                words={['机场入境', '宿舍 Check-in', '咖啡店点餐', '课堂辩论', '真实场景中']}
                duration={2500}
                className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-400"
              />
              <span>练英语</span>
            </div>
          </motion.div>

          {/* 副标题 */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
              漫语町（ManYu）通过场景 + Chunk + AI 纠错 + 剧本任务，
            帮你把英语从「看得懂」练到「说得出」。
            不是背英语，而是练到真正能开口。
          </motion.p>

          {/* 品牌口号 */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-sm text-muted-foreground/60 italic"
          >
            "看得懂 ≠ 说得出。练到开口，才是你的。"
          </motion.p>

          {/* CTA 按钮 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <ShimmerButton
              shimmerColor="rgba(255,255,255,0.3)"
              background="linear-gradient(135deg, hsl(217,91%,57%), hsl(217,91%,45%))"
              className="px-8 py-3.5 text-base font-semibold shadow-lg shadow-primary/25"
              onClick={() => navigate(isLoggedIn ? '/' : '/auth/login')}
            >
              {isLoggedIn ? t('portal.startPractice') : t('portal.startFree')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </ShimmerButton>

            <Button
              variant="outline"
              size="lg"
              className="px-8 py-3.5 text-base font-semibold rounded-full border-2"
              onClick={() => navigate(isLoggedIn ? '/script' : '/auth/register')}
            >
              <Play className="mr-2 h-5 w-5" />
              {t('portal.freeTrial')}
            </Button>
          </motion.div>

          {/* 底部统计徽章 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 pt-8"
          >
            {[
              { icon: Languages, text: '8 种语言' },
              { icon: CheckCircle, text: 'AI 精准评分' },
              { icon: Zap, text: '实时反馈' },
              { icon: Trophy, text: '全真模拟' },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                {text}
              </div>
            ))}
          </motion.div>
        </div>

        {/* 底部渐变过渡 */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          STATS SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative px-4 pb-20 lg:pb-28">
        <FadeInSection>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {stats.map(({ value, suffix, label, icon: Icon }) => (
                <div
                  key={label}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-center transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="font-display text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
                      <NumberTicker value={value} />
                      <span className="text-primary">{suffix}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground font-medium">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeInSection>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FEATURES SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section className="px-4 pb-20 lg:pb-28">
        <FadeInSection className="max-w-5xl mx-auto text-center mb-12 lg:mb-16">
          <SectionLabel>核心功能</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
            场景化英语，真正说出口
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            漫语町（ManYu）覆盖英语输出训练全流程，从 Chunk 激活到剧本实战，帮你练到真正能开口
          </p>
        </FadeInSection>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {features.map((feature, index) => (
            <FadeInSection key={feature.title} delay={index * 0.1}>
              <div
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-border',
                  'p-6 lg:p-8 transition-all duration-300',
                  'hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1',
                  'bg-card',
                )}
              >
                {/* 渐变背景 */}
                <div
                  className={cn(
                    'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                    'bg-gradient-to-br',
                    feature.bgGradient,
                  )}
                />

                <div className="relative">
                  {/* 图标 */}
                  <div
                    className={cn(
                      'inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-5',
                      'bg-gradient-to-br shadow-lg',
                      feature.gradient,
                    )}
                  >
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>

                  {/* 标题 */}
                  <h3 className="font-display text-xl font-bold text-foreground mb-2">
                    {feature.title}
                  </h3>

                  {/* 描述 */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>

                  {/* 装饰性 Learn More */}
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
                    了解更多
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative px-4 pb-20 lg:pb-28">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-muted/30" />
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

        <FadeInSection className="relative max-w-5xl mx-auto text-center mb-12 lg:mb-16">
          <SectionLabel>四步上手</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
            从开口到通关
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            四步从「看得懂」到「说得出」，让英语成为你的本能
          </p>
        </FadeInSection>

        <div className="relative max-w-5xl mx-auto">
          {/* 连接线（桌面端） */}
          <div className="hidden lg:block absolute top-20 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {steps.map((step, index) => (
              <FadeInSection key={step.number} delay={index * 0.15}>
                <div className="relative flex flex-col items-center text-center">
                  {/* 序号圆圈 */}
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-card border-2 border-primary/20 shadow-lg shadow-primary/5 mb-5">
                    <span className="font-display text-xl font-extrabold text-primary">
                      {step.number}
                    </span>
                  </div>

                  {/* 图标 */}
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>

                  <h3 className="font-display text-lg font-bold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                    {step.description}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          TARGET AUDIENCE
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative px-4 pb-20 lg:pb-28">
        <FadeInSection className="max-w-5xl mx-auto text-center mb-12 lg:mb-16">
          <SectionLabel>适合人群</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
            无论你现在在哪，都能在这里进步
          </h2>
        </FadeInSection>

        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[
            {
              icon: GraduationCap,
              title: '准备出国留学',
              description: '雅思/托福备考者，想提前适应国外生活场景中的英语交流',
              iconColor: 'from-blue-500 to-cyan-400',
              bgColor: 'from-blue-500/10 to-cyan-500/10',
            },
            {
              icon: Plane,
              title: '旅行英语需求',
              description: '自由行爱好者，想摆脱翻译软件，用英语自信应对旅行场景',
              iconColor: 'from-emerald-500 to-teal-400',
              bgColor: 'from-emerald-500/10 to-teal-500/10',
            },
            {
              icon: Coffee,
              title: '职场英语提升',
              description: '工作中需要用英语交流，想提升口语表达的自然度和流利度',
              iconColor: 'from-violet-500 to-purple-400',
              bgColor: 'from-violet-500/10 to-purple-500/10',
            },
            {
              icon: MessageSquare,
              title: '日常社交突破',
              description: '英语学了多年但不敢开口，想突破心理障碍真正开始说英语',
              iconColor: 'from-rose-500 to-pink-400',
              bgColor: 'from-rose-500/10 to-pink-500/10',
            },
          ].map((item, index) => (
            <FadeInSection key={item.title} delay={index * 0.1}>
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <div
                  className={cn(
                    'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                    'bg-gradient-to-br',
                    item.bgColor,
                  )}
                />
                <div className="relative">
                  <div
                    className={cn(
                      'inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4 mx-auto',
                      'bg-gradient-to-br shadow-lg',
                      item.iconColor,
                    )}
                  >
                    <item.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════════════════════════ */}
      <section className="px-4 pb-20 lg:pb-28">
        <FadeInSection className="max-w-5xl mx-auto text-center mb-12 lg:mb-16">
          <SectionLabel>用户评价</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
            超过 10,000 名考生的选择
          </h2>
        </FadeInSection>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {testimonials.map((t, index) => (
            <FadeInSection key={index} delay={index * 0.1}>
              <div className="relative rounded-2xl border border-border bg-card p-6 lg:p-8 transition-all duration-300 hover:shadow-lg">
                {/* 引号装饰 */}
                <div className="absolute -top-3 -left-2 text-5xl font-serif text-primary/20 select-none">
                  "
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-5 pt-4">
                  {t.text}
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <span className="font-display text-sm font-bold text-primary">
                      {t.name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FAQ SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section className="px-4 pb-20 lg:pb-28">
        <FadeInSection className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <SectionLabel>常见问题</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
            你想知道的都在这里
          </h2>
        </FadeInSection>

        <div className="max-w-3xl mx-auto space-y-3">
          {[
            {
              q: '适合什么水平的学习者？',
              a: '从零基础到高级学习者都适合。系统根据你的输出能力等级推荐合适的场景和 Chunk，每个场景都配有核心表达块和参考回答，循序渐进提升口语输出能力。',
            },
            {
              q: '真的能提高口语吗？',
              a: '我们的核心方法是通过「Chunk 激活 → 开口输出 → AI 纠错 → 复述升级」的闭环训练。不是死记硬背，而是让你在真实场景中反复练习，把英语变成肌肉记忆。',
            },
            {
              q: 'AI 纠错准确吗？',
              a: '基于 DeepSeek 大模型进行多维度分析：语法错误、词汇搭配、中式表达、自然度评分。经过数万条口语数据的训练和优化，反馈质量持续提升。',
            },
            {
              q: '免费版和会员有什么区别？',
              a: '免费版可以体验 Chapter 0 剧本和部分场景练习。会员解锁全部场景、无限 AI 纠错、详细分析报告、个性化学习路径等高级功能。',
            },
            {
              q: '需要下载 App 吗？',
              a: '完全不需要下载！直接在浏览器中打开即可使用，手机、平板、电脑全适配。同时提供 iOS 和 Android App（通过 Capacitor 构建），可在应用商店下载。',
            },
          ].map((faq, index) => (
            <FadeInSection key={index} delay={index * 0.05}>
              <details className="group rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:shadow-md">
                <summary className="flex items-center justify-between p-5 cursor-pointer list-none text-sm font-semibold text-foreground hover:text-primary transition-colors">
                  {faq.q}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-90" />
                </summary>
                <div className="px-5 pb-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              </details>
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative px-4 py-20 lg:py-32 overflow-hidden">
        {/* 渐变背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary to-blue-700" />
        <FloatingDecorations />

        <FadeInSection className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            上场前，先说好。
          </h2>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
            免费注册即可开始练习。AI 教练 24 小时在线，随时随地提升英语口语能力。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <ShimmerButton
              shimmerColor="rgba(255,255,255,0.5)"
              background="rgba(255,255,255,0.2)"
              className="px-10 py-4 text-base font-bold backdrop-blur-sm border-white/30"
              onClick={() => navigate(isLoggedIn ? '/' : '/auth/register')}
            >
              {isLoggedIn ? '开始练习' : '立即免费注册'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </ShimmerButton>
          </div>
        </FadeInSection>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-12 lg:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* 品牌 */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-display text-lg font-bold text-foreground mb-3">
                英游记
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                场景化沉浸式英语输出训练平台，帮你把英语从「看得懂」练到「说得出」。
              </p>
            </div>

            {/* 产品 */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">产品</h4>
              <ul className="space-y-2">
                {[
                  { label: '场景练习', to: '/practice' },
                  { label: '剧本模式', to: '/script' },
                  { label: '探索模式', to: '/explore' },
                  { label: '表达库', to: '/expressions' },
                ].map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => navigate(link.to)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* 成长 */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">成长</h4>
              <ul className="space-y-2">
                {[
                  { label: '我的成长', to: '/growth' },
                  { label: '成就殿堂', to: '/achievements' },
                  { label: '排行榜', to: '/leaderboard' },
                  { label: '邀请好友', to: '/invite' },
                ].map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => navigate(link.to)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* 关于 */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">关于</h4>
              <ul className="space-y-2">
                {[
                  { label: '服务条款', to: '/system/terms' },
                  { label: '隐私政策', to: '/system/privacy' },
                  { label: '意见反馈', to: '/feedback' },
                  { label: '联系客服', to: '/system/contact' },
                ].map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => navigate(link.to)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} 英游记（EngJourney）. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {[
                { icon: Languages, text: '8 种语言' },
                { icon: CheckCircle, text: 'AI 精准评分' },
                { icon: Zap, text: '实时反馈' },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <Icon className="h-3 w-3" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default PortalPage
