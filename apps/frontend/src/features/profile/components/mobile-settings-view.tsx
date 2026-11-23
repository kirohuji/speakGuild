import { showRequestError } from '@/lib/request-feedback'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronRight, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/providers/auth-provider'
import { PRACTICE_BATCH_OPTIONS, usePreferencesStore } from '@/stores/preferences.store'
import { useConfigStore } from '@/stores/config.store'
import { useOfflineSyncStore } from '@/stores/offline-sync.store'
import { useAppUpdateStore } from '@/stores/app-update.store'
import { IosRow, IosSection } from '@/features/profile/components/ios-components'
import { AlarmTimePicker } from '@/features/profile/components/alarm-time-picker'
import { SystemDocumentDrawer } from '@/features/system/components/system-document-drawer'
import { isNative, openAppSettings, requestInAppReview } from '@/lib/native'
import { updater } from '@/lib/native'
import { scheduleLearningReminderTestNotification } from '@/lib/native/learning-reminder'
import { isNativeSpeechRecognitionAvailable } from '@/lib/native/vn-voice-input'
import { cn } from '@/lib/cn'
import type { MobileView } from '@/features/profile/components/mobile-profile-home'
import { DeleteAccountDialog } from '@/features/profile/components/delete-account-dialog'
import { SyncLogDialog } from './sync-log-dialog'

const DESKTOP_HIDDEN_LEGAL_KEYS = new Set(['permissions', 'sdk-list'])

export function MobileSettingsView({
  onNavigate,
  desktop = false,
}: {
  onNavigate?: (view: MobileView) => void
  desktop?: boolean
}) {
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
    dailyPracticeGoal,
    setDailyPracticeGoal,
    reviewBatchSize,
    setReviewBatchSize,
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [testingLearningReminder, setTestingLearningReminder] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [logoutForceConfirm, setLogoutForceConfirm] = useState(false)
  const [logoutForceReason, setLogoutForceReason] = useState<'offline' | 'sync'>('offline')
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
  // 法律文档 Drawer / Dialog 状态
  const [legalDrawer, setLegalDrawer] = useState<{ title: string; content: string } | null>(null)

  // 延迟导入 MD 内容（避免重复加载）
  const [mdContents, setMdContents] = useState<Record<string, string>>({})

  // useEffect(() => {
  //   let cancelled = false
  //   isNativeSpeechRecognitionAvailable('en-US')
  //     .then((available) => {
  //       if (!cancelled) setNativeSpeechRecognitionAvailable(available)
  //     })
  //     .catch(() => {
  //       if (!cancelled) setNativeSpeechRecognitionAvailable(false)
  //     })
  //   return () => {
  //     cancelled = true
  //   }
  // }, [])

  const handleRequestReview = async () => {
    try {
      const result = await requestInAppReview()
      if (!result.requested) {
        toast.message(t('profile.rateUnavailable'))
      }
    } catch (error: any) {
      showRequestError(error, t('profile.rateFailed'))
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
      showRequestError(error, t('settings.reminderFailed'))
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
      showRequestError(error, t('settings.testReminderSendFailed'))
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

  const legalDocList = Object.entries(legalDocKeyToTKey)
    .filter(([key]) => !(desktop && DESKTOP_HIDDEN_LEGAL_KEYS.has(key)))
    .map(([key, tKey]) => ({
      key,
      label: t(tKey),
    }))

  const handleOpenAppPermissions = async () => {
    try {
      const opened = await openAppSettings()
      if (!opened) toast.error(t('settings.openAppSettingsFailed'))
    } catch (error) {
      console.warn('[settings] Failed to open app settings', error)
      toast.error(t('settings.openAppSettingsFailed'))
    }
  }
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
    } catch (error) {
      showRequestError(error, t('settings.checkUpdateFailed'))
    } finally {
      finishNoUpdate()
    }
  }

  const handleConfirmLogout = async () => {
    if (logoutLoading) return
    setLogoutLoading(true)
    try {
      await signOut(logoutForceConfirm ? { forceOffline: true } : undefined)
      setShowLogoutDialog(false)
      setLogoutForceConfirm(false)
      navigate('/auth/login')
    } catch (error: any) {
      const message = String(error?.message ?? '')
      if (!logoutForceConfirm && (
        message.includes('练习数据尚未同步')
        || message.includes('未能同步')
        || message.includes('could not sync')
        || message.includes('同期できない')
      )) {
        setLogoutForceReason('sync')
        setLogoutForceConfirm(true)
        return
      }
      showRequestError(error, t('profile.logoutFailed', { defaultValue: '退出登录失败，请重试' }))
    } finally {
      setLogoutLoading(false)
    }
  }

  const notifyTodayRunSettingSaved = () => {
    toast.success(t('profile.todayRunSettingNextRun'))
  }

  const handleDailyPracticeGoalChange = (value: number) => {
    if (value === dailyPracticeGoal) return
    setDailyPracticeGoal(value)
    notifyTodayRunSettingSaved()
  }

  const handleReviewBatchSizeChange = (value: number) => {
    if (value === reviewBatchSize) return
    setReviewBatchSize(value)
    notifyTodayRunSettingSaved()
  }

  return (
    <div className="space-y-5">
      <IosSection>
        <IosRow
          label={t('profile.dailyGoal')}
          subtitle={t(`profile.dailyGoal${dailyPracticeGoal}`)}
          right={
            <div className="flex rounded-full bg-muted p-0.5">
              {PRACTICE_BATCH_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleDailyPracticeGoalChange(value)}
                  className={cn(
                    'h-7 min-w-9 rounded-full px-2 text-xs font-medium transition-colors',
                    dailyPracticeGoal === value
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
          label={t('profile.reviewBatchSize')}
          subtitle={t('profile.reviewBatchSizeValue', { count: reviewBatchSize })}
          right={
            <div className="flex rounded-full bg-muted p-0.5">
              {PRACTICE_BATCH_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleReviewBatchSizeChange(value)}
                  className={cn(
                    'h-7 min-w-9 rounded-full px-2 text-xs font-medium transition-colors',
                    reviewBatchSize === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
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
          last={desktop}
          right={
            <Switch
              checked={dailyPracticeRandomOrder}
              onCheckedChange={setDailyPracticeRandomOrder}
            />
          }
        />
        {!desktop && isAdmin && (
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
        {!desktop && (
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
        )}
        {!desktop && learningReminderEnabled && (
          <IosRow
            label={t('settings.reminderTime')}
            right={
              <AlarmTimePicker
                value={learningReminderTime}
                onChange={handleLearningReminderTimeChange}
              />
            }
          />
        )}
        {!desktop && (
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
        )}
        {!desktop && localSttEnabled && (
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
        )}
        {!desktop && (
          <IosRow
            label={t('profile.wifiOnlyLabel')}
            last
            right={<Switch checked={wifiOnlyMedia} onCheckedChange={setWifiOnlyMedia} />}
          />
        )}
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

      {desktop ? (
        <IosSection>
          <IosRow
            label={t('profile.deleteAccount')}
            last
            onTap={() => setShowDeleteDialog(true)}
          />
        </IosSection>
      ) : (
        <IosSection>
          {isNative() && (
            <>
              <IosRow
                label={t('settings.checkVersion')}
                subtitle={checking ? t(`settings.updateStages.${updateStage}`, { defaultValue: t('settings.checkingUpdate') }) : undefined}
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
          {isNative() && (
            <IosRow
              label={t('profile.appPermissions')}
              onTap={handleOpenAppPermissions}
            />
          )}
          <IosRow
            label={t('profile.deleteAccount')}
            last
            onTap={() => setShowDeleteDialog(true)}
          />
        </IosSection>
      )}

      {!desktop && (
        <IosSection>
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={() => {
                const offline = !navigator.onLine
                setLogoutForceReason(offline ? 'offline' : 'sync')
                setLogoutForceConfirm(offline)
                setShowLogoutDialog(true)
              }}
              className="w-full text-center text-sm font-medium text-red-500"
            >
              {t('profile.logout')}
            </button>
          </div>
        </IosSection>
      )}

      {/* 法律文档全屏 Drawer */}
      {legalDrawer && (
        <SystemDocumentDrawer
          open={legalDrawer !== null}
          onClose={() => setLegalDrawer(null)}
          title={legalDrawer.title}
          content={legalDrawer.content}
        />
      )}

      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />

      {!desktop && (
        <Dialog open={showLogoutDialog} onOpenChange={(open) => {
          if (logoutLoading) return
          setShowLogoutDialog(open)
          if (!open) setLogoutForceConfirm(false)
        }}>
          <DialogContent
            className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{t('profile.logout')}</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                {logoutForceConfirm
                  ? (logoutForceReason === 'sync'
                    ? t('learningNotebooks.syncLogoutConfirm')
                    : t('learningNotebooks.offlineLogoutConfirm'))
                  : t('profile.logoutConfirmHint')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row justify-end gap-2 space-x-0 border-t border-border/60 bg-muted/10 -mx-5 -mb-5 mt-2 px-5 py-4 sm:rounded-b-2xl">
              <Button
                variant="secondary"
                className="flex-1 border-0 shadow-none sm:flex-none"
                onClick={() => { setShowLogoutDialog(false); setLogoutForceConfirm(false) }}
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
      )}

      {!desktop && <SyncLogDialog open={syncLogsOpen} onOpenChange={setSyncLogsOpen} />}
    </div>
  )
}
