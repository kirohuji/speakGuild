import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'

export const ADMIN_PAGE_SIZES = [10, 15, 20, 50]

export function getTotalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function getPageItems<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function AdminPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizes = ADMIN_PAGE_SIZES,
  className,
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizes?: number[]
  className?: string
}) {
  const totalPages = getTotalPages(total, pageSize)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const rangeStart = (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(total, safePage * pageSize)
  const numberFormat = new Intl.NumberFormat('zh-CN')

  if (total <= 0) return null

  return (
    <nav
      aria-label="列表分页"
      className={cn(
        'flex flex-col gap-3 border-t border-border/70 bg-muted/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap text-xs text-muted-foreground">每页</span>
        <Select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="每页显示条数"
          className="h-8 w-[72px] bg-background text-xs tabular-nums"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </Select>
        <span className="whitespace-nowrap text-xs text-muted-foreground">条</span>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground sm:text-center">
        <span className="hidden md:inline">显示 {numberFormat.format(rangeStart)}–{numberFormat.format(rangeEnd)}，</span>
        共 {numberFormat.format(total)} 条
      </p>
      <div className="flex items-center justify-between gap-1 sm:justify-end">
        <Button
          variant="outline"
          size="icon"
          className="size-8 bg-background"
          aria-label="上一页"
          title="上一页"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Button>
        <span className="min-w-20 px-2 text-center text-xs tabular-nums text-muted-foreground">
          第 <strong className="font-medium text-foreground">{safePage}</strong> / {totalPages} 页
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8 bg-background"
          aria-label="下一页"
          title="下一页"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  )
}
