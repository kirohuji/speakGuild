import { compileInk } from '@/features/admin/components/ink-compiler'
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

export function parseVnTags(tags: string[]) {
  const speaker = tags.find((t) => t.startsWith('speaker:'))?.replace('speaker:', '').trim()
  const expression = tags.find((t) => t.startsWith('expression:'))?.replace('expression:', '').trim()
  const audio = decodeTagValue(tags.find((t) => t.startsWith('audio:'))?.replace('audio:', '').trim())
  const bg = decodeTagValue(tags.find((t) => t.startsWith('bg:'))?.replace('bg:', '').trim())
  const bgFit = tags.find((t) => t.startsWith('bgFit:'))?.replace('bgFit:', '').trim()
  const position = tags.find((t) => t.startsWith('position:'))?.replace('position:', '').trim()
  const translation = decodeTagValue(tags.find((t) => t.startsWith('translation:'))?.replace('translation:', '').trim())
  return { speaker, expression, audio, bg, bgFit, position, translation }
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

