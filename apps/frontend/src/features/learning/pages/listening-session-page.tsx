import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Ear, Headphones, Info, Layers, Loader2, Mic, Pause, Play, RotateCcw, Search, Settings, Square, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/cn'
import { startBestNativeVoiceInput, type NativeVoiceInputSession } from '@/lib/native/vn-voice-input'
import { useTopicMediaUrl } from '@/hooks/use-topic-media'
import { MixedPlaybackSettingsDialog, type DisplayMode, type LoopMode } from '@/components/common/playback-settings-dialog'
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
        : <ListeningPlayerPage topic={topic} unitId={unit.id} unitTitle={unit.title} onClose={() => setPhase('prepare')} />}
      <PracticeVnDrawer open={guideOpen} onOpenChange={setGuideOpen} hideToggles teachingMarkdown={topic.teachingMarkdown?.trim() || topic.description?.trim() || ''} />
    </>
  )
}

function ListeningHeader({ topic, unitTitle, onBack, onSettingsOpen }: { topic: TrainingTopicItem; unitTitle: string; onBack: () => void; onSettingsOpen?: () => void }) {
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
      {onSettingsOpen && (
        <button
          type="button"
          onClick={onSettingsOpen}
          aria-label="播放设置"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/75 hover:text-foreground"
        >
          <Settings className="size-4" />
        </button>
      )}
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

// ── 倍速选项 ────────────────────────────────────────────────────────────────
const SPEED_OPTIONS = [0.5, 0.6, 0.8, 1, 1.2, 1.4, 1.8, 2.0] as const

function formatSpeed(rate: number) {
  return rate === 1 ? '1x' : `${rate}x`
}

// ── 听力学练播放页 ──────────────────────────────────────────────────────────

function ListeningPlayerPage({ topic, unitId, unitTitle, onClose }: { topic: TrainingTopicItem; unitId?: string | null; unitTitle: string; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const segments = topic.transcript ?? []
  const totalDurationMs = segments.length > 0 ? segments[segments.length - 1].endMs : 0

  // 音频地址：Web 直接用签名 URL；移动端离线包按 mediaAssetId 解析本地文件
  const { mediaUrl, resolving } = useTopicMediaUrl(topic, unitId)

  const [currentMs, setCurrentMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [intensiveMode, setIntensiveMode] = useState(false)
  const [shadowOpen, setShadowOpen] = useState(false)
  const [speedExpanded, setSpeedExpanded] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [completing, setCompleting] = useState(false)

  // 字幕显示模式（原文 / 译文 / 双语 / 不显示）
  const [displayMode, setDisplayMode] = useState<DisplayMode>('bilingual')
  // 原文模式下，当前播放/选择句下方显示译文
  const [showCurrentTranslation, setShowCurrentTranslation] = useState(false)

  // 逐句播放设置（句间间隔 + 循环次数，复用剧本播放器的播放设置弹窗）
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [gapSeconds, setGapSeconds] = useState(1)
  const [loopMode, setLoopMode] = useState<LoopMode>('1')
  const loopIndexRef = useRef(1)
  // 句间自动停顿：pause 事件来自逐句逻辑而非用户操作时，不重置 playing
  const autoGapRef = useRef(false)
  const gapTimerRef = useRef<number | null>(null)

  // 取消进行中的句间停顿（用户手动暂停 / 跳转时）
  const cancelGap = useCallback(() => {
    if (gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current)
      gapTimerRef.current = null
    }
    autoGapRef.current = false
  }, [])

  // 由 currentMs 推导当前句子索引
  const activeIndex = useMemo(() => {
    if (segments.length === 0) return 0
    const idx = segments.findIndex((s) => currentMs >= s.startMs && currentMs < s.endMs)
    return idx >= 0 ? idx : 0
  }, [currentMs, segments])

  const activeSegment = segments[activeIndex]
  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < segments.length - 1

  // 倍速同步到 audio 元素
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // timeupdate 回调
  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentMs(audio.currentTime * 1000)
  }, [])

  // 句间自动停顿导致的 pause 不重置 playing（等待句间间隔后自动续播）
  const onPause = useCallback(() => {
    if (autoGapRef.current) return
    setPlaying(false)
  }, [])

  // 逐句播放：当前句结束 → 等待句间间隔 → 下一句 / 整段循环
  useEffect(() => {
    if (!playing || segments.length === 0) return
    const audio = audioRef.current
    if (!audio) return
    const active = segments[activeIndex]
    if (!active) return
    if (currentMs < active.endMs - 40) return

    autoGapRef.current = true
    audio.pause()
    gapTimerRef.current = window.setTimeout(() => {
      gapTimerRef.current = null
      autoGapRef.current = false
      if (activeIndex < segments.length - 1) {
        const next = segments[activeIndex + 1]
        audio.currentTime = next.startMs / 1000
        setCurrentMs(next.startMs)
        void audio.play()
      } else {
        const maxLoops = loopMode === 'infinite' ? Number.POSITIVE_INFINITY : Number(loopMode)
        if (loopIndexRef.current < maxLoops) {
          loopIndexRef.current += 1
          const first = segments[0]
          audio.currentTime = first.startMs / 1000
          setCurrentMs(first.startMs)
          void audio.play()
        } else {
          loopIndexRef.current = 1
          setPlaying(false)
        }
      }
    }, gapSeconds * 1000)
    return cancelGap
  }, [activeIndex, cancelGap, currentMs, gapSeconds, loopMode, playing, segments])

  // 播放/暂停
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      cancelGap()
      audio.pause()
    } else {
      void audio.play()
    }
  }, [cancelGap, playing])

  // 上一句 / 下一句（自动播放）
  const goToPrev = useCallback(() => {
    const audio = audioRef.current
    if (!audio || activeIndex <= 0) return
    const prev = segments[activeIndex - 1]
    audio.currentTime = prev.startMs / 1000
    setCurrentMs(prev.startMs)
    if (!playing) void audio.play()
  }, [activeIndex, playing, segments])

  const goToNext = useCallback(() => {
    const audio = audioRef.current
    if (!audio || activeIndex >= segments.length - 1) return
    const next = segments[activeIndex + 1]
    audio.currentTime = next.startMs / 1000
    setCurrentMs(next.startMs)
    if (!playing) void audio.play()
  }, [activeIndex, playing, segments])

  // 点击某句跳转
  const seekTo = useCallback((index: number) => {
    const audio = audioRef.current
    if (!audio || index < 0 || index >= segments.length) return
    audio.currentTime = segments[index].startMs / 1000
    setCurrentMs(segments[index].startMs)
    void audio.play()
  }, [segments])

  // 进度条拖拽
  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio) return
    const ms = value[0]
    audio.currentTime = ms / 1000
    setCurrentMs(ms)
  }, [])

  // 完成话题
  const handleComplete = useCallback(async () => {
    setCompleting(true)
    try {
      await learningApi.saveTopicSubmission(topic.id, { response: { listenedAtMs: currentMs }, status: 'completed' })
      toast.success('本话题已完成')
    } catch (error: any) {
      toast.error(error?.message || '保存失败')
    } finally {
      setCompleting(false)
    }
  }, [currentMs, topic.id])

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* 隐藏的 audio 元素 */}
      {mediaUrl && (
        <audio
          ref={audioRef}
          src={mediaUrl}
          onTimeUpdate={onTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={onPause}
          onEnded={() => setPlaying(false)}
          preload="metadata"
        />
      )}

      {/* 顶部栏 */}
      <div className="shrink-0 px-4 pt-3">
        <ListeningHeader topic={topic} unitTitle={unitTitle} onBack={onClose} onSettingsOpen={() => setSettingsOpen(true)} />
      </div>

      {/* 内容区 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {resolving ? (
          <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在加载音频…
          </p>
        ) : !mediaUrl ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">音频资产暂不可用</p>
        ) : segments.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">后台还没有配置逐句时间戳</p>
        ) : intensiveMode ? (
          /* 精听模式：仅展示当前句 */
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            {(displayMode === 'original' || displayMode === 'bilingual') && activeSegment?.text && (
              <p className="text-2xl font-semibold leading-relaxed tracking-wide text-foreground">{activeSegment.text}</p>
            )}
            {(displayMode === 'bilingual' || displayMode === 'translation' || (displayMode === 'original' && showCurrentTranslation)) && activeSegment?.translation && (
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">{activeSegment.translation}</p>
            )}
            {(displayMode === 'original' || displayMode === 'bilingual') && activeSegment?.words?.length ? (
              <p className="mt-6 flex flex-wrap justify-center gap-x-1.5 gap-y-1 text-lg leading-8">
                {activeSegment.words.map((word, i) => (
                  <span
                    key={`${word.token}-${i}`}
                    className={cn(
                      currentMs >= word.startMs && currentMs < word.endMs && 'rounded bg-primary px-1.5 text-primary-foreground',
                    )}
                  >
                    {word.token}
                  </span>
                ))}
              </p>
            ) : null}

            {/* 精听模式下的完成按钮 */}
            <Button
              variant="outline"
              className="mt-8"
              disabled={completing}
              onClick={handleComplete}
            >
              {completing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-4" />}
              完成本话题
            </Button>
          </div>
        ) : (
          /* 普通模式：展示全部句子 */
          <div className="space-y-1.5 pb-4">
            {segments.map((segment, index) => {
              const isActive = activeIndex === index
              const showText = displayMode === 'original' || displayMode === 'bilingual'
              const showTranslation = displayMode === 'bilingual' || displayMode === 'translation' || (displayMode === 'original' && isActive && showCurrentTranslation)
              return (
                <button
                  key={segment.id ?? index}
                  type="button"
                  onClick={() => seekTo(index)}
                  className={cn(
                    'flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                    isActive ? 'bg-primary/10' : 'hover:bg-muted/60',
                  )}
                >
                  <span className="w-10 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{formatTime(segment.startMs)}</span>
                  <span className="min-w-0 flex-1">
                    {showText && <span className="block text-sm font-medium leading-6">{segment.text}</span>}
                    {showTranslation && segment.translation && (
                      <span className={cn('block text-xs leading-5 text-muted-foreground', showText && 'mt-0.5')}>{segment.translation}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 倍速面板（在 footer 上方展开） */}
      {speedExpanded && mediaUrl && (
        <SpeedPanel
          rate={playbackRate}
          onRateChange={setPlaybackRate}
          currentMs={currentMs}
          totalMs={totalDurationMs}
          onSeek={handleSeek}
        />
      )}

      {/* 底部播放器栏 */}
      <ListeningFooter
        intensiveMode={intensiveMode}
        onIntensiveToggle={() => setIntensiveMode((v) => !v)}
        onShadowOpen={() => setShadowOpen(true)}
        playing={playing}
        onPlayToggle={togglePlay}
        onPrev={goToPrev}
        onNext={goToNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        speedExpanded={speedExpanded}
        onSpeedToggle={() => setSpeedExpanded((v) => !v)}
        playbackRate={playbackRate}
        disabled={resolving || !mediaUrl}
      />

      {/* 播放设置（句间间隔 + 循环次数 + 显示模式） */}
      <MixedPlaybackSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        gapSeconds={gapSeconds}
        onGapSecondsChange={setGapSeconds}
        loopMode={loopMode}
        onLoopModeChange={(mode) => {
          setLoopMode(mode)
          loopIndexRef.current = 1
        }}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        showCurrentTranslation={showCurrentTranslation}
        onShowCurrentTranslationChange={setShowCurrentTranslation}
      />

      {/* 跟读 Drawer */}
      {activeSegment && (
        <ListeningShadowDrawer
          open={shadowOpen}
          onOpenChange={setShadowOpen}
          segment={activeSegment}
        />
      )}
    </div>
  )
}

// ── 倍速面板（Footer 上方展开） ─────────────────────────────────────────────

function SpeedPanel({
  rate,
  onRateChange,
  currentMs,
  totalMs,
  onSeek,
}: {
  rate: number
  onRateChange: (rate: number) => void
  currentMs: number
  totalMs: number
  onSeek: (value: number[]) => void
}) {
  return (
    <div className="shrink-0 border-t border-border/60 bg-muted/10 px-5 py-3">
      {/* 第一行：倍速选项 */}
      <div className="grid grid-cols-8 gap-1 rounded-lg bg-muted p-1">
        {SPEED_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onRateChange(option)}
            aria-pressed={rate === option}
            className={cn(
              'rounded-md py-1.5 text-xs font-medium transition-colors',
              rate === option
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {formatSpeed(option)}
          </button>
        ))}
      </div>

      {/* 第二行：进度条 + 时间 */}
      <div className="mt-3 flex items-center gap-3">
        <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {formatTime(currentMs)}
        </span>
        <Slider
          value={[currentMs]}
          max={totalMs || 1}
          step={100}
          onValueChange={onSeek}
          className="flex-1"
        />
        <span className="w-10 font-mono text-xs tabular-nums text-muted-foreground">
          {formatTime(totalMs)}
        </span>
      </div>
    </div>
  )
}

// ── 底部播放器栏 ─────────────────────────────────────────────────────────────

function ListeningFooter({
  intensiveMode,
  onIntensiveToggle,
  onShadowOpen,
  playing,
  onPlayToggle,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  speedExpanded,
  onSpeedToggle,
  playbackRate,
  disabled,
}: {
  intensiveMode: boolean
  onIntensiveToggle: () => void
  onShadowOpen: () => void
  playing: boolean
  onPlayToggle: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  speedExpanded: boolean
  onSpeedToggle: () => void
  playbackRate: number
  disabled: boolean
}) {
  return (
    <div className="shrink-0 border-t border-border/60 bg-muted/10 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      <div className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3">
        {/* 左侧：精听 + 跟读 */}
        <div className="flex items-center gap-1 justify-self-start">
          <Button
            variant={intensiveMode ? 'default' : 'ghost'}
            size="icon"
            onClick={onIntensiveToggle}
            disabled={disabled}
            aria-label="精听"
            className="size-11 rounded-full"
          >
            <Ear className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onShadowOpen}
            disabled={disabled}
            aria-label="跟读"
            className="size-11 rounded-full"
          >
            <Mic className="size-5" />
          </Button>
        </div>

        {/* 中间：上一句 / 播放 / 下一句 */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrev}
            disabled={disabled || !hasPrev}
            aria-label="上一句"
            className="size-11 rounded-full"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={onPlayToggle}
            disabled={disabled}
            className="size-12 rounded-full shadow-sm"
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNext}
            disabled={disabled || !hasNext}
            aria-label="下一句"
            className="size-11 rounded-full"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {/* 右侧：倍速按钮 */}
        <Button
          variant={speedExpanded ? 'default' : 'ghost'}
          size="icon"
          onClick={onSpeedToggle}
          disabled={disabled}
          className="size-11 justify-self-end rounded-full text-xs font-semibold"
          aria-label="倍速"
        >
          {formatSpeed(playbackRate)}
        </Button>
      </div>
    </div>
  )
}

// ── 跟读 Drawer（参考 VN FollowReadDrawer） ─────────────────────────────────

function pickRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(
      (m) => MediaRecorder.isTypeSupported(m),
    ) ?? ''
  )
}

function isObjectUrl(url: string | null | undefined) {
  return Boolean(url?.startsWith('blob:'))
}

function getMicErrorMessage(error: unknown) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return '当前页面不是安全环境，浏览器会禁止麦克风'
  }
  if (!navigator.mediaDevices?.getUserMedia) return '当前 WebView 不支持麦克风录音'
  if (typeof MediaRecorder === 'undefined') return '当前 WebView 不支持 MediaRecorder 录音'
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '无法访问麦克风，请检查权限设置'
  return '麦克风启动失败，请稍后重试'
}

function ListeningShadowDrawer({
  open,
  onOpenChange,
  segment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  segment: ListeningTranscriptSegment
}) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [playingRecording, setPlayingRecording] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const nativeSessionRef = useRef<NativeVoiceInputSession | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordedUrlRef = useRef<string | null>(null)
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null)
  const startedAtRef = useRef(0)

  const cleanupRecording = useCallback(() => {
    nativeSessionRef.current?.cancel().catch(() => undefined)
    nativeSessionRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  const cleanupAudio = useCallback(() => {
    recordingAudioRef.current?.pause()
    recordingAudioRef.current = null
    setPlayingRecording(false)
  }, [])

  // Drawer 关闭时清理
  useEffect(() => {
    if (!open) {
      cleanupRecording()
      cleanupAudio()
      setRecording(false)
      setElapsed(0)
      setError('')
    }
  }, [cleanupAudio, cleanupRecording, open])

  useEffect(() => () => {
    cleanupRecording()
    cleanupAudio()
  }, [cleanupAudio, cleanupRecording])

  // 录音计时
  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200)
    return () => window.clearInterval(timer)
  }, [recording])

  // 开始录音
  const startRecording = useCallback(async () => {
    setError('')
    cleanupAudio()
    try {
      const nativeSession = await startBestNativeVoiceInput({
        language: 'en-US',
        useNativeSpeechRecognition: false,
      })
      if (nativeSession) {
        nativeSessionRef.current = nativeSession
        startedAtRef.current = Date.now()
        setElapsed(0)
        setRecording(true)
        return
      }

      if (typeof MediaRecorder === 'undefined') {
        setError('当前浏览器不支持录音')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickRecordingMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        })
        if (isObjectUrl(recordedUrlRef.current)) URL.revokeObjectURL(recordedUrlRef.current)
        recordedUrlRef.current = URL.createObjectURL(blob)
        setRecordedUrl(recordedUrlRef.current)
        cleanupRecording()
      }
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setElapsed(0)
      setRecording(true)
      recorder.start(200)
    } catch (err) {
      setError(getMicErrorMessage(err))
    }
  }, [cleanupAudio, cleanupRecording])

  // 停止录音
  const stopRecording = useCallback(async () => {
    const nativeSession = nativeSessionRef.current
    if (nativeSession) {
      nativeSessionRef.current = null
      setRecording(false)
      try {
        if (nativeSession.kind !== 'audio-recorder') {
          await nativeSession.cancel()
          throw new Error('Follow practice requires an audio recorder session')
        }
        const result = await nativeSession.stop()
        const url = result.playbackUrl || URL.createObjectURL(result.blob)
        if (isObjectUrl(recordedUrlRef.current)) URL.revokeObjectURL(recordedUrlRef.current)
        recordedUrlRef.current = url
        setRecordedUrl(url)
      } catch (err) {
        setError('录音保存失败，请重试')
      }
      return
    }
    recorderRef.current?.stop()
    setRecording(false)
  }, [])

  // 回放录音
  const playRecording = useCallback(() => {
    if (!recordedUrl) return
    cleanupAudio()
    const audio = new Audio(recordedUrl)
    recordingAudioRef.current = audio
    audio.onplay = () => setPlayingRecording(true)
    audio.onpause = () => setPlayingRecording(false)
    audio.onended = () => setPlayingRecording(false)
    audio.play().catch(() => setPlayingRecording(false))
  }, [cleanupAudio, recordedUrl])

  // 重录
  const resetRecording = useCallback(() => {
    cleanupAudio()
    if (isObjectUrl(recordedUrlRef.current)) URL.revokeObjectURL(recordedUrlRef.current)
    recordedUrlRef.current = null
    setRecordedUrl(null)
    setElapsed(0)
  }, [cleanupAudio])

  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        showHandle={false}
        className="mx-auto max-h-[62dvh] w-full max-w-[520px] overflow-hidden rounded-t-xl border-border bg-background px-0 pb-[calc(0.8rem+env(safe-area-inset-bottom,0px))] text-foreground"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <DrawerHeader className="px-4 pb-2 pt-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="text-sm font-semibold text-foreground">跟读练习</DrawerTitle>
            </div>
            <span
              className={cn(
                'rounded px-2 py-1 text-[11px]',
                recording ? 'bg-rose-500/10 text-rose-700' : recordedUrl ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground',
              )}
            >
              {recording ? formatElapsed(elapsed) : recordedUrl ? '已录音' : '待录音'}
            </span>
          </div>
        </DrawerHeader>

        <div className="space-y-3 px-4">
          {/* 原文 */}
          <div className="rounded-lg border border-border bg-muted/35 p-3">
            <p className="text-lg font-semibold leading-7 text-foreground">{segment.text}</p>
            {segment.translation && (
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{segment.translation}</p>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              className={cn(
                'h-10 gap-1.5',
                recording
                  ? 'bg-rose-500 text-white hover:bg-rose-500/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? <Square className="size-3.5 fill-current" /> : <Mic className="size-3.5" />}
              {recording ? '停止' : '录音'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-1.5"
              disabled={!recordedUrl || recording}
              onClick={playRecording}
            >
              {playingRecording ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              回放
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            disabled={!recordedUrl || recording}
            onClick={resetRecording}
            className="h-9 w-full gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            重录
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
