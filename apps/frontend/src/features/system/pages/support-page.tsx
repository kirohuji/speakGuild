import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  HelpCircle,
  Mail,
  MessageSquareText,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

function SupportHeader() {
  const { t } = useTranslation()
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/marketing" className="flex items-center gap-2">
          <img src="/logo.png" alt={t('app.name')} className="h-7 w-auto dark:invert" />
          <span className="hidden text-sm font-extrabold tracking-tight text-foreground sm:inline">{t('app.name')}</span>
        </Link>
        <nav className="flex items-center gap-5 text-xs text-muted-foreground sm:text-sm">
          <Link to="/marketing" className="transition-colors hover:text-foreground">{t('support.productIntro')}</Link>
          <Link to="/system/privacy" className="transition-colors hover:text-foreground">{t('system.privacy')}</Link>
          <Link to="/system/terms" className="transition-colors hover:text-foreground">{t('system.terms')}</Link>
        </nav>
      </div>
    </header>
  )
}

export function SupportPage() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const showStandaloneHeader = pathname === '/support'

  const supportItems = [
    {
      icon: MessageSquareText,
      title: t('support.usage'),
      body: t('support.usageBody'),
    },
    {
      icon: ShieldCheck,
      title: t('support.privacy'),
      body: t('support.privacyBody'),
    },
    {
      icon: Clock,
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
    <div className={`relative min-h-screen overflow-x-hidden text-foreground ${showStandaloneHeader ? 'app-surface' : 'bg-transparent'}`}>
      {showStandaloneHeader && <SupportHeader />}

      <main>
        <section className="px-0 pb-12 pt-6 sm:pb-16 sm:pt-10 lg:pb-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.86fr] lg:items-end">
            <div>
              <Badge variant="secondary" className="mb-6 text-[11px] font-medium uppercase tracking-wide">
                {t('support.badge')}
              </Badge>
              <h1 className="max-w-3xl text-[2.5rem] font-extrabold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t('support.title')}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t('support.subtitle')}
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="primary-lg" className="shadow-[0_4px_24px_rgba(0,46,95,0.16)]">
                  <a href="mailto:z1309014381@gmail.com">
                    <Mail className="size-4" />
                    {t('support.emailSupport')}
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/feedback">
                    {t('support.inAppFeedback')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/88">
              <CardContent className="p-0">
                <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.10] via-background/80 to-accent/[0.08] p-6 lg:p-7">
                  <div className="absolute -right-12 -top-14 size-40 rounded-full bg-primary/[0.08]" />
                  <div className="absolute -bottom-16 left-8 size-36 rounded-full bg-accent/[0.10]" />
                  <div className="relative flex items-start justify-between gap-5">
                    <div>
                      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
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
                    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-background/80 shadow-sm ring-1 ring-border/70">
                      <Mail className="size-6 text-primary" />
                    </div>
                  </div>
                  <Button asChild variant="outline-primary" size="sm" className="relative mt-6 bg-background/70">
                    <a href="mailto:z1309014381@gmail.com">
                      <Send className="size-3.5" />
                      {t('support.sendEmail')}
                    </a>
                  </Button>
                </div>
                <dl className="grid gap-3 p-4 text-sm sm:grid-cols-3 lg:grid-cols-1 lg:p-5 xl:grid-cols-3">
                  <div className="rounded-xl border border-border/55 bg-muted/25 p-4">
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Clock className="size-3.5" />
                      {t('support.workHours')}
                    </dt>
                    <dd className="mt-2 whitespace-pre-line font-semibold leading-snug text-foreground">{t('support.workHoursValue')}</dd>
                  </div>
                  <div className="rounded-xl border border-border/55 bg-muted/25 p-4">
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <HelpCircle className="size-3.5" />
                      {t('support.estimatedReply')}
                    </dt>
                    <dd className="mt-2 font-semibold leading-snug text-foreground">{t('support.estimatedReplyValue')}</dd>
                  </div>
                  <div className="rounded-xl border border-border/55 bg-muted/25 p-4">
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <ShieldCheck className="size-3.5" />
                      {t('support.serviceEntity')}
                    </dt>
                    <dd className="mt-2 font-semibold leading-snug text-foreground">{t('support.serviceEntityValue')}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 pb-12 md:grid-cols-3 lg:pb-16">
          {supportItems.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="h-full rounded-lg bg-muted/30 shadow-none transition-colors duration-300 hover:bg-muted/50 dark:ring-0">
              <CardContent className="p-5 lg:p-6">
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-background/70">
                  <Icon className="size-5 text-primary" />
                </div>
                <h2 className="text-base font-bold text-foreground">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('support.faq')}</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {t('support.faqTitlePrefix')}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> {t('support.faqTitleSuffix')}</span>
              </h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {faqs.map((item) => (
                <Card key={item.q} className="h-full rounded-lg bg-background/75 shadow-none transition-colors duration-300 hover:bg-background dark:ring-0">
                  <CardContent className="p-5 lg:p-6">
                    <h3 className="text-base font-bold text-foreground">{item.q}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {showStandaloneHeader && (
          <footer className="border-t border-border/50">
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
              <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
                <div>
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt={t('app.name')} className="size-8 dark:invert" />
                    <span className="font-extrabold text-foreground">{t('app.name')}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{t('support.tagline')}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
                  <Link to="/system/terms" className="transition-colors hover:text-foreground">{t('system.terms')}</Link>
                  <Link to="/system/privacy" className="transition-colors hover:text-foreground">{t('system.privacy')}</Link>
                  <Link to="/marketing" className="transition-colors hover:text-foreground">{t('support.productIntro')}</Link>
                </div>
              </div>
              <Separator className="my-6" />
              <p className="text-center text-[11px] text-muted-foreground/50">
                {t('support.copyright', { year: new Date().getFullYear() })}
              </p>
            </div>
          </footer>
        )}
      </main>
    </div>
  )
}
