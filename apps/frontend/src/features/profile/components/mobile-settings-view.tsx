import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckCircle2, Copy, Gift, Loader2, Share2, Trash2, Users } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/providers/auth-provider'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useConfigStore } from '@/stores/config.store'
import { IosRow, IosSection } from '@/features/profile/components/ios-components'
import { SystemDocumentDrawer } from '@/features/system/components/system-document-drawer'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { getReferralCode, getReferralStats, type ReferralCodeData, type ReferralStats } from '@/features/referral/api'
import { isNative, requestInAppReview, revenueCat } from '@/lib/native'
import { isNativeSpeechRecognitionAvailable } from '@/lib/native/vn-voice-input'
import type { MobileView } from '@/features/profile/components/mobile-profile-home'

export function MobileSettingsView({ onFeedbackOpen, onNavigate }: { onFeedbackOpen?: () => void; onNavigate?: (view: MobileView) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const {
    autoPlay,
    setAutoPlay,
    wifiOnlyMedia,
    setWifiOnlyMedia,
    nativeSpeechRecognitionEnabled,
    setNativeSpeechRecognitionEnabled,
  } = usePreferencesStore()
  const { config } = useConfigStore()
  const [nativeSpeechRecognitionAvailable, setNativeSpeechRecognitionAvailable] = useState(false)
  // 删除账户状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteRequiresPassword, setDeleteRequiresPassword] = useState<boolean | null>(null)
  const [deleteScheduledAt, setDeleteScheduledAt] = useState<string | null>(null)
  const [deleteRequirementsLoading, setDeleteRequirementsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [showInviteDrawer, setShowInviteDrawer] = useState(false)
  const [codeData, setCodeData] = useState<ReferralCodeData | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // 处理账户删除
  const handleDeleteAccount = async () => {
    if (deleteRequiresPassword && !deletePassword) {
      setDeleteError(t('profile.auth.passwordRequired'))
      return
    }
    setDeleteLoading(true)
    setDeleteError('')
    setDeleteMessage('')
    try {
      const { deleteAccount } = await import('@/features/auth/api')
      const result = await deleteAccount(deleteRequiresPassword ? deletePassword : undefined)
      setDeletePassword('')
      setDeleteScheduledAt(result.deletionScheduledAt)
      setDeleteMessage(`注销申请已提交。账号将在 ${new Date(result.deletionScheduledAt).toLocaleString('zh-CN')} 后删除，期间可取消。`)
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || error?.message || t('profile.auth.deleteFailed'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleCancelDeleteAccount = async () => {
    setDeleteLoading(true)
    setDeleteError('')
    setDeleteMessage('')
    try {
      const { cancelDeleteAccount } = await import('@/features/auth/api')
      await cancelDeleteAccount()
      setDeleteScheduledAt(null)
      setDeleteMessage('注销申请已取消。')
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || error?.message || '取消注销失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  useEffect(() => {
    if (!showDeleteDialog) return
    setDeletePassword('')
    setDeleteError('')
    setDeleteMessage('')
    setDeleteRequiresPassword(null)
    setDeleteScheduledAt(null)
    setDeleteRequirementsLoading(true)
    import('@/features/auth/api')
      .then(({ getDeleteAccountRequirements }) => getDeleteAccountRequirements())
      .then((requirements) => {
        setDeleteRequiresPassword(requirements.requiresPassword)
        setDeleteScheduledAt(requirements.deletionScheduledAt)
      })
      .catch((error: any) => {
        setDeleteRequiresPassword(true)
        setDeleteError(error?.message || t('profile.auth.loadFailed', { defaultValue: '加载失败，请稍后重试' }))
      })
      .finally(() => setDeleteRequirementsLoading(false))
  }, [showDeleteDialog, t])

  useEffect(() => {
    if (!showInviteDrawer || codeData || inviteLoading) return
    setInviteLoading(true)
    Promise.all([getReferralCode(), getReferralStats()])
      .then(([code, referralStats]) => {
        setCodeData(code)
        setStats(referralStats)
      })
      .catch((error: any) => {
        toast.error(error?.message || '暂时无法加载邀请码')
      })
      .finally(() => setInviteLoading(false))
  }, [showInviteDrawer, codeData, inviteLoading])

  // 法律文档 Drawer 状态
  const [legalDrawer, setLegalDrawer] = useState<{ title: string; content: string } | null>(null)

  // 延迟导入 MD 内容（避免重复加载）
  const [mdContents, setMdContents] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    isNativeSpeechRecognitionAvailable('en-US')
      .then((available) => {
        if (!cancelled) setNativeSpeechRecognitionAvailable(available)
      })
      .catch(() => {
        if (!cancelled) setNativeSpeechRecognitionAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openCustomerCenter = async () => {
    try {
      await revenueCat.presentCustomerCenter()
    } catch (error: any) {
      toast.error(error?.message || 'Unable to open subscription management')
    }
  }

  const handleRequestReview = async () => {
    try {
      const result = await requestInAppReview()
      if (!result.requested) {
        toast.message('当前环境暂不支持应用内评分')
      }
    } catch (error: any) {
      toast.error(error?.message || '暂时无法打开评分弹窗')
    }
  }

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

  const inviteLink = `${window.location.origin}/#/auth/register?ref=${codeData?.code || ''}`

  const handleCopyInvite = async () => {
    if (!codeData?.code) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败，请稍后重试')
    }
  }

  const handleShareInvite = async () => {
    if (!codeData?.code) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: '漫语町 - 邀请你一起学习',
          text: `用我的邀请码 ${codeData.code} 注册漫语町。你注册成功后，我可以获得 5 天会员奖励。`,
          url: inviteLink,
        })
      } catch {
        /* user cancelled */
      }
      return
    }
    await handleCopyInvite()
  }

  return (
    <div className="space-y-5">
      <IosSection>
        {nativeSpeechRecognitionAvailable && (
          <IosRow
            label="原生语音识别"
            subtitle="录音时优先使用系统 STT"
            right={
              <Switch
                checked={nativeSpeechRecognitionEnabled}
                onCheckedChange={setNativeSpeechRecognitionEnabled}
              />
            }
          />
        )}
        <IosRow
          label={t('profile.wifiOnlyLabel')}
          last
          right={<Switch checked={wifiOnlyMedia} onCheckedChange={setWifiOnlyMedia} />}
        />
      </IosSection>

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
        {isNative() && (
          <IosRow
            label="Subscription management"
            subtitle="Manage purchases, restores, and billing"
            onTap={openCustomerCenter}
          />
        )}
        {isNative() && (
          <IosRow
            label="给我们评分"
            subtitle="喜欢漫语町的话，可以留下一点鼓励"
            onTap={handleRequestReview}
          />
        )}
        <IosRow
          icon={Gift}
          iconBg="bg-pink-500"
          label={t('invite.title')}
          subtitle="好友注册成功后，你获得 5 天会员"
          onTap={() => setShowInviteDrawer(true)}
        />
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

      <Drawer open={showInviteDrawer} onOpenChange={setShowInviteDrawer}>
        <DrawerContent className="max-h-[88dvh] rounded-t-3xl">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">{t('invite.title')}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(1rem+var(--safe-area-inset-bottom))]">
            {inviteLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/30 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-pink-500">
                      <Gift className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">邀请好友，你得 5 天会员</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        好友通过你的邀请码注册成功后，你将获得 5 天漫语会员奖励。
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-background px-4 py-3 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">邀请码</p>
                    <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-primary">
                      {codeData?.code || '----'}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" className="rounded-lg" onClick={handleCopyInvite} disabled={!codeData?.code}>
                      {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      {copied ? '已复制' : '复制链接'}
                    </Button>
                    <Button className="rounded-lg" onClick={handleShareInvite} disabled={!codeData?.code}>
                      <Share2 className="h-4 w-4" />
                      分享
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 px-4 py-3 text-center">
                    <p className="text-xl font-semibold text-primary">{stats?.totalInvited || 0}</p>
                    <p className="mt-1 text-xs text-muted-foreground">已邀请人数</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-4 py-3 text-center">
                    <p className="text-xl font-semibold text-amber-600">{stats?.totalReward || 0}</p>
                    <p className="mt-1 text-xs text-muted-foreground">累计奖励天数</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">邀请记录</p>
                  </div>
                  {stats?.referrals && stats.referrals.length > 0 ? (
                    <div>
                      {stats.referrals.map((ref) => (
                        <div
                          key={ref.userId}
                          className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={ref.userImage || undefined} />
                            <AvatarFallback className="text-[10px]">{ref.userName?.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{ref.userName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(ref.joinedAt).toLocaleDateString('zh-CN')}
                            </p>
                          </div>
                          {ref.rewarded && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-success">
                              <CheckCircle2 className="h-3 w-3" />
                              已奖励
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      还没有邀请记录，分享给好友试试看。
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* 删除账户确认弹窗 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t('profile.deleteAccount')}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {deleteScheduledAt
                ? `账号已进入 7 天注销缓冲期，将于 ${new Date(deleteScheduledAt).toLocaleString('zh-CN')} 后自动删除。期间你可以取消注销申请。`
                : deleteRequiresPassword === false
                  ? '此账号通过第三方登录创建。确认后将进入 7 天注销缓冲期，到期后账户及学习数据将被删除。'
                  : '确认后账号将进入 7 天注销缓冲期。期间可取消；到期后账户及学习数据将被删除。请输入密码以确认。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {deleteRequirementsLoading ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在确认账号类型...
              </div>
            ) : deleteScheduledAt ? (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                你现在仍可正常使用账号。若不再希望注销，请点击下方“取消注销申请”。
              </div>
            ) : deleteRequiresPassword ? (
              <Input
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                type="password"
                placeholder={t('profile.auth.currentPasswordPlaceholder')}
                autoComplete="current-password"
              />
            ) : (
              <div className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
                请再次确认：账号将进入 7 天注销缓冲期，到期后账户、学习进度和同步数据将无法恢复。
              </div>
            )}
            {deleteMessage && (
              <p className="text-sm text-success">{deleteMessage}</p>
            )}
            {deleteError && (
              <p className="text-sm text-red-500">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleteLoading}>
              {t('common.cancel')}
            </Button>
            {deleteScheduledAt ? (
              <Button onClick={handleCancelDeleteAccount} disabled={deleteLoading || deleteRequirementsLoading}>
                {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                取消注销申请
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteRequirementsLoading || deleteRequiresPassword === null}
              >
                {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('common.confirm')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
