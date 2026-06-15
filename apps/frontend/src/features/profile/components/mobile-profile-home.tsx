import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import {
  User, Settings, Camera, Gift, GraduationCap, IdCard, Crown, MessageSquare,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/cn'
import i18n from '@/lib/i18n'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useProfileCacheStore } from '@/features/profile/profile-cache.store'
import { IosRow, IosSection } from '@/features/profile/components/ios-components'
import { LearningAssessmentDialog, goalLabelMap, normalizeLearningGoals } from '@/features/profile/components/placement-assessment-dialog'
import { FeedbackDialog } from '@/features/feedback/components/feedback-dialog'
import { MobileInviteDrawer } from '@/features/referral/components/mobile-invite-drawer'

export type MobileView = 'overview' | 'records' | 'words' | 'account' | 'settings' | 'home' | 'appearance' | 'member' | 'storage'

export function MobileProfileHome({
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
  const membership = useProfileCacheStore((s) => s.membership)
  const pointsBalance = useProfileCacheStore((s) => s.pointsBalance)
  const loadProfileHome = useProfileCacheStore((s) => s.loadProfileHome)
  const [showLanguageDialog, setShowLanguageDialog] = useState(false)
  const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false)
  const [showInviteDrawer, setShowInviteDrawer] = useState(false)
  const [showAssessmentDialog, setShowAssessmentDialog] = useState(false)

  useEffect(() => {
    loadProfileHome(true)
  }, [loadProfileHome])

  const themeLabel: Record<string, string> = { light: t('profile.themeLight'), dark: t('profile.themeDark'), system: t('profile.themeSystem') }
  const langLabel: Record<string, string> = { 'zh-CN': t('profile.langZh'), en: t('profile.langEn'), ja: t('profile.langJa') }

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const nickname = userProfile?.name || userProfile?.username || t('app.name')
  const hasActiveMembership = membership?.level === 'admin' || !!membership?.isActive
  const membershipLabel = membership?.level === 'admin'
    ? t('member.admin')
    : hasActiveMembership
      ? membership?.planName || t('member.badgeActive')
      : t('member.freeUser')
  const outputLevel = userProfile?.outputLevel || 'L1'
  const goalLabels = normalizeLearningGoals(userProfile?.learningGoals)
    .map((goal) => t(`profile.placement.goals.${goal}.label`, { defaultValue: goalLabelMap[goal] ?? goal }))
    .filter(Boolean)
  const goalSummary = goalLabels.length > 0
    ? `${outputLevel} · ${goalLabels.join(t('profile.placement.goalSeparator'))}`
    : t('profile.placement.homeSubtitle')

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
              <Badge variant={hasActiveMembership ? 'default' : 'secondary'} className="h-5 px-1.5 text-[10px]">
                {membershipLabel}
              </Badge>
              <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] border-amber-500/30 text-amber-600">
                <Gift className="size-2.5" />{pointsBalance}
              </Badge>
              <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] border-primary/25 text-primary">
                {outputLevel}
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
        <IosRow
          icon={GraduationCap}
          iconBg="bg-blue-500"
          label={t('profile.placement.homeTitle')}
          subtitle={goalSummary}
          onTap={() => setShowAssessmentDialog(true)}
        />
        <IosRow icon={IdCard} iconBg="bg-sky-400" label={t('profile.account')} onTap={() => onNavigate('account')} />
        <IosRow icon={Crown} iconBg="bg-amber-500" label={t('nav.member')} onTap={() => onNavigate('member')} />
        <IosRow
          icon={Gift}
          iconBg="bg-pink-500"
          label={t('invite.title')}
          // subtitle="好友注册成功后，你获得 5 天会员"
          onTap={() => setShowInviteDrawer(true)}
        />
        <IosRow icon={MessageSquare} iconBg="bg-emerald-500" label={t('feedback.title')} last onTap={onFeedbackOpen ?? (() => setShowFeedbackDrawer(true))} />
      </IosSection>

      {/* 外观与语言（保留在"我的"首页，点击弹窗切换） */}
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
        <DrawerContent className="rounded-t-3xl drawer-surface">
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

      <LearningAssessmentDialog
        open={showAssessmentDialog}
        onOpenChange={setShowAssessmentDialog}
        profile={userProfile}
      />

      <MobileInviteDrawer open={showInviteDrawer} onOpenChange={setShowInviteDrawer} />

      {!onFeedbackOpen && <FeedbackDialog open={showFeedbackDrawer} onOpenChange={setShowFeedbackDrawer} />}

    </div>
  )
}
