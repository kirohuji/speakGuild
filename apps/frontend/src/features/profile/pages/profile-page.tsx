import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { AppearanceContent } from '@/features/profile/components/appearance-drawer'
import { useLayoutStore } from '@/stores/layout.store'
import { MemberPage } from '@/features/membership/pages/member-page'
import { cn } from '@/lib/cn'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileProfileDetail } from '@/features/profile/components/mobile-profile-detail'
import type { MobileView } from '@/features/profile/components/mobile-profile-home'
import { MobileProfileHome } from '@/features/profile/components/mobile-profile-home'
import { MobileSettingsView } from '@/features/profile/components/mobile-settings-view'
import { MobileStorageView } from '@/features/profile/components/mobile-storage-view'
import { OverviewTab } from '@/features/profile/components/overview-tab'
import { RecordsTab } from '@/features/profile/components/records-tab'
import { WordsTab } from '@/features/profile/components/words-tab'
import { AccountTab } from '@/features/profile/components/account-tab'
import { desktopLearningHref } from '@/features/home/desktop-learning-section'

const mobileTitles: Record<string, string> = {
  overview: 'profile.overview',
  records: 'profile.records',
  words: 'profile.words',
  account: 'profile.account',
  settings: 'profile.systemSettings',
  appearance: 'profile.theme',
  member: 'member.title',
  storage: 'profile.storageManagement',
}

interface ProfilePageProps {
  onFeedbackOpen?: () => void
}

/** 仅移动端使用（Header Drawer）。桌面端账户/设置已迁到 Header Dialog。 */
export function ProfilePage({ onFeedbackOpen }: ProfilePageProps = {}) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<MobileView>('home')
  const [prevView, setPrevView] = useState<MobileView | null>(null)
  const setBottomNavVisible = useLayoutStore((s) => s.setBottomNavVisible)

  const goTo = (view: MobileView) => {
    setPrevView(mobileView)
    setMobileView(view)
  }
  const goBack = () => {
    setMobileView(prevView || 'home')
    setPrevView(null)
  }

  useEffect(() => {
    if (!isMobile) return
    setBottomNavVisible(mobileView === 'home')
    return () => {
      setBottomNavVisible(true)
    }
  }, [isMobile, mobileView, setBottomNavVisible])

  if (!isMobile) {
    return <Navigate to={desktopLearningHref('today')} replace />
  }

  return (
    <div className={cn('h-full min-h-0')}>
      {mobileView === 'home' ? (
        <div>
          <MobileProfileHome onNavigate={goTo} onFeedbackOpen={onFeedbackOpen} />
        </div>
      ) : (
        <MobileProfileDetail
          title={t(mobileTitles[mobileView])}
          onBack={goBack}
        >
          {mobileView === 'overview' && <OverviewTab />}
          {mobileView === 'records' && <RecordsTab />}
          {mobileView === 'words' && <WordsTab />}
          {mobileView === 'account' && <AccountTab />}
          {mobileView === 'settings' && <MobileSettingsView onNavigate={goTo} />}
          {mobileView === 'appearance' && <AppearanceContent />}
          {mobileView === 'member' && <MemberPage compact />}
          {mobileView === 'storage' && <MobileStorageView />}
        </MobileProfileDetail>
      )}
    </div>
  )
}
