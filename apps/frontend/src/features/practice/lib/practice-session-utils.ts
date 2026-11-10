import { compileInk } from '@/features/admin/components/ink-compiler'
import {
  isPlayableMediaUrl,
  isVnAssetAlias,
  resolveVnImageUrl,
  type VnAssetMap,
} from '@/features/vn-engine/vn-media-url'
import { fileAssetIdFromUrl, getFileAssetContentUrl } from '@/lib/file-asset-reference'
import type { TopicDetail } from '../api/english-practice-api'

export function compilePracticeInk(inkSource?: string | null, fallbackJson?: Record<string, any> | null) {
  if (inkSource) {
    const result = compileInk(inkSource)
    if (result.success && result.json) return result.json
  }
  return fallbackJson ?? null
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIndex = (currentPage - 1) * pageSize

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    currentPage,
    startIndex,
    totalPages,
  }
}

export function readTagValue(tags: string[], prefix: string) {
  const raw = tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length).trim()
  if (!raw) return undefined
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function readInputNodeId(tags: string[]) {
  const inputTag = readTagValue(tags, 'input:') || readTagValue(tags, 'wait:')
  if (inputTag) return inputTag.match(/(?:^|[;,]\s*)id=([^;,]+)/)?.[1]?.trim() || inputTag
  if (tags.includes('input')) return 'input'
  if (tags.includes('wait')) return 'wait'
  return undefined
}

export function readListTags(tags: string[], prefix: string) {
  return tags
    .filter((tag) => tag.startsWith(prefix))
    .flatMap((tag) => {
      const value = readTagValue([tag], prefix)
      return value ? value.split(/[|,]/).map((item) => item.trim()).filter(Boolean) : []
    })
}

function decodeTagValue(value?: string) {
  if (!value) return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function parseVnTags(tags: string[], assetMap?: VnAssetMap) {
  const speaker = tags.find((t) => t.startsWith('speaker:'))?.replace('speaker:', '').trim()
  const expression = tags.find((t) => t.startsWith('expression:'))?.replace('expression:', '').trim()
  const rawAudio = decodeTagValue(tags.find((t) => t.startsWith('audio:'))?.replace('audio:', '').trim())
  const rawBg = decodeTagValue(tags.find((t) => t.startsWith('bg:'))?.replace('bg:', '').trim())
  const bgFit = tags.find((t) => t.startsWith('bgFit:'))?.replace('bgFit:', '').trim()
  const position = tags.find((t) => t.startsWith('position:'))?.replace('position:', '').trim()
  const translation = decodeTagValue(tags.find((t) => t.startsWith('translation:'))?.replace('translation:', '').trim())

  // Resolve aliases through assetMap (audio prefers MIME-safe content proxy).
  const audio = resolveAudioAssetUrl(rawAudio, assetMap)
  const bg = resolveVnImageUrl(rawBg, assetMap)

  return { speaker, expression, audio, bg, bgFit, position, translation }
}

export type AudioAssetResolveMode = 'playback' | 'render'

/**
 * Audio aliases must become a playable URL.
 * - playback: prefer local pack, else same-origin content?inline=1 (MIME-safe for HTMLAudio)
 * - render: prefer signed/public URLs Remotion can fetch without browser cookies
 * Unresolved aliases never fall through as relative paths.
 */
export function resolveAudioAssetUrl(
  value: string | undefined,
  assetMap?: VnAssetMap,
  options?: { mode?: AudioAssetResolveMode },
): string | undefined {
  if (!value) return undefined
  const mode = options?.mode ?? 'playback'
  if (assetMap && Object.prototype.hasOwnProperty.call(assetMap, value)) {
    const entry = assetMap[value]
    if (entry?.signedUrl && isPlayableMediaUrl(entry.signedUrl)) return entry.signedUrl
    if (mode === 'render') {
      if (entry?.signedUrl && isPlayableMediaUrl(entry.signedUrl)) return entry.signedUrl
      if (entry?.fileAssetId) return getFileAssetContentUrl(entry.fileAssetId, '?inline=1')
      return undefined
    }
    if (entry?.fileAssetId) return getFileAssetContentUrl(entry.fileAssetId, '?inline=1')
    if (entry?.signedUrl) {
      const id = fileAssetIdFromUrl(entry.signedUrl)
      if (id) return getFileAssetContentUrl(id, '?inline=1')
      return isPlayableMediaUrl(entry.signedUrl) ? entry.signedUrl : undefined
    }
    return undefined
  }
  if (isPlayableMediaUrl(value)) return value
  const id = fileAssetIdFromUrl(value)
  if (id) return getFileAssetContentUrl(id, '?inline=1')
  if (isVnAssetAlias(value)) return undefined
  return mode === 'render' && isPlayableMediaUrl(value) ? value : undefined
}

export function isBackgroundFit(value?: string): value is 'cover' | 'contain' | 'stretch' | 'repeat' {
  return value === 'cover' || value === 'contain' || value === 'stretch' || value === 'repeat'
}

export function isSpritePosition(value?: string): value is 'left' | 'center' | 'right' {
  return value === 'left' || value === 'center' || value === 'right'
}

function normalizeSpeakerName(value?: string) {
  return (value || '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

export function characterMatchesSpeaker(character: NonNullable<TopicDetail['scene']['characters']>[number], speaker?: string) {
  const normalizedSpeaker = normalizeSpeakerName(speaker)
  if (!normalizedSpeaker) return false
  const candidates = [character.name, character.displayName].map(normalizeSpeakerName).filter(Boolean)
  return candidates.some((candidate) =>
    candidate === normalizedSpeaker ||
    normalizedSpeaker.startsWith(candidate) ||
    candidate.startsWith(normalizedSpeaker),
  )
}

