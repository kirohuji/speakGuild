import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'
import {
  ArrowRight,
  AudioLines,
  BrainCircuit,
  CalendarRange,
  Footprints,
  Gauge,
  Gem,
  MicVocal,
  Route,
  Speech,
  Telescope,
  VenetianMask,
  WholeWord,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/providers/auth-provider'
import { FeedbackDialog } from '@/features/feedback/components/feedback-dialog'
import { LandingFooter, LandingHeader } from '@/features/system/components/landing-shell'
import {
  DriftAtmosphere,
  Float,
  Reveal,
  StaggerText,
  landingEase,
} from '@/features/system/components/landing-motion'

export function PortalPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const isLoggedIn = !!session
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const reduce = useReducedMotion()

  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 40])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.9], [1, reduce ? 1 : 0.45])

  const whatWeHave = [
    { icon: CalendarRange, title: t('portal.whatWeHave1Title'), desc: t('portal.whatWeHave1Desc') },
    { icon: WholeWord, title: t('portal.whatWeHave2Title'), desc: t('portal.whatWeHave2Desc') },
    { icon: BrainCircuit, title: t('portal.whatWeHave3Title'), desc: t('portal.whatWeHave3Desc') },
  ]

  const features = [
    { icon: CalendarRange, title: t('portal.feature1Title'), desc: t('portal.feature1Desc') },
    { icon: MicVocal, title: t('portal.feature2Title'), desc: t('portal.feature2Desc') },
    { icon: WholeWord, title: t('portal.feature3Title'), desc: t('portal.feature3Desc') },
    { icon: Route, title: t('portal.feature4Title'), desc: t('portal.feature4Desc') },
    { icon: AudioLines, title: t('portal.feature5Title'), desc: t('portal.feature5Desc') },
    { icon: Gauge, title: t('portal.feature6Title'), desc: t('portal.feature6Desc') },
  ]

  const steps = [
    { num: '01', title: t('portal.step1Title'), desc: t('portal.step1Desc') },
    { num: '02', title: t('portal.step2Title'), desc: t('portal.step2Desc') },
    { num: '03', title: t('portal.step3Title'), desc: t('portal.step3Desc') },
    { num: '04', title: t('portal.step4Title'), desc: t('portal.step4Desc') },
  ]

  const audience = [
    { icon: Telescope, title: t('portal.audience1Title'), desc: t('portal.audience1Desc') },
    { icon: Footprints, title: t('portal.audience2Title'), desc: t('portal.audience2Desc') },
    { icon: Speech, title: t('portal.audience3Title'), desc: t('portal.audience3Desc') },
    { icon: Gem, title: t('portal.audience4Title'), desc: t('portal.audience4Desc') },
  ]

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <LandingHeader />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -right-40 top-[32%] size-80 rounded-full bg-primary/[0.04] blur-3xl"
          animate={reduce ? undefined : { x: [0, -20, 10, 0], y: [0, 16, -10, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -left-40 top-[62%] size-80 rounded-full bg-amber-300/[0.05] blur-3xl"
          animate={reduce ? undefined : { x: [0, 18, -12, 0], y: [0, -14, 12, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <section
        ref={heroRef}
        className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8 lg:pb-32 lg:pt-24"
      >
        <DriftAtmosphere variant="dots" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <motion.p
                initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, ease: landingEase }}
                className="mb-6 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                {t('portal.coreCapabilities')}
              </motion.p>

              <h1 className="text-[2.5rem] font-extrabold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                <StaggerText text={t('portal.heroTitle1')} className="block" delay={0.06} />
                <StaggerText
                  text={t('portal.heroTitle2')}
                  delay={0.22}
                  className="block"
                  unitClassName="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
                />
              </h1>

              <motion.p
                initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.65, delay: 0.45, ease: landingEase }}
                className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
              >
                {t('portal.heroDesc')}
              </motion.p>

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5, ease: landingEase }}
                className="mt-10 flex flex-col gap-3 sm:flex-row"
              >
                <Button
                  size="primary-lg"
                  className="shadow-[0_4px_24px_rgba(0,46,95,0.16)]"
                  onClick={() => navigate(isLoggedIn ? '/' : '/auth/login')}
                >
                  {isLoggedIn ? t('portal.startPractice') : t('portal.startFree')}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </motion.div>

              <motion.div
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75, duration: 0.5 }}
                className="mt-12 flex items-center gap-6 text-sm text-muted-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <AudioLines className="size-4" />
                  {t('portal.platformIos')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Workflow className="size-4" />
                  {t('portal.platformIpad')}
                </span>
              </motion.div>
            </div>

            <motion.div
              initial={reduce ? false : { opacity: 0, x: 28, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.28, duration: 0.75, ease: landingEase }}
              className="relative hidden lg:block"
            >
              <div className="relative aspect-[4/3]">
                <div className="absolute inset-0 flex flex-col justify-center rounded-2xl border-0 bg-muted/30 p-8 shadow-none">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <Float className="flex size-12 items-center justify-center rounded-xl bg-primary/[0.07]">
                        <MicVocal className="size-6 text-primary" />
                      </Float>
                      <div>
                        <div className="text-sm font-bold text-foreground">{t('portal.scenePractice')}</div>
                        <div className="text-xs text-muted-foreground">{t('portal.aiFeedback')}</div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                      <motion.div
                        initial={reduce ? false : { opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55, duration: 0.5, ease: landingEase }}
                        className="flex items-start gap-2.5"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                          Q
                        </div>
                        <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-2.5 text-sm text-foreground">
                          Can you tell me about your travel experience?
                        </div>
                      </motion.div>
                      <motion.div
                        initial={reduce ? false : { opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.75, duration: 0.5, ease: landingEase }}
                        className="flex items-start justify-end gap-2.5"
                      >
                        <div className="rounded-2xl rounded-tr-sm bg-primary/10 px-4 py-2.5 text-sm text-foreground">
                          I went to Japan last year. It was very interesting...
                        </div>
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                          A
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>

                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.95, duration: 0.5, ease: landingEase }}
                  className="absolute -bottom-4 -right-4 flex items-center gap-3 rounded-xl border-0 bg-background px-4 py-3 shadow-none"
                >
                  <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100">
                    <BrainCircuit className="size-4 text-emerald-600" />
                  </div>
                  <div className="text-xs font-medium text-foreground">{t('portal.scoreCard')}</div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-36">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <div>
                <h2 className="mb-10 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  {t('portal.whatsInTitle1')}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {' '}
                    {t('portal.whatsInTitle2')}
                  </span>
                </h2>

                <div className="flex flex-col gap-4">
                  {whatWeHave.map((item, i) => (
                    <Reveal key={item.title} delay={i * 0.1} y={16}>
                      <div className="flex gap-4 rounded-lg bg-muted/30 p-4 transition-colors duration-200 hover:bg-muted/50">
                        <Float
                          delay={i * 0.25}
                          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/[0.06]"
                        >
                          <item.icon className="size-5 text-primary" />
                        </Float>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="relative hidden lg:block">
                <div className="rounded-2xl border-0 bg-muted/30 p-10 shadow-none">
                  <p className="mb-8 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('portal.learningData')}
                  </p>
                  <div className="flex flex-col gap-8">
                    {[
                      { label: t('portal.statScenes'), value: t('portal.statScenesValue'), pct: '88%' },
                      { label: t('portal.statChunks'), value: t('portal.statChunksValue'), pct: '72%' },
                      { label: t('portal.statLevels'), value: t('portal.statLevelsValue'), pct: '64%' },
                      { label: t('portal.statUsers'), value: t('portal.statUsersValue'), pct: '80%' },
                    ].map((stat, i) => (
                      <div key={stat.label}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{stat.label}</span>
                          <span className="text-sm font-bold text-foreground">{stat.value}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: stat.pct }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: i * 0.08, ease: landingEase }}
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Float
                  amplitude={3}
                  className="absolute -bottom-3 -left-3 flex items-center gap-3 rounded-xl border-0 bg-background px-4 py-3 shadow-none"
                >
                  <VenetianMask className="size-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">{t('portal.progressFloat')}</span>
                </Float>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-36">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-14 text-center lg:mb-20">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {t('portal.featuresTitle1')}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {' '}
                {t('portal.featuresTitle2')}
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t('portal.featuresDesc')}</p>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05} y={18}>
                <motion.div whileHover={reduce ? undefined : { y: -3 }} transition={{ duration: 0.25 }}>
                  <Card className="group h-full rounded-lg border-0 bg-muted/30 shadow-none ring-0 transition-colors duration-300 hover:bg-muted/50 dark:ring-0">
                    <CardContent className="p-5 lg:p-6">
                      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-background/70 transition-colors group-hover:bg-background">
                        <f.icon className="size-5 text-primary" />
                      </div>
                      <h4 className="mb-2 text-base font-bold text-foreground">{f.title}</h4>
                      <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-36">
        <div className="absolute inset-0 bg-muted/30" />
        <div className="absolute left-0 right-0 top-0 h-16 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto max-w-6xl">
          <Reveal className="mb-14 text-center lg:mb-20">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {t('portal.stepsTitle1')}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {' '}
                {t('portal.stepsTitle2')}
              </span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 0.08} y={20}>
                <Card className="relative h-full overflow-hidden rounded-lg border-0 bg-background shadow-none ring-0 transition-colors duration-300 hover:bg-background dark:ring-0">
                  <CardContent className="p-5 lg:p-6">
                    <div className="mb-4 select-none text-5xl font-extrabold leading-none text-primary/[0.12]">
                      {s.num}
                    </div>
                    <h4 className="mb-2 text-base font-bold text-foreground">{s.title}</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-36">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <div>
                <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  {t('portal.audienceTitle1')}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {' '}
                    {t('portal.audienceTitle2')}
                  </span>
                </h2>
                <p className="max-w-md leading-relaxed text-muted-foreground">{t('portal.audienceDesc')}</p>

                <Button
                  variant="secondary"
                  size="lg"
                  className="mt-8 border-0 shadow-none"
                  onClick={() => navigate(isLoggedIn ? '/' : '/auth/login')}
                >
                  {t('portal.startWhere')}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {audience.map((a, i) => (
                <Reveal key={a.title} delay={i * 0.08} y={16}>
                  <div className="rounded-lg bg-muted/30 p-4 transition-colors duration-200 hover:bg-muted/50">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/[0.06]">
                        <a.icon className="size-4 text-primary" />
                      </div>
                      <h4 className="text-sm font-bold text-foreground">{a.title}</h4>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{a.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <LandingFooter
        extraLinks={
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="transition-colors hover:text-foreground"
          >
            {t('portal.feedback')}
          </button>
        }
      />

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  )
}

export default PortalPage
