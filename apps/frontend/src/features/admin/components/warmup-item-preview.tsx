import { useState } from 'react'
import { Smartphone, RotateCw, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { useCachedImage } from '@/hooks/use-cached-image'

interface WarmupItemPreviewProps {
  /** 题目类型 */
  type: 'chunk_substitution' | 'pattern_drill' | 'vocab_sentence_building' | 'sentence_decomposition'
  /** 核心句块/句型文本 */
  displayText: string
  /** 核心句块/句型含义 */
  displayMeaning?: string
  /** 题目文本（中文提示） */
  promptZh: string
  /** 答案文本（英文答案） */
  answer?: string
  /** 图片 URL */
  imageUrl?: string
  /** 方向 */
  direction?: 'zh_to_en' | 'en_to_zh'
  /** kind */
  kind?: 'chunk' | 'word'
}

const PORTRAIT = { w: 320, h: 568 }
const LANDSCAPE = { w: 568, h: 320 }

/** Warmup pipeline item 手机端预览组件 */
export function WarmupItemPreview({
  type,
  displayText,
  displayMeaning,
  promptZh,
  answer,
  imageUrl,
  direction = 'zh_to_en',
  kind = 'chunk',
}: WarmupItemPreviewProps) {
  const [open, setOpen] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const { resolvedUrl: cachedImageUrl } = useCachedImage(imageUrl)

  const frame = orientation === 'portrait' ? PORTRAIT : LANDSCAPE

  const typeLabel =
    type === 'chunk_substitution'
      ? kind === 'word'
        ? '单词替换'
        : '句块替换'
      : type === 'pattern_drill'
        ? '句型操练'
        : type === 'vocab_sentence_building'
          ? '一词多句'
          : '句子拆解'

  const typeBadge = {
    'chunk_substitution': { bg: 'bg-primary/10', text: 'text-primary' },
    'pattern_drill': { bg: 'bg-violet-500/10', text: 'text-violet-600' },
    'vocab_sentence_building': { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
    'sentence_decomposition': { bg: 'bg-amber-500/10', text: 'text-amber-600' },
  }[type]

  return (
    <>
      {/* Trigger button */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-[11px]"
        onClick={() => setOpen(true)}
      >
        <Eye className="size-3" />
        手机端预览
      </Button>

      {/* Preview Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-fit p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>手机端预览 - {typeLabel}</DialogTitle>
          </DialogHeader>

          {/* Orientation toggle */}
          <div className="flex items-center justify-center gap-2 px-4 pt-4">
            <Button
              size="sm"
              variant={orientation === 'portrait' ? 'default' : 'outline'}
              className="h-7 gap-1 text-[11px]"
              onClick={() => setOrientation('portrait')}
            >
              <Smartphone className="size-3" />
              竖屏
            </Button>
            <Button
              size="sm"
              variant={orientation === 'landscape' ? 'default' : 'outline'}
              className="h-7 gap-1 text-[11px]"
              onClick={() => setOrientation('landscape')}
            >
              <RotateCw className="size-3" />
              横屏
            </Button>
          </div>

          {/* Phone Frame */}
          <div className="flex justify-center px-4 pb-4 pt-2">
            <div
              className="relative overflow-hidden rounded-[24px] border-4 border-slate-800 bg-background shadow-xl"
              style={{ width: frame.w, height: frame.h }}
            >
              {/* Status bar */}
              <div className="flex items-center justify-between bg-slate-900 px-4 py-1.5 text-[9px] text-white">
                <span>9:41</span>
                <span className="flex gap-0.5">
                  <span className="inline-block h-2 w-2 rounded-full border border-white/60" />
                  <span className="inline-block h-2 w-2 rounded-full border border-white/60" />
                  <span className="inline-block h-2 w-2 rounded-full border border-white/60" />
                </span>
              </div>

              {/* Content area */}
              <div
                className="overflow-y-auto p-2.5"
                style={{ height: frame.h - 28 }}
              >
                {type === 'chunk_substitution' || type === 'vocab_sentence_building' ? (
                  <ChunkPreview
                    displayText={displayText}
                    displayMeaning={displayMeaning}
                    promptZh={promptZh}
                    answer={answer}
                    imageUrl={cachedImageUrl}
                    direction={direction}
                    kind={kind}
                    typeLabel={typeLabel}
                    typeBadge={typeBadge}
                    isLandscape={orientation === 'landscape'}
                  />
                ) : type === 'pattern_drill' ? (
                  <PatternPreview
                    pattern={displayText}
                    patternMeaning={displayMeaning}
                    promptZh={promptZh}
                    answer={answer}
                    imageUrl={cachedImageUrl}
                    direction={direction}
                    typeLabel={typeLabel}
                    typeBadge={typeBadge}
                    isLandscape={orientation === 'landscape'}
                  />
                ) : (
                  <DecompositionPreview
                    title={displayText}
                    promptZh={promptZh}
                    isLandscape={orientation === 'landscape'}
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Chunk / VocabSentenceBuilding Preview ──────────────────

function ChunkPreview({
  displayText,
  displayMeaning,
  promptZh,
  answer,
  imageUrl,
  direction,
  kind,
  typeLabel,
  typeBadge,
  isLandscape,
}: {
  displayText: string
  displayMeaning?: string
  promptZh: string
  answer?: string
  imageUrl?: string
  direction: 'zh_to_en' | 'en_to_zh'
  kind: 'chunk' | 'word'
  typeLabel: string
  typeBadge: { bg: string; text: string }
  isLandscape: boolean
}) {
  const isZhToEn = direction === 'zh_to_en'
  const promptLabel = isZhToEn ? '替换成完整英文句子' : '用中文说出'
  const displayPromptLine = isZhToEn ? promptZh : (answer ?? promptZh)

  return (
    <div className={cn(isLandscape ? 'flex gap-3' : 'space-y-2')}>
      {/* Left / top: text content */}
      <div className={cn('space-y-2', isLandscape && 'flex-1 min-w-0')}>
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <Badge className={cn('gap-1 text-[9px] px-1.5 py-0', typeBadge.bg, typeBadge.text)}>
            {typeLabel}
          </Badge>
        </div>

        {/* Chunk display */}
        <div className={cn('rounded-md px-2 py-1.5', typeBadge.bg)}>
          {/* <p className="text-[9px] text-muted-foreground">
            {kind === 'word' ? '必须使用这个词' : '必须使用这个句块'}
          </p> */}
          <p className={cn('text-xs font-bold', typeBadge.text)}>{displayText}</p>
          {displayMeaning && (
            <p className="text-[9px] text-muted-foreground">{displayMeaning}</p>
          )}
        </div>

        {/* Task prompt */}
        <div className="rounded-md bg-muted/30 px-2 py-1.5">
          <p className="text-[9px] text-muted-foreground">{promptLabel}</p>
          <p className="text-xs font-semibold">{displayPromptLine}</p>
        </div>

        {/* Image — portrait: between prompt & input; landscape: below prompt in left col */}
        {imageUrl && !isLandscape && (
          <div className="overflow-hidden rounded-md border border-border/30">
            <img
              src={imageUrl}
              alt="题目配图预览"
              className="h-36 w-full object-contain bg-muted/10"
              loading="lazy"
            />
          </div>
        )}

        {/* Simulated input */}
        <div className="rounded-md border border-border/70 bg-muted/20 px-2 py-2">
          <p className="text-[9px] text-muted-foreground/60">点击输入答案...</p>
        </div>
      </div>

      {/* Image — landscape: right side */}
      {imageUrl && isLandscape && (
        <div className="w-[140px] shrink-0 overflow-hidden rounded-md border border-border/30">
          <img
            src={imageUrl}
            alt="题目配图预览"
            className="h-full min-h-[120px] w-full object-contain bg-muted/10"
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}

// ─── Pattern Drill Preview ──────────────────────────────────

function PatternPreview({
  pattern,
  patternMeaning,
  promptZh,
  answer,
  imageUrl,
  direction,
  typeLabel,
  typeBadge,
  isLandscape,
}: {
  pattern: string
  patternMeaning?: string
  promptZh: string
  answer?: string
  imageUrl?: string
  direction: 'zh_to_en' | 'en_to_zh'
  typeLabel: string
  typeBadge: { bg: string; text: string }
  isLandscape: boolean
}) {
  const isZhToEn = direction === 'zh_to_en'
  const promptLabel = isZhToEn ? '用英文说出' : '用中文说出'
  const displayPromptLine = isZhToEn ? promptZh : (answer ?? promptZh)

  return (
    <div className={cn(isLandscape ? 'flex gap-3' : 'space-y-2')}>
      {/* Left / top: text content */}
      <div className={cn('space-y-2', isLandscape && 'flex-1 min-w-0')}>
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <Badge className={cn('gap-1 text-[9px] px-1.5 py-0', typeBadge.bg, typeBadge.text)}>
            {typeLabel}
          </Badge>
        </div>

        {/* Pattern display */}
        <div className={cn('rounded-md px-2 py-1.5', typeBadge.bg)}>
          <p className="text-[9px] text-muted-foreground">核心句型</p>
          <p className={cn('font-mono text-xs font-bold', typeBadge.text)}>{pattern}</p>
          {patternMeaning && (
            <p className="text-[9px] text-muted-foreground">{patternMeaning}</p>
          )}
        </div>

        {/* Task prompt */}
        <div className="rounded-md bg-muted/30 px-2 py-1.5">
          <p className="text-[9px] text-muted-foreground">{promptLabel}</p>
          <p className="text-xs font-semibold">{displayPromptLine}</p>
        </div>

        {/* Image — portrait: between prompt & input */}
        {imageUrl && !isLandscape && (
          <div className="overflow-hidden rounded-md border border-border/30">
            <img
              src={imageUrl}
              alt="题目配图预览"
              className="h-36 w-full object-contain bg-muted/10"
              loading="lazy"
            />
          </div>
        )}

        {/* Simulated input */}
        <div className="rounded-md border border-border/70 bg-muted/20 px-2 py-2">
          <p className="text-[9px] text-muted-foreground/60">点击输入答案...</p>
        </div>
      </div>

      {/* Image — landscape: right side */}
      {imageUrl && isLandscape && (
        <div className="w-[140px] shrink-0 overflow-hidden rounded-md border border-border/30">
          <img
            src={imageUrl}
            alt="题目配图预览"
            className="h-full min-h-[120px] w-full object-contain bg-muted/10"
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}

// ─── Sentence Decomposition Preview ─────────────────────────

function DecompositionPreview({
  title,
  promptZh,
  isLandscape,
}: {
  title: string
  promptZh: string
  isLandscape: boolean
}) {
  return (
    <div className={cn('space-y-2', isLandscape && 'flex gap-3')}>
      <div className={cn('space-y-2', isLandscape && 'flex-1 min-w-0')}>
        <div className="flex items-center gap-1.5">
          <Badge className="gap-1 bg-amber-500/10 text-amber-600 text-[9px] px-1.5 py-0">
            句子拆解
          </Badge>
        </div>
        <div className="rounded-md bg-amber-500/8 px-2 py-1.5">
          <p className="text-[9px] text-muted-foreground">逐步扩展</p>
          <p className="text-xs font-bold text-amber-600">{title}</p>
          {promptZh && <p className="text-[9px] text-muted-foreground">{promptZh}</p>}
        </div>
        <div className="rounded-md border border-border/70 bg-muted/20 px-2 py-2">
          <p className="text-[9px] text-muted-foreground/60">逐级说出扩展后的句子...</p>
        </div>
      </div>
    </div>
  )
}
