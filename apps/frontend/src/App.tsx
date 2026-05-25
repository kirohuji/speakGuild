import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/providers/theme-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { AuthRouteGate } from '@/providers/auth-route-guard'
import { RootLayout } from '@/layout/root-layout'
import { AdminLayout } from '@/layout/admin-layout'
import { HomePage } from '@/features/question-bank/pages/home-page'
import { PracticePage } from '@/features/practice/pages/practice-page'
import { MockPage } from '@/features/mock-exam/pages/mock-page'
import { ProfilePage } from '@/features/profile/pages/profile-page'
import { MemberPage } from '@/features/membership/pages/member-page'
import { AccountPage } from '@/features/account/pages/account-page'
import { AdminUsersPage } from '@/features/admin/pages/admin-users-page'
import { AdminMembersPage } from '@/features/admin/pages/admin-members-page'
import { AdminBillingPage } from '@/features/admin/pages/admin-billing-page'
import { AdminNotificationsPage } from '@/features/admin/pages/admin-notifications-page'
import { AdminResourcesPage } from '@/features/admin/pages/admin-resources-page'
import { NotificationListPage } from '@/features/notification/pages/notification-list-page'
import { NotificationDetailPage } from '@/features/notification/pages/notification-detail-page'
import { PortalPage } from '@/features/portal/pages/portal-page'
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
import { AchievementPage } from '@/features/achievement/pages/achievement-page'
import { LeaderboardPage } from '@/features/leaderboard/pages/leaderboard-page'
import { InvitePage } from '@/features/referral/pages/invite-page'
import { AdminCouponsPage } from '@/features/admin/pages/admin-coupons-page'
import { AdminFeedbacksPage } from '@/features/admin/pages/admin-feedbacks-page'
import { AdminQuestionBankPage } from '@/features/admin/pages/admin-question-bank-page'
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
                <Route path="resources" element={<AdminResourcesPage />} />
                <Route path="coupons" element={<AdminCouponsPage />} />
                <Route path="feedbacks" element={<AdminFeedbacksPage />} />
                <Route path="question-bank" element={<AdminQuestionBankPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
              </Route>

              {/* 用户端 — RootLayout */}
              <Route element={<RootLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/portal" element={<PortalPage />} />
                <Route path="/practice/:topicId" element={<PracticePage />} />
                <Route path="/mock" element={<MockPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/member" element={<MemberPage />} />
                <Route path="/notifications" element={<NotificationListPage />} />
                <Route path="/notifications/:id" element={<NotificationDetailPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/achievements" element={<AchievementPage />} />
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
