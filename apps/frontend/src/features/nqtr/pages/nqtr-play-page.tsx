import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VnStoryPreview } from '@/features/admin/components/vn-story-preview'
import { NqtrWorldShell } from '@/features/nqtr/components/nqtr-world-shell'
import { readNqtrSaveHybrid, writeNqtrSaveHybrid } from '@/features/nqtr/api/nqtr-local-save'
import { resolveNqtrChapterUnlock } from '@/features/nqtr/lib/nqtr-chapter-progress'
import { parseNqtrChrome, parseNqtrTime } from '@/features/nqtr/model/nqtr-time-chrome'
import type { NqtrDialogueRenderProps, NqtrStoryPayload } from '@/features/nqtr/model/types'
import { resolveInstalledNqtrBundle } from '@/lib/offline/installed-pack-media'
import { readStoredUnitDetail } from '@/lib/offline/learning-pack-read-model'
import { useLayoutStore } from '@/stores/layout.store'

export function NqtrPlayPage() {
  const { packageId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const chapterId = searchParams.get('chapterId') || undefined
  const setImmersiveMode = useLayoutStore((state) => state.setImmersiveMode)
  const [loading, setLoading] = useState(true)
  const [bundle, setBundle] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [chapterLocked, setChapterLocked] = useState(false)
  const flushRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    setImmersiveMode(true)
    return () => setImmersiveMode(false)
  }, [setImmersiveMode])

  useEffect(() => {
    if (!packageId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setChapterLocked(false)
    void (async () => {
      try {
        const detail = await readStoredUnitDetail(packageId)
        const raw = detail?.offlineNqtrBundle
        if (!raw) {
          if (!cancelled) {
            setError('请先下载并安装这个互动剧本包')
            setBundle(null)
          }
          return
        }
        const resolved = await resolveInstalledNqtrBundle(packageId, raw)
        const save = await readNqtrSaveHybrid(packageId)
        const chapters = resolveNqtrChapterUnlock(
          (resolved?.chapters ?? []).map((chapter: any) => ({
            id: chapter.id,
            title: chapter.title,
            summary: chapter.summary ?? null,
            sortOrder: chapter.sortOrder ?? 0,
          })),
          save,
        )
        const targetId = chapterId || chapters[0]?.id
        const target = chapters.find((chapter) => chapter.id === targetId) ?? chapters[0]
        if (target && !target.isUnlocked) {
          if (!cancelled) {
            setChapterLocked(true)
            setBundle(resolved)
          }
          return
        }
        if (!cancelled) setBundle(resolved)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [chapterId, packageId])

  const chapter = useMemo(() => {
    if (!bundle?.chapters?.length) return null
    if (chapterId) return bundle.chapters.find((item: any) => item.id === chapterId) ?? bundle.chapters[0]
    return bundle.chapters[0]
  }, [bundle, chapterId])

  const openLocations = useMemo(() => new Set<string>(chapter?.locationIds ?? []), [chapter])
  const locations = useMemo(() => {
    const all = bundle?.locations ?? []
    if (!openLocations.size) return all.filter((item: any) => !item.hidden && !item.disabled)
    return all.filter((item: any) => !item.hidden && !item.disabled && openLocations.has(item.id))
  }, [bundle, openLocations])
  const rooms = useMemo(
    () => (bundle?.rooms ?? []).filter((item: any) => locations.some((location: any) => location.id === item.locationId) && !item.hidden && !item.disabled),
    [bundle, locations],
  )

  const time = useMemo(() => parseNqtrTime(bundle?.time), [bundle])
  const chrome = useMemo(() => parseNqtrChrome(bundle?.chrome), [bundle])

  const loadStory = useCallback(async (scriptId: string): Promise<NqtrStoryPayload> => {
    const script = bundle?.inkScripts?.[scriptId]
    if (!script) throw new Error('找不到对白脚本')
    return {
      inkJson: script.inkJson ?? null,
      inkSource: script.inkSource ?? null,
      assetMap: script.assetMap ?? null,
    }
  }, [bundle])

  const renderDialogue = useCallback((props: NqtrDialogueRenderProps) => (
    <VnStoryPreview
      key={props.token}
      inkJson={props.inkJson}
      inkSource={props.inkSource}
      characters={(bundle?.characters ?? []) as any}
      defaultBackgroundUrl={props.defaultBackgroundUrl}
      previewLayout="portrait"
      aiEvaluationEnabled={false}
      holdLastLine
      onDismiss={props.onDismiss}
      className="h-full max-h-none max-w-none rounded-none border-0 bg-transparent shadow-none"
      onDebugChange={props.onDebugChange}
      assetMap={props.assetMap ?? undefined}
    />
  ), [bundle])

  const handleFlushReady = useCallback((flush: () => Promise<void>) => {
    flushRef.current = flush
  }, [])

  const leave = useCallback(async () => {
    try {
      await flushRef.current?.()
    } catch {
      /* best-effort */
    }
    navigate(`/scripts/packages/${packageId}`)
  }, [navigate, packageId])

  if (!packageId) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-4">
        <p className="text-sm text-muted-foreground">缺少剧本包</p>
        <Button asChild variant="secondary"><Link to="/scripts">返回剧本</Link></Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    )
  }

  if (chapterLocked) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">请先完成前面的章节</p>
        <Button variant="secondary" onClick={() => navigate(`/scripts/packages/${packageId}`)}>返回剧本包</Button>
      </div>
    )
  }

  if (error || !bundle || !chapter) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">{error || '这一章还没有准备好'}</p>
        <Button variant="secondary" onClick={() => navigate(`/scripts/packages/${packageId}`)}>返回剧本包</Button>
      </div>
    )
  }

  return (
    <div className="relative flex h-dvh flex-col bg-background">
      <div className="z-30 shrink-0 bg-background pt-[env(safe-area-inset-top,0px)]">
        <div className="flex h-11 w-full items-center gap-2 px-2 text-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 rounded-md px-2 text-xs font-medium text-foreground/80 shadow-none hover:bg-muted hover:text-foreground"
            onClick={() => void leave()}
          >
            <ArrowLeft className="size-3.5" />
            返回
          </Button>
          <span className="min-w-0 flex-1 truncate text-center text-xs font-medium text-foreground/70">
            {chapter.title}
          </span>
          <span className="w-[3.25rem] shrink-0" aria-hidden />
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-background">
        <NqtrWorldShell
          sceneId={packageId}
          chapterId={chapter.id}
          map={bundle.map}
          time={time}
          chrome={chrome}
          characters={bundle.characters ?? []}
          locations={locations}
          rooms={rooms}
          activities={chapter.activities ?? []}
          commitments={chapter.commitments ?? []}
          quests={chapter.quests ?? []}
          loadStory={loadStory}
          readSave={readNqtrSaveHybrid}
          writeSave={writeNqtrSaveHybrid}
          renderDialogue={renderDialogue}
          variant="player"
          onFlushReady={handleFlushReady}
          className="flex h-full min-h-0 flex-col"
          frameClassName="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-slate-950"
        />
      </div>
    </div>
  )
}

export default NqtrPlayPage
