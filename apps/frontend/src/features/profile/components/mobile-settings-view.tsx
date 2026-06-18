import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/providers/auth-provider'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useConfigStore } from '@/stores/config.store'
import { IosRow, IosSection } from '@/features/profile/components/ios-components'
import { SystemDocumentDrawer } from '@/features/system/components/system-document-drawer'
import { isNative, requestInAppReview } from '@/lib/native'
import { isNativeSpeechRecognitionAvailable } from '@/lib/native/vn-voice-input'
import { cn } from '@/lib/cn'
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
    dailyGoal,
    setDailyGoal,
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

  const handleRequestReview = async () => {
    try {
      const result = await requestInAppReview()
      if (!result.requested) {
        toast.message(t('profile.rateUnavailable'))
      }
    } catch (error: any) {
      toast.error(error?.message || t('profile.rateFailed'))
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

  return (
    <div className="space-y-5">
      <IosSection>
        <IosRow
          label={t('profile.dailyGoal')}
          subtitle={t(`profile.dailyGoal${dailyGoal}`)}
          right={
            <div className="flex rounded-full bg-muted p-0.5">
              {[10, 20, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDailyGoal(value)}
                  className={cn(
                    'h-7 min-w-9 rounded-full px-2 text-xs font-medium transition-colors',
                    dailyGoal === value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          }
        />
        {nativeSpeechRecognitionAvailable && (
          <IosRow
            label={t('profile.nativeSpeechRecognition')}
            subtitle={t('profile.nativeSpeechRecognitionSubtitle')}
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
            label={t('profile.rateUs')}
            subtitle={t('profile.rateUsSubtitle')}
            onTap={handleRequestReview}
          />
        )}
        <IosRow
          label={t('profile.storageManagement')}
          subtitle={t('profile.storageManagementSubtitle')}
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
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
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
          <div className="space-y-3 py-2">
            {deleteRequirementsLoading ? (
              <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('profile.deleteConfirmingAccountType')}
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
            {deleteMessage && (
              <p className="text-sm text-success">{deleteMessage}</p>
            )}
            {deleteError && (
              <p className="text-sm text-red-500">{deleteError}</p>
            )}
          </div>
          <DialogFooter className="flex-row justify-end gap-2 space-x-0">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setShowDeleteDialog(false)}
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
    </div>
  )
}
