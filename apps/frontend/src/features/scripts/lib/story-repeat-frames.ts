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
  } = {},
) {
  if (!data.inkScript.inkSource) return []
  const scene = options.scene ?? data.scene
  const characterSprites: Record<string, Record<string, string>> = {}
  const characterPositions: Record<string, 'left' | 'center' | 'right'> = {}
  for (const character of scene?.characters ?? []) {
    const sprites: Record<string, string> = {}
    if (character.spriteBaseUrl) sprites.default = character.spriteBaseUrl
    for (const [expression, value] of Object.entries(character.expressions ?? {})) {
      const url = typeof value === 'string' ? value : (value as { spriteUrl?: string } | null)?.spriteUrl
      if (url) sprites[expression] = url
    }
    for (const name of [character.name, character.displayName].filter(Boolean) as string[]) {
      characterSprites[name] = sprites
      characterPositions[name] = character.defaultPosition ?? 'center'
    }
  }
  return flattenComposerToTimeline(resolveTimelineAssetAliases(
    parseComposer(data.inkScript.inkSource),
    options.assetMap ?? data.inkScript.assetMap,
  ), {
    defaultBackgroundUrl: scene?.backgroundUrl ?? undefined,
    characterSprites,
    characterPositions,
  })
}
