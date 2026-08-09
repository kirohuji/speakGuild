import { useState, useId } from 'react'
import { Smartphone, RotateCw, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChunkOutputDrillCard } from '@/features/practice/components/chunk-output-drill-card'
import { PatternDrillCard } from '@/features/practice/components/pattern-drill-card'
import { SentenceDecompositionCard } from '@/features/practice/components/sentence-decomposition-card'

interface PreviewLevel {
  level: number
  label: string
  en: string
  zh: string
  highlight?: string
  hint?: string
  audioUrl?: string
  audioAssetId?: string
}

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
  /** 教学提示 */
  hint?: string
  /** 图片 URL */
  imageUrl?: string
  /** 方向 */
  direction?: 'zh_to_en' | 'en_to_zh'
  /** kind */
  kind?: 'chunk' | 'word'
  /** 句子拆解专用：卡片标题 */
  title?: string
  /** 句子拆解专用：扩展层级 */
  levels?: PreviewLevel[]
}

const PORTRAIT = { w: 375, h: 667 }
const LANDSCAPE = { w: 667, h: 375 }

const TYPE_LABEL: Record<WarmupItemPreviewProps['type'], string> = {
  chunk_substitution: '句块替换',
  pattern_drill: '句型操练',
  vocab_sentence_building: '一词多句',
  sentence_decomposition: '句子拆解',
}

/** Warmup pipeline item 手机端预览组件 — 直接复用移动端练习卡片 */
export function WarmupItemPreview({
  type,
  displayText,
  displayMeaning,
  promptZh,
  answer,
  hint,
  imageUrl,
  direction = 'zh_to_en',
  kind = 'chunk',
  title,
  levels = [],
}: WarmupItemPreviewProps) {
  const [open, setOpen] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  // 每个预览实例独立 stepId，避免与真实练习的会话状态相互污染
  const stepId = useId()

  const frame = orientation === 'portrait' ? PORTRAIT : LANDSCAPE

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
            <DialogTitle>手机端预览 - {TYPE_LABEL[type]}</DialogTitle>
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

              {/* Content area — 移动端真实练习卡片 */}
              <div
                className="overflow-y-auto p-3"
                style={{ height: frame.h - 28 }}
              >
                {type === 'chunk_substitution' || type === 'vocab_sentence_building' ? (
                  <ChunkOutputDrillCard
                    chunk={{ text: displayText, meaning: displayMeaning || '', description: null }}
                    items={[{ zh: promptZh, answer, hint, imageUrl }]}
                    stepId={stepId}
                    stepType={type}
                    direction={direction}
                    kind={type === 'vocab_sentence_building' ? 'word' : kind}
                    groupTitle={displayText}
                  />
                ) : type === 'pattern_drill' ? (
                  <PatternDrillCard
                    pattern={displayText}
                    patternMeaning={displayMeaning}
                    items={[{ zh: promptZh, answer, hint, imageUrl }]}
                    stepId={stepId}
                    direction={direction}
                    groupTitle={displayText}
                  />
                ) : (
                  <SentenceDecompositionCard
                    title={title || '句子拆解'}
                    levels={levels}
                    stepId={stepId}
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
