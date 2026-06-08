import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Lock, ArrowRight, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import type { LearningUnitSummary } from '../api/learning-api'
import { getCategoryIcon } from './category-icons'
import { UnitCover } from './unit-cover'

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
  const [descExpanded, setDescExpanded] = useState(false)
  const pageSize = 6
  const Icon = (unit.isUnlocked && !unit.isLocked) ? getCategoryIcon(unit.categoryName ?? '') : Lock
  const totalTopicPages = Math.max(1, Math.ceil((unit.topics?.length ?? 0) / pageSize))
  const pagedTopics = (unit.topics ?? []).slice((topicPage - 1) * pageSize, topicPage * pageSize)
  const isJoined = unit.progress !== null

  const handleAcquire = useCallback(async () => {
    if (acquiring || !unit.isUnlocked || unit.isLocked) return
    setAcquiring(true)
    try {
      await onEnroll?.(unit.id)
      navigate(`/learning/units/${unit.id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || ''
      if (msg.includes('最多同时')) {
        toast.error(msg)
      } else {
        navigate(`/learning/units/${unit.id}`)
      }
    } finally {
      setAcquiring(false)
    }
  }, [unit.id, unit.isUnlocked, acquiring, navigate, onEnroll])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!unit.isUnlocked || unit.isLocked) { onMemberOpen(); return }
          setTopicPage(1); setDescExpanded(false); setDetailOpen(true)
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
        </div>
      </button>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden rounded-2xl p-0 sm:max-w-md w-[90vw]">
          <DialogHeader className="sr-only">
            <DialogTitle>{unit.title}</DialogTitle>
            <DialogDescription>{unit.location}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[88vh] flex-col">
            <div className="flex gap-3 bg-muted/30 p-4">
              <UnitCover unit={unit} icon={Icon} className="size-20" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
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
                <p className={cn('text-xs leading-5 text-muted-foreground', !descExpanded && 'line-clamp-1')}>
                  {unit.description}
                </p>
                {unit.description.length > 40 && (
                  <button
                    type="button"
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-1 flex items-center gap-0.5 text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
                  >
                    {descExpanded ? t('common.collapse') : t('common.expand')}
                    <ChevronDown className={cn('size-3 transition-transform', descExpanded && 'rotate-180')} />
                  </button>
                )}
              </div>
            )}

            <div className="p-4">
              {isJoined ? (
                <Button variant="outline" className="w-full gap-2" onClick={() => { setDetailOpen(false); navigate(`/learning/units/${unit.id}`) }}>
                  <ArrowRight className="size-4" />
                  {t('learning.continue')}
                </Button>
              ) : (
                <Button className="w-full gap-2" disabled={!unit.isUnlocked || unit.isLocked || acquiring} onClick={handleAcquire} data-spotlight="confirm-start">
                  {acquiring ? <Spinner data-icon="inline-start" /> : <ArrowRight className="size-4" />}
                  {acquiring ? '下载中' : unit.isUnlocked && !unit.isLocked ? t('learning.start') : `${t('learning.level')}.${unit.requiredUserLevel} ${t('learning.unlock')}`}
                </Button>
              )}
            </div>

            <div className="bg-muted/30 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">{t('learning.topicList')}</p>
                {unit.topics.length > pageSize && (
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={topicPage === 1} onClick={() => setTopicPage((p) => Math.max(1, p - 1))} className="rounded-full px-2 py-1 text-[11px] text-muted-foreground disabled:opacity-40">
                      {t('common.prevPage')}
                    </button>
                    <span className="text-[11px] text-muted-foreground">{topicPage}/{totalTopicPages}</span>
                    <button type="button" disabled={topicPage === totalTopicPages} onClick={() => setTopicPage((p) => Math.min(totalTopicPages, p + 1))} className="rounded-full px-2 py-1 text-[11px] text-muted-foreground disabled:opacity-40">
                      {t('common.nextPage')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              {pagedTopics.length > 0 ? (
                <div className="space-y-1.5">
                  {pagedTopics.map((topic, index) => (
                    <div key={topic.id} className="flex items-center gap-3 rounded-lg bg-muted/25 px-3 py-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {(topicPage - 1) * pageSize + index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-foreground">{topic.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t('practiceHub.suggested')} {Math.max(1, Math.round(topic.suggestedDurationSec / 60))} {t('practiceSession.minutes')}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[10px]">{topic.difficulty}</Badge>
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
