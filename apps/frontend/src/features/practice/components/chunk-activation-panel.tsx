import { Check, ChevronDown, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  onContinue: () => void
}

export function ChunkActivationPanel({
  chunks,
  activatedIds,
  expandedId,
  onActivate,
  onExpand,
  onContinue,
}: ChunkActivationPanelProps) {
  const hasChunks = chunks.length > 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="size-4" /> 核心表达块 ({activatedIds.size}/{chunks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasChunks ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                先点开表达块确认含义和例句，系统会同步标记为已激活。
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
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              这个话题还没有配置核心 Chunk，可以直接进入开口练习。
            </div>
          )}
        </CardContent>
      </Card>

      <Button className="w-full" disabled={hasChunks && activatedIds.size === 0} onClick={onContinue}>
        下一步：开口练习
      </Button>
    </div>
  )
}

function ChunkActivationItem({
  chunk,
  active,
  expanded,
  onClick,
}: {
  chunk: ChunkItem
  active: boolean
  expanded: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors',
        active ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/40',
      )}
      onClick={onClick}
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
        <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
          <p className="text-sm text-foreground">{chunk.meaning}</p>
          {chunk.description && <p className="text-xs leading-relaxed text-muted-foreground">{chunk.description}</p>}
          {chunk.examples?.slice(0, 2).map((example, index) => (
            <div key={`${chunk.id}-${index}`} className="rounded-md bg-muted p-2">
              <p className="text-xs font-medium text-foreground">{example.en}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{example.zh}</p>
              {example.note && <p className="mt-1 text-[11px] text-muted-foreground">{example.note}</p>}
            </div>
          ))}
        </div>
      )}
    </button>
  )
}
