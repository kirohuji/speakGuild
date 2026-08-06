import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Lock, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import { toast } from 'sonner'
import type { LearningUnitSummary } from '../api/learning-api'
import { getCategoryIcon } from './category-icons'
import { UnitCover } from './unit-cover'
import { useLearningStore } from '@/stores/learning.store'

function packageTypeLabel(t: (key: string) => string, type?: LearningUnitSummary['packageType']) {
  if (type === 'exam') return t('learning.packageTypeExam')
  if (type === 'story') return t('learning.packageTypeStory')
  if (type === 'course') return t('learning.packageTypeCourse')
  if (type === 'foundation') return t('learning.packageTypeFoundation')
  return t('learning.packageTypeDaily')
}

function contentModeLabel(t: (key: string) => string, mode?: LearningUnitSummary['contentMode']) {
  if (mode === 'writing') return t('learning.contentModeWriting')
  if (mode === 'reading') return t('learning.contentModeReading')
  if (mode === 'listening') return t('learning.contentModeListening')
  if (mode === 'novel') return t('learning.contentModeNovel')
  if (mode === 'story') return t('learning.contentModeStory')
  return t('learning.contentModePractice')
}

interface Props {
  unit: LearningUnitSummary & { categoryName?: string }
  onMemberOpen: () => void
  onEnroll?: (id: string) => Promise<void>
  [key: `data-${string}`]: string | undefined
}

export function ShopCard({ unit, onMemberOpen, onEnroll, ...rest }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [detailOpen, setDetailOpen] = useState(false)
  const [acquiring, setAcquiring] = useState(false)
  const [topicPage, setTopicPage] = useState(1)
  const [justEnrolled, setJustEnrolled] = useState(false)
  const pageSize = 6
  const Icon = (unit.isUnlocked && !unit.isLocked) ? getCategoryIcon(unit.categoryName ?? '') : Lock
  const totalTopicPages = Math.max(1, Math.ceil((unit.topics?.length ?? 0) / pageSize))
  const pagedTopics = (unit.topics ?? []).slice((topicPage - 1) * pageSize, topicPage * pageSize)
  const isJoinedInPlan = useLearningStore((s) => s.myUnits.some((myUnit) => myUnit.id === unit.id))

  // 下载进度
  const downloadTask = useLearningStore((s) =>
    s.downloadTasks.find((t) => t.packId === unit.id),
  )
  const installedPack = useLearningStore((s) =>
    s.downloadedPacks.find((pack) => pack.packId === unit.id && pack.status === 'installed'),
  )
  const isDownloading = downloadTask?.status === 'downloading' || downloadTask?.status === 'extracting'
  const isPackReady = Boolean(installedPack || downloadTask?.status === 'done')
  const isJoined = isJoinedInPlan && isPackReady
  const downloadProgress = downloadTask?.progress ?? 0

  const handleAcquire = useCallback(async () => {
    if (acquiring || !unit.isUnlocked || unit.isLocked) return
    setAcquiring(true)
    try {
      await onEnroll?.(unit.id)
      setJustEnrolled(true)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || ''
      if (msg.includes('最多同时')) {
        toast.error(msg)
      }
      // 其他错误也静默处理，让用户可以在 dialog 中重试
    } finally {
      setAcquiring(false)
    }
  }, [unit.id, unit.isUnlocked, acquiring, onEnroll])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!unit.isUnlocked || unit.isLocked) { onMemberOpen(); return }
          setTopicPage(1); setDetailOpen(true)
        }}
        className="flex w-full gap-3 rounded-lg bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50"
        {...rest}
      >
        <UnitCover unit={unit} icon={Icon} />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-1 flex-1 text-sm font-semibold leading-5 text-foreground">{unit.title}</h3>
            {(!unit.isUnlocked || unit.isLocked) && <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{unit.location}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {unit.topicCount}{t('learning.topics')} · {unit.vocabCount}{t('learning.vocab')} · {unit.chunkCount}{t('learning.chunks')}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">{packageTypeLabel(t, unit.packageType)}</Badge>
            <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">{contentModeLabel(t, unit.contentMode)}</Badge>
            {unit.categoryName && <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">{unit.categoryName}</Badge>}
            {isJoined && (
              <Badge variant="outline" className="h-5 rounded-full border-emerald-400/50 px-2 text-[10px] text-emerald-600 dark:text-emerald-400">
                {unit.completionPercent}%
              </Badge>
            )}
            <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
              Lv.{unit.requiredUserLevel}
            </Badge>
          </div>
          {isDownloading && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-muted-foreground">
                {Math.round(downloadProgress)}%
              </span>
            </div>
          )}
          {downloadTask?.status === 'queued' && (
            <p className="mt-1 text-[10px] text-muted-foreground">{t('learning.queued')}</p>
          )}
        </div>
      </button>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="flex max-h-[88dvh] w-[90vw] min-w-0 flex-col gap-0 overflow-y-auto overscroll-contain rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>{unit.title}</DialogTitle>
            <DialogDescription>{unit.location}</DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 flex-col">
            <div className="flex gap-3 bg-muted/30 p-4">
              <UnitCover unit={unit} icon={Icon} className="size-20" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="rounded-full text-[10px]">{packageTypeLabel(t, unit.packageType)}</Badge>
                  <Badge variant="secondary" className="rounded-full text-[10px]">{contentModeLabel(t, unit.contentMode)}</Badge>
                  {unit.categoryName && <Badge variant="secondary" className="rounded-full text-[10px]">{unit.categoryName}</Badge>}
                  {(!unit.isUnlocked || unit.isLocked) && <Badge variant="outline" className="rounded-full text-[10px]">{t('learning.locked')}</Badge>}
                </div>
                <h3 className="mt-2 line-clamp-2 text-base font-bold leading-5 text-foreground">{unit.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{unit.location}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{unit.vocabCount} {t('learning.vocab')}</span>
                  <span>{unit.chunkCount} {t('learning.chunks')}</span>
                  <span>{unit.topicCount} {t('learning.topics')}</span>
                </div>
              </div>
            </div>

            {unit.description && (
              <div className="border-b border-border/50 px-4 py-3">
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">基本介绍</p>
                <MarkdownRenderer
                  content={unit.description}
                  className="text-xs leading-5 text-muted-foreground [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0"
                />
              </div>
            )}

            <div className="p-4">
              {isDownloading ? (
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{downloadProgress}%</span>
                </div>
              ) : downloadTask?.status === 'queued' ? (
                <Button className="w-full gap-2" disabled>
                  <Spinner data-icon="inline-start" />
                  {t('learning.waitingDownload')}
                </Button>
              ) : downloadTask?.status === 'error' ? (
                <Button className="w-full gap-2" variant="destructive" onClick={handleAcquire}>
                  {t('learning.downloadFailedRetry')}
                </Button>
              ) : downloadTask?.status === 'done' || justEnrolled ? (
                <Button variant="outline" className="w-full gap-2" onClick={() => { setDetailOpen(false); navigate(`/learning/units/${unit.id}`) }}>
                  <ArrowRight className="size-4" />
                  {t('learning.continue')}
                </Button>
              ) : isJoined ? (
                <Button variant="outline" className="w-full gap-2" onClick={() => { setDetailOpen(false); navigate(`/learning/units/${unit.id}`) }}>
                  <ArrowRight className="size-4" />
                  {t('learning.continue')}
                </Button>
              ) : (
                <Button className="w-full gap-2" disabled={!unit.isUnlocked || unit.isLocked || acquiring} onClick={handleAcquire} data-spotlight="confirm-start">
                  {acquiring ? <Spinner data-icon="inline-start" /> : <ArrowRight className="size-4" />}
                  {acquiring ? t('learning.downloading') : unit.isUnlocked && !unit.isLocked ? t('learning.start') : `${t('learning.level')}.${unit.requiredUserLevel} ${t('learning.unlock')}`}
                </Button>
              )}
            </div>

            <div className="bg-muted/30 px-4 py-2.5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">{t('learning.topicList')}</p>
                {totalTopicPages > 1 && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="上一页话题"
                      disabled={topicPage === 1}
                      onClick={() => setTopicPage((p) => Math.max(1, p - 1))}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-35"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="min-w-9 text-center text-[11px] tabular-nums text-muted-foreground">{topicPage}/{totalTopicPages}</span>
                    <button
                      type="button"
                      aria-label="下一页话题"
                      disabled={topicPage === totalTopicPages}
                      onClick={() => setTopicPage((p) => Math.min(totalTopicPages, p + 1))}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-35"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-2 pb-4">
              {pagedTopics.length > 0 ? (
                <div className="space-y-1.5">
                  {pagedTopics.map((topic, index) => (
                    <div key={topic.id} className="flex min-w-0 items-center gap-3 overflow-hidden rounded-lg bg-muted/25 px-3 py-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {(topicPage - 1) * pageSize + index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-foreground">{topic.title}</p>
                        <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">
                          {topic.description?.trim() || '暂无说明'}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">{topic.difficulty}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('learning.noTopics')}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
