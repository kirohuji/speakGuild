import instance from '@/lib/request'

const SYNC_BASE = '/sync'

export interface PushResult {
  clientMutationId?: string
  status: 'synced' | 'failed' | 'skipped'
  error?: string
  remoteId?: string
}

export interface PullResult {
  cursor: string
  changed: {
    expressionItems: any[]
    sceneProgresses: any[]
    chunkProgresses: any[]
    practiceSessions: any[]
    practiceTurns: any[]
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
    scriptEpisodes: { id: string; updatedAt: string }[]
  }
  deleted: Record<string, string[]>
}

export const syncApi = {
  /** 批量推送离线变更 */
  async push(items: { entityType: string; entityId: string; operation: string; payload: any; clientMutationId?: string }[]): Promise<{ results: PushResult[] }> {
    return instance.post(`${SYNC_BASE}/push`, { items }) as any
  },

  /** 增量拉取用户数据 */
  async pull(cursor?: string | null): Promise<PullResult> {
    const params = cursor ? { cursor } : {}
    return instance.get(`${SYNC_BASE}/pull`, { params }) as any
  },

  /** 公共内容增量 manifest */
  async contentManifest(since?: string | null): Promise<ContentManifest> {
    const params = since ? { since } : {}
    return instance.get(`${SYNC_BASE}/content/manifest`, { params }) as any
  },
}
