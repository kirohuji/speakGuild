import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/cn'
import { Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePreferencesStore } from '@/stores/preferences.store'

interface InteractiveSpeechBlockProps {
  text: string
  lang?: string
  isPlaying?: boolean
  onPlay?: () => void
  onStop?: () => void
  onWordClick?: (word: string) => void
  className?: string
  showPlayButton?: boolean
}

export function InteractiveSpeechBlock({
  text,
  lang = 'en-US',
  isPlaying: externalIsPlaying,
  onPlay,
  onStop,
  onWordClick,
  className,
  showPlayButton = true,
}: InteractiveSpeechBlockProps) {
  const { tts } = usePreferencesStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window

  const words = text.split(/(\s+)/).filter(Boolean)
  const meaningfulWords = text.split(/\s+/).filter(Boolean)

  const actualIsPlaying = externalIsPlaying !== undefined ? externalIsPlaying : isPlaying

  const stopSpeech = useCallback(() => {
    if (hasSpeechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPlaying(false)
    setCurrentWordIndex(-1)
    onStop?.()
  }, [hasSpeechSynthesis, onStop])

  const startSpeech = useCallback(() => {
    if (!text) return

    if (hasSpeechSynthesis) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = tts.rate
      utterance.pitch = tts.pitch
      utterance.volume = tts.volume
      if (tts.voiceURI) {
        const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === tts.voiceURI)
        if (voice) utterance.voice = voice
      }

      let wordIdx = 0
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          setCurrentWordIndex(wordIdx)
          wordIdx++
        }
      }

      utterance.onend = () => {
        setIsPlaying(false)
        setCurrentWordIndex(-1)
        onStop?.()
      }

      utterance.onerror = () => {
        setIsPlaying(false)
        setCurrentWordIndex(-1)
      }

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
      setIsPlaying(true)
      onPlay?.()
    } else {
      // Fallback: highlight words sequentially
      setIsPlaying(true)
      onPlay?.()
      let idx = 0
      const avgWordDuration = 400
      intervalRef.current = setInterval(() => {
        if (idx >= meaningfulWords.length) {
          stopSpeech()
          return
        }
        setCurrentWordIndex(idx)
        idx++
      }, avgWordDuration)
    }
  }, [text, lang, hasSpeechSynthesis, meaningfulWords.length, onPlay, stopSpeech])

  useEffect(() => {
    return () => {
      stopSpeech()
    }
  }, [stopSpeech])

  useEffect(() => {
    if (externalIsPlaying === true && !isPlaying) {
      startSpeech()
    } else if (externalIsPlaying === false && isPlaying) {
      stopSpeech()
    }
  }, [externalIsPlaying])

  const handleToggle = () => {
    if (actualIsPlaying) {
      stopSpeech()
    } else {
      startSpeech()
    }
  }

  let meaningfulIdx = 0

  return (
    <div className={cn('space-y-3', className)}>
      {showPlayButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          className="gap-2"
        >
          {actualIsPlaying ? (
            <>
              <Square className="h-3.5 w-3.5" />
              停止
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              播放
            </>
          )}
        </Button>
      )}
      <div className="leading-relaxed text-base">
        {words.map((segment, i) => {
          if (/^\s+$/.test(segment)) {
            return <span key={i}>{segment}</span>
          }
          const wordIndex = meaningfulIdx++
          const isHighlighted = actualIsPlaying && wordIndex === currentWordIndex
          return (
            <span
              key={i}
              onClick={() => onWordClick?.(segment.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, ''))}
              className={cn(
                'cursor-pointer rounded px-0.5 transition-colors',
                isHighlighted
                  ? 'bg-primary/20 text-primary font-medium'
                  : 'hover:bg-muted',
                onWordClick && 'hover:underline'
              )}
            >
              {segment}
            </span>
          )
        })}
      </div>
    </div>
  )
}
