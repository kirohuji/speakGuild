import { ChevronRight, MessageSquareText, BookmarkPlus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { MarkdownContent } from '@/features/system/components/markdown-content'
import { extractCoreUsage } from '@/lib/markdown-utils'
import type { TopicDetail } from '../api/english-practice-api'

type ChunkItem = TopicDetail['activeChunks'][number]

interface ChunkActivationPanelProps {
  chunks: ChunkItem[]
  totalCount?: number
  collectedCount?: number
  activatedIds: Set<string>
  collectedTexts: Set<string>
  savingTexts: Set<string>
  expandedId: string | null
  onActivate: (chunkId: string) => void
  onExpand: (chunkId: string) => void
  onInspect: (chunkId: string) => void
  onCollect: (chunk: ChunkItem) => void
  onRemove: (chunk: ChunkItem) => void
}

export function ChunkActivationPanel({
  chunks,
  totalCount,
  collectedCount,
  activatedIds,
  collectedTexts,
  savingTexts,
  expandedId,
  onActivate,
  onExpand,
  onInspect,
  onCollect,
  onRemove,
}: ChunkActivationPanelProps) {
  const { t } = useTranslation()
  const hasChunks = chunks.length > 0

  return (
    <div>
      {hasChunks ? (
        <div className="space-y-2">
          {chunks.map((chunk) => (
              <ChunkActivationItem
                key={chunk.id}
                chunk={chunk}
                collected={collectedTexts.has(chunk.text)}
                saving={savingTexts.has(chunk.text)}
                expanded={expandedId === chunk.id}
                onClick={() => {
                  onExpand(chunk.id)
                  if (!activatedIds.has(chunk.id)) onActivate(chunk.id)
                }}
                onInspect={() => onInspect(chunk.id)}
                onCollect={() => onCollect(chunk)}
                onRemove={() => onRemove(chunk)}
              />
            ))}
        </div>
      ) : (
        <div className="rounded-lg bg-background/55 p-4 text-sm text-muted-foreground">
          {t('practiceSession.noChunkHint')}
        </div>
      )}
    </div>
  )
}

function ChunkActivationItem({
  chunk,
  collected,
  saving,
  expanded,
  onClick,
  onInspect,
  onCollect,
  onRemove,
}: {
  chunk: ChunkItem
  collected: boolean
  saving: boolean
  expanded: boolean
  onClick: () => void
  onInspect: () => void
  onCollect: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card
      className={cn(
        'border-0 shadow-none transition-colors',
        expanded ? 'bg-primary/[0.06]' : 'bg-muted/30',
      )}
    >
      <CardContent className="p-0">
        <button
          type="button"
          className="flex w-full items-center gap-3 p-3 text-left"
          onClick={onClick}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <MessageSquareText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{chunk.text}</p>
              {collected && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{t('learning.collected')}</Badge>}
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{chunk.meaning}</p>
          </div>
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </button>

        {expanded && (
          <div className="px-3 pb-3 pt-2 space-y-2">
            {chunk.description && (
              <div className="line-clamp-3 text-xs leading-5 text-muted-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:my-0">
                <MarkdownContent content={extractCoreUsage(chunk.description)} />
              </div>
            )}
            {chunk.examples?.slice(0, 1).map((example, index) => (
              <div key={`${chunk.id}-${index}`} className="rounded-md bg-muted/60 p-2.5">
                <p className="text-xs font-medium text-foreground">{example.en}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{example.zh}</p>
              {example.note && <p className="mt-1 text-[11px] text-muted-foreground">{example.note}</p>}
            </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onInspect() }}>
                <Search className="size-3.5" /> {t('learning.view')}
              </Button>
              <Button size="sm" variant={collected ? 'secondary' : 'default'} className="h-8 flex-1 gap-1.5 text-xs" disabled={saving} onClick={collected ? onRemove : onCollect}>
                <BookmarkPlus className="size-3.5" /> {saving ? t('learning.processing') : collected ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
              </Button>
            </div>
          </div>
        )}
        </CardContent>
      </Card>
  )
}
