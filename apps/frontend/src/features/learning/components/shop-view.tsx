import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Virtuoso } from 'react-virtuoso'
import { BookOpen, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { cn } from '@/lib/cn'
import { useIsMobile } from '@/hooks/use-mobile'
import { LearningStatsRail } from '@/features/home/components/learning-stats-rail'
import { useDesktopAsideSlot } from '@/layout/desktop-learning-shell'
import { useLearningStore } from '@/stores/learning.store'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { PrepPager } from '@/features/practice/components/prep-pager'
import { ShopCard, ShopUnitDetailPanel, type ShopUnitCardUnit } from './shop-card'
import type { LearningPackageType } from '../api/learning-api'

const SHOP_PAGE_SIZE = 20

interface Props {
  isOpen?: boolean
  onMemberOpen: () => void
  onEnrollUnit?: (id: string) => Promise<boolean>
  onRefreshShop: (params?: { tag?: string; packageType?: LearningPackageType; excludePackageType?: LearningPackageType; search?: string; page?: number }) => Promise<void>
  onLoadMore: (params?: { tag?: string; packageType?: LearningPackageType; excludePackageType?: LearningPackageType; search?: string }) => Promise<void>
  excludePackageType?: LearningPackageType
}

const PACKAGE_TYPE_TABS: Array<{ id: LearningPackageType; labelKey: string }> = [
  { id: 'foundation', labelKey: 'learning.packageTypeFoundation' },
  { id: 'daily', labelKey: 'learning.packageTypeDaily' },
  { id: 'course', labelKey: 'learning.packageTypeCourse' },
  { id: 'exam', labelKey: 'learning.packageTypeExam' },
]

type PackageTypeFilter = LearningPackageType | 'all'

export function ShopView({ isOpen, onMemberOpen, onEnrollUnit, onRefreshShop, onLoadMore, excludePackageType }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const asideSlot = useDesktopAsideSlot()
  const tags = useLearningStore((s) => s.tags)
  const fetchTags = useLearningStore((s) => s.fetchTags)
  const units = useLearningStore((s) => s.shopUnits)
  const loading = useLearningStore((s) => s.shopLoading)
  const shopTotal = useLearningStore((s) => s.shopTotal)
  const shopPage = useLearningStore((s) => s.shopPage)
  const shopHasMore = useLearningStore((s) => s.shopHasMore)
  const onboardingCompletedSegments = useOnboardingStore((s) => s.completedSegments)
  const [activeType, setActiveType] = useState<PackageTypeFilter>('all')
  const [activeTag, setActiveTag] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const selectedUnit = useMemo(
    () => (selectedUnitId ? units.find((unit) => unit.id === selectedUnitId) ?? null : null),
    [selectedUnitId, units],
  )

  useEffect(() => {
    if (!selectedUnitId) return
    if (!units.some((unit) => unit.id === selectedUnitId)) setSelectedUnitId(null)
  }, [selectedUnitId, units])

  useEffect(() => {
    if (!isOpen) setSelectedUnitId(null)
  }, [isOpen])

  const buildShopParams = useCallback((kw: string, tag: string, packageType: PackageTypeFilter) => {
    const params: { tag?: string; packageType?: LearningPackageType; excludePackageType?: LearningPackageType; search?: string; page?: number } = {}
    if (packageType !== 'all') params.packageType = packageType
    if (excludePackageType) params.excludePackageType = excludePackageType
    if (tag !== 'all') params.tag = tag
    if (kw.trim()) params.search = kw.trim()
    return params
  }, [excludePackageType])

  const doSearch = useCallback((kw: string, tag: string, packageType: PackageTypeFilter) => {
    onRefreshShop(buildShopParams(kw, tag, packageType))
  }, [buildShopParams, onRefreshShop])

  const shopTotalPages = Math.max(1, Math.ceil(shopTotal / SHOP_PAGE_SIZE) || 1)

  const goToShopPage = useCallback((page: number) => {
    void onRefreshShop({ ...buildShopParams(keyword, activeTag, activeType), page })
  }, [activeTag, activeType, buildShopParams, keyword, onRefreshShop])

  useEffect(() => {
    if (!isOpen) return
    setActiveType('all')
    setActiveTag('all')
    setKeyword('')
  }, [isOpen])

  // 商店打开且商品加载完成时触发「学习包分类」引导（条件式分段，仅首次）
  useEffect(() => {
    if (isOpen && !loading && units.length > 0) {
      useOnboardingStore.getState().tryStartSegment('shop-categories')
    }
  }, [isOpen, loading, units.length, onboardingCompletedSegments])

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

  const handleEndReached = useCallback(() => {
    if (shopHasMore && !loading) {
      void onLoadMore(buildShopParams(keyword, activeTag, activeType))
    }
  }, [activeTag, activeType, buildShopParams, keyword, loading, onLoadMore, shopHasMore])

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
      <div className="scrollbar-hide mx-4 overflow-x-auto" data-spotlight="shop-category-tabs">
        <div className="flex w-max gap-2 pb-1">
          {[{ id: 'all' as const, labelKey: 'learning.all' }, ...PACKAGE_TYPE_TABS.filter((tab) => tab.id !== excludePackageType)].map((tab) => (
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
              {t(tab.labelKey)}
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

  const desktopAsidePortal = !isMobile && asideSlot
    ? createPortal(
      selectedUnit ? (
        <div className="flex h-full min-h-0 flex-col px-3 py-3">
          <ShopUnitDetailPanel
            key={selectedUnit.id}
            unit={selectedUnit}
            onEnroll={onEnrollUnit}
            onClose={() => setSelectedUnitId(null)}
            variant="rail"
          />
        </div>
      ) : (
        <LearningStatsRail />
      ),
      asideSlot,
    )
    : null

  if (loading && units.length === 0) {
    return (
      <>
        {desktopAsidePortal}
        <div className={cn(!isMobile && 'flex h-full min-h-0 flex-col')}>
          <div className="shrink-0">{headerEl}</div>
          <div className={cn(!isMobile && 'min-h-0 flex-1 overflow-y-auto')}>
            <MobilePageLoading rows={4} minHeightClassName="min-h-[40vh]" />
          </div>
        </div>
      </>
    )
  }

  if (!loading && units.length === 0) {
    return (
      <>
        {desktopAsidePortal}
        <div className={cn(!isMobile && 'flex h-full min-h-0 flex-col')}>
          <div className="shrink-0">{headerEl}</div>
          <div className="flex flex-col items-center py-16 text-center">
            <BookOpen className="size-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">{t('learning.noMatch')}</p>
          </div>
        </div>
      </>
    )
  }

  const renderCard = (unit: (typeof units)[number], index: number) => (
    <div className="py-1">
      <ShopCard
        unit={unit}
        onMemberOpen={onMemberOpen}
        onEnroll={onEnrollUnit}
        onSelect={!isMobile ? ((next: ShopUnitCardUnit) => setSelectedUnitId(next.id)) : undefined}
        selected={!isMobile && selectedUnitId === unit.id}
        {...(index === 0 ? { 'data-spotlight': 'first-shop-unit' } : {})}
      />
    </div>
  )

  // 桌面：筛选固定，仅列表区滚动；分页钉在列表下方
  if (!isMobile) {
    return (
      <>
        {desktopAsidePortal}
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0">{headerEl}</div>
          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-0">
              {units.map((unit, index) => (
                <div key={unit.id}>{renderCard(unit, index)}</div>
              ))}
            </div>
            {shopTotalPages <= 1 && Footer}
          </div>
          <div className="shrink-0 pt-2">
            <PrepPager
              currentPage={shopPage}
              totalPages={shopTotalPages}
              totalItems={shopTotal}
              onPageChange={goToShopPage}
            />
          </div>
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
          itemContent={(index) => renderCard(units[index], index)}
          endReached={handleEndReached}
          components={{ Footer: () => Footer }}
        />
      </div>
    </div>
  )
}
