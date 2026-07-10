import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  ListMusic,
  Loader2,
  MessageSquareText,
  Pause,
  Play,
  Settings2,
  Sparkles,
  Timer,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
import { buildPlaybackSegments } from './immersive-player.mapper'
import { immersivePlaybackService } from './immersive-playback.service'
import { useImmersivePlayerPreferences } from './immersive-player.store'
import type { ImmersivePlaybackSettings, ImmersivePlayerItem, ImmersivePlayerStatus, PlaybackSegmentRole } from './immersive-player.types'

type ImmersivePlayerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ImmersivePlayerItem[]
  index: number
  onIndexChange: (index: number) => void
}

const TYPE_META = {
  word: { label: '单词', Icon: BookOpen, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-300' },
  chunk: { label: '句块', Icon: Layers, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  pattern: { label: '句型', Icon: Sparkles, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-300' },
} satisfies Record<ImmersivePlayerItem['kind'], { label: string; Icon: typeof BookOpen; tone: string }>

const SEGMENT_LABEL: Record<PlaybackSegmentRole, string> = {
  main: '原文',
  meaning: '释义',
  example: '例句',
  exampleTranslation: '例句译文',
}

export function ImmersivePlayerDialog({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
}: ImmersivePlayerDialogProps) {
  const settings = useImmersivePlayerPreferences((s) => s.settings)
  const updateSettings = useImmersivePlayerPreferences((s) => s.updateSettings)
  const current = items[index] ?? null
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [status, setStatus] = useState<ImmersivePlayerStatus>('idle')
  const [segmentRole, setSegmentRole] = useState<PlaybackSegmentRole | null>(null)
  const runRef = useRef(0)
  const sleepTimerRef = useRef<number | null>(null)

  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  const gotoPrev = useCallback(() => {
    if (hasPrev) onIndexChange(index - 1)
  }, [hasPrev, index, onIndexChange])

  const gotoNext = useCallback(() => {
    if (hasNext) onIndexChange(index + 1)
    else if (settings.loopQueue && items.length > 0) onIndexChange(0)
  }, [hasNext, index, items.length, onIndexChange, settings.loopQueue])

  const stopPlayback = useCallback(async (nextStatus: ImmersivePlayerStatus = 'idle') => {
    runRef.current += 1
    setStatus(nextStatus)
    setSegmentRole(null)
    await immersivePlaybackService.stopCurrent()
  }, [])

  const playFromCurrent = useCallback(async () => {
    if (!current) return
    const runId = runRef.current + 1
    runRef.current = runId
    setStatus('loading')

    const segments = buildPlaybackSegments(current, settings)
    if (segments.length === 0) {
      setStatus('idle')
      toast.warning('当前内容没有可播放的片段')
      return
    }

    try {
      for (const segment of segments) {
        if (runRef.current !== runId) return
        setSegmentRole(segment.role)
        setStatus('loading')
        await immersivePlaybackService.playSegment(
          segment,
          settings.playbackRate,
          (event) => {
            if (event.reason === 'remotePlay') setStatus('playing')
            if (event.reason === 'remotePause') setStatus('paused')
          },
          () => setStatus('playing'),
        )
        if (runRef.current !== runId) return
        setStatus('playing')
      }

      if (runRef.current !== runId) return
      setSegmentRole(null)
      if (settings.autoNext && (hasNext || settings.loopQueue)) {
        gotoNext()
      } else {
        setStatus('ended')
      }
    } catch (error) {
      console.warn('[immersive-player] playback failed', error)
      if (runRef.current === runId) {
        setStatus('error')
        toast.error('播放失败，已跳过当前片段')
      }
    }
  }, [current, gotoNext, hasNext, settings])

  const togglePlay = useCallback(async () => {
    if (status === 'playing') {
      setStatus('paused')
      await immersivePlaybackService.pause()
      return
    }
    if (status === 'paused') {
      setStatus('playing')
      await immersivePlaybackService.resume()
      return
    }
    await playFromCurrent()
  }, [playFromCurrent, status])

  useEffect(() => {
    if (!open) {
      void stopPlayback()
      return
    }
    void immersivePlaybackService.registerMediaActions({
      play: () => { void togglePlay() },
      pause: () => { void togglePlay() },
      previoustrack: gotoPrev,
      nexttrack: gotoNext,
      stop: () => { void stopPlayback() },
    })
    return () => {
      void immersivePlaybackService.registerMediaActions({
        play: undefined,
        pause: undefined,
        previoustrack: undefined,
        nexttrack: undefined,
        stop: undefined,
      })
    }
  }, [gotoNext, gotoPrev, open, stopPlayback, togglePlay])

  useEffect(() => {
    if (!open) return
    void stopPlayback('idle')
  }, [index, open, stopPlayback])

  useEffect(() => {
    if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current)
    sleepTimerRef.current = null
    if (!open || settings.sleepTimerMinutes === 0 || status !== 'playing') return
    sleepTimerRef.current = window.setTimeout(() => {
      void stopPlayback('ended')
      onOpenChange(false)
    }, settings.sleepTimerMinutes * 60 * 1000)
    return () => {
      if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current)
      sleepTimerRef.current = null
    }
  }, [onOpenChange, open, settings.sleepTimerMinutes, status, stopPlayback])

  if (!current) return null

  const meta = TYPE_META[current.kind]
  const Icon = meta.Icon
  const hiddenText = !settings.textVisible

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-keyboard-overlay="practice"
          className="left-0 top-0 !z-[10000] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 pt-safe md:left-[50%] md:top-[50%] md:h-[88vh] md:max-w-3xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl md:pt-0 [&>button]:hidden"
        >
          <DialogTitle className="sr-only">{current.title}</DialogTitle>
          <DialogDescription className="sr-only">{current.meaning || current.sceneName || '沉浸式学习播放器'}</DialogDescription>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-9 md:px-6">
              <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3">
                <div className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl', meta.tone)}>
                  <Icon className="size-[18px]" />
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary" className="shrink-0">{meta.label}</Badge>
                      {segmentRole && <Badge variant="outline" className="shrink-0 text-[10px]">{SEGMENT_LABEL[segmentRole]}</Badge>}
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
                        className="flex size-8 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        aria-label="播放设置"
                      >
                        <Settings2 className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="flex size-8 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        aria-label="关闭"
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
                      {settings.textVisible ? current.title : '文案已隐藏'}
                    </h2>
                    {settings.textVisible && (
                      <p className="mt-1 line-clamp-1 break-words text-sm leading-relaxed text-muted-foreground">
                        {current.sceneName || `${index + 1} / ${items.length}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-6">
              <div className={cn('mx-auto flex min-h-full max-w-xl flex-col gap-5', hiddenText ? 'items-center justify-center' : 'pt-8 md:pt-10')}>
                {!hiddenText && (
                <div className="text-center">
                  <p className="text-xs tabular-nums text-muted-foreground">{index + 1} / {items.length}</p>
                  {current.meaning && (
                    <p className="mx-auto mt-5 max-w-md break-words text-2xl font-bold leading-snug text-foreground">{current.meaning}</p>
                  )}
                </div>
                )}

                {!hiddenText && current.insight && (
                  <section className="rounded-lg border border-border/70 bg-muted/25 px-4 py-3">
                    <p className="text-sm leading-6 text-muted-foreground">{current.insight}</p>
                  </section>
                )}

                {!hiddenText && current.exampleEn && (
                  <section className="rounded-lg bg-muted/45 px-4 py-4">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                      <MessageSquareText className="size-3.5" /> 例句
                    </div>
                    <p className="text-base font-medium leading-7 text-foreground">{current.exampleEn}</p>
                    {!hiddenText && current.exampleZh && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{current.exampleZh}</p>
                    )}
                  </section>
                )}
              </div>
            </div>

            <div className={cn('grid shrink-0 grid-cols-[3.5rem_1fr_3.5rem] items-center gap-3 border-t border-border/60 bg-muted/10 px-5 py-4', isIOS() && 'pb-safe')}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => updateSettings({ textVisible: !settings.textVisible })}
                aria-label={settings.textVisible ? '隐藏文案' : '显示文案'}
                className="size-11 rounded-full justify-self-start"
              >
                {settings.textVisible ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
              </Button>

              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" size="icon" onClick={gotoPrev} disabled={!hasPrev} className="size-11 rounded-full">
                  <ChevronLeft className="size-5" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={togglePlay}
                  className="size-12 rounded-full shadow-sm"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? <Loader2 className="size-5 animate-spin" /> : status === 'playing' ? <Pause className="size-5" /> : <Play className="size-5" />}
                </Button>
                <Button variant="outline" size="icon" onClick={gotoNext} disabled={!hasNext && !settings.loopQueue} className="size-11 rounded-full">
                  <ChevronRight className="size-5" />
                </Button>
              </div>

              <Button variant="ghost" size="icon" onClick={() => setQueueOpen(true)} aria-label="播放队列" className="size-11 rounded-full justify-self-end">
                <ListMusic className="size-5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImmersiveSettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={updateSettings} />
      <ImmersiveQueueDrawer
        open={queueOpen}
        onOpenChange={setQueueOpen}
        items={items}
        index={index}
        onSelect={(nextIndex) => {
          onIndexChange(nextIndex)
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
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh] rounded-t-2xl pt-safe !z-[10001]" overlayClassName="!z-[10001]">
        <div className="flex items-center justify-between px-5 py-3">
          <DrawerTitle className="text-base">播放设置</DrawerTitle>
          <button type="button" onClick={() => onOpenChange(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>
        <ScrollArea className="min-h-0 flex-1 px-5 pb-8">
          <div className="space-y-5 py-2">
            <OptionGroup label="定时关闭">
              <SegmentedOptions
                value={settings.sleepTimerMinutes}
                options={[0, 15, 30, 60].map((value) => ({ value, label: value === 0 ? '关闭' : `${value}m` }))}
                onChange={(value) => onChange({ sleepTimerMinutes: value as ImmersivePlaybackSettings['sleepTimerMinutes'] })}
              />
            </OptionGroup>
            <OptionGroup label="单条播放次数">
              <SegmentedOptions
                value={settings.repeatPerItem}
                options={[1, 2, 3, 5].map((value) => ({ value, label: `${value}次` }))}
                onChange={(value) => onChange({ repeatPerItem: value as ImmersivePlaybackSettings['repeatPerItem'] })}
              />
            </OptionGroup>
            <OptionGroup label="播放倍速">
              <SegmentedOptions
                value={settings.playbackRate}
                options={[0.75, 1, 1.25, 1.5].map((value) => ({ value, label: `${value}x` }))}
                onChange={(value) => onChange({ playbackRate: value as ImmersivePlaybackSettings['playbackRate'] })}
              />
            </OptionGroup>
            <SwitchRow label="播放原文" checked={settings.playMainText} onChange={(value) => onChange({ playMainText: value })} />
            <SwitchRow label="播放译文" checked={settings.playMeaning} onChange={(value) => onChange({ playMeaning: value })} />
            <SwitchRow label="播放例句" checked={settings.playExample} onChange={(value) => onChange({ playExample: value })} />
            <SwitchRow label="播放例句译文" checked={settings.playExampleTranslation} onChange={(value) => onChange({ playExampleTranslation: value })} />
            <SwitchRow label="自动下一条" checked={settings.autoNext} onChange={(value) => onChange({ autoNext: value })} />
            <SwitchRow label="循环队列" checked={settings.loopQueue} onChange={(value) => onChange({ loopQueue: value })} />
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}

function ImmersiveQueueDrawer({
  open,
  onOpenChange,
  items,
  index,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ImmersivePlayerItem[]
  index: number
  onSelect: (index: number) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[100dvh] rounded-none pt-safe !z-[10001]" overlayClassName="!z-[10001]">
        <div className="flex items-center justify-between px-5 py-3">
          <DrawerTitle className="text-lg">播放队列</DrawerTitle>
          <button type="button" onClick={() => onOpenChange(false)} className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ChevronDown className="size-5" />
          </button>
        </div>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-8">
          <div className="space-y-1">
            {items.map((item, itemIndex) => {
              const meta = TYPE_META[item.kind]
              const Icon = meta.Icon
              const active = itemIndex === index
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(itemIndex)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors', active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted')}
                >
                  <Icon className="size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.meaning || item.sceneName || meta.label}</p>
                  </div>
                  {active && <Badge variant="default" className="px-1.5 py-0 text-[10px]">当前</Badge>}
                </button>
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
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
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
  return (
    <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn('h-8 rounded-md text-xs font-medium transition-colors', value === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/35 px-3 py-2.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
