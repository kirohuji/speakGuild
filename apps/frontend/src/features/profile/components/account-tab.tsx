import { showRequestError } from '@/lib/request-feedback'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Camera, Loader2, PencilLine, Mail, Phone, ExternalLink,
  KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MobileListSkeleton } from '@/components/common/mobile-page-loading'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import { useUserStore } from '@/stores/user.store'
import { NicknameEditDialog } from '@/features/profile/components/nickname-edit-dialog'
import { UserAvatar } from '@/components/common/user-avatar'
import {
  changePassword,
  sendEmailOtp,
  verifyEmailOtp,
  sendBindPhoneOtp,
  bindPhoneNumber,
  requestEmailChange,
  confirmEmailChange,
  mapEmailChangeError,
} from '@/features/auth/api'
import { useCountdown } from '@/hooks/use-countdown'

export function AccountTab({ desktop = false }: { desktop?: boolean }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const sessionUser = session?.user ?? null
  const profile = useUserStore((s) => s.profile)
  const hydrated = useUserStore((s) => s.hydrated)
  const loading = useUserStore((s) => s.loading)
  const avatarUploading = useUserStore((s) => s.avatarUploading)
  const ensureLoaded = useUserStore((s) => s.ensureLoaded)
  const patchCachedProfile = useUserStore((s) => s.patchProfile)
  const uploadAvatar = useUserStore((s) => s.uploadAvatar)
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(!hydrated)
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
  // 修改邮箱
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailCountdown, startEmailCountdown, resetEmailCountdown] = useCountdown(60)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = useCallback(async () => {
    if (!hydrated) setIsLoading(true)
    await ensureLoaded(sessionUser?.id)
    setIsLoading(false)
  }, [hydrated, ensureLoaded, sessionUser?.id])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => {
    if (hydrated && !loading) setIsLoading(false)
  }, [hydrated, loading])

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

    try {
      await uploadAvatar(file)
      toast.success(t('profile.avatarUpdated', { defaultValue: '头像已更新' }))
    } catch (error: any) {
      showRequestError(error, t('profile.auth.loadFailed'))
    }
  }

  const handleNicknameSaved = (name: string) => {
    patchCachedProfile({ name })
  }

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
    } catch (error: any) {
      setVerificationError(error?.message || t('auth.sendFailed'))
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
      // 后台刷新用户信息（避免 refreshSession 导致整个界面重建）
      void ensureLoaded(sessionUser?.id, { force: true })
      patchCachedProfile({ emailVerified: true })
      setVerificationDialogOpen(false)
      toast.success(t('profile.verified'))
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
      toast.success(t('auth.passwordChanged', { defaultValue: '密码修改成功' }))
    } catch (error: any) {
      setPasswordError(error?.response?.data?.message || error?.message || t('account.changeFailed'))
    } finally {
      setPasswordLoading(false)
    }
  }

  const normalizedNewEmail = newEmail.trim().toLowerCase()

  const handleSendEmailChangeOtp = async () => {
    if (!normalizedNewEmail) {
      setEmailError(t('auth.enterEmail'))
      return
    }
    if (email && normalizedNewEmail === email.trim().toLowerCase()) {
      setEmailError(t('profile.emailSameAsCurrent'))
      return
    }
    setEmailLoading(true)
    setEmailError('')
    try {
      await requestEmailChange(normalizedNewEmail)
      setEmailOtpSent(true)
      startEmailCountdown()
      toast.success(t('auth.otpSent'))
    } catch (error: any) {
      setEmailError(mapEmailChangeError(error?.message, t))
    } finally {
      setEmailLoading(false)
    }
  }

  const handleConfirmEmailChange = async () => {
    if (!normalizedNewEmail) {
      setEmailError(t('auth.enterEmail'))
      return
    }
    if (emailOtp.length !== 6) {
      setEmailError(t('auth.enterOtp'))
      return
    }
    setEmailLoading(true)
    setEmailError('')
    try {
      await confirmEmailChange(normalizedNewEmail, emailOtp)
      void ensureLoaded(sessionUser?.id, { force: true })
      patchCachedProfile({ email: normalizedNewEmail, emailVerified: true })
      setEmailDialogOpen(false)
      toast.success(t('profile.changeEmailSuccess'))
    } catch (error: any) {
      setEmailError(mapEmailChangeError(error?.message, t))
    } finally {
      setEmailLoading(false)
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

  useEffect(() => {
    if (!emailDialogOpen) return
    setNewEmail('')
    setEmailOtp('')
    setEmailOtpSent(false)
    setEmailError('')
    resetEmailCountdown()
  }, [emailDialogOpen, resetEmailCountdown])

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
            <UserAvatar
              className="size-16 ring-2 ring-border ring-offset-2 ring-offset-background transition-shadow group-hover:ring-primary/50"
              fallbackClassName="bg-primary/10 text-primary"
            />
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
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Mail className="size-4 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm">{t('profile.email')}</p>
                <p className="truncate text-xs text-muted-foreground">{email || t('profile.notBound')}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!profile?.emailVerified && email && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVerificationDialogOpen(true)}
                >
                  {t('profile.verify')}
                </Button>
              )}
              {email && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmailDialogOpen(true)}
                >
                  {t('profile.editEmail')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 账号绑定：仅移动端；桌面 header 账户管理 dialog 隐藏 */}
      {!desktop && (
      <div className="overflow-hidden rounded-xl bg-muted/30">
        <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.accountBinding')}</p>
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Phone className="size-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm">{t('profile.phone')}</p>
                <p className="text-xs text-muted-foreground">
                  {displayPhoneNumber || t('profile.notBound')}
                </p>
              </div>
            </div>
            {phoneNumber ? (
              <Button
                variant="ghost"
                size="sm"
                disabled
                title={t('profile.phoneUnlinkUnsupported', { defaultValue: '暂不支持解绑手机号' })}
                className="cursor-not-allowed text-destructive hover:text-destructive"
              >
                {t('profile.unbind')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10" onClick={() => setPhoneBindOpen(true)}>
                <ExternalLink className="mr-1 size-3" />
                {t('profile.bind')}
              </Button>
            )}
          </div>
          {/* 微信 / Apple 绑定仅 iOS 原生；Web 移动端不展示 */}
        </div>
      </div>
      )}

      {/* 账号安全 */}
      <div className="overflow-hidden rounded-xl bg-muted/30">
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
          <Button variant="ghost" size="sm" onClick={() => setPasswordDialogOpen(true)}>
            {t('profile.auth.changePassword')}
          </Button>
        </div>
      </div>

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

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile.changeEmail')}</DialogTitle>
            <DialogDescription>{t('profile.changeEmailDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('profile.newEmail')}</Label>
              <Input
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value)
                  setEmailOtpSent(false)
                  resetEmailCountdown()
                }}
                type="email"
                placeholder={t('profile.newEmailPlaceholder')}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('auth.verificationCode')}</Label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Input
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder={t('auth.otpPlaceholder')}
                  autoComplete="one-time-code"
                  maxLength={6}
                />
                <Button
                  variant="outline"
                  className="h-11 shrink-0"
                  disabled={emailLoading || emailCountdown > 0 || !normalizedNewEmail}
                  onClick={handleSendEmailChangeOtp}
                >
                  {emailCountdown > 0 ? `${emailCountdown}s` : emailOtpSent ? t('common.sent') : t('auth.getOtp')}
                </Button>
              </div>
            </div>
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleConfirmEmailChange}
              disabled={emailLoading || !emailOtpSent || emailOtp.length !== 6}
            >
              {emailLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  // 后台刷新用户信息（避免 refreshSession 导致整个界面重建关闭抽屉）
                  void ensureLoaded(sessionUser?.id, { force: true })
                  patchCachedProfile({
                    phoneNumber: boundPhoneNumber,
                    phoneNumberVerified: true,
                  })
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
    </div>
  )
}
