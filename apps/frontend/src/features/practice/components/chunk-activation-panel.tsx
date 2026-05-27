import { Check, ChevronDown, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import type { TopicDetail } from '../api/english-practice-api'

type ChunkItem = TopicDetail['activeChunks'][number]

interface ChunkActivationPanelProps {
  chunks: ChunkItem[]
  activatedIds: Set<string>
  expandedId: string | null
  onActivate: (chunkId: string) => void
  onExpand: (chunkId: string) => void
  onInspect: (chunkId: string) => void
}

export function ChunkActivationPanel({
  chunks,
  activatedIds,
  expandedId,
  onActivate,
  onExpand,
  onInspect,
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
          {activatedIds.size}/{chunks.length}
        </Badge>
      </div>
      {hasChunks ? (
        <>
          <p className="mb-3 text-xs leading-5 text-muted-foreground">
            点开表达块确认含义和例句，系统会同步标记为已激活。
          </p>
          <div className="space-y-2">
            {chunks.map((chunk) => (
              <ChunkActivationItem
                key={chunk.id}
                chunk={chunk}
                active={activatedIds.has(chunk.id)}
                expanded={expandedId === chunk.id}
                onClick={() => {
                  onExpand(chunk.id)
                  if (!activatedIds.has(chunk.id)) onActivate(chunk.id)
                }}
                onInspect={() => onInspect(chunk.id)}
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
  active,
  expanded,
  onClick,
  onInspect,
}: {
  chunk: ChunkItem
  active: boolean
  expanded: boolean
  onClick: () => void
  onInspect: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'w-full rounded-lg p-3 text-left transition-colors',
        active ? 'bg-primary/[0.08]' : 'bg-background/55 hover:bg-background/80',
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{chunk.text}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={active ? 'default' : 'secondary'} className="text-[10px]">
              {active ? '已激活' : '待激活'}
            </Badge>
            {chunk.masteryStatus !== 'not_learned' && (
              <span className="text-xs text-muted-foreground">学习状态：{chunk.masteryStatus}</span>
            )}
          </div>
        </div>
        {active ? <Check className="size-5 shrink-0 text-primary" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-foreground">{chunk.meaning}</p>
          {chunk.description && <p className="text-xs leading-relaxed text-muted-foreground">{chunk.description}</p>}
          {chunk.examples?.slice(0, 2).map((example, index) => (
            <div key={`${chunk.id}-${index}`} className="rounded-md bg-muted p-2">
              <p className="text-xs font-medium text-foreground">{example.en}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{example.zh}</p>
              {example.note && <p className="mt-1 text-[11px] text-muted-foreground">{example.note}</p>}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1"
            onClick={(event) => {
              event.stopPropagation()
              onInspect()
            }}
          >
            查看完整讲解
          </Button>
        </div>
      )}
    </div>
  )
}
