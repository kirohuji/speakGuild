import React, { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'motion/react'
import {
  Mic, BookOpen, Brain, Sparkles, TrendingUp,
  Trophy, Users, FileText, Headphones, ArrowRight,
  MapPin, CheckCircle, Star, Zap, Globe, GraduationCap,
  ChevronRight, Languages, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  { value: 31, suffix: '+', label: '覆盖省份', icon: MapPin },
  { value: 8, suffix: '', label: '支持语种', icon: Languages },
  { value: 98, suffix: '%', label: '用户好评', icon: Star },
  { value: 10000, suffix: '+', label: '活跃考生', icon: Users },
]

const features = [
  {
    icon: MessageSquare,
    title: '多语种面试练习',
    description: '支持中、英、日、韩、法、德、西、俄 8 种语言的导游资格面试模拟，覆盖全国 31 个省份考点',
    gradient: 'from-blue-500 to-cyan-400',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
  },
  {
    icon: Mic,
    title: 'AI 智能评分',
    description: '基于 DeepSeek 大模型的实时口语评估，从发音、语法、流利度多维度精准打分，还原真实考官标准',
    gradient: 'from-violet-500 to-purple-400',
    bgGradient: 'from-violet-500/10 to-purple-500/10',
  },
  {
    icon: Headphones,
    title: 'TTS 语音合成',
    description: 'MiniMax 顶尖语音合成技术，支持多语种、多音色，让你听到最地道的示范朗读',
    gradient: 'from-emerald-500 to-teal-400',
    bgGradient: 'from-emerald-500/10 to-teal-500/10',
  },
  {
    icon: Brain,
    title: '全真模拟面试',
    description: '1:1 还原真实面试场景，限时答题 + 智能评分报告，提前适应面试节奏与压力',
    gradient: 'from-amber-500 to-orange-400',
    bgGradient: 'from-amber-500/10 to-orange-500/10',
  },
  {
    icon: TrendingUp,
    title: '学习数据追踪',
    description: '可视化学习曲线，记录每一次进步。薄弱项诊断 + 个性化推荐，精准提升面试表现',
    gradient: 'from-rose-500 to-pink-400',
    bgGradient: 'from-rose-500/10 to-pink-500/10',
  },
  {
    icon: Globe,
    title: '全平台支持',
    description: 'Web / iOS 双端适配，随时随地练习。支持离线缓存，无网也能练口语',
    gradient: 'from-sky-500 to-blue-400',
    bgGradient: 'from-sky-500/10 to-blue-500/10',
  },
]

const steps = [
  {
    number: '01',
    icon: BookOpen,
    title: '选择考点与语种',
    description: '匹配报考省份和语种，获取专属面试题库与知识卡片',
  },
  {
    number: '02',
    icon: Mic,
    title: '跟读模仿练习',
    description: '聆听标准发音后开口跟读，AI 实时分析发音准确度与流利度',
  },
  {
    number: '03',
    icon: Sparkles,
    title: '获取智能反馈',
    description: '详细评分报告 + 改进建议，针对性提升薄弱环节',
  },
  {
    number: '04',
    icon: Trophy,
    title: '模拟面试检验',
    description: '全真模拟面试环境，检验学习成果，轻松应对正式面试',
  },
]

const testimonials = [
  {
    text: '用了导游说练习了两个月，英语导游面试一次通过！AI 评分特别准，能清楚知道哪里发音不对，哪里表达不地道。',
    name: '张同学',
    role: '2025 届英语导游考生',
  },
  {
    text: '多语种支持太赞了！我考的是日语导游，用导游说练口语效率特别高，TTS 发音比我自己念的标准太多了。',
    name: '李导',
    role: '持证日语导游',
  },
  {
    text: '模拟面试功能太实用了，考前练了 5 次，真正上场一点都不紧张。面试官问的问题跟练习的差不多，简直是开挂！',
    name: '王考生',
    role: '2025 届中文导游考生',
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
              <Languages className="h-3.5 w-3.5" />
              多语种全国导游资格面试练习平台
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
              上场前，
              <br className="sm:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary to-accent">
                先说好
              </span>
            </h1>

            <div className="flex items-center justify-center gap-2 text-2xl sm:text-3xl md:text-4xl font-display font-bold text-muted-foreground">
              <span>AI 驱动的</span>
              <WordRotate
                words={['英语面试', '日语面试', '韩语面试', '法语面试', '多语种面试']}
                duration={2500}
                className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-400"
              />
            </div>
          </motion.div>

          {/* 副标题 */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            导游说（GuideReady）专为全国导游资格面试设计。
            覆盖中、英、日、韩、法、德、西、俄 8 种语言，
            结合 AI 大模型评分 + TTS 语音合成，打造沉浸式多语种面试练习体验。
          </motion.p>

          {/* 品牌口号 */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-sm text-muted-foreground/60 italic"
          >
            "上场前，先说好。"
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
              {isLoggedIn ? '进入题库练习' : '免费开始练习'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </ShimmerButton>

            <Button
              variant="outline"
              size="lg"
              className="px-8 py-3.5 text-base font-semibold rounded-full border-2"
              onClick={() => navigate(isLoggedIn ? '/mock' : '/auth/register')}
            >
              <Trophy className="mr-2 h-5 w-5" />
              模拟面试
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
            多语种面试，一站搞定
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            导游说（GuideReady）覆盖导游资格面试备考全流程，从知识学习到面试模拟，助你轻松通关
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
            四步完成从入门到精通，让面试变得简单
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
            免费注册即可开始练习。AI 教练 24 小时在线，随时随地提升面试口语能力。
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
    </div>
  )
}

export default PortalPage
