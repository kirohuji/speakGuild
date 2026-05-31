import { useEffect, useRef, useState, useCallback } from 'react'
import { InkEngine } from './ink-engine'

export interface InkLine {
  text: string
  speaker?: string
  tags: string[]
}

export interface InkChoice {
  index: number
  text: string
}

interface UseInkStoryOptions {
  onExternalFunction?: (name: string, args: any[]) => any
}

const INPUT_TAGS = ['input', 'user_input', 'wait:input', 'wait:user_input']

function hasInputTag(tags: string[]): boolean {
  return tags.some((tag) => {
    const n = tag.trim()
    return INPUT_TAGS.includes(n) || n.startsWith('input:')
  })
}

export function useInkStory(json: Record<string, any> | null, options?: UseInkStoryOptions) {
  const engineRef = useRef<InkEngine | null>(null)
  const pendingRef = useRef<InkLine[] | null>(null)
  const [lines, setLines] = useState<InkLine[]>([])
  const [choices, setChoices] = useState<InkChoice[]>([])
  const [isEnded, setIsEnded] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [currentTags, setCurrentTags] = useState<string[]>([])

  // ── Init / Reset ──
  useEffect(() => {
    engineRef.current?.destroy()
    engineRef.current = null
    pendingRef.current = null
    setLines([])
    setChoices([])
    setIsEnded(false)
    setIsWaiting(false)
    setCurrentTags([])

    if (!json) return
    try {
      const engine = new InkEngine()
      engineRef.current = engine
      engine.load(json)
      if (options?.onExternalFunction) {
        engine.onExternal(options.onExternalFunction)
      }
      advanceStory(engine)
    } catch (err) {
      console.warn('[useInkStory] Failed to load Ink JSON:', err)
      engineRef.current = null
    }
  }, [json])

  // ── advanceStory ──
  const advanceStory = useCallback((engine: InkEngine) => {
    // Flush pending line first (text that was skipped because #input tag was on it)
    if (Array.isArray(pendingRef.current) && pendingRef.current.length > 0) {
      const pending = pendingRef.current
      pendingRef.current = null
      setLines((prev) => [...prev, ...pending])
      return
    }

    const result = engine.continue()
    if (!result) {
      setIsEnded(true)
      return
    }

    const tags = engine.getCurrentTags()
    setCurrentTags(tags)

    if (hasInputTag(tags)) {
      setIsWaiting(true)
      // #input tag attaches to the NEXT content line in Ink.
      // That line belongs after the user's response — save it for later.
      if (result.text) {
        pendingRef.current = parseInkLine(result.text, tags)
      }
      return
    }

    if (result.hasChoices && result.choices.length > 0) {
      setChoices(result.choices)
    } else {
      setChoices([])
    }

    if (result.text) {
      const parsed = parseInkLine(result.text, tags)
      setLines((prev) => [...prev, ...parsed])
    }
  }, [])

  // ── handleChoice ──
  const handleChoice = useCallback(
    (choiceIndex: number) => {
      if (!engineRef.current) return
      setChoices([])
      setIsWaiting(false)
      engineRef.current.choose(choiceIndex)
      advanceStory(engineRef.current)
    },
    [advanceStory],
  )

  // ── resumeAfterInput ──
  const resumeAfterInput = useCallback(
    (userInput?: string, variables?: Record<string, any>) => {
      if (!engineRef.current) return
      if (userInput) {
        engineRef.current.setVariable('user_last_input', userInput)
      }
      if (variables) {
        Object.entries(variables).forEach(([key, value]) => {
          engineRef.current?.setVariable(key, value)
        })
      }
      setIsWaiting(false)
    },
    [],
  )

  const getVariable = useCallback((name: string) => {
    return engineRef.current?.getVariable(name)
  }, [])

  const setVariable = useCallback((name: string, value: any) => {
    engineRef.current?.setVariable(name, value)
    engineRef.current?.continue()
    advanceStory(engineRef.current!)
  }, [advanceStory])

  const saveState = useCallback(() => {
    return engineRef.current?.saveState() ?? ''
  }, [])

  return {
    lines,
    choices,
    isEnded,
    isWaiting,
    currentTags,
    advanceStory: () => engineRef.current && advanceStory(engineRef.current),
    handleChoice,
    resumeAfterInput,
    getVariable,
    setVariable,
    saveState,
  }
}

/** Parse Ink text into structured lines. "Speaker: text" → {speaker, text} */
function parseInkLine(text: string, tags: string[]): InkLine[] {
  const speakerTag = tags.find((t) => t.startsWith('speaker:'))
  const speaker = speakerTag?.replace('speaker:', '').trim()

  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:：]{1,32})[:：]\s*(.+)/)
      if (match) {
        return { text: match[2], speaker: match[1], tags }
      }
      return { text: line, speaker, tags }
    })
}
