import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  User, Camera, Loader2, PencilLine, Mail, Phone, ExternalLink,
  KeyRound, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MobileListSkeleton } from '@/components/common/mobile-page-loading'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import { useProfileCacheStore } from '@/features/profile/profile-cache.store'
import { updateUserProfile } from '@/features/profile/api'
import { NicknameEditDialog } from '@/features/profile/components/nickname-edit-dialog'
import { getCurrentAvatar, uploadFileToCosAndComplete, setCurrentAvatar } from '@/features/file-assets/api'
import { linkSocialAccount, unlinkAccount, type LinkedAccount } from '@/features/account/api'
import { changePassword, sendEmailOtp, verifyEmailOtp, sendBindPhoneOtp, bindPhoneNumber } from '@/features/auth/api'
import { useCountdown } from '@/hooks/use-countdown'
import { Select, SelectItem } from '@/components/ui/select'

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

export function AccountTab({ desktop = false }: { desktop?: boolean }) {
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
  const normalizedBindPhone = bindPhone.replace(/\s+/g, '')
  const displayPhoneNumber = phoneNumber?.replace(/\s+/g, '') || null
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
      <MobileListSkeleton rows={5} />
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
                  {displayPhoneNumber || t('profile.notBound')}
                </p>
              </div>
            </div>
            {phoneNumber ? (
              <Badge variant="outline" className="text-xs">
                {t('profile.boundPrefix')}
              </Badge>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setPhoneBindOpen(true)}>
                <ExternalLink className="mr-1 size-3" />
                {t('profile.bind')}
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#07C160]/15">
                <WechatIcon className="size-4 text-[#07C160]" />
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
                <AppleIcon className="size-4 text-foreground" />
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

      {desktop && (
        <Dialog open={verificationDialogOpen} onOpenChange={setVerificationDialogOpen}>
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
        </Dialog>
      )}

      {/* 手机号绑定弹窗 */}
      <Dialog open={phoneBindOpen} onOpenChange={(v) => { setPhoneBindOpen(v); if (!v) { setBindPhone(''); setBindOtp(''); setBindError(''); setBindOtpSent(false); resetBindCountdown() } }}>
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t('profile.bindPhone')}</DialogTitle>
            <DialogDescription>{t('profile.bindPhoneDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input
                value={bindPhone}
                onChange={(e) => { setBindPhone(e.target.value.replace(/\s+/g, '')); setBindOtpSent(false); resetBindCountdown() }}
                placeholder="+8613800000000"
                className="min-w-0"
                autoComplete="tel"
                inputMode="tel"
              />
              <Button
                variant="outline"
                className="h-11 shrink-0"
                disabled={bindLoading || bindCountdown > 0 || !normalizedBindPhone}
                onClick={async () => {
                  if (!normalizedBindPhone) return
                  setBindLoading(true)
                  setBindError('')
                  try {
                    await sendBindPhoneOtp(normalizedBindPhone)
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
          <DialogFooter className="flex-row justify-end gap-2 space-x-0">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setPhoneBindOpen(false)} disabled={bindLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              onClick={async () => {
                if (!normalizedBindPhone || bindOtp.length !== 6) return
                setBindLoading(true)
                setBindError('')
                try {
                  const result = await bindPhoneNumber(normalizedBindPhone, bindOtp)
                  const boundPhoneNumber = result?.user?.phoneNumber?.replace(/\s+/g, '') || normalizedBindPhone
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
              disabled={bindLoading || !bindOtpSent || !normalizedBindPhone || bindOtp.length !== 6}
            >
              {bindLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {desktop && (
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
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
        </Dialog>
      )}
    </div>
  )
}
