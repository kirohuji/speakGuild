import type { ReactNode } from 'react'
import { Infinity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/cn'

/** 逐句播放的循环次数：1 次 / 2 次 / 无限循环 */
export type LoopMode = '1' | '2' | 'infinite'

/** 字幕显示模式：原文 / 译文 / 双语 / 不显示 */
export type DisplayMode = 'original' | 'translation' | 'bilingual' | 'none'

const gapOptions = [
  { value: 0.5, label: '0.5s' },
  { value: 1, label: '1s' },
  { value: 2, label: '2s' },
  { value: 3, label: '3s' },
] as const

const loopOptions: Array<{ value: LoopMode; labelKey: string }> = [
  { value: '1', labelKey: 'audio.loopTimes1' },
  { value: '2', labelKey: 'audio.loopTimes2' },
  { value: 'infinite', labelKey: 'audio.loopInfinite' },
]

const displayModeOptions: Array<{ value: DisplayMode; labelKey: string }> = [
  { value: 'original', labelKey: 'audio.displayOriginal' },
  { value: 'translation', labelKey: 'audio.displayTranslation' },
  { value: 'bilingual', labelKey: 'audio.displayBilingual' },
  { value: 'none', labelKey: 'audio.displayNone' },
]

/**
 * 逐句播放设置弹窗（句间间隔 + 循环次数）。
 *
 * 由剧本播放器（跟读剧场）抽出的公共组件，听力播放页等逐句播放场景复用。
 * 传入 displayMode 相关 props 时，额外展示字幕显示模式区块（听力播放页使用）。
 */
export function MixedPlaybackSettingsDialog({
  open,
  onOpenChange,
  gapSeconds,
  onGapSecondsChange,
  loopMode,
  onLoopModeChange,
  displayMode,
  onDisplayModeChange,
  showCurrentTranslation,
  onShowCurrentTranslationChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  gapSeconds: number
  onGapSecondsChange: (value: number) => void
  loopMode: LoopMode
  onLoopModeChange: (value: LoopMode) => void
  /** 可选：字幕显示模式（原文/译文/双语/不显示） */
  displayMode?: DisplayMode
  onDisplayModeChange?: (value: DisplayMode) => void
  /** 可选：原文模式下，当前播放/选择句下方是否显示译文 */
  showCurrentTranslation?: boolean
  onShowCurrentTranslationChange?: (checked: boolean) => void
}) {
  const { t } = useTranslation()
  const showDisplaySection = displayMode !== undefined && onDisplayModeChange

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Above fullscreen practice-record replay (z-70/71) and similar shells.
        overlayClassName="z-[80]"
        className="z-[81] w-[90vw] max-w-sm gap-0 overflow-hidden rounded-2xl border-0 p-0"
      >
        <DialogHeader className="px-4 pb-2 pt-4 text-left">
          <DialogTitle className="text-sm font-semibold">{t('audio.playbackSettings')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 px-4 pb-4">
          <SettingsSection
            title={t('audio.gapBetween')}
            meta={t('audio.secondsValue', { seconds: gapSeconds.toFixed(1) })}
          >
            <ToggleGroup
              type="single"
              value={String(gapSeconds)}
              onValueChange={(value) => {
                if (!value) return
                onGapSecondsChange(Number(value))
              }}
              className="grid w-full grid-cols-4 gap-0.5 rounded-md bg-muted/70 p-0.5"
            >
              {gapOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={String(option.value)}
                  aria-label={t('audio.secondsValue', { seconds: option.value.toFixed(1) })}
                  className={segmentItemClassName}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SettingsSection>

          <SettingsSection title={t('audio.loopCount')}>
            <ToggleGroup
              type="single"
              value={loopMode}
              onValueChange={(value) => {
                if (!value) return
                onLoopModeChange(value as LoopMode)
              }}
              className="grid w-full grid-cols-3 gap-0.5 rounded-md bg-muted/70 p-0.5"
            >
              {loopOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className={segmentItemClassName}
                >
                  {option.value === 'infinite' ? <Infinity /> : null}
                  {t(option.labelKey)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SettingsSection>

          {showDisplaySection && (
            <SettingsSection title={t('audio.displayMode')}>
              <ToggleGroup
                type="single"
                value={displayMode}
                onValueChange={(value) => {
                  if (!value) return
                  onDisplayModeChange(value as DisplayMode)
                }}
                className="grid w-full grid-cols-4 gap-0.5 rounded-md bg-muted/70 p-0.5"
              >
                {displayModeOptions.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className={segmentItemClassName}
                  >
                    {t(option.labelKey)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              {displayMode === 'original' && showCurrentTranslation !== undefined && onShowCurrentTranslationChange ? (
                <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                  <Label htmlFor="show-current-translation" className="cursor-pointer text-xs font-medium text-foreground">
                    {t('audio.showCurrentTranslation')}
                  </Label>
                  <Switch
                    id="show-current-translation"
                    checked={showCurrentTranslation}
                    onCheckedChange={onShowCurrentTranslationChange}
                  />
                </div>
              ) : null}
            </SettingsSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const segmentItemClassName = cn(
  'h-9 min-w-0 flex-1 touch-manipulation rounded-md border-0 bg-transparent px-1 text-[11px] font-medium text-muted-foreground shadow-none',
  'hover:bg-transparent hover:text-foreground',
  'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm',
)

function SettingsSection({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{title}</p>
        {meta ? <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{meta}</span> : null}
      </div>
      {children}
    </section>
  )
}
