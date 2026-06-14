import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import { getUserProfile, updateUserProfile } from '@/features/profile/api'
import { FeedbackDialog } from '@/features/feedback/components/feedback-dialog'

export function AuthSettingsPanel({ compact: _compact }: { compact: boolean }) {
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
  const [deleteRequiresPassword, setDeleteRequiresPassword] = useState<boolean | null>(null)
  const [deleteScheduledAt, setDeleteScheduledAt] = useState<string | null>(null)
  const [deleteRequirementsLoading, setDeleteRequirementsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')

  // ── 反馈 Dialog ──
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)

  useEffect(() => {
    if (deleteDialogOpen) {
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
    }
  }, [deleteDialogOpen, t])

  const handleDeleteAccount = async () => {
    if (deleteRequiresPassword && !deletePassword) { setDeleteError(t('profile.auth.passwordRequired')); return }
    setDeleteLoading(true)
    setDeleteError('')
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
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-destructive">{t('profile.deleteAccount')}</DialogTitle>
            <DialogDescription>
              {deleteScheduledAt
                ? `账号已进入 7 天注销缓冲期，将于 ${new Date(deleteScheduledAt).toLocaleString('zh-CN')} 后自动删除。期间你可以取消注销申请。`
                : deleteRequiresPassword === false
                  ? '此账号通过第三方登录创建。确认后将进入 7 天注销缓冲期，到期后账户及学习数据将被删除。'
                  : '确认后账号将进入 7 天注销缓冲期。期间可取消；到期后账户及学习数据将被删除。请输入密码以确认。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {deleteRequirementsLoading ? (
              <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在确认账号类型...
              </div>
            ) : deleteScheduledAt ? (
              <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
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
              <div className="rounded-xl bg-destructive/5 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
                请再次确认：账号将进入 7 天注销缓冲期，到期后账户、学习进度和同步数据将无法恢复。
              </div>
            )}
            {deleteMessage && <p className="text-sm text-success">{deleteMessage}</p>}
            {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
          </div>
          <DialogFooter className="flex-row justify-end gap-2 space-x-0">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              {t('common.cancel')}
            </Button>
            {deleteScheduledAt ? (
              <Button
                className="flex-1 sm:flex-none"
                onClick={handleCancelDeleteAccount}
                disabled={deleteLoading || deleteRequirementsLoading}
              >
                {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                取消注销申请
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="flex-1 sm:flex-none"
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

      {/* ── 反馈 Dialog (PC) / Drawer (移动端) ── */}
      <FeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} />
    </div>
  )
}
