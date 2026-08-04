import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronRight, Headphones, Info, Layers, Loader2, Pause, Play, Repeat2, Search, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { cn } from '@/lib/cn'
import { useLayoutStore } from '@/stores/layout.store'
import { useLearningStore } from '@/stores/learning.store'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { learningApi, type ListeningTranscriptSegment, type TrainingTopicItem } from '../api/learning-api'

type ListeningPhase = 'prepare' | 'listen'

export function ListeningSessionPage() {
  const navigate = useNavigate()
  const { topicId } = useParams<{ topicId: string }>()
  const [searchParams] = useSearchParams()
  const unitId = searchParams.get('unitId')
  const unit = useLearningStore((state) => state.unitDetail)
  const loading = useLearningStore((state) => state.unitDetailLoading)
  const fetchUnitDetail = useLearningStore((state) => state.fetchUnitDetail)
  const setImmersiveMode = useLayoutStore((state) => state.setImmersiveMode)
  const [phase, setPhase] = useState<ListeningPhase>('prepare')
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (!unitId || unit?.id === unitId) return
    void fetchUnitDetail(unitId)
  }, [fetchUnitDetail, unit?.id, unitId])

  useEffect(() => {
    setImmersiveMode(phase === 'listen')
    return () => setImmersiveMode(false)
  }, [phase, setImmersiveMode])

  const topic = useMemo(() => unit?.trainingTopics.find((item) => item.id === topicId) ?? null, [topicId, unit?.trainingTopics])

  if (loading && (!unit || unit.id !== unitId)) return <MobilePageLoading rows={5} minHeightClassName="min-h-[100dvh]" />

  if (!unitId || !topic || unit?.contentMode !== 'listening') {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <Headphones className="size-10 text-muted-foreground/35" />
        <div>
          <p className="font-medium text-foreground">没有找到这个听力话题</p>
          <p className="mt-1 text-sm text-muted-foreground">返回学习包后重新选择一个话题。</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>返回学习包</Button>
      </div>
    )
  }

  return (
    <>
      {phase === 'prepare'
        ? <ListeningPreparePage topic={topic} unitTitle={unit.title} onBack={() => navigate(-1)} onOpenGuide={() => setGuideOpen(true)} onStart={() => setPhase('listen')} />
        : <ListeningPlayerPage topic={topic} unitTitle={unit.title} onClose={() => setPhase('prepare')} onOpenGuide={() => setGuideOpen(true)} />}
      <PracticeVnDrawer open={guideOpen} onOpenChange={setGuideOpen} hideToggles teachingMarkdown={topic.teachingMarkdown?.trim() || topic.description?.trim() || ''} />
    </>
  )
}

function ListeningHeader({ topic, unitTitle, onBack }: { topic: TrainingTopicItem; unitTitle: string; onBack: () => void }) {
  return (
    <header className="mb-4 flex min-h-10 items-center gap-3">
      <button type="button" onClick={onBack} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted" aria-label="返回学习包">
        <ArrowLeft className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{unitTitle}</p>
        <h1 className="truncate text-lg font-semibold tracking-tight">{topic.title}</h1>
      </div>
      <Badge variant="secondary">{topic.difficulty}</Badge>
    </header>
  )
}

function ListeningKnowledgeList({ icon, items, tone, emptyText }: { icon: React.ReactNode; items: Array<{ title: string; subtitle?: string | null }>; tone: 'cyan' | 'emerald' | 'violet'; emptyText: string }) {
  const toneClass = { cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' }[tone]
  if (items.length === 0) return <p className="rounded-lg bg-muted/25 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  return <div className="flex flex-col gap-2">{items.map((item) => <Card key={item.title} className="border-0 bg-muted/30 shadow-none"><CardContent className="flex items-center gap-3 p-3"><span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', toneClass)}>{icon}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{item.title}</p>{item.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>}</div></CardContent></Card>)}</div>
}

function ListeningPreparePage({ topic, unitTitle, onBack, onOpenGuide, onStart }: { topic: TrainingTopicItem; unitTitle: string; onBack: () => void; onOpenGuide: () => void; onStart: () => void }) {
  const supportCount = (topic.vocabularies?.length ?? 0) + (topic.activeChunks?.length ?? 0) + (topic.sentencePatterns?.length ?? 0)
  const durationMinutes = Math.max(1, Math.round(topic.suggestedDurationSec / 60))
  const visibleVocabularies = topic.vocabularies ?? []
  const visibleChunks = topic.activeChunks ?? []
  const visiblePatterns = topic.sentencePatterns ?? []

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-3 md:pt-4">
      <ListeningHeader topic={topic} unitTitle={unitTitle} onBack={onBack} />
      <main className="space-y-5">
        {(topic.description?.trim() || topic.teachingMarkdown?.trim()) && (
          <section className="rounded-lg bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2"><Info className="size-4 text-primary" /><p className="text-sm font-semibold text-foreground">话题说明</p></div>
            {topic.description?.trim() && <MarkdownRenderer content={topic.description} className="text-muted-foreground prose-p:my-1" />}
            <Button variant="outline" className="mt-4 min-h-11 w-full" size="default" onClick={onOpenGuide}><Headphones className="size-4" />教学讲解</Button>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-base font-semibold text-foreground">听力准备</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">开始前可复习关联的词汇、句块与句型</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[11px]">{supportCount} 项</Badge>
          </div>
          <Tabs defaultValue={visibleVocabularies.length > 0 ? 'vocab' : visibleChunks.length > 0 ? 'chunk' : 'pattern'} className="w-full" data-mobile-route-swipe>
            <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-muted/70 p-1">
              <TabsTrigger value="vocab" className="rounded-md text-xs">词汇 ({visibleVocabularies.length})</TabsTrigger>
              <TabsTrigger value="chunk" className="rounded-md text-xs">核心句块 ({visibleChunks.length})</TabsTrigger>
              <TabsTrigger value="pattern" className="rounded-md text-xs">句型 ({visiblePatterns.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="vocab" className="mt-3" data-mobile-gesture-allow><ListeningKnowledgeList icon={<Search className="size-4" />} items={visibleVocabularies.map((item) => ({ title: item.word, subtitle: item.meaning }))} tone="cyan" emptyText="这个话题暂未配置词汇" /></TabsContent>
            <TabsContent value="chunk" className="mt-3" data-mobile-gesture-allow><ListeningKnowledgeList icon={<Layers className="size-4" />} items={visibleChunks.map((item) => ({ title: item.text, subtitle: item.meaning }))} tone="emerald" emptyText="这个话题暂未配置核心句块" /></TabsContent>
            <TabsContent value="pattern" className="mt-3" data-mobile-gesture-allow><ListeningKnowledgeList icon={<Target className="size-4" />} items={visiblePatterns.map((item) => ({ title: item.pattern, subtitle: item.meaning }))} tone="violet" emptyText="这个话题暂未配置句型" /></TabsContent>
          </Tabs>
        </section>

        <section className="rounded-lg bg-accent/[0.06] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Headphones className="size-4 text-accent" />
              <p className="text-sm font-semibold text-foreground">听力练习</p>
            </div>
            <span className="text-right text-xs leading-5 text-muted-foreground">
              {durationMinutes} 分钟 · {topic.transcript?.length ?? 0} 句
            </span>
          </div>
          {topic.promptEn?.trim() && <p className="text-lg font-semibold leading-7 text-foreground">{topic.promptEn}</p>}
          {topic.promptZh?.trim() && <p className="mt-2 text-sm leading-6 text-muted-foreground">{topic.promptZh}</p>}
          {!(topic.promptEn?.trim() || topic.promptZh?.trim()) && <p className="text-sm leading-6 text-muted-foreground">进入后，逐句精听，可以单句循环，随时查看译文。</p>}
          <Button size="lg" className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" onClick={onStart}>开始练习<ChevronRight className="size-4" /></Button>
        </section>
      </main>
    </div>
  )
}

function ListeningPlayerPage({ topic, unitTitle, onClose, onOpenGuide }: { topic: TrainingTopicItem; unitTitle: string; onClose: () => void; onOpenGuide: () => void }) {
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
    <div className="mx-auto flex max-w-2xl flex-col px-4 pb-24 pt-3 md:pt-4">
      <ListeningHeader topic={topic} unitTitle={unitTitle} onBack={onClose} />

      <div className="space-y-4">
        {topic.mediaUrl ? (
          <audio ref={audioRef} src={topic.mediaUrl} onTimeUpdate={onTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} preload="metadata" />
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">音频资产暂不可用</p>
        )}

        <div className="sticky top-0 z-10 rounded-2xl border border-border/70 bg-background/95 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <Button size="icon" className="rounded-full" disabled={!topic.mediaUrl} onClick={() => playing ? audioRef.current?.pause() : void audioRef.current?.play()}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{active?.text ?? topic.title}</p>
              {showTranslation && <p className="truncate text-xs text-muted-foreground">{active?.translation}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="size-8" onClick={onOpenGuide}><Search className="size-4" /></Button>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={showTranslation} onCheckedChange={setShowTranslation} />译文
              </label>
            </div>
          </div>
          {active?.words?.length ? (
            <p className="mt-3 flex flex-wrap gap-x-1.5 gap-y-1 text-sm leading-7">
              {active.words.map((word, index) => (
                <span key={`${word.token}-${index}`} className={cn(currentMs >= word.startMs && currentMs < word.endMs && 'rounded bg-primary px-1 text-primary-foreground')}>
                  {word.token}
                </span>
              ))}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          {segments.map((segment, index) => (
            <button
              key={segment.id ?? index}
              type="button"
              onClick={() => seek(segment, index)}
              className={cn('flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors', activeIndex === index ? 'bg-primary/10' : 'hover:bg-muted/60')}
            >
              <span className="w-10 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{formatTime(segment.startMs)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-6">{segment.text}</span>
                {showTranslation && segment.translation && <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{segment.translation}</span>}
              </span>
              {loopIndex === index && <Repeat2 className="mt-1 size-3.5 shrink-0 text-primary" />}
            </button>
          ))}
        </div>

        {segments.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">后台还没有配置逐句时间戳</p>}

        {loopIndex != null && (
          <Button variant="outline" className="w-full" onClick={() => setLoopIndex(null)}>
            <Repeat2 className="mr-1.5 size-4" />取消单句循环
          </Button>
        )}

        <Button
          className="w-full"
          disabled={completing || segments.length === 0}
          onClick={async () => {
            setCompleting(true)
            try {
              await learningApi.saveTopicSubmission(topic.id, { response: { listenedAtMs: currentMs }, status: 'completed' })
              toast.success('本话题已完成')
            } catch (error: any) {
              toast.error(error?.message || '保存失败')
            } finally {
              setCompleting(false)
            }
          }}
        >
          {completing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-4" />}
          完成本话题
        </Button>
      </div>
    </div>
  )
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
