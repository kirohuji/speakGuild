import {
  aiEnrichChunk,
  aiEnrichPattern,
  enrichVocabulary,
  listTrainingTopics,
  updateLibraryChunk,
  updateLibraryPattern,
} from './api-content-admin'
import { getDictionaryEntry } from './api-dictionary'

export interface PackageImportEnrichmentResult {
  vocabChecked: number
  vocabEnriched: number
  chunkChecked: number
  chunkEnriched: number
  patternChecked: number
  patternEnriched: number
  errors: Array<{ type: 'vocabulary' | 'chunk' | 'pattern'; key: string; message: string }>
}

function hasExamples(value: unknown) {
  return Array.isArray(value) && value.length > 0
}

function hasChunkAi(chunk: any) {
  return Boolean(chunk?.description?.trim() && hasExamples(chunk?.examples))
}

function hasVocabularyAi(vocab: any) {
  return Boolean(
    vocab?.definitionEn?.trim() &&
    vocab?.description?.trim() &&
    hasExamples(vocab?.examples) &&
    (vocab?.phoneticUs?.trim() || vocab?.phoneticUk?.trim()),
  )
}

function hasPatternAi(pattern: any) {
  return Boolean(pattern?.description?.trim() && hasExamples(pattern?.examples))
}

export async function prepareImportedPackageContent(sceneId: string): Promise<PackageImportEnrichmentResult> {
  const result: PackageImportEnrichmentResult = {
    vocabChecked: 0,
    vocabEnriched: 0,
    chunkChecked: 0,
    chunkEnriched: 0,
    patternChecked: 0,
    patternEnriched: 0,
    errors: [],
  }

  const topics = await listTrainingTopics(sceneId)
  const vocabById = new Map<string, any>()
  const chunkById = new Map<string, any>()
  const patternById = new Map<string, any>()

  for (const topic of topics) {
    for (const item of topic.topicVocabs ?? []) {
      if (item.vocab?.id) vocabById.set(item.vocab.id, item.vocab)
    }
    for (const item of topic.activeChunks ?? []) {
      if (item.chunk?.id) chunkById.set(item.chunk.id, item.chunk)
    }
    for (const item of topic.topicPatterns ?? []) {
      const pattern = item.pattern as any
      if (pattern?.id) patternById.set(pattern.id, pattern)
    }
  }

  for (const vocab of vocabById.values()) {
    result.vocabChecked++
    try {
      if (vocab.word) await getDictionaryEntry(vocab.word)
      if (!hasVocabularyAi(vocab)) {
        await enrichVocabulary(vocab.id)
        result.vocabEnriched++
      }
    } catch (error: any) {
      result.errors.push({ type: 'vocabulary', key: vocab.word ?? vocab.id, message: error?.message ?? 'unknown error' })
    }
  }

  for (const chunk of chunkById.values()) {
    result.chunkChecked++
    if (hasChunkAi(chunk)) continue
    try {
      const generated = await aiEnrichChunk({ text: chunk.text, meaning: chunk.meaning ?? '' })
      await updateLibraryChunk(chunk.id, {
        description: generated.description,
        examples: generated.examples as any,
      })
      result.chunkEnriched++
    } catch (error: any) {
      result.errors.push({ type: 'chunk', key: chunk.text ?? chunk.id, message: error?.message ?? 'unknown error' })
    }
  }

  for (const pattern of patternById.values()) {
    result.patternChecked++
    if (hasPatternAi(pattern)) continue
    try {
      const generated = await aiEnrichPattern({ pattern: pattern.pattern, meaning: pattern.meaning ?? '' })
      await updateLibraryPattern(pattern.id, {
        description: generated.description,
        examples: generated.examples,
      })
      result.patternEnriched++
    } catch (error: any) {
      result.errors.push({ type: 'pattern', key: pattern.pattern ?? pattern.id, message: error?.message ?? 'unknown error' })
    }
  }

  return result
}
