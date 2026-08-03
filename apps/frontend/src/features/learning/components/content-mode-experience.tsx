import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactReader } from 'react-reader'
import { BookOpen, CheckCircle2, ChevronRight, FilePenLine, Headphones, Loader2, Pause, Play, Repeat2, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownContent } from '@/features/system/components/markdown-content'
import { cn } from '@/lib/cn'
import { learningApi, type ListeningTranscriptSegment, type SceneExperience, type TrainingTopicItem, type UnitDetail } from '../api/learning-api'

export function ContentModeExperience({ unit }: { unit: UnitDetail }) {
  const [experience, setExperience] = useState<SceneExperience | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<TrainingTopicItem | null>(null)

  useEffect(() => {
    if (unit.contentMode === 'practice') return
    learningApi.getSceneExperience(unit.id).then(setExperience).catch(() => setExperience(null))
  }, [unit.contentMode, unit.id])

  if (unit.contentMode === 'novel') {
    return <NovelExperience unit={unit} experience={experience} />
  }

  const icon = unit.contentMode === 'writing' ? FilePenLine : unit.contentMode === 'reading' ? BookOpen : Headphones
  const Icon = icon
  const title = unit.contentMode === 'writing' ? '写作任务' : unit.contentMode === 'reading' ? '阅读与理解' : '精听训练'

  return (
    <section className="mb-5">
      <div className="mb-3 flex items-center gap-3 px-1">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span>
        <div><h2 className="text-base font-semibold">{title}</h2><p className="text-xs text-muted-foreground">共 {unit.trainingTopics.length} 个话题，进度独立于今日任务</p></div>
      </div>
      <div className="space-y-2">
        {unit.trainingTopics.map((topic, index) => (
          <button key={topic.id} type="button" onClick={() => setSelectedTopic(topic)} className="w-full text-left">
            <Card className="border-0 bg-primary/[0.045] shadow-none transition-transform active:scale-[0.99]">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold shadow-sm">{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{topic.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{topic.promptZh || topic.promptEn}</span></span>
                {topic.latestSubmission?.status === 'reviewed' && <CheckCircle2 className="size-4 text-emerald-600" />}
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </button>
        ))}
        {unit.trainingTopics.length === 0 && <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">后台还没有添加内容话题</div>}
      </div>
      <Dialog open={Boolean(selectedTopic)} onOpenChange={(open) => { if (!open) setSelectedTopic(null) }}>
        <DialogContent className="flex max-h-[94dvh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {selectedTopic && <TopicExperienceBody topic={selectedTopic} mode={unit.contentMode as 'writing' | 'reading' | 'listening'} unitTitle={unit.title} />}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function TopicExperienceBody({ topic, mode, unitTitle }: { topic: TrainingTopicItem; mode: 'writing' | 'reading' | 'listening'; unitTitle: string }) {
  return (
    <>
      <DialogHeader className="shrink-0 border-b border-border/70 px-5 pb-4 pt-5">
        <DialogTitle>{topic.title}</DialogTitle>
        <DialogDescription>{unitTitle} · {topic.difficulty} · 约 {Math.max(1, Math.round(topic.suggestedDurationSec / 60))} 分钟</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {mode === 'writing' && <WritingExperience topic={topic} />}
        {mode === 'reading' && <ReadingExperience topic={topic} />}
        {mode === 'listening' && <ListeningExperience topic={topic} />}
      </div>
    </>
  )
}

function WritingExperience({ topic }: { topic: TrainingTopicItem }) {
  const config = topic.contentConfig?.writing ?? {}
  const [text, setText] = useState(String(topic.latestSubmission?.response?.text ?? ''))
  const [submission, setSubmission] = useState(topic.latestSubmission ?? null)
  const [saving, setSaving] = useState(false)
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const save = async (submit = false) => {
    setSaving(true)
    try {
      let next = await learningApi.saveTopicSubmission(topic.id, { response: { text }, status: submit ? 'submitted' : 'draft' })
      if (submit) next = await learningApi.reviewTopicSubmission(topic.id)
      setSubmission(next)
      toast.success(submit ? 'AI 反馈已生成' : '草稿已保存')
    } catch (error: any) {
      toast.error(error?.message || '保存失败')
    } finally { setSaving(false) }
  }
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-amber-500/[0.08] p-4"><p className="text-sm font-semibold leading-6">{topic.promptZh || topic.promptEn}</p>{topic.promptEn && topic.promptZh && <p className="mt-2 text-xs leading-5 text-muted-foreground">{topic.promptEn}</p>}</div>
      {(config.requirements ?? []).length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">需要覆盖</p><div className="flex flex-wrap gap-2">{config.requirements.map((item: string) => <Badge key={item} variant="outline">{item}</Badge>)}</div></div>}
      <div><Textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-[300px] resize-y rounded-2xl p-4 text-[15px] leading-7" placeholder="先写下你的想法，AI 会在提交后给出有证据的修改建议……" /><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{config.genre ? `文体：${config.genre}` : '自由写作'}</span><span className={cn(config.minWords && wordCount < config.minWords && 'text-amber-600')}>{wordCount} 词{config.minWords ? ` / ${config.minWords}–${config.maxWords ?? '∞'}` : ''}</span></div></div>
      <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => save(false)} disabled={saving || !text.trim()}><Save className="mr-1.5 size-4" />保存草稿</Button><Button className="flex-1" onClick={() => save(true)} disabled={saving || !text.trim()}>{saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Sparkles className="mr-1.5 size-4" />}提交反馈</Button></div>
      {submission?.feedback && <FeedbackPanel feedback={submission.feedback} />}
    </div>
  )
}

function ReadingExperience({ topic }: { topic: TrainingTopicItem }) {
  const config = topic.contentConfig?.reading ?? {}
  const questions: any[] = config.questions ?? []
  const [answers, setAnswers] = useState<Record<string, string>>(topic.latestSubmission?.response?.answers ?? {})
  const [submission, setSubmission] = useState(topic.latestSubmission ?? null)
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    try {
      await learningApi.saveTopicSubmission(topic.id, { response: { answers }, status: 'submitted' })
      const reviewed = await learningApi.reviewTopicSubmission(topic.id)
      setSubmission(reviewed)
      toast.success('回答已提交')
    } catch (error: any) { toast.error(error?.message || '提交失败') } finally { setSaving(false) }
  }
  return (
    <div className="space-y-6">
      <article className="rounded-2xl border border-border/70 bg-card p-5 text-[15px] leading-8 shadow-sm"><MarkdownContent content={topic.description || topic.promptEn || topic.promptZh} /></article>
      <div className="space-y-4">
        {questions.map((question, index) => {
          const key = String(index)
          return <div key={key} className="rounded-2xl bg-muted/35 p-4"><p className="mb-3 text-sm font-semibold leading-6"><span className="mr-2 text-primary">{index + 1}.</span>{question.prompt}</p>{question.type === 'choice' ? <div className="grid gap-2">{(question.options ?? []).map((option: string) => <button key={option} type="button" onClick={() => setAnswers({ ...answers, [key]: option })} className={cn('rounded-xl border px-3 py-2.5 text-left text-sm', answers[key] === option ? 'border-primary bg-primary/10' : 'border-border bg-background')}>{option}</button>)}</div> : question.type === 'boolean' ? <div className="flex gap-2">{['正确', '错误'].map((option) => <Button key={option} variant={answers[key] === option ? 'default' : 'outline'} onClick={() => setAnswers({ ...answers, [key]: option })}>{option}</Button>)}</div> : <Textarea value={answers[key] ?? ''} onChange={(event) => setAnswers({ ...answers, [key]: event.target.value })} placeholder="根据文章内容回答" />}</div>
        })}
        {questions.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">这篇阅读暂未配置理解题</p>}
      </div>
      {questions.length > 0 && <Button className="w-full" onClick={submit} disabled={saving}>{saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Sparkles className="mr-1.5 size-4" />}提交并查看证据</Button>}
      {submission?.feedback && <FeedbackPanel feedback={submission.feedback} />}
    </div>
  )
}

function ListeningExperience({ topic }: { topic: TrainingTopicItem }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const segments = topic.transcript ?? []
  const [currentMs, setCurrentMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loopIndex, setLoopIndex] = useState<number | null>(null)
  const [showTranslation, setShowTranslation] = useState(true)
  const [completing, setCompleting] = useState(false)
  const activeIndex = Math.max(0, segments.findIndex((segment) => currentMs >= segment.startMs && currentMs < segment.endMs))
  const active = segments[activeIndex]
  const seek = (segment: ListeningTranscriptSegment, index: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = segment.startMs / 1000
    setCurrentMs(segment.startMs)
    setLoopIndex(index)
    void audioRef.current.play()
  }
  const onTime = () => {
    const audio = audioRef.current
    if (!audio) return
    const nextMs = audio.currentTime * 1000
    setCurrentMs(nextMs)
    if (loopIndex != null && segments[loopIndex] && nextMs >= segments[loopIndex].endMs) {
      audio.currentTime = segments[loopIndex].startMs / 1000
      void audio.play()
    }
  }
  return (
    <div className="space-y-4">
      {topic.mediaUrl ? <audio ref={audioRef} src={topic.mediaUrl} onTimeUpdate={onTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} preload="metadata" /> : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">音频资产暂不可用</p>}
      <div className="sticky top-0 z-10 rounded-2xl border border-border/70 bg-background/95 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3"><Button size="icon" className="rounded-full" disabled={!topic.mediaUrl} onClick={() => playing ? audioRef.current?.pause() : void audioRef.current?.play()}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{active?.text ?? topic.title}</p>{showTranslation && <p className="truncate text-xs text-muted-foreground">{active?.translation}</p>}</div><label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={showTranslation} onCheckedChange={setShowTranslation} />译文</label></div>
        {active?.words?.length ? <p className="mt-3 flex flex-wrap gap-x-1.5 gap-y-1 text-sm leading-7">{active.words.map((word, index) => <span key={`${word.token}-${index}`} className={cn(currentMs >= word.startMs && currentMs < word.endMs && 'rounded bg-primary px-1 text-primary-foreground')}>{word.token}</span>)}</p> : null}
      </div>
      <div className="space-y-1.5">{segments.map((segment, index) => <button key={segment.id ?? index} type="button" onClick={() => seek(segment, index)} className={cn('flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors', activeIndex === index ? 'bg-primary/10' : 'hover:bg-muted/60')}><span className="w-10 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{formatTime(segment.startMs)}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-6">{segment.text}</span>{showTranslation && segment.translation && <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{segment.translation}</span>}</span>{loopIndex === index && <Repeat2 className="mt-1 size-3.5 shrink-0 text-primary" />}</button>)}</div>
      {segments.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">后台还没有配置逐句时间戳</p>}
      {loopIndex != null && <Button variant="outline" className="w-full" onClick={() => setLoopIndex(null)}><Repeat2 className="mr-1.5 size-4" />取消单句循环</Button>}
      <Button className="w-full" disabled={completing || segments.length === 0} onClick={async () => { setCompleting(true); try { await learningApi.saveTopicSubmission(topic.id, { response: { listenedAtMs: currentMs }, status: 'completed' }); toast.success('本话题已完成') } catch (error: any) { toast.error(error?.message || '保存失败') } finally { setCompleting(false) } }}>{completing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-4" />}完成本话题</Button>
    </div>
  )
}

function NovelExperience({ unit, experience }: { unit: UnitDetail; experience: SceneExperience | null }) {
  const [location, setLocation] = useState<string | number>(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renditionRef = useRef<any>(null)
  useEffect(() => {
    const saved = experience?.novelPackage?.progress?.locator?.cfi
    if (typeof saved === 'string') setLocation(saved)
  }, [experience?.novelPackage?.progress?.locator])
  if (!experience) return <div className="mb-5 flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  if (!experience.novelPackage) return <div className="mb-5 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">后台还没有上传 EPUB</div>
  const novel = experience.novelPackage
  const handleLocation = (epubcfi: string) => {
    setLocation(epubcfi)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const rendition = renditionRef.current
    const current = rendition?.currentLocation?.()
    const percentage = Number(current?.start?.percentage ?? rendition?.book?.locations?.percentageFromCfi?.(epubcfi) ?? novel.progress?.percentage ?? 0)
    saveTimer.current = setTimeout(() => void learningApi.saveNovelProgress(unit.id, { locator: { cfi: epubcfi }, percentage: Number.isFinite(percentage) ? Math.max(0, Math.min(1, percentage)) : 0 }), 800)
  }
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      {experience.groupItem && <div className="border-b border-border/60 bg-amber-500/[0.07] px-4 py-2 text-xs text-muted-foreground">{experience.groupItem.group.name} · 第 {experience.groupItem.sortOrder + 1}/{experience.groupItem.group.items.length} 册</div>}
      <div className="h-[72dvh] min-h-[520px] bg-white text-black"><ReactReader url={novel.epubUrl} title={novel.metadata?.title ?? unit.title} location={location} locationChanged={handleLocation} getRendition={(rendition) => { renditionRef.current = rendition; void rendition.book.locations.generate(1600).catch(() => undefined) }} showToc epubInitOptions={{ openAs: 'epub' }} /></div>
    </section>
  )
}

function FeedbackPanel({ feedback }: { feedback: Record<string, any> }) {
  return <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"><div className="mb-3 flex items-center gap-2"><Sparkles className="size-4 text-emerald-600" /><p className="text-sm font-semibold">AI 学习反馈</p>{feedback.score != null && <Badge className="ml-auto">{feedback.score}</Badge>}</div><p className="text-sm leading-6 text-muted-foreground">{feedback.summary}</p>{(feedback.strengths ?? []).length > 0 && <ul className="mt-3 space-y-1 text-sm">{feedback.strengths.map((item: string) => <li key={item}>✓ {item}</li>)}</ul>}{(feedback.improvements ?? []).length > 0 && <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-400">{feedback.improvements.map((item: string) => <li key={item}>→ {item}</li>)}</ul>}{feedback.nextRevisionFocus && <p className="mt-3 rounded-lg bg-background/70 px-3 py-2 text-sm font-medium">下一稿：{feedback.nextRevisionFocus}</p>}</div>
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
