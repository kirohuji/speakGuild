import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/cn'

export interface ColumnConfig<T> {
  key: string
  header: string
  cell?: (value: any, row: T) => React.ReactNode
  sortable?: boolean
  width?: number
  align?: 'left' | 'center' | 'right'
}

export interface ConfigDataTableProps<T> {
  data: T[]
  columns: ColumnConfig<T>[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  className?: string
}

export function ConfigDataTable<T extends Record<string, any>>({
  data,
  columns,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  emptyMessage,
  onRowClick,
  className,
}: ConfigDataTableProps<T>) {
  const { t } = useTranslation()
  const [sorting, setSorting] = React.useState<SortingState>([])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const tableColumns: ColumnDef<T>[] = columns.map((col) => ({
    accessorKey: col.key,
    header: col.sortable
      ? ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {col.header}
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        )
      : col.header,
    cell: col.cell
      ? ({ getValue, row }) => col.cell!(getValue(), row.original)
      : undefined,
    size: col.width,
    enableSorting: col.sortable,
    meta: { align: col.align },
  }))

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'h-11 px-4 font-medium text-muted-foreground',
                      (header.column.columnDef.meta as any)?.align === 'right' && 'text-right',
                      (header.column.columnDef.meta as any)?.align === 'center' && 'text-center',
                      (!(header.column.columnDef.meta as any)?.align || (header.column.columnDef.meta as any)?.align === 'left') && 'text-left',
                    )}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, i) => (
                <tr key={i} className="border-b">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage ?? t('common.empty')}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b transition-colors hover:bg-muted/50',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn(
                      'px-4 py-3.5',
                      (cell.column.columnDef.meta as any)?.align === 'right' && 'text-right',
                      (cell.column.columnDef.meta as any)?.align === 'center' && 'text-center',
                    )}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 items-center justify-between text-sm text-muted-foreground">
        <span>
          {t('common.paginationInfo', { total, page, totalPages })}
        </span>
        <div className="flex items-center gap-2">
          {onPageSizeChange && (
            <div className="flex items-center gap-1">
              <span>{t('common.perPage')}</span>
              <Select
                value={String(pageSize)}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="h-7 w-16 text-xs"
              >
                {[10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </Select>
              <span>{t('common.rows')}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
