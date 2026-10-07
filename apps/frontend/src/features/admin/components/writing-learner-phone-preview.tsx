import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilePenLine,
  Languages,
  Lightbulb,
  ListMusic,
  MessageCircle,
  Save,
  Sparkles,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { withoutWritingRequirements, WritingTaskCard } from '@/features/learning/components/writing-task-card'
import { cn } from '@/lib/cn'

type WritingConfig = Record<string, any>
type DialogueTurn = { aText: string; hint: string }
type TranslationSegment = { id: string; source: string; hint?: string }

type Props = {
  value: WritingConfig
  context?: { title?: string; promptEn?: string; promptZh?: string; difficulty?: string; suggestedDurationSec?: number }
  isDialogue: boolean
  isTranslation: boolean
  turns: DialogueTurn[]
}

export function WritingLearnerPhonePreview({ value, context, isDialogue, isTranslation, turns }: Props) {
  const [normalPhase, setNormalPhase] = useState<'task' | 'write'>('task')
  return (
    <aside className="sticky top-4 min-w-0">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2"><Eye className="size-4 text-primary" /><p className="text-sm font-semibold">考生视图</p></div>
        <Badge variant="secondary" className="text-[10px]">本地交互预览</Badge>
      </div>
      <div className="mx-auto w-full max-w-[390px] rounded-[2.7rem] bg-zinc-950 p-2 shadow-[0_18px_45px_-20px_rgba(0,0,0,0.65)] ring-1 ring-black/20 dark:ring-white/15">
        <div className="relative h-[min(46rem,calc(100vh-9rem))] min-h-[34rem] overflow-hidden rounded-[2.15rem] bg-[#fffefb] dark:bg-background">
          <div className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-zinc-950" aria-hidden="true" />
          {isTranslation ? (
            <TranslationMobilePreview value={value} context={context} />
          ) : isDialogue ? (
            <DialogueMobilePreview value={value} context={context} turns={turns} />
          ) : normalPhase === 'write' ? (
            <WritingMobilePreview value={value} context={context} onClose={() => setNormalPhase('task')} />
          ) : (
            <div className="flex h-full flex-col pt-10">
              <div className="border-b border-border/60 px-5 pb-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Writing practice</p>
                <h3 className="mt-1 text-base font-semibold leading-6">{context?.title || '未命名写作题'}</h3>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <WritingTaskCard
                  questionMarkdown={value.questionMarkdown}
                  promptEn={context?.promptEn}
                  promptZh={context?.promptZh}
                  requirements={value.requirements}
                  genre={value.genre}
                  minWords={value.minWords}
                  maxWords={value.maxWords}
                  durationMinutes={Math.max(1, Math.round((context?.suggestedDurationSec ?? 900) / 60))}
                  onStart={() => setNormalPhase('write')}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">iPhone 视口 · 输入仅在此预览中保留，不会保存或调用 AI</p>
    </aside>
  )
}

function WritingMobilePreview({ value, context, onClose }: Pick<Props, 'value' | 'context'> & { onClose: () => void }) {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  return (
    <div className="relative flex h-full flex-col pt-10">
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FilePenLine className="size-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2"><Badge variant="secondary">写作练习</Badge><span className="truncate text-xs text-muted-foreground">{context?.difficulty ?? '—'}</span></div>
            <h1 className="break-words text-xl font-bold leading-tight text-foreground">{context?.title || '未命名写作题'}</h1>
            <p className="mt-1.5 truncate text-sm text-muted-foreground">写作练习</p>
          </div>
          <div className="flex shrink-0 items-center gap-1"><Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setTaskOpen(true)} aria-label="写作题目"><FilePenLine className="size-4" /></Button><Button type="button" variant="ghost" size="icon" className="size-8" aria-label="指南"><BookOpen className="size-4" /></Button><button type="button" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground" aria-label="返回题目"><X className="size-4" /></button></div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 pb-8 pt-5">
          <div className="flex min-h-[55dvh] flex-1 flex-col pt-5">
            <textarea
              value={text}
              onChange={(event) => { setText(event.target.value); setSaved(false) }}
              className="m-0 min-h-[52dvh] w-full flex-1 resize-none appearance-none rounded-none border-0 bg-transparent p-0 text-[17px] leading-8 text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground/45 focus:border-0 focus:outline-none focus:ring-0"
              placeholder="开始写作…"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck
            />
            {saved && <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">草稿已在本地预览中保存</p>}
          </div>
        </div>
      </div>
      <footer className="shrink-0 rounded-b-[2.15rem] border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{({ message: '消息', journal: '日记', email: '邮件', paragraph: '短段落', essay: '议论文', dialogue: '对话', translation: '中英互译' } as Record<string, string>)[value.genre ?? ''] || value.genre || '自由写作'}</p>
            <p className={cn('mt-0.5 text-xs tabular-nums text-muted-foreground', value.minWords && wordCount < value.minWords && 'text-amber-600')}>{wordCount} 词{value.minWords ? ` · 目标 ${value.minWords}–${value.maxWords ?? '∞'}` : ''}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSaved(true)} disabled={!text.trim()} className="shrink-0 gap-1.5"><Save className="size-4" />保存</Button>
          <Button size="sm" disabled={!text.trim()} onClick={() => setSaved(true)} className="shrink-0 gap-1.5 rounded-full px-4"><Sparkles className="size-4" />提交反馈</Button>
        </div>
      </footer>
      {taskOpen && <div className="absolute inset-0 z-20 flex flex-col bg-background pt-10"><div className="flex items-center justify-between border-b border-border/60 px-5 py-3"><p className="text-base font-semibold">写作题目</p><button type="button" onClick={() => setTaskOpen(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-label="关闭题目"><X className="size-4" /></button></div><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5"><MarkdownRenderer content={withoutWritingRequirements(value.questionMarkdown)} className="text-[15px] leading-7 prose-headings:mb-3 prose-headings:mt-5 prose-headings:text-foreground prose-p:my-3 prose-p:leading-7 prose-li:my-1 prose-img:my-4 prose-img:w-full prose-img:object-contain" />{Array.isArray(value.requirements) && value.requirements.length > 0 && <section className="mt-6 border-t border-border/60 pt-5"><h2 className="text-base font-semibold">写作要求</h2><div className="mt-3 space-y-2">{value.requirements.map((item: string, index: number) => <div key={`${item}-${index}`} className="rounded-lg bg-muted/30 px-3 py-2.5"><p className="text-[11px] text-muted-foreground">要求 {index + 1}</p><p className="mt-0.5 text-sm font-medium leading-5">{item}</p></div>)}</div></section>}</div></div>}
    </div>
  )
}

function TranslationMobilePreview({ value, context }: Pick<Props, 'value' | 'context'>) {
  const direction = value.direction === 'en_to_zh' ? 'en_to_zh' : 'zh_to_en'
  const scope = value.scope === 'article' ? 'article' : 'sentence'
  const segments: TranslationSegment[] = useMemo(() => {
    const configured = Array.isArray(value.segments) ? value.segments : []
    if (configured.length) {
      return configured.map((segment: any, index: number) => ({
        id: String(segment.id || `s${index + 1}`),
        source: String(segment.source ?? ''),
        hint: String(segment.hint ?? ''),
      }))
    }
    const source = String(value.sourceText ?? '').trim()
    return source ? [{ id: 's1', source, hint: '' }] : []
  }, [value.segments, value.sourceText])

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [hintOpen, setHintOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setActiveIndex((current) => (segments.length === 0 ? 0 : Math.min(current, segments.length - 1)))
  }, [segments.length])

  const answeredCount = segments.filter((segment) => (answers[segment.id] ?? '').trim()).length
  const active = segments[activeIndex]
  const sourceLanguage = direction === 'zh_to_en' ? '中文原文' : 'English source'
  const answerLanguage = direction === 'zh_to_en' ? 'Write in English' : '用中文翻译'
  const unitLabel = scope === 'article' ? '段' : '句'

  const selectSegment = (index: number) => {
    setActiveIndex(index)
    setHintOpen(false)
    setListOpen(false)
  }

  const resetPreview = () => {
    setAnswers({})
    setActiveIndex(0)
    setHintOpen(false)
    setListOpen(false)
    setSubmitted(false)
  }

  return (
    <div className="relative flex h-full flex-col pt-10">
      <header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-4 pb-2.5 pt-3">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Languages className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{direction === 'zh_to_en' ? '中译英' : '英译中'}</Badge>
              <span className="truncate text-[11px] text-muted-foreground">{context?.difficulty ?? '—'}</span>
            </div>
            <h1 className="truncate text-base font-bold leading-snug text-foreground">{value.sourceTitle || context?.title || '未命名翻译题'}</h1>
            <p className="truncate text-[11px] text-muted-foreground">写作练习</p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-7" title="教学指引" aria-label="教学指引"><BookOpen className="size-4" /></Button>
            <button type="button" onClick={resetPreview} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground" aria-label="重置预览"><X className="size-3.5" /></button>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(20rem,55%)]">
        <section className="min-h-0 overflow-y-auto overscroll-contain" aria-label={sourceLanguage}>
          <article className="mx-auto flex min-h-full w-full flex-col justify-center px-5 py-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{sourceLanguage}</p>
            <p className="text-[16px] leading-8 text-foreground">{active?.source || '暂无原文内容'}</p>
          </article>
        </section>

        <section className="flex min-h-0 flex-col border-t border-border/70 bg-background shadow-[0_-8px_20px_rgba(0,0,0,0.04)]" aria-label={answerLanguage}>
          <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2">
            <Button variant="outline" size="sm" className="h-8 px-2.5" disabled={activeIndex === 0 || segments.length === 0} onClick={() => selectSegment(activeIndex - 1)}>
              <ChevronLeft className="size-4" />上一{unitLabel}
            </Button>
            <span className="min-w-0 flex-1 truncate text-center text-xs tabular-nums text-muted-foreground">{answeredCount}/{segments.length} 已完成</span>
            <div className="flex shrink-0 items-center gap-1.5">
              {activeIndex < segments.length - 1 ? (
                <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => selectSegment(activeIndex + 1)}>
                  下一{unitLabel}<ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-8 px-3"
                  disabled={answeredCount !== segments.length || !segments.length}
                  onClick={() => setSubmitted(true)}
                >
                  <Sparkles className="size-4" />提交
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setListOpen(true)} title={scope === 'article' ? '段落列表' : '句子列表'}>
                <ListMusic className="size-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{answerLanguage}</p>
                <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 gap-1 px-2 text-primary" disabled={!active?.hint} onClick={() => setHintOpen(true)}><Lightbulb className="size-3.5" />提示</Button>
              </div>
              <textarea
                value={active ? answers[active.id] ?? '' : ''}
                onChange={(event) => {
                  if (!active) return
                  setAnswers((current) => ({ ...current, [active.id]: event.target.value }))
                  setSubmitted(false)
                }}
                className="min-h-[132px] w-full resize-y bg-transparent p-0 text-[16px] leading-8 text-foreground outline-none placeholder:text-muted-foreground/45 focus:ring-0"
                placeholder={direction === 'zh_to_en' ? 'Write your English translation here…' : '在这里写下中文译文…'}
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck={direction === 'zh_to_en'}
              />
              {submitted && (
                <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-700 dark:text-emerald-400">
                  预览已提交；真实学习端将在这里显示 AI 反馈。
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      {hintOpen && active?.hint && (
        <div className="absolute inset-0 z-20 flex flex-col bg-background pt-10">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <p className="text-base font-semibold">提示</p>
            <button type="button" onClick={() => setHintOpen(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-label="关闭提示"><X className="size-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm leading-7 text-muted-foreground">{active.hint}</div>
        </div>
      )}

      {listOpen && (
        <div className="absolute inset-0 z-20 flex flex-col bg-background pt-10">
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-lg font-semibold">{scope === 'article' ? '段落列表' : '句子列表'}</p>
            <button type="button" onClick={() => setListOpen(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ChevronDown className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            <div className="space-y-1">
              {segments.map((segment, index) => (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => selectSegment(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                    activeIndex === index ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                  )}
                >
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', activeIndex === index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{index + 1}</span>
                  <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-5">{segment.source || '（原文）'}</p>
                  {(answers[segment.id] ?? '').trim() ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : null}
                </button>
              ))}
              {segments.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">还没有原文段落</p>}
            </div>
          </div>
        </div>
      )}
    </div>
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
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="size-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2"><Badge variant="secondary">对话写作</Badge><span className="truncate text-xs text-muted-foreground">{context?.difficulty ?? '—'}</span></div>
            <h1 className="break-words text-xl font-bold leading-tight text-foreground">{context?.title || '未命名写作题'}</h1>
            <p className="mt-1.5 truncate text-sm text-muted-foreground">写作练习</p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-8" title="教学指引"><BookOpen className="size-4" /></Button>
            <button type="button" onClick={resetPreview} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground" aria-label="重置预览"><X className="size-4" /></button>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 pb-8 pt-5">
          {value.situation && <div className="mb-5 rounded-lg bg-sky-50/60 px-3 py-2 text-sm leading-relaxed dark:bg-sky-950/20"><span className="font-medium text-sky-600 dark:text-sky-400">📍 </span>{value.situation}</div>}
          {currentTurn && (
            <div className="flex-1 py-5">
              <div className="flex items-start gap-2.5">
                <span className="mt-1 shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">A</span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted/50 px-4 py-3 text-[15px] leading-relaxed">{currentTurn.aText || 'A 的台词会显示在这里'}</div>
              </div>
              <div className="ml-9 mt-2">
                {showHint ? (
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">💡 写作提示</p>
                      <button type="button" onClick={() => setShowHint(false)} className="text-xs text-amber-500 hover:text-amber-700">收起</button>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-amber-800 dark:text-amber-300">{currentTurn.hint || '提示会显示在这里'}</p>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowHint(true)} className="flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-50/60 px-3 py-1.5 text-xs text-amber-700 transition-colors hover:bg-amber-100/60 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-400">
                    <Sparkles className="size-3" />查看提示
                  </button>
                )}
              </div>
              <div className="ml-9 mt-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">B</span>
                  <div className="flex-1">
                    <textarea
                      value={responses[currentIndex] ?? ''}
                      onChange={(event) => { setResponses({ ...responses, [currentIndex]: event.target.value }); setSubmitted(false) }}
                      className="min-h-[140px] w-full resize-none rounded-2xl rounded-tl-md border-0 bg-muted/40 p-4 text-[16px] leading-7 text-foreground outline-none ring-0 placeholder:text-muted-foreground/45 focus:bg-background focus:ring-2 focus:ring-primary/20"
                      placeholder="用英语写下 B 的回复…"
                      autoCapitalize="sentences"
                      autoCorrect="on"
                      spellCheck
                    />
                    {responses[currentIndex]?.trim() && <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">{responses[currentIndex].trim().split(/\s+/).length} 词</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
          {turns.length > 1 && (
            <div className="mt-4 border-t border-border/50 pt-4">
              <div className="flex items-center justify-center gap-2">
                {turns.map((_, index) => {
                  const answered = responses[index]?.trim()
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectTurn(index)}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                        index === currentIndex && 'bg-primary text-primary-foreground shadow-sm',
                        index !== currentIndex && answered && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
                        index !== currentIndex && !answered && 'bg-muted text-muted-foreground hover:bg-muted/70',
                      )}
                    >
                      {index + 1}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">{answeredCount}/{turns.length} 轮已填写</p>
            </div>
          )}
          {submitted && <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-700 dark:text-emerald-400">预览已提交；真实学习端将在这里显示 AI 反馈。</p>}
        </div>
      </div>
      <footer className="shrink-0 rounded-b-[2.15rem] border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <Button size="lg" disabled={!allAnswered} onClick={() => setSubmitted(true)} className="w-full gap-1.5 rounded-full"><Sparkles className="size-4" />提交反馈</Button>
      </footer>
    </div>
  )
}
