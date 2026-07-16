import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronRight, Loader2 } from 'lucide-react'
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
import { useAppUpdateStore } from '@/stores/app-update.store'
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

export function MobileSettingsView({ onNavigate }: { onNavigate?: (view: MobileView) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, signOut } = useAuth()
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
    localAiWarmupJudgeEnabled,
    setLocalAiWarmupJudgeEnabled,
    localSttEnabled,
    setLocalSttEnabled,
    localSttFallbackToCloud,
    setLocalSttFallbackToCloud,
    learningReminderEnabled,
    setLearningReminderEnabled,
    learningReminderTime,
    setLearningReminderTime,
  } = usePreferencesStore()
  const { config } = useConfigStore()
  const isAdmin = session?.user?.role === 'admin'
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
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  // ─── 版本更新 ──────────────────────────────────────
  const [appVersion, setAppVersion] = useState('')
  const [versionLoading, setVersionLoading] = useState(true)
  const checking = useAppUpdateStore((s) => s.checking)
  const updateStage = useAppUpdateStore((s) => s.stage)
  const prepareManualCheck = useAppUpdateStore((s) => s.prepareManualCheck)
  const finishNoUpdate = useAppUpdateStore((s) => s.finishNoUpdate)
  const bindUpdaterEvents = useAppUpdateStore((s) => s.bindUpdaterEvents)

  useEffect(() => {
    updater.getCurrent().then((current) => {
      setAppVersion(current.version || current.builtinVersion || '')
    }).finally(() => setVersionLoading(false))
  }, [])

  // ─── 监听 updater 事件（组件卸载后不再更新状态）──
  useEffect(() => {
    bindUpdaterEvents(updater)
  }, [bindUpdaterEvents])

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
      setDeleteMessage(t('settings.deleteSubmitted', { date: new Date(result.deletionScheduledAt).toLocaleString('zh-CN') }))
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
      setDeleteMessage(t('settings.deleteCancelledMsg'))
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || error?.message || t('settings.deleteCancelFailed'))
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
        toast.error(t('settings.reminderPermission'))
      }
    } catch (error: any) {
      toast.error(error?.message || t('settings.reminderFailed'))
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
      toast.message(t('settings.testReminder'))
      const result = await scheduleLearningReminderTestNotification(10)
      if (result.scheduled) {
        const time = result.scheduledAt
          ? new Date(result.scheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : t('common.notSet')
        toast.success(t('settings.testReminderScheduled', { time, count: result.pendingIds?.length ?? 0 }))
      } else {
        toast.error(isNative()
          ? t('settings.testReminderFailed', { error: result.error ?? `权限：${result.permissionAfter ?? result.permissionBefore ?? 'unknown'}` })
          : t('settings.testReminderNativeOnly'))
      }
    } catch (error: any) {
      toast.error(error?.message || t('settings.testReminderSendFailed'))
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
    prepareManualCheck()
    try {
      const result = await updater.checkUpdate()
      if (!result.newVersion) {
        toast.success(t('settings.alreadyLatest'))
      }
    } catch {
      toast.error(t('settings.checkUpdateFailed'))
    } finally {
      finishNoUpdate()
    }
  }

  const handleConfirmLogout = async () => {
    if (logoutLoading) return
    setLogoutLoading(true)
    try {
      await signOut()
      setShowLogoutDialog(false)
      navigate('/auth/login')
    } catch (error: any) {
      toast.error(error?.message || t('profile.logoutFailed', { defaultValue: '退出登录失败，请重试' }))
    } finally {
      setLogoutLoading(false)
    }
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
          label={t('settings.mixedPacks')}
          subtitle={dailyPracticeMixedPacks ? t('settings.mixedPacksOn') : t('settings.mixedPacksOff')}
          right={
            <Switch
              checked={dailyPracticeMixedPacks}
              onCheckedChange={setDailyPracticeMixedPacks}
            />
          }
        />
        <IosRow
          label={t('settings.randomOrder')}
          subtitle={dailyPracticeRandomOrder ? t('settings.randomOrderOn') : t('settings.randomOrderOff')}
          right={
            <Switch
              checked={dailyPracticeRandomOrder}
              onCheckedChange={setDailyPracticeRandomOrder}
            />
          }
        />
        {isAdmin && (
          <IosRow
            label={t('settings.localAiWarmupJudge')}
            subtitle={localAiWarmupJudgeEnabled ? t('settings.localAiWarmupJudgeOn') : t('settings.localAiWarmupJudgeOff')}
            right={
              <Switch
                checked={localAiWarmupJudgeEnabled}
                onCheckedChange={setLocalAiWarmupJudgeEnabled}
              />
            }
          />
        )}
        <IosRow
          label={t('settings.learningReminder')}
          subtitle={learningReminderEnabled ? t('settings.reminderOn', { time: learningReminderTime }) : t('settings.reminderOff')}
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
              label={t('settings.reminderTime')}
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
          label={t('settings.localStt', { defaultValue: '使用本地语音识别' })}
          subtitle={localSttEnabled
            ? t('settings.localSttOn', { defaultValue: '录音优先用本地 Whisper 转写' })
            : t('settings.localSttOff', { defaultValue: '录音使用云端 Whisper 转写' })}
          right={
            <Switch
              checked={localSttEnabled}
              onCheckedChange={setLocalSttEnabled}
            />
          }
        />
        <IosRow
          label={t('settings.localSttFallback', { defaultValue: '失败时回退云端' })}
          subtitle={t('settings.localSttFallbackHint', { defaultValue: '本地识别失败或模型未准备好时，联网状态下自动使用云端。' })}
          right={
            <Switch
              checked={localSttFallbackToCloud}
              onCheckedChange={setLocalSttFallbackToCloud}
            />
          }
        />
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
              label={t('settings.checkVersion')}
              subtitle={checking ? t(`settings.updateStages.${updateStage}`, { defaultValue: t('settings.checkingUpdate') }) : undefined}
              // subtitle={versionLoading ? '加载中...' : appVersion || 'web'}
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
            label={t('settings.version')}
            value={appVersion || 'web'}
            subtitle={t('settings.versionWeb')}
            last
          />
        )}
        <IosRow
          label={t('profile.storageManagement')}
          subtitle={t('profile.storageManagementSubtitle')}
          onTap={() => onNavigate?.('storage')}
        />
        <IosRow
          label={t('settings.syncLog')}
          subtitle={latestFailedSyncLog?.error ?? latestSyncLog?.summary ?? t('settings.noSyncRecords')}
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
            onClick={() => setShowLogoutDialog(true)}
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
                ? t('settings.deleteScheduledHint', { date: new Date(deleteScheduledAt).toLocaleString('zh-CN') })
                : deleteRequiresPassword === false
                  ? t('settings.deleteThirdParty')
                  : t('settings.deleteConfirmHint')}
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
                {t('settings.deleteStillUsable')}
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
                {t('settings.deleteFinalConfirm')}
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
                {t('settings.cancelDeleteBtn')}
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

      <Dialog open={showLogoutDialog} onOpenChange={(open) => { if (!logoutLoading) setShowLogoutDialog(open) }}>
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t('profile.logout')}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              {t('profile.logoutConfirmHint')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 space-x-0">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setShowLogoutDialog(false)}
              disabled={logoutLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 sm:flex-none"
              onClick={handleConfirmLogout}
              disabled={logoutLoading}
            >
              {logoutLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {logoutLoading ? t('profile.loggingOut') : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SyncLogDialog open={syncLogsOpen} onOpenChange={setSyncLogsOpen} />
    </div>
  )
}
