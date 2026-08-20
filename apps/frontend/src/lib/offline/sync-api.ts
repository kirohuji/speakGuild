import instance from '@/lib/request'

const SYNC_BASE = '/sync'

export interface PushResult {
  clientMutationId?: string
  status: 'synced' | 'failed' | 'skipped'
  error?: string
  remoteId?: string
  remoteItem?: any
}

export interface PullResult {
  cursors: Record<string, string | null>
  hasMore: Record<string, boolean>
  changed: {
    expressionItems: any[]
    sceneProgresses: any[]
    chunkProgresses: any[]
    practiceSessions: any[]
    practiceTurns: any[]
    practiceWarmupRecords: any[]
    dailyPracticeRuns: any[]
  }
  deleted: {
    expressionItems: string[]
    sceneProgresses: string[]
    chunkProgresses: string[]
  }
}

export interface ContentManifest {
  version: number
  generatedAt: string
  changed: {
    dictionaries: { id: string; updatedAt: string }[]
    vocabularies: { id: string; updatedAt: string }[]
    chunks: { id: string; updatedAt: string }[]
    sentencePatterns: { id: string; updatedAt: string }[]
    scenes: { id: string; updatedAt: string }[]
    topics: { id: string; updatedAt: string }[]
    storyEpisodes: { id: string; updatedAt: string }[]
  }
  deleted: Record<string, string[]>
}

export const syncApi = {
  /** 批量推送离线变更 */
  async push(items: { entityType: string; entityId: string; operation: string; payload: any; clientMutationId?: string }[]): Promise<{ results: PushResult[] }> {
    return instance.post(`${SYNC_BASE}/push`, { items }) as any
  },

  /** 增量拉取用户数据（按类型独立 cursor） */
  async pull(cursors?: Record<string, string> | null): Promise<PullResult> {
    const params = cursors && Object.keys(cursors).length > 0
      ? { cursors: JSON.stringify(cursors) }
      : {}
    return instance.get(`${SYNC_BASE}/pull`, { params }) as any
  },

  /** 公共内容增量 manifest */
  async contentManifest(since?: string | null): Promise<ContentManifest> {
    const params = since ? { since } : {}
    return instance.get(`${SYNC_BASE}/content/manifest`, { params }) as any
  },
}
