import { useMemo, useState } from 'react'
import { Plus, Search, Trash2, X, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import type { Chunk } from '../api-content-admin'

export function DynamicStringList({
  label,
  value,
  onChange,
  placeholder,
  addLabel = '添加',
}: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  addLabel?: string
}) {
  const items = value.length ? value : ['']

  const updateAt = (index: number, next: string) => {
    onChange(items.map((item, i) => (i === index ? next : item)).filter((item, i, arr) => item.trim() || i === arr.length - 1))
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder={placeholder}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive"
              disabled={items.length === 1}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items.filter(Boolean), ''])}>
        <Plus className="mr-1.5 size-3.5" />
        {addLabel}
      </Button>
    </div>
  )
}

export function ChunkMultiSelect({
  chunks,
  value,
  onChange,
}: {
  chunks: Chunk[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [keyword, setKeyword] = useState('')
  const selected = chunks.filter((chunk) => value.includes(chunk.id))
  const results = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return chunks
      .filter((chunk) => !value.includes(chunk.id))
      .filter((chunk) => !q || chunk.text.toLowerCase().includes(q) || chunk.meaning.includes(keyword) || (chunk.category ?? '').includes(keyword))
      .slice(0, 12)
  }, [chunks, keyword, value])

  return (
    <div className="space-y-2">
      <Label>关联 Chunk</Label>
      <div className="rounded-lg border border-border/70">
        <div className="relative border-b border-border/70">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="border-0 pl-9 shadow-none focus-visible:ring-0"
            placeholder="搜索英文、中文含义或分类..."
          />
        </div>
        <div className="grid max-h-56 gap-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">没有可选 Chunk</p>
          ) : results.map((chunk) => (
            <button
              type="button"
              key={chunk.id}
              onClick={() => onChange([...value, chunk.id])}
              className="rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{chunk.text}</span>
                <Badge variant="outline" className="text-[10px]">{chunk.difficulty}</Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{chunk.meaning}</p>
            </button>
          ))}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((chunk) => (
            <Badge key={chunk.id} variant="secondary" className={cn('gap-1 pr-1 text-xs')}>
              {chunk.text}
              <button type="button" onClick={() => onChange(value.filter((id) => id !== chunk.id))}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Generic SearchSelectTable — search + paginated table + badges
// ═══════════════════════════════════════════════════════════════

export interface SearchSelectColumn<T> {
  key: string
  header: string
  className?: string
  render: (item: T) => React.ReactNode
}

export function SearchSelectTable<T extends { id: string }>({
  items,
  selectedIds,
  onToggle,
  searchPlaceholder,
  columns,
  searchFn,
  emptyText,
  pageSize = 10,
  getBadgeLabel,
  getBadgeVariant,
}: {
  items: T[]
  selectedIds: string[]
  onToggle: (id: string) => void
  searchPlaceholder: string
  columns: SearchSelectColumn<T>[]
  searchFn: (item: T, query: string) => boolean
  emptyText: string
  pageSize?: number
  getBadgeLabel: (item: T) => string
  getBadgeVariant?: (item: T) => 'default' | 'secondary' | 'outline'
}) {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => searchFn(item, q))
  }, [items, keyword, searchFn])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleSearch = (value: string) => {
    setKeyword(value)
    setPage(1)
  }

  const selectedItems = items.filter((item) => selectedIds.includes(item.id))
  const isSelected = (id: string) => selectedIds.includes(id)

  return (
    <div className="space-y-3">
      {/* Selected badges */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.map((item) => (
            <Badge
              key={item.id}
              variant={getBadgeVariant?.(item) ?? 'secondary'}
              className="gap-1 pr-1 text-xs"
            >
              {getBadgeLabel(item)}
              <button type="button" onClick={() => onToggle(item.id)}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
          placeholder={searchPlaceholder}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/70">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-10 px-3 py-2.5 text-center">
                  <span className="sr-only">选择</span>
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const sel = isSelected(item.id)
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/40',
                        sel && 'bg-primary/5',
                      )}
                      onClick={() => onToggle(item.id)}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={cn(
                            'inline-flex size-4 items-center justify-center rounded border',
                            sel
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30 bg-background',
                          )}
                        >
                          {sel && <Check className="size-3" />}
                        </span>
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className={cn('px-3 py-2.5', col.className)}>
                          {col.render(item)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > pageSize && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">
              共 {filtered.length} 项，第 {safePage}/{totalPages} 页
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
