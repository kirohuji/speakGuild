import { PrismaClient } from '@prisma/client'

/**
 * dictionaryapi.dev 自动补全词汇的音标和发音音频。
 * 仅在 ENABLE_DICT_ENRICHMENT=true 时启用。
 */

interface Phonetic {
  text?: string
  audio?: string
}

interface DictEntry {
  word: string
  phonetic?: string
  phonetics: Phonetic[]
}

const entryCache = new Map<string, DictEntry | null>()

async function fetchWord(word: string): Promise<DictEntry | null> {
  const key = word.toLowerCase().trim()
  if (entryCache.has(key)) return entryCache.get(key)!

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`,
    )
    if (!res.ok) {
      entryCache.set(key, null)
      return null
    }
    const data: DictEntry[] = await res.json()
    const entry = data[0] ?? null
    entryCache.set(key, entry)
    return entry
  } catch {
    entryCache.set(key, null)
    return null
  }
}

function extractPhonetic(phonetics: Phonetic[], lang: 'us' | 'uk'): { text?: string; audio?: string } {
  // Try to find US vs UK by audio URL patterns or text markers
  const usIndicators = ['us', 'american', '-us']
  const ukIndicators = ['uk', 'british', '-uk']

  if (lang === 'us') {
    const us = phonetics.find((p) =>
      usIndicators.some((ind) => p.audio?.toLowerCase().includes(ind)),
    )
    if (us) return { text: us.text, audio: us.audio }
  } else {
    const uk = phonetics.find((p) =>
      ukIndicators.some((ind) => p.audio?.toLowerCase().includes(ind)),
    )
    if (uk) return { text: uk.text, audio: uk.audio }
  }

  // Fallback: return first available
  const first = phonetics.find((p) => p.text || p.audio)
  return { text: first?.text, audio: first?.audio }
}

/**
 * Enrich vocabulary records with phonetic and audio data from dictionaryapi.dev.
 * Returns the count of records enriched.
 */
export async function enrichVocabulary(
  prisma: PrismaClient,
  onLog?: (msg: string) => void,
): Promise<number> {
  if (process.env.ENABLE_DICT_ENRICHMENT !== 'true') {
    onLog?.('  ⏭️  Dictionary enrichment disabled (ENABLE_DICT_ENRICHMENT != true)')
    return 0
  }

  const log = onLog ?? console.log
  log('  📖 Enriching vocabulary from dictionaryapi.dev...')

  const words = await prisma.sceneVocabulary.findMany({
    where: {
      OR: [
        { phoneticUs: null },
        { phoneticUk: null },
        { audioUsUrl: null },
        { audioUkUrl: null },
      ],
    },
  })

  let enriched = 0
  for (let i = 0; i < words.length; i++) {
    const w = words[i]

    // Skip phrases with spaces - API only handles single words
    if (w.word.includes(' ')) continue

    try {
      const entry = await fetchWord(w.word)
      if (!entry) continue

      const updates: Record<string, any> = {}

      const us = extractPhonetic(entry.phonetics, 'us')
      const uk = extractPhonetic(entry.phonetics, 'uk')

      if (!w.phoneticUs && us.text) updates.phoneticUs = us.text
      if (!w.phoneticUk && uk.text) updates.phoneticUk = uk.text
      if (!w.audioUsUrl && us.audio) updates.audioUsUrl = us.audio
      if (!w.audioUkUrl && uk.audio) updates.audioUkUrl = uk.audio

      if (Object.keys(updates).length > 0) {
        await prisma.sceneVocabulary.update({
          where: { id: w.id },
          data: updates,
        })
        enriched++
      }

      // Rate limit: 300ms between requests
      await new Promise((r) => setTimeout(r, 300))
    } catch {
      // Skip failed lookups
    }
  }

  log(`  ✓ Enriched ${enriched}/${words.length} vocabulary records`)
  return enriched
}
