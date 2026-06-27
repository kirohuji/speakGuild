import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Virtuoso } from 'react-virtuoso'
import { BookOpen, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { cn } from '@/lib/cn'
import { useLearningStore } from '@/stores/learning.store'
import { ShopCard } from './shop-card'
import type { LearningPackageType } from '../api/learning-api'

interface Props {
  isOpen?: boolean
  onMemberOpen: () => void
  onEnrollUnit?: (id: string) => Promise<void>
  onRefreshShop: (params?: { tag?: string; packageType?: LearningPackageType; search?: string; page?: number }) => Promise<void>
  onLoadMore: (params?: { tag?: string; packageType?: LearningPackageType; search?: string }) => Promise<void>
}

const PACKAGE_TYPE_TABS: Array<{ id: LearningPackageType; label: string }> = [
  { id: 'daily', label: '日常' },
  { id: 'exam', label: '考试' },
  { id: 'story', label: '故事' },
  { id: 'course', label: '课程' },
  { id: 'foundation', label: '零基础' },
]

type PackageTypeFilter = LearningPackageType | 'all'

export function ShopView({ isOpen, onMemberOpen, onEnrollUnit, onRefreshShop, onLoadMore }: Props) {
  const { t } = useTranslation()
  const tags = useLearningStore((s) => s.tags)
  const fetchTags = useLearningStore((s) => s.fetchTags)
  const units = useLearningStore((s) => s.shopUnits)
  const loading = useLearningStore((s) => s.shopLoading)
  const shopTotal = useLearningStore((s) => s.shopTotal)
  const shopHasMore = useLearningStore((s) => s.shopHasMore)
  const [activeType, setActiveType] = useState<PackageTypeFilter>('all')
  const [activeTag, setActiveTag] = useState('all')
  const [keyword, setKeyword] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const doSearch = useCallback((kw: string, tag: string, packageType: PackageTypeFilter) => {
    const params: { tag?: string; packageType?: LearningPackageType; search?: string } = {}
    if (packageType !== 'all') params.packageType = packageType
    if (tag !== 'all') params.tag = tag
    if (kw.trim()) params.search = kw.trim()
    onRefreshShop(params)
  }, [onRefreshShop])

  useEffect(() => {
    if (!isOpen) return
    setActiveType('all')
    setActiveTag('all')
    setKeyword('')
  }, [isOpen])

  useEffect(() => {
    fetchTags(activeType === 'all' ? undefined : activeType)
  }, [activeType, fetchTags])

  useEffect(() => {
    if (activeTag === 'all') return
    if (!tags.some((tag) => tag.name === activeTag)) {
      setActiveTag('all')
    }
  }, [activeTag, tags])

  const handleKeywordChange = (value: string) => {
    setKeyword(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value, activeTag, activeType), 300)
  }

  const handleTypeChange = (type: PackageTypeFilter) => {
    setActiveType(type)
    setActiveTag('all')
    doSearch(keyword, 'all', type)
  }

  const handleTagChange = (tag: string) => {
    setActiveTag(tag)
    doSearch(keyword, tag, activeType)
  }

  const handleEndReached = () => {
    if (shopHasMore && !loading) {
      const params: { tag?: string; packageType?: LearningPackageType; search?: string } = {}
      if (activeType !== 'all') params.packageType = activeType
      if (activeTag !== 'all') params.tag = activeTag
      if (keyword.trim()) params.search = keyword.trim()
      onLoadMore(params)
    }
  }

  const categoryTabs = useMemo(
    () => [
      { id: 'all', label: t('learning.all') },
      ...tags
        .filter((tag) => tag.name !== 'all' && tag.name !== t('learning.all'))
        .map((tag) => ({ id: tag.name, label: tag.name })),
    ],
    [tags, t],
  )
  const showCategoryTabs = categoryTabs.length > 0

  const headerEl = (
    <div className="space-y-3 pb-2">
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => handleKeywordChange(e.target.value)}
          placeholder={t('learning.searchPlaceholder')}
          className="h-11 rounded-full border-0 bg-muted/70 pl-9 text-sm"
        />
      </div>
      <div className="scrollbar-hide mx-4 overflow-x-auto">
        <div className="flex w-max gap-2 pb-1">
          {[{ id: 'all' as const, label: t('learning.all') }, ...PACKAGE_TYPE_TABS].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTypeChange(tab.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                activeType === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {showCategoryTabs && (
        <div className="scrollbar-hide mx-4 overflow-x-auto">
          <div className="flex w-max gap-2 pb-1">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTagChange(tab.id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  activeTag === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const Footer = useMemo(() => {
    if (loading) return <div className="flex justify-center py-4"><Spinner /></div>
    if (units.length > 0 && !shopHasMore) {
      return <p className="py-4 text-center text-xs text-muted-foreground">{t('learning.allLoaded', { total: shopTotal })}</p>
    }
    return null
  }, [loading, units.length, shopHasMore, shopTotal, t])

  if (loading && units.length === 0) {
    return (
      <>
        {headerEl}
        <MobilePageLoading rows={4} minHeightClassName="min-h-[40vh]" />
      </>
    )
  }

  if (!loading && units.length === 0) {
    return (
      <>
        {headerEl}
        <div className="flex flex-col items-center py-16 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">{t('learning.noMatch')}</p>
        </div>
      </>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {headerEl}
      <div className="min-h-0 flex-1">
        <Virtuoso
          style={{ height: '100%' }}
          totalCount={units.length}
          itemContent={(index) => {
            const unit = units[index]
            return (
              <div className="py-1">
                <ShopCard
                  unit={unit}
                  onMemberOpen={onMemberOpen}
                  onEnroll={onEnrollUnit}
                  {...(index === 0 ? { 'data-spotlight': 'first-shop-unit' } : {})}
                />
              </div>
            )
          }}
          endReached={handleEndReached}
          components={{ Footer: () => Footer }}
        />
      </div>
    </div>
  )
}
