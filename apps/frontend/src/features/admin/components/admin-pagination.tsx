import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

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
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizes?: number[]
}) {
  const totalPages = getTotalPages(total, pageSize)

  if (total <= 0) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap text-xs text-muted-foreground">每页</span>
        <Select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 w-[72px] text-xs"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </Select>
        <span className="whitespace-nowrap text-xs text-muted-foreground">条</span>
      </div>
      <p className="text-xs text-muted-foreground">
        共 {total} 条，第 {page}/{totalPages} 页
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
