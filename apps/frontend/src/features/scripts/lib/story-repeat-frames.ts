import { type StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { parseComposer } from '@/features/admin/components/composer-parser'
import { flattenComposerToTimeline, resolveTimelineAssetAliases } from '@/features/admin/components/vn-mixed-timeline'

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
  const characterSprites: Record<string, Record<string, string>> = {}
  const characterAvatars: Record<string, string> = {}
  const characterPositions: Record<string, 'left' | 'center' | 'right'> = {}
  for (const character of scene?.characters ?? []) {
    const sprites: Record<string, string> = {}
    if (character.spriteBaseUrl) sprites.default = character.spriteBaseUrl
    let avatarUrl = character.avatarUrl || undefined
    for (const [expression, value] of Object.entries(character.expressions ?? {})) {
      if (typeof value === 'string') {
        if (value) sprites[expression] = value
      } else if (value && typeof value === 'object') {
        const entry = value as { spriteUrl?: string; avatarUrl?: string }
        if (entry.spriteUrl) sprites[expression] = entry.spriteUrl
        if (!avatarUrl && entry.avatarUrl) avatarUrl = entry.avatarUrl
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
    options.assetMap ?? data.inkScript.assetMap,
    { audioMode: options.audioMode ?? 'playback' },
  ), {
    defaultBackgroundUrl: scene?.backgroundUrl ?? undefined,
    characterSprites,
    characterAvatars,
    characterPositions,
  })
}
