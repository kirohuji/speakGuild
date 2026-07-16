import { useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { motion, useInView } from 'motion/react'
import {
  Building2, MapPin, Mail,
  Smartphone, Monitor, Rocket, Wrench, User,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
} from '@/components/ui/dialog'

/* ═══════════════════════════════════════════════════════════════
   Hero 背景装饰（与 Portal 对齐）
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
   动画工具（与 Portal 对齐）
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
   服务能力数据
   ═══════════════════════════════════════════════════════════════ */

const capabilities = [
  {
    icon: Smartphone,
    title: '移动端开发',
    desc: 'iOS / Android 原生与跨平台（Capacitor、React Native）App 开发，覆盖从 UI 设计到 App Store / Google Play 上架全流程。',
  },
  {
    icon: Monitor,
    title: 'PC 端 & Web 开发',
    desc: 'React / Vue 技术栈的 Web 应用与桌面端开发，支持管理后台、数据看板、SaaS 平台等企业级项目。',
  },
  {
    icon: Rocket,
    title: '从 0 到部署上线',
    desc: '需求梳理 → 原型设计 → 前后端开发 → 服务器部署 → 运维监控，一站式承包，客户只需确认需求与验收。',
  },
  {
    icon: Wrench,
    title: '技术咨询与维护',
    desc: '现有项目技术评估、架构优化、Bug 修复与长期维护，帮助客户以最低成本保持产品健康迭代。',
  },
]

/* ═══════════════════════════════════════════════════════════════
   主组件 — 上海影与达科技有限公司
   ═══════════════════════════════════════════════════════════════ */

export function CompanyPage() {
  return (
    <>
      <Helmet>
        <title>上海影与达科技有限公司 — 软件定制开发与技术咨询</title>
        <meta name="description" content="上海影与达科技有限公司，专注移动端/Web 全栈开发与从 0 到 1 上线交付，提供技术咨询与长期维护服务。" />
      </Helmet>
      <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* 背景光晕 — 与 Portal 对齐 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 top-[32%] size-80 rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute -left-40 top-[62%] size-80 rounded-full bg-amber-300/[0.05] blur-3xl" />
      </div>

      {/* ═══════════════════════════════════════════════════════
          HERO — 居中排版
          ═══════════════════════════════════════════════════════ */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-24 pb-16 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        <HeroBg />

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="mb-6 text-[11px] font-medium tracking-wide uppercase">
              独立开发工作室
            </Badge>

            <h1 className="text-[2.5rem] sm:text-5xl lg:text-6xl font-extrabold leading-[1.06] tracking-tight text-foreground">
              上海
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                影与达科技
              </span>
            </h1>

            <p className="mt-3 text-base sm:text-lg text-muted-foreground font-medium">
              Shanghai YingYuDa Technology Co., Ltd.
            </p>

            <p className="mt-6 max-w-xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
              独立开发工作室，专注于移动端工具类产品的设计、开发与技术支持。
              覆盖教育、效率、生活服务等方向，帮助客户将创意落地为实用的小工具。
            </p>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ═══════════════════════════════════════════════════════
          主体内容区
          ═══════════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 lg:pb-36">
        <div className="max-w-6xl mx-auto">

          {/* ── 旗下作品 ── */}
          <Reveal>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                旗下作品
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-10">
                我们的
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> 产品</span>
              </h2>

              <div className="grid lg:grid-cols-2 gap-8">
                {/* ── 漫语町 ── */}
                <div className="rounded-lg bg-muted/30 p-8 flex flex-col transition-colors duration-200 hover:bg-muted/50">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="size-14 rounded-2xl bg-primary/[0.07] flex items-center justify-center shrink-0">
                      <img src="/logo.png" alt="漫语町" className="size-8 dark:invert" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground">漫语町 ManYu</div>
                      <div className="text-xs text-muted-foreground">英语口语训练 App</div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                    沉浸式英语输出训练 App，通过场景化学习、AI 口语纠错、
                    互动剧本和沉浸式探索，帮助学习者从「看得懂」真正练到「说得出」。
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {['AI 口语纠错', 'Chunk 学习法', '互动剧本', '沉浸探索'].map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    iOS · Android
                  </div>
                </div>

                {/* ── Hope / 佳麦 ── */}
                <div className="rounded-lg bg-muted/30 p-8 flex flex-col transition-colors duration-200 hover:bg-muted/50">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="size-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">H</span>
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground">Hope · 佳麦</div>
                      <div className="text-xs text-muted-foreground">社区组织阅读管理平台</div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                    专为社区组织内部人员设计的阅读管理平台，
                    提供阅读本管理、即时聊天、文件共享与管理等功能，
                    帮助组织高效协作与知识沉淀。
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {['阅读本管理', '即时聊天', '文件管理', '多端支持'].map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4">
                    <a
                      href="https://hope.lourd.top:3605"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                    >
                      hope.lourd.top:3605
                    </a>
                    <a
                      href="https://github.com/kirohuji/hope-front"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                    >
                      GitHub ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Separator className="my-16 sm:my-20" />

          {/* ── 服务能力 ── */}
          <Reveal delay={0.1}>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                我们能做什么
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-10">
                服务
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> 能力</span>
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                {capabilities.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex gap-4 rounded-lg bg-muted/30 p-4 transition-colors duration-200 hover:bg-muted/50"
                  >
                    <div className="shrink-0 flex size-10 items-center justify-center rounded-lg bg-primary/[0.06]">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground">{title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Separator className="my-16 sm:my-20" />

          {/* ── 联系方式 ── */}
          <Reveal delay={0.2}>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                取得联系
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-10">
                联系
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> 我们</span>
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: Building2,
                    label: '公司名称',
                    value: '上海影与达科技有限公司',
                    href: null,
                  },
                  {
                    icon: MapPin,
                    label: '公司地址',
                    value: '上海市浦东新区金杨六街坊35幢402室',
                    href: null,
                  },
                  {
                    icon: Mail,
                    label: '电子邮箱',
                    value: 'z1309014381@gmail.com',
                    href: 'mailto:z1309014381@gmail.com',
                  },
                ].map(({ icon: Icon, label, value, href }) => (
                  <div
                    key={label}
                    className="flex gap-4 rounded-lg bg-muted/30 p-4 transition-colors duration-200 hover:bg-muted/50"
                  >
                    <div className="shrink-0 flex size-10 items-center justify-center rounded-lg bg-primary/[0.06]">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                      {href ? (
                        <a
                          href={href}
                          {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          className="mt-0.5 block text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                        >
                          {value}
                        </a>
                      ) : (
                        <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Separator className="my-16 sm:my-20" />

          {/* ── 人员介绍 ── */}
          <Reveal delay={0.2}>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                团队成员
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-10">
                关于
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> 我</span>
              </h2>

              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="rounded-lg bg-muted/30 p-6 flex items-start gap-5 flex-1 transition-colors duration-200 hover:bg-muted/50">
                  <div className="size-16 rounded-full bg-primary/[0.08] flex items-center justify-center shrink-0">
                    <User className="size-7 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground">郑勇达</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">创始人 &amp; 全栈开发</p>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      独立开发者，负责产品设计、前后端开发与项目交付。
                      热爱用技术将创意变成可用的产品，享受从 0 到 1 的创造过程。
                    </p>
                  </div>
                </div>

                {/* 营业执照 — 点击放大 */}
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="group cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="查看营业执照"
                    >
                      <img
                        src="/yyzz.png"
                        alt="营业执照"
                        className="block w-28 sm:w-36 object-contain transition-transform duration-200 group-hover:scale-105"
                      />
                    </button>
                  </DialogTrigger>
                  <DialogContent
                    overlayClassName="bg-black/70"
                    className="max-w-[90vw] sm:max-w-[640px] border-0 bg-transparent p-0 shadow-none"
                  >
                    <div className="flex items-center justify-center">
                      <img
                        src="/yyzz.png"
                        alt="营业执照"
                        className="max-h-[85vh] w-auto rounded-lg object-contain"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          Footer
          ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-border/60 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} 上海影与达科技有限公司. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
    </>
  )
}

export default CompanyPage
