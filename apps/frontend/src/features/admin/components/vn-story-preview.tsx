import { useState, useCallback, useEffect, useRef } from 'react'
import { VnScene } from '@/features/vn-engine/vn-scene'
import { DialogueBox } from '@/features/vn-engine/dialogue-box'
import { ChoiceButtons } from '@/features/vn-engine/choice-buttons'
import { Button } from '@/components/ui/button'
import { ChevronRight, RotateCcw, Play } from 'lucide-react'
import {
  type SimpleStory,
  createPreviewRunner,
  type PreviewState,
  parseInkDsl,
} from './ink-dsl'

interface VnStoryPreviewProps {
  dslSource?: string
  story?: SimpleStory
  className?: string
}

/**
 * Visual Novel 故事预览组件
 * 使用简易运行器解释 SimpleStory，渲染为 VN 风格界面
 */
export function VnStoryPreview({ dslSource, story: inputStory, className }: VnStoryPreviewProps) {
  const runnerRef = useRef<ReturnType<typeof createPreviewRunner> | null>(null)
  const [state, setState] = useState<PreviewState | null>(null)
  const [history, setHistory] = useState<{ speaker: string; text: string }[]>([])
  const [story, setStory] = useState<SimpleStory | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Parse DSL source
  useEffect(() => {
    try {
      if (inputStory) {
        setStory(inputStory)
        setError(null)
      } else if (dslSource) {
        const parsed = parseInkDsl(dslSource)
        setStory(parsed)
        setError(null)
      } else {
        setStory(null)
      }
    } catch (err: any) {
      setError(err.message || '解析失败')
      setStory(null)
    }
  }, [dslSource, inputStory])

  // Initialize runner when story changes
  useEffect(() => {
    if (!story) {
      runnerRef.current = null
      setState(null)
      setHistory([])
      return
    }
    try {
      const runner = createPreviewRunner(story)
      runnerRef.current = runner
      const initialState = runner.advance()
      setState(initialState)
      setHistory(runner.getFullHistory())
    } catch (err: any) {
      setError(err.message || '初始化失败')
    }
  }, [story])

  const advanceStory = useCallback(() => {
    if (!runnerRef.current) return
    const newState = runnerRef.current.advance()
    setState(newState)
    setHistory([...runnerRef.current.getFullHistory()])
  }, [])

  const handleChoice = useCallback(
    (index: number) => {
      if (!runnerRef.current) return
      const newState = runnerRef.current.selectChoice(index)
      setState(newState)
      setHistory([...runnerRef.current.getFullHistory()])
    },
    [],
  )

  const resetPreview = useCallback(() => {
    if (!runnerRef.current || !story) return
    runnerRef.current.reset()
    const newState = runnerRef.current.advance()
    setState(newState)
    setHistory([...runnerRef.current.getFullHistory()])
  }, [story])

  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-8 ${className}`}>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!story || !state) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/20 p-12 ${className}`}>
        <Play className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">编写故事脚本后，点击预览查看效果</p>
      </div>
    )
  }

  // Find background for current scene
  const currentScene = story.scenes.find((s) => s.id === state.currentSceneId)
  const bgUrl = state.currentBg || currentScene?.bg
  const lastLine = history[history.length - 1]

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* VN Scene */}
      <VnScene backgroundUrl={bgUrl} className="min-h-[350px]">
        {/* Dialogue history (show previous 2 lines dimmed) */}
        <div className="mb-auto space-y-1">
          {history.slice(-3, -1).map((line, i) => (
            <DialogueBox
              key={i}
              speaker={line.speaker || undefined}
              text={line.text}
              isCurrent={false}
            />
          ))}
        </div>

        {/* Current dialogue */}
        {lastLine && !state.isEnded && state.currentChoices.length === 0 && (
          <DialogueBox
            speaker={lastLine.speaker || undefined}
            text={lastLine.text}
            isCurrent={true}
          />
        )}

        {/* Choices */}
        {state.currentChoices.length > 0 && (
          <ChoiceButtons
            choices={state.currentChoices.map((c, i) => ({
              index: i,
              text: c.text + (c.goto ? ` → ${c.goto}` : ''),
            }))}
            onSelect={handleChoice}
          />
        )}

        {/* Continue button */}
        {!state.isEnded && state.currentChoices.length === 0 && !state.isWaiting && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={advanceStory}
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              继续 <ChevronRight className="size-3" />
            </Button>
          </div>
        )}

        {/* Wait indicator */}
        {state.isWaiting && (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="inline-block size-2 animate-pulse rounded-full bg-primary/60" />
            <span className="text-xs text-muted-foreground">等待用户输入...</span>
            <Button variant="ghost" size="sm" onClick={advanceStory} className="text-xs">
              跳过
            </Button>
          </div>
        )}

        {/* End state */}
        {state.isEnded && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm font-medium text-muted-foreground">— 故事结束 —</p>
            <Button variant="outline" size="sm" onClick={resetPreview} className="gap-1.5">
              <RotateCcw className="size-3.5" />
              重新播放
            </Button>
          </div>
        )}
      </VnScene>

      {/* Scene indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          场景: <code className="rounded bg-muted px-1 py-0.5 font-mono">{state.currentSceneId}</code>
        </span>
        <Button variant="ghost" size="sm" onClick={resetPreview} className="h-7 gap-1 text-xs">
          <RotateCcw className="size-3" />
          重置
        </Button>
      </div>
    </div>
  )
}
