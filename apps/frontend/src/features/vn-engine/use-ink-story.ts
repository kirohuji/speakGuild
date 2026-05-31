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

export function useInkStory(json: Record<string, any> | null, options?: UseInkStoryOptions) {
  const engineRef = useRef<InkEngine | null>(null)
  const [lines, setLines] = useState<InkLine[]>([])
  const [choices, setChoices] = useState<InkChoice[]>([])
  const [isEnded, setIsEnded] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [currentTags, setCurrentTags] = useState<string[]>([])

  // Initialize engine when JSON loads
  useEffect(() => {
    // Clean up previous engine
    engineRef.current?.destroy()
    engineRef.current = null

    // Reset all state for new story
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

      // Start the story
      advanceStory(engine)
    } catch (err) {
      console.warn('[useInkStory] Failed to load Ink JSON, falling back to free dialogue mode:', err)
      engineRef.current = null
    }
  }, [json])

  const advanceStory = useCallback((engine: InkEngine) => {
    const result = engine.continue()
    if (!result) {
      setIsEnded(true)
      return
    }

    const tags = engine.getCurrentTags()
    setCurrentTags(tags)

    // Check for tags that mark a user-input pause.
    const needsInput = tags.some((tag) => {
      const normalized = tag.trim()
      return normalized === 'input'
        || normalized === 'user_input'
        || normalized === 'wait:input'
        || normalized === 'wait:user_input'
        || normalized.startsWith('input:')
    })

    if (needsInput) {
      // #input does NOT block Ink Continue() — text after the tag is also returned.
      // Defer the text so it isn't shown before the user has responded.
      setIsWaiting(true)
      return
    }

    if (result.hasChoices && result.choices.length > 0) {
      setChoices(result.choices)
    }

    if (result.text) {
      const parsed = parseInkLine(result.text, tags)
      setLines((prev) => [...prev, ...parsed])
    }
  }, [])

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
    engineRef.current?.continue() // Trigger variable observers
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

/** Parse Ink output into structured lines (detect Speaker: text format) */
function parseInkLine(text: string, tags: string[]): InkLine[] {
  const speakerTag = tags.find((t) => t.startsWith('speaker:'))
  const speaker = speakerTag?.replace('speaker:', '').trim()

  // Split by newlines, each is a separate dialogue line
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      // Check inline speaker format: "Name: text"
      const match = line.match(/^([^:：]{1,32})[:：]\s*(.+)/)
      if (match) {
        return { text: match[2], speaker: match[1], tags }
      }
      return { text: line, speaker, tags }
    })
}
