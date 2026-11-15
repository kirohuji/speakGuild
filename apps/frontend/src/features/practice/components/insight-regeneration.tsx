import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/auth-provider'
import { getCurrentSessionSnapshot } from '@/providers/auth-session'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { post } from '@/lib/request'
import { showRequestError } from '@/lib/request-feedback'
import { cacheInsightContentPatch, readInsightContentPatch, resolveInsightContentId, type InsightContentKind, type InsightContentPatch } from '@/lib/offline/insight-content'
import { LEARNING_LIBRARY_CHANGED_EVENT } from '@/lib/offline/learning-content.repository'

export function useInsightRegeneration<T extends { kind: InsightContentKind; id: string }>(original: T) {
  const { session } = useAuth()
  const isAdmin = session?.user?.role === 'admin'
  const [edit, setEdit] = useState<{ identity: string; id: string; patch: InsightContentPatch } | null>(null)
  const identity = `${original.kind}:${original.id}`
  useEffect(() => {
    if (!isAdmin) return
    let canceled = false
    const refresh = () => { void (async () => {
      const value = original as any
      const id = await resolveInsightContentId(original.kind, original.id, value.word ?? value.text ?? value.pattern)
      const patch = await readInsightContentPatch(original.kind, id)
      if (!canceled) setEdit({ identity, id, patch })
    })().catch(() => {}) }
    refresh()
    window.addEventListener(LEARNING_LIBRARY_CHANGED_EVENT, refresh)
    return () => { canceled = true; window.removeEventListener(LEARNING_LIBRARY_CHANGED_EVENT, refresh) }
  }, [identity, isAdmin])
  return { item: isAdmin && edit?.identity === identity ? { ...original, id: edit.id, ...edit.patch } as T : original,
    onUpdated: (patch: InsightContentPatch) => setEdit(previous => ({ identity, id: previous?.identity === identity ? previous.id : original.id,
      patch: { ...(previous?.identity === identity ? previous.patch : {}), ...patch } })) }
}

export function InsightRegenerateButton({ item, field, onUpdated }: {
  item: { kind: InsightContentKind; id: string }; field: string; onUpdated: (patch: InsightContentPatch) => void
}) {
  const { session } = useAuth()
  if (session?.user?.role !== 'admin' || !['description', 'examples'].includes(field)) return null
  return <AdminInsightRegenerateButton item={item} field={field} onUpdated={onUpdated} owner={session.user.id} />
}

function AdminInsightRegenerateButton({ item, field, onUpdated, owner }: {
  item: { kind: InsightContentKind; id: string }; field: string; onUpdated: (patch: InsightContentPatch) => void; owner: string
}) {
  const online = useOnlineStatus()
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const identity = `${item.kind}:${item.id}`
  const current = useRef(identity)
  current.current = identity
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const label = field === 'description' ? '重新生成讲解' : '重新生成例句'
  const regenerate = async () => {
    if (!online || working.current) return
    working.current = true; setBusy(true)
    let saved = false
    try {
      const result = await post<{ kind: InsightContentKind; id: string; patch: InsightContentPatch; updatedAt: string }>(
        `/admin/insight-content/${item.kind}/${encodeURIComponent(item.id.replace(/^(word|chunk|pattern):/, ''))}/regenerate`, { field }, { timeout: 180_000, failureCooldownMs: 0 })
      saved = true
      if (getCurrentSessionSnapshot()?.user?.id !== owner) return
      await cacheInsightContentPatch(result.kind, result.id, result.patch)
      if (mounted.current && current.current === identity) onUpdated(result.patch)
      toast.success(field === 'description' ? '讲解已更新' : '例句已更新')
    } catch (error) {
      if (saved) toast.error('后端已保存，本地缓存更新失败，请同步后重试')
      else showRequestError(error, '重新生成未完成，请稍后重试')
    } finally { working.current = false; if (mounted.current) setBusy(false) }
  }
  return <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" disabled={!online || busy}
    aria-label={label} title={online ? label : '离线时无法重新生成'} onClick={() => void regenerate()}>
    <RefreshCw className={busy ? 'size-4 animate-spin' : 'size-4'} />
  </Button>
}
