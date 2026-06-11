import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { ActivityCalendar } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, ClipboardList, Star, BookMarked, Settings, User, Trash2,
  Search, X, Volume2, Loader2, ChevronLeft, ChevronRight, Calendar, SortAsc,
  Sparkles, BookOpen, Link2, ExternalLink, Brain, BarChart2, CheckSquare,
  GraduationCap, CheckCircle2, Lightbulb, Crown, Sun, Moon, Monitor,
  Globe, Database, Zap, TrendingUp, Target, Flame, Camera,
  IdCard, PencilLine, LogOut, ShieldAlert, Phone, Mail,
  MessageSquare, Gift, KeyRound, HardDrive,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ConfigDataTable, type ColumnConfig } from '@/components/common/config-datatable'
import {
  getProfileOverview,
  getActivityHeatmap,
  getPracticeRecords,
  getUserProfile,
  updateUserProfile,
  type ProfileOverview,
  type ActivityDay,
  type PracticeRecord,
  type PracticeRecordsResult,
  type UserProfile,
} from '@/features/profile/api'
import { useAuth } from '@/providers/auth-provider'
import { usePreferencesStore } from '@/stores/preferences.store'
import { AppearanceContent } from '@/features/profile/components/appearance-drawer'
import { useConfigStore } from '@/stores/config.store'
import { useLayoutStore } from '@/stores/layout.store'
import {
  lookupWord, getBestPhonetic, getFirstAudio,
  type DictEntry, type Meaning,
} from '@/lib/dictionary-api'
import { enrichWord, type WordEnrichmentResult, type WordExampleItem } from '@/lib/practice-ai-api'
import { synthesizeText } from '@/lib/tts-api'
import { cn } from '@/lib/cn'
import i18n from '@/lib/i18n'
import { getCurrentAvatar, uploadFileToCosAndComplete, setCurrentAvatar } from '@/features/file-assets/api'
import { SystemDocumentDrawer } from '@/features/system/components/system-document-drawer'
import { FeedbackDialog } from '@/features/feedback/components/feedback-dialog'
import { linkSocialAccount, unlinkAccount, type LinkedAccount } from '@/features/account/api'
import { changePassword, sendEmailOtp, verifyEmailOtp, sendBindPhoneOtp, bindPhoneNumber } from '@/features/auth/api'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCountdown } from '@/hooks/use-countdown'
import { MemberPage } from '@/features/membership/pages/member-page'
import { useProfileCacheStore } from '@/features/profile/profile-cache.store'
import { learningContentRepository, offlineStorageService, type OfflineCacheCategory, type OfflineStorageStats } from '@/lib/offline'

type Tab = 'overview' | 'records' | 'words' | 'account' | 'settings'
type MobileView = Tab | 'home' | 'appearance' | 'member' | 'storage'

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

function MobileProfileDetail({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="relative flex shrink-0 items-center justify-center pb-2">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={onBack}
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="max-w-[70%] truncate text-base font-semibold">
          {title}
        </h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto max-w-2xl space-y-4">
          {children}
        </div>
      </div>
    </section>
  )
}

// ─── iOS 风格行组件 ──────────────────────────────────────────────────────────
function IosRow({
  iconBg,
  icon: Icon,
  label,
  subtitle,
  value,
  last = false,
  onTap,
  right,
}: {
  iconBg?: string
  icon?: React.ElementType
  label: string
  subtitle?: string
  value?: string
  last?: boolean
  onTap?: () => void
  right?: React.ReactNode
}) {
  const inner = (
    <div className={cn(
      'flex min-h-[52px] items-center gap-3 px-4 py-3 transition-colors',
      onTap && 'active:bg-muted/60',
      !last && 'border-b border-border/50'
    )}>
      {Icon && iconBg && (
        <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]', iconBg)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right ?? (
        <div className="flex items-center gap-1 text-muted-foreground">
          {value && <span className="text-sm">{value}</span>}
          {onTap && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
        </div>
      )}
    </div>
  )

  return onTap ? (
    <button type="button" onClick={onTap} className="w-full text-left">
      {inner}
    </button>
  ) : (
    <div>{inner}</div>
  )
}

function IosSection({ header, children }: { header?: string; children: React.ReactNode }) {
  return (
    <div>
      {header && (
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {header}
        </p>
      )}
      <div className="overflow-hidden rounded-lg bg-muted/30">
        {children}
      </div>
    </div>
  )
}

// ─── 手机端：个人中心首页 ──────────────────────────────────────────────────
function formatBytes(bytes?: number) {
  const value = Number(bytes ?? 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function MobileStorageView() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<OfflineStorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState<OfflineCacheCategory | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    offlineStorageService.getStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleClear = useCallback(async (category: OfflineCacheCategory) => {
    setClearing(category)
    try {
      await offlineStorageService.clearCategory(category)
      toast.success(category === 'all' ? t('profile.cacheAllCleared', { defaultValue: '缓存已全部清除' }) : t('profile.cacheCleared', { defaultValue: '缓存已清除' }))
      await offlineStorageService.getStats().then(setStats)
    } catch (error: any) {
      toast.error(error?.message || t('profile.cleanupFailed', { defaultValue: '清理失败' }))
    } finally {
      setClearing(null)
    }
  }, [])

  const totalBytes = stats?.totalCacheBytes ?? 0
  const segments = [
    { key: 'packs' as const, label: t('profile.cachePacks', { defaultValue: '学习包内容' }), value: stats?.downloadedPackBytes ?? 0, color: 'bg-blue-500' },
    { key: 'assets' as const, label: t('profile.cacheAssets', { defaultValue: '资源文件' }), value: stats?.localAssetBytes ?? 0, color: 'bg-emerald-500' },
    { key: 'dictionary' as const, label: t('profile.cacheDictionary', { defaultValue: '词典缓存' }), value: stats?.dictionaryBytes ?? 0, color: 'bg-violet-500' },
    { key: 'expressions' as const, label: t('profile.cacheExpressions', { defaultValue: '学习库缓存' }), value: stats?.expressionBytes ?? 0, color: 'bg-amber-500' },
  ]
  const activeSegments = segments.filter((segment) => segment.value > 0)

  const ClearButton = ({ category }: { category: OfflineCacheCategory }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={loading || clearing !== null}
      onClick={(event) => {
        event.stopPropagation()
        void handleClear(category)
      }}
      className="h-8 px-2 text-xs text-red-500 hover:text-red-600"
    >
      {clearing === category ? t('common.clearing', { defaultValue: '清除中' }) : t('common.clear', { defaultValue: '清除' })}
    </Button>
  )

  return (
    <div className="space-y-5">
      <IosSection header={t('profile.cacheDistribution', { defaultValue: '缓存分布' })}>
        <div className="space-y-4 px-4 py-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{t('profile.totalCache', { defaultValue: '本地缓存总量' })}</span>
              <span className="text-sm text-muted-foreground">{loading ? '...' : formatBytes(totalBytes)}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {activeSegments.length === 0 || totalBytes <= 0 ? (
                <div className="h-full w-full bg-muted-foreground/20" />
              ) : (
                activeSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className={segment.color}
                    style={{ width: `${Math.max((segment.value / totalBytes) * 100, 5)}%` }}
                  />
                ))
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', segment.color)} />
                  <span className="truncate">{segment.label}</span>
                </span>
                <span className="flex-shrink-0 font-medium">{loading ? '...' : formatBytes(segment.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </IosSection>

      <IosSection header={t('profile.localLearningData', { defaultValue: '本地学习数据' })}>
        <IosRow
          icon={HardDrive}
          iconBg="bg-blue-500"
          label={t('profile.downloadedPacks', { defaultValue: '已下载学习包' })}
          subtitle={loading ? undefined : `${stats?.downloadedPackCount ?? 0} ${t('profile.packCount', { defaultValue: '个学习包' })}`}
          right={<ClearButton category="packs" />}
        />
        <IosRow
          icon={Database}
          iconBg="bg-emerald-500"
          label={t('profile.localAssets', { defaultValue: '本地资源文件' })}
          subtitle={loading ? undefined : `${stats?.localAssetCount ?? 0} ${t('profile.fileCount', { defaultValue: '个文件' })} · ${formatBytes(stats?.localAssetBytes)}`}
          right={<ClearButton category="assets" />}
        />
        <IosRow
          label={t('profile.offlineDictionary', { defaultValue: '离线词典缓存' })}
          subtitle={loading ? undefined : `${stats?.dictionaryEntryCount ?? 0} ${t('profile.recordCount', { defaultValue: '条记录' })} · ${formatBytes(stats?.dictionaryBytes)}`}
          right={<ClearButton category="dictionary" />}
        />
        <IosRow
          label={t('profile.expressionCache', { defaultValue: '学习库缓存' })}
          subtitle={loading ? undefined : `${stats?.expressionEntryCount ?? 0} ${t('profile.recordCount', { defaultValue: '条记录' })} · ${formatBytes(stats?.expressionBytes)}`}
          right={<ClearButton category="expressions" />}
          last
        />
      </IosSection>

      <IosSection header={t('profile.syncStatus', { defaultValue: '同步状态' })}>
        <IosRow label={t('profile.pendingSync', { defaultValue: '待同步操作' })} value={loading ? '...' : String(stats?.pendingOutboxCount ?? 0)} last />
      </IosSection>

      <IosSection>
        <IosRow
          icon={Trash2}
          iconBg="bg-red-500"
          label={clearing === 'all' ? t('common.clearing', { defaultValue: '清除中...' }) : t('profile.clearAll', { defaultValue: '全部清除' })}
          subtitle={t('profile.clearAllHint', { defaultValue: '清除学习包、资源文件、词典缓存和学习库缓存' })}
          last
          onTap={clearing ? undefined : () => handleClear('all')}
        />
      </IosSection>
    </div>
  )
}

function MobileProfileHome({
  onNavigate,
  onFeedbackOpen,
}: {
  onNavigate: (view: MobileView) => void
  onFeedbackOpen?: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { language, setLanguage } = usePreferencesStore()
  const userProfile = useProfileCacheStore((s) => s.profile)
  const avatarUrl = useProfileCacheStore((s) => s.avatarUrl)
  const pointsBalance = useProfileCacheStore((s) => s.pointsBalance)
  const loadProfileHome = useProfileCacheStore((s) => s.loadProfileHome)
  const [showLanguageDialog, setShowLanguageDialog] = useState(false)
  const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false)

  useEffect(() => {
    loadProfileHome()
  }, [loadProfileHome])

  const themeLabel: Record<string, string> = { light: t('profile.themeLight'), dark: t('profile.themeDark'), system: t('profile.themeSystem') }
  const langLabel: Record<string, string> = { 'zh-CN': t('profile.langZh'), en: t('profile.langEn'), ja: t('profile.langJa') }

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const nickname = userProfile?.name || userProfile?.username || t('app.name')

  return (
    <div className="space-y-3">
      {/* 用户信息区 */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/8 via-primary/4 to-accent/5 px-4 py-4">
        {/* 装饰光斑 */}
        <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 size-20 rounded-full bg-accent/10 blur-2xl" />

        <div className="relative flex items-center gap-4">
          {/* 头像 */}
          <button
            type="button"
            onClick={() => onNavigate('account')}
            className="group relative shrink-0"
          >
            <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary/15 ring-2 ring-background ring-offset-1 ring-offset-primary/5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="size-8 text-primary/60" />
              )}
            </div>
            <span className="absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full bg-foreground/90 text-background shadow-sm">
              <Camera className="size-2.5" />
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-base font-bold leading-tight">{nickname}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {t('member.freeUser')}
              </Badge>
              <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] border-amber-500/30 text-amber-600">
                <Gift className="size-2.5" />{pointsBalance}
              </Badge>
            </div>
          </div>

          {/* 设置 */}
          <button
            onClick={() => onNavigate('settings')}
            className="flex size-9 shrink-0 items-center justify-center self-center rounded-full bg-background/60 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background/80 hover:text-foreground active:scale-95"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>

      {/* 主导航 */}
      <IosSection>
        <IosRow icon={IdCard} iconBg="bg-sky-400" label={t('profile.account')} onTap={() => onNavigate('account')} />
        <IosRow icon={Crown} iconBg="bg-amber-500" label={t('nav.member')} onTap={() => onNavigate('member')} />
        <IosRow icon={MessageSquare} iconBg="bg-emerald-500" label={t('feedback.title')} last onTap={onFeedbackOpen ?? (() => setShowFeedbackDrawer(true))} />
      </IosSection>

      {/* 外观与语言（保留在“我的”首页，点击弹窗切换） */}
      <IosSection>
        <IosRow
          label={t('profile.theme')}
          value={themeLabel[theme || 'system'] ?? t('profile.themeSystem')}
          onTap={() => onNavigate('appearance')}
        />
        <IosRow
          label={t('profile.language')}
          value={langLabel[language] ?? t('profile.langZh')}
          last
          onTap={() => setShowLanguageDialog(true)}
        />
      </IosSection>

      <Drawer open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
        <DrawerContent className="rounded-t-3xl">
          <DrawerHeader>
            <DrawerTitle className="text-base">{t('profile.selectLanguage')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {[
              { value: 'zh-CN', label: t('profile.langZh') },
              { value: 'en', label: t('profile.langEn') },
              { value: 'ja', label: t('profile.langJa') },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  handleLanguageChange(item.value)
                  setShowLanguageDialog(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between border-b px-1 py-3 text-left text-sm',
                  language === item.value && 'font-medium'
                )}
              >
                <span>{item.label}</span>
                {language === item.value && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {!onFeedbackOpen && <FeedbackDialog open={showFeedbackDrawer} onOpenChange={setShowFeedbackDrawer} />}

    </div>
  )
}

// ─── 手机端：设置页 ────────────────────────────────────────────────────────
function MobileSettingsView({ onFeedbackOpen, onNavigate }: { onFeedbackOpen?: () => void; onNavigate?: (view: MobileView) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { autoPlay, setAutoPlay, wifiOnlyMedia, setWifiOnlyMedia } = usePreferencesStore()
  const { config } = useConfigStore()
  const [showBinding, setShowBinding] = useState(false)
  const [autoSpeakOnLookup, setAutoSpeakOnLookup] = useState(true)
  const [pronunciationType, setPronunciationType] = useState<'us' | 'uk'>('us')
  const [autoCopyWord, setAutoCopyWord] = useState(false)
  const [dailyGoal, setDailyGoal] = useState('20')
  const [learningPreference, setLearningPreference] = useState('balanced')
  // 删除账户状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // 处理账户删除
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError(t('profile.auth.passwordRequired'))
      return
    }
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const { deleteAccount } = await import('@/features/auth/api')
      await deleteAccount(deletePassword)
      localStorage.clear()
      window.location.hash = '#/portal'
      window.location.reload()
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || error?.message || t('profile.auth.deleteFailed'))
    } finally {
      setDeleteLoading(false)
    }
  }

  // 法律文档 Drawer 状态
  const [legalDrawer, setLegalDrawer] = useState<{ title: string; content: string } | null>(null)

  // 延迟导入 MD 内容（避免重复加载）
  const [mdContents, setMdContents] = useState<Record<string, string>>({})

  const openLegalDoc = async (key: string, title: string) => {
    if (mdContents[key]) {
      setLegalDrawer({ title, content: mdContents[key] })
      return
    }
    // 动态加载 MD 文件
    try {
      let mod: { default: string }
      switch (key) {
        case 'terms': mod = await import('@/features/system/content/terms-of-service.md?raw'); break
        case 'privacy': mod = await import('@/features/system/content/privacy-policy.md?raw'); break
        case 'privacy-children': mod = await import('@/features/system/content/privacy-children.md?raw'); break
        case 'collect-info': mod = await import('@/features/system/content/collect-info-list.md?raw'); break
        case 'permissions': mod = await import('@/features/system/content/permissions.md?raw'); break
        case 'sdk-list': mod = await import('@/features/system/content/sdk-list.md?raw'); break
        case 'contact': mod = await import('@/features/system/content/contact-us.md?raw'); break
        default: mod = { default: t('profile.auth.noContent') }
      }
      const content = mod.default
      setMdContents((prev) => ({ ...prev, [key]: content }))
      setLegalDrawer({ title, content })
    } catch {
      setLegalDrawer({ title, content: t('profile.auth.loadFailed') })
    }
  }

  const legalDocKeyToTKey: Record<string, string> = {
    terms: 'footer.termsOfService',
    privacy: 'footer.privacy',
    'privacy-children': 'footer.privacyChildren',
    'collect-info': 'footer.collectInfo',
    permissions: 'footer.permissionsApply',
    'sdk-list': 'footer.sdkList',
    contact: 'footer.contactUs',
  }

  const legalDocList = Object.entries(legalDocKeyToTKey).map(([key, tKey]) => ({
    key,
    label: t(tKey),
  }))

  return (
    <div className="space-y-5">
      <IosSection>
        {/* <IosRow
          label={t('profile.autoSpeakLabel')}
          right={<Switch checked={autoPlay} onCheckedChange={setAutoPlay} />}
        />
        <IosRow
          label={t('profile.pronunciationTypeLabel')}
          right={
            <select
              value={pronunciationType}
              onChange={(e) => setPronunciationType(e.target.value as 'us' | 'uk')}
              className="bg-transparent text-sm text-muted-foreground outline-none"
            >
              <option value="us">{t('profile.pronunciationUs')}</option>
              <option value="uk">{t('profile.pronunciationUk')}</option>
            </select>
          }
        />
        <IosRow
          label={t('profile.autoCopyLabel')}
          right={<Switch checked={autoCopyWord} onCheckedChange={setAutoCopyWord} />}
        /> */}
        <IosRow
          label={t('profile.wifiOnlyLabel')}
          last
          right={<Switch checked={wifiOnlyMedia} onCheckedChange={setWifiOnlyMedia} />}
        />
      </IosSection>

      {/* <IosSection>
        <IosRow
          label={t('profile.dailyGoalLabel')}
          right={
            <select
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value)}
              className="bg-transparent text-sm text-muted-foreground outline-none"
            >
              <option value="10">{t('profile.dailyGoal10')}</option>
              <option value="20">{t('profile.dailyGoal20')}</option>
              <option value="30">{t('profile.dailyGoal30')}</option>
            </select>
          }
        />
        <IosRow
          label={t('profile.learningPreferenceLabel')}
          last
          right={
            <select
              value={learningPreference}
              onChange={(e) => setLearningPreference(e.target.value)}
              className="bg-transparent text-sm text-muted-foreground outline-none"
            >
              <option value="balanced">{t('profile.balanceMode')}</option>
              <option value="exam">{t('profile.examMode')}</option>
              <option value="speaking">{t('profile.speakingMode')}</option>
            </select>
          }
        />
      </IosSection> */}

      {/* 法律与隐私 — 移动端使用 Drawer 全屏查看 */}
      <IosSection header={t('profile.legalPrivacy')}>
        {legalDocList.map((doc, idx) => (
          <IosRow
            key={doc.key}
            label={doc.label}
            last={idx === legalDocList.length - 1}
            onTap={() => openLegalDoc(doc.key, doc.label)}
          />
        ))}
      </IosSection>

      <IosSection>
        <IosRow
          label="存储管理"
          subtitle="查看缓存分布并清理本地学习数据"
          onTap={() => onNavigate?.('storage')}
        />
        <IosRow
          label={t('profile.appPermissions')}
          onTap={() => {}}
        />
        <IosRow
          label={t('profile.deleteAccount')}
          last
          onTap={() => setShowDeleteDialog(true)}
        />
      </IosSection>

      <IosSection>
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={async () => { await signOut(); navigate('/auth/login'); }}
            className="w-full text-center text-sm font-medium text-red-500"
          >
            {t('profile.logout')}
          </button>
        </div>
      </IosSection>

      {/* 法律文档全屏 Drawer */}
      {legalDrawer && (
        <SystemDocumentDrawer
          open={legalDrawer !== null}
          onClose={() => setLegalDrawer(null)}
          title={legalDrawer.title}
          content={legalDrawer.content}
        />
      )}

      {/* 删除账户确认弹窗 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t('profile.deleteAccount')}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t('profile.auth.deleteAccountWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={deletePassword}
              onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
              type="password"
              placeholder={t('profile.auth.currentPasswordPlaceholder')}
              autoComplete="current-password"
            />
            {deleteError && (
              <p className="text-sm text-red-500">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleteLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OverviewTab() {
  const { t } = useTranslation()
  const [overview, setOverview] = useState<ProfileOverview | null>(null)
  const [heatmap, setHeatmap] = useState<ActivityDay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hmLoading, setHmLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const maxYear = new Date().getFullYear()

  // Load overview stats once on mount
  useEffect(() => {
    getProfileOverview()
      .then(setOverview)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // Load activity heatmap; reload when year changes
  useEffect(() => {
    setHmLoading(true)
    getActivityHeatmap(year)
      .then(setHeatmap)
      .catch(() => {})
      .finally(() => setHmLoading(false))
  }, [year])

  const stats = [
    { label: t('profile.stats.practiceDays'), value: overview?.totalPracticeDays ?? 0, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: t('profile.stats.totalQuestions'), value: overview?.totalQuestionsAnswered ?? 0, icon: CheckSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: t('profile.stats.favorites'), value: overview?.totalFavorites ?? 0, icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: t('profile.stats.words'), value: overview?.totalWords ?? 0, icon: BookMarked, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: t('profile.stats.streakDays'), value: `${overview?.streakDays ?? 0}`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: t('profile.stats.dailyAvg'), value: overview?.avgDailyQuestions ?? 0, icon: TrendingUp, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('profile.practiceStats')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {stats.map(({ label, value, icon: Icon, color, bg }) => (
                <div
                  key={label}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-border"
                >
                  <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', bg)}>
                    <Icon className={cn('h-4.5 w-4.5', color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight tracking-tight tabular-nums">
                      {value}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {overview?.currentBank && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('profile.currentBank')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{overview.currentBank.bankName}</p>
                <p className="text-xs text-muted-foreground">{t('profile.stats.currentBankDesc')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('profile.activityHeatmap')}</CardTitle>
        </CardHeader>
        <CardContent>
          {hmLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-[120px] w-full rounded-lg" />
              <div className="flex justify-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-7 w-7 rounded-full" />
              </div>
            </div>
          ) : (
            <ActivityCalendarSection
              days={heatmap}
              year={year}
              onPrevYear={() => setYear((y) => y - 1)}
              onNextYear={() => setYear((y) => y + 1)}
              maxYear={maxYear}
            />
          )}
        </CardContent>
      </Card> */}
    </div>
  )
}

function ActivityCalendarSection({
  days,
  year,
  onPrevYear,
  onNextYear,
  maxYear,
}: {
  days: ActivityDay[]
  year: number
  onPrevYear: () => void
  onNextYear: () => void
  maxYear: number
}) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Ensure data always spans the full calendar year (Jan 1 – Dec 31).
  // The library's fillHoles only pads between the first and last activity dates,
  // so we insert boundary entries to force a full-year view like GitHub.
  const yearData = useMemo<ActivityDay[]>(() => {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    if (days.length === 0) {
      // Generate a full year of empty data so the calendar still renders
      const result: ActivityDay[] = []
      const date = new Date(year, 0, 1)
      while (date.getFullYear() === year) {
        const d = date.toISOString().slice(0, 10)
        result.push({ date: d, count: 0, level: 0 })
        date.setDate(date.getDate() + 1)
      }
      return result
    }

    const dateSet = new Set(days.map((d) => d.date))
    const result = [...days]

    if (!dateSet.has(yearStart)) {
      result.unshift({ date: yearStart, count: 0, level: 0 })
    }
    if (!dateSet.has(yearEnd)) {
      result.push({ date: yearEnd, count: 0, level: 0 })
    }

    // Sort to keep dates in ascending order
    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [days, year])

  return (
    <div>
      <div className="flex justify-end overflow-x-auto">
        <ActivityCalendar
          data={yearData}
          blockSize={13}
          blockMargin={4}
          blockRadius={2}
          fontSize={14}
          colorScheme={isDark ? 'dark' : 'light'}
          theme={{
            light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
            dark: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
          }}
          labels={{
            totalCount: t('common.activityTotal', { year, count: yearData.filter(d => d.count > 0).length }),
            legend: { less: t('common.activityLess'), more: t('common.activityMore') },
          }}
          weekStart={0}
        />
      </div>
      <YearNavigator year={year} onPrevYear={onPrevYear} onNextYear={onNextYear} maxYear={maxYear} />
    </div>
  )
}

function YearNavigator({
  year,
  onPrevYear,
  onNextYear,
  maxYear,
}: {
  year: number
  onPrevYear: () => void
  onNextYear: () => void
  maxYear: number
}) {
  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onPrevYear}
        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[4rem] text-center text-sm font-medium tabular-nums">
        {year}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onNextYear}
        disabled={year >= maxYear}
        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function RecordsTab() {
  const { t } = useTranslation()
  const [data, setData] = useState<PracticeRecordsResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 15

  useEffect(() => {
    setIsLoading(true)
    getPracticeRecords({ page, pageSize })
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [page])

  const columns: ColumnConfig<PracticeRecord>[] = [
    {
      key: 'topicName',
      header: t('profile.columns.topic'),
      cell: (v) => <span className="text-sm font-medium">{v}</span>,
    },
    {
      key: 'questionText',
      header: t('profile.columns.question'),
      cell: (v, row) => (
        <div className="max-w-[360px]">
          <span className="line-clamp-1 text-sm text-muted-foreground">{v}</span>
          {row.summary && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">{row.summary}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('profile.columns.status'),
      cell: (v, row) => {
        const statusMap: Record<string, string> = {
          analyzed: t('profile.statusAnalyzed'),
          analyzing: t('profile.statusAnalyzing'),
          completed: t('profile.statusCompleted'),
          failed: t('profile.statusFailed'),
          inProgress: t('profile.statusInProgress'),
        }
        return (
          <div className="flex items-center gap-2">
            <Badge variant={v === 'analyzed' ? 'default' : v === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
              {statusMap[v] || v}
            </Badge>
            {typeof row.score === 'number' && <span className="text-xs font-semibold text-primary">{row.score}</span>}
          </div>
        )
      },
      width: 120,
    },
    {
      key: 'practiceCount',
      header: t('profile.columns.count'),
      cell: (v) => <Badge variant="secondary" className="text-xs">{t('profile.practiceCount', { count: v })}</Badge>,
      width: 80,
    },
    {
      key: 'lastPracticeAt',
      header: t('profile.columns.date'),
      cell: (v) => (
        <span className="text-xs text-muted-foreground">
          {new Date(v).toLocaleDateString()}
        </span>
      ),
      width: 100,
    },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{t('profile.records')}</h2>
      <p className="rounded-lg bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
        完成最终 AI 复盘后才会生成练习记录，中途退出不会计入记录。
      </p>
      <ConfigDataTable
        data={data?.list || []}
        columns={columns}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t('common.empty')}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 生词本 Tab — 完整实现
// ═══════════════════════════════════════════════════════════════

type GroupMode = 'date' | 'alpha'

type SavedWordEntry = {
  word: string
  addedAt: string
}

function getDateLabel(iso: string, t: (key: string, options?: any) => string): string {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return t('profile.wordToday')
  if (diffDays === 1) return t('profile.wordYesterday')
  if (diffDays < 7) return t('profile.wordDaysAgo', { count: diffDays })
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function groupEntries(entries: SavedWordEntry[], mode: GroupMode, t: (key: string, opts?: any) => string) {
  if (mode === 'alpha') {
    const map = new Map<string, SavedWordEntry[]>()
    for (const e of [...entries].sort((a, b) => a.word.localeCompare(b.word))) {
      const letter = e.word[0]?.toUpperCase() ?? '#'
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter)!.push(e)
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  }
  const map = new Map<string, SavedWordEntry[]>()
  for (const e of [...entries].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  )) {
    const label = getDateLabel(e.addedAt, t)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(e)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

const POS_COLORS: Record<string, string> = {
  noun: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  verb: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  adjective: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  adverb: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  pronoun: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  preposition: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  conjunction: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}


function MeaningSection({ meaning, chineseGloss }: { meaning: Meaning; chineseGloss?: string }) {
  const { t } = useTranslation()
  const posColor = POS_COLORS[meaning.partOfSpeech] ?? 'bg-muted text-muted-foreground'
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)

  const speakExample = (text: string, idx: number) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'en-US'; utt.rate = 0.9
    setPlayingIdx(idx)
    utt.onend = () => setPlayingIdx(null)
    window.speechSynthesis.speak(utt)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', posColor)}>
          {meaning.partOfSpeech}
        </span>
        {chineseGloss && (
          <span className="text-sm text-muted-foreground">{chineseGloss}</span>
        )}
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3">
        {meaning.definitions.slice(0, 5).map((def, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">{def.definition}</p>
            </div>
            {def.example && (
              <div className="ml-7 flex items-start gap-2 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 border border-blue-100 dark:border-blue-900/30">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                <p className="flex-1 text-sm italic text-blue-800 dark:text-blue-300 leading-relaxed">"{def.example}"</p>
                <button type="button" onClick={() => speakExample(def.example!, i)}
                  className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors">
                  {playingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
            {(def.synonyms.length > 0 || def.antonyms.length > 0) && (
              <div className="ml-7 flex flex-wrap gap-3 text-xs">
                {def.synonyms.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">{t('profile.synonymLabel')}</span>
                    {def.synonyms.slice(0, 5).map((s) => (
                      <span key={s} className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{s}</span>
                    ))}
                  </div>
                )}
                {def.antonyms.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">{t('profile.antonymLabel')}</span>
                    {def.antonyms.slice(0, 4).map((a) => (
                      <span key={a} className="rounded-md bg-red-50 px-1.5 py-0.5 text-red-700 dark:bg-red-900/20 dark:text-red-300">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function useLevelConfig() {
  const { t } = useTranslation()
  return {
    basic: { label: t('profile.levelBasic'), color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    intermediate: { label: t('profile.levelIntermediate'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    advanced: { label: t('profile.levelAdvanced'), color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  }
}

function ExampleCard({ ex, idx }: { ex: WordExampleItem; idx: number }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cachedUrlRef = useRef<string | null>(null)
  const { ttsBackend, setTtsBackend } = usePreferencesStore()
  const levelConfig = useLevelConfig()
  const cfg = levelConfig[ex.level]
  const isMiniMax = ttsBackend.provider === 'minimax'

  const toggleTtsProvider = () => {
    // 切换时使用对应引擎的一组安全默认参数，避免旧参数结构不兼容
    if (isMiniMax) {
      setTtsBackend({
        provider: 'cartesia',
        model: 'sonic-3',
        voiceId: '79a125e8-cd45-4c13-8a67-188112f4dd22',
        params: { speed: 1, volume: 1 },
      })
      return
    }
    setTtsBackend({
      provider: 'minimax',
      model: 'speech-2.8-hd',
      voiceId: 'English_Trustworthy_Man',
      params: { speed: 1, vol: 1, pitch: 0 },
    })
  }

  const handleSpeak = async () => {
    if (state === 'loading') return

    // 已缓存，直接播放
    if (cachedUrlRef.current) {
      audioRef.current?.play()
      return
    }

    setState('loading')
    try {
      const result = await synthesizeText({
        text: ex.en,
        provider: ttsBackend.provider,
        model: ttsBackend.model,
        voiceId: ttsBackend.voiceId,
        params: ttsBackend.params,
      })
      const url = `data:${result.mimeType};base64,${result.audioBase64}`
      cachedUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onplay = () => setState('playing')
      audio.onended = () => setState('idle')
      audio.onerror = () => setState('error')
      await audio.play()
    } catch {
      setState('error')
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t('profile.exampleLabel', { count: idx + 1 })}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.color)}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTtsProvider}
            className="rounded-full border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            title={t('profile.switchEngine')}
          >
            {isMiniMax ? 'MiniMax' : 'Cartesia'}
          </button>
          <button type="button" onClick={handleSpeak}
            disabled={state === 'loading'}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 transition-colors disabled:opacity-60">
            {state === 'loading'
              ? <><Loader2 className="h-3 w-3 animate-spin" />{t('profile.synthesizing')}</>
              : state === 'playing'
              ? <><Volume2 className="h-3 w-3" />{t('profile.playing')}</>
              : state === 'error'
              ? <><Volume2 className="h-3 w-3 text-destructive" />{t('profile.retry')}</>
              : <><Volume2 className="h-3 w-3" />{t('profile.play')}</>}
          </button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm font-medium leading-relaxed">{ex.en}</p>
        {ex.zh ? (
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">{ex.zh}</p>
        ) : null}
        {ex.note && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />{ex.note}
          </p>
        )}
      </div>
    </div>
  )
}

function WordDetailDialog({
  entry, onClose, onPrev, onNext, hasPrev, hasNext,
}: {
  entry: SavedWordEntry | null
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  const { t } = useTranslation()
  const [dictData, setDictData] = useState<DictEntry[] | null | 'loading'>(null)
  const [enrichData, setEnrichData] = useState<WordEnrichmentResult | null | 'loading'>(null)
  const [enrichError, setEnrichError] = useState('')
  const [activeTab, setActiveTab] = useState<'meanings' | 'examples' | 'synonyms'>('meanings')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!entry) return
    setDictData('loading')
    setEnrichData('loading')
    setEnrichError('')
    setActiveTab('meanings')

    lookupWord(entry.word).then((data) => {
      setDictData(data)
      const summary = data
        ? data.flatMap(e => e.meanings).slice(0, 3)
            .map(m => `${m.partOfSpeech}: ${m.definitions[0]?.definition ?? ''}`)
            .join(' | ')
        : undefined
      enrichWord(entry.word, summary)
        .then(setEnrichData)
        .catch((e) => { setEnrichData(null); setEnrichError(e?.message ?? t('common.error')) })
    })
  }, [entry?.word])

  const playAudio = useCallback((url: string) => {
    audioRef.current?.pause()
    const a = new Audio(url.startsWith('//') ? 'https:' + url : url)
    audioRef.current = a
    a.play().catch(() => {})
  }, [])

  if (!entry) return null

  const dictEntries = Array.isArray(dictData) ? dictData : []
  const mainEntry = dictEntries[0]
  const phonetic = mainEntry ? getBestPhonetic(mainEntry) : null
  const phonetics = mainEntry?.phonetics.filter(p => p.text || p.audio) ?? []
  const audioUrl = mainEntry ? getFirstAudio(mainEntry.phonetics) : null
  const enriched = enrichData !== 'loading' && enrichData !== null ? enrichData : null
  const allMeanings = dictEntries.flatMap(e => e.meanings)

  const posGlossMap = new Map(
    (enriched?.meanings ?? []).map(m => [m.partOfSpeech, m.chineseGloss])
  )

  const allSynonyms = [...new Set(allMeanings.flatMap(m => [...m.synonyms, ...m.definitions.flatMap(d => d.synonyms)]))]
  const allAntonyms = [...new Set(allMeanings.flatMap(m => [...m.antonyms, ...m.definitions.flatMap(d => d.antonyms)]))]

  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="h-[100dvh] w-screen max-w-none flex flex-col p-0 gap-0 overflow-hidden rounded-none md:h-[90vh] md:max-w-4xl md:rounded-2xl [&>button]:hidden">

        {/* Header */}
        <div className="relative border-b border-border/50 bg-gradient-to-br from-primary/5 to-background px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{entry.word}</h1>
                {enriched?.chineseTranslation ? (
                  <span className="text-lg text-muted-foreground">{enriched.chineseTranslation}</span>
                ) : enrichData === 'loading' ? (
                  <Skeleton className="h-6 w-24 inline-block" />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {phonetics.length > 0 ? phonetics.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {p.text && <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{p.text}</span>}
                    {p.audio && (
                      <button type="button" onClick={() => playAudio(p.audio!)}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20 transition-colors">
                        <Volume2 className="h-3 w-3" />{i === 0 ? 'UK' : i === 1 ? 'US' : t('profile.pronounce')}
                      </button>
                    )}
                  </div>
                )) : phonetic ? (
                  <span className="font-mono text-sm text-muted-foreground">{phonetic}</span>
                ) : null}
                {audioUrl && !phonetics.some(p => p.audio) && (
                  <button type="button" onClick={() => playAudio(audioUrl)}
                    className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 transition-colors">
                    <Volume2 className="h-3.5 w-3.5" />{t('profile.pronounce')}
                  </button>
                )}
              </div>

              {enriched?.memoryTip && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2 w-fit">
                  <Brain className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-amber-800 dark:text-amber-300">{enriched.memoryTip}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
              title={t('profile.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {mainEntry?.origin && (
            <div className="mt-3 flex items-start gap-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium">{t('profile.origin')}</span>{mainEntry.origin}
              </p>
            </div>
          )}
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-1 border-b border-border/50 px-6 bg-muted/20">
          {([
            { key: 'meanings', icon: BookOpen, label: t('profile.tabMeanings'), count: allMeanings.length },
            { key: 'examples', icon: GraduationCap, label: t('profile.tabExamples'), count: enriched?.examples.length ?? 0 },
            { key: 'synonyms', icon: BarChart2, label: t('profile.tabSynonyms'), count: allSynonyms.length + allAntonyms.length },
          ] as const).map(({ key, icon: Icon, label, count }) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>
              <Icon className="h-3.5 w-3.5" />{label}
              {count > 0 && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  activeTab === key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-5">
            {activeTab === 'meanings' && (
              dictData === 'loading' ? (
                <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>)}</div>
              ) : !mainEntry ? (
                <div className="py-12 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm">{t('profile.noDictData')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {allMeanings.map((meaning, mi) => (
                    <MeaningSection key={mi} meaning={meaning} chineseGloss={posGlossMap.get(meaning.partOfSpeech)} />
                  ))}
                  {mainEntry.sourceUrls?.map(url => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3 w-3" />{t('profile.viewFullEntry')}
                    </a>
                  ))}
                </div>
              )
            )}

            {activeTab === 'examples' && (
              enrichData === 'loading' ? (
                <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="rounded-2xl border border-border/60 p-4 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>)}</div>
              ) : enrichError ? (
                <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{enrichError}</div>
              ) : !enriched?.examples.length ? (
                <div className="py-10 text-center text-muted-foreground">
                  <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  <p className="text-sm">{t('profile.aiExamplesRequireKey')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {t('profile.aiExamplesDesc')}
                  </p>
                  {enriched.examples.map((ex, i) => <ExampleCard key={i} ex={ex} idx={i} />)}
                </div>
              )
            )}

            {activeTab === 'synonyms' && (
              <div className="space-y-5">
                {allSynonyms.length > 0 && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />近义词
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {allSynonyms.slice(0, 20).map(s => (
                        <span key={s} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {allAntonyms.length > 0 && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />反义词
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {allAntonyms.slice(0, 20).map(a => (
                        <span key={a} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {allSynonyms.length === 0 && allAntonyms.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground text-sm">{t('profile.noSynonymData')}</div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 px-6 py-3 bg-muted/10">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />{t('profile.prevWord')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('profile.addedAt', { date: new Date(entry.addedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) })}
          </span>
          <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext} className="gap-1.5">
            {t('profile.nextWord')}<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 单词小卡片
function WordCard({
  entry, isSelected, onClick, multiSelect, checked, onToggleSelect,
}: {
  entry: SavedWordEntry
  isSelected: boolean
  onClick: () => void
  multiSelect: boolean
  checked: boolean
  onToggleSelect: () => void
}) {
  const { t } = useTranslation()
  const [dictData, setDictData] = useState<DictEntry[] | null | 'loading'>('loading')

  useEffect(() => { lookupWord(entry.word).then(setDictData) }, [entry.word])

  const first = Array.isArray(dictData) ? dictData[0] : null
  const phonetic = first ? getBestPhonetic(first) : null
  const firstMeaning = first?.meanings[0]
  const firstDef = firstMeaning?.definitions[0]?.definition

  return (
    <Card
      className={cn(
        'group relative cursor-pointer transition-all hover:shadow-md active:scale-[0.98]',
        isSelected && 'ring-2 ring-primary',
        multiSelect && checked && 'ring-2 ring-primary',
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{entry.word}</p>
            {phonetic && <p className="text-[10px] text-muted-foreground font-mono">{phonetic}</p>}
          </div>
          {multiSelect && (
            <button
              type="button"
              className={cn(
                'shrink-0 rounded-md p-0.5 transition-colors',
                checked ? 'text-primary' : 'text-muted-foreground'
              )}
              onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {firstMeaning && <Badge variant="outline" className="text-[10px] h-4">{firstMeaning.partOfSpeech}</Badge>}
        {dictData === 'loading' ? (
          <div className="space-y-1"><Skeleton className="h-2.5 w-full" /><Skeleton className="h-2.5 w-3/4" /></div>
        ) : firstDef ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{firstDef}</p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic">{t('profile.noDefinition')}</p>
        )}
      </CardContent>
    </Card>
  )
}

function WordsTab() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<SavedWordEntry[]>([])
  const [search, setSearch] = useState('')
  const [groupMode, setGroupMode] = useState<GroupMode>('date')
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedWords, setSelectedWords] = useState<string[]>([])

  const refreshEntries = useCallback(() => {
    learningContentRepository.listExpressionEntries('word').then((items) => {
      setEntries(items.map((item) => ({ word: item.original ?? '', addedAt: item.createdAt })).filter((item) => item.word))
    })
  }, [])

  useEffect(() => {
    refreshEntries()
  }, [refreshEntries])

  const removeWord = useCallback(async (word: string) => {
    await learningContentRepository.deleteExpressionByTextAndSync('word', word)
    setEntries((current) => current.filter((entry) => entry.word !== word))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter((e) => e.word.toLowerCase().includes(q))
  }, [entries, search])

  const flatList = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()),
    [filtered]
  )

  const groups = useMemo(() => groupEntries(filtered, groupMode, t), [filtered, groupMode, t])

  const selectedEntry = flatList.find((e) => e.word === selectedWord) ?? null
  const selectedIdx = selectedEntry ? flatList.indexOf(selectedEntry) : -1

  const openWord = useCallback((word: string) => {
    if (!multiSelectMode) setSelectedWord(word)
  }, [multiSelectMode])
  const closeDialog = useCallback(() => setSelectedWord(null), [])
  const gotoPrev = useCallback(() => {
    if (selectedIdx > 0) setSelectedWord(flatList[selectedIdx - 1].word)
  }, [selectedIdx, flatList])
  const gotoNext = useCallback(() => {
    if (selectedIdx < flatList.length - 1) setSelectedWord(flatList[selectedIdx + 1].word)
  }, [selectedIdx, flatList])

  const toggleMultiSelectMode = () => {
    setMultiSelectMode((prev) => {
      if (prev) setSelectedWords([])
      return !prev
    })
  }

  const toggleWordChecked = (word: string) => {
    setSelectedWords((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    )
  }

  const deleteSelectedWords = async () => {
    await Promise.all(selectedWords.map((word) => removeWord(word)))
    setSelectedWords([])
    setMultiSelectMode(false)
  }

  // 键盘 ← → 在 dialog 里切换
  useEffect(() => {
    if (!selectedWord) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gotoPrev()
      else if (e.key === 'ArrowRight') gotoNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedWord, gotoPrev, gotoNext])

  if (entries.length === 0 && !search) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-muted/40 py-16 text-center text-muted-foreground">
          <BookMarked className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>{t('profile.noWords')}</p>
          <p className="mt-1 text-xs opacity-70">{t('profile.addWordHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold">{t('profile.words')}</h2>
          <Badge variant="secondary">{entries.length}</Badge>
        </div>

        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('profile.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* 分组 + 多选（过滤层） */}
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex rounded-lg bg-muted p-0.5">
            {([
              { mode: 'date', icon: Calendar, label: t('profile.groupByDate') },
              { mode: 'alpha', icon: SortAsc, label: t('profile.groupByAlpha') },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setGroupMode(mode)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all',
                  groupMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3 w-3" />{label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={multiSelectMode ? 'default' : 'outline'}
              className="h-8 w-8 p-0"
              onClick={toggleMultiSelectMode}
              title={multiSelectMode ? t('profile.cancelMultiSelect') : t('profile.multiSelect')}
              aria-label={multiSelectMode ? t('profile.cancelMultiSelect') : t('profile.enableMultiSelect')}
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
            {multiSelectMode && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8"
                onClick={deleteSelectedWords}
                disabled={selectedWords.length === 0}
              >
                {t('profile.deleteCount', { count: selectedWords.length })}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 分组卡片 */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <Search className="mx-auto mb-2 h-7 w-7 opacity-30" />
          {t('profile.noMatchWord')}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-2.5 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
                <Badge variant="outline" className="text-[10px] h-4">{group.items.length}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((e) => (
                  <WordCard
                    key={e.word}
                    entry={e}
                    isSelected={selectedWord === e.word}
                    onClick={() => {
                      if (multiSelectMode) toggleWordChecked(e.word)
                      else openWord(e.word)
                    }}
                    multiSelect={multiSelectMode}
                    checked={selectedWords.includes(e.word)}
                    onToggleSelect={() => toggleWordChecked(e.word)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 单词详情 Dialog */}
      <WordDetailDialog
        entry={selectedEntry}
        onClose={closeDialog}
        onPrev={gotoPrev}
        onNext={gotoNext}
        hasPrev={selectedIdx > 0}
        hasNext={selectedIdx < flatList.length - 1}
      />
    </div>
  )
}

// ─── PC 端：昵称编辑弹窗 ──────────────────────────────────────────────────
function NicknameEditDialog({
  open,
  onOpenChange,
  currentName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onSaved: (name: string) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(currentName)
  }, [currentName, open])

  const handleSave = async () => {
    if (!name.trim() || name.trim() === currentName) {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await updateUserProfile({ name: name.trim() })
      onSaved(name.trim())
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      onOpenChange(false)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('profile.editNicknameTitle')}</DialogTitle>
          <DialogDescription>{t('profile.nicknameDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('profile.nicknamePlaceholder')}
            maxLength={20}
          />
          <p className="text-right text-xs text-muted-foreground">{name.length}/20</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── PC 端：账户管理页 ────────────────────────────────────────────────────
function AccountTab({ desktop = false }: { desktop?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, refreshSession } = useAuth()
  const sessionUser = session?.user ?? null
  const profile = useProfileCacheStore((s) => s.profile)
  const avatarUrl = useProfileCacheStore((s) => s.avatarUrl)
  const linkedAccounts = useProfileCacheStore((s) => s.linkedAccounts)
  const accountLoaded = useProfileCacheStore((s) => s.profileLoaded && s.avatarLoaded && s.linkedAccountsLoaded)
  const loadAccount = useProfileCacheStore((s) => s.loadAccount)
  const refreshLinkedAccounts = useProfileCacheStore((s) => s.refreshLinkedAccounts)
  const patchCachedProfile = useProfileCacheStore((s) => s.patchProfile)
  const setCachedAvatarUrl = useProfileCacheStore((s) => s.setAvatarUrl)
  const setCachedLinkedAccounts = useProfileCacheStore((s) => s.setLinkedAccounts)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false)
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!accountLoaded)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false)
  const [verificationOtp, setVerificationOtp] = useState('')
  const [verificationError, setVerificationError] = useState('')
  // 手机号绑定
  const [phoneBindOpen, setPhoneBindOpen] = useState(false)
  const [bindPhone, setBindPhone] = useState('')
  const [bindOtp, setBindOtp] = useState('')
  const [bindLoading, setBindLoading] = useState(false)
  const [bindError, setBindError] = useState('')
  const [bindOtpSent, setBindOtpSent] = useState(false)
  const [bindCountdown, startBindCountdown, resetBindCountdown] = useCountdown(60)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = useCallback(async () => {
    if (!accountLoaded) setIsLoading(true)
    await loadAccount()
    setIsLoading(false)
  }, [accountLoaded, loadAccount])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    if (accountLoaded) setIsLoading(false)
  }, [accountLoaded])

  useEffect(() => {
    const handleFocus = () => {
      refreshLinkedAccounts()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refreshLinkedAccounts])

  const onPickAvatar = () => avatarInputRef.current?.click()

  const onAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.currentTarget.value = ''
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.avatarHint'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.avatarHint'))
      return
    }

    setAvatarUploading(true)
    try {
      const asset = await uploadFileToCosAndComplete({ file, group: 'avatar' })
      const current = await setCurrentAvatar(asset.id)
      if (!current?.url) throw new Error(t('profile.auth.loadFailed'))
      setCachedAvatarUrl(current.url)
      await loadAccount(true)
      toast.success(t('profile.avatarUpdated', { defaultValue: '头像已更新' }))
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || t('profile.auth.loadFailed'))
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleLinkSocial = async (provider: 'wechat' | 'apple') => {
    try {
      setLinkingProvider(provider)
      await linkSocialAccount(provider)
    } catch {
      setLinkingProvider(null)
    }
  }

  const handleUnlink = async (account: LinkedAccount) => {
    if (unlinkingId) return
    setUnlinkingId(account.id)
    try {
      await unlinkAccount(account)
      setCachedLinkedAccounts(linkedAccounts.filter((a) => a.id !== account.id))
    } catch {
      // ignore
    } finally {
      setUnlinkingId(null)
    }
  }

  const handleNicknameSaved = (name: string) => {
    patchCachedProfile({ name })
  }

  const wechatBound = linkedAccounts.some((a) => a.providerId === 'wechat')
  const appleBound = linkedAccounts.some((a) => a.providerId === 'apple')
  const wechatAccount = linkedAccounts.find((a) => a.providerId === 'wechat')
  const appleAccount = linkedAccounts.find((a) => a.providerId === 'apple')

  const nickname = profile?.name || sessionUser?.name || t('profile.notBound')
  const phoneNumber = profile?.phoneNumber || sessionUser?.phoneNumber || null
  const email = profile?.email || sessionUser?.email || null

  const handleSendVerification = async () => {
    if (!email || sendingVerification || verificationSent) return
    setSendingVerification(true)
    setVerificationError('')
    try {
      await sendEmailOtp(email)
      setVerificationSent(true)
    } catch {
      // ignore
    } finally {
      setSendingVerification(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (!email || verificationOtp.length !== 6) {
      setVerificationError(t('auth.enterOtp'))
      return
    }

    setSendingVerification(true)
    setVerificationError('')
    try {
      await verifyEmailOtp(email, verificationOtp)
      await refreshSession()
      patchCachedProfile({ emailVerified: true })
      setVerificationDialogOpen(false)
    } catch (error: any) {
      setVerificationError(error?.response?.data?.message || error?.message || t('auth.invalidOtp'))
    } finally {
      setSendingVerification(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword) { setPasswordError(t('profile.auth.currentPasswordPlaceholder')); return }
    if (newPassword.length < 8) { setPasswordError(t('profile.auth.newPasswordPlaceholder')); return }
    if (newPassword !== confirmPassword) { setPasswordError(t('auth.passwordMismatch')); return }

    setPasswordLoading(true)
    setPasswordError('')
    try {
      await changePassword(currentPassword, newPassword)
      setPasswordDialogOpen(false)
    } catch (error: any) {
      setPasswordError(error?.response?.data?.message || error?.message || t('account.changeFailed'))
    } finally {
      setPasswordLoading(false)
    }
  }

  useEffect(() => {
    if (!passwordDialogOpen) return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
  }, [passwordDialogOpen])

  useEffect(() => {
    if (!verificationDialogOpen) return
    setVerificationOtp('')
    setVerificationError('')
    setVerificationSent(false)
  }, [verificationDialogOpen])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-muted/30 p-4 space-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <NicknameEditDialog
        open={nicknameDialogOpen}
        onOpenChange={setNicknameDialogOpen}
        currentName={nickname}
        onSaved={handleNicknameSaved}
      />

      {/* 头像 */}
      <div className="rounded-xl bg-muted/30 p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.avatar')}</p>
        <div
          className={cn(
            'flex items-center gap-4',
            avatarUploading ? 'cursor-default opacity-80' : 'cursor-pointer',
          )}
          role="button"
          tabIndex={avatarUploading ? -1 : 0}
          aria-label={t('profile.changeAvatar')}
          onClick={avatarUploading ? undefined : onPickAvatar}
          onKeyDown={(event) => {
            if (avatarUploading) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onPickAvatar()
            }
          }}
        >
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={avatarUploading}
            onChange={onAvatarFileChange}
          />
          <button
            type="button"
            disabled={avatarUploading}
            tabIndex={-1}
            className="group relative flex-shrink-0"
          >
            <Avatar className="size-16 ring-2 ring-border ring-offset-2 ring-offset-background transition-shadow group-hover:ring-primary/50">
              <AvatarImage src={avatarUrl || undefined} alt="avatar" />
              <AvatarFallback className="bg-primary/10">
                <User className="size-8 text-primary" />
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              {avatarUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
            </span>
          </button>
          <div>
            <p className="text-sm font-medium">{t('profile.changeAvatar')}</p>
            <p className="text-xs text-muted-foreground">{t('profile.avatarHint')}</p>
            {avatarUploading && (
              <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                <Loader2 className="size-3 animate-spin" />
                {t('common.uploading')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="overflow-hidden rounded-xl bg-muted/30">
        <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.basicInfo')}</p>
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <PencilLine className="size-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm">{t('profile.nickname')}</p>
                <p className="text-xs text-muted-foreground">{nickname}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setNicknameDialogOpen(true)}>
              {t('profile.editNickname')}
            </Button>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Mail className="size-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm">{t('profile.email')}</p>
                <p className="text-xs text-muted-foreground truncate">{email || t('profile.notBound')}</p>
              </div>
            </div>
            {desktop && !profile?.emailVerified && email && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerificationDialogOpen(true)}
              >
                {t('profile.verify')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 账号绑定 */}
      <div className="overflow-hidden rounded-xl bg-muted/30">
        <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.accountBinding')}</p>
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                <Phone className="size-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm">{t('profile.phone')}</p>
                <p className="text-xs text-muted-foreground">
                  {phoneNumber || t('profile.notBound')}
                </p>
              </div>
            </div>
            {phoneNumber ? (
              <Badge variant="outline" className="text-xs">
                {t('profile.boundPrefix')}
              </Badge>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setPhoneBindOpen(true)}>
                {t('profile.bind')}
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#07C160]/15">
                <span className="text-sm font-bold text-[#07C160]">微</span>
              </div>
              <div>
                <p className="text-sm">{t('profile.wechat')}</p>
                <p className="text-xs text-muted-foreground">
                  {wechatBound ? t('profile.boundPrefix') : t('profile.wechatBind')}
                </p>
              </div>
            </div>
            {wechatBound ? (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={unlinkingId === wechatAccount?.id} onClick={() => wechatAccount && handleUnlink(wechatAccount)}>
                {unlinkingId === wechatAccount?.id ? <Loader2 className="size-3.5 animate-spin" /> : t('profile.unbind')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="border-[#07C160]/30 text-[#07C160] hover:bg-[#07C160]/10" disabled={linkingProvider === 'wechat'} onClick={() => handleLinkSocial('wechat')}>
                {linkingProvider === 'wechat' ? <Loader2 className="mr-1 size-3 animate-spin" /> : <ExternalLink className="mr-1 size-3" />}
                {t('profile.bind')}
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                <span className="text-sm font-bold text-foreground">A</span>
              </div>
              <div>
                <p className="text-sm">{t('profile.appleId')}</p>
                <p className="text-xs text-muted-foreground">
                  {appleBound ? t('profile.boundPrefix') : t('profile.appleIdBind')}
                </p>
              </div>
            </div>
            {appleBound ? (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={unlinkingId === appleAccount?.id} onClick={() => appleAccount && handleUnlink(appleAccount)}>
                {unlinkingId === appleAccount?.id ? <Loader2 className="size-3.5 animate-spin" /> : t('profile.unbind')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={linkingProvider === 'apple'} onClick={() => handleLinkSocial('apple')}>
                {linkingProvider === 'apple' ? <Loader2 className="mr-1 size-3 animate-spin" /> : <ExternalLink className="mr-1 size-3" />}
                {t('profile.bind')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 账号安全 */}
      {desktop && <div className="overflow-hidden rounded-xl bg-muted/30">
        <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.dangerZone')}</p>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <KeyRound className="size-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm">{t('profile.auth.changePassword')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.auth.passwordSecurity')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPasswordDialogOpen(true)}>
            {t('profile.auth.changePassword')}
          </Button>
        </div>
      </div>}

      {desktop && <Dialog open={verificationDialogOpen} onOpenChange={setVerificationDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile.verify')}</DialogTitle>
            <DialogDescription>{email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={verificationOtp}
              onChange={(e) => setVerificationOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder={t('auth.otpPlaceholder')}
              autoComplete="one-time-code"
            />
            {verificationError && <p className="text-sm text-destructive">{verificationError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleSendVerification} disabled={sendingVerification || verificationSent}>
              {verificationSent ? t('common.sent') : sendingVerification ? t('common.sending') : t('auth.getOtp')}
            </Button>
            <Button onClick={handleVerifyEmail} disabled={sendingVerification || verificationOtp.length !== 6}>
              {sendingVerification && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

      {/* 手机号绑定弹窗 */}
      <Dialog open={phoneBindOpen} onOpenChange={(v) => { setPhoneBindOpen(v); if (!v) { setBindPhone(''); setBindOtp(''); setBindError(''); setBindOtpSent(false); resetBindCountdown() } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile.bindPhone')}</DialogTitle>
            <DialogDescription>{t('profile.bindPhoneDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={bindPhone}
                onChange={(e) => { setBindPhone(e.target.value); setBindOtpSent(false); resetBindCountdown() }}
                placeholder="+8613800000000"
                className="flex-1"
                autoComplete="tel"
              />
              <Button
                variant="outline"
                className="h-11 shrink-0"
                disabled={bindLoading || bindCountdown > 0 || !bindPhone.trim()}
                onClick={async () => {
                  if (!bindPhone.trim()) return
                  setBindLoading(true)
                  setBindError('')
                  try {
                    await sendBindPhoneOtp(bindPhone.trim())
                    setBindOtpSent(true)
                    startBindCountdown()
                  } catch (e: any) {
                    setBindError(e?.message || t('auth.loginFailed'))
                  } finally {
                    setBindLoading(false)
                  }
                }}
              >
                {bindCountdown > 0 ? `${bindCountdown}s` : bindOtpSent ? t('common.sent') : t('auth.getOtp')}
              </Button>
            </div>
            <Input
              value={bindOtp}
              onChange={(e) => setBindOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder={t('auth.otpPlaceholder')}
              autoComplete="one-time-code"
              maxLength={6}
            />
            {bindError && <p className="text-sm text-destructive">{bindError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneBindOpen(false)} disabled={bindLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (!bindPhone.trim() || bindOtp.length !== 6) return
                setBindLoading(true)
                setBindError('')
                try {
                  const result = await bindPhoneNumber(bindPhone.trim(), bindOtp)
                  const boundPhoneNumber = result?.user?.phoneNumber || bindPhone.trim()
                  await refreshSession()
                  patchCachedProfile({
                    phoneNumber: boundPhoneNumber,
                    phoneNumberVerified: true,
                  })
                  await loadAccount(true)
                  setPhoneBindOpen(false)
                  toast.success(t('profile.bindPhoneSuccess'))
                } catch (e: any) {
                  setBindError(e?.message || t('auth.invalidOtp'))
                } finally {
                  setBindLoading(false)
                }
              }}
              disabled={bindLoading || !bindOtpSent || bindOtp.length !== 6}
            >
              {bindLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {desktop && <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile.auth.changePassword')}</DialogTitle>
            <DialogDescription>{t('profile.auth.changePasswordDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('profile.auth.currentPassword')}</Label>
              <Input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                placeholder={t('profile.auth.currentPasswordPlaceholder')}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('profile.auth.newPassword')}</Label>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder={t('profile.auth.newPasswordPlaceholder')}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('profile.auth.confirmPassword')}</Label>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                placeholder={t('profile.auth.confirmPasswordPlaceholder')}
                autoComplete="new-password"
              />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  )
}

function SettingsTab() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { autoPlay, setAutoPlay, wifiOnlyMedia, setWifiOnlyMedia, language, setLanguage } = usePreferencesStore()
  const { config } = useConfigStore()
  const [showBinding, setShowBinding] = useState(false)
  const [autoSpeakOnLookup, setAutoSpeakOnLookup] = useState(true)
  const [pronunciationType, setPronunciationType] = useState<'us' | 'uk'>('us')
  const [autoCopyWord, setAutoCopyWord] = useState(false)
  const [dailyGoal, setDailyGoal] = useState('20')
  const [learningPreference, setLearningPreference] = useState('balanced')
  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <div className="space-y-6">
      {/* 学习偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.autoSpeak')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.autoPlay')}</Label>
              <p className="text-xs text-muted-foreground">{t('profile.autoPlay')}</p>
            </div>
            <Switch checked={autoPlay} onCheckedChange={setAutoPlay} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.autoSpeak')}</Label>
              <p className="text-xs text-muted-foreground">{t('profile.autoSpeak')}</p>
            </div>
            <Switch checked={autoSpeakOnLookup} onCheckedChange={setAutoSpeakOnLookup} />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t('profile.pronunciationType')}</Label>
            <Select
              value={pronunciationType}
              onChange={(e) => setPronunciationType(e.target.value as 'us' | 'uk')}
              className="w-48"
            >
              <SelectItem value="us">{t('profile.pronunciationUs')}</SelectItem>
              <SelectItem value="uk">{t('profile.pronunciationUk')}</SelectItem>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.autoCopyWord')}</Label>
              <p className="text-xs text-muted-foreground">{t('profile.autoCopyWord')}</p>
            </div>
            <Switch checked={autoCopyWord} onCheckedChange={setAutoCopyWord} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.wifiOnlyMedia')}</Label>
              <p className="text-xs text-muted-foreground">{t('profile.wifiOnlyMedia')}</p>
            </div>
            <Switch checked={wifiOnlyMedia} onCheckedChange={setWifiOnlyMedia} />
          </div>
        </CardContent>
      </Card>

      {/* 学习目标 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.dailyGoal')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{t('profile.dailyGoal')}</Label>
            <Select
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value)}
              className="w-48"
            >
              <SelectItem value="10">{t('profile.dailyGoal10')}</SelectItem>
              <SelectItem value="20">{t('profile.dailyGoal20')}</SelectItem>
              <SelectItem value="30">{t('profile.dailyGoal30')}</SelectItem>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t('profile.learningPreference')}</Label>
            <Select
              value={learningPreference}
              onChange={(e) => setLearningPreference(e.target.value)}
              className="w-48"
            >
              <SelectItem value="balanced">{t('profile.balanceMode')}</SelectItem>
              <SelectItem value="exam">{t('profile.examMode')}</SelectItem>
              <SelectItem value="speaking">{t('profile.speakingMode')}</SelectItem>
            </Select>
          </div>

        </CardContent>
      </Card>

      {/* 外观与语言 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.theme')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{t('profile.theme')}</Label>
            <Select
              value={theme || 'system'}
              onChange={(e) => setTheme(e.target.value)}
              className="w-48"
            >
              <SelectItem value="light">{t('profile.themeLight')}</SelectItem>
              <SelectItem value="dark">{t('profile.themeDark')}</SelectItem>
              <SelectItem value="system">{t('profile.themeSystem')}</SelectItem>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t('profile.language')}</Label>
            <Select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-48"
            >
              <SelectItem value="zh-CN">{t('profile.langZh')}</SelectItem>
              <SelectItem value="en">{t('profile.langEn')}</SelectItem>
              <SelectItem value="ja">{t('profile.langJa')}</SelectItem>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 数据管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.dataManagement')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('profile.clearCache')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.clearCacheDesc')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => {}}>
              {t('common.confirm')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 法律与隐私 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.legalPrivacy')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: t('footer.termsOfService'), to: '/system/terms' },
            { label: t('footer.privacy'), to: '/system/privacy' },
            { label: t('footer.privacyChildren'), to: '/system/privacy-children' },
            { label: t('footer.collectInfo'), to: '/system/collect-info' },
            { label: t('footer.permissionsApply'), to: '/system/permissions' },
            { label: t('footer.sdkList'), to: '/system/sdk-list' },
            { label: t('footer.privacyConcise'), to: '/system/privacy-concise' },
            { label: t('footer.icp'), to: '/system/icp' },
            { label: t('footer.contactUs'), to: '/system/contact' },
          ].map((item, idx, arr) => (
            <div key={item.to}>
              <Link
                to={item.to}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
                <ChevronRight className="h-4 w-4" />
              </Link>
              {idx < arr.length - 1 && <Separator className="my-1" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 账户安全 — 修改密码 / 退出 / 注销 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.security')}</CardTitle>
        </CardHeader>
        <CardContent>
          <AuthSettingsPanel compact={false} />
        </CardContent>
      </Card>
    </div>
  )
}

function AuthSettingsPanel({ compact: _compact }: { compact: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, refreshSession, signOut } = useAuth()
  const sessionUser = session?.user ?? null

  // ── 个人信息 Dialog ──
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (!profileDialogOpen || !sessionUser) return
    getUserProfile().then((p) => {
      setName(p.name || '')
      setUsername(p.username || '')
    }).catch(() => {})
  }, [profileDialogOpen, sessionUser])

  const handleSaveProfile = async () => {
    setProfileLoading(true)
    try {
      await updateUserProfile({ name, username })
      await refreshSession()
      setProfileDialogOpen(false)
    } catch {
      // ignore
    } finally {
      setProfileLoading(false)
    }
  }

  // ── 修改密码 Dialog ──
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (passwordDialogOpen) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
    }
  }, [passwordDialogOpen])

  const handleChangePassword = async () => {
    if (!currentPassword) { setPasswordError(t('profile.auth.passwordRequired')); return }
    if (newPassword.length < 8) { setPasswordError(t('profile.auth.newPasswordPlaceholder')); return }
    if (newPassword !== confirmPassword) { setPasswordError(t('auth.passwordMismatch')); return }

    setPasswordLoading(true)
    setPasswordError('')
    try {
      const { changePassword } = await import('@/features/auth/api')
      await changePassword(currentPassword, newPassword)
      setPasswordDialogOpen(false)
    } catch (error: any) {
      setPasswordError(error?.response?.data?.message || error?.message || t('profile.auth.deleteFailed'))
    } finally {
      setPasswordLoading(false)
    }
  }

  // ── 删除账户 Dialog ──
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // ── 反馈 Dialog ──
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)

  useEffect(() => {
    if (deleteDialogOpen) {
      setDeletePassword('')
      setDeleteError('')
    }
  }, [deleteDialogOpen])

  const handleDeleteAccount = async () => {
    if (!deletePassword) { setDeleteError(t('profile.auth.passwordRequired')); return }
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const { deleteAccount } = await import('@/features/auth/api')
      await deleteAccount(deletePassword)
      localStorage.clear()
      window.location.hash = '#/portal'
      window.location.reload()
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || error?.message || t('profile.auth.deleteFailed'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const currentName = name || sessionUser?.name || t('profile.auth.notSet')

  // ── 列表行组件 ──
  const Row = ({ label, value, subtitle, danger, onClick, last }: {
    label: string
    value?: string
    subtitle?: string
    danger?: boolean
    onClick?: () => void
    last?: boolean
  }) => (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        !last && 'border-b border-border/40',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
    >
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', danger ? 'font-medium text-destructive' : 'font-medium')}>{label}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 ml-3">
        {value && <span className="text-sm text-muted-foreground truncate max-w-[160px]">{value}</span>}
        {onClick && <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />}
      </div>
    </div>
  )

  if (!sessionUser) {
    return (
      <div className="space-y-3 px-4 py-3">
        <p className="text-xs text-muted-foreground">{t('profile.auth.loginPrompt')}</p>
        <Button size="sm" onClick={() => navigate('/auth/login')}>{t('profile.auth.goLogin')}</Button>
      </div>
    )
  }

  return (
    <div>
      <div className="-mx-4 -my-4 divide-y-0">
        <Row
          label={t('profile.auth.personalInfo')}
          value={currentName}
          subtitle={`${sessionUser.email}${sessionUser.emailVerified ? t('profile.auth.emailVerified') : ''}`}
          onClick={() => setProfileDialogOpen(true)}
        />
        <Row
          label={t('profile.auth.changePassword')}
          subtitle={t('profile.auth.passwordSecurity')}
          onClick={() => setPasswordDialogOpen(true)}
        />
        <Row
          label={t('profile.logout')}
          subtitle={t('profile.auth.logoutDesc')}
          onClick={() => signOut().then(() => navigate('/auth/login'))}
        />
        <Row
          label={t('profile.auth.helpFeedback')}
          subtitle={t('profile.auth.helpFeedbackDesc')}
          onClick={() => setFeedbackDialogOpen(true)}
        />
        <Row
          label={t('profile.deleteAccount')}
          subtitle={t('profile.auth.deleteAccountDesc')}
          danger
          onClick={() => setDeleteDialogOpen(true)}
          last
        />
      </div>

      {/* ── 个人信息 Dialog ── */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile.auth.editProfile')}</DialogTitle>
            <DialogDescription>{t('profile.auth.saveHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">{t('profile.auth.nameField')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profile.auth.namePlaceholder')} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t('profile.auth.usernameField')}</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('profile.auth.usernamePlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveProfile} disabled={profileLoading}>
              {profileLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 修改密码 Dialog ── */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile.auth.changePassword')}</DialogTitle>
            <DialogDescription>{t('profile.auth.changePasswordDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">{t('profile.auth.currentPassword')}</Label>
              <Input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                placeholder={t('profile.auth.currentPasswordPlaceholder')}
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t('profile.auth.newPassword')}</Label>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder={t('profile.auth.newPasswordPlaceholder')}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t('profile.auth.confirmPassword')}</Label>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                placeholder={t('profile.auth.confirmPasswordPlaceholder')}
                autoComplete="new-password"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 注销账户 Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t('profile.deleteAccount')}</DialogTitle>
            <DialogDescription>
              {t('profile.auth.deleteAccountWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={deletePassword}
              onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
              type="password"
              placeholder={t('profile.auth.currentPasswordPlaceholder')}
              autoComplete="current-password"
            />
            {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 反馈 Dialog (PC) / Drawer (移动端) ── */}
      <FeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} />
    </div>
  )
}
