// Admin routes — loaded only when user navigates to /admin/*
import { Routes, Route } from 'react-router-dom'
import { AdminLayout } from '@/layout/admin-layout'
import { AdminUsersPage } from '@/features/admin/pages/admin-users-page'
import { AdminMembersPage } from '@/features/admin/pages/admin-members-page'
import { AdminBillingPage } from '@/features/admin/pages/admin-billing-page'
import { AdminNotificationsPage } from '@/features/admin/pages/admin-notifications-page'
import { AdminFeedbacksPage } from '@/features/admin/pages/admin-feedbacks-page'
import { AdminSettingsPage } from '@/features/admin/pages/admin-settings-page'
import { AdminAnalyticsPage } from '@/features/admin/pages/admin-analytics-page'
import { AdminScenesPage } from '@/features/admin/pages/admin-scenes-page'
import { AdminScriptPage } from '@/features/admin/pages/admin-script-page'
import { AdminAchievementsPage } from '@/features/admin/pages/admin-achievements-page'
import { AdminCharactersPage } from '@/features/admin/pages/admin-characters-page'
import { AdminStoriesPage } from '@/features/admin/pages/admin-stories-page'
import { AdminMapsPage } from '@/features/admin/pages/admin-maps-page'
import { AdminNqtrPage } from '@/features/admin/pages/admin-nqtr-page'
import { AdminNarrativePage } from '@/features/admin/pages/admin-narrative-page'
import { AdminThemesPage } from '@/features/admin/theme-manage/pages/theme-list-page'
import { AdminDailySentencesPage } from '@/features/admin/pages/admin-daily-sentences-page'
import { AdminMobileBundlesPage } from '@/features/admin/pages/admin-mobile-bundles-page'
import { AdminLearningPacksPage } from '@/features/admin/pages/admin-learning-packs-page'
import { AdminContentLibraryPage } from '@/features/admin/pages/admin-content-library-page'
import { AdminDictionaryPage } from '@/features/admin/pages/admin-dictionary-page'
import { AdminAiModelsPage } from '@/features/admin/pages/admin-ai-models-page'
import { AdminTasksPage } from '@/features/admin/pages/admin-tasks-page'

/** 后台所有路由 — 自包含 Routes，整体懒加载 */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="members" element={<AdminMembersPage />} />
        <Route path="billing" element={<AdminBillingPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="feedbacks" element={<AdminFeedbacksPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="learning-content" element={<AdminScenesPage />} />
        <Route path="scenes" element={<AdminScenesPage />} />
        <Route path="characters" element={<AdminCharactersPage />} />
        <Route path="stories" element={<AdminStoriesPage />} />
        <Route path="maps" element={<AdminMapsPage />} />
        <Route path="nqtr" element={<AdminNqtrPage />} />
        <Route path="narrative" element={<AdminNarrativePage />} />
        <Route path="script" element={<AdminScriptPage />} />
        <Route path="achievements" element={<AdminAchievementsPage />} />
        <Route path="themes" element={<AdminThemesPage />} />
        <Route path="daily-sentences" element={<AdminDailySentencesPage />} />
        <Route path="mobile-bundles" element={<AdminMobileBundlesPage />} />
        <Route path="learning-packs" element={<AdminLearningPacksPage />} />
        <Route path="content-library" element={<AdminContentLibraryPage />} />
        <Route path="dictionary" element={<AdminDictionaryPage />} />
        <Route path="ai-models" element={<AdminAiModelsPage />} />
        <Route path="tasks" element={<AdminTasksPage />} />
      </Route>
    </Routes>
  )
}
