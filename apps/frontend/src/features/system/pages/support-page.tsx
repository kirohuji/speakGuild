import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  HelpCircle,
  Mail,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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

export function SupportPage() {
  return (
    <div className="min-h-screen bg-[#f7f4ef] text-[#17211d]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/marketing" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm">
            <img src="/logo.png" alt="漫语町" className="size-7 object-contain" />
          </span>
          <span className="text-sm font-semibold tracking-wide">漫语町 ManYu</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[#5d6a64]">
          <Link to="/system/privacy" className="transition-colors hover:text-[#17211d]">隐私政策</Link>
          <Link to="/system/terms" className="transition-colors hover:text-[#17211d]">服务条款</Link>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:pb-20 sm:pt-16">
          <div className="pointer-events-none absolute inset-x-0 top-12 mx-auto h-64 max-w-4xl rounded-full bg-[#ff8d70]/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.86fr] lg:items-end">
            <div>
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-[#d65f4b]">Support URL</p>
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                漫语町支持中心
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#5d6a64] sm:text-lg">
                遇到账号、学习、会员、下载或隐私相关问题时，可以在这里找到帮助入口。我们会认真阅读每一条反馈，并在工作时间内尽快回复。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 rounded-full bg-[#17211d] px-6 text-white hover:bg-[#26352f]">
                  <a href="mailto:z1309014381@gmail.com">
                    <Mail className="size-4" />
                    邮件联系支持
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-full border-[#17211d]/20 bg-white/70 px-6">
                  <Link to="/feedback">
                    App 内反馈
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#17211d]/10 bg-white p-6 shadow-[0_24px_80px_rgba(23,33,29,0.12)]">
              <div className="flex items-center gap-4 border-b border-[#17211d]/10 pb-5">
                <div className="grid size-12 place-items-center rounded-2xl bg-[#e9f5ef]">
                  <HelpCircle className="size-6 text-[#2d7f5e]" />
                </div>
                <div>
                  <p className="text-sm font-bold">官方支持邮箱</p>
                  <a href="mailto:z1309014381@gmail.com" className="text-sm text-[#d65f4b]">
                    z1309014381@gmail.com
                  </a>
                </div>
              </div>
              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-5">
                  <dt className="text-[#6f7b75]">工作时间</dt>
                  <dd className="text-right font-medium">周一至周五 9:00 - 21:00</dd>
                </div>
                <div className="flex justify-between gap-5">
                  <dt className="text-[#6f7b75]">预计回复</dt>
                  <dd className="text-right font-medium">3 个工作日内</dd>
                </div>
                <div className="flex justify-between gap-5">
                  <dt className="text-[#6f7b75]">公司名称</dt>
                  <dd className="text-right font-medium">上海影与达科技有限公司</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-16 md:grid-cols-3">
          {supportItems.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-[1.5rem] border border-[#17211d]/10 bg-white/80 p-6">
              <Icon className="mb-5 size-6 text-[#d65f4b]" />
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#5d6a64]">{body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-[2rem] bg-[#17211d] p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffb199]">FAQ</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">常见问题</h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {faqs.map((item) => (
                <article key={item.q} className="rounded-2xl bg-white/8 p-5">
                  <h3 className="text-base font-bold">{item.q}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/72">{item.a}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
