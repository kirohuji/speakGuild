import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TopicDetail } from '../api/english-practice-api'

interface SentencePatternPanelProps {
  topic: TopicDetail['topic']
  onInspect?: (index: number) => void
}

export function SentencePatternPanel({ topic, onInspect }: SentencePatternPanelProps) {
  const { t } = useTranslation()
  if (!topic.sentencePatterns?.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('practiceSession.sentencePattern')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topic.sentencePatterns.map((item, index) => (
            <button
              key={index}
              type="button"
              className="w-full rounded-lg bg-muted p-3 text-left transition-colors hover:bg-muted/80"
              onClick={() => onInspect?.(index)}
            >
              <p className="font-mono text-sm text-foreground">{item.pattern}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.meaning}</p>
              {item.example && <p className="mt-1 text-xs italic text-muted-foreground">{item.example}</p>}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
