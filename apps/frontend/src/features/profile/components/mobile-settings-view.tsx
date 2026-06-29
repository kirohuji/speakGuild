import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronRight, Loader2, Download, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/providers/auth-provider'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useConfigStore } from '@/stores/config.store'
import { useOfflineSyncStore } from '@/stores/offline-sync.store'
import { IosRow, IosSection } from '@/features/profile/components/ios-components'
import { AlarmTimePicker } from '@/features/profile/components/alarm-time-picker'
import { SystemDocumentDrawer } from '@/features/system/components/system-document-drawer'
import { isNative, requestInAppReview } from '@/lib/native'
import { updater } from '@/lib/native'
import { scheduleLearningReminderTestNotification } from '@/lib/native/learning-reminder'
import { isNativeSpeechRecognitionAvailable } from '@/lib/native/vn-voice-input'
import { cn } from '@/lib/cn'
import type { MobileView } from '@/features/profile/components/mobile-profile-home'
import { SyncLogDialog } from './sync-log-dialog'

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
    dailyPracticeMixedPacks,
    setDailyPracticeMixedPacks,
    dailyPracticeRandomOrder,
    setDailyPracticeRandomOrder,
    learningReminderEnabled,
    setLearningReminderEnabled,
    learningReminderTime,
    setLearningReminderTime,
  } = usePreferencesStore()
  const { config } = useConfigStore()
  const { logs: syncLogs } = useOfflineSyncStore()
  const [nativeSpeechRecognitionAvailable, setNativeSpeechRecognitionAvailable] = useState(false)
  const [syncLogsOpen, setSyncLogsOpen] = useState(false)
  // 删除账户状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteRequiresPassword, setDeleteRequiresPassword] = useState<boolean | null>(null)
  const [deleteScheduledAt, setDeleteScheduledAt] = useState<string | null>(null)
  const [deleteRequirementsLoading, setDeleteRequirementsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [testingLearningReminder, setTestingLearningReminder] = useState(false)

  // ─── 版本更新 ──────────────────────────────────────
  const [appVersion, setAppVersion] = useState('')
  const [versionLoading, setVersionLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [updateDialog, setUpdateDialog] = useState<{ version: string; url: string; releaseNotes: string } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    updater.getCurrent().then((current) => {
      setAppVersion(current.version || current.builtinVersion || '')
    }).finally(() => setVersionLoading(false))
  }, [])

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

  const refreshLearningReminder = async () => {
    try {
      const { rescheduleLearningReminder } = await import('@/lib/native/learning-reminder')
      const ok = await rescheduleLearningReminder()
      if (!ok && isNative()) {
        toast.error('需要允许通知权限后才能提醒学习')
      }
    } catch (error: any) {
      toast.error(error?.message || '学习提醒设置失败')
    }
  }

  const handleLearningReminderEnabledChange = (value: boolean) => {
    setLearningReminderEnabled(value)
    void refreshLearningReminder()
  }

  const handleLearningReminderTimeChange = (value: string) => {
    setLearningReminderTime(value)
    void refreshLearningReminder()
  }

  const handleTestLearningReminder = async () => {
    if (testingLearningReminder) return
    setTestingLearningReminder(true)
    try {
      toast.message('正在安排测试提醒...')
      const result = await scheduleLearningReminderTestNotification(10)
      if (result.scheduled) {
        const time = result.scheduledAt
          ? new Date(result.scheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '10 秒后'
        toast.success(`测试提醒已安排：${time}，pending ${result.pendingIds?.length ?? 0} 条`)
      } else {
        toast.error(isNative()
          ? `通知未安排，${result.error ?? `权限：${result.permissionAfter ?? result.permissionBefore ?? 'unknown'}`}`
          : '本地通知仅支持 iOS / Android App')
      }
    } catch (error: any) {
      toast.error(error?.message || '测试提醒发送失败')
    } finally {
      setTestingLearningReminder(false)
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
  const latestFailedSyncLog = syncLogs.find((log) => log.status === 'failed' || log.error)
  const latestSyncLog = syncLogs[0]

  // ─── 版本检查 ──────────────────────────────────────
  const handleCheckUpdate = async () => {
    setChecking(true)
    setUpdateDialog(null)
    setDownloading(false)
    setDownloaded(false)
    setDownloadPercent(0)
    try {
      const result = await updater.checkUpdate()
      if (!result.newVersion) {
        toast.success('已是最新版本')
      }
    } catch {
      toast.error('检查更新失败')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    updater.onUpdateAvailable((info) => {
      if (info.version) {
        setDownloading(true)
        setUpdateDialog({ version: info.version, url: info.url || '', releaseNotes: '' })
      }
    })
    updater.onDownload((percent) => {
      setDownloadPercent(Math.round(percent))
    })
    updater.onDownloadComplete(() => {
      setDownloaded(true)
    })
    updater.onFailed(() => {
      setDownloading(false)
      setDownloadPercent(0)
    })
  }, [])

  const handleRestartApp = () => {
    setUpdateDialog(null)
    setDownloading(false)
    window.location.reload()
  }

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
        <IosRow
          label="跨学习包混合排程"
          subtitle={dailyPracticeMixedPacks ? '今日任务可从多个已安装学习包混合安排' : '今日任务只从一个学习包安排'}
          right={
            <Switch
              checked={dailyPracticeMixedPacks}
              onCheckedChange={setDailyPracticeMixedPacks}
            />
          }
        />
        <IosRow
          label="今日练习随机出题"
          subtitle={dailyPracticeRandomOrder ? '今日练习会从题池随机抽一组' : '今日练习会按内容顺序取下一组'}
          right={
            <Switch
              checked={dailyPracticeRandomOrder}
              onCheckedChange={setDailyPracticeRandomOrder}
            />
          }
        />
        <IosRow
          label="学习提醒"
          subtitle={learningReminderEnabled ? `每天 ${learningReminderTime} 提醒未完成学习` : '关闭后不会发送本地学习提醒'}
          right={
            <Switch
              checked={learningReminderEnabled}
              onCheckedChange={handleLearningReminderEnabledChange}
            />
          }
        />
        {learningReminderEnabled && (
          <>
            <IosRow
              label="提醒时间"
              right={
                <AlarmTimePicker
                  value={learningReminderTime}
                  onChange={handleLearningReminderTimeChange}
                />
              }
            />
            {/* <IosRow
              label="测试提醒"
              subtitle="立即安排一条 5 秒后的本地通知"
              onTap={handleTestLearningReminder}
              right={
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {testingLearningReminder ? '安排中' : '测试'}
                </span>
              }
            /> */}
          </>
        )}
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
          <>
            <IosRow
              label="检查版本"
              subtitle={versionLoading ? '加载中...' : appVersion || 'web'}
              right={
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="text-sm">{versionLoading ? '...' : `v${appVersion || '—'}`}</span>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                </div>
              }
              onTap={checking || versionLoading ? undefined : handleCheckUpdate}
            />
            <IosRow
              label={t('profile.rateUs')}
              subtitle={t('profile.rateUsSubtitle')}
              onTap={handleRequestReview}
            />
          </>
        )}
        {!isNative() && (
          <IosRow
            label="版本"
            value={appVersion || 'web'}
            subtitle="Web 端无需检查更新，刷新页面即可获取最新版本"
            last
          />
        )}
        <IosRow
          label={t('profile.storageManagement')}
          subtitle={t('profile.storageManagementSubtitle')}
          onTap={() => onNavigate?.('storage')}
        />
        <IosRow
          label="同步操作日志"
          subtitle={latestFailedSyncLog?.error ?? latestSyncLog?.summary ?? '暂无同步记录'}
          onTap={() => setSyncLogsOpen(true)}
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

      {/* 版本更新弹窗 */}
      <Dialog open={updateDialog !== null} onOpenChange={() => { setUpdateDialog(null); setDownloading(false); }}>
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {downloaded ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Download className="h-5 w-5 text-primary" />}
              {downloaded ? '更新就绪' : '发现新版本'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              版本 {updateDialog?.version}{downloaded ? ' 已下载完成' : ' 正在下载...'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{downloaded ? '下载完成' : '下载中'}</span>
                <span className="text-muted-foreground">{downloaded ? 100 : downloadPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${downloaded ? 100 : downloadPercent}%` }}
                />
              </div>
            </div>
            {downloaded && (
              <p className="text-xs text-muted-foreground">
                更新将在下次启动 App 时生效。现在重启即可立即体验新版本。
              </p>
            )}
          </div>

          <DialogFooter className="flex-row justify-end gap-2 space-x-0">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => { setUpdateDialog(null); setDownloading(false); }}
            >
              {downloaded ? '稍后重启' : '后台下载'}
            </Button>
            {downloaded && (
              <Button className="flex-1 sm:flex-none gap-1.5" onClick={handleRestartApp}>
                <RefreshCw className="h-4 w-4" />
                重启应用
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <SyncLogDialog open={syncLogsOpen} onOpenChange={setSyncLogsOpen} />
    </div>
  )
}
