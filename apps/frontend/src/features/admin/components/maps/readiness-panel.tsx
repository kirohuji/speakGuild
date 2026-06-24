import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { ReadinessItem } from './map-management-shared'

export function ReadinessPanel({
  open,
  onOpenChange,
  okCount,
  totalCount,
  issues,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  okCount: number
  totalCount: number
  issues: ReadinessItem[]
}) {
  return (
    <Card className="overflow-hidden shadow-none">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30"
        onClick={() => onOpenChange(!open)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="size-4" />
            可玩性检查
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount === 0 ? '暂无检查项' : `${okCount}/${totalCount} 项通过`}
          </p>
        </div>
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 py-4">
          {issues.length === 0 ? (
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-2 text-sm">
              <CheckCircle2 className="size-4 text-primary" />
              当前地图结构完整，可以进入预览联调。
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {issues.slice(0, 6).map((item) => (
                <div key={item.key} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <AlertTriangle className="size-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </div>
              ))}
              {issues.length > 6 && (
                <p className="text-xs text-muted-foreground">另有 {issues.length - 6} 项待完善。</p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
