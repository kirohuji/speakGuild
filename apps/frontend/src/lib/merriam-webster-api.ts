/**
 * Merriam-Webster Collegiate Dictionary API
 * https://dictionaryapi.com/products/api-collegiate-dictionary
 *
 * 免费注册获取 API Key: https://dictionaryapi.com/account/register
 * 在 .env 中设: VITE_MW_API_KEY=你的key
 *
 * 接口: GET /api/v3/references/collegiate/json/{word}?key={key}
 */

export interface MwResult {
  word: string
  partOfSpeech?: string
  phonetic?: string         // 音标: "hə-ˈlō"
  audioUrl?: string         // 音频直链
  definitions: Array<{ definition: string }>
  shortdefs: string[]       // 简短释义
}

const MW_API = 'https://www.dictionaryapi.com/api/v3/references/collegiate/json'

/**
 * 查询 Merriam-Webster Collegiate Dictionary
 * @param word 英文单词
 * @param apiKey API Key（环境变量 VITE_MW_API_KEY 或传参）
 */
export async function lookupMwWord(
  word: string,
  apiKey?: string,
): Promise<MwResult | null> {
  const key = apiKey || (import.meta as any).env?.VITE_MW_API_KEY || ''
  if (!key) {
    console.warn('[MW] No API key configured. Set VITE_MW_API_KEY in .env')
    return null
  }

  try {
    const res = await fetch(
      `${MW_API}/${encodeURIComponent(word.toLowerCase().trim())}?key=${key}`,
    )
    if (!res.ok) return null

    const data: any[] = await res.json()
    if (!data.length) return null

    // 如果返回的是字符串数组，说明是拼写建议（未找到）
    if (typeof data[0] === 'string') return null

    const entry = data[0]
    const headword = entry?.hwi?.hw?.replace(/\*/g, '') ?? word
    const phonetic = entry?.hwi?.prs?.[0]?.mw ?? ''
    const audioName = entry?.hwi?.prs?.[0]?.sound?.audio ?? ''
    const audioUrl = audioName
      ? `https://media.merriam-webster.com/audio/prons/en/us/mp3/${audioName[0]}/${audioName}.mp3`
      : ''

    return {
      word: headword,
      partOfSpeech: entry?.fl,
      phonetic,
      audioUrl,
      definitions: (entry?.shortdef || []).map((d: string) => ({ definition: d })),
      shortdefs: entry?.shortdef || [],
    }
  } catch {
    return null
  }
}
