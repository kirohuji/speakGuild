import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

let requestConfirmation: ((resolve: (approved: boolean) => void) => void) | null = null

/** Opens the app-level mobile-data confirmation dialog and resolves with the user's choice. */
export function confirmCellularDownload() {
  return new Promise<boolean>((resolve) => {
    if (requestConfirmation) {
      requestConfirmation(resolve)
    } else {
      resolve(false)
    }
  })
}

export function CellularDownloadConfirmDialog() {
  const { t } = useTranslation()
  const [resolveRequest, setResolveRequest] = useState<((approved: boolean) => void) | null>(null)

  useEffect(() => {
    requestConfirmation = (resolve) => setResolveRequest(() => resolve)
    return () => { requestConfirmation = null }
  }, [])

  const finish = (approved: boolean) => {
    const resolve = resolveRequest
    setResolveRequest(null)
    resolve?.(approved)
  }

  return (
    <Dialog open={Boolean(resolveRequest)} onOpenChange={(open) => { if (!open) finish(false) }}>
      <DialogContent className="w-[90vw] rounded-2xl p-6 sm:mx-auto sm:max-w-xs" onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader className="p-0 text-left">
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <WifiOff className="size-5" />
          </div>
          <DialogTitle className="text-base">{t('profile.cellularDownloadTitle', { defaultValue: '使用流量下载？' })}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-5">
            {t('profile.cellularDownloadConfirm')}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 flex gap-3">
          <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => finish(false)}>{t('common.cancel')}</Button>
          <Button type="button" className="flex-1 rounded-xl" onClick={() => finish(true)}>{t('common.confirm')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
