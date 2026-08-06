import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
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

export function CompanyPage() {
  const { t } = useTranslation()
  const capabilities = [
    {
      icon: Smartphone,
      title: t('company.capabilityMobileTitle'),
      desc: t('company.capabilityMobileDesc'),
    },
    {
      icon: Monitor,
      title: t('company.capabilityWebTitle'),
      desc: t('company.capabilityWebDesc'),
    },
    {
      icon: Rocket,
      title: t('company.capabilityLaunchTitle'),
      desc: t('company.capabilityLaunchDesc'),
    },
    {
      icon: Wrench,
      title: t('company.capabilityMaintainTitle'),
      desc: t('company.capabilityMaintainDesc'),
    },
  ]
  return (
    <>
      <Helmet>
        <title>{t('company.metaTitle')}</title>
        <meta name="description" content={t('company.metaDescription')} />
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
              {t('company.studioBadge')}
            </Badge>

            <h1 className="text-[2.5rem] sm:text-5xl lg:text-6xl font-extrabold leading-[1.06] tracking-tight text-foreground">
              {t('company.heroTitle1')}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                {t('company.heroTitle2')}
              </span>
            </h1>

            <p className="mt-3 text-base sm:text-lg text-muted-foreground font-medium">
              Shanghai YingYuDa Technology Co., Ltd.
            </p>

            <p className="mt-6 max-w-xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
              {t('company.heroDesc1')}
              {t('company.heroDesc2')}
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
                {t('company.worksLabel')}
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-10">
                {t('company.worksTitle1')}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> {t('company.worksTitle2')}</span>
              </h2>

              <div className="grid lg:grid-cols-2 gap-8">
                {/* ── 漫语町 ── */}
                <div className="rounded-lg bg-muted/30 p-8 flex flex-col transition-colors duration-200 hover:bg-muted/50">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="size-14 rounded-2xl bg-primary/[0.07] flex items-center justify-center shrink-0">
                      <img src="/logo.png" alt="漫语町" className="size-8 dark:invert" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground">漫语町 ManYuDing</div>
                      <div className="text-xs text-muted-foreground">{t('company.manYuDesc')}</div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                    {t('company.manYuIntro')}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {['company.manYuTag1', 'company.manYuTag2', 'company.manYuTag3', 'company.manYuTag4'].map((key) => (
                      <span
                        key={key}
                        className="inline-flex items-center rounded-full bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {t(key)}
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
                      <div className="text-xs text-muted-foreground">{t('company.hopeDesc')}</div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                    {t('company.hopeIntro')}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {['company.hopeTag1', 'company.hopeTag2', 'company.hopeTag3', 'company.hopeTag4'].map((key) => (
                      <span
                        key={key}
                        className="inline-flex items-center rounded-full bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {t(key)}
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
                {t('company.capabilitiesLabel')}
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-10">
                {t('company.capabilitiesTitle1')}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> {t('company.capabilitiesTitle2')}</span>
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
                {t('company.contactLabel')}
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-10">
                {t('company.contactTitle1')}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> {t('company.contactTitle2')}</span>
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: Building2,
                    label: t('company.companyNameLabel'),
                    value: t('company.companyName'),
                    href: null,
                  },
                  {
                    icon: MapPin,
                    label: t('company.companyAddressLabel'),
                    value: t('company.companyAddress'),
                    href: null,
                  },
                  {
                    icon: Mail,
                    label: t('company.emailLabel'),
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
                {t('company.teamLabel')}
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-10">
                {t('company.teamTitle1')}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> {t('company.teamTitle2')}</span>
              </h2>

              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="rounded-lg bg-muted/30 p-6 flex items-start gap-5 flex-1 transition-colors duration-200 hover:bg-muted/50">
                  <div className="size-16 rounded-full bg-primary/[0.08] flex items-center justify-center shrink-0">
                    <User className="size-7 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground">{t('company.founderName')}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('company.founderRole')}</p>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      {t('company.founderIntro')}
                    </p>
                  </div>
                </div>

                {/* 营业执照 — 点击放大 */}
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="group cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t('company.licenseAria')}
                    >
                      <img
                        src="/yyzz.png"
                        alt={t('company.licenseAlt')}
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
                        alt={t('company.licenseAlt')}
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
            &copy; {new Date().getFullYear()} {t('company.companyName')}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
    </>
  )
}

export default CompanyPage
