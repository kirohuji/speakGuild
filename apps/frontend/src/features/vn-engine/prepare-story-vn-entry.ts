import type { StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { toVnDisplayUrl, vnTextureRuntime } from '@/features/vn-engine/vn-texture-runtime'
import { isPlayableMediaUrl } from '@/features/vn-engine/vn-media-url'
import { learningPackService, learningRepository } from '@/lib/offline'
import {
  resolveInstalledAssetMap,
  resolveInstalledScene,
  type InstalledAssetMap,
} from '@/lib/offline/installed-pack-media'

export type PreparedStoryVnEntry = {
  key: string
  data: StoryEpisodePlayerData
  packageId: string
  scene: NonNullable<StoryEpisodePlayerData['scene']>
  assetMap: InstalledAssetMap
  backgroundUrl?: string
  spriteUrl?: string
}

let preparedEntry: PreparedStoryVnEntry | null = null
/** Keep handoff warm across React Strict Mode remounts. */
const PREPARED_TTL_MS = 60_000
let preparedExpiresAt = 0

function entryKey(packageId: string, episodeId: string) {
  return `${packageId}:${episodeId}`
}

function pickDefaultSprite(scene?: StoryEpisodePlayerData['scene']) {
  const character = scene?.characters?.[0]
  if (!character) return undefined
  const expressions = character.expressions
  if (expressions && typeof expressions === 'object') {
    const def = (expressions as Record<string, unknown>).default
    if (typeof def === 'string') return def
    if (def && typeof def === 'object' && typeof (def as { spriteUrl?: string }).spriteUrl === 'string') {
      return (def as { spriteUrl: string }).spriteUrl
    }
  }
  return character.spriteBaseUrl || undefined
}

function preloadHtmlImage(url?: string | null) {
  const display = toVnDisplayUrl(url)
  if (!display || typeof Image === 'undefined') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = display
  })
}

/** Warm GPU decode + browser image decode so the stage never opens on bare black. */
async function warmStageUrls(urls: Array<string | null | undefined>) {
  const unique = [...new Set(urls.map((url) => toVnDisplayUrl(url)).filter(Boolean))] as string[]
  await Promise.all(unique.map(async (url) => {
    await Promise.all([
      vnTextureRuntime.ensure(url).catch(() => undefined),
      preloadHtmlImage(url),
    ])
  }))
}

function hasPlayableOpeningMedia(
  scene: StoryEpisodePlayerData['scene'] | null | undefined,
  assetMap: InstalledAssetMap,
) {
  if (isPlayableMediaUrl(scene?.backgroundUrl)) return true
  if (isPlayableMediaUrl(pickDefaultSprite(scene))) return true
  return Object.values(assetMap).some((entry) => isPlayableMediaUrl(entry?.signedUrl))
}

/**
 * Click-time prep for VN / Repeat Theater entry.
 * Resolves installed pack URLs and warms the opening background (and default sprite).
 */
export async function prepareStoryVnEntry(input: {
  packageId: string
  episodeId: string
}): Promise<PreparedStoryVnEntry> {
  const data = await learningRepository.getStoryEpisodePlayer(input.packageId, input.episodeId)
  const packageId = input.packageId || data.episode.sceneId
  let [scene, assetMap] = await Promise.all([
    resolveInstalledScene(packageId, (data.scene ?? {}) as any),
    resolveInstalledAssetMap(packageId, data.inkScript.assetMap ?? null),
  ])

  // Native packs may still be deferred. One materialize pass then re-resolve
  // fills opening media without falling back to COS while the pack is installed.
  const installed = packageId ? await learningPackService.isInstalled(packageId) : false
  if (installed && !hasPlayableOpeningMedia(scene, assetMap)) {
    await learningPackService.drainPackAssetMaterializeQueue(packageId).catch(() => undefined)
    ;[scene, assetMap] = await Promise.all([
      resolveInstalledScene(packageId, (data.scene ?? {}) as any),
      resolveInstalledAssetMap(packageId, data.inkScript.assetMap ?? null),
    ])
  }

  const backgroundUrl = scene?.backgroundUrl || undefined
  const spriteUrl = pickDefaultSprite(scene)
  await warmStageUrls([backgroundUrl, spriteUrl])

  const prepared: PreparedStoryVnEntry = {
    key: entryKey(packageId, input.episodeId),
    data: { ...data, scene },
    packageId,
    scene,
    assetMap,
    backgroundUrl,
    spriteUrl,
  }
  preparedEntry = prepared
  preparedExpiresAt = Date.now() + PREPARED_TTL_MS
  return prepared
}

function matchesPreparedEntry(packageId: string, episodeId: string) {
  if (!preparedEntry) return false
  if (Date.now() > preparedExpiresAt) {
    preparedEntry = null
    return false
  }
  if (!preparedEntry.key.endsWith(`:${episodeId}`)) return false
  if (!packageId) return true
  return preparedEntry.packageId === packageId
}

/** Read click-time prep for the player (safe across Strict Mode remount). */
export function takePreparedStoryVnEntry(packageId: string, episodeId: string) {
  if (!matchesPreparedEntry(packageId, episodeId) || !preparedEntry) return null
  return preparedEntry
}

export function clearPreparedStoryVnEntry() {
  preparedEntry = null
  preparedExpiresAt = 0
}
