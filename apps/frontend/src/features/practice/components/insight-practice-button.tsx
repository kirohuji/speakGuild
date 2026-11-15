import { lazy, Suspense, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Dumbbell, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { localDb } from '@/lib/offline/unified-storage'
import { resolveInsightContentId } from '@/lib/offline/insight-content'
import { filterInsightPracticeItems } from '../lib/insight-practice-items'

const GuidedWarmupPhase = lazy(() => import('./guided-warmup-phase').then(module => ({ default: module.GuidedWarmupPhase })))
type Point = { kind: 'word' | 'chunk' | 'pattern'; id: string; word?: string; text?: string; pattern?: string }

export function InsightPracticeButton({ item, unitId }: { item: Point; unitId?: string }) {
  const route = useParams<{ unitId?: string; topicId?: string }>()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [choices, setChoices] = useState<Array<{ id: string; title: string }>>([])
  const [resolvedPoint, setResolvedPoint] = useState(item)
  const [practice, setPractice] = useState<{ unitId: string; topicId: string; items: any[]; point: Point } | null>(null)
  const label = item.word ?? item.text ?? item.pattern ?? ''

  const load = async (selectedUnit: string, point: Point) => {
    setOpen(true); setLoading(true); setChoices([])
    try {
      const rows = await localDb.findByIndex<any>('downloaded_unit_details', 'unit_id', selectedUnit)
      const legacy = await localDb.get<any>('downloaded_unit_details', selectedUnit)
      if (legacy) rows.push(legacy)
      const topics = new Map<string, { metadata: any; title: string }>()
      for (const row of rows) {
        const topic = row.detail?.topic ?? row.topic
        if (row.rowKind === 'pipeline' && row.topicId) topics.set(row.topicId, { metadata: row.metadata, title: '' })
        else if (topic?.id && topic.metadata && !topics.has(topic.id)) topics.set(topic.id, { metadata: topic.metadata, title: topic.title ?? '' })
        for (const child of row.trainingTopics ?? row.detail?.trainingTopics ?? []) {
          if (child.id && child.metadata && !topics.has(child.id)) topics.set(child.id, { metadata: child.metadata, title: child.title ?? '' })
        }
      }
      const items: any[] = []
      for (const [topicId, topic] of topics) {
        const config = topic.metadata?.outputTraining ?? topic.metadata
        if (config?.enabled === false) continue
        const pipeline = config?.pipeline ?? topic.metadata?.pipeline
        if (!Array.isArray(pipeline)) continue
        for (const question of filterInsightPracticeItems(pipeline, point)) items.push({ ...question,
          __practiceContext: { packId: selectedUnit, topicId, topicTitle: topic.title },
        })
      }
      if (!items.length) { setOpen(false); toast.info('这个学习包中暂无关联的知识点练习'); return }
      setPractice({ unitId: selectedUnit, topicId: items[0].__practiceContext.topicId, items, point })
    } catch { setOpen(false); toast.error('无法读取本地练习，请重试') }
    finally { setLoading(false) }
  }

  const start = async () => {
    if (loading) return
    setLoading(true); setPractice(null); setOpen(true)
    try {
      const id = await resolveInsightContentId(item.kind, item.id, label)
      const point = { ...item, id }
      setResolvedPoint(point)
      let scope = unitId || route.unitId
      if (!scope && route.topicId) {
        const card = await localDb.get<any>('downloaded_unit_details', `topic:${route.topicId}:card`)
          ?? await localDb.get<any>('downloaded_unit_details', `topic:${route.topicId}`)
        scope = card?.unitId
      }
      if (scope) { await load(scope, point); return }
      const refs = await localDb.findByIndex<any>('offline_content_refs', 'content_id', id.replace(/^(word|chunk|pattern):/, ''))
      const units = [...new Set<string>(refs.filter(ref => ref.kind === (item.kind === 'word' ? 'vocab' : item.kind)).map(ref => ref.unitId).filter(Boolean))]
      if (units.length === 1) { await load(units[0], point); return }
      if (!units.length) { setOpen(false); toast.info('请先下载包含这个知识点的学习包'); return }
      const options = await Promise.all(units.map(async id => {
        const summary = await localDb.get<any>('downloaded_unit_details', `unit:${id}:summary`)
        return { id, title: summary?.title || '学习包' }
      }))
      setChoices(options); setOpen(true)
    } catch { setOpen(false); toast.error('无法读取本地练习，请重试') }
    finally { setLoading(false) }
  }

  return <>
    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="知识点练习" title="知识点练习" disabled={loading} onClick={() => void start()}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Dumbbell className="size-4" />}
    </Button>
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) setPractice(null) }}>
      <DialogContent data-insight-practice data-keyboard-overlay="practice" overlayClassName="!z-[10001]" className="app-surface drawer-surface left-0 top-0 !z-[10001] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 pt-safe md:left-[50%] md:top-[50%] md:h-[88vh] md:max-w-3xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">知识点练习</DialogTitle>
        <DialogDescription className="sr-only">{label}</DialogDescription>
        {loading ? <div className="m-auto"><Loader2 className="size-5 animate-spin" /></div> : practice ?
          <Suspense fallback={<div className="m-auto"><Loader2 className="size-5 animate-spin" /></div>}>
            <GuidedWarmupPhase key={`${practice.unitId}:${practice.point.kind}:${practice.point.id}`} packId={practice.unitId}
              topicId={practice.topicId} topicTitle={practice.point.word ?? practice.point.text ?? practice.point.pattern ?? ''}
              sessionId={`insight:${practice.unitId}:${practice.point.kind}:${practice.point.id}`} warmupItems={practice.items}
              onBack={() => { setOpen(false); setPractice(null) }} onComplete={() => { setOpen(false); setPractice(null) }} />
          </Suspense> : <div className="flex flex-col gap-3 p-5">
            <h2 className="font-semibold">选择学习包</h2>
            {choices.map(choice => <Button key={choice.id} variant="outline" onClick={() => void load(choice.id, resolvedPoint)}>{choice.title}</Button>)}
            <Button variant="ghost" onClick={() => setOpen(false)}>返回讲解</Button>
          </div>}
      </DialogContent>
    </Dialog>
  </>
}
