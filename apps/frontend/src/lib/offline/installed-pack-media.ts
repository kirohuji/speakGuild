import { Capacitor } from '@capacitor/core'
import type { StoryEpisodePlayerData } from '@/features/learning/api/learning-api'
import { createFileAssetReference, fileAssetIdFromUrl, resolveFileAssetUrl } from '@/lib/file-asset-reference'
import { OFFLINE_RESOURCE_MISSING } from '@/lib/offline/asset-cache.service'
import { deferredPackAssetService } from '@/lib/offline/deferred-pack-asset.service'
import { localDb } from '@/lib/offline/unified-storage'

/**
 * Playback for an installed learning pack.
 *
 * Identities (ink alias, asset://, file id, expired signed URL) are lookup
 * keys only. The stage, img, and audio elements receive a WebView-loadable
 * local URL (capacitor:// / data: / blob:) or nothing. A miss never falls
 * back to the network or to the alias string.
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

/** Drop cached pack manifests after install/uninstall so remaps see fresh rows. */
export function invalidateInstalledPackMediaCache(packId?: string) {
  if (!packId) {
    manifestAssets.clear()
    return
  }
  manifestAssets.delete(packId)
}

/**
 * SQLite keeps the Filesystem `file://` URI. iOS WKWebView cannot load that
 * scheme; Capacitor.convertFileSrc remaps it to capacitor://localhost.
 */
function toWebViewPlaybackUrl(url: string): string {
  if (!url.startsWith('file:')) return url
  try {
    return Capacitor.convertFileSrc(url)
  } catch {
    return url
  }
}

function assetFileId(asset: PackManifestAsset) {
  return asset.fileAssetId || fileAssetIdFromUrl(asset.url) || undefined
}

function assetsForPack(packId: string) {
  let pending = manifestAssets.get(packId)
  if (!pending) {
    pending = localDb.get<{ manifest?: { assets?: PackManifestAsset[] } }>('downloaded_packs', packId)
      .then((pack) => {
        const assets = pack?.manifest?.assets ?? []
        // Never permanently cache an empty miss — install may finish later in-session.
        if (assets.length === 0) manifestAssets.delete(packId)
        return assets
      })
      .catch((error) => {
        manifestAssets.delete(packId)
        throw error
      })
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
  if (row?.status === 'ready' && isInstalledPlaybackUrl(row.localUri)) {
    return toWebViewPlaybackUrl(row.localUri)
  }
  if (row?.assetId && row.assetId !== id) return playbackUrlForRow(row.assetId)
  return undefined
}

function isInstalledPlaybackUrl(url?: string | null): url is string {
  if (!url || url === OFFLINE_RESOURCE_MISSING) return false
  return INSTALLED_FILE_URL.test(url) || CAPACITOR_LOCAL_HTTP.test(url)
}

/** WebView-loadable local URL for Pixi, img, and audio. Misses stay empty. */
export async function resolveInstalledMedia(packId: string, identity: MediaIdentity): Promise<string | undefined> {
  if (isInstalledPlaybackUrl(identity.url)) {
    return identity.url ? toWebViewPlaybackUrl(identity.url) : undefined
  }
  const fileAssetId = identity.fileAssetId || fileAssetIdFromUrl(identity.url) || undefined
  const listed = manifestAssetFor(packId ? await assetsForPack(packId) : [], identity)
  const ready = await playbackUrlForRow(listed?.sha256) || await playbackUrlForRow(fileAssetId)
  if (ready) return ready

  // Native installs index assets as deferred until background/on-demand materialize.
  // Keep the installed-pack contract: never fall back to a remote signed URL here.
  const contentUrl = identity.url
    || (fileAssetId ? createFileAssetReference(fileAssetId) : undefined)
    || (listed?.fileAssetId ? createFileAssetReference(listed.fileAssetId) : undefined)
    || listed?.url
  if (!contentUrl) return undefined
  const deferred = await deferredPackAssetService.resolve({
    url: contentUrl,
    assetId: fileAssetId || listed?.fileAssetId || null,
  }).catch(() => null)
  if (deferred && isInstalledPlaybackUrl(deferred)) return toWebViewPlaybackUrl(deferred)
  return undefined
}

/**
 * Prefer an installed pack's local file for UI (covers, cards). Fall back to the
 * stable content URL when the pack is not installed on this device.
 */
export async function resolvePackDisplayUrl(
  url?: string | null,
  packId?: string | null,
): Promise<string | undefined> {
  if (!url) return undefined
  if (isInstalledPlaybackUrl(url)) return toWebViewPlaybackUrl(url)
  const local = await resolveInstalledMedia(packId ?? '', { url })
  if (local) return local
  return resolveFileAssetUrl(url) || url
}

export async function resolveInstalledAssetMap(packId: string, assetMap?: InstalledAssetMap | null): Promise<InstalledAssetMap> {
  const entries = await Promise.all(Object.entries(assetMap ?? {}).map(async ([alias, entry]) => {
    const resolved = await resolveInstalledMedia(packId, {
      url: entry.signedUrl,
      fileAssetId: entry.fileAssetId,
      alias,
    })
    // Keep prior signedUrl/fileAssetId identity on miss so later deferred/cache
    // lookups can still key off it — never wipe to undefined.
    return [alias, {
      ...entry,
      signedUrl: resolved ?? entry.signedUrl ?? null,
    }] as const
  }))
  return Object.fromEntries(entries)
}

type StoryScene = StoryEpisodePlayerData['scene']
type StoryCharacter = NonNullable<NonNullable<StoryScene>['characters']>[number]

async function preferResolved(packId: string, url?: string | null) {
  if (!url) return url ?? null
  if (isInstalledPlaybackUrl(url)) return toWebViewPlaybackUrl(url)
  const resolved = await resolveInstalledMedia(packId, { url })
  // Preserve the original identity on miss so offlineOnly cache / deferred can
  // still key off asset:// or fileAssetId later.
  return resolved ?? url
}

async function resolveCharacterMedia(packId: string, character: StoryCharacter): Promise<StoryCharacter> {
  const expressions = character.expressions && typeof character.expressions === 'object'
    ? Object.fromEntries(await Promise.all(Object.entries(character.expressions).map(async ([name, value]) => {
      if (typeof value === 'string') return [name, await preferResolved(packId, value)]
      if (!value || typeof value !== 'object') return [name, value]
      const entry = value as { spriteUrl?: string | null; avatarUrl?: string | null }
      return [name, {
        ...entry,
        spriteUrl: await preferResolved(packId, entry.spriteUrl),
        avatarUrl: await preferResolved(packId, entry.avatarUrl),
      }]
    })))
    : character.expressions

  const voiceBindings = await Promise.all((character.voiceBindings ?? []).map(async (binding) => ({
    ...binding,
    voiceAsset: binding.voiceAsset ? {
      ...binding.voiceAsset,
      previewUrl: await preferResolved(packId, binding.voiceAsset.previewUrl),
    } : binding.voiceAsset,
  })))

  return {
    ...character,
    avatarUrl: await preferResolved(packId, character.avatarUrl),
    spriteBaseUrl: await preferResolved(packId, character.spriteBaseUrl),
    expressions,
    voiceBindings,
  }
}

export async function resolveInstalledScene(packId: string, scene: StoryScene): Promise<StoryScene> {
  if (!scene) return scene
  const characters = await Promise.all((scene.characters ?? []).map((character) => resolveCharacterMedia(packId, character)))
  return {
    ...scene,
    backgroundUrl: await preferResolved(packId, scene.backgroundUrl),
    characters,
  }
}

async function resolveUrl(packId: string, url?: string | null) {
  return preferResolved(packId, url)
}

async function resolveExplorationItems(packId: string, items: unknown) {
  if (!Array.isArray(items)) return items
  return Promise.all(items.map(async (item) => {
    if (!item || typeof item !== 'object') return item
    const entry = item as { imageUrl?: string | null }
    return {
      ...entry,
      imageUrl: await resolveUrl(packId, entry.imageUrl),
    }
  }))
}

async function resolveMapEditorData(packId: string, editorData: unknown) {
  if (!editorData || typeof editorData !== 'object') return editorData ?? null
  const data = editorData as Record<string, unknown>
  const next = { ...data }
  for (const key of ['sceneInteractions', 'explorationObjects'] as const) {
    const bag = data[key]
    if (!bag || typeof bag !== 'object') continue
    next[key] = Object.fromEntries(await Promise.all(
      Object.entries(bag as Record<string, unknown>).map(async ([scope, items]) => [
        scope,
        await resolveExplorationItems(packId, items),
      ]),
    ))
  }
  return next
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
        editorData: await resolveMapEditorData(packId, bundle.map.editorData),
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
        statusBadgeIcon: await resolveUrl(packId, bundle.chrome.statusBadgeIcon),
        pinLabelIcon: await resolveUrl(packId, bundle.chrome.pinLabelIcon),
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
