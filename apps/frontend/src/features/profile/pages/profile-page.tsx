import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ClipboardList, BookMarked, IdCard, Settings, User,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getUserProfile, type UserProfile } from '@/features/profile/api'
import { AppearanceContent } from '@/features/profile/components/appearance-drawer'
import { useLayoutStore } from '@/stores/layout.store'
import { MemberPage } from '@/features/membership/pages/member-page'
import { cn } from '@/lib/cn'
import { getCurrentAvatar } from '@/features/file-assets/api'
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
import { SettingsTab } from '@/features/profile/components/settings-tab'

type Tab = 'overview' | 'records' | 'words' | 'account' | 'settings'

const tabs: { key: Tab; icon: React.ElementType }[] = [
  { key: 'overview', icon: LayoutDashboard },
  { key: 'records', icon: ClipboardList },
  { key: 'words', icon: BookMarked },
  { key: 'account', icon: IdCard },
  { key: 'settings', icon: Settings },
]

const mobileTitles: Record<string, string> = {
  overview: 'profile.overview',
  records: 'profile.records',
  words: 'profile.words',
  account: 'profile.account',
  settings: '系统设置',
  appearance: 'profile.theme',
  member: 'member.title',
  storage: '存储管理',
}

interface ProfilePageProps {
  onFeedbackOpen?: () => void
}

export function ProfilePage({ onFeedbackOpen }: ProfilePageProps = {}) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [mobileView, setMobileView] = useState<MobileView>('home')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const setBottomNavVisible = useLayoutStore((s) => s.setBottomNavVisible)

  useEffect(() => {
    if (isMobile) return
    getUserProfile().then(setUserProfile).catch(() => {})
    getCurrentAvatar().then((res) => setAvatarUrl(res?.url ?? null)).catch(() => {})
  }, [isMobile])

  useEffect(() => {
    setBottomNavVisible(mobileView === 'home')
    return () => {
      setBottomNavVisible(true)
    }
  }, [mobileView, setBottomNavVisible])

  const nickname = userProfile?.name || userProfile?.username || t('app.name')

  return (
    <div className={cn(isMobile && 'h-full min-h-0')}>
      {isMobile ? (
        <div className="h-full min-h-0">
          {mobileView === 'home' ? (
            <div>
              <MobileProfileHome onNavigate={setMobileView} onFeedbackOpen={onFeedbackOpen} />
            </div>
          ) : (
            <MobileProfileDetail
              title={t(mobileTitles[mobileView])}
              onBack={() => setMobileView('home')}
            >
              {mobileView === 'overview' && <OverviewTab />}
              {mobileView === 'records' && <RecordsTab />}
              {mobileView === 'words' && <WordsTab />}
              {mobileView === 'account' && <AccountTab />}
              {mobileView === 'settings' && <MobileSettingsView onFeedbackOpen={onFeedbackOpen} onNavigate={setMobileView} />}
              {mobileView === 'appearance' && <AppearanceContent />}
              {mobileView === 'member' && <MemberPage compact />}
              {mobileView === 'storage' && <MobileStorageView />}
            </MobileProfileDetail>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* 左侧边栏 */}
          <div className="md:col-span-1">
            <Card>
              <CardContent className="p-4">
                <div className="mb-4 flex flex-col items-center gap-2 text-center">
                  <Avatar className="h-16 w-16 ring-2 ring-border ring-offset-2 ring-offset-background">
                    <AvatarImage src={avatarUrl || undefined} alt="avatar" />
                    <AvatarFallback className="bg-primary/10">
                      <User className="h-8 w-8 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold">{nickname}</p>
                  <Badge variant="secondary" className="text-xs">{t('member.freeUser')}</Badge>
                </div>
                <Separator className="mb-4" />
                <nav className="space-y-1">
                  {tabs.map(({ key, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                        activeTab === key
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t(`profile.${key}`)}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* 右侧内容 */}
          <div className="md:col-span-3">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'records' && <RecordsTab />}
            {activeTab === 'words' && <WordsTab />}
            {activeTab === 'account' && <AccountTab desktop />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      )}
    </div>
  )
}
