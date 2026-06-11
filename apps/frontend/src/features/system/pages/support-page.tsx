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

const supportItems = [
  {
    icon: MessageSquareText,
    title: '使用问题',
    body: '账号登录、会员权益、学习包下载、离线练习、AI 纠错结果等使用问题，都可以通过邮件或 App 内反馈提交。',
  },
  {
    icon: ShieldCheck,
    title: '隐私与安全',
    body: '你可以查看隐私政策、权限说明、个人信息收集清单和第三方 SDK 目录，了解数据如何被使用和保护。',
  },
  {
    icon: Clock,
    title: '响应时间',
    body: '我们通常会在 3 个工作日内回复。涉及订单、会员或账号安全的问题会优先处理。',
  },
]

const faqs = [
  {
    q: '学习包下载失败怎么办？',
    a: '请先确认网络连接稳定，并在 WiFi 环境下重试。如果仍然失败，请在邮件中附上设备型号、系统版本、失败时间和页面截图。',
  },
  {
    q: 'AI 纠错结果不准确怎么办？',
    a: '你可以重新录音，或通过 App 内反馈提交原句、转写文本和纠错结果。我们会持续优化识别和反馈质量。',
  },
  {
    q: '会员权益没有生效怎么办？',
    a: '请确认 App Store 或应用商店订单已完成支付，并尝试重新打开 App。仍未恢复时，请邮件附上订单截图。',
  },
]

function SupportHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/marketing" className="flex items-center gap-2">
          <img src="/logo.png" alt="漫语町" className="h-7 w-auto dark:invert" />
          <span className="hidden text-sm font-extrabold tracking-tight text-foreground sm:inline">漫语町</span>
        </Link>
        <nav className="flex items-center gap-5 text-xs text-muted-foreground sm:text-sm">
          <Link to="/marketing" className="transition-colors hover:text-foreground">产品介绍</Link>
          <Link to="/system/privacy" className="transition-colors hover:text-foreground">隐私政策</Link>
          <Link to="/system/terms" className="transition-colors hover:text-foreground">服务条款</Link>
        </nav>
      </div>
    </header>
  )
}

export function SupportPage() {
  const { pathname } = useLocation()
  const showStandaloneHeader = pathname === '/support'

  return (
    <div className={`relative min-h-screen overflow-x-hidden text-foreground ${showStandaloneHeader ? 'app-surface' : 'bg-transparent'}`}>
      {showStandaloneHeader && <SupportHeader />}

      <main>
        <section className="px-0 pb-12 pt-6 sm:pb-16 sm:pt-10 lg:pb-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.86fr] lg:items-end">
            <div>
              <Badge variant="secondary" className="mb-6 text-[11px] font-medium uppercase tracking-wide">
                Support URL
              </Badge>
              <h1 className="max-w-3xl text-[2.5rem] font-extrabold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                漫语町支持中心
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                遇到账号、学习、会员、下载或隐私相关问题时，可以在这里找到帮助入口。我们会认真阅读每一条反馈，并在工作时间内尽快回复。
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="primary-lg" className="shadow-[0_4px_24px_rgba(0,46,95,0.16)]">
                  <a href="mailto:z1309014381@gmail.com">
                    <Mail className="size-4" />
                    邮件联系支持
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/feedback">
                    App 内反馈
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
                        工作日处理中
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">官方支持邮箱</p>
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
                      发送邮件
                    </a>
                  </Button>
                </div>
                <dl className="grid gap-3 p-4 text-sm sm:grid-cols-3 lg:grid-cols-1 lg:p-5 xl:grid-cols-3">
                  <div className="rounded-xl border border-border/55 bg-muted/25 p-4">
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Clock className="size-3.5" />
                      工作时间
                    </dt>
                    <dd className="mt-2 font-semibold leading-snug text-foreground">周一至周五<br />9:00 - 21:00</dd>
                  </div>
                  <div className="rounded-xl border border-border/55 bg-muted/25 p-4">
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <HelpCircle className="size-3.5" />
                      预计回复
                    </dt>
                    <dd className="mt-2 font-semibold leading-snug text-foreground">3 个工作日内</dd>
                  </div>
                  <div className="rounded-xl border border-border/55 bg-muted/25 p-4">
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <ShieldCheck className="size-3.5" />
                      服务主体
                    </dt>
                    <dd className="mt-2 font-semibold leading-snug text-foreground">上海影与达科技有限公司</dd>
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
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">FAQ</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                常见
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> 问题</span>
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
                    <img src="/logo.png" alt="漫语町" className="size-8 dark:invert" />
                    <span className="font-extrabold text-foreground">漫语町</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">沉浸式英语输出训练 App</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
                  <Link to="/system/terms" className="transition-colors hover:text-foreground">服务条款</Link>
                  <Link to="/system/privacy" className="transition-colors hover:text-foreground">隐私政策</Link>
                  <Link to="/marketing" className="transition-colors hover:text-foreground">产品介绍</Link>
                </div>
              </div>
              <Separator className="my-6" />
              <p className="text-center text-[11px] text-muted-foreground/50">
                &copy; {new Date().getFullYear()} 漫语町 ManYu. All rights reserved.
              </p>
            </div>
          </footer>
        )}
      </main>
    </div>
  )
}
