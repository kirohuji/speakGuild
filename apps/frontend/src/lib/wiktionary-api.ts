/**
 * Wiktionary REST API — https://en.wiktionary.org/api/rest_v1/
 * 免费、无需 API Key，提供定义、词性、例句、发音音频
 *
 * 接口:
 *   定义: GET /page/definition/{word}
 *   音频: GET /page/media-list/{word}  ← 列出页面媒体文件（含 .ogg/.mp3 发音）
 */

export interface WiktionaryResult {
  word: string
  partOfSpeech?: string
  definitions: Array<{ definition: string; examples: string[] }>
  audioUrl?: string
}

/**
 * 查询 Wiktionary
 * @param word 英文单词
 */
export async function lookupWiktionary(word: string): Promise<WiktionaryResult | null> {
  const key = word.toLowerCase().trim()

  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(key)}`,
    )
    if (!res.ok) return null

    const data = await res.json()
    const entries = data?.en ?? []
    if (!entries.length) return null

    const first = entries[0]
    const definitions = entries.flatMap((e: any) =>
      (e.definitions || []).map((d: any) => ({
        definition: d.definition?.replace(/<[^>]+>/g, '') ?? '',
        examples: (d.examples || []).map((ex: string) => ex.replace(/<[^>]+>/g, '')),
      }))
    )

    // 获取音频: /page/media-list/{word} 列出页面上的媒体文件
    let audioUrl = ''
    try {
      const mediaRes = await fetch(
        `https://en.wiktionary.org/api/rest_v1/page/media-list/${encodeURIComponent(key)}`,
      )
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json()
        const items: any[] = mediaData?.items ?? []
        // 优先找美式发音 (.ogg/.mp3)，文件名含 "en-us"
        const audioItem = items.find((i: any) =>
          i.type === 'audio' &&
          (i.title?.toLowerCase().includes('en-us') || i.title?.toLowerCase().includes('en_us')),
        ) ?? items.find((i: any) => i.type === 'audio')
        if (audioItem?.title) {
          // 媒体标题如 "File:en-us-introduce.ogg" → 取文件名
          const fileName = audioItem.title.replace(/^File:/i, '')
          // Wikimedia Commons 直接文件路径
          audioUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`
        }
      }
    } catch { /* ignore media errors */ }

    return {
      word: first.word ?? key,
      partOfSpeech: first.partOfSpeech,
      definitions: definitions.slice(0, 8),
      audioUrl,
    }
  } catch {
    return null
  }
}
