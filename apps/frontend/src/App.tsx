import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/providers/theme-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { AuthRouteGate } from '@/providers/auth-route-guard'
import { RootLayout } from '@/layout/root-layout'
import { AdminLayout } from '@/layout/admin-layout'
import { EnglishHomePage } from '@/features/question-bank/pages/english-home-page'
import { PracticeHubPage } from '@/features/practice/pages/practice-hub-page-v2'
import { PracticeSessionPage } from '@/features/practice/pages/practice-session-page'
import { ScriptHubPage } from '@/features/script/pages/script-hub-page'
import { ScriptPlayPage } from '@/features/script/pages/script-play-page'
import { ExploreMapPage } from '@/features/explore/pages/explore-map-page'
import { ExploreLocationPage } from '@/features/explore/pages/explore-location-page'
import { ExpressionLibraryPage } from '@/features/expression/pages/expression-library-page'
import { GrowthPage } from '@/features/growth/pages/growth-page'
import { AchievementHallPage } from '@/features/achievement/pages/achievement-hall-page'
import { OnboardingLayout } from '@/features/onboarding/pages/onboarding-layout'
import { GoalsSelectionPage } from '@/features/onboarding/pages/goals-selection-page'
import { AbilitySelectionPage } from '@/features/onboarding/pages/ability-selection-page'
import { MemberPage } from '@/features/membership/pages/member-page'
import { AccountPage } from '@/features/account/pages/account-page'
import { AdminUsersPage } from '@/features/admin/pages/admin-users-page'
import { AdminMembersPage } from '@/features/admin/pages/admin-members-page'
import { AdminBillingPage } from '@/features/admin/pages/admin-billing-page'
import { AdminNotificationsPage } from '@/features/admin/pages/admin-notifications-page'
import { NotificationListPage } from '@/features/notification/pages/notification-list-page'
import { NotificationDetailPage } from '@/features/notification/pages/notification-detail-page'
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
import { AdminCouponsPage } from '@/features/admin/pages/admin-coupons-page'
import { AdminFeedbacksPage } from '@/features/admin/pages/admin-feedbacks-page'
import { AdminSettingsPage } from '@/features/admin/pages/admin-settings-page'
import { AdminAnalyticsPage } from '@/features/admin/pages/admin-analytics-page'

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <HashRouter>
          <AuthRouteGate>
            <Routes>
              {/* 管理员后台 — 独立布局 */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="members" element={<AdminMembersPage />} />
                <Route path="billing" element={<AdminBillingPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="coupons" element={<AdminCouponsPage />} />
                <Route path="feedbacks" element={<AdminFeedbacksPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
              </Route>

              {/* 用户端 — RootLayout */}
              <Route element={<RootLayout />}>
                <Route path="/" element={<EnglishHomePage />} />

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

                {/* 表达库 */}
                <Route path="/expressions" element={<ExpressionLibraryPage />} />

                {/* 我的成长 */}
                <Route path="/growth" element={<GrowthPage />} />

                {/* 成就殿堂 */}
                <Route path="/achievements" element={<AchievementHallPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/member" element={<MemberPage />} />
                <Route path="/notifications" element={<NotificationListPage />} />
                <Route path="/notifications/:id" element={<NotificationDetailPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/invite" element={<InvitePage />} />

                {/* 新手引导 */}
                <Route path="/onboarding" element={<OnboardingLayout />}>
                  <Route path="goals" element={<GoalsSelectionPage />} />
                  <Route path="ability" element={<AbilitySelectionPage />} />
                </Route>

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

              {/* 认证页 — 无外层布局 */}
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            </Routes>
          </AuthRouteGate>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
