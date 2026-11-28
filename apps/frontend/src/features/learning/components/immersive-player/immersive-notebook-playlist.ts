import type { LearningInsightItem } from '@/features/practice/components/learning-insight-dialog'
import type { PatternSlot } from '@/features/learning/lib/pattern-slot'
import {
  learningNotebookRepository,
  type LocalExpressionListRequest,
  type LocalNotebookExpression,
} from '@/lib/offline/learning-notebook.repository'
import type { InsightListItem } from '@/lib/offline/insight-playlist'
import type { ImmersiveLibraryTab, ImmersiveListSort } from './immersive-session.store'

export type NotebookPlaylistFilters = {
  notebookId: string
  libraryTab: ImmersiveLibraryTab
  reviewState?: string | 'all'
  search?: string
  sort?: ImmersiveListSort
}

export function notebookTabToApiType(
  libraryTab: ImmersiveLibraryTab,
): LocalExpressionListRequest['type'] {
  if (libraryTab === 'words') return 'word'
  if (libraryTab === 'pattern') return 'scene_phrase'
  return 'chunk'
}

export function toLocalExpressionListRequest(
  filters: NotebookPlaylistFilters,
): LocalExpressionListRequest {
  return {
    notebookId: filters.notebookId,
    type: notebookTabToApiType(filters.libraryTab),
    reviewState:
      !filters.reviewState || filters.reviewState === 'all'
        ? undefined
        : filters.reviewState,
    search: filters.search?.trim() || undefined,
    sort: filters.sort ?? 'newest',
  }
}

/** Map a notebook expression row into LearningInsightItem (same shape as ExpressionLibraryPage). */
export function mapLocalExpressionToInsight(
  expr: LocalNotebookExpression,
  apiType: LocalExpressionListRequest['type'],
): LearningInsightItem | null {
  if (apiType === 'word') {
    const vocab = expr.vocabulary as
      | {
          id?: string
          word?: string
          meaning?: string
          partOfSpeech?: string | null
          phoneticUs?: string | null
          phoneticUk?: string | null
          audioUsUrl?: string | null
          audioUkUrl?: string | null
          definitionEn?: string | null
          synonyms?: string[]
          examples?: unknown
          description?: string | null
          difficulty?: string
        }
      | null
      | undefined
    const word = (vocab?.word || expr.original || '').trim()
    if (!word) return null
    return {
      kind: 'word' as const,
      id: vocab?.id || expr.sourceId || `word:${expr.original ?? expr.id}`,
      word,
      meaning: vocab?.meaning || expr.chunkText || expr.corrected || undefined,
      partOfSpeech: vocab?.partOfSpeech,
      phoneticUs: vocab?.phoneticUs,
      phoneticUk: vocab?.phoneticUk,
      audioUsUrl: vocab?.audioUsUrl,
      audioUkUrl: vocab?.audioUkUrl,
      definitionEn: vocab?.definitionEn,
      synonyms: vocab?.synonyms,
      examples: vocab?.examples,
      description:
        vocab?.description ||
        (expr.corrected && expr.corrected !== expr.chunkText ? expr.corrected : undefined),
      difficulty: vocab?.difficulty,
      sceneName: expr.sceneName ?? undefined,
    }
  }

  if (apiType === 'scene_phrase') {
    const remoteData = expr.contentData as
      | {
          id?: string
          pattern?: string
          meaning?: string
          slots?: unknown
          example?: string
          description?: string | null
          examples?: unknown
          difficulty?: string
        }
      | null
      | undefined
    const pattern = (remoteData?.pattern || expr.chunkText || expr.corrected || '').trim()
    if (!pattern) return null
    return {
      kind: 'pattern' as const,
      id: remoteData?.id || expr.sourceId || expr.id,
      pattern,
      meaning: remoteData?.meaning || expr.original || '',
      slots: remoteData?.slots as PatternSlot[] | undefined,
      example: remoteData?.example || expr.corrected,
      description: remoteData?.description,
      examples: remoteData?.examples,
      difficulty: remoteData?.difficulty,
      sceneName: expr.sceneName ?? undefined,
    }
  }

  const remoteData = expr.contentData as
    | {
        id?: string
        text?: string
        meaning?: string
        description?: string | null
        examples?: unknown
      }
    | null
    | undefined
  const text = (remoteData?.text || expr.chunkText || expr.corrected || '').trim()
  if (!text) return null
  return {
    kind: 'chunk' as const,
    id: remoteData?.id || expr.sourceId || expr.id,
    text,
    meaning: remoteData?.meaning || expr.original || '',
    description: remoteData?.description,
    examples: remoteData?.examples as never,
    sceneName: expr.sceneName ?? undefined,
    saved: true,
  }
}

export function createNotebookLeanPlaylistFetchers(filters: NotebookPlaylistFilters) {
  const request = toLocalExpressionListRequest(filters)
  const apiType = request.type

  return {
    fetchPage: async ({
      offset,
      limit,
    }: {
      offset: number
      limit: number
    }): Promise<{ items: InsightListItem[]; total: number }> => {
      if (!filters.notebookId) return { items: [], total: 0 }
      return learningNotebookRepository.listCachedExpressionLeanPage({
        ...request,
        limit,
        offset,
      })
    },
    fetchDetail: async (id: string): Promise<LearningInsightItem | null> => {
      if (!filters.notebookId) return null
      const expr = await learningNotebookRepository.getCachedExpressionDetail(id)
      if (!expr) return null
      return mapLocalExpressionToInsight(expr, apiType)
    },
  }
}
