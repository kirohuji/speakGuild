import type { StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { fileAssetIdFromUrl } from '@/lib/file-asset-reference'
import { OFFLINE_RESOURCE_MISSING } from '@/lib/offline/asset-cache.service'
import { localDb } from '@/lib/offline/unified-storage'

/**
 * Playback for an installed learning pack.
 *
 * Identities (ink alias, asset://, file id, expired signed URL) are lookup
 * keys only. The stage, img, and audio elements receive a local file URL or
 * nothing. A miss never falls back to the network or to the alias string.
 */
export type InstalledAssetMap = NonNullable<StoryEpisodePlayerData['inkScript']['assetMap']>

type MediaIdentity = {
  url?: string | null
  fileAssetId?: string | null
  alias?: string | null
}

const INSTALLED_FILE_URL = /^(data:|blob:|file:|capacitor:)/i
const CAPACITOR_LOCAL_HTTP = /^https?:\/\/localhost\/_capacitor_file_/i

type PackManifestAsset = {
  sha256?: string
  fileAssetId?: string
  alias?: string
  url?: string
}

const manifestAssets = new Map<string, Promise<PackManifestAsset[]>>()

function assetFileId(asset: PackManifestAsset) {
  return asset.fileAssetId || fileAssetIdFromUrl(asset.url) || undefined
}

function assetsForPack(packId: string) {
  let pending = manifestAssets.get(packId)
  if (!pending) {
    pending = localDb.get<{ manifest?: { assets?: PackManifestAsset[] } }>('downloaded_packs', packId)
      .then((pack) => pack?.manifest?.assets ?? [])
    manifestAssets.set(packId, pending)
  }
  return pending
}

function manifestAssetFor(assets: PackManifestAsset[], identity: MediaIdentity) {
  const fileAssetId = identity.fileAssetId || fileAssetIdFromUrl(identity.url)
  return assets.find((asset) => {
    const listedId = assetFileId(asset)
    return (fileAssetId && listedId === fileAssetId)
      || (identity.alias && asset.alias === identity.alias)
      || (identity.url && asset.url && asset.url === identity.url)
  })
}

async function playbackUrlForRow(id?: string | null): Promise<string | undefined> {
  if (!id) return undefined
  const row = await localDb.get<{ localUri?: string | null; assetId?: string | null; status?: string }>('local_assets', id)
  if (row?.status === 'ready' && isInstalledPlaybackUrl(row.localUri)) return row.localUri
  if (row?.assetId && row.assetId !== id) return playbackUrlForRow(row.assetId)
  return undefined
}

function isInstalledPlaybackUrl(url?: string | null): url is string {
  if (!url || url === OFFLINE_RESOURCE_MISSING) return false
  return INSTALLED_FILE_URL.test(url) || CAPACITOR_LOCAL_HTTP.test(url)
}

/** Local file URL for Pixi, img, and audio. Misses stay empty. */
export async function resolveInstalledMedia(packId: string, identity: MediaIdentity): Promise<string | undefined> {
  if (isInstalledPlaybackUrl(identity.url)) return identity.url ?? undefined
  const fileAssetId = identity.fileAssetId || fileAssetIdFromUrl(identity.url) || undefined
  const listed = manifestAssetFor(packId ? await assetsForPack(packId) : [], identity)
  return playbackUrlForRow(listed?.sha256) || playbackUrlForRow(fileAssetId)
}

export async function resolveInstalledAssetMap(packId: string, assetMap?: InstalledAssetMap | null): Promise<InstalledAssetMap> {
  const entries = await Promise.all(Object.entries(assetMap ?? {}).map(async ([alias, entry]) => {
    const signedUrl = await resolveInstalledMedia(packId, {
      url: entry.signedUrl,
      fileAssetId: entry.fileAssetId,
      alias,
    })
    return [alias, { ...entry, signedUrl }] as const
  }))
  return Object.fromEntries(entries)
}

type StoryScene = StoryEpisodePlayerData['scene']
type StoryCharacter = NonNullable<NonNullable<StoryScene>['characters']>[number]

async function resolveCharacterMedia(packId: string, character: StoryCharacter): Promise<StoryCharacter> {
  const expressions = character.expressions && typeof character.expressions === 'object'
    ? Object.fromEntries(await Promise.all(Object.entries(character.expressions).map(async ([name, value]) => {
      if (typeof value === 'string') return [name, await resolveInstalledMedia(packId, { url: value })]
      if (!value || typeof value !== 'object') return [name, value]
      const entry = value as { spriteUrl?: string | null; avatarUrl?: string | null }
      return [name, {
        ...entry,
        spriteUrl: await resolveInstalledMedia(packId, { url: entry.spriteUrl }),
        avatarUrl: await resolveInstalledMedia(packId, { url: entry.avatarUrl }),
      }]
    })))
    : character.expressions

  const voiceBindings = await Promise.all((character.voiceBindings ?? []).map(async (binding) => ({
    ...binding,
    voiceAsset: binding.voiceAsset ? {
      ...binding.voiceAsset,
      previewUrl: await resolveInstalledMedia(packId, { url: binding.voiceAsset.previewUrl }),
    } : binding.voiceAsset,
  })))

  return {
    ...character,
    avatarUrl: await resolveInstalledMedia(packId, { url: character.avatarUrl }),
    spriteBaseUrl: await resolveInstalledMedia(packId, { url: character.spriteBaseUrl }),
    expressions,
    voiceBindings,
  }
}

export async function resolveInstalledScene(packId: string, scene: StoryScene): Promise<StoryScene> {
  if (!scene) return scene
  const characters = await Promise.all((scene.characters ?? []).map((character) => resolveCharacterMedia(packId, character)))
  return {
    ...scene,
    backgroundUrl: await resolveInstalledMedia(packId, { url: scene.backgroundUrl }),
    characters,
  }
}

async function resolveUrl(packId: string, url?: string | null) {
  if (!url) return url ?? null
  return (await resolveInstalledMedia(packId, { url })) ?? url
}

/** Resolve all media URLs inside an offline NQTR world bundle to local file URLs. */
export async function resolveInstalledNqtrBundle(packId: string, bundle: any) {
  if (!bundle) return bundle
  const characters = await Promise.all((bundle.characters ?? []).map((character: StoryCharacter) => resolveCharacterMedia(packId, character)))
  const map = bundle.map
    ? {
        ...bundle.map,
        backgroundUrl: await resolveUrl(packId, bundle.map.backgroundUrl),
        thumbnailUrl: await resolveUrl(packId, bundle.map.thumbnailUrl),
        icon: await resolveUrl(packId, bundle.map.icon),
      }
    : null
  const locations = await Promise.all((bundle.locations ?? []).map(async (location: any) => ({
    ...location,
    icon: await resolveUrl(packId, location.icon),
    backgroundUrl: await resolveUrl(packId, location.backgroundUrl),
    bgmUrl: await resolveUrl(packId, location.bgmUrl),
    ambientUrl: await resolveUrl(packId, location.ambientUrl),
  })))
  const rooms = await Promise.all((bundle.rooms ?? []).map(async (room: any) => ({
    ...room,
    icon: await resolveUrl(packId, room.icon),
    backgroundUrl: await resolveUrl(packId, room.backgroundUrl),
    bgmUrl: await resolveUrl(packId, room.bgmUrl),
    ambientUrl: await resolveUrl(packId, room.ambientUrl),
  })))
  const chapters = await Promise.all((bundle.chapters ?? []).map(async (chapter: any) => ({
    ...chapter,
    activities: await Promise.all((chapter.activities ?? []).map(async (activity: any) => ({
      ...activity,
      iconUrl: await resolveUrl(packId, activity.iconUrl),
    }))),
    commitments: await Promise.all((chapter.commitments ?? []).map(async (commitment: any) => {
      const slotImages = commitment.slotImages && typeof commitment.slotImages === 'object'
        ? Object.fromEntries(await Promise.all(Object.entries(commitment.slotImages).map(async ([key, value]) => [
          key,
          typeof value === 'string' ? await resolveUrl(packId, value) : value,
        ])))
        : commitment.slotImages
      return {
        ...commitment,
        imageUrl: await resolveUrl(packId, commitment.imageUrl),
        slotImages,
      }
    })),
    quests: await Promise.all((chapter.quests ?? []).map(async (quest: any) => ({
      ...quest,
      imageUrl: await resolveUrl(packId, quest.imageUrl),
    }))),
  })))
  const chrome = bundle.chrome && typeof bundle.chrome === 'object'
    ? {
        ...bundle.chrome,
        hotspotIcon: await resolveUrl(packId, bundle.chrome.hotspotIcon),
        activityIcon: await resolveUrl(packId, bundle.chrome.activityIcon),
        talkIcon: await resolveUrl(packId, bundle.chrome.talkIcon),
        commands: bundle.chrome.commands
          ? Object.fromEntries(await Promise.all(Object.entries(bundle.chrome.commands).map(async ([key, value]: [string, any]) => [
            key,
            { ...value, icon: await resolveUrl(packId, value?.icon) },
          ])))
          : bundle.chrome.commands,
      }
    : bundle.chrome
  const inkScripts: Record<string, any> = {}
  for (const [id, script] of Object.entries(bundle.inkScripts ?? {})) {
    inkScripts[id] = {
      ...(script as object),
      assetMap: await resolveInstalledAssetMap(packId, (script as any)?.assetMap),
    }
  }
  return { ...bundle, map, locations, rooms, characters, chapters, chrome, inkScripts }
}
