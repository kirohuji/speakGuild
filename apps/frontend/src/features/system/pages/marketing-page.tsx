import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'
import {
  ArrowRight,
  BookMarked,
  Download,
  Drama,
  Headset,
  Library,
  MapPinned,
  MessagesSquare,
  Orbit,
  ScrollText,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { LandingFooter, LandingHeader } from '../components/landing-shell'
import {
  DriftAtmosphere,
  Float,
  Reveal,
  StaggerText,
  landingEase,
} from '../components/landing-motion'

function MomentCarousel({ moments }: { moments: string[] }) {
  const [active, setActive] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce || moments.length === 0) return
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % moments.length)
    }, 2200)
    return () => window.clearInterval(id)
  }, [moments.length, reduce])

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
      {moments.map((moment, i) => {
        const isActive = i === active
        return (
          <motion.span
            key={moment}
            initial={reduce ? false : { opacity: 0, y: 12, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: landingEase }}
            animate={reduce ? undefined : { scale: isActive ? 1.045 : 1 }}
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-500',
              isActive
                ? 'bg-primary/[0.12] text-primary'
                : 'bg-muted/45 text-foreground',
            )}
          >
            {moment}
          </motion.span>
        )
      })}
    </div>
  )
}

export function MarketingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const embedded = pathname === '/system/marketing'
  const reduce = useReducedMotion()

  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 56])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, reduce ? 1 : 0.35])

  const pillars = [
    { icon: Store, title: t('system.marketing.pillarSceneTitle'), desc: t('system.marketing.pillarSceneText') },
    { icon: Drama, title: t('system.marketing.pillarAiTitle'), desc: t('system.marketing.pillarAiText') },
    { icon: Orbit, title: t('system.marketing.pillarScriptTitle'), desc: t('system.marketing.pillarScriptText') },
  ]

  const features = [
    { icon: Drama, title: t('system.marketing.feature1Title'), desc: t('system.marketing.feature1Desc') },
    { icon: MapPinned, title: t('system.marketing.feature2Title'), desc: t('system.marketing.feature2Desc') },
    { icon: ScrollText, title: t('system.marketing.feature3Title'), desc: t('system.marketing.feature3Desc') },
    { icon: Download, title: t('system.marketing.feature4Title'), desc: t('system.marketing.feature4Desc') },
    { icon: MessagesSquare, title: t('system.marketing.feature5Title'), desc: t('system.marketing.feature5Desc') },
    { icon: Library, title: t('system.marketing.feature6Title'), desc: t('system.marketing.feature6Desc') },
  ]

  const steps = [
    { icon: Store, num: '01', title: t('system.marketing.step1Title'), desc: t('system.marketing.step1Desc') },
    { icon: Download, num: '02', title: t('system.marketing.step2Title'), desc: t('system.marketing.step2Desc') },
    { icon: MapPinned, num: '03', title: t('system.marketing.step3Title'), desc: t('system.marketing.step3Desc') },
    { icon: BookMarked, num: '04', title: t('system.marketing.step4Title'), desc: t('system.marketing.step4Desc') },
  ]

  const moments = [
    t('system.marketing.momentAirport'),
    t('system.marketing.momentApartment'),
    t('system.marketing.momentCampus'),
    t('system.marketing.momentCoffee'),
    t('system.marketing.momentGroup'),
    t('system.marketing.momentShopping'),
  ]

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {!embedded && <LandingHeader />}

      <section
        ref={heroRef}
        className={cn(
          'relative overflow-hidden px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-36',
          embedded ? 'pt-8 sm:pt-12' : 'pt-16 sm:pt-24 lg:pt-28',
        )}
      >
        <DriftAtmosphere />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 mx-auto max-w-3xl text-center"
        >
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: landingEase }}
            className="mb-5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground"
          >
            {t('system.marketing.heroBadge')}
          </motion.p>

          <h1 className="text-[2.75rem] font-extrabold leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            <StaggerText text={t('system.marketing.brand')} className="block" delay={0.08} />
            <StaggerText
              text={t('system.marketing.heroTagline')}
              delay={0.28}
              className="mt-2 block"
              unitClassName="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent"
            />
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 0.55, ease: landingEase }}
            className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {t('system.marketing.heroDesc')}
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.72, duration: 0.55, ease: landingEase }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button
              size="primary-lg"
              className="shadow-[0_4px_24px_rgba(0,46,95,0.16)]"
              onClick={() => navigate('/')}
            >
              {t('system.marketing.openApp')}
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="border-0 shadow-none"
              onClick={() => navigate('/support')}
            >
              <Headset data-icon="inline-start" />
              {t('system.marketing.supportCenter')}
            </Button>
          </motion.div>
        </motion.div>

        <div className="relative z-10 mx-auto mt-16 max-w-5xl sm:mt-20">
          <Reveal delay={0.1}>
            <p className="mb-5 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {t('system.marketing.practiceMoments')}
            </p>
            <MomentCarousel moments={moments} />
          </Reveal>
        </div>
      </section>

      <section className="relative px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-36">
        <div className="mx-auto max-w-3xl">
          <Reveal className="mb-12 text-center sm:mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {t('system.marketing.whatsInTitle1')}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {' '}
                {t('system.marketing.whatsInTitle2')}
              </span>
            </h2>
          </Reveal>

          <div className="flex flex-col gap-8">
            {pillars.map((item, i) => (
              <Reveal key={item.title} delay={0.15 + i * 0.12} y={20}>
                <div className="flex gap-5 sm:gap-7">
                  <Float
                    delay={i * 0.3}
                    duration={3.6 + i * 0.4}
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.08] sm:size-12"
                  >
                    <item.icon className="size-5 text-primary" />
                  </Float>
                  <div className="min-w-0 pt-1.5">
                    <h3 className="text-lg font-bold text-foreground sm:text-xl">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features：居中标题 + 双列网格，接在能力叙事之后 */}
      <section className="relative overflow-hidden px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-36">
        <div className="absolute inset-0 bg-muted/25" />
        <div className="absolute left-0 right-0 top-0 h-20 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto max-w-5xl">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t('system.marketing.featuresTitle1')}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {' '}
                {t('system.marketing.featuresTitle2')}
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              {t('system.marketing.featuresDesc')}
            </p>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05} y={18}>
                <motion.div
                  whileHover={reduce ? undefined : { y: -2 }}
                  transition={{ duration: 0.25 }}
                  className="flex h-full gap-4 rounded-2xl bg-background/70 p-5 transition-colors duration-300 hover:bg-background sm:p-6"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07]">
                    <f.icon className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-foreground sm:text-lg">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 sm:pb-32 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-12 text-center sm:mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {t('system.marketing.stepsTitle1')}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {' '}
                {t('system.marketing.stepsTitle2')}
              </span>
            </h2>
          </Reveal>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 0.1} y={22}>
                <div className="relative">
                  {i < steps.length - 1 && (
                    <motion.div
                      className="absolute left-[calc(50%+2rem)] right-[-1.5rem] top-5 hidden h-px origin-left bg-border/70 lg:block"
                      initial={reduce ? false : { scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: 0.25 + i * 0.1, ease: landingEase }}
                    />
                  )}
                  <div className="mb-4 flex items-center gap-3">
                    <Float
                      duration={3.2 + i * 0.25}
                      className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.08]"
                    >
                      <s.icon className="size-4 text-primary" />
                    </Float>
                    <span className="text-xs font-bold tracking-widest text-muted-foreground">
                      {s.num}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {!embedded && <LandingFooter />}
    </div>
  )
}
