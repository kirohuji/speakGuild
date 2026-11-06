import { localDb } from './unified-storage'
import { createId } from './utils'

export type PackAuditAction = 'install' | 'update' | 'uninstall'

export interface PackAuditEvent {
  id: string
  packId: string
  action: PackAuditAction
  version: number | null
  previousVersion: number | null
  title?: string
  updateMode?: 'full' | 'delta'
  occurredAt: string
}

const RETENTION_MS = 180 * 24 * 60 * 60 * 1000

/** Device-local audit trail. It intentionally never enters the sync outbox. */
export const packAuditService = {
  async record(input: Omit<PackAuditEvent, 'id' | 'occurredAt'>): Promise<void> {
    const occurredAt = new Date().toISOString()
    await localDb.put<PackAuditEvent>('pack_events', {
      ...input,
      id: createId(),
      occurredAt,
    })
  },

  async list(packId?: string): Promise<PackAuditEvent[]> {
    if (packId) return localDb.findByIndex<PackAuditEvent>('pack_events', 'pack_id', packId)
    return localDb.list<PackAuditEvent>('pack_events')
  },

  async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()
    await localDb.deleteWhere<PackAuditEvent>('pack_events', (event) => event.occurredAt < cutoff)
  },
}
