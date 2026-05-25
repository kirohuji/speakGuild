import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TopicDetail } from '../api/english-practice-api'

interface SentencePatternPanelProps {
  topic: TopicDetail['topic']
}

export function SentencePatternPanel({ topic }: SentencePatternPanelProps) {
  if (!topic.sentencePatterns?.length && !topic.sentenceSkeleton) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">句型骨架</CardTitle>
      </CardHeader>
      <CardContent>
        {topic.sentencePatterns?.length ? (
          <div className="space-y-2">
            {topic.sentencePatterns.map((item, index) => (
              <div key={index} className="rounded-lg bg-muted p-3">
                <p className="font-mono text-sm text-foreground">{item.pattern}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.meaning}</p>
                {item.example && <p className="mt-1 text-xs italic text-muted-foreground">{item.example}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
            {topic.sentenceSkeleton}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
