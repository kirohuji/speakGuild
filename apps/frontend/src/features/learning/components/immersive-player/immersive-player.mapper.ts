import type { LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'
import type { ImmersivePlayerItem, ImmersivePlaybackSettings, PlaybackSegment } from './immersive-player.types'

function textOrEmpty(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeExamples(value: unknown): Array<{ en: string; zh?: string; audioUrl?: string | null }> {
  let raw = value
  if (typeof raw === 'string') {
    const text = raw.trim()
    try {
      raw = JSON.parse(text)
    } catch {
      return text ? [{ en: text }] : []
    }
  }
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (typeof item === 'string') return { en: item.trim() }
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const en = textOrEmpty(record.en) || textOrEmpty(record.english) || textOrEmpty(record.sentence) || textOrEmpty(record.text)
      const zh = textOrEmpty(record.zh) || textOrEmpty(record.cn) || textOrEmpty(record.chinese) || textOrEmpty(record.translation)
      const audioUrl = textOrEmpty(record.audioUrl) || null
      return en ? { en, ...(zh ? { zh } : {}), ...(audioUrl ? { audioUrl } : {}) } : null
    })
    .filter(Boolean) as Array<{ en: string; zh?: string; audioUrl?: string | null }>
}

function stripMarkdown(text?: string | null) {
  return (text ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function mapInsightItemToImmersiveItem(item: LearningInsightItem): ImmersivePlayerItem {
  if (item.kind === 'word') {
    const examples = normalizeExamples(item.examples)
    const example = examples[0]
    return {
      id: item.id,
      kind: 'word',
      title: item.word,
      meaning: item.meaning,
      insight: stripMarkdown(item.description || item.definitionEn).slice(0, 220),
      exampleEn: example?.en,
      exampleZh: example?.zh,
      mainAudioUrl: item.audioUsUrl || item.audioUkUrl,
      exampleAudioUrl: example?.audioUrl,
      sceneName: item.sceneName,
      source: item,
    }
  }

  if (item.kind === 'chunk') {
    const example = item.examples?.[0]
    return {
      id: item.id,
      kind: 'chunk',
      title: item.text,
      meaning: item.meaning,
      insight: stripMarkdown(item.description).slice(0, 220),
      exampleEn: example?.en,
      exampleZh: example?.zh,
      exampleAudioUrl: (example as any)?.audioUrl,
      sceneName: item.sceneName,
      source: item,
    }
  }

  const examples = normalizeExamples(item.examples)
  const example = examples[0]
  return {
    id: item.id,
    kind: 'pattern',
    title: item.pattern,
    meaning: item.meaning,
    insight: stripMarkdown(item.description).slice(0, 220),
    exampleEn: item.example || example?.en,
    exampleZh: example?.zh,
    exampleAudioUrl: example?.audioUrl,
    sceneName: item.sceneName,
    source: item,
  }
}

export function mapInsightItemsToImmersiveItems(items: LearningInsightItem[]) {
  return items.map(mapInsightItemToImmersiveItem).filter((item) => item.title.trim())
}

export function buildPlaybackSegments(item: ImmersivePlayerItem, settings: ImmersivePlaybackSettings): PlaybackSegment[] {
  const base: PlaybackSegment[] = []
  if (settings.playMainText && item.title.trim()) {
    base.push({
      id: `${item.id}:main`,
      itemId: item.id,
      role: 'main',
      text: item.title.trim(),
      lang: item.kind === 'word' || item.kind === 'chunk' || item.kind === 'pattern' ? 'en' : 'zh',
      audioUrl: item.mainAudioUrl,
      title: item.title,
      subtitle: item.meaning,
    })
  }
  if (settings.playMeaning && item.meaning?.trim()) {
    base.push({
      id: `${item.id}:meaning`,
      itemId: item.id,
      role: 'meaning',
      text: item.meaning.trim(),
      lang: 'zh',
      title: item.title,
      subtitle: item.meaning,
    })
  }
  if (settings.playExample && item.exampleEn?.trim()) {
    base.push({
      id: `${item.id}:example`,
      itemId: item.id,
      role: 'example',
      text: item.exampleEn.trim(),
      lang: 'en',
      audioUrl: item.exampleAudioUrl,
      title: item.exampleEn.trim(),
      subtitle: item.title,
    })
  }
  if (settings.playExampleTranslation && item.exampleZh?.trim()) {
    base.push({
      id: `${item.id}:exampleTranslation`,
      itemId: item.id,
      role: 'exampleTranslation',
      text: item.exampleZh.trim(),
      lang: 'zh',
      title: item.exampleZh.trim(),
      subtitle: item.title,
    })
  }

  const repeated: PlaybackSegment[] = []
  for (let round = 0; round < settings.repeatPerItem; round += 1) {
    repeated.push(...base.map((segment) => ({ ...segment, id: `${segment.id}:${round}` })))
  }
  return repeated
}

