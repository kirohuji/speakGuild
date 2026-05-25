import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, ChevronLeft, X, Clock, Trash2, TrendingUp, BookOpen,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSearchStore } from '@/stores/search.store'
import { getQuestionBankHome, type ScenicCard } from '@/features/question-bank/api'
import { cn } from '@/lib/cn'
import { useTranslation } from 'react-i18next'

const HOT_SEARCHES = [
  '故宫', '长城', '颐和园', '天坛', '西湖',
  '桂林山水', '兵马俑', '黄山', '张家界', '九寨沟',
]

interface SearchOverlayProps {
  open: boolean
  onClose: () => void
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<ScenicCard[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { history, addHistory, removeHistory, clearHistory } = useSearchStore()

  // auto-focus on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  // reset on close
  useEffect(() => {
    if (!open) {
      setKeyword('')
      setResults([])
    }
  }, [open])

  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const data = await getQuestionBankHome({ keyword: kw.trim() })
      setResults(data.scenicCards || [])
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(keyword)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [keyword, open, doSearch])

  const handleSelect = (item: ScenicCard) => {
    addHistory(item.name)
  }

  const handleHistoryTap = (text: string) => {
    setKeyword(text)
    addHistory(text)
  }

  const handleClear = () => {
    setKeyword('')
    setResults([])
    inputRef.current?.focus()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* top bar */}
      <div className="flex items-center gap-2 px-3 py-1">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-6 flex-shrink-0 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>

        <div className="relative min-w-0 flex-1 py-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('home.hero.searchPlaceholder')}
            className={cn(
              'pl-9 rounded-full bg-muted/60 border-0 focus-visible:ring-0 focus-visible:ring-offset-0',
              keyword && 'pr-9'
            )}
          />
          {keyword && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto">
        {!keyword.trim() ? (
          /* default: history + hot */
          <div className="space-y-5 p-4">
            {history.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    搜索历史
                  </h3>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                    清空
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((h) => (
                    <span key={h} className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleHistoryTap(h)}
                        className="rounded-full bg-muted/60 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-muted active:bg-muted/80"
                      >
                        {h}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeHistory(h) }}
                        className="text-muted-foreground/40 hover:text-muted-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                热门搜索
              </h3>
              <div className="flex flex-wrap gap-2">
                {HOT_SEARCHES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleHistoryTap(item)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs transition-colors',
                      'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* searching: result list */
          <div>
            {isSearching ? (
              <div className="space-y-4 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-16 w-16 flex-shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-2 pt-1">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center">
                <Search className="mb-3 h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">没有找到相关景点</p>
                <p className="mt-1 text-xs text-muted-foreground/60">试试其他关键词</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {results.map((item) => (
                  <Link
                    key={item.id}
                    to={`/practice/${item.topicId}`}
                    onClick={() => handleSelect(item)}
                    className="no-underline flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
                  >
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                      {item.coverImage ? (
                        <img
                          src={item.coverImage}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                        {item.name}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{item.questionCount} 道题</span>
                        <span>·</span>
                        <span>{item.masteryRate}% 已掌握</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
