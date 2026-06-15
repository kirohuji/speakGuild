import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Camera, User, Loader2,
  Phone, ExternalLink, KeyRound, CheckCircle2, Mail,
  Trash2, HardDrive,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from '@/components/ui/drawer'
import { useAuth } from '@/providers/auth-provider'
import { useLayoutStore } from '@/stores/layout.store'
import { useAccountStore } from '@/stores/account.store'
import { useLearningStore } from '@/stores/learning.store'
import type { LinkedAccount } from '@/features/account/api'
import { changePassword, sendEmailOtp } from '@/features/auth/api'
import { toast } from 'sonner'

// ─── 第三方登录图标（与登录页一致）────────────────────────────────────────

function WechatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.883-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.11.24-.245 0-.06-.023-.12-.038-.178l-.327-1.233a.49.49 0 01.177-.554C23.025 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zM14.033 13.5c.534 0 .967.44.967.982a.974.974 0 01-.967.983.974.974 0 01-.967-.983c0-.542.433-.982.967-.982zm4.835 0c.534 0 .967.44.967.982a.974.974 0 01-.967.983.974.974 0 01-.967-.983c0-.542.433-.982.967-.982z" />
    </svg>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

// ─── iOS 风格组件（与 profile-page 一致）──────────────────────────────────

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
  icon?: React.ComponentType<{ className?: string }>
  label: string
  subtitle?: string
  value?: string
  last?: boolean
  onTap?: () => void
  right?: React.ReactNode
}) {
  const inner = (
    <div
      className={cn(
        'flex min-h-[52px] items-center gap-3 px-4 py-3 transition-colors',
        onTap && 'active:bg-muted/60',
        !last && 'border-b border-border/50',
      )}
    >
      {Icon && iconBg && (
        <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] text-white', iconBg)}>
          <Icon className="h-4 w-4" />
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

// ─── 昵称编辑 Drawer ──────────────────────────────────────────────────────

function NicknameEditDrawer({
  open,
  onOpenChange,
  currentName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onSaved: (name: string) => void | Promise<void>
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
      await onSaved(name.trim())
      onOpenChange(false)
    } catch {
      // 静默失败
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl">
        <DrawerHeader>
          <DrawerTitle className="text-base">{t('profile.editNicknameTitle')}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('account.nicknamePlaceholder')}
            maxLength={20}
            autoFocus
          />
          <p className="mt-1.5 text-right text-[11px] text-muted-foreground">{name.length}/20</p>
        </div>
        <DrawerFooter>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// ─── 修改密码 Drawer ──────────────────────────────────────────────────────

function ChangePasswordDrawer({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('')
      setSuccess(false)
    }
  }, [open])

  const handleChange = async () => {
    if (!currentPassword) { setMessage(t('auth.enterCurrentPassword')); return }
    if (newPassword.length < 8) { setMessage(t('auth.passwordMinLengthHint')); return }
    if (newPassword !== confirmPassword) { setMessage(t('auth.passwordMismatch')); return }
    if (currentPassword === newPassword) { setMessage(t('auth.samePassword')); return }

    setLoading(true)
    setMessage('')
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setMessage(t('auth.passwordChanged'))
      setTimeout(() => {
        onOpenChange(false)
        onDone?.()
      }, 1500)
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || t('account.changeFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="rounded-t-3xl">
          <div className="flex flex-col items-center px-4 py-10">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-semibold">{t('auth.passwordChanged')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('account.useNewPassword')}</p>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl">
        <DrawerHeader>
          <DrawerTitle className="text-base">{t('profile.changePassword')}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-3 pb-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">当前密码</Label>
            <Input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              placeholder="输入当前密码"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">新密码</Label>
            <Input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              placeholder="至少8位字符"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">确认新密码</Label>
            <Input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
          </div>
          {message && (
            <p className={cn(
              'text-sm text-center rounded-lg px-3 py-2',
              message.includes('成功') ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
            )}>
              {message}
            </p>
          )}
        </div>
        <DrawerFooter>
          <Button onClick={handleChange} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            确认修改
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// ─── 主页面 ────────────────────────────────────────────────────────────────

export function AccountPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { session } = useAuth()
  const setBottomNavVisible = useLayoutStore((s) => s.setBottomNavVisible)

  // 数据：来自 store
  const profile = useAccountStore((s) => s.profile)
  const avatarUrl = useAccountStore((s) => s.avatarUrl)
  const linkedAccounts = useAccountStore((s) => s.linkedAccounts)
  const isLoading = useAccountStore((s) => s.isLoading)
  const avatarUploading = useAccountStore((s) => s.avatarUploading)
  const linkingProvider = useAccountStore((s) => s.linkingProvider)
  const unlinkingId = useAccountStore((s) => s.unlinkingId)
  const fetchAll = useAccountStore((s) => s.fetchAll)
  const storeUpdateProfile = useAccountStore((s) => s.updateProfile)
  const uploadAvatar = useAccountStore((s) => s.uploadAvatar)
  const fetchLinkedAccounts = useAccountStore((s) => s.fetchLinkedAccounts)
  const linkSocial = useAccountStore((s) => s.linkSocial)
  const unlinkSocial = useAccountStore((s) => s.unlinkSocial)

  // UI-only state
  const [nicknameDrawerOpen, setNicknameDrawerOpen] = useState(false)
  const [passwordDrawerOpen, setPasswordDrawerOpen] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

  const handleSendVerification = async () => {
    if (!sessionUser?.email) return
    setSendingVerification(true)
    try {
      await sendEmailOtp(sessionUser.email)
      setVerificationSent(true)
    } catch {
      // ignore
    } finally {
      setSendingVerification(false)
    }
  }

  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const sessionUser = session?.user ?? null

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    setBottomNavVisible(false)
    return () => setBottomNavVisible(true)
  }, [setBottomNavVisible])

  // OAuth 回调后通过 window focus 刷新绑定列表
  useEffect(() => {
    const handleFocus = () => { fetchLinkedAccounts() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchLinkedAccounts])

  // ── 头像操作 ──
  const onPickAvatar = () => {
    avatarInputRef.current?.click()
  }

  const onAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.currentTarget.value = ''
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return
    await uploadAvatar(file)
  }

  // ── 绑定操作 ──
  const handleLinkSocial = (provider: 'wechat' | 'apple') => {
    linkSocial(provider)
  }

  const handleUnlink = (account: LinkedAccount) => {
    unlinkSocial(account)
  }

  const handleNicknameSaved = (name: string) => {
    storeUpdateProfile({ name })
  }

  // ── 判断绑定状态 ──
  const wechatBound = linkedAccounts.some((a) => a.providerId === 'wechat')
  const appleBound = linkedAccounts.some((a) => a.providerId === 'apple')
  const wechatAccount = linkedAccounts.find((a) => a.providerId === 'wechat')
  const appleAccount = linkedAccounts.find((a) => a.providerId === 'apple')

  const nickname = profile?.name || sessionUser?.name || t('common.notSet')
  const phoneNumber = profile?.phoneNumber || sessionUser?.phoneNumber || null

  return (
    <div className="space-y-5">
      {/*
        iOS 风格返回栏 —— 与设置页完全一致：
        居中标题 + 左侧返回按钮（absolute 定位）
      */}
      <div className="relative flex items-center justify-center">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={() => navigate(-1)}
          className="absolute left-0 inline-flex size-10 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <h1 className="text-base font-semibold">{t('profile.accountSection')}</h1>
      </div>

      {/* 区域一：头像 */}
      <IosSection header={t('profile.avatar')}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
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
              className="group relative flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/15"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-primary" />
              )}
              <span className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-0.5 bg-black/50 py-0.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-3 w-3" />
                {avatarUploading ? t('common.uploading') : t('profile.changeAvatar')}
              </span>
            </button>
            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t('profile.changeAvatar')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.avatarHint')}</p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </div>
        </div>
      </IosSection>

      {/* 区域二：昵称 + 手机号 */}
      <IosSection header={t('profile.basicInfo')}>
        {isLoading ? (
          <>
            <div className="px-4 py-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <div className="border-t border-border/50 px-4 py-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <div className="border-t border-border/50 px-4 py-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </div>
          </>
        ) : (
          <>
            <IosRow
              label={t('profile.email')}
              value={sessionUser?.email || t('common.notSet')}
              subtitle={sessionUser?.emailVerified ? t('profile.verified') : t('profile.unverified')}
              iconBg="bg-blue-500"
              icon={Mail}
              right={!sessionUser?.emailVerified && sessionUser?.email ? (
                <button
                  type="button"
                  disabled={sendingVerification || verificationSent}
                  onClick={handleSendVerification}
                  className="text-xs font-medium text-primary"
                >
                  {verificationSent ? t('common.sent') : sendingVerification ? t('common.sending') : t('profile.verify')}
                </button>
              ) : undefined}
            />
            <IosRow
              label={t('profile.nickname')}
              value={nickname}
              onTap={() => setNicknameDrawerOpen(true)}
              subtitle={t('profile.editNicknameSubtitle')}
            />
            <IosRow
              icon={Phone}
              iconBg="bg-green-500"
              label={t('profile.phone')}
              value={phoneNumber || t('profile.notBound')}
              subtitle={phoneNumber ? (profile?.phoneNumberVerified ? t('profile.verified') : t('profile.unverified')) : undefined}
              last
            />
          </>
        )}
      </IosSection>

      {/* 区域三：第三方账号绑定 */}
      <IosSection header={t('profile.accountBinding')}>
        {isLoading ? (
          <>
            <div className="px-4 py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-1 h-3 w-12" />
            </div>
            <div className="border-t border-border/50 px-4 py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-1 h-3 w-12" />
            </div>
          </>
        ) : (
          <>
            {/* 微信 */}
            <IosRow
              icon={WechatIcon}
              iconBg="bg-[#07C160]"
              label={t('profile.wechat')}
              subtitle={wechatBound ? t('account.bound') : t('profile.wechatBind')}
              right={
                wechatBound ? (
                  <button
                    type="button"
                    disabled={unlinkingId === wechatAccount?.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (wechatAccount) handleUnlink(wechatAccount)
                    }}
                    className="text-xs text-destructive active:text-destructive/70"
                  >
                    {unlinkingId === wechatAccount?.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      '解绑'
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={linkingProvider === 'wechat'}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLinkSocial('wechat')
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-[#07C160]/10 px-3 py-1 text-xs font-medium text-[#07C160]"
                  >
                    {linkingProvider === 'wechat' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3" />
                    )}
                    绑定
                  </button>
                )
              }
            />
            {/* Apple */}
            <IosRow
              icon={AppleIcon}
              iconBg="bg-black dark:bg-white"
              label="Apple ID"
              subtitle={appleBound ? t('account.bound') : t('profile.appleIdBind')}
              last
              right={
                appleBound ? (
                  <button
                    type="button"
                    disabled={unlinkingId === appleAccount?.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (appleAccount) handleUnlink(appleAccount)
                    }}
                    className="text-xs text-destructive active:text-destructive/70"
                  >
                    {unlinkingId === appleAccount?.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      '解绑'
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={linkingProvider === 'apple'}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLinkSocial('apple')
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {linkingProvider === 'apple' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3" />
                    )}
                    绑定
                  </button>
                )
              }
            />
          </>
        )}
      </IosSection>

      {/* 区域：离线数据 */}
      <IosSection header={t('profile.offlineData', { defaultValue: '离线数据' })}>
        <IosRow
          icon={HardDrive}
          iconBg="bg-blue-500"
          label={t('profile.clearOfflineData', { defaultValue: '清除离线数据' })}
          subtitle={t('profile.clearOfflineDataHint', { defaultValue: '删除已下载的学习包和资源文件' })}
          onTap={() => {
            if (confirm(t('profile.clearOfflineDataConfirm', { defaultValue: '确定要清除所有离线数据吗？已下载的学习包将被删除。' }))) {
              useLearningStore.getState().clearAllOfflineData()
            }
          }}
          last
        />
      </IosSection>

      {/* 区域四：安全设置 */}
      <IosSection header={t('profile.dangerZone')}>
        <IosRow
          icon={KeyRound}
          iconBg="bg-amber-500"
          label="修改密码"
          subtitle="定期更换密码保障账户安全"
          onTap={() => setPasswordDrawerOpen(true)}
          last
        />
      </IosSection>

      {/* 昵称编辑抽屉 */}
      <NicknameEditDrawer
        open={nicknameDrawerOpen}
        onOpenChange={setNicknameDrawerOpen}
        currentName={nickname}
        onSaved={handleNicknameSaved}
      />

      {/* 修改密码抽屉 */}
      <ChangePasswordDrawer
        open={passwordDrawerOpen}
        onOpenChange={setPasswordDrawerOpen}
      />
    </div>
  )
}
