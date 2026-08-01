import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { VnPlayer } from '@/features/vn-engine/vn-player'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { Play, AlertTriangle, CheckCircle2, ChevronDown, Lightbulb, Loader2 } from 'lucide-react'
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
import { judgePreviewDialogueTurn, type PreviewDialogueTurnResult } from '../api-content-admin'
import { parseComposer } from './composer-parser'
import { flattenComposerToTimeline } from './vn-mixed-timeline'
import { VnMixedPreviewPlayer } from './vn-mixed-preview-player'
import { NqtrVideoPreviewPlayer } from './nqtr-video-preview-player'
import {
  parseVnTags,
  characterMatchesSpeaker,
  isBackgroundFit,
  isSpritePosition,
  readListTags,
  readTagValue,
} from '@/features/practice/lib/practice-session-utils'
import type { GameCharacter } from '../api-content-admin'

export type PreviewLayout = 'portrait' | 'landscape' | 'mixed' | 'video'

/** 角色立绘数据：expression name → sprite URL（vn-mixed-timeline 使用） */
export type CharacterSpriteMap = Record<string, string>

interface VnStoryPreviewProps {
  inkSource?: string
  inkJson?: Record<string, any>
  characters?: GameCharacter[]
  characterSprites?: Record<string, Record<string, string>>
  characterAvatars?: Record<string, string>
  characterPositions?: Record<string, 'left' | 'center' | 'right'>
  defaultBackgroundUrl?: string
  previewLayout?: PreviewLayout
  aiEvaluationEnabled?: boolean
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
    aiEvaluations: PreviewAiEvaluation[]
    previewLayout: PreviewLayout
    timelineLength?: number
    activeFrameIndex?: number
    missingDefaultAnswerCount?: number
  }) => void
}

interface DialogueLine {
  speaker: string
  text: string
  expression?: string
  translation?: string
  audioUrl?: string
}

export interface PreviewAiEvaluation {
  id: number
  userText: string
  objective: string
  targetChunks: string[]
  status: 'loading' | 'success' | 'error'
  result?: PreviewDialogueTurnResult
  error?: string
}

function readPreviewInputNodeId(tags: string[]) {
  const inputTag = readTagValue(tags, 'input:') || readTagValue(tags, 'wait:')
  if (inputTag) return inputTag.match(/(?:^|[;,]\s*)id=([^;,]+)/)?.[1]?.trim() || inputTag
  if (tags.includes('input')) return 'input'
  if (tags.includes('wait')) return 'wait'
  return undefined
}

export function VnStoryPreview({
  inkSource,
  inkJson,
  characters = [],
  characterSprites: _legacySprites,
  characterAvatars: _legacyAvatars,
  characterPositions: _legacyPositions,
  defaultBackgroundUrl,
  previewLayout = 'portrait',
  aiEvaluationEnabled = false,
  className,
  onDebugChange,
}: VnStoryPreviewProps) {
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const [userTurns, setUserTurns] = useState<DialogueLine[]>([])
  const [completionOpen, setCompletionOpen] = useState(false)
  const [aiEvaluations, setAiEvaluations] = useState<PreviewAiEvaluation[]>([])
  const [activeEvaluation, setActiveEvaluation] = useState<PreviewAiEvaluation | null>(null)
  const [activeFrameIndex, setActiveFrameIndex] = useState(0)
  const userInputJustSubmittedRef = useRef(false)

  const [vnVisual, setVnVisual] = useState<{
    backgroundUrl?: string
    backgroundFit: 'cover' | 'contain' | 'stretch' | 'repeat'
    speaker?: string
    expression?: string
    position?: 'left' | 'center' | 'right'
  }>({
    backgroundUrl: defaultBackgroundUrl,
    backgroundFit: 'cover',
  })

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

  const compiledJson = useMemo(
    () => (compileResult?.success && compileResult.json) ? compileResult.json : null,
    [compileResult],
  )
  const story = useInkStory(compiledJson)

  useEffect(() => {
    setUserTurns([])
    setCompletionOpen(false)
    setAiEvaluations([])
    setActiveEvaluation(null)
    setVnVisual({
      backgroundUrl: defaultBackgroundUrl,
      backgroundFit: 'cover',
    })
  }, [compiledJson, defaultBackgroundUrl])

  useEffect(() => {
    const tags = story.currentTags
    if (tags.length === 0) return
    const parsed = parseVnTags(tags)
    setVnVisual((prev) => {
      const next = {
        backgroundUrl: parsed.bg || prev.backgroundUrl || defaultBackgroundUrl || undefined,
        backgroundFit: isBackgroundFit(parsed.bgFit) ? parsed.bgFit : prev.backgroundFit,
        speaker: prev.speaker,
        expression: prev.expression,
        position: prev.position,
      }
      // isWaiting 时 tags 属于 pending 行，不更新立绘状态
      if (!story.isWaiting) {
        next.speaker = parsed.speaker || prev.speaker
        next.expression = parsed.expression || prev.expression || 'default'
        next.position = isSpritePosition(parsed.position) ? parsed.position : prev.position
      }
      return next
    })
  }, [story.currentTags, story.isWaiting, defaultBackgroundUrl])

  const inkLines: DialogueLine[] = useMemo(
    () => story.lines.map((line) => ({
      speaker: line.speaker || '',
      text: line.text,
      translation: parseVnTags(line.tags).translation,
      audioUrl: parseVnTags(line.tags).audio,
    })),
    [story.lines],
  )
  // 交错排列：NPC1 → 用户1 → NPC2 → 用户2 → ...
  const history = useMemo(() => {
    const result: DialogueLine[] = []
    const maxLen = Math.max(inkLines.length, userTurns.length)
    for (let i = 0; i < maxLen; i++) {
      if (i < inkLines.length) result.push(inkLines[i])
      if (i < userTurns.length) result.push(userTurns[i])
    }
    return result
  }, [inkLines, userTurns])
  const isEnded = story.isEnded && inkLines.length > 0

  // 当前展示行：刚提交用户输入时优先展示用户输入；否则找最后一条 NPC 线
  const displayLine = useMemo(() => {
    if (isEnded) return null
    const last = history.at(-1)
    if (userInputJustSubmittedRef.current) return last ?? null
    if (last && last.speaker !== 'You') return last
    for (let i = history.length - 2; i >= 0; i--) {
      if (history[i].speaker !== 'You') return history[i]
    }
    return last ?? null
  }, [history, isEnded])

  // inkLines 变化时（advanceStory 推进了剧情），清除「刚提交」标记
  useEffect(() => {
    userInputJustSubmittedRef.current = false
  }, [story.lines])

  useEffect(() => {
    if (isEnded && history.length > 0) setCompletionOpen(true)
  }, [isEnded, history.length])

  const currentCharacter = useMemo(() => {
    if (characters.length === 0) return undefined
    const speaker = vnVisual.speaker || (displayLine && displayLine.speaker !== 'You' ? displayLine.speaker : undefined)
    return characters.find((c) => characterMatchesSpeaker(c as any, speaker))
      || (characters.length === 1 ? characters[0] : undefined)
  }, [characters, vnVisual.speaker, displayLine])

  const expressionMap = useMemo(() => {
    if (!currentCharacter?.expressions || typeof currentCharacter.expressions !== 'object') return {}
    return currentCharacter.expressions as Record<string, string | { spriteUrl?: string; avatarUrl?: string }>
  }, [currentCharacter?.expressions])

  const currentState = vnVisual.expression ? expressionMap[vnVisual.expression] : expressionMap['default']
  const stateSpriteUrl = typeof currentState === 'string' ? currentState : (currentState as any)?.spriteUrl
  const stateAvatarUrl = typeof currentState === 'object' ? (currentState as any)?.avatarUrl : undefined
  const currentSpriteUrl = currentCharacter
    ? stateSpriteUrl || currentCharacter.spriteBaseUrl || undefined
    : undefined
  const legacyPosition = currentCharacter?.name
    ? (_legacyPositions?.[currentCharacter.name] || _legacyPositions?.[currentCharacter.displayName || ''])
    : undefined
  const spritePosition = (vnVisual.position || currentCharacter?.defaultPosition || legacyPosition || 'center') as 'left' | 'center' | 'right'

  const mixedFrames = useMemo(() => {
    if ((previewLayout !== 'mixed' && previewLayout !== 'video') || !inkSource) return []
    const sprites: Record<string, Record<string, string>> = _legacySprites || {}
    const avatars: Record<string, string> = _legacyAvatars || {}
    const positions: Record<string, 'left' | 'center' | 'right'> = _legacyPositions || {}
    if (Object.keys(sprites).length === 0 && characters.length > 0) {
      for (const char of characters) {
        const map: Record<string, string> = {}
        if (char.expressions && typeof char.expressions === 'object') {
          for (const [name, value] of Object.entries(char.expressions as Record<string, unknown>)) {
            if (typeof value === 'string') map[name] = value
            else if (value && typeof value === 'object') {
              const url = (value as { spriteUrl?: unknown }).spriteUrl
              if (typeof url === 'string' && url) map[name] = url
            }
          }
        }
        if (!map.default && char.spriteBaseUrl) map.default = char.spriteBaseUrl
        if (Object.keys(map).length > 0) {
          sprites[char.name] = map
          if (char.displayName) sprites[char.displayName] = map
        }
        if (char.avatarUrl) {
          avatars[char.name] = char.avatarUrl
          if (char.displayName) avatars[char.displayName] = char.avatarUrl
        }
        if (char.defaultPosition) {
          positions[char.name] = char.defaultPosition as 'left' | 'center' | 'right'
          if (char.displayName) positions[char.displayName] = char.defaultPosition as 'left' | 'center' | 'right'
        }
      }
    }
    return flattenComposerToTimeline(parseComposer(inkSource), {
      characterSprites: sprites,
      characterAvatars: avatars,
      characterPositions: positions,
      defaultBackgroundUrl,
    })
  }, [_legacyAvatars, _legacyPositions, _legacySprites, characters, defaultBackgroundUrl, inkSource, previewLayout])

  useEffect(() => {
    setActiveFrameIndex(0)
  }, [mixedFrames.length, previewLayout])

  const handleInput = useCallback(async (text: string) => {
    const value = text.trim()
    if (!value) return

    if (!aiEvaluationEnabled) {
      setUserTurns((prev) => [...prev, { speaker: 'You', text: value }])
      userInputJustSubmittedRef.current = true
      story.resumeAfterInput(value)
      // 不调 advanceStory — 用户点「继续」后再推进
      return
    }

    const id = Date.now()
    const objective = readTagValue(story.currentTags, 'objective:') || ''
    const targetChunks = readListTags(story.currentTags, 'chunks:')
    const npcText = [...history].reverse().find((line) => line.speaker !== 'You')?.text ?? ''
    const loadingEvaluation: PreviewAiEvaluation = { id, userText: value, objective, targetChunks, status: 'loading' }
    setActiveEvaluation(loadingEvaluation)
    setAiEvaluations((prev) => [...prev, loadingEvaluation])

    try {
      const result = await judgePreviewDialogueTurn({
        topicId: 'admin-preview',
        inputNodeId: readPreviewInputNodeId(story.currentTags),
        npcText,
        userText: value,
        objectives: objective ? [objective] : undefined,
        targetChunks,
      })
      const evaluation: PreviewAiEvaluation = { ...loadingEvaluation, status: 'success', result }
      setActiveEvaluation(evaluation)
      setAiEvaluations((prev) => prev.map((item) => item.id === id ? evaluation : item))
      if (result.passed) {
        setUserTurns((prev) => [...prev, { speaker: 'You', text: value }])
        userInputJustSubmittedRef.current = true
        story.resumeAfterInput(value)
        // 不调 advanceStory — 用户点「继续」后再推进
      }
    } catch (error: any) {
      const evaluation: PreviewAiEvaluation = {
        ...loadingEvaluation,
        status: 'error',
        error: error?.response?.data?.message || error?.message || '评估请求失败',
      }
      setActiveEvaluation(evaluation)
      setAiEvaluations((prev) => prev.map((item) => item.id === id ? evaluation : item))
    }
  }, [aiEvaluationEnabled, history, story])

  const continueDespiteEvaluation = useCallback(() => {
    setActiveEvaluation(null)
  }, [])

  const resetPreview = useCallback(() => {
    setUserTurns([])
    setCompletionOpen(false)
    setAiEvaluations([])
    setActiveEvaluation(null)
    setVnVisual({
      backgroundUrl: defaultBackgroundUrl,
      backgroundFit: 'cover',
    })
  }, [defaultBackgroundUrl])

  const aiPayload = useMemo(() => ({
    story: {
      ended: isEnded,
      currentTags: story.currentTags,
      background: { url: vnVisual.backgroundUrl, fit: vnVisual.backgroundFit },
    },
    turns: history.map((line, index) => ({
      round: index + 1,
      speaker: line.speaker || (line.text ? 'Narrator' : ''),
      role: line.speaker === 'You' ? 'user' : 'npc',
      text: line.text,
      expression: line.expression,
      translation: line.translation,
      audioUrl: line.audioUrl,
    })),
    userInputs: history
      .filter((line) => line.speaker === 'You')
      .map((line, index) => ({ inputIndex: index + 1, text: line.text })),
  }), [history, isEnded, story.currentTags, vnVisual.backgroundFit, vnVisual.backgroundUrl])

  useEffect(() => {
    onDebugChange?.({
      isReady: Boolean(compiledJson),
      isWaiting: story.isWaiting,
      isEnded,
      currentTags: story.currentTags,
      history,
      choices: story.choices,
      activeBackground: { url: vnVisual.backgroundUrl, fit: vnVisual.backgroundFit },
      aiPayload,
      aiEvaluations,
      previewLayout,
      timelineLength: previewLayout === 'mixed' || previewLayout === 'video' ? mixedFrames.length : undefined,
      activeFrameIndex: previewLayout === 'mixed' || previewLayout === 'video' ? activeFrameIndex : undefined,
      missingDefaultAnswerCount: previewLayout === 'mixed' || previewLayout === 'video' ? mixedFrames.filter((frame) => frame.kind === 'missingInput').length : undefined,
    })
  }, [activeFrameIndex, aiEvaluations, aiPayload, compiledJson, history, isEnded, mixedFrames, onDebugChange, previewLayout, story.choices, story.currentTags, story.isWaiting, vnVisual.backgroundFit, vnVisual.backgroundUrl])

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

  if (!compiledJson) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/20 p-12', className)}>
        <Play className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">编写 Ink 脚本后，编译预览效果</p>
      </div>
    )
  }

  const inputGuidance = {
    objective: readTagValue(story.currentTags, 'objective:'),
    hint: readTagValue(story.currentTags, 'hint:'),
  }
  const backgroundUrl = vnVisual.backgroundUrl || defaultBackgroundUrl
  const backgroundFit = vnVisual.backgroundFit || 'cover'

  return (
    <>
      {previewLayout === 'mixed' ? (
        <VnMixedPreviewPlayer
          className={className}
          frames={mixedFrames}
          activeIndex={Math.min(activeFrameIndex, Math.max(mixedFrames.length - 1, 0))}
          onJumpTo={setActiveFrameIndex}
        />
      ) : previewLayout === 'video' ? (
        <NqtrVideoPreviewPlayer
          className={className}
          frames={mixedFrames}
          activeIndex={Math.min(activeFrameIndex, Math.max(mixedFrames.length - 1, 0))}
          onJumpTo={setActiveFrameIndex}
        />
      ) : (
      <VnPlayer
        className={className}
        frameVariant={previewLayout === 'landscape' ? 'landscape' : 'portrait'}
        backgroundUrl={backgroundUrl}
        backgroundFit={backgroundFit as 'cover' | 'contain' | 'stretch' | 'repeat'}
        currentLine={displayLine ? { ...displayLine, isUser: displayLine.speaker === 'You' } : null}
        history={history.map((line) => ({ ...line, isUser: line.speaker === 'You' }))}
        choices={story.choices}
        currentSpriteUrl={currentSpriteUrl}
        spriteAlt={currentCharacter?.displayName || currentCharacter?.name || vnVisual.speaker}
        spritePosition={spritePosition}
        currentAvatarUrl={displayLine?.speaker === 'You' ? undefined : (stateAvatarUrl || currentCharacter?.avatarUrl || undefined)}
        currentAvatarAlt={displayLine?.speaker === 'You' ? undefined : (currentCharacter?.displayName || currentCharacter?.name)}
        isWaiting={story.isWaiting}
        isEnded={isEnded}
        onAdvance={story.advanceStory}
        onChoice={story.handleChoice}
        onSubmitInput={handleInput}
        showUserInputOverride
        inputGuidance={inputGuidance}
        inputFeedback={aiEvaluationEnabled && activeEvaluation ? (
          <PreviewInputFeedback evaluation={activeEvaluation} onContinue={continueDespiteEvaluation} />
        ) : null}
        inputDisabled={activeEvaluation?.status === 'loading'}
        onReset={resetPreview}
      />
      )}
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

function PreviewInputFeedback({
  evaluation,
  onContinue,
}: {
  evaluation: PreviewAiEvaluation
  onContinue: () => void
}) {
  const isLoading = evaluation.status === 'loading'
  const isError = evaluation.status === 'error'
  const result = evaluation.result
  const isPassed = Boolean(result?.passed)
  const suggestedChunks = evaluation.targetChunks.filter((chunk) => !result?.chunksUsed.includes(chunk))
  const example = suggestedChunks.length
    ? suggestedChunks.join(' ')
    : evaluation.targetChunks.join(' ')

  return (
    <div className="border-t border-white/10 bg-slate-950/92 px-3 py-2 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10">
          {isLoading
            ? <Loader2 className="size-3.5 animate-spin text-sky-200" />
            : isPassed
              ? <CheckCircle2 className="size-3.5 text-emerald-300" />
              : <Lightbulb className="size-3.5 text-amber-200" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">
              {isLoading ? 'AI 正在评估...' : isPassed ? '回答符合预期' : isError ? '评估请求失败' : '再试一次会更好'}
            </p>
            {!isLoading && !isPassed && (
              <button type="button" onClick={onContinue} className="shrink-0 text-[11px] text-white/60 underline underline-offset-2 hover:text-white">
                仍然继续
              </button>
            )}
          </div>
          {!isLoading && (
            <p className="mt-1 text-[11px] leading-4 text-white/72">
              {isError ? evaluation.error : result?.feedback || '可以继续下一句。'}
            </p>
          )}
          {!isLoading && !isPassed && suggestedChunks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {suggestedChunks.map((chunk) => (
                <span key={chunk} className="rounded bg-amber-300/12 px-1.5 py-0.5 text-[10px] text-amber-100">{chunk}</span>
              ))}
            </div>
          )}
          {!isLoading && !isPassed && (
            <details className="mt-2 text-[11px] text-white/65">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-white/72 hover:text-white">
                <ChevronDown className="size-3" />
                查看讲解与参考回答
              </summary>
              <div className="mt-1.5 space-y-1 rounded bg-white/5 p-2 leading-4">
                <p><span className="text-white/45">目标：</span>{evaluation.objective || '完成当前沟通任务'}</p>
                <p><span className="text-white/45">参考：</span>{example || '尝试更直接地回应 NPC，并补充必要信息。'}</p>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
