import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import type { PracticeRecord } from '@/features/profile/api'
import { learningRepository } from '@/lib/offline'
import { getTopicSessionForReview } from '@/lib/offline/topic-session-draft.repository'
import type { TopicSession, TrainingTopicItem } from '../api/learning-api'
import { ReadingSessionReview } from '../pages/reading-session-page'
import { WritingSessionReview } from '../pages/writing-session-page'

function normalizeReadingAnswers(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.map((item: any, index: number) => [String(item?.segmentId ?? index), String(item?.text ?? '')]))
  }
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([key, value]) => [String(key), String(value ?? '')]))
}

export function TopicSessionReadonlyReviewDrawer({
  record,
  open,
  onOpenChange,
}: {
  record: PracticeRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [session, setSession] = useState<TopicSession | null>(null)
  const [topic, setTopic] = useState<TrainingTopicItem | null>(null)
  const [unitTitle, setUnitTitle] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !record?.sessionId || !record.topicId) return
    let cancelled = false
    setLoading(true)
    setSession(null)
    setTopic(null)
    setUnitTitle(record.topicName || '')

    const load = async () => {
      const matched = await getTopicSessionForReview(record.sessionId!, record.topicId)
      if (cancelled) return
      setSession(matched)

      const unitId = record.unitId || (matched as { sceneId?: string } | null)?.sceneId
      if (!unitId) {
        setTopic(null)
        return
      }
      const unit = await learningRepository.getUnitDetail(unitId)
      if (cancelled) return
      if (!unit) {
        setTopic(null)
        return
      }
      setUnitTitle(unit.title || record.topicName || '')
      setTopic(unit.trainingTopics.find((item) => item.id === record.topicId) ?? null)
    }

    void load()
      .catch(() => {
        if (!cancelled) {
          setSession(null)
          setTopic(null)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [open, record?.sessionId, record?.topicId, record?.topicName, record?.unitId])

  const response = (session?.submissions?.[0]?.response ?? {}) as Record<string, unknown>
  const close = () => onOpenChange(false)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent showHandle={false} className="h-[100dvh] max-h-[100dvh] rounded-none border-0 bg-background pt-safe">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{record?.recordType === 'reading' ? t('learning.readingPractice') : t('learning.writingPractice')}</DrawerTitle>
        </DrawerHeader>
        {loading ? (
          <MobilePageLoading rows={4} minHeightClassName="min-h-full" />
        ) : !session || !topic ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-muted-foreground">{t('profile.reviewLoadFailed')}</p>
            <Button variant="outline" size="sm" onClick={close}>{t('common.close')}</Button>
          </div>
        ) : record?.recordType === 'reading' ? (
          <ReadingSessionReview
            topic={topic}
            unitTitle={unitTitle}
            onClose={close}
            review={{
              answers: normalizeReadingAnswers(response.answers),
              analysis: session.analysisResult ?? null,
              analysisError: session.analysisError ?? null,
              hideRetry: true,
            }}
          />
        ) : (
          <WritingSessionReview
            topic={topic}
            unitTitle={unitTitle}
            onClose={close}
            review={{
              response,
              analysis: session.analysisResult ?? null,
              analysisError: session.analysisError ?? null,
            }}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}
