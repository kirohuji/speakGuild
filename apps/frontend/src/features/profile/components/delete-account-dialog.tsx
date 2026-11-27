import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteRequiresPassword, setDeleteRequiresPassword] = useState<boolean | null>(null)
  const [deleteScheduledAt, setDeleteScheduledAt] = useState<string | null>(null)
  const [deleteRequirementsLoading, setDeleteRequirementsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')

  useEffect(() => {
    if (!open) return
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
  }, [open, t])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {deleteMessage && <p className="text-sm text-success">{deleteMessage}</p>}
          {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
        </div>
        <DialogFooter className="flex-row justify-end gap-2 space-x-0">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => onOpenChange(false)}
            disabled={deleteLoading}
          >
            {t('common.cancel')}
          </Button>
          {deleteScheduledAt ? (
            <Button
              className="flex-1 sm:flex-none"
              onClick={() => void handleCancelDeleteAccount()}
              disabled={deleteLoading || deleteRequirementsLoading}
            >
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('settings.cancelDeleteBtn')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              className="flex-1 sm:flex-none"
              onClick={() => void handleDeleteAccount()}
              disabled={deleteLoading || deleteRequirementsLoading || deleteRequiresPassword === null}
            >
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('common.confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
