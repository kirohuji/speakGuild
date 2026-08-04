import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ReactReader } from 'react-reader'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { learningApi, type SceneExperience } from '../api/learning-api'

export function LearningReaderPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const [experience, setExperience] = useState<SceneExperience | null>(null)
  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState<string | number>(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renditionRef = useRef<any>(null)

  useEffect(() => {
    if (!unitId) return
    setLoading(true)
    learningApi
      .getSceneExperience(unitId)
      .then((data) => {
        setExperience(data)
        const saved = data?.novelPackage?.progress?.locator?.cfi
        if (typeof saved === 'string') setLocation(saved)
      })
      .catch(() => setExperience(null))
      .finally(() => setLoading(false))
  }, [unitId])

  const handleLocation = useCallback(
    (epubcfi: string) => {
      setLocation(epubcfi)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const rendition = renditionRef.current
      const current = rendition?.currentLocation?.()
      const percentage = Number(
        current?.start?.percentage ??
          rendition?.book?.locations?.percentageFromCfi?.(epubcfi) ??
          experience?.novelPackage?.progress?.percentage ??
          0,
      )
      saveTimer.current = setTimeout(() => {
        if (!unitId) return
        void learningApi.saveNovelProgress(unitId, {
          locator: { cfi: epubcfi },
          percentage: Number.isFinite(percentage) ? Math.max(0, Math.min(1, percentage)) : 0,
        })
      }, 800)
    },
    [unitId, experience],
  )

  const novel = experience?.novelPackage

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Button variant="ghost" size="icon" className="size-9" asChild>
            <Link to={`/learning/units/${unitId}`}><ArrowLeft className="size-5" /></Link>
          </Button>
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!novel) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Button variant="ghost" size="icon" className="size-9" asChild>
            <Link to={`/learning/units/${unitId}`}><ArrowLeft className="size-5" /></Link>
          </Button>
          <span className="text-sm font-semibold">阅读</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
          <div>
            <BookOpen className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p>后台还没有上传 EPUB</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <Button variant="ghost" size="icon" className="size-9" asChild>
          <Link to={`/learning/units/${unitId}`}><ArrowLeft className="size-5" /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">
            {novel.metadata?.title ?? '阅读'}
          </h1>
          {experience?.groupItem && (
            <p className="truncate text-[11px] text-muted-foreground">
              {experience.groupItem.group.name} · 第 {experience.groupItem.sortOrder + 1}/{experience.groupItem.group.items.length} 册
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white text-black">
        <ReactReader
          url={novel.epubUrl}
          title={novel.metadata?.title ?? ''}
          location={location}
          locationChanged={handleLocation}
          getRendition={(rendition) => {
            renditionRef.current = rendition
            void rendition.book.locations.generate(1600).catch(() => undefined)
          }}
          showToc
          epubInitOptions={{ openAs: 'epub' }}
        />
      </div>
    </div>
  )
}
