import { useState, useCallback, useEffect, useRef } from 'react'
import { VnScene } from '@/features/vn-engine/vn-scene'
import { DialogueBox } from '@/features/vn-engine/dialogue-box'
import { ChoiceButtons } from '@/features/vn-engine/choice-buttons'
import { InkEngine } from '@/features/vn-engine/ink-engine'
import { Button } from '@/components/ui/button'
import { ChevronRight, RotateCcw, Play, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { compileInk, type CompileResult } from './ink-compiler'

/** 角色立绘数据：expression name → sprite URL */
export type CharacterSpriteMap = Record<string, string>

interface VnStoryPreviewProps {
  /** Ink 源码 */
  inkSource?: string
  /** 预编译的 Ink JSON（优先于 source） */
  inkJson?: Record<string, any>
  /** 角色名 → 表情立绘映射 */
  characterSprites?: Record<string, CharacterSpriteMap>
  /** 角色名 → 立绘位置 */
  characterPositions?: Record<string, 'left' | 'center' | 'right'>
  className?: string
}

interface DialogueLine {
  speaker: string
  text: string
  expression?: string
}

/**
 * Visual Novel 故事预览 — 使用 inkjs Compiler + InkEngine
 * 编译 Ink 源码 → JSON → InkEngine 驱动 → VN 渲染
 */
export function VnStoryPreview({
  inkSource,
  inkJson,
  characterSprites = {},
  characterPositions = {},
  className,
}: VnStoryPreviewProps) {
  const engineRef = useRef<InkEngine | null>(null)
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const [history, setHistory] = useState<DialogueLine[]>([])
  const [choices, setChoices] = useState<{ index: number; text: string }[]>([])
  const [isEnded, setIsEnded] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [currentTags, setCurrentTags] = useState<string[]>([])

  // Compile Ink source
  useEffect(() => {
    if (inkJson) {
      setCompileResult({ success: true, json: inkJson, errors: [], warnings: [], authorMessages: [] })
      return
    }
    if (inkSource) {
      const result = compileInk(inkSource)
      setCompileResult(result)
    } else {
      setCompileResult(null)
    }
  }, [inkSource, inkJson])

  // Initialize engine with compiled JSON
  useEffect(() => {
    engineRef.current?.destroy()
    engineRef.current = null
    setIsReady(false)
    setHistory([])
    setChoices([])
    setIsEnded(false)
    setIsWaiting(false)

    if (!compileResult?.success || !compileResult.json) return

    try {
      const engine = new InkEngine()
      engine.load(compileResult.json)
      engineRef.current = engine

      const result = engine.continue()
      if (result) {
        if (result.hasChoices) setChoices(result.choices)
        const tags = engine.getCurrentTags()
        setCurrentTags(tags)
        checkWaitTag(tags)
      } else {
        setIsEnded(true)
      }
      setIsReady(true)
    } catch (err) {
      console.warn('[VnPreview] Init failed:', err)
    }
  }, [compileResult])

  const checkWaitTag = useCallback((tags: string[]) => {
    if (tags.includes('wait') || tags.includes('user_input')) {
      setIsWaiting(true)
    }
  }, [])

  /** 从 tags 中提取 speaker/expression/bg */
  const parseTags = useCallback((tags: string[]) => {
    const speaker = tags.find((t) => t.startsWith('speaker:'))?.replace('speaker:', '').trim()
    const expression = tags.find((t) => t.startsWith('expression:'))?.replace('expression:', '').trim()
    const bg = tags.find((t) => t.startsWith('bg:'))?.replace('bg:', '').trim()
    return { speaker, expression, bg }
  }, [])

  /** 解析文本行，提取 "Speaker: text" 格式 */
  const parseTextLines = useCallback((text: string, fallbackSpeaker?: string, fallbackExpression?: string): DialogueLine[] => {
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([A-Za-z\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff\s]{0,20}):\s*(.+)/)
        if (match) {
          return { speaker: match[1], text: match[2], expression: fallbackExpression }
        }
        return { speaker: fallbackSpeaker || '', text: line, expression: fallbackExpression }
      })
  }, [])

  const advanceStory = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return

    const result = engine.continue()
    if (!result) { setIsEnded(true); return }

    const tags = engine.getCurrentTags()
    setCurrentTags(tags)
    checkWaitTag(tags)
    const { speaker, expression } = parseTags(tags)

    if (result.text) {
      const lines = parseTextLines(result.text, speaker, expression)
      setHistory((prev) => [...prev, ...lines])
    }

    if (result.hasChoices) setChoices(result.choices)
    else setChoices([])

    if (!engine.canContinue && result.choices.length === 0) setIsEnded(true)
  }, [checkWaitTag, parseTags, parseTextLines])

  const handleChoice = useCallback((choiceIndex: number) => {
    const engine = engineRef.current
    if (!engine) return

    setHistory((prev) => [...prev, { speaker: 'You', text: choices[choiceIndex]?.text || '(selected)' }])
    engine.choose(choiceIndex)
    setChoices([])
    setIsWaiting(false)

    const result = engine.continue()
    if (!result) { setIsEnded(true); return }

    const tags = engine.getCurrentTags()
    setCurrentTags(tags)
    checkWaitTag(tags)
    const { speaker, expression } = parseTags(tags)

    if (result.text) {
      const lines = parseTextLines(result.text, speaker, expression)
      setHistory((prev) => [...prev, ...lines])
    }
  }, [choices, checkWaitTag, parseTags, parseTextLines])

  const resetPreview = useCallback(() => {
    if (!compileResult?.json) return
    engineRef.current?.destroy()
    engineRef.current = null
    setHistory([])
    setChoices([])
    setIsEnded(false)
    setIsWaiting(false)

    try {
      const engine = new InkEngine()
      engine.load(compileResult.json)
      engineRef.current = engine
      const result = engine.continue()
      if (result) {
        if (result.hasChoices) setChoices(result.choices)
        const tags = engine.getCurrentTags()
        setCurrentTags(tags)
        checkWaitTag(tags)
      }
      setIsReady(true)
    } catch { /* ignore */ }
  }, [compileResult, checkWaitTag])

  // ─── Derive display state ──────────────────────────────────

  const { speaker: currentSpeaker, expression: currentExpression, bg: currentBg } = parseTags(currentTags)

  const speakerSprites = currentSpeaker ? characterSprites[currentSpeaker] : undefined
  const currentSpriteUrl = currentExpression
    ? speakerSprites?.[currentExpression] || speakerSprites?.['default']
    : speakerSprites?.['default']
  const speakerPosition = currentSpeaker
    ? characterPositions[currentSpeaker] || 'left'
    : 'left'

  const lastLine = history[history.length - 1]

  // ─── Render ────────────────────────────────────────────────

  if (compileResult && !compileResult.success) {
    return (
      <div className={cn('flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4', className)}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">Ink 编译错误</span>
        </div>
        {compileResult.errors.map((err, i) => (
          <p key={i} className="text-xs text-destructive/80 font-mono whitespace-pre-wrap">{err}</p>
        ))}
      </div>
    )
  }

  if (!isReady && !compileResult) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/20 p-12', className)}>
        <Play className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">编写 Ink 脚本后，编译预览效果</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <VnScene backgroundUrl={currentBg} className="min-h-[350px]">
        {/* Character sprite */}
        {currentSpriteUrl && (
          <div
            className={cn(
              'absolute bottom-0 z-10 transition-all duration-500 ease-in-out',
              speakerPosition === 'left' && 'left-8',
              speakerPosition === 'center' && 'left-1/2 -translate-x-1/2',
              speakerPosition === 'right' && 'right-8',
            )}
            style={{ maxHeight: '70%' }}
          >
            <img
              src={currentSpriteUrl}
              alt={currentSpeaker}
              className="max-h-[280px] w-auto object-contain drop-shadow-2xl"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            {currentExpression && currentExpression !== 'default' && (
              <div className="absolute -top-2 right-0 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] text-primary-foreground">
                {currentExpression}
              </div>
            )}
          </div>
        )}

        {/* History (dimmed) */}
        <div className="mb-auto space-y-1">
          {history.slice(-3, -1).map((line, i) => (
            <DialogueBox key={i} speaker={line.speaker || undefined} text={line.text} isCurrent={false} />
          ))}
        </div>

        {/* Current line */}
        {lastLine && !isEnded && choices.length === 0 && (
          <DialogueBox speaker={lastLine.speaker || undefined} text={lastLine.text} isCurrent={true} />
        )}

        {/* Choices */}
        {choices.length > 0 && <ChoiceButtons choices={choices} onSelect={handleChoice} />}

        {/* Continue */}
        {!isEnded && choices.length === 0 && !isWaiting && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={advanceStory} className="gap-1 text-xs text-muted-foreground hover:text-foreground">
              继续 <ChevronRight className="size-3" />
            </Button>
          </div>
        )}

        {/* Wait */}
        {isWaiting && (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="inline-block size-2 animate-pulse rounded-full bg-primary/60" />
            <span className="text-xs text-muted-foreground">等待用户输入...</span>
            <Button variant="ghost" size="sm" onClick={advanceStory} className="text-xs">跳过</Button>
          </div>
        )}

        {/* End */}
        {isEnded && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm font-medium text-muted-foreground">— 故事结束 —</p>
            <Button variant="outline" size="sm" onClick={resetPreview} className="gap-1.5">
              <RotateCcw className="size-3.5" />重新播放
            </Button>
          </div>
        )}
      </VnScene>

      {/* Status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {currentSpeaker && <><code className="rounded bg-muted px-1 py-0.5 font-mono">{currentSpeaker}</code> · </>}
          {currentExpression && <>表情: <code className="rounded bg-muted px-1 py-0.5 font-mono">{currentExpression}</code></>}
        </span>
        <Button variant="ghost" size="sm" onClick={resetPreview} className="h-7 gap-1 text-xs">
          <RotateCcw className="size-3" />重置
        </Button>
      </div>
    </div>
  )
}
