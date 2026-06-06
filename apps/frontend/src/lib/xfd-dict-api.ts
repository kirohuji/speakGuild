/**
 * XF English Dictionary API — https://www.xfd.plus/
 * Docs: https://xfenglishdictionary.docs.apiary.io/#reference/0/dictionary
 *
 * RapidAPI: https://rapidapi.com/xf-innovations-xf-innovations-default/api/xf-english-dictionary1
 * 免费档: 10,000 次/天，超出后 $0.004/次
 *
 * 功能: 英文单词/短语释义、例句、词形变化、同义词/反义词、发音（文本+音频）、词频
 *
 * 查短语 (如 "take place"):
 *   Option 1: selection=take, textAfterSelection=place
 *   Option 2: textBeforeSelection=take, selection=place
 * 即：短语中一个词赋给 selection，其余放在 textBefore/After
 */

export interface XfdWordResult {
  word: string
  phonetic?: string        // 音标文本（美式）
  phoneticUk?: string       // 音标文本（英式）
  audioUsUrl?: string       // 美式发音 mp3 直链
  audioUkUrl?: string       // 英式发音 mp3 直链
  meanings?: Array<{
    partOfSpeech: string
    definition: string
    chineseGloss?: string
  }>
  examples?: Array<{
    en: string
    zh: string
  }>
}

const XFD_API = 'https://xf-english-dictionary1.p.rapidapi.com/v1/dictionary'

/**
 * 查询 XF 英语词典
 *
 * @param word              要查询的单词/短语（必填）
 * @param apiKey            RapidAPI Key（环境变量 VITE_XFD_API_KEY 或传参）
 * @param textBefore        目标词之前的文本，用于语言学分析提高准确性（可选）
 * @param textAfter         目标词之后的文本，用于语言学分析提高准确性（可选）
 * @param relatedWords      是否返回相关词（如同根词），默认 true（可选）
 * @param wordForms         是否返回词形变化（复数/比较级/时态等），默认 true（可选）
 * @param synonyms          是否返回同义词，默认 true（可选）
 * @param antonyms          是否返回反义词，默认 true（可选）
 * @param pronunciations    是否返回发音信息（音标），默认 true（可选）
 * @param audioFileLinks    是否返回发音音频文件直链，默认 true（可选）
 * @param wordFrequencies   是否返回词频信息，默认 true（可选）
 *
 * @returns 解析后的词典数据，失败或无结果返回 null
 */
export async function lookupXfdWord(
  word: string,
  apiKey?: string,
  textBefore?: string,
  textAfter?: string,
  relatedWords?: boolean,
  wordForms?: boolean,
  synonyms?: boolean,
  antonyms?: boolean,
  pronunciations?: boolean,
  audioFileLinks?: boolean,
  wordFrequencies?: boolean,
): Promise<XfdWordResult | null> {
  const key = apiKey || (import.meta as any).env?.VITE_XFD_API_KEY || ''
  if (!key) {
    console.warn('[XFD] No RapidAPI key configured. Set VITE_XFD_API_KEY in .env')
    return null
  }

  const target = word.trim()

  try {
    // 构建查询参数
    const url = new URL(XFD_API)
    url.searchParams.set('selection', target)
    if (textBefore) url.searchParams.set('textBeforeSelection', textBefore)
    if (textAfter) url.searchParams.set('textAfterSelection', textAfter)
    // 可按需关闭不需要的数据以减小响应体积
    if (relatedWords === false) url.searchParams.set('relatedWords', 'false')
    if (wordForms === false) url.searchParams.set('wordForms', 'false')
    if (synonyms === false) url.searchParams.set('synonyms', 'false')
    if (antonyms === false) url.searchParams.set('antonyms', 'false')
    if (pronunciations === false) url.searchParams.set('pronunciations', 'false')
    if (audioFileLinks !== false) url.searchParams.set('audioFileLinks', 'true')
    if (wordFrequencies === false) url.searchParams.set('wordFrequencies', 'false')

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'xf-english-dictionary1.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selection: target,
        textBeforeSelection: textBefore || '',
        textAfterSelection: textAfter || '',
        audioFileLinks: audioFileLinks !== false,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()

    // XF API 响应结构:
    //   items[]       — 词典条目 (第一条是 target word，后续是相关词)
    //   pronunciations — 发音信息
    //   target        — 原始查询词

    const items: any[] = data?.items ?? []
    if (!items.length) return null

    // 找到 target word 对应的条目
    const targetWord = (data.target || target).toLowerCase()
    const entry = items.find((w: any) => w.word?.toLowerCase() === targetWord) ?? items[0]

    // 提取释义和例句
    const defs = entry.definitions ?? []
    const meanings = defs.map((d: any) => ({
      partOfSpeech: entry.partOfSpeech ?? '',
      definition: d.definition?.replace(/<[^>]+>/g, '') ?? '',
    }))

    const allExamples = defs.flatMap((d: any) =>
      (d.examples ?? []).map((e: string) => ({
        en: e.replace(/<[^>]+>/g, ''),
        zh: '',
        level: 'intermediate' as const,
      })),
    ).slice(0, 5)

    // 提取发音
    const pronEntries: any[] = data?.pronunciations?.[0]?.entries ?? []
    const pronEntry = pronEntries.find((p: any) =>
      p.entry?.toLowerCase() === targetWord,
    ) ?? pronEntries[0]

    const phonetic = pronEntry?.textual?.[0]?.pronunciation ?? ''
    // XF 音频文件是相对路径，但 RapidAPI 未暴露音频下载接口，留空由用户手动上传
    const audioFiles: any[] = pronEntry?.audioFiles ?? []

    return {
      word: entry.word ?? target,
      phonetic,
      audioUsUrl: '',   // XF 音频接口不可用，需手动上传
      audioUkUrl: '',
      meanings,
      examples: allExamples,
    }
  } catch {
    return null
  }
}
