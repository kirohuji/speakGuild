import { useState, type ReactNode } from 'react'
import { BookOpen, Eye, MessageCircle, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WritingTaskCard } from '@/features/learning/components/writing-task-card'
import { cn } from '@/lib/cn'

type WritingConfig = Record<string, any>
type DialogueTurn = { aText: string; hint: string }

type Props = {
  value: WritingConfig
  context?: { title?: string; promptEn?: string; promptZh?: string; difficulty?: string; suggestedDurationSec?: number }
  isDialogue: boolean
  isTranslation: boolean
  turns: DialogueTurn[]
  translationPreview?: ReactNode
}

export function WritingLearnerPhonePreview({ value, context, isDialogue, isTranslation, turns, translationPreview }: Props) {
  return (
    <aside className="sticky top-4 min-w-0">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2"><Eye className="size-4 text-primary" /><p className="text-sm font-semibold">考生视图</p></div>
        <Badge variant="secondary" className="text-[10px]">本地交互预览</Badge>
      </div>
      <div className="mx-auto w-full max-w-[390px] rounded-[2.7rem] bg-zinc-950 p-2 shadow-[0_18px_45px_-20px_rgba(0,0,0,0.65)] ring-1 ring-black/20 dark:ring-white/15">
        <div className="relative h-[min(46rem,calc(100vh-9rem))] min-h-[34rem] overflow-hidden rounded-[2.15rem] bg-[#fffefb] dark:bg-background">
          <div className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-zinc-950" aria-hidden="true" />
          {isDialogue ? <DialogueMobilePreview value={value} context={context} turns={turns} /> : <div className="flex h-full flex-col pt-10">
            <div className="border-b border-border/60 px-5 pb-3"><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Writing practice</p><h3 className="mt-1 text-base font-semibold leading-6">{context?.title || '未命名写作题'}</h3></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{isTranslation ? translationPreview : <WritingTaskCard questionMarkdown={value.questionMarkdown} promptEn={context?.promptEn} promptZh={context?.promptZh} genre={value.genre} minWords={value.minWords} maxWords={value.maxWords} durationMinutes={Math.max(1, Math.round((context?.suggestedDurationSec ?? 900) / 60))} onStart={() => undefined} />}</div>
          </div>}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">iPhone 视口 · 输入仅在此预览中保留，不会保存或调用 AI</p>
    </aside>
  )
}

function DialogueMobilePreview({ value, context, turns }: Pick<Props, 'value' | 'context' | 'turns'>) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<Record<number, string>>({})
  const [showHint, setShowHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const currentTurn = turns[currentIndex]
  const answeredCount = turns.filter((_, index) => responses[index]?.trim()).length
  const allAnswered = turns.length > 0 && answeredCount === turns.length

  const selectTurn = (index: number) => { setCurrentIndex(index); setShowHint(false); setSubmitted(false) }
  const resetPreview = () => { setCurrentIndex(0); setResponses({}); setShowHint(false); setSubmitted(false) }

  return (
    <div className="flex h-full flex-col pt-10">
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-4">
        <div className="flex items-start gap-3"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="size-[18px]" /></span><div className="min-w-0 flex-1"><div className="mb-1.5 flex items-center gap-2"><Badge variant="secondary">对话写作</Badge><span className="truncate text-xs text-muted-foreground">{context?.difficulty ?? '—'}</span></div><h1 className="break-words text-xl font-bold leading-tight text-foreground">{context?.title || '未命名写作题'}</h1><p className="mt-1.5 truncate text-sm text-muted-foreground">写作练习</p></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" className="size-8" title="教学指引"><BookOpen className="size-4" /></Button><button type="button" onClick={resetPreview} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground" aria-label="重置预览"><X className="size-4" /></button></div></div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 pb-8 pt-5">
        {value.situation && <div className="mb-5 rounded-lg bg-sky-50/60 px-3 py-2 text-sm leading-relaxed dark:bg-sky-950/20"><span className="font-medium text-sky-600 dark:text-sky-400">📍 </span>{value.situation}</div>}
        {currentTurn && <div className="flex-1 py-5"><div className="flex items-start gap-2.5"><span className="mt-1 shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">A</span><div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted/50 px-4 py-3 text-[15px] leading-relaxed">{currentTurn.aText || 'A 的台词会显示在这里'}</div></div><div className="ml-9 mt-2">{showHint ? <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 dark:border-amber-800/30 dark:bg-amber-950/20"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-amber-700 dark:text-amber-400">💡 写作提示</p><button type="button" onClick={() => setShowHint(false)} className="text-xs text-amber-500 hover:text-amber-700">收起</button></div><p className="mt-1.5 text-sm leading-relaxed text-amber-800 dark:text-amber-300">{currentTurn.hint || '提示会显示在这里'}</p></div> : <button type="button" onClick={() => setShowHint(true)} className="flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-50/60 px-3 py-1.5 text-xs text-amber-700 transition-colors hover:bg-amber-100/60 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-400"><Sparkles className="size-3" />查看提示</button>}</div><div className="ml-9 mt-4"><div className="flex items-start gap-2.5"><span className="mt-1 shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">B</span><div className="flex-1"><textarea value={responses[currentIndex] ?? ''} onChange={(event) => { setResponses({ ...responses, [currentIndex]: event.target.value }); setSubmitted(false) }} className="min-h-[140px] w-full resize-none rounded-2xl rounded-tl-md border-0 bg-muted/40 p-4 text-[16px] leading-7 text-foreground outline-none ring-0 placeholder:text-muted-foreground/45 focus:bg-background focus:ring-2 focus:ring-primary/20" placeholder="用英语写下 B 的回复…" autoCapitalize="sentences" autoCorrect="on" spellCheck />{responses[currentIndex]?.trim() && <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">{responses[currentIndex].trim().split(/\s+/).length} 词</p>}</div></div></div></div>}
        {turns.length > 1 && <div className="mt-4 border-t border-border/50 pt-4"><div className="flex items-center justify-center gap-2">{turns.map((_, index) => { const answered = responses[index]?.trim(); return <button key={index} type="button" onClick={() => selectTurn(index)} className={cn('flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors', index === currentIndex && 'bg-primary text-primary-foreground shadow-sm', index !== currentIndex && answered && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', index !== currentIndex && !answered && 'bg-muted text-muted-foreground hover:bg-muted/70')}>{index + 1}</button> })}</div><p className="mt-2 text-center text-xs text-muted-foreground">{answeredCount}/{turns.length} 轮已填写</p></div>}
        {submitted && <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-700 dark:text-emerald-400">预览已提交；真实学习端将在这里显示 AI 反馈。</p>}
      </div></div>
      <footer className="shrink-0 rounded-b-[2.15rem] border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl"><Button size="lg" disabled={!allAnswered} onClick={() => setSubmitted(true)} className="w-full gap-1.5 rounded-full"><Sparkles className="size-4" />提交反馈</Button></footer>
    </div>
  )
}
