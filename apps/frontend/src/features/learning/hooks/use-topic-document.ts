import { useEffect, useState } from 'react'
import type { TrainingTopicItem } from '../api/learning-api'
import { readTopicTeaching } from '@/lib/offline/learning-pack-read-model'

/** Loads the teaching row for one topic and merges it onto the card. */
export function useTopicDocument<T extends TrainingTopicItem | null>(topic: T): T {
  const [document, setDocument] = useState<any>(null)
  const topicId = topic?.id

  useEffect(() => {
    if (!topicId) return
    let cancelled = false
    readTopicTeaching(topicId).then((row) => {
      if (!cancelled) setDocument(row)
    }).catch(() => {
      if (!cancelled) setDocument(null)
    })
    return () => { cancelled = true }
  }, [topicId])

  if (!topic || !document) return topic
  return {
    ...topic,
    teachingMarkdown: document.teachingMarkdown || topic.teachingMarkdown,
    contentConfig: document.contentConfig ?? topic.contentConfig,
    transcript: document.transcript ?? topic.transcript,
  }
}
