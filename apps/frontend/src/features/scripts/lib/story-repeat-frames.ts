import { type StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { parseComposer } from '@/features/admin/components/composer-parser'
import { flattenComposerToTimeline, resolveTimelineAssetAliases } from '@/features/admin/components/vn-mixed-timeline'
import { isPlayableMediaUrl, resolveVnImageUrl } from '@/features/vn-engine/vn-media-url'

/**
 * Builds the single source of truth for repeat-theatre and Remotion frames.
 * Callers deliberately choose either raw server URLs (for the renderer) or
 * Capacitor-resolved URLs (for the on-device theatre).
 */
export function buildStoryRepeatFrames(
  data: StoryEpisodePlayerData,
  options: {
    assetMap?: StoryEpisodePlayerData['inkScript']['assetMap']
    scene?: StoryEpisodePlayerData['scene']
    /** Remotion must keep signed/public audio URLs, not cookie-bound content proxies. */
    audioMode?: 'playback' | 'render'
  } = {},
) {
  if (!data.inkScript.inkSource) return []
  const scene = options.scene ?? data.scene
  const assetMap = options.assetMap ?? data.inkScript.assetMap
  const preferSigned = options.audioMode === 'render'
  const resolveVisual = (value?: string | null) => {
    if (!value) return undefined
    // Prefer assetMap (signed URL for render) over requiring an already-playable URL.
    // asset:// / aliases used to be dropped here → first Remotion frames rendered black.
    return resolveVnImageUrl(value, assetMap, { preferSigned })
      || (!preferSigned && isPlayableMediaUrl(value) ? value : undefined)
  }
  const characterSprites: Record<string, Record<string, string>> = {}
  const characterAvatars: Record<string, string> = {}
  const characterPositions: Record<string, 'left' | 'center' | 'right'> = {}
  for (const character of scene?.characters ?? []) {
    const sprites: Record<string, string> = {}
    const base = resolveVisual(character.spriteBaseUrl)
    if (base) sprites.default = base
    let avatarUrl = resolveVisual(character.avatarUrl) || undefined
    for (const [expression, value] of Object.entries(character.expressions ?? {})) {
      if (typeof value === 'string') {
        const resolved = resolveVisual(value)
        if (resolved) sprites[expression] = resolved
      } else if (value && typeof value === 'object') {
        const entry = value as { spriteUrl?: string; avatarUrl?: string }
        const spriteUrl = resolveVisual(entry.spriteUrl)
        if (spriteUrl) sprites[expression] = spriteUrl
        if (!avatarUrl) avatarUrl = resolveVisual(entry.avatarUrl) || undefined
      }
    }
    for (const name of [character.name, character.displayName].filter(Boolean) as string[]) {
      characterSprites[name] = sprites
      if (avatarUrl) characterAvatars[name] = avatarUrl
      characterPositions[name] = character.defaultPosition ?? 'center'
    }
  }
  return flattenComposerToTimeline(resolveTimelineAssetAliases(
    parseComposer(data.inkScript.inkSource),
    assetMap,
    { audioMode: options.audioMode ?? 'playback' },
  ), {
    defaultBackgroundUrl: resolveVisual(scene?.backgroundUrl),
    characterSprites,
    characterAvatars,
    characterPositions,
  })
}
