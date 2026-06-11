import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  MessageCircle,
  Mic2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const pillars = [
  {
    icon: BookOpen,
    title: '场景学习包',
    text: '围绕旅行、留学、生活和社交场景组织内容，把词汇、句块、话题和剧本放在同一个学习路径里。',
  },
  {
    icon: Mic2,
    title: 'AI 口语纠错',
    text: '录音后获得转写、自然度、语法和表达建议，用可复述的方式把错误变成下一次表达。',
  },
  {
    icon: MessageCircle,
    title: '互动剧本',
    text: '在角色对话和任务选择中开口练习，让英语训练更接近真实生活里的沟通压力。',
  },
]

const moments = ['机场入境', '入住公寓', '校园介绍', '咖啡聊天', '小组讨论', '购物问路']

export function MarketingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#101714] text-[#f9f2e8]">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Link to="/marketing" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#f9f2e8]">
            <img src="/logo.png" alt="漫语町" className="size-7 object-contain" />
          </span>
          <span className="text-sm font-semibold tracking-wide">漫语町 ManYu</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[#d8cab7]/72">
          <Link to="/support" className="transition-colors hover:text-[#f9f2e8]">支持</Link>
          <Link to="/system/privacy" className="hidden transition-colors hover:text-[#f9f2e8] sm:inline">隐私</Link>
        </nav>
      </header>

      <main>
        <section className="relative px-5 pb-16 pt-10 sm:pb-20 lg:pb-28">
          <div className="pointer-events-none absolute left-1/2 top-10 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[#ff7a59]/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-48 h-80 w-80 rounded-full bg-[#8bd7b5]/16 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex rounded-full border border-[#f9f2e8]/12 bg-[#f9f2e8]/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#ffb199]">
                Marketing URL
              </p>
              <h1 className="text-5xl font-black leading-[0.98] tracking-tight sm:text-7xl lg:text-8xl">
                漫语町
                <span className="mt-2 block text-[#ff8d70]">把英语说出口</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-[#d8cab7]/78 sm:text-lg">
                场景学习、句块激活、AI 纠错和互动剧本组合在一起，帮助学习者从看得懂走到说得出。适合准备旅行、留学、社交和日常沟通的英语学习者。
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 rounded-full bg-[#ff8d70] px-6 text-[#101714] hover:bg-[#ff9f86]">
                  <Link to="/">
                    打开应用
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-full border-[#f9f2e8]/18 bg-transparent px-6 text-[#f9f2e8] hover:bg-[#f9f2e8]/10 hover:text-[#f9f2e8]">
                  <Link to="/support">
                    支持中心
                    <Sparkles className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[26rem]">
              <div className="absolute -inset-8 rounded-[3rem] bg-[#f9f2e8]/8 blur-2xl" />
              <div className="relative rounded-[2.5rem] border border-[#f9f2e8]/12 bg-[#1b2520] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
                <div className="rounded-[2rem] bg-[#f9f2e8] p-5 text-[#17211d]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src="/logo.png" alt="" className="size-9 object-contain" />
                      <div>
                        <p className="text-sm font-black">机场入境</p>
                        <p className="text-xs text-[#66736d]">Scenario Pack</p>
                      </div>
                    </div>
                    <Download className="size-5 text-[#d65f4b]" />
                  </div>
                  <div className="mt-7 rounded-2xl bg-[#e8f4ee] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2d7f5e]">Today's chunk</p>
                    <p className="mt-3 text-2xl font-black tracking-tight">I'm here to check in.</p>
                    <p className="mt-2 text-sm leading-6 text-[#596761]">把可迁移表达先练熟，再进入剧情对话。</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {['语音转写完成', '发现 2 处可优化表达', '已加入表达库'].map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-2xl border border-[#17211d]/8 px-4 py-3 text-sm">
                        <CheckCircle2 className="size-4 text-[#2d7f5e]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-[1.5rem] border border-[#f9f2e8]/10 bg-[#f9f2e8]/7 p-6">
              <Icon className="mb-5 size-6 text-[#ff8d70]" />
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#d8cab7]/72">{text}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20">
          <div className="grid gap-8 rounded-[2rem] border border-[#f9f2e8]/10 bg-[#f9f2e8] p-6 text-[#17211d] lg:grid-cols-[0.8fr_1fr] lg:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d65f4b]">Practice Moments</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">把练习放进真实语境</h2>
              <p className="mt-4 text-sm leading-7 text-[#5d6a64]">
                每个学习包都围绕一个明确场景展开，内容可以离线安装，适合通勤、旅行前准备和碎片时间复习。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {moments.map((moment) => (
                <div key={moment} className="rounded-2xl bg-[#17211d] px-4 py-5 text-sm font-bold text-[#f9f2e8]">
                  {moment}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
