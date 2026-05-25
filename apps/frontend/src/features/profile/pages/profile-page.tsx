import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { ActivityCalendar } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, ClipboardList, Star, BookMarked, Settings, User, Trash2,
  Search, X, Volume2, Loader2, ChevronLeft, ChevronRight, Calendar, SortAsc,
  Sparkles, BookOpen, Link2, ExternalLink, Brain, BarChart2, CheckSquare,
  GraduationCap, CheckCircle2, Lightbulb, Crown, Sun, Moon, Monitor,
  Globe, Database, Zap, TrendingUp, Target, Flame, Camera,
  IdCard, PencilLine, LogOut, ShieldAlert, Phone, Mail,
  MessageSquare,
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
import { BindingDialog } from '@/features/question-bank/components/binding-dialog'
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
import { getFavorites, type FavoriteItem } from '@/features/assets/api'
import { useAuth } from '@/providers/auth-provider'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useWordsStore, type WordEntry } from '@/stores/assets.store'
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
import {
  listLinkedAccounts, linkSocialAccount, unlinkAccount,
  type LinkedAccount,
} from '@/features/account/api'
import { useIsMobile } from '@/hooks/use-mobile'

type Tab = 'overview' | 'records' | 'favorites' | 'words' | 'account' | 'settings'
type MobileView = Tab | 'home'

const tabs: { key: Tab; icon: React.ElementType }[] = [
  { key: 'overview', icon: LayoutDashboard },
  { key: 'records', icon: ClipboardList },
  { key: 'favorites', icon: Star },
  { key: 'words', icon: BookMarked },
  { key: 'account', icon: IdCard },
  { key: 'settings', icon: Settings },
]

const mobileTitles: Record<Tab, string> = {
  overview: '概览',
  records: '练习记录',
  favorites: '收藏题库',
  words: '生词本',
  account: '账户管理',
  settings: '偏好设置',
}

export function ProfilePage() {
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
  }, [mobileView, setBottomNavVisible])

  const nickname = userProfile?.name || userProfile?.username || '导游说者'

  return (
    <div>
      {isMobile ? (
        <div>
          {mobileView === 'home' ? (
            <MobileProfileHome onNavigate={setMobileView} />
          ) : (
            <div className="space-y-4">
              {/* iOS 风格返回栏 */}
              <div className="relative flex items-center justify-center">
                <button
                  type="button"
                  aria-label="返回"
                  onClick={() => setMobileView('home')}
                  className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="text-base font-semibold">
                  {mobileTitles[mobileView as Tab]}
                </h1>
              </div>
              {mobileView === 'overview' && <OverviewTab />}
              {mobileView === 'records' && <RecordsTab />}
              {mobileView === 'favorites' && <FavoritesTab />}
              {mobileView === 'words' && <WordsTab />}
              {mobileView === 'account' && <AccountTab />}
              {mobileView === 'settings' && <MobileSettingsView />}
            </div>
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
                  <Badge variant="secondary" className="text-xs">免费用户</Badge>
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
            {activeTab === 'favorites' && <FavoritesTab />}
            {activeTab === 'words' && <WordsTab />}
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      )}
    </div>
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
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
        {children}
      </div>
    </div>
  )
}

// ─── 手机端：个人中心首页 ──────────────────────────────────────────────────
function MobileProfileHome({ onNavigate }: { onNavigate: (view: MobileView) => void }) {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage } = usePreferencesStore()
  const navigate = useNavigate()
  const [overview, setOverview] = useState<ProfileOverview | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showThemeDialog, setShowThemeDialog] = useState(false)
  const [showLanguageDialog, setShowLanguageDialog] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([
      getProfileOverview(),
      getUserProfile(),
      getCurrentAvatar(),
    ]).then(([ovRes, upRes, avRes]) => {
      if (ovRes.status === 'fulfilled') setOverview(ovRes.value)
      if (upRes.status === 'fulfilled') setUserProfile(upRes.value)
      if (avRes.status === 'fulfilled') setAvatarUrl(avRes.value?.url ?? null)
    }).finally(() => setIsLoading(false))
  }, [])

  const navItems = [
    { key: 'overview' as Tab, icon: LayoutDashboard, label: '概览', iconBg: 'bg-blue-500' },
    { key: 'records' as Tab, icon: ClipboardList, label: '练习记录', iconBg: 'bg-emerald-500' },
    { key: 'favorites' as Tab, icon: Star, label: '收藏题库', iconBg: 'bg-orange-400' },
    { key: 'words' as Tab, icon: BookMarked, label: '生词本', iconBg: 'bg-purple-500' },
    { key: 'account' as Tab, icon: IdCard, label: '账户管理', iconBg: 'bg-sky-400' },
  ]
  const themeLabel: Record<string, string> = { light: '浅色', dark: '深色', system: '跟随系统' }
  const langLabel: Record<string, string> = { 'zh-CN': '中文', en: 'English' }

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const nickname = userProfile?.name || userProfile?.username || '导游说者'

  const onTapAvatar = () => {
    navigate('/account')
  }

  return (
    <div className="space-y-4">
      {/* 用户信息区 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 头像 */}
          <div className="relative">
            <button
              type="button"
              onClick={onTapAvatar}
              className="group relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/15"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="h-9 w-9 text-primary" />
              )}
              <span className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 bg-black/50 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-3 w-3" />
                更换
              </span>
            </button>
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">{nickname}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-muted-foreground/25 px-2 py-0.5 text-[11px] text-muted-foreground">
                免费用户
              </span>
              <Link
                to="/member"
                className="no-underline inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm"
              >
                <Crown className="h-2.5 w-2.5" />升级 VIP
              </Link>
            </div>
          </div>
        </div>
        {/* 设置入口 */}
        <button
          onClick={() => onNavigate('settings')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors active:bg-muted"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* 统计双卡 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />练习天数
          </div>
          {isLoading ? (
            <Skeleton className="mt-2 h-9 w-14 rounded-lg" />
          ) : (
            <p className="mt-1.5 text-3xl font-bold tracking-tight">{overview?.totalPracticeDays ?? 0}</p>
          )}
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Flame className="h-3 w-3 text-orange-400" />
            连续打卡 {isLoading ? '--' : overview?.streakDays ?? 0} 天
          </p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />累计做题
          </div>
          {isLoading ? (
            <Skeleton className="mt-2 h-9 w-14 rounded-lg" />
          ) : (
            <p className="mt-1.5 text-3xl font-bold tracking-tight">{overview?.totalQuestionsAnswered ?? 0}</p>
          )}
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Target className="h-3 w-3 text-blue-400" />
            日均 {isLoading ? '--' : overview?.avgDailyQuestions ?? 0} 道
          </p>
        </div>
      </div>

      {/* 主导航 */}
      <IosSection>
        {navItems.map(({ key, icon, label, iconBg }, idx) => (
          <IosRow
            key={key}
            icon={icon}
            iconBg={iconBg}
            label={label}
            last={idx === navItems.length - 1}
            onTap={() => {
              if (key === 'account') {
                navigate('/account')
              } else {
                onNavigate(key)
              }
            }}
          />
        ))}
      </IosSection>

      {/* 外观与语言（保留在“我的”首页，点击弹窗切换） */}
      <IosSection>
        <IosRow
          label="主题"
          value={themeLabel[theme || 'system'] ?? '跟随系统'}
          onTap={() => setShowThemeDialog(true)}
        />
        <IosRow
          label="界面语言"
          value={langLabel[language] ?? '中文'}
          last
          onTap={() => setShowLanguageDialog(true)}
        />
      </IosSection>

      <Drawer open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DrawerContent className="rounded-t-3xl">
          <DrawerHeader>
            <DrawerTitle className="text-base">选择主题</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {[
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
              { value: 'system', label: '跟随系统' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setTheme(item.value)
                  setShowThemeDialog(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between border-b px-1 py-3 text-left text-sm',
                  (theme || 'system') === item.value && 'font-medium'
                )}
              >
                <span>{item.label}</span>
                {(theme || 'system') === item.value && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
        <DrawerContent className="rounded-t-3xl">
          <DrawerHeader>
            <DrawerTitle className="text-base">选择界面语言</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {[
              { value: 'zh-CN', label: '中文' },
              { value: 'en', label: 'English' },
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

    </div>
  )
}

// ─── 手机端：设置页 ────────────────────────────────────────────────────────
function MobileSettingsView() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { autoPlay, setAutoPlay } = usePreferencesStore()
  const { config } = useConfigStore()
  const [showBinding, setShowBinding] = useState(false)
  const [autoSpeakOnLookup, setAutoSpeakOnLookup] = useState(true)
  const [pronunciationType, setPronunciationType] = useState<'us' | 'uk'>('us')
  const [autoCopyWord, setAutoCopyWord] = useState(false)
  const [wifiOnlyMedia, setWifiOnlyMedia] = useState(true)
  const [dailyGoal, setDailyGoal] = useState('20')
  const [learningPreference, setLearningPreference] = useState('balanced')
  const [personalizedRecommendation, setPersonalizedRecommendation] = useState(true)

  // 删除账户状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // 处理账户删除
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('请输入密码以确认删除')
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
      setDeleteError(error?.response?.data?.message || error?.message || '删除失败，请稍后重试')
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
        default: mod = { default: '# 暂无内容' }
      }
      const content = mod.default
      setMdContents((prev) => ({ ...prev, [key]: content }))
      setLegalDrawer({ title, content })
    } catch {
      setLegalDrawer({ title, content: '# 加载失败，请稍后重试' })
    }
  }

  const legalDocList = [
    { key: 'terms', label: '服务条款' },
    { key: 'privacy', label: '隐私政策' },
    { key: 'privacy-children', label: '儿童信息保护' },
    { key: 'collect-info', label: '个人信息收集清单' },
    { key: 'permissions', label: '权限申请说明' },
    { key: 'sdk-list', label: '第三方SDK目录' },
    { key: 'contact', label: '联系我们' },
  ]

  return (
    <div className="space-y-5">
      <BindingDialog open={showBinding} onClose={() => setShowBinding(false)} />

      <IosSection>
        <IosRow
          label="查词自动发音"
          right={<Switch checked={autoPlay} onCheckedChange={setAutoPlay} />}
        />
        <IosRow
          label="查词发音类型"
          right={
            <select
              value={pronunciationType}
              onChange={(e) => setPronunciationType(e.target.value as 'us' | 'uk')}
              className="bg-transparent text-sm text-muted-foreground outline-none"
            >
              <option value="us">美式发音</option>
              <option value="uk">英式发音</option>
            </select>
          }
        />
        <IosRow
          label="查词自动复制单词到剪切板"
          right={<Switch checked={autoCopyWord} onCheckedChange={setAutoCopyWord} />}
        />
        <IosRow
          label="仅使用 WIFI 播放&下载"
          last
          right={<Switch checked={wifiOnlyMedia} onCheckedChange={setWifiOnlyMedia} />}
        />
      </IosSection>

      <IosSection>
        <IosRow
          label="设置打卡目标"
          right={
            <select
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value)}
              className="bg-transparent text-sm text-muted-foreground outline-none"
            >
              <option value="10">每天 10 题</option>
              <option value="20">每天 20 题</option>
              <option value="30">每天 30 题</option>
            </select>
          }
        />
        <IosRow
          label="设置学习偏好"
          last
          right={
            <select
              value={learningPreference}
              onChange={(e) => setLearningPreference(e.target.value)}
              className="bg-transparent text-sm text-muted-foreground outline-none"
            >
              <option value="balanced">均衡模式</option>
              <option value="exam">考试冲刺</option>
              <option value="speaking">口语优先</option>
            </select>
          }
        />
      </IosSection>

      <IosSection>
        <IosRow
          label="个性化推荐"
          right={<Switch checked={personalizedRecommendation} onCheckedChange={setPersonalizedRecommendation} />}
        />
      </IosSection>

      {/* 法律与隐私 — 移动端使用 Drawer 全屏查看 */}
      <IosSection header="法律与隐私">
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
          label="清除播放缓存"
          onTap={() => {}}
        />
        <IosRow
          label="应用权限管理"
          onTap={() => {}}
        />
        <IosRow
          label="切换当前题库"
          subtitle={config?.bankName || '未配置题库'}
          onTap={() => setShowBinding(true)}
        />
        <IosRow
          label="注销账户"
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
            退出登录
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
            <DialogTitle className="text-destructive">注销账户</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              此操作不可撤销。所有学习记录、收藏、生词本、模考成绩等数据将被永久删除。请输入密码以确认。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={deletePassword}
              onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
              type="password"
              placeholder="输入当前密码"
              autoComplete="current-password"
            />
            {deleteError && (
              <p className="text-sm text-red-500">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleteLoading}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              确认删除
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
    { label: '练习天数', value: overview?.totalPracticeDays ?? 0, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: '累计做题', value: overview?.totalQuestionsAnswered ?? 0, icon: CheckSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: '收藏题目', value: overview?.totalFavorites ?? 0, icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: '生词本', value: overview?.totalWords ?? 0, icon: BookMarked, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: '连续打卡', value: `${overview?.streakDays ?? 0}天`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: '日均做题', value: overview?.avgDailyQuestions ?? 0, icon: TrendingUp, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
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
                <p className="text-xs text-muted-foreground">当前正在使用的备考题库</p>
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
            totalCount: '{{year}} 年共 {{count}} 次练习',
            legend: { less: '少', more: '多' },
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
      cell: (v) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[300px]">{v}</span>
      ),
    },
    {
      key: 'practiceCount',
      header: t('profile.columns.count'),
      cell: (v) => <Badge variant="secondary" className="text-xs">{v} 次</Badge>,
      width: 80,
    },
    {
      key: 'lastPracticeAt',
      header: t('profile.columns.date'),
      cell: (v) => (
        <span className="text-xs text-muted-foreground">
          {new Date(v).toLocaleDateString('zh-CN')}
        </span>
      ),
      width: 100,
    },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{t('profile.records')}</h2>
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

function FavoritesTab() {
  const { t } = useTranslation()
  const [data, setData] = useState<FavoriteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getFavorites()
      .then((res) => setData(res?.list ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
    )
  }

  if ((data ?? []).length === 0) {
    return (
      <div className="rounded-2xl bg-muted/40 py-20 text-center text-muted-foreground">
        <Star className="mx-auto mb-3 h-10 w-10 opacity-30" />
        {t('profile.noFavorites')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">{t('profile.favorites')}</h2>
      {data.map((item, idx) => (
        <Card key={`${item.questionId}-${idx}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline" className="mb-1 text-xs">{item.topicName}</Badge>
                <p className="text-sm">{item.questionText}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  收藏于 {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 生词本 Tab — 完整实现
// ═══════════════════════════════════════════════════════════════

type GroupMode = 'date' | 'alpha'

function getDateLabel(iso: string): string {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function groupEntries(entries: WordEntry[], mode: GroupMode) {
  if (mode === 'alpha') {
    const map = new Map<string, WordEntry[]>()
    for (const e of [...entries].sort((a, b) => a.word.localeCompare(b.word))) {
      const letter = e.word[0]?.toUpperCase() ?? '#'
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter)!.push(e)
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  }
  const map = new Map<string, WordEntry[]>()
  for (const e of [...entries].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  )) {
    const label = getDateLabel(e.addedAt)
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
                    <span className="text-muted-foreground">近义：</span>
                    {def.synonyms.slice(0, 5).map((s) => (
                      <span key={s} className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{s}</span>
                    ))}
                  </div>
                )}
                {def.antonyms.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">反义：</span>
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

const LEVEL_CONFIG = {
  basic: { label: '基础', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  intermediate: { label: '进阶', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  advanced: { label: '高级', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
}

function ExampleCard({ ex, idx }: { ex: WordExampleItem; idx: number }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cachedUrlRef = useRef<string | null>(null)
  const { ttsBackend, setTtsBackend } = usePreferencesStore()
  const cfg = LEVEL_CONFIG[ex.level]
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
          <span className="text-xs font-medium text-muted-foreground">例句 {idx + 1}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.color)}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTtsProvider}
            className="rounded-full border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            title="切换发音引擎"
          >
            {isMiniMax ? 'MiniMax' : 'Cartesia'}
          </button>
          <button type="button" onClick={handleSpeak}
            disabled={state === 'loading'}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 transition-colors disabled:opacity-60">
            {state === 'loading'
              ? <><Loader2 className="h-3 w-3 animate-spin" />合成中</>
              : state === 'playing'
              ? <><Volume2 className="h-3 w-3" />朗读中</>
              : state === 'error'
              ? <><Volume2 className="h-3 w-3 text-destructive" />重试</>
              : <><Volume2 className="h-3 w-3" />朗读</>}
          </button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm font-medium leading-relaxed">{ex.en}</p>
        <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">{ex.zh}</p>
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
  entry: WordEntry | null
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
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
        .catch((e) => { setEnrichData(null); setEnrichError(e?.message ?? '加载失败') })
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
                        <Volume2 className="h-3 w-3" />{i === 0 ? 'UK' : i === 1 ? 'US' : '发音'}
                      </button>
                    )}
                  </div>
                )) : phonetic ? (
                  <span className="font-mono text-sm text-muted-foreground">{phonetic}</span>
                ) : null}
                {audioUrl && !phonetics.some(p => p.audio) && (
                  <button type="button" onClick={() => playAudio(audioUrl)}
                    className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 transition-colors">
                    <Volume2 className="h-3.5 w-3.5" />发音
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
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {mainEntry?.origin && (
            <div className="mt-3 flex items-start gap-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium">词源：</span>{mainEntry.origin}
              </p>
            </div>
          )}
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-1 border-b border-border/50 px-6 bg-muted/20">
          {([
            { key: 'meanings', icon: BookOpen, label: '释义', count: allMeanings.length },
            { key: 'examples', icon: GraduationCap, label: 'AI 例句', count: enriched?.examples.length ?? 0 },
            { key: 'synonyms', icon: BarChart2, label: '近反义词', count: allSynonyms.length + allAntonyms.length },
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
                  <p className="text-sm">未找到词典数据</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {allMeanings.map((meaning, mi) => (
                    <MeaningSection key={mi} meaning={meaning} chineseGloss={posGlossMap.get(meaning.partOfSpeech)} />
                  ))}
                  {mainEntry.sourceUrls?.map(url => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3 w-3" />查看完整词条
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
                  <p className="text-sm">AI 例句需要配置 DEEPSEEK_API_KEY</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    AI 生成 · 覆盖基础、进阶、高级三个难度 · 点击朗读可播放
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
                  <div className="py-10 text-center text-muted-foreground text-sm">暂无近反义词数据</div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 px-6 py-3 bg-muted/10">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />上一个
          </Button>
          <span className="text-xs text-muted-foreground">
            {new Date(entry.addedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}添加 · ←→ 切换
          </span>
          <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext} className="gap-1.5">
            下一个<ChevronRight className="h-4 w-4" />
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
  entry: WordEntry
  isSelected: boolean
  onClick: () => void
  multiSelect: boolean
  checked: boolean
  onToggleSelect: () => void
}) {
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
          <p className="text-xs text-muted-foreground/40 italic">暂无定义</p>
        )}
      </CardContent>
    </Card>
  )
}

function WordsTab() {
  const { t } = useTranslation()
  const { entries, removeWord } = useWordsStore()
  const [search, setSearch] = useState('')
  const [groupMode, setGroupMode] = useState<GroupMode>('date')
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedWords, setSelectedWords] = useState<string[]>([])

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter((e) => e.word.toLowerCase().includes(q))
  }, [entries, search])

  const flatList = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()),
    [filtered]
  )

  const groups = useMemo(() => groupEntries(filtered, groupMode), [filtered, groupMode])

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

  const deleteSelectedWords = () => {
    selectedWords.forEach((word) => removeWord(word))
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
          <p className="mt-1 text-xs opacity-70">在练习页面点击单词旁的 ＋ 按钮添加</p>
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
            placeholder="搜索…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* 分组 + 多选（过滤层） */}
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex rounded-lg bg-muted p-0.5">
            {([
              { mode: 'date', icon: Calendar, label: '按日期' },
              { mode: 'alpha', icon: SortAsc, label: '字母序' },
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
              title={multiSelectMode ? '取消多选' : '多选'}
              aria-label={multiSelectMode ? '取消多选' : '开启多选'}
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
                删除({selectedWords.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 分组卡片 */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <Search className="mx-auto mb-2 h-7 w-7 opacity-30" />
          没有找到匹配的单词
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
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await updateUserProfile({ name: name.trim() })
      onSaved(name.trim())
      onOpenChange(false)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('profile.editNicknameTitle')}</DialogTitle>
          <DialogDescription>修改后将会在所有页面展示新的昵称</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入昵称"
            maxLength={20}
            autoFocus
          />
          <p className="text-right text-xs text-muted-foreground">{name.length}/20</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── PC 端：账户管理页 ────────────────────────────────────────────────────
function AccountTab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, signOut } = useAuth()
  const sessionUser = session?.user ?? null
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [p, avatar, accounts] = await Promise.all([
        getUserProfile(),
        getCurrentAvatar(),
        listLinkedAccounts().catch(() => [] as LinkedAccount[]),
      ])
      setProfile(p)
      setAvatarUrl(avatar?.url ?? null)
      setLinkedAccounts(accounts)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const handleFocus = () => {
      listLinkedAccounts().then(setLinkedAccounts).catch(() => {})
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const onPickAvatar = () => avatarInputRef.current?.click()

  const onAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.currentTarget.value = ''
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    setAvatarUploading(true)
    try {
      const asset = await uploadFileToCosAndComplete({ file, group: 'avatar' })
      const current = await setCurrentAvatar(asset.id)
      setAvatarUrl(current.url)
    } catch {
      // ignore
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

  const handleUnlink = async (accountId: string) => {
    if (unlinkingId) return
    setUnlinkingId(accountId)
    try {
      await unlinkAccount(accountId)
      setLinkedAccounts((prev) => prev.filter((a) => a.id !== accountId))
    } catch {
      // ignore
    } finally {
      setUnlinkingId(null)
    }
  }

  const handleNicknameSaved = (name: string) => {
    setProfile((prev) => prev ? { ...prev, name } : prev)
  }

  const wechatBound = linkedAccounts.some((a) => a.provider === 'wechat')
  const appleBound = linkedAccounts.some((a) => a.provider === 'apple')
  const wechatAccount = linkedAccounts.find((a) => a.provider === 'wechat')
  const appleAccount = linkedAccounts.find((a) => a.provider === 'apple')

  const nickname = profile?.name || sessionUser?.name || t('profile.notBound')
  const phoneNumber = profile?.phoneNumber || sessionUser?.phoneNumber || null
  const email = profile?.email || sessionUser?.email || null

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <NicknameEditDialog
        open={nicknameDialogOpen}
        onOpenChange={setNicknameDialogOpen}
        currentName={nickname}
        onSaved={handleNicknameSaved}
      />

      {/* 头像 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.avatar')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarFileChange}
            />
            <button
              type="button"
              disabled={avatarUploading}
              onClick={onPickAvatar}
              className="group relative flex-shrink-0"
            >
              <Avatar className="h-20 w-20 ring-2 ring-border ring-offset-2 ring-offset-background transition-shadow group-hover:ring-primary/50">
                <AvatarImage src={avatarUrl || undefined} alt="avatar" />
                <AvatarFallback className="bg-primary/10">
                  <User className="h-10 w-10 text-primary" />
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {avatarUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </span>
            </button>
            <div>
              <p className="text-sm font-medium">{t('profile.changeAvatar')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('profile.avatarHint')}</p>
              {avatarUploading && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  上传中...
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <PencilLine className="h-4 w-4 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('profile.nickname')}</p>
                <p className="text-xs text-muted-foreground truncate">{nickname}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              onClick={() => setNicknameDialogOpen(true)}
            >
              {t('profile.editNickname')}
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                <Phone className="h-4 w-4 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('profile.phone')}</p>
                <p className="text-xs text-muted-foreground">{phoneNumber || t('profile.notBound')}</p>
              </div>
            </div>
            {phoneNumber && (
              <Badge variant={profile?.phoneNumberVerified ? 'outline' : 'secondary'} className="flex-shrink-0 text-xs">
                {profile?.phoneNumberVerified ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {t('profile.verified')}
                  </span>
                ) : (
                  t('profile.unverified')
                )}
              </Badge>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Mail className="h-4 w-4 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('profile.email')}</p>
                <p className="text-xs text-muted-foreground truncate">{email || t('profile.notBound')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 账号绑定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.accountBinding')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 微信 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#07C160]/15">
                <span className="text-sm font-bold text-[#07C160]">微</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('profile.wechat')}</p>
                <p className="text-xs text-muted-foreground">
                  {wechatBound ? `已绑定${wechatAccount?.name ? `：${wechatAccount.name}` : ''}` : t('profile.wechatBind')}
                </p>
              </div>
            </div>
            {wechatBound ? (
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 text-destructive hover:text-destructive"
                disabled={unlinkingId === wechatAccount?.id}
                onClick={() => wechatAccount && handleUnlink(wechatAccount.id)}
              >
                {unlinkingId === wechatAccount?.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  t('profile.unbind')
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 border-[#07C160]/30 text-[#07C160] hover:bg-[#07C160]/10"
                disabled={linkingProvider === 'wechat'}
                onClick={() => handleLinkSocial('wechat')}
              >
                {linkingProvider === 'wechat' ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <ExternalLink className="mr-1.5 h-3 w-3" />
                )}
                {t('profile.bind')}
              </Button>
            )}
          </div>

          <Separator />

          {/* Apple */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                <span className="text-sm font-bold text-foreground">A</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('profile.appleId')}</p>
                <p className="text-xs text-muted-foreground">
                  {appleBound ? `已绑定${appleAccount?.name ? `：${appleAccount.name}` : ''}` : t('profile.appleIdBind')}
                </p>
              </div>
            </div>
            {appleBound ? (
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 text-destructive hover:text-destructive"
                disabled={unlinkingId === appleAccount?.id}
                onClick={() => appleAccount && handleUnlink(appleAccount.id)}
              >
                {unlinkingId === appleAccount?.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  t('profile.unbind')
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                disabled={linkingProvider === 'apple'}
                onClick={() => handleLinkSocial('apple')}
              >
                {linkingProvider === 'apple' ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <ExternalLink className="mr-1.5 h-3 w-3" />
                )}
                {t('profile.bind')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 账号安全 */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <ShieldAlert className="h-4 w-4" />
            {t('profile.dangerZone')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('profile.logout')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.logoutWarning')}</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                signOut()
                navigate('/')
              }}
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              {t('profile.logout')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsTab() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { autoPlay, setAutoPlay, language, setLanguage } = usePreferencesStore()
  const { config } = useConfigStore()
  const [showBinding, setShowBinding] = useState(false)
  const [autoSpeakOnLookup, setAutoSpeakOnLookup] = useState(true)
  const [pronunciationType, setPronunciationType] = useState<'us' | 'uk'>('us')
  const [autoCopyWord, setAutoCopyWord] = useState(false)
  const [wifiOnlyMedia, setWifiOnlyMedia] = useState(true)
  const [dailyGoal, setDailyGoal] = useState('20')
  const [learningPreference, setLearningPreference] = useState('balanced')
  const [personalizedRecommendation, setPersonalizedRecommendation] = useState(true)

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <div className="space-y-6">
      <BindingDialog open={showBinding} onClose={() => setShowBinding(false)} />

      {/* 学习偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.autoSpeak')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.autoPlay')}</Label>
              <p className="text-xs text-muted-foreground">进入练习页自动播放题目音频</p>
            </div>
            <Switch checked={autoPlay} onCheckedChange={setAutoPlay} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.autoSpeak')}</Label>
              <p className="text-xs text-muted-foreground">查词时自动朗读单词发音</p>
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
              <p className="text-xs text-muted-foreground">查词后自动将单词复制到剪切板</p>
            </div>
            <Switch checked={autoCopyWord} onCheckedChange={setAutoCopyWord} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.wifiOnlyMedia')}</Label>
              <p className="text-xs text-muted-foreground">仅在 WiFi 环境下播放和下载音频</p>
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

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('profile.personalizedRecommendation')}</Label>
              <p className="text-xs text-muted-foreground">根据学习数据智能推荐练习内容</p>
            </div>
            <Switch checked={personalizedRecommendation} onCheckedChange={setPersonalizedRecommendation} />
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
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 题库设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.currentBank')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {config?.bankName || '未配置题库'}
              </p>
              {config && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">{config.province}</Badge>
                  <Badge variant="secondary" className="text-xs">{config.language}</Badge>
                  <Badge variant="secondary" className="text-xs">{config.examType}</Badge>
                  <Badge variant="secondary" className="text-xs">{config.interviewForm}</Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowBinding(true)}>
              {t('profile.adjustBinding')}
            </Button>
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
              <p className="text-xs text-muted-foreground">清理本地存储的音频缓存文件</p>
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
          <CardTitle className="text-base">法律与隐私</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: '服务条款', to: '/system/terms' },
            { label: '隐私政策', to: '/system/privacy' },
            { label: '儿童信息保护', to: '/system/privacy-children' },
            { label: '个人信息收集清单', to: '/system/collect-info' },
            { label: '权限申请说明', to: '/system/permissions' },
            { label: '第三方SDK目录', to: '/system/sdk-list' },
            { label: '隐私政策简明版', to: '/system/privacy-concise' },
            { label: 'ICP备案信息', to: '/system/icp' },
            { label: '联系我们', to: '/system/contact' },
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
          <CardTitle className="text-base">账户安全</CardTitle>
        </CardHeader>
        <CardContent>
          <AuthSettingsPanel compact={false} />
        </CardContent>
      </Card>
    </div>
  )
}

function AuthSettingsPanel({ compact: _compact }: { compact: boolean }) {
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
    if (!currentPassword) { setPasswordError('请输入当前密码'); return }
    if (newPassword.length < 8) { setPasswordError('新密码至少需要8位字符'); return }
    if (newPassword !== confirmPassword) { setPasswordError('两次密码不一致'); return }

    setPasswordLoading(true)
    setPasswordError('')
    try {
      const { changePassword } = await import('@/features/auth/api')
      await changePassword(currentPassword, newPassword)
      setPasswordDialogOpen(false)
    } catch (error: any) {
      setPasswordError(error?.response?.data?.message || error?.message || '修改失败')
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
    if (!deletePassword) { setDeleteError('请输入密码以确认删除'); return }
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const { deleteAccount } = await import('@/features/auth/api')
      await deleteAccount(deletePassword)
      localStorage.clear()
      window.location.hash = '#/portal'
      window.location.reload()
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || error?.message || '删除失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  const currentName = name || sessionUser?.name || '未设置'

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
        <p className="text-xs text-muted-foreground">请前往登录或注册。</p>
        <Button size="sm" onClick={() => navigate('/auth/login')}>去登录</Button>
      </div>
    )
  }

  return (
    <div>
      <div className="-mx-4 -my-4 divide-y-0">
        <Row
          label="个人信息"
          value={currentName}
          subtitle={`${sessionUser.email}${sessionUser.emailVerified ? ' · 已验证' : ''}`}
          onClick={() => setProfileDialogOpen(true)}
        />
        <Row
          label="修改密码"
          subtitle="定期更换密码保障账户安全"
          onClick={() => setPasswordDialogOpen(true)}
        />
        <Row
          label="退出登录"
          subtitle="清除本地登录状态，返回登录页"
          onClick={() => signOut().then(() => navigate('/auth/login'))}
        />
        <Row
          label="帮助与反馈"
          subtitle="提交问题或建议，帮助我们做得更好"
          onClick={() => setFeedbackDialogOpen(true)}
        />
        <Row
          label="注销账户"
          subtitle="永久删除账户及所有学习数据，不可恢复"
          danger
          onClick={() => setDeleteDialogOpen(true)}
          last
        />
      </div>

      {/* ── 个人信息 Dialog ── */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑个人信息</DialogTitle>
            <DialogDescription>修改后点击保存即可生效</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">名称 (name)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="显示名称" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">昵称 (username)</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="昵称" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveProfile} disabled={profileLoading}>
              {profileLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 修改密码 Dialog ── */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>输入当前密码和新密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">当前密码</Label>
              <Input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                placeholder="输入当前密码"
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">新密码</Label>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="至少 8 位字符"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">确认新密码</Label>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                placeholder="再次输入新密码"
                autoComplete="new-password"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>取消</Button>
            <Button onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 注销账户 Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">注销账户</DialogTitle>
            <DialogDescription>
              此操作不可撤销。所有学习记录、收藏、生词本、模考成绩等数据将被永久删除。请输入密码以确认。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={deletePassword}
              onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
              type="password"
              placeholder="输入当前密码"
              autoComplete="current-password"
            />
            {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 反馈 Dialog (PC) / Drawer (移动端) ── */}
      <FeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} />
    </div>
  )
}
