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
  audioUsUrl?: string  // 美式发音
  audioUkUrl?: string  // 英式发音
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
    let audioUsUrl = ''
    let audioUkUrl = ''
    try {
      const mediaRes = await fetch(
        `https://en.wiktionary.org/api/rest_v1/page/media-list/${encodeURIComponent(key)}`,
      )
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json()
        const items: any[] = mediaData?.items ?? []

        // 辅助：从标题生成 Commons 音频直链
        const toAudioUrl = (title: string) => {
          const fileName = title.replace(/^File:/i, '')
          return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`
        }

        // 美式：文件名含 en-us 或 En-us
        const usItem = items.find((i: any) =>
          i.type === 'audio' &&
          (i.title?.toLowerCase().includes('en-us') || i.title?.includes('En-us')),
        )
        if (usItem?.title) audioUsUrl = toAudioUrl(usItem.title)

        // 英式：文件名含 en-uk / En-uk / Received_Pronunciation / RP
        const ukItem = items.find((i: any) =>
          i.type === 'audio' && i !== usItem && (
            i.title?.toLowerCase().includes('en-uk') ||
            i.title?.toLowerCase().includes('received_pronunciation') ||
            i.title?.toLowerCase().includes('_rp_') ||
            i.title?.toLowerCase().includes('british') ||
            i.title?.toLowerCase().includes('uk_english')
          ),
        )
        if (ukItem?.title) audioUkUrl = toAudioUrl(ukItem.title)

        // 兜底：如果没找到分类音频，取第一个通用音频当美式
        if (!audioUsUrl && !audioUkUrl) {
          const anyAudio = items.find((i: any) => i.type === 'audio')
          if (anyAudio?.title) audioUsUrl = toAudioUrl(anyAudio.title)
        }
      }
    } catch { /* ignore media errors */ }

    return {
      word: first.word ?? key,
      partOfSpeech: first.partOfSpeech,
      definitions: definitions.slice(0, 8),
      audioUsUrl,
      audioUkUrl,
    }
  } catch {
    return null
  }
}
