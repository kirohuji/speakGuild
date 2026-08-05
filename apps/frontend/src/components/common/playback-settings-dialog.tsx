import { Infinity } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
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

const loopOptions: Array<{ value: LoopMode; label: string }> = [
  { value: '1', label: '1次' },
  { value: '2', label: '2次' },
  { value: 'infinite', label: '循环' },
]

const displayModeOptions: Array<{ value: DisplayMode; label: string }> = [
  { value: 'original', label: '原文' },
  { value: 'translation', label: '译文' },
  { value: 'bilingual', label: '双语' },
  { value: 'none', label: '不显示' },
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>播放设置</DialogTitle>
          <DialogDescription>控制逐句原声播放的间隔与循环次数。</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">句间间隔</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{gapSeconds.toFixed(1)} 秒</span>
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-0.5">
              {gapOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onGapSecondsChange(option.value)}
                  className={cn(
                    'rounded-md py-2 text-xs font-medium transition-colors',
                    gapSeconds === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">循环次数</Label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5">
              {loopOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onLoopModeChange(option.value)}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-md py-2 text-xs font-medium transition-colors',
                    loopMode === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.value === 'infinite' && <Infinity className="size-3" />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {displayMode !== undefined && onDisplayModeChange && (
            <>
              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">显示模式</Label>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-0.5">
                  {displayModeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onDisplayModeChange(option.value)}
                      className={cn(
                        'rounded-md py-2 text-xs font-medium transition-colors',
                        displayMode === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {displayMode === 'original' && showCurrentTranslation !== undefined && onShowCurrentTranslationChange && (
                  <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted/60">
                    <Label className="cursor-pointer text-sm font-normal">当前句显示译文</Label>
                    <Switch checked={showCurrentTranslation} onCheckedChange={onShowCurrentTranslationChange} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
