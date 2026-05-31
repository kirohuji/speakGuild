import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { InkEngine } from '@/features/vn-engine/ink-engine'
import { VnPlayer } from '@/features/vn-engine/vn-player'
import { Play, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  /** 角色名 → 头像 URL */
  characterAvatars?: Record<string, string>
  /** 角色名 → 立绘位置 */
  characterPositions?: Record<string, 'left' | 'center' | 'right'>
  defaultBackgroundUrl?: string
  className?: string
  onDebugChange?: (state: {
    isReady: boolean
    isWaiting: boolean
    isEnded: boolean
    currentTags: string[]
    history: DialogueLine[]
    choices: { index: number; text: string }[]
    activeBackground: { url?: string; fit?: string }
    aiPayload: Record<string, any>
  }) => void
}

interface DialogueLine {
  speaker: string
  text: string
  expression?: string
  audioUrl?: string
}

/**
 * Visual Novel 故事预览 — 使用 inkjs Compiler + InkEngine
 * 编译 Ink 源码 → JSON → InkEngine 驱动 → VN 渲染
 */
export function VnStoryPreview({
  inkSource,
  inkJson,
  characterSprites = {},
  characterAvatars = {},
  characterPositions = {},
  defaultBackgroundUrl,
  className,
  onDebugChange,
}: VnStoryPreviewProps) {
  const engineRef = useRef<InkEngine | null>(null)
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const [history, setHistory] = useState<DialogueLine[]>([])
  const [choices, setChoices] = useState<{ index: number; text: string }[]>([])
  const [isEnded, setIsEnded] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [currentTags, setCurrentTags] = useState<string[]>([])
  const [activeBackground, setActiveBackground] = useState<{ url?: string; fit?: string }>({
    url: defaultBackgroundUrl,
    fit: 'cover',
  })
  const [completionOpen, setCompletionOpen] = useState(false)

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
    const decodeTagValue = (value?: string) => {
      if (!value) return value
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    }
    const speaker = tags.find((t) => t.startsWith('speaker:'))?.replace('speaker:', '').trim()
    const expression = tags.find((t) => t.startsWith('expression:'))?.replace('expression:', '').trim()
    const bg = decodeTagValue(tags.find((t) => t.startsWith('bg:'))?.replace('bg:', '').trim())
    const bgFit = tags.find((t) => t.startsWith('bgFit:'))?.replace('bgFit:', '').trim()
    const position = tags.find((t) => t.startsWith('position:'))?.replace('position:', '').trim()
    const choiceCharacter = tags.find((t) => t.startsWith('choiceCharacter:'))?.replace('choiceCharacter:', '').trim()
    const audioUrl = decodeTagValue(tags.find((t) => t.startsWith('audio:'))?.replace('audio:', '').trim())
    return { speaker, expression, bg, bgFit, position, choiceCharacter, audioUrl }
  }, [])

  /** 解析文本行，提取 "Speaker: text" 格式 */
  const parseTextLines = useCallback((text: string, fallbackSpeaker?: string, fallbackExpression?: string, fallbackAudioUrl?: string): DialogueLine[] => {
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([^:：]{1,32})[:：]\s*(.+)/)
        if (match) {
          return { speaker: match[1], text: match[2], expression: fallbackExpression, audioUrl: fallbackAudioUrl }
        }
        return { speaker: fallbackSpeaker || '', text: line, expression: fallbackExpression, audioUrl: fallbackAudioUrl }
      })
  }, [])

  const appendResult = useCallback((engine: InkEngine, result: NonNullable<ReturnType<InkEngine['continue']>>) => {
    const tags = engine.getCurrentTags()
    const waiting = tags.some((tag) => {
      const normalized = tag.trim()
      return normalized === 'input'
        || normalized === 'user_input'
        || normalized === 'wait:input'
        || normalized === 'wait:user_input'
        || normalized.startsWith('input:')
    })
    setCurrentTags(tags)

    // #input does NOT block inkjs Continue() — text after the tag is also returned.
    // Defer it so the next line doesn't leak before the user has responded.
    if (waiting) {
      setIsWaiting(true)
      return
    }
    setIsWaiting(false)

    const { speaker, expression, bg, bgFit, audioUrl } = parseTags(tags)
    if (bg || bgFit) {
      setActiveBackground((prev) => ({
        url: bg || prev.url,
        fit: bgFit || prev.fit || 'cover',
      }))
    }

    if (result.text) {
      const lines = parseTextLines(result.text, speaker, expression, audioUrl)
      if (audioUrl) console.log('[VnPreview] Line with audio:', result.text.slice(0, 50), 'url:', audioUrl.slice(0, 80))
      setHistory((prev) => [...prev, ...lines])
    }

    if (result.hasChoices) setChoices(result.choices)
    else setChoices([])

    if (!engine.canContinue && result.choices.length === 0) {
      setIsEnded(true)
      setCompletionOpen(true)
    }
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
    setCompletionOpen(false)
    setActiveBackground({ url: defaultBackgroundUrl, fit: 'cover' })

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
  }, [appendResult, compileResult, defaultBackgroundUrl])

  const advanceStory = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return

    const result = engine.continue()
    if (!result) { setIsEnded(true); setCompletionOpen(true); return }

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
    if (!result) { setIsEnded(true); setCompletionOpen(true); return }

    appendResult(engine, result)
  }, [appendResult, choices])

  const handleInput = useCallback((text: string) => {
    const engine = engineRef.current
    if (!engine) return

    setHistory((prev) => [...prev, { speaker: 'You', text }])
    setIsWaiting(false)
    engine.setVariable('user_last_input', text)
  }, [])

  const resetPreview = useCallback(() => {
    if (!compileResult?.json) return
    engineRef.current?.destroy()
    engineRef.current = null
    setHistory([])
    setChoices([])
    setIsEnded(false)
    setIsWaiting(false)
    setCompletionOpen(false)
    setActiveBackground({ url: defaultBackgroundUrl, fit: 'cover' })

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
  }, [appendResult, compileResult, defaultBackgroundUrl])

  // ─── Derive display state ──────────────────────────────────

  const { speaker: currentSpeaker, expression: currentExpression, position, choiceCharacter } = parseTags(currentTags)
  const backgroundUrl = activeBackground.url || defaultBackgroundUrl

  const speakerSprites = currentSpeaker ? characterSprites[currentSpeaker] : undefined
  const currentSpriteUrl = currentExpression
    ? speakerSprites?.[currentExpression] || speakerSprites?.['default']
    : speakerSprites?.['default']
  const currentAvatarUrl = currentSpeaker ? characterAvatars[currentSpeaker] : undefined
  const speakerPosition = currentSpeaker
    ? (position as 'left' | 'center' | 'right') || characterPositions[currentSpeaker] || 'center'
    : 'center'

  const lastLine = history[history.length - 1]
  const hideSpriteForChoices = choices.length > 0 && choiceCharacter === 'hide'
  const aiPayload = useMemo(() => ({
    story: {
      ended: isEnded,
      currentTags,
      background: activeBackground,
    },
    turns: history.map((line, index) => ({
      round: index + 1,
      speaker: line.speaker || (line.text ? 'Narrator' : ''),
      role: line.speaker === 'You' ? 'user' : 'npc',
      text: line.text,
      expression: line.expression,
      audioUrl: line.audioUrl,
    })),
    userInputs: history
      .filter((line) => line.speaker === 'You')
      .map((line, index) => ({ inputIndex: index + 1, text: line.text })),
  }), [activeBackground, currentTags, history, isEnded])

  useEffect(() => {
    onDebugChange?.({
      isReady,
      isWaiting,
      isEnded,
      currentTags,
      history,
      choices,
      activeBackground,
      aiPayload,
    })
  }, [activeBackground, aiPayload, choices, currentTags, history, isEnded, isReady, isWaiting, onDebugChange])

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
    <>
      <VnPlayer
        className={className}
        backgroundUrl={backgroundUrl}
        backgroundFit={(activeBackground.fit as 'cover' | 'contain' | 'stretch' | 'repeat') || 'cover'}
        currentLine={!isEnded ? lastLine : null}
        history={history}
        choices={choices}
        currentSpriteUrl={hideSpriteForChoices ? undefined : currentSpriteUrl}
        spriteAlt={currentSpeaker}
        spritePosition={speakerPosition}
        currentAvatarUrl={currentAvatarUrl}
        currentAvatarAlt={currentSpeaker}
        isWaiting={isWaiting}
        isEnded={isEnded}
        onAdvance={advanceStory}
        onChoice={handleChoice}
        onSubmitInput={handleInput}
        onReset={resetPreview}
      />
      <Dialog open={completionOpen} onOpenChange={setCompletionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>对话完成</DialogTitle>
            <DialogDescription>
              已收集 {history.length} 条对话，右侧可以查看整理后的 AI 评估数据。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => setCompletionOpen(false)}>退出</Button>
            <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={resetPreview}>重新预览</Button>
            <Button variant="secondary" onClick={() => setCompletionOpen(false)}>查看数据</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
