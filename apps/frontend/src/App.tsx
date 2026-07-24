import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/providers/theme-provider'
import { NativeBridgeProvider } from '@/lib/native'
import { isNative } from '@/lib/native/platform'
import { KeyboardProvider } from '@/providers/keyboard-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { StartupWarmupProvider } from '@/providers/startup-warmup-provider'
import { ThemePresetProvider } from '@/providers/theme-preset-provider'
import { AuthRouteGate } from '@/providers/auth-route-guard'
import { OnboardingProvider } from '@/providers/onboarding-provider'
import { MobileGestureProvider } from '@/providers/mobile-gesture-provider'
import { RootLayout } from '@/layout/root-layout'
import { ErrorBoundary } from '@/components/common/error-boundary'
// ── 首屏必需：静态导入 ──
import { EnglishHomePage } from '@/features/home/pages/english-home-page'
import { LearningPlanPage } from '@/features/learning/pages/learning-plan-page'
import { TodayTaskPage } from '@/features/learning/pages/today-task-page'
import { LearningUnitPage } from '@/features/learning/pages/learning-unit-page'
import { ProfilePage } from '@/features/profile/pages/profile-page'
import { AccountPage } from '@/features/account/pages/account-page'
import { MemberPage } from '@/features/membership/pages/member-page'
import { NotificationListPage } from '@/features/notification/pages/notification-list-page'
import { NotificationDetailPage } from '@/features/notification/pages/notification-detail-page'
import { FeedbackPage } from '@/features/feedback/pages/feedback-page'
import { LoginPage } from '@/features/auth/pages/login-page'
import { RegisterPage } from '@/features/auth/pages/register-page'
import { ForgotPasswordPage } from '@/features/auth/pages/forgot-password-page'

// ── 非首屏页面：懒加载 ──
const AdminRoutes = lazy(() => import('@/routes/admin-routes'))
const PracticeSessionPage = lazy(() => import('@/features/practice/pages/practice-session-page').then(m => ({ default: m.PracticeSessionPage })))
const ExpressionLibraryPage = lazy(() => import('@/features/expression/pages/expression-library-page').then(m => ({ default: m.ExpressionLibraryPage })))
const LearningNotebooksPage = lazy(() => import('@/features/expression/pages/learning-notebooks-page').then(m => ({ default: m.LearningNotebooksPage })))
const AchievementHallPage = lazy(() => import('@/features/achievement/pages/achievement-hall-page').then(m => ({ default: m.AchievementHallPage })))
const LeaderboardPage = lazy(() => import('@/features/leaderboard/pages/leaderboard-page').then(m => ({ default: m.LeaderboardPage })))
const InvitePage = lazy(() => import('@/features/referral/pages/invite-page').then(m => ({ default: m.InvitePage })))
const PortalPage = lazy(() => import('@/features/portal/pages/portal-page').then(m => ({ default: m.PortalPage })))
const CompanyPage = lazy(() => import('@/features/company/pages/company-page').then(m => ({ default: m.CompanyPage })))
const MarketingPage = lazy(() => import('@/features/system/pages/marketing-page').then(m => ({ default: m.MarketingPage })))
const SupportPage = lazy(() => import('@/features/system/pages/support-page').then(m => ({ default: m.SupportPage })))
const SystemTermsPage = lazy(() => import('@/features/system/pages/system-terms-page').then(m => ({ default: m.SystemTermsPage })))
const SystemPrivacyPage = lazy(() => import('@/features/system/pages/system-privacy-page').then(m => ({ default: m.SystemPrivacyPage })))
const SystemChildrenPrivacyPage = lazy(() => import('@/features/system/pages/system-children-page').then(m => ({ default: m.SystemChildrenPrivacyPage })))
const SystemPermissionsPage = lazy(() => import('@/features/system/pages/system-permissions-page').then(m => ({ default: m.SystemPermissionsPage })))
const SystemSdkListPage = lazy(() => import('@/features/system/pages/system-sdk-list-page').then(m => ({ default: m.SystemSdkListPage })))
const SystemCollectInfoPage = lazy(() => import('@/features/system/pages/system-collect-info-page').then(m => ({ default: m.SystemCollectInfoPage })))
const SystemContactPage = lazy(() => import('@/features/system/pages/system-contact-page').then(m => ({ default: m.SystemContactPage })))
const SystemPrivacyConcisePage = lazy(() => import('@/features/system/pages/system-privacy-concise-page').then(m => ({ default: m.SystemPrivacyConcisePage })))
const SystemIcpPage = lazy(() => import('@/features/system/pages/system-icp-page').then(m => ({ default: m.SystemIcpPage })))

function PageLoader() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">Loading...</div>
}

export default function App() {
  return (
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <NativeBridgeProvider>
          <KeyboardProvider>
          <AuthProvider>
            <StartupWarmupProvider>
            <ThemePresetProvider>
            <HashRouter>
            <AuthRouteGate>
              <MobileGestureProvider>
              <OnboardingProvider>
              <Suspense fallback={<PageLoader />}>
              <ErrorBoundary>
              <Routes>
              {/* ── Web 独有：后台管理 — Capacitor 端不注册 ── */}
              {!isNative() && <Route path="/admin/*" element={<AdminRoutes />} />}

              {/* 用户端 — RootLayout */}
              <Route element={<RootLayout />}>
                {/* 首屏静态 */}
                <Route path="/" element={<EnglishHomePage />} />
                <Route path="/learning" element={<LearningPlanPage />} />
                <Route path="/learning/units/:unitId" element={<LearningUnitPage />} />
                <Route path="/today" element={<TodayTaskPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/member" element={<MemberPage />} />
                <Route path="/notifications" element={<NotificationListPage />} />
                <Route path="/notifications/:id" element={<NotificationDetailPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />

                {/* 重页面懒加载 */}
                <Route path="/practice/session/:topicId" element={<PracticeSessionPage />} />
                <Route path="/expressions" element={<LearningNotebooksPage />} />
                <Route path="/expressions/:notebookId" element={<ExpressionLibraryPage />} />
                <Route path="/growth" element={<AchievementHallPage />} />
                <Route path="/achievements" element={<AchievementHallPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/invite" element={<InvitePage />} />

                {/* 系统文档 — 懒加载 */}
                <Route path="/system/terms" element={<SystemTermsPage />} />
                <Route path="/system/privacy" element={<SystemPrivacyPage />} />
                <Route path="/system/privacy-children" element={<SystemChildrenPrivacyPage />} />
                <Route path="/system/permissions" element={<SystemPermissionsPage />} />
                <Route path="/system/sdk-list" element={<SystemSdkListPage />} />
                <Route path="/system/collect-info" element={<SystemCollectInfoPage />} />
                <Route path="/system/privacy-concise" element={<SystemPrivacyConcisePage />} />
                <Route path="/system/icp" element={<SystemIcpPage />} />
                <Route path="/system/contact" element={<SystemContactPage />} />
                <Route path="/system/marketing" element={<MarketingPage />} />
              </Route>

              {/* ── Web 独有：PC/官网页 — Capacitor 端不注册 ── */}
              {!isNative() && <Route path="/portal" element={<PortalPage />} />}
              {!isNative() && <Route path="/company" element={<CompanyPage />} />}
              {!isNative() && <Route path="/marketing" element={<MarketingPage />} />}
              <Route path="/support" element={<SupportPage />} />

              {/* 认证页 — 静态（登录是高频入口） */}
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            </Routes>
            </ErrorBoundary>
            </Suspense>
            </OnboardingProvider>
            </MobileGestureProvider>
          </AuthRouteGate>
        </HashRouter>
          <Toaster
            position="top-center"
            theme="system"
            visibleToasts={1}
            gap={8}
            offset="calc(0.75rem + var(--safe-area-inset-top))"
            toastOptions={{
              duration: 1000,
              unstyled: true,
              classNames: {
                toast: 'flex w-[calc(100vw-2rem)] max-w-sm items-center gap-2.5 rounded-2xl bg-background px-4 py-3 text-foreground',
                content: 'min-w-0 flex-1',
                icon: 'shrink-0 text-current',
                title: 'text-sm font-semibold text-foreground',
                description: 'text-xs text-muted-foreground',
                success: '',
                error: '',
                warning: '',
                info: 'text-foreground',
              },
            }}
          />
          </ThemePresetProvider>
          </StartupWarmupProvider>
      </AuthProvider>
      </KeyboardProvider>
      </NativeBridgeProvider>
    </ThemeProvider>
    </HelmetProvider>
  )
}
