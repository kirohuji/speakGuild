import { lazy, Suspense, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, ShoppingBag } from 'lucide-react'
import { desktopLearningHref } from '@/features/home/desktop-learning-section'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/cn'
import { dailyPracticeRepository } from '@/lib/offline/daily-practice.repository'
import { useLearningStore } from '@/stores/learning.store'
import { useDailyPracticeStore } from '@/stores/daily-practice.store'
import { usePreferencesStore } from '@/stores/preferences.store'
import { toast } from 'sonner'
import { isInProgressLearningUnit, isScriptLearningUnit } from '../api/learning-api'
import { MyLearningView } from '../components/my-learning-view'
import { PracticeRecordsWithTabs } from '../components/practice-records-panel'
import { LearningPackDownloadDrawer, LearningPackDownloadStatusButton } from '@/layout/learning-pack-download-monitor'
import { useIsMobile } from '@/hooks/use-mobile'
import { MembershipPurchaseDrawer } from '@/features/membership/components/membership-purchase-drawer'

const ShopView = lazy(() =>
  import('../components/shop-view').then((m) => ({ default: m.ShopView })),
)

export function LearningPlanPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [shopOpen, setShopOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [downloadDrawerOpen, setDownloadDrawerOpen] = useState(false)
  const [activePracticePackId, setActivePracticePackId] = useState<string | null>(null)

  const myUnits = useLearningStore((s) => s.myUnits)
  const myLoading = useLearningStore((s) => s.myLoading)
  const fetchMyLearning = useLearningStore((s) => s.fetchMyLearning)
  const refreshShop = useLearningStore((s) => s.refreshShop)
  const loadMoreShop = useLearningStore((s) => s.loadMoreShop)
  const fetchTags = useLearningStore((s) => s.fetchTags)
  const storeQuitUnit = useLearningStore((s) => s.quitUnit)
  const storeEnrollUnit = useLearningStore((s) => s.enrollUnit)
  const downloadedPacks = useLearningStore((s) => s.downloadedPacks)
  const availablePackUpdates = useLearningStore((s) => s.availablePackUpdates)
  const packInstallingIds = useLearningStore((s) => s.packInstallingIds)
  const fetchDownloadedPacks = useLearningStore((s) => s.fetchDownloadedPacks)
  const downloadUnitPack = useLearningStore((s) => s.downloadUnitPack)

  useEffect(() => {
    // Local SQLite remains the normal source when returning to this page.
    // The repository contacts my-units only when its account projection is
    // absent, so document-reading progress can update without polling.
    void fetchMyLearning(true)
    void fetchDownloadedPacks()
  }, [fetchMyLearning, fetchDownloadedPacks])

  useEffect(() => {
    void dailyPracticeRepository.getActivePracticePackId().then(setActivePracticePackId)
  }, [downloadedPacks])

  const handleSetActivePracticePack = async (unit: typeof myUnits[number]) => {
    await dailyPracticeRepository.setActivePracticePackId(unit.id)
    const mode = usePreferencesStore.getState().dailyPracticeLastMode === 'review' ? 'review' : 'practice'
    await useDailyPracticeStore.getState().loadToday(null, null, mode)
    setActivePracticePackId(unit.id)
    toast.success(t('learning.currentPracticePackSet', { title: unit.title }))
  }

  // 学习页不显示剧情包（story）；进行中口径与加入上限一致
  const learningUnits = myUnits.filter((unit) => !isScriptLearningUnit(unit))
  const inProgress = learningUnits.filter(isInProgressLearningUnit)
  const completed = learningUnits.filter((unit) => unit.status === 'completed' || (!unit.status && unit.completionPercent >= 100))

  const openShop = () => {
    if (!isMobile) {
      navigate(desktopLearningHref('shop'))
      return
    }
    setShopOpen(true)
    void refreshShop({ excludePackageType: 'story' })
    void fetchTags()
  }

  return (
    <div className={cn(isMobile ? 'mx-auto max-w-2xl px-4 pb-24 pt-3' : 'w-full pb-2')}>
      <div className="mb-3 flex items-center justify-between">
        <div />
        <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl">
          <LearningPackDownloadStatusButton onClick={() => setDownloadDrawerOpen(true)} embedded />
          <button
            type="button"
            onClick={(e) => { e.currentTarget.blur(); setRecordsOpen(true) }}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
            aria-label={t('profile.records')}
          >
            <ClipboardList className="size-[18px]" />
          </button>
          {isMobile && (
            <button
              type="button"
              onClick={(e) => { e.currentTarget.blur(); openShop() }}
              className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
              aria-label={t('learning.shopTitle')}
              data-spotlight="open-shop"
            >
              <ShoppingBag className="size-[18px]" />
            </button>
          )}
        </div>
      </div>

      <MyLearningView
        myUnits={learningUnits}
        inProgress={inProgress}
        completed={completed}
        loading={myLoading}
        onGoToShop={openShop}
        onQuitUnit={storeQuitUnit}
        downloadedPackIds={downloadedPacks.filter((pack) => pack.status === 'installed').map((pack) => pack.packId)}
        updatePackIds={availablePackUpdates.map((update) => update.packId)}
        installingPackIds={packInstallingIds}
        onDownloadUnitPack={downloadUnitPack}
        activePracticePackId={activePracticePackId}
        onSetActivePracticePack={handleSetActivePracticePack}
      />

      {isMobile ? (
        <Drawer open={recordsOpen} onOpenChange={setRecordsOpen}>
          <DrawerContent className="flex h-[95vh] max-h-[95vh] flex-col rounded-t-[28px] bg-background drawer-surface">
            <DrawerHeader className="px-4 pb-1 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{t('profile.records')}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {recordsOpen && (
                <Suspense fallback={<MobilePageLoading rows={4} />}>
                  <PracticeRecordsWithTabs active={recordsOpen} />
                </Suspense>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={recordsOpen} onOpenChange={setRecordsOpen}>
          <DialogContent className="flex h-[min(88vh,760px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
            <DialogTitle className="sr-only">{t('profile.records')}</DialogTitle>
            <div className="border-b border-border/50 px-5 py-4">
              <p className="text-base font-semibold">{t('profile.records')}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
              {recordsOpen && (
                <Suspense fallback={<MobilePageLoading rows={4} />}>
                  <PracticeRecordsWithTabs active={recordsOpen} />
                </Suspense>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <LearningPackDownloadDrawer open={downloadDrawerOpen} onOpenChange={setDownloadDrawerOpen} />

      <Drawer open={shopOpen} onOpenChange={setShopOpen}>
        <DrawerContent className="max-h-[88vh] rounded-t-[28px] border-0 bg-background">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">{t('learning.shopTitle')}</DrawerTitle>
          </DrawerHeader>
          <div className="h-[calc(88vh-4rem)] overflow-x-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {shopOpen && (
              <Suspense fallback={<MobilePageLoading rows={4} />}>
                <ShopView
                  isOpen={shopOpen}
                  onMemberOpen={() => setMemberOpen(true)}
                  onEnrollUnit={storeEnrollUnit}
                  onRefreshShop={refreshShop}
                  onLoadMore={loadMoreShop}
                  excludePackageType="story"
                />
              </Suspense>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <MembershipPurchaseDrawer open={memberOpen} onOpenChange={setMemberOpen} />
    </div>
  )
}
