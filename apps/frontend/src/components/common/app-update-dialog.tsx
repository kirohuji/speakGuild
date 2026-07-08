import { CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppUpdateStore } from '@/stores/app-update.store'

export function AppUpdateDialog() {
  const { t } = useTranslation()
  const dialogOpen = useAppUpdateStore((s) => s.dialogOpen)
  const status = useAppUpdateStore((s) => s.status)
  const version = useAppUpdateStore((s) => s.version)
  const displayPercent = useAppUpdateStore((s) => s.displayPercent)
  const stage = useAppUpdateStore((s) => s.stage)
  const closeDialog = useAppUpdateStore((s) => s.closeDialog)
  const resetAfterRestart = useAppUpdateStore((s) => s.resetAfterRestart)
  const downloaded = status === 'ready'
  const percent = downloaded ? 100 : Math.round(displayPercent)

  const handleRestartApp = () => {
    resetAfterRestart()
    window.location.reload()
  }

  return (
    <Dialog open={dialogOpen && Boolean(version)} onOpenChange={(open) => { if (!open) closeDialog() }}>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-5 sm:p-6"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {downloaded ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Download className="h-5 w-5 text-primary" />}
            {downloaded ? t('settings.updateReady') : t('settings.newVersion')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t('settings.versionInfo', { version, downloaded: downloaded ? t('settings.downloadedDone') : t('settings.downloading') })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{downloaded ? t('settings.downloadComplete') : t(`settings.updateStages.${stage}`, { defaultValue: t('settings.downloading2') })}</span>
              <span className="text-muted-foreground">{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          {downloaded && (
            <p className="text-xs text-muted-foreground">
              {t('settings.updateDesc')}
            </p>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 space-x-0">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={closeDialog}
          >
            {downloaded ? t('settings.restartLater') : t('settings.backgroundDownload')}
          </Button>
          {downloaded && (
            <Button className="flex-1 sm:flex-none gap-1.5" onClick={handleRestartApp}>
              <RefreshCw className="h-4 w-4" />
              {t('settings.restartApp')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
