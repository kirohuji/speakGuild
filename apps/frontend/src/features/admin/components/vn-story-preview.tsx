import { useState, useCallback, useEffect, useRef } from 'react'
import { InkEngine } from '@/features/vn-engine/ink-engine'
import { VnPlayer } from '@/features/vn-engine/vn-player'
import { Play, AlertTriangle } from 'lucide-react'
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
  defaultBackgroundUrl?: string
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
  defaultBackgroundUrl,
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
        const match = line.match(/^([^:：]{1,32})[:：]\s*(.+)/)
        if (match) {
          return { speaker: match[1], text: match[2], expression: fallbackExpression }
        }
        return { speaker: fallbackSpeaker || '', text: line, expression: fallbackExpression }
      })
  }, [])

  const appendResult = useCallback((engine: InkEngine, result: NonNullable<ReturnType<InkEngine['continue']>>) => {
    const tags = engine.getCurrentTags()
    const waiting = tags.includes('wait') || tags.includes('user_input')
    setCurrentTags(tags)
    setIsWaiting(waiting)
    const { speaker, expression } = parseTags(tags)

    if (result.text) {
      const lines = parseTextLines(result.text, speaker, expression)
      setHistory((prev) => [...prev, ...lines])
    }

    if (result.hasChoices) setChoices(result.choices)
    else setChoices([])

    if (!waiting && !engine.canContinue && result.choices.length === 0) setIsEnded(true)
  }, [parseTags, parseTextLines])

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
        appendResult(engine, result)
      } else {
        setIsEnded(true)
      }
      setIsReady(true)
    } catch (err) {
      console.warn('[VnPreview] Init failed:', err)
    }
  }, [appendResult, compileResult])

  const advanceStory = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return

    const result = engine.continue()
    if (!result) { setIsEnded(true); return }

    appendResult(engine, result)
  }, [appendResult])

  const handleChoice = useCallback((choiceIndex: number) => {
    const engine = engineRef.current
    if (!engine) return

    const selectedChoice = choices.find((choice) => choice.index === choiceIndex)
    setHistory((prev) => [...prev, { speaker: 'You', text: selectedChoice?.text || '(selected)' }])
    engine.choose(choiceIndex)
    setChoices([])
    setIsWaiting(false)

    const result = engine.continue()
    if (!result) { setIsEnded(true); return }

    appendResult(engine, result)
  }, [appendResult, choices])

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
        appendResult(engine, result)
      }
      setIsReady(true)
    } catch { /* ignore */ }
  }, [appendResult, compileResult])

  // ─── Derive display state ──────────────────────────────────

  const { speaker: currentSpeaker, expression: currentExpression, bg: currentBg } = parseTags(currentTags)
  const backgroundUrl = currentBg || defaultBackgroundUrl

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
    <VnPlayer
      className={className}
      backgroundUrl={backgroundUrl}
      currentLine={!isEnded ? lastLine : null}
      history={history}
      choices={choices}
      currentSpriteUrl={currentSpriteUrl}
      spriteAlt={currentSpeaker}
      spritePosition={speakerPosition}
      isWaiting={isWaiting}
      isEnded={isEnded}
      onAdvance={advanceStory}
      onChoice={handleChoice}
      onReset={resetPreview}
    />
  )
}
