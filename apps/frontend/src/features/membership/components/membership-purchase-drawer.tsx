import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { MemberPage } from '@/features/membership/pages/member-page'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAuth } from '@/providers/auth-provider'
import { useUserStore } from '@/stores/user.store'
import { cn } from '@/lib/cn'

function hasActiveMembership(role: string | undefined, membership: { level?: string; isActive?: boolean } | null) {
  return role === 'admin' || membership?.level === 'admin' || !!membership?.isActive
}

export function MembershipPurchaseDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  // Keep content mounted after the first open so reopen does not cold-remount.
  // Set synchronously while opening so the first paint already includes MemberPage
  // (useEffect would leave a header-only frame).
  const [contentReady, setContentReady] = useState(false)
  if (open && !contentReady) {
    setContentReady(true)
  }

  const body = contentReady ? (
    <div className={cn(!open && 'hidden')} aria-hidden={!open}>
      <MemberPage compact />
    </div>
  ) : null

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="z-[10006] max-h-[88vh] rounded-t-[28px] border-0 bg-background" overlayClassName="z-[10006]">
          <DrawerHeader className="px-4 pb-1 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">{t('member.title')}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,820px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="px-4 pt-4 text-left">
          <DialogTitle className="text-base font-semibold">{t('member.title')}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {body}
        </div>
      </DialogContent>
    </Dialog>
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
