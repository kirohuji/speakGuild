import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Layers,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'

type ReadingConfig = Record<string, any>

type Props = {
  value: ReadingConfig
  context?: {
    title?: string
    promptEn?: string
    promptZh?: string
    difficulty?: string
    suggestedDurationSec?: number
    vocabulary?: string[]
    chunks?: string[]
    sentencePatterns?: string[]
  }
}

export function ReadingLearnerPhonePreview({ value, context }: Props) {
  const [phase, setPhase] = useState<'prepare' | 'answer'>('prepare')
  return (
    <aside className="sticky top-4 min-w-0">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2"><Eye className="size-4 text-primary" /><p className="text-sm font-semibold">考生视图</p></div>
        <Badge variant="secondary" className="text-[10px]">本地交互预览</Badge>
      </div>
      <div className="mx-auto w-full max-w-[390px] rounded-[2.7rem] bg-zinc-950 p-2 shadow-[0_18px_45px_-20px_rgba(0,0,0,0.65)] ring-1 ring-black/20 dark:ring-white/15">
        <div className="relative h-[min(46rem,calc(100vh-9rem))] min-h-[34rem] overflow-hidden rounded-[2.15rem] bg-[#fffefb] dark:bg-background">
          <div className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-zinc-950" aria-hidden="true" />
          {phase === 'prepare'
            ? <ReadingPreparePreview value={value} context={context} onStart={() => setPhase('answer')} />
            : <ReadingAnswerPreview value={value} context={context} onClose={() => setPhase('prepare')} />}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">iPhone 视口 · 输入仅在此预览中保留，不会保存或调用 AI</p>
    </aside>
  )
}

function ReadingPreparePreview({ value, context, onStart }: Props & { onStart: () => void }) {
  const questions: any[] = value.questions ?? []
  const vocabularies = context?.vocabulary ?? []
  const chunks = context?.chunks ?? []
  const patterns = context?.sentencePatterns ?? []
  const supportCount = vocabularies.length + chunks.length + patterns.length
  const durationMinutes = Math.max(1, Math.round((context?.suggestedDurationSec ?? 900) / 60))
  const defaultTab = vocabularies.length > 0 ? 'vocab' : chunks.length > 0 ? 'chunk' : 'pattern'

  return (
    <div className="flex h-full flex-col pt-10">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-3">
        <header className="mb-4 flex min-h-10 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><ArrowLeft className="size-4 text-muted-foreground" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">阅读练习</p>
            <h1 className="truncate text-lg font-semibold tracking-tight">{context?.title || '未命名阅读题'}</h1>
          </div>
          <Badge variant="secondary">{context?.difficulty ?? '—'}</Badge>
        </header>

        <main className="space-y-5">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-semibold">阅读准备</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">先过一遍本课知识点，再开始作答</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[11px]">{supportCount} 项支持</Badge>
            </div>
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-muted/70 p-1">
                <TabsTrigger value="vocab" className="rounded-md text-xs">词汇 ({vocabularies.length})</TabsTrigger>
                <TabsTrigger value="chunk" className="rounded-md text-xs">语块 ({chunks.length})</TabsTrigger>
                <TabsTrigger value="pattern" className="rounded-md text-xs">句式 ({patterns.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="vocab" className="mt-3"><KnowledgeList icon={<Search className="size-4" />} items={vocabularies.map((item) => ({ title: item }))} tone="cyan" emptyText="暂无绑定词汇" /></TabsContent>
              <TabsContent value="chunk" className="mt-3"><KnowledgeList icon={<Layers className="size-4" />} items={chunks.map((item) => ({ title: item }))} tone="emerald" emptyText="暂无绑定语块" /></TabsContent>
              <TabsContent value="pattern" className="mt-3"><KnowledgeList icon={<Target className="size-4" />} items={patterns.map((item) => ({ title: item }))} tone="violet" emptyText="暂无绑定句式" /></TabsContent>
            </Tabs>
          </section>

          <section className="rounded-lg bg-accent/[0.06] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">阅读练习</p>
              </div>
              <span className="text-right text-xs leading-5 text-muted-foreground">
                {durationMinutes} 分钟 · {questions.length} 题{value.wordCount ? ` · 约 ${value.wordCount} 词` : ''}
              </span>
            </div>
            {context?.promptEn?.trim() && <p className="text-lg font-semibold leading-7 text-foreground">{context.promptEn}</p>}
            {context?.promptZh?.trim() && <p className="mt-2 text-sm leading-6 text-muted-foreground">{context.promptZh}</p>}
            {!(context?.promptEn?.trim() || context?.promptZh?.trim()) && (
              <p className="text-sm leading-6 text-muted-foreground">阅读材料并完成理解题。</p>
            )}
            <Button size="lg" className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" onClick={onStart}>
              开始练习<ChevronRight className="size-4" />
            </Button>
          </section>
        </main>
      </div>
    </div>
  )
}

function KnowledgeList({ icon, items, tone, emptyText }: { icon: React.ReactNode; items: Array<{ title: string }>; tone: 'cyan' | 'emerald' | 'violet'; emptyText: string }) {
  const toneClass = { cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' }[tone]
  if (items.length === 0) return <p className="rounded-lg bg-muted/25 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  return (
    <div className="flex flex-col gap-2">
      {items.slice(0, 6).map((item) => (
        <Card key={item.title} className="border-0 bg-muted/30 shadow-none">
          <CardContent className="flex items-center gap-3 p-3">
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', toneClass)}>{icon}</span>
            <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
          </CardContent>
        </Card>
      ))}
      {items.length > 6 && <p className="text-center text-[11px] text-muted-foreground">… 共 {items.length} 项 …</p>}
    </div>
  )
}

function ReadingAnswerPreview({ value, context, onClose }: Props & { onClose: () => void }) {
  const questions: any[] = value.questions ?? []
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setCurrentQuestion((current) => (questions.length === 0 ? 0 : Math.min(current, questions.length - 1)))
  }, [questions.length])

  const answeredCount = questions.filter((_: any, index: number) => String(answers[String(index)] ?? '').trim()).length
  const question = questions[currentQuestion]

  return (
    <div className="relative flex h-full flex-col pt-10">
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-4 pb-2.5 pt-3">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">阅读练习</Badge>
              <span className="truncate text-[11px] text-muted-foreground">{context?.difficulty ?? '—'}</span>
            </div>
            <h1 className="truncate text-base font-bold leading-snug">{context?.title || '未命名阅读题'}</h1>
            <p className="truncate text-[11px] text-muted-foreground">阅读练习</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground" aria-label="退出作答">
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      {submitted ? (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
          <div className="rounded-xl bg-emerald-500/10 p-4 text-center text-sm text-emerald-700 dark:text-emerald-400">
            预览已提交；真实学习端将在这里显示 AI 反馈。
          </div>
          <Button variant="outline" className="mt-4 w-full" onClick={onClose}>返回准备页</Button>
        </main>
      ) : (
        <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(11rem,42%)]">
          <section className="min-h-0 overflow-y-auto overscroll-contain" aria-label="阅读材料">
            <article className="mx-auto w-full px-5 pb-6 pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Passage</p>
                <Button variant="ghost" size="sm" className="-mr-2 h-7 text-xs"><BookOpen className="size-3.5" />指南</Button>
              </div>
              {value.questionMarkdown?.trim()
                ? <MarkdownRenderer content={String(value.questionMarkdown)} className="text-[16px] leading-8 prose-p:my-4 prose-p:leading-8 prose-img:my-5 prose-img:w-full" />
                : <p className="text-sm text-muted-foreground">阅读材料会显示在这里</p>}
            </article>
          </section>

          <section className="flex min-h-0 flex-col border-t border-border/70 bg-background shadow-[0_-8px_20px_rgba(0,0,0,0.04)]" aria-label="理解题">
            <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2">
              <p className="shrink-0 text-[11px] font-medium text-muted-foreground">题目</p>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                {questions.map((_: any, index: number) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentQuestion(index)}
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                      currentQuestion === index ? 'border-primary bg-primary text-primary-foreground' : answers[String(index)] ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{answeredCount}/{questions.length}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-8 px-2.5" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((index) => Math.max(0, index - 1))}>
                  <ChevronLeft className="size-4" />上一题
                </Button>
                {currentQuestion < questions.length - 1 ? (
                  <Button size="sm" className="h-8 px-3" onClick={() => setCurrentQuestion((index) => Math.min(questions.length - 1, index + 1))}>
                    下一题<ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button size="sm" className="h-8 px-3" onClick={() => setSubmitted(true)} disabled={answeredCount < questions.length || questions.length === 0}>
                    <Sparkles className="size-4" />提交
                  </Button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="px-4 py-3">
                {question ? (
                  <ReadingQuestionPreview
                    index={currentQuestion}
                    question={question}
                    value={answers[String(currentQuestion)] ?? ''}
                    onChange={(next) => setAnswers((current) => ({ ...current, [String(currentQuestion)]: next }))}
                  />
                ) : (
                  <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">还没有理解题</p>
                )}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}

function ReadingQuestionPreview({ index, question, value, onChange }: { index: number; question: any; value: string; onChange: (value: string) => void }) {
  const options = question.type === 'boolean' ? ['正确', '错误'] : (question.options ?? [])
  return (
    <div className="rounded-xl bg-muted/30 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span>
        <p className="pt-0.5 text-sm font-semibold leading-6">{question.prompt || '题干会显示在这里'}</p>
      </div>
      {['choice', 'boolean'].includes(question.type) ? (
        <div className="space-y-2">
          {options.map((option: string, optionIndex: number) => (
            <button
              key={`${option}-${optionIndex}`}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                value === option ? 'border-primary bg-primary/10 text-foreground' : 'border-border/70 bg-background',
              )}
            >
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', value === option ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')}>
                {question.type === 'boolean' ? (optionIndex === 0 ? '✓' : '×') : String.fromCharCode(65 + optionIndex)}
              </span>
              <span>{option || `选项 ${String.fromCharCode(65 + optionIndex)}`}</span>
            </button>
          ))}
        </div>
      ) : (
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28 resize-y bg-background" placeholder="根据阅读材料作答…" />
      )}
    </div>
  )
}
