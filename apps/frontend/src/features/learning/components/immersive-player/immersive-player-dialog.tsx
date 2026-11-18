import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { App } from '@capacitor/app'
import {
  BookText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ListMusic,
  Loader2,
  MessageSquareText,
  Pause,
  Play,
  Settings2,
  TextQuote,
  Timer,
  Volume2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'
import { useBgmSuppress } from '@/lib/bgm-suppress'
import { useCachedAudio } from '@/hooks/use-cached-audio'
import { isIOS, isNative } from '@/lib/native'
import { WordMeaningInline, WordMeaningLines } from '@/features/learning/components/word-meaning-lines'
import { MarkdownContent } from '@/features/system/components/markdown-content'
import { immersivePlaybackService, type ImmersivePlaybackVisualState } from './immersive-playback.service'
import { createTimerScheduler, ListeningQueueEngine, type ListeningQueueEngineState } from './listening-queue.engine'
import { useImmersivePlayerPreferences } from './immersive-player.store'
import { IMMERSIVE_PAUSE_GAP_SECONDS, type ImmersivePlaybackSettings, type ImmersivePlayerExample, type ImmersivePlayerItem, type ImmersivePlayerStatus } from './immersive-player.types'
import { InsightListLoadMoreSentinel, insightLoadMoreAfterIndex } from '@/features/practice/components/insight-list-load-more'

type ImmersivePlayerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ImmersivePlayerItem[]
  index: number
  onIndexChange: (index: number) => void
  /** Absolute playlist size (may exceed loaded `items.length`). */
  total?: number
  /** Absolute offset of `items[0]`; lean append keeps this at 0. */
  windowOffset?: number
  /** Append the next lean page when the queue drawer scrolls near the end. */
  onLoadMore?: () => void
}

const TYPE_META = {
  word: { Icon: BookText, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  chunk: { Icon: MessageSquareText, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  pattern: { Icon: TextQuote, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
} satisfies Record<ImmersivePlayerItem['kind'], { Icon: typeof BookText; tone: string }>

const KIND_LABEL_KEY = {
  word: 'immersivePlayer.kind.word',
  chunk: 'immersivePlayer.kind.chunk',
  pattern: 'immersivePlayer.kind.pattern',
} satisfies Record<ImmersivePlayerItem['kind'], string>

const EQUALIZER_BARS = [
  [0.2, 0.58, 0.88, 0], [0.3, 0.78, 1.05, 0.12], [0.18, 0.5, 0.96, 0.24],
  [0.34, 0.92, 1.16, 0.05], [0.25, 0.7, 0.9, 0.18], [0.38, 1, 1.08, 0.3],
  [0.22, 0.64, 0.98, 0.09], [0.3, 0.84, 1.12, 0.28], [0.2, 0.56, 0.92, 0.14],
  [0.34, 0.9, 1.04, 0.22], [0.24, 0.68, 0.94, 0.03], [0.28, 0.76, 1.1, 0.16],
] as const

const EQUALIZER_PARTICLES = [
  [-62, -12, 18, -22, 2.8, 0.1], [-43, 21, -8, -30, 3.4, 0.6], [46, -20, 14, 26, 3.1, 0.35],
  [67, 12, -14, -20, 3.7, 0.8], [-12, -31, 20, 14, 3.3, 0.22], [21, 30, -18, -16, 2.9, 0.52],
] as const

function ListeningEqualizer({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion()
  const shouldAnimate = active && !reduceMotion

  return (
    <div className="relative flex h-32 items-center justify-center" aria-hidden="true">
      <motion.div
        className="pointer-events-none absolute size-36 rounded-full bg-primary/20 blur-3xl"
        animate={shouldAnimate ? { scale: [0.72, 1.18, 0.84], opacity: [0.13, 0.32, 0.16] } : { scale: 0.72, opacity: 0.06 }}
        transition={shouldAnimate ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.18, ease: 'easeOut' }}
      />
      <motion.div
        className="pointer-events-none absolute size-20 rounded-full bg-primary/25 blur-2xl"
        animate={shouldAnimate ? { x: [-9, 12, -9], y: [5, -8, 5], opacity: [0.08, 0.25, 0.08] } : { opacity: 0 }}
        transition={shouldAnimate ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.18, ease: 'easeOut' }}
      />
      {EQUALIZER_PARTICLES.map(([x, y, driftX, driftY, duration, delay], index) => (
        <motion.span
          key={index}
          className="pointer-events-none absolute size-1 rounded-full bg-primary/55 blur-[1px]"
          style={{ x, y }}
          animate={shouldAnimate ? { x: [x, x + driftX, x], y: [y, y + driftY, y], opacity: [0, 0.7, 0] } : { opacity: 0 }}
          transition={shouldAnimate ? { duration, delay, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.18, ease: 'easeOut' }}
        />
      ))}
      <div className="relative z-10 flex h-28 items-center justify-center gap-2">
        {EQUALIZER_BARS.map(([min, max, duration, delay], index) => (
          <motion.span
            key={index}
            className="h-full w-2 rounded-full bg-primary/80 shadow-[0_0_14px_hsl(var(--primary)/0.18)]"
            initial={{ scaleY: 0.2, opacity: 0.38 }}
            animate={shouldAnimate
              ? { scaleY: [min, max, Math.max(min, max * 0.62), min], opacity: [0.5, 1, 0.72, 0.5] }
              : { scaleY: 0.2, opacity: 0.38 }}
            transition={shouldAnimate ? { duration, delay, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95] } : { duration: 0.18, ease: 'easeOut' }}
            style={{ transformOrigin: 'center' }}
          />
        ))}
      </div>
    </div>
  )
}

function ListeningWaveformCard({
  active,
  label,
}: {
  active: boolean
  label: string
}) {
  return (
    <section className="w-full max-w-md text-center">
      <p className="text-base font-medium tracking-wide text-muted-foreground">{label}</p>
      <div className="mb-5">
        <ListeningEqualizer active={active} />
      </div>
    </section>
  )
}

export function ImmersivePlayerDialog({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
  total,
  windowOffset = 0,
  onLoadMore,
}: ImmersivePlayerDialogProps) {
  const { t } = useTranslation()
  useBgmSuppress('immersive-player-dialog', open)
  const settings = useImmersivePlayerPreferences((s) => s.settings)
  const updateSettings = useImmersivePlayerPreferences((s) => s.updateSettings)
  const current = items[index] ?? null
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [status, setStatus] = useState<ImmersivePlayerStatus>('idle')
  const [insightExpanded, setInsightExpanded] = useState(false)
  const [visualPlayback, setVisualPlayback] = useState<ImmersivePlaybackVisualState>({ state: 'idle', media: null })
  const { play: playExampleAudio, activeUrl: playingExampleUrl, stop: stopExampleAudio } = useCachedAudio()
  const statusRef = useRef<ImmersivePlayerStatus>('idle')
  const resumeQueueAfterExampleRef = useRef(false)
  const engineRef = useRef<ListeningQueueEngine | null>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const mediaMetadataLabels = useMemo(() => ({
    artist: t('app.name'),
    album: t('immersivePlayer.mediaAlbum'),
  }), [t])

  const playlistTotal = Math.max(total ?? items.length, items.length)
  const absoluteIndex = windowOffset + index
  const usesAbsoluteIndex = total != null
  const hasPrev = absoluteIndex > 0
  const hasNext = absoluteIndex < playlistTotal - 1

  const emitIndexChange = useCallback((nextAbsolute: number) => {
    onIndexChange(usesAbsoluteIndex ? nextAbsolute : nextAbsolute - windowOffset)
  }, [onIndexChange, usesAbsoluteIndex, windowOffset])

  useEffect(() => {
    const engine = new ListeningQueueEngine({
      transport: immersivePlaybackService,
      getSettings: () => useImmersivePlayerPreferences.getState().settings,
      scheduler: createTimerScheduler(),
      isBackground: () => isNative() && typeof document !== 'undefined' && document.visibilityState !== 'visible',
      mediaLabels: mediaMetadataLabels,
      onSleepEnd: () => onOpenChangeRef.current(false),
      onEmptySegments: () => toast.warning(t('immersivePlayer.noPlayableSegments')),
      onPlayFailed: () => toast.error(t('immersivePlayer.playFailed')),
    })
    engineRef.current = engine
    const unsubEngine = engine.subscribe((state: ListeningQueueEngineState) => {
      statusRef.current = state.status
      setStatus(state.status)
    })
    const unsubVisual = immersivePlaybackService.subscribeVisualState(setVisualPlayback)
    return () => {
      unsubEngine()
      unsubVisual()
      void engine.dispose()
      engineRef.current = null
    }
  }, [mediaMetadataLabels, t])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    if (!open) {
      void engine.stop({ clearSession: true })
      immersivePlaybackService.clearResolveCache()
      return
    }
    engine.bindPlaylist({
      items,
      index,
      total: playlistTotal,
      windowOffset,
      onIndexChange: emitIndexChange,
      onLoadMoreNearEnd: onLoadMore,
    })
  }, [emitIndexChange, index, items, onLoadMore, open, playlistTotal, windowOffset])

  useEffect(() => {
    if (!open) return
    const tryResumeAfterForeground = () => {
      const currentStatus = statusRef.current
      if (currentStatus !== 'playing' && currentStatus !== 'loading') return
      const engine = engineRef.current
      if (!engine) return
      void (async () => {
        if (immersivePlaybackService.hasResumableAsset()) {
          const resumed = await engine.resume()
          if (resumed) return
        }
        await engine.play()
      })()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryResumeAfterForeground()
    }
    document.addEventListener('visibilitychange', onVisibility)
    let resumeHandle: { remove: () => Promise<void> } | null = null
    if (isNative()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) tryResumeAfterForeground()
      }).then((handle) => {
        resumeHandle = handle
      })
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void resumeHandle?.remove()
    }
  }, [open])

  useEffect(() => {
    setInsightExpanded(false)
  }, [current?.id])

  useEffect(() => {
    stopExampleAudio()
  }, [current?.id, stopExampleAudio])

  useEffect(() => {
    if (status !== 'ended' && status !== 'idle' && status !== 'error') return
    setVisualPlayback((currentVisual) => currentVisual.state === 'idle' ? currentVisual : { state: 'idle', media: null })
  }, [status])

  const togglePlay = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    stopExampleAudio()
    resumeQueueAfterExampleRef.current = false
    if (status === 'playing') {
      await engine.pause()
      return
    }
    if (status === 'paused') {
      const resumed = await engine.resume()
      if (!resumed) await engine.play()
      return
    }
    await engine.play()
  }, [status, stopExampleAudio])

  const handleSettingsChange = useCallback((nextSettings: Partial<ImmersivePlaybackSettings>) => {
    updateSettings(nextSettings)
    engineRef.current?.updateSettings(nextSettings)
  }, [updateSettings])

  const gotoPrev = useCallback(() => {
    const playing = status === 'playing' || status === 'loading'
    void engineRef.current?.prev(playing)
  }, [status])

  const gotoNext = useCallback(() => {
    const playing = status === 'playing' || status === 'loading'
    void engineRef.current?.next(playing)
  }, [status])

  if (!current) return null

  const meta = TYPE_META[current.kind]
  const Icon = meta.Icon
  const hiddenText = !settings.textVisible
  const hasLongInsight = (current.insight?.length ?? 0) > 180
  const isVisualizerActive = status === 'playing' && visualPlayback.state === 'playing'

  const displayExamples = (() => {
    if (Array.isArray(current.examples) && current.examples.length > 0) return current.examples
    if (current.exampleEn?.trim()) {
      return [{
        en: current.exampleEn.trim(),
        ...(current.exampleZh?.trim() ? { zh: current.exampleZh.trim() } : {}),
        ...(current.exampleAudioUrl?.trim() ? { audioUrl: current.exampleAudioUrl.trim() } : {}),
      }] satisfies ImmersivePlayerExample[]
    }
    return [] as ImmersivePlayerExample[]
  })()

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-keyboard-overlay="practice"
          className="app-surface drawer-surface left-0 top-0 !z-[10000] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 pt-safe md:left-[50%] md:top-[50%] md:h-[88vh] md:max-w-3xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl md:pt-0 [&>button]:hidden"
        >
          <DialogTitle className="sr-only">{current.title}</DialogTitle>
          <DialogDescription className="sr-only">{current.meaning || current.sceneName || t('immersivePlayer.description')}</DialogDescription>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border/60 px-5 pb-4 pt-9 md:px-6">
              <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3">
                <div className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl', meta.tone)}>
                  <Icon className="size-[18px]" />
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary" className="shrink-0">{t(KIND_LABEL_KEY[current.kind])}</Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {settings.sleepTimerMinutes > 0 && (
                        <span className="inline-flex h-8 items-center gap-1 rounded-full bg-background/70 px-2 text-[11px] text-muted-foreground ring-1 ring-border/70">
                          <Timer className="size-3" /> {settings.sleepTimerMinutes}m
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="flex size-10 touch-manipulation items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        aria-label={t('immersivePlayer.settingsTitle')}
                      >
                        <Settings2 className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="flex size-10 touch-manipulation items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        aria-label={t('immersivePlayer.close')}
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h2 className={cn(
                      'line-clamp-2 break-words font-bold leading-tight text-foreground',
                      settings.textVisible ? 'text-2xl md:text-3xl' : 'text-lg text-muted-foreground',
                    )}>
                      {settings.textVisible ? current.title : t('immersivePlayer.hidden')}
                    </h2>
                    {settings.textVisible && current.meaning && (
                      <div className="mt-1.5">
                        <WordMeaningLines meaning={current.meaning} align="start" />
                      </div>
                    )}
                    {settings.textVisible && (
                      <p className="mt-1 line-clamp-1 break-words text-sm leading-relaxed text-muted-foreground">
                        {current.sceneName || `${absoluteIndex + 1} / ${playlistTotal}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 py-6 md:px-6">
              <div className={cn('mx-auto flex min-h-full max-w-xl flex-col gap-5', hiddenText ? 'items-center justify-center' : 'pt-2 md:pt-2')}>
                {!hiddenText && (
                <div className="text-center">
                  <p className="text-xs tabular-nums text-muted-foreground">{absoluteIndex + 1} / {playlistTotal}</p>
                </div>
                )}

                {hiddenText && (
                  <ListeningWaveformCard
                    active={isVisualizerActive}
                    label={t('immersivePlayer.listeningMode')}
                  />
                )}

                {!hiddenText && current.insight && (
                  <section className="space-y-2">
                    <div className={cn('relative', hasLongInsight && !insightExpanded && 'max-h-28 overflow-hidden')}>
                      <MarkdownContent content={current.insight} />
                    </div>
                    {hasLongInsight && (
                      <button
                        type="button"
                        onClick={() => setInsightExpanded((value) => !value)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                        aria-expanded={insightExpanded}
                      >
                        {insightExpanded ? t('immersivePlayer.collapseInsight') : t('immersivePlayer.expandInsight')}
                        <ChevronDown className={cn('size-3.5 transition-transform', insightExpanded && 'rotate-180')} />
                      </button>
                    )}
                  </section>
                )}

                {!hiddenText && displayExamples.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                      <MessageSquareText className="size-3.5" /> {t('immersivePlayer.segment.example')}
                    </div>
                    <div className="space-y-2">
                      {displayExamples.map((example, exampleIndex) => {
                        const playing = Boolean(example.audioUrl && playingExampleUrl === example.audioUrl)
                        return (
                          <div
                            key={`${example.en}:${exampleIndex}`}
                            className={cn('rounded-md px-1 py-2', playing && 'bg-primary/10')}
                          >
                            <div className="flex items-start gap-2">
                              <p className="min-w-0 flex-1 text-base font-medium leading-7 text-foreground">{example.en}</p>
                              {example.audioUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const wasQueuePlaying = statusRef.current === 'playing' || statusRef.current === 'loading'
                                    resumeQueueAfterExampleRef.current = wasQueuePlaying
                                    void engineRef.current?.pause()
                                    void playExampleAudio(example.audioUrl, null, 'voice', {
                                      onEnded: () => {
                                        if (!resumeQueueAfterExampleRef.current) return
                                        resumeQueueAfterExampleRef.current = false
                                        void engineRef.current?.play()
                                      },
                                    })
                                  }}
                                  className={cn(
                                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-background hover:text-foreground',
                                    playing ? 'bg-primary/15 text-primary' : 'text-muted-foreground',
                                  )}
                                  aria-label={t('insight.playExample')}
                                  aria-pressed={playing}
                                >
                                  <Volume2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                            {example.zh && (
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">{example.zh}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <div className={cn('grid shrink-0 grid-cols-[3.5rem_1fr_3.5rem] items-center gap-3 border-t border-border/60 bg-muted/10 px-5 py-4', isIOS() && 'pb-safe')}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => updateSettings({ textVisible: !settings.textVisible })}
                aria-label={settings.textVisible ? t('immersivePlayer.hideText') : t('immersivePlayer.showText')}
                className="size-11 rounded-full justify-self-start"
              >
                {settings.textVisible ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
              </Button>

              <div className="flex items-center justify-center gap-4">
                <Button variant="ghost" size="icon" onClick={gotoPrev} disabled={!hasPrev && !settings.loopQueue} aria-label={t('immersivePlayer.previous')} className="size-11 rounded-full border-0 bg-primary/10 text-primary shadow-none hover:bg-primary/16 hover:text-primary">
                  <ChevronLeft className="size-5" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={togglePlay}
                  className="size-12 rounded-full shadow-sm"
                  aria-label={status === 'playing' ? t('immersivePlayer.pause') : t('immersivePlayer.play')}
                >
                  {status === 'loading' ? <Loader2 className="size-5 animate-spin" /> : status === 'playing' ? <Pause className="size-5" /> : <Play className="size-5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={gotoNext} disabled={!hasNext && !settings.loopQueue} aria-label={t('immersivePlayer.next')} className="size-11 rounded-full border-0 bg-primary/10 text-primary shadow-none hover:bg-primary/16 hover:text-primary">
                  <ChevronRight className="size-5" />
                </Button>
              </div>

              <Button variant="ghost" size="icon" onClick={() => setQueueOpen(true)} aria-label={t('immersivePlayer.queueTitle')} className="size-11 rounded-full justify-self-end">
                <ListMusic className="size-5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImmersiveSettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={handleSettingsChange} />
      <ImmersiveQueueDrawer
        open={queueOpen}
        onOpenChange={setQueueOpen}
        items={items}
        index={index}
        total={playlistTotal}
        onLoadMore={onLoadMore}
        onSelect={(nextIndex) => {
          if (nextIndex === index) {
            setQueueOpen(false)
            return
          }
          const playing = status === 'playing' || status === 'loading'
          void engineRef.current?.seekTo(windowOffset + nextIndex, playing)
          setQueueOpen(false)
        }}
      />
    </>
  )
}

function ImmersiveSettingsDrawer({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: ImmersivePlaybackSettings
  onChange: (settings: Partial<ImmersivePlaybackSettings>) => void
}) {
  const { t } = useTranslation()

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        showHandle={false}
        className={cn(
          'mt-10 flex h-auto max-h-none flex-col overflow-visible rounded-t-2xl !z-[10001]',
          isIOS() && 'pb-safe',
        )}
        overlayClassName="!z-[10001]"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
        <div className="flex items-center justify-between gap-3 px-4 pb-1.5 pt-1.5">
          <DrawerTitle className="text-sm font-semibold">{t('immersivePlayer.settingsTitle')}</DrawerTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('immersivePlayer.close')}
            className={cn('flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground', isNative() && 'hidden')}
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
          <OptionGroup label={t('immersivePlayer.settings.sleepTimer')}>
            <SegmentedOptions
              value={settings.sleepTimerMinutes}
              options={[0, 15, 30, 60].map((value) => ({ value, label: value === 0 ? t('immersivePlayer.settings.off') : t('immersivePlayer.settings.minutes', { count: value }) }))}
              onChange={(value) => onChange({ sleepTimerMinutes: value as ImmersivePlaybackSettings['sleepTimerMinutes'] })}
            />
          </OptionGroup>
          <OptionGroup label={t('immersivePlayer.settings.repeatPerItem')}>
            <SegmentedOptions
              value={settings.repeatPerItem}
              options={[
                ...([1, 2, 3] as const).map((value) => ({ value, label: t('immersivePlayer.settings.times', { count: value }) })),
                { value: 'infinite' as const, label: t('immersivePlayer.settings.infinite') },
              ]}
              onChange={(value) => onChange({ repeatPerItem: value as ImmersivePlaybackSettings['repeatPerItem'] })}
            />
          </OptionGroup>
          <OptionGroup label={t('immersivePlayer.settings.playbackRate')}>
            <ToggleGroup
              type="single"
              value={String(settings.playbackRate)}
              onValueChange={(value) => {
                if (!value) return
                onChange({ playbackRate: Number(value) as ImmersivePlaybackSettings['playbackRate'] })
              }}
              className="grid w-full grid-cols-4 gap-0.5 rounded-md bg-muted p-0.5"
            >
              {([0.75, 1, 1.25, 1.5] as const).map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={String(value)}
                  className="h-9 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 text-[11px] font-medium text-muted-foreground shadow-none data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                >
                  {t('immersivePlayer.settings.speed', { value })}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </OptionGroup>
          <OptionGroup label={t('immersivePlayer.settings.pauseGap')}>
            <SegmentedOptions
              value={settings.pauseGapSeconds}
              options={IMMERSIVE_PAUSE_GAP_SECONDS.map((value) => ({ value, label: t('immersivePlayer.settings.seconds', { count: value }) }))}
              onChange={(value) => onChange({ pauseGapSeconds: value })}
            />
          </OptionGroup>
          <OptionGroup label={t('immersivePlayer.settings.playbackContent')}>
            <div className="overflow-hidden rounded-md bg-muted/35">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-foreground">{t('immersivePlayer.settings.accent')}</span>
                <ToggleGroup
                  type="single"
                  value={settings.accent}
                  onValueChange={(value) => {
                    if (!value) return
                    onChange({ accent: value as ImmersivePlaybackSettings['accent'] })
                  }}
                  aria-label={t('immersivePlayer.settings.accent')}
                  size="sm"
                  className="rounded-full bg-muted p-0.5"
                >
                  <ToggleGroupItem
                    value="us"
                    className="h-6 rounded-full border-0 px-2 text-[11px] text-muted-foreground shadow-none data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                  >
                    {t('immersivePlayer.settings.accentUs')}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="uk"
                    className="h-6 rounded-full border-0 px-2 text-[11px] text-muted-foreground shadow-none data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                  >
                    {t('immersivePlayer.settings.accentUk')}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <SwitchRow
                label={t('immersivePlayer.settings.playExample')}
                checked={settings.playExample}
                onChange={(value) => onChange({ playExample: value })}
              />
            </div>
          </OptionGroup>
          <OptionGroup label={t('immersivePlayer.settings.continuousPlayback')}>
            <div className="overflow-hidden rounded-md bg-muted/35">
              <SwitchRow label={t('immersivePlayer.settings.autoNext')} checked={settings.autoNext} onChange={(value) => onChange({ autoNext: value })} />
              <SwitchRow label={t('immersivePlayer.settings.loopQueue')} checked={settings.loopQueue} onChange={(value) => onChange({ loopQueue: value })} />
            </div>
          </OptionGroup>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function ImmersiveQueueDrawer({
  open,
  onOpenChange,
  items,
  index,
  total,
  onLoadMore,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ImmersivePlayerItem[]
  index: number
  total: number
  onLoadMore?: () => void
  onSelect: (index: number) => void
}) {
  const { t } = useTranslation()
  const loadMoreAfter = insightLoadMoreAfterIndex(items.length)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent showHandle={false} className={cn('h-[100dvh] w-full max-w-full overflow-hidden overscroll-contain rounded-none pt-safe !z-[10001]', isIOS() && 'pb-safe')} overlayClassName="!z-[10001]">
        <div className="flex min-w-0 items-center justify-between gap-3 px-5 pb-2 pt-1">
          <DrawerTitle className="min-w-0 truncate text-lg">{t('immersivePlayer.queueTitle')}</DrawerTitle>
          <button type="button" onClick={() => onOpenChange(false)} aria-label={t('immersivePlayer.close')} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ChevronDown className="size-5" />
          </button>
        </div>
        <ScrollArea className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden px-4 pb-8">
          <div className="w-full max-w-full min-w-0 space-y-1 overflow-hidden">
            {items.map((item, itemIndex) => {
              const meta = TYPE_META[item.kind]
              const Icon = meta.Icon
              const active = itemIndex === index
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(itemIndex)}
                    className={cn(
                      'grid w-full max-w-full min-w-0 touch-manipulation grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 max-w-full overflow-hidden">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      {item.meaning
                        ? <WordMeaningInline meaning={item.meaning} className="mt-0" />
                        : <span className="block truncate text-xs text-muted-foreground">{item.sceneName || t(KIND_LABEL_KEY[item.kind])}</span>}
                    </span>
                    {active ? (
                      <Badge variant="default" className="max-w-[4.5rem] shrink-0 truncate px-1.5 py-0 text-[10px]">{t('immersivePlayer.current')}</Badge>
                    ) : (
                      <span className="w-0" />
                    )}
                  </button>
                  {itemIndex === loadMoreAfter ? (
                    <InsightListLoadMoreSentinel
                      enabled={items.length < total}
                      itemCount={items.length}
                      onLoadMore={onLoadMore}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}

function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </section>
  )
}

function SegmentedOptions<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  const columns = Math.min(Math.max(options.length, 1), 4)
  return (
    <div
      className="grid gap-0.5 rounded-md bg-muted p-0.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'h-9 min-w-0 touch-manipulation rounded-md px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            value === option.value ? 'bg-background text-foreground' : 'text-muted-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}
