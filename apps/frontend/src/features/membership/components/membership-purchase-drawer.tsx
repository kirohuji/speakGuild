import { lazy, Suspense, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { useAuth } from '@/providers/auth-provider'
import { useUserStore } from '@/stores/user.store'

const MemberPage = lazy(() =>
  import('@/features/membership/pages/member-page').then((module) => ({ default: module.MemberPage })),
)

function hasActiveMembership(role: string | undefined, membership: { level?: string; isActive?: boolean } | null) {
  return role === 'admin' || membership?.level === 'admin' || !!membership?.isActive
}

export function useHasActiveMembership() {
  const { session } = useAuth()
  const membership = useUserStore((state) => state.membership)
  return hasActiveMembership(session?.user?.role, membership)
}

export function MembershipPurchaseDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="z-[10006] max-h-[88vh] rounded-t-[28px] border-0 bg-background" overlayClassName="z-[10006]">
        <DrawerHeader className="px-4 pb-1 pt-2 text-left">
          <DrawerTitle className="text-base font-semibold">{t('member.title')}</DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {open && (
            <Suspense fallback={<MobilePageLoading rows={4} />}>
              <MemberPage compact />
            </Suspense>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function useMembershipPurchase() {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const requireMembership = useCallback(() => {
    const membership = useUserStore.getState().membership
    if (hasActiveMembership(session?.user?.role, membership)) return true
    setOpen(true)
    return false
  }, [session?.user?.role])

  return {
    requireMembership,
    membershipDrawer: <MembershipPurchaseDrawer open={open} onOpenChange={setOpen} />,
  }
}
