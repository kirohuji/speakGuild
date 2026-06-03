import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/providers/theme-provider'
import { NativeBridgeProvider } from '@/lib/native'
import { AuthProvider } from '@/providers/auth-provider'
import { ThemePresetProvider } from '@/providers/theme-preset-provider'
import { AuthRouteGate } from '@/providers/auth-route-guard'
import { RootLayout } from '@/layout/root-layout'
import { AdminLayout } from '@/layout/admin-layout'
import { EnglishHomePage } from '@/features/home/pages/english-home-page'
import { LearningPlanPage } from '@/features/learning/pages/learning-plan-page'
import { TodayTaskPage } from '@/features/learning/pages/today-task-page'
import { LearningUnitPage } from '@/features/learning/pages/learning-unit-page'
import { PracticeHubPage } from '@/features/practice/pages/practice-hub-page-v2'
import { PracticeSessionPage } from '@/features/practice/pages/practice-session-page'
import { ScriptHubPage } from '@/features/script/pages/script-hub-page'
import { ScriptPlayPage } from '@/features/script/pages/script-play-page'
import { ExploreMapPage } from '@/features/explore/pages/explore-map-page'
import { ExploreLocationPage } from '@/features/explore/pages/explore-location-page'
import { ExpressionLibraryPage } from '@/features/expression/pages/expression-library-page'
import { AchievementHallPage } from '@/features/achievement/pages/achievement-hall-page'
import { MemberPage } from '@/features/membership/pages/member-page'
import { AccountPage } from '@/features/account/pages/account-page'
import { ProfilePage } from '@/features/profile/pages/profile-page'
import { AdminUsersPage } from '@/features/admin/pages/admin-users-page'
import { AdminMembersPage } from '@/features/admin/pages/admin-members-page'
import { AdminBillingPage } from '@/features/admin/pages/admin-billing-page'
import { AdminNotificationsPage } from '@/features/admin/pages/admin-notifications-page'
import { NotificationListPage } from '@/features/notification/pages/notification-list-page'
import { NotificationDetailPage } from '@/features/notification/pages/notification-detail-page'
import { PortalPage } from '@/features/portal/pages/portal-page'
import { CompanyPage } from '@/features/company/pages/company-page'
import { LoginPage } from '@/features/auth/pages/login-page'
import { RegisterPage } from '@/features/auth/pages/register-page'
import { ForgotPasswordPage } from '@/features/auth/pages/forgot-password-page'
import { SystemTermsPage } from '@/features/system/pages/system-terms-page'
import { SystemPrivacyPage } from '@/features/system/pages/system-privacy-page'
import { SystemChildrenPrivacyPage } from '@/features/system/pages/system-children-page'
import { SystemPermissionsPage } from '@/features/system/pages/system-permissions-page'
import { SystemSdkListPage } from '@/features/system/pages/system-sdk-list-page'
import { SystemCollectInfoPage } from '@/features/system/pages/system-collect-info-page'
import { SystemContactPage } from '@/features/system/pages/system-contact-page'
import { SystemPrivacyConcisePage } from '@/features/system/pages/system-privacy-concise-page'
import { SystemIcpPage } from '@/features/system/pages/system-icp-page'
import { FeedbackPage } from '@/features/feedback/pages/feedback-page'
import { LeaderboardPage } from '@/features/leaderboard/pages/leaderboard-page'
import { InvitePage } from '@/features/referral/pages/invite-page'
import { AdminFeedbacksPage } from '@/features/admin/pages/admin-feedbacks-page'
import { AdminSettingsPage } from '@/features/admin/pages/admin-settings-page'
import { AdminAnalyticsPage } from '@/features/admin/pages/admin-analytics-page'
import { AdminScenesPage } from '@/features/admin/pages/admin-scenes-page'
import { AdminChunksPage } from '@/features/admin/pages/admin-chunks-page'
import { AdminScriptPage } from '@/features/admin/pages/admin-script-page'
import { AdminAchievementsPage } from '@/features/admin/pages/admin-achievements-page'
import { AdminCharactersPage } from '@/features/admin/pages/admin-characters-page'
import { AdminStoriesPage } from '@/features/admin/pages/admin-stories-page'
import { AdminMapsPage } from '@/features/admin/pages/admin-maps-page'
import { AdminNqtrPage } from '@/features/admin/pages/admin-nqtr-page'
import { AdminThemesPage } from '@/features/admin/theme-manage/pages/theme-list-page'
import { AdminDailySentencesPage } from '@/features/admin/pages/admin-daily-sentences-page'
import { AdminMobileBundlesPage } from '@/features/admin/pages/admin-mobile-bundles-page'

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NativeBridgeProvider>
        <AuthProvider>
          <ThemePresetProvider>
          <HashRouter>
          <AuthRouteGate>
            <Routes>
              {/* 管理员后台 — 独立布局 */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="members" element={<AdminMembersPage />} />
                <Route path="billing" element={<AdminBillingPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="feedbacks" element={<AdminFeedbacksPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="scenes" element={<AdminScenesPage />} />
                <Route path="chunks" element={<AdminChunksPage />} />
                <Route path="characters" element={<AdminCharactersPage />} />
                <Route path="stories" element={<AdminStoriesPage />} />
                <Route path="maps" element={<AdminMapsPage />} />
                <Route path="nqtr" element={<AdminNqtrPage />} />
                <Route path="script" element={<AdminScriptPage />} />
                <Route path="achievements" element={<AdminAchievementsPage />} />
                <Route path="themes" element={<AdminThemesPage />} />
                <Route path="daily-sentences" element={<AdminDailySentencesPage />} />
                <Route path="mobile-bundles" element={<AdminMobileBundlesPage />} />
              </Route>

              {/* 用户端 — RootLayout */}
              <Route element={<RootLayout />}>
                <Route path="/" element={<EnglishHomePage />} />

                {/* 学习计划 — 教材驱动路径 */}
                <Route path="/learning" element={<LearningPlanPage />} />
                <Route path="/learning/units/:unitId" element={<LearningUnitPage />} />

                {/* 今日任务 */}
                <Route path="/today" element={<TodayTaskPage />} />

                {/* 练习模式 */}
                <Route path="/practice" element={<PracticeHubPage />} />
                <Route path="/practice/topics" element={<PracticeHubPage />} />
                <Route path="/practice/session/:topicId" element={<PracticeSessionPage />} />

                {/* 剧本模式 */}
                <Route path="/script" element={<ScriptHubPage />} />
                <Route path="/script/:episodeId" element={<ScriptPlayPage />} />

                {/* 探索模式 */}
                <Route path="/explore" element={<ExploreMapPage />} />
                <Route path="/explore/:locationId" element={<ExploreLocationPage />} />

                {/* 学习库 */}
                <Route path="/expressions" element={<ExpressionLibraryPage />} />

                {/* 我的成长 */}
                <Route path="/growth" element={<AchievementHallPage />} />

                {/* 成就殿堂 */}
                <Route path="/achievements" element={<AchievementHallPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/member" element={<MemberPage />} />
                <Route path="/notifications" element={<NotificationListPage />} />
                <Route path="/notifications/:id" element={<NotificationDetailPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/invite" element={<InvitePage />} />

                {/* 系统文档 — 法律与隐私相关 */}
                <Route path="/system/terms" element={<SystemTermsPage />} />
                <Route path="/system/privacy" element={<SystemPrivacyPage />} />
                <Route path="/system/privacy-children" element={<SystemChildrenPrivacyPage />} />
                <Route path="/system/permissions" element={<SystemPermissionsPage />} />
                <Route path="/system/sdk-list" element={<SystemSdkListPage />} />
                <Route path="/system/collect-info" element={<SystemCollectInfoPage />} />
                <Route path="/system/privacy-concise" element={<SystemPrivacyConcisePage />} />
                <Route path="/system/icp" element={<SystemIcpPage />} />
                <Route path="/system/contact" element={<SystemContactPage />} />
              </Route>

              {/* 落地页 — 无外层布局 */}
              <Route path="/portal" element={<PortalPage />} />

              {/* 公司介绍页 — 无外层布局，供 Apple Store 组织验证 */}
              <Route path="/company" element={<CompanyPage />} />

              {/* 认证页 — 无外层布局 */}
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            </Routes>
          </AuthRouteGate>
        </HashRouter>
          <Toaster
            position="top-center"
            theme="system"
            visibleToasts={1}
            offset="calc(0.75rem + env(safe-area-inset-top, 0px))"
            toastOptions={{
              unstyled: true,
              classNames: {
                toast: 'flex w-[calc(100vw-2rem)] max-w-sm items-center gap-2.5 rounded-2xl bg-muted/80 px-4 py-3 text-foreground backdrop-blur-2xl',
                content: 'min-w-0 flex-1',
                icon: 'shrink-0 text-current',
                title: 'text-sm font-medium',
                description: 'text-xs text-muted-foreground',
                success: 'bg-primary/[0.12] dark:bg-primary/[0.16]',
                error: 'bg-destructive/[0.12] dark:bg-destructive/[0.16]',
                warning: 'bg-amber-500/[0.12] dark:bg-amber-500/[0.16]',
                info: 'bg-muted/80 dark:bg-muted/70',
              },
            }}
          />
          </ThemePresetProvider>
      </AuthProvider>
      </NativeBridgeProvider>
    </ThemeProvider>
  )
}
