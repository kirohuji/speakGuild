import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
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
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // 处理账户删除
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError(t('profile.auth.passwordRequired'))
      return
    }
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const { deleteAccount } = await import('@/features/auth/api')
      await deleteAccount(deletePassword)
      localStorage.clear()
      window.location.hash = '#/portal'
      window.location.reload()
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || error?.message || t('profile.auth.deleteFailed'))
    } finally {
      setDeleteLoading(false)
    }
  }

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

      {/* 删除账户确认弹窗 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t('profile.deleteAccount')}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t('profile.auth.deleteAccountWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={deletePassword}
              onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
              type="password"
              placeholder={t('profile.auth.currentPasswordPlaceholder')}
              autoComplete="current-password"
            />
            {deleteError && (
              <p className="text-sm text-red-500">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleteLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
