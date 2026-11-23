import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShopView } from '../components/shop-view'
import { MembershipPurchaseDrawer } from '@/features/membership/components/membership-purchase-drawer'
import { useLearningStore } from '@/stores/learning.store'

export function DesktopShopSection() {
  const { t } = useTranslation()
  const [memberOpen, setMemberOpen] = useState(false)
  const refreshShop = useLearningStore((s) => s.refreshShop)
  const loadMoreShop = useLearningStore((s) => s.loadMoreShop)
  const fetchTags = useLearningStore((s) => s.fetchTags)
  const storeEnrollUnit = useLearningStore((s) => s.enrollUnit)

  useEffect(() => {
    void refreshShop({ excludePackageType: 'story' })
    void fetchTags()
  }, [refreshShop, fetchTags])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">{t('learning.shopTitle')}</h1>
      <ShopView
        isOpen
        onMemberOpen={() => setMemberOpen(true)}
        onEnrollUnit={storeEnrollUnit}
        onRefreshShop={refreshShop}
        onLoadMore={loadMoreShop}
        excludePackageType="story"
      />
      <MembershipPurchaseDrawer open={memberOpen} onOpenChange={setMemberOpen} />
    </div>
  )
}
