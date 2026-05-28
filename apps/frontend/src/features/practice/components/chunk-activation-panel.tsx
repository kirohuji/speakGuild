import { ChevronRight, Lightbulb, MessageSquareText, BookmarkPlus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import type { TopicDetail } from '../api/english-practice-api'

type ChunkItem = TopicDetail['activeChunks'][number]

interface ChunkActivationPanelProps {
  chunks: ChunkItem[]
  activatedIds: Set<string>
  collectedTexts: Set<string>
  expandedId: string | null
  onActivate: (chunkId: string) => void
  onExpand: (chunkId: string) => void
  onInspect: (chunkId: string) => void
  onCollect: (chunk: ChunkItem) => void
}

export function ChunkActivationPanel({
  chunks,
  activatedIds,
  collectedTexts,
  expandedId,
  onActivate,
  onExpand,
  onInspect,
  onCollect,
}: ChunkActivationPanelProps) {
  const hasChunks = chunks.length > 0

  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">核心表达块</p>
        </div>
        <Badge variant="secondary" className="rounded-full text-[10px]">
          {collectedTexts.size}/{chunks.length}
        </Badge>
      </div>
      {hasChunks ? (
        <>
          <p className="mb-3 text-xs leading-5 text-muted-foreground">
            点开表达块确认含义和例句，已收录的会标出。
          </p>
          <div className="space-y-2">
            {chunks.map((chunk) => (
              <ChunkActivationItem
                key={chunk.id}
                chunk={chunk}
                collected={collectedTexts.has(chunk.text)}
                expanded={expandedId === chunk.id}
                onClick={() => {
                  onExpand(chunk.id)
                  if (!activatedIds.has(chunk.id)) onActivate(chunk.id)
                }}
                onInspect={() => onInspect(chunk.id)}
                onCollect={() => onCollect(chunk)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg bg-background/55 p-4 text-sm text-muted-foreground">
          这个话题还没有配置核心 Chunk，可以直接开始练习。
        </div>
      )}
    </div>
  )
}

function ChunkActivationItem({
  chunk,
  collected,
  expanded,
  onClick,
  onInspect,
  onCollect,
}: {
  chunk: ChunkItem
  collected: boolean
  expanded: boolean
  onClick: () => void
  onInspect: () => void
  onCollect: () => void
}) {
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
              {collected && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">已收录</Badge>}
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{chunk.meaning}</p>
          </div>
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </button>

        {expanded && (
          <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-2">
            {chunk.description && <p className="text-xs leading-relaxed text-muted-foreground">{chunk.description}</p>}
            {chunk.examples?.slice(0, 2).map((example, index) => (
              <div key={`${chunk.id}-${index}`} className="rounded-md bg-muted/60 p-2.5">
                <p className="text-xs font-medium text-foreground">{example.en}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{example.zh}</p>
              {example.note && <p className="mt-1 text-[11px] text-muted-foreground">{example.note}</p>}
            </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onInspect() }}>
                <Search className="size-3.5" /> 查看
              </Button>
              <Button size="sm" variant={collected ? 'secondary' : 'default'} className="h-8 flex-1 gap-1.5 text-xs" disabled={collected} onClick={onCollect}>
                <BookmarkPlus className="size-3.5" /> {collected ? '已加入' : '加入学习库'}
              </Button>
            </div>
          </div>
        )}
        </CardContent>
      </Card>
  )
}
