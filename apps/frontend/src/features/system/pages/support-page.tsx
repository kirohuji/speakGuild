import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'
import {
  AtSign,
  BadgeHelp,
  Fingerprint,
  Headset,
  Hourglass,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { LandingFooter, LandingHeader } from '../components/landing-shell'
import {
  DriftAtmosphere,
  Float,
  Reveal,
  StaggerText,
  landingEase,
} from '../components/landing-motion'

export function SupportPage() {
  const { t } = useTranslation()
  const reduce = useReducedMotion()

  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 32])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.9], [1, reduce ? 1 : 0.5])

  const supportItems = [
    {
      icon: Headset,
      title: t('support.usage'),
      body: t('support.usageBody'),
    },
    {
      icon: Fingerprint,
      title: t('support.privacy'),
      body: t('support.privacyBody'),
    },
    {
      icon: Hourglass,
      title: t('support.responseTime'),
      body: t('support.responseTimeBody'),
    },
  ]

  const faqs = [
    {
      q: t('support.faqDownload'),
      a: t('support.faqDownloadAnswer'),
    },
    {
      q: t('support.faqAiAccuracy'),
      a: t('support.faqAiAccuracyAnswer'),
    },
    {
      q: t('support.faqMember'),
      a: t('support.faqMemberAnswer'),
    },
  ]

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingHeader />

      <main>
        <section
          ref={heroRef}
          className="relative overflow-hidden px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8 lg:pb-20"
        >
          <DriftAtmosphere />

          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.86fr] lg:items-end"
          >
            <div>
              <motion.p
                initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, ease: landingEase }}
                className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                {t('support.workingInProgress')}
              </motion.p>
              <h1 className="max-w-3xl text-[2.5rem] font-extrabold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                <StaggerText text={t('support.title1')} className="block" delay={0.06} />
                <StaggerText
                  text={t('support.title2')}
                  delay={0.22}
                  className="block"
                  unitClassName="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
                />
              </h1>
              <motion.p
                initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.65, delay: 0.45, ease: landingEase }}
                className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
              >
                {t('support.subtitle')}
              </motion.p>
            </div>

            <Reveal delay={0.2} y={20}>
              <Card className="overflow-hidden rounded-2xl border-0 bg-muted/30 shadow-none ring-0 dark:ring-0">
                <CardContent className="p-0">
                  <div className="relative overflow-hidden bg-muted/45 p-6 lg:p-7">
                    <div className="absolute -right-12 -top-14 size-40 rounded-full bg-primary/[0.08]" />
                    <div className="absolute -bottom-16 left-8 size-36 rounded-full bg-accent/[0.10]" />
                    <div className="relative flex items-start justify-between gap-5">
                      <div>
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border-0 bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-none">
                          <span className="size-1.5 rounded-full bg-success" />
                          {t('support.workingInProgress')}
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">{t('support.officialEmail')}</p>
                        <a
                          href="mailto:z1309014381@gmail.com"
                          className="mt-2 block break-all text-xl font-extrabold tracking-tight text-foreground transition-colors hover:text-primary sm:text-2xl"
                        >
                          z1309014381@gmail.com
                        </a>
                      </div>
                      <Float className="grid size-12 shrink-0 place-items-center rounded-2xl bg-background shadow-none ring-0">
                        <AtSign className="size-6 text-primary" />
                      </Float>
                    </div>
                  </div>
                  <dl className="grid gap-3 p-4 text-sm sm:grid-cols-3 lg:grid-cols-1 lg:p-5 xl:grid-cols-3">
                    <div className="rounded-xl border-0 bg-background p-4">
                      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Hourglass className="size-3.5" />
                        {t('support.workHours')}
                      </dt>
                      <dd className="mt-2 whitespace-pre-line font-semibold leading-snug text-foreground">
                        {t('support.workHoursValue')}
                      </dd>
                    </div>
                    <div className="rounded-xl border-0 bg-background p-4">
                      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <BadgeHelp className="size-3.5" />
                        {t('support.estimatedReply')}
                      </dt>
                      <dd className="mt-2 font-semibold leading-snug text-foreground">
                        {t('support.estimatedReplyValue')}
                      </dd>
                    </div>
                    <div className="rounded-xl border-0 bg-background p-4">
                      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Fingerprint className="size-3.5" />
                        {t('support.serviceEntity')}
                      </dt>
                      <dd className="mt-2 font-semibold leading-snug text-foreground">
                        {t('support.serviceEntityValue')}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Reveal>
          </motion.div>
        </section>

        <section className="px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            {supportItems.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.08} y={18}>
                <motion.div whileHover={reduce ? undefined : { y: -3 }} transition={{ duration: 0.25 }}>
                  <Card className="h-full rounded-lg border-0 bg-muted/30 shadow-none ring-0 transition-colors duration-300 hover:bg-muted/50 dark:ring-0">
                    <CardContent className="p-5 lg:p-6">
                      <Float
                        delay={i * 0.2}
                        className="mb-4 flex size-10 items-center justify-center rounded-lg bg-background/70"
                      >
                        <Icon className="size-5 text-primary" />
                      </Float>
                      <h2 className="text-base font-bold text-foreground">{title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-10 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {t('support.faqTitlePrefix')}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {' '}
                  {t('support.faqTitleSuffix')}
                </span>
              </h2>
            </Reveal>
            <div className="grid gap-4 lg:grid-cols-3">
              {faqs.map((item, i) => (
                <Reveal key={item.q} delay={i * 0.08} y={16}>
                  <Card className="h-full rounded-lg border-0 bg-muted/30 shadow-none ring-0 transition-colors duration-300 hover:bg-muted/50 dark:ring-0">
                    <CardContent className="p-5 lg:p-6">
                      <h3 className="text-base font-bold text-foreground">{item.q}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
