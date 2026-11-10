import { useEffect, useMemo, useState } from 'react'
import {
  isBackgroundFit,
  isSpritePosition,
  parseVnTags,
} from '@/features/practice/lib/practice-session-utils'
import { isPlayableMediaUrl, resolveVnImageUrl, type VnAssetMap } from '@/features/vn-engine/vn-media-url'
import { vnTextureRuntime } from '@/features/vn-engine/vn-texture-runtime'

export type VnTagVisualState = {
  backgroundUrl?: string
  backgroundFit?: 'cover' | 'contain' | 'stretch' | 'repeat'
  speaker?: string
  expression?: string
  position?: 'left' | 'center' | 'right'
}

/**
 * Derive VN stage visuals from Ink tags only after pack media is ready.
 * Never warms or returns unresolved aliases.
 */
export function useVnTagVisuals(input: {
  currentTags: string[]
  mediaReady: boolean
  assetMap?: VnAssetMap | null
  sceneBackgroundUrl?: string | null
  isWaiting: boolean
  /** Optional fallback speaker when tags omit speaker (practice dialogue). */
  fallbackSpeaker?: string | null
  initialBackgroundUrl?: string | null
}) {
  const [vnVisual, setVnVisual] = useState<VnTagVisualState>(() => ({
    backgroundUrl: isPlayableMediaUrl(input.initialBackgroundUrl)
      ? input.initialBackgroundUrl
      : undefined,
    backgroundFit: 'cover',
  }))

  useEffect(() => {
    if (!input.mediaReady) return

    const sceneBg = resolveVnImageUrl(input.sceneBackgroundUrl ?? undefined, input.assetMap)
    const tags = input.currentTags

    if (tags.length === 0) {
      if (sceneBg) {
        setVnVisual((prev) => (
          prev.backgroundUrl === sceneBg
            ? prev
            : { ...prev, backgroundUrl: sceneBg }
        ))
        vnTextureRuntime.warmup([sceneBg])
      }
      return
    }

    const parsed = parseVnTags(tags, input.assetMap ?? undefined)
    const nextBg = parsed.bg || sceneBg

    setVnVisual((prev) => {
      const next: VnTagVisualState = {
        backgroundUrl: nextBg || prev.backgroundUrl,
        backgroundFit: isBackgroundFit(parsed.bgFit) ? parsed.bgFit : prev.backgroundFit,
        speaker: prev.speaker,
        expression: prev.expression,
        position: prev.position,
      }
      // Pending input lines carry tags for the upcoming NPC line — don't advance portrait yet.
      if (!input.isWaiting) {
        next.speaker = parsed.speaker || input.fallbackSpeaker || prev.speaker
        next.expression = parsed.expression || prev.expression || 'default'
        next.position = isSpritePosition(parsed.position) ? parsed.position : prev.position
      }
      return next
    })

    if (nextBg && isPlayableMediaUrl(nextBg)) {
      vnTextureRuntime.warmup([nextBg])
    }
  }, [
    input.assetMap,
    input.currentTags,
    input.fallbackSpeaker,
    input.isWaiting,
    input.mediaReady,
    input.sceneBackgroundUrl,
  ])

  // While media is loading, never expose a stale alias from a previous episode.
  return useMemo(() => {
    if (!input.mediaReady) {
      return {
        backgroundFit: vnVisual.backgroundFit,
        backgroundUrl: undefined,
        speaker: undefined,
        expression: undefined,
        position: undefined,
      }
    }
    return vnVisual
  }, [input.mediaReady, vnVisual])
}
