import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { updateUserProfile } from '@/features/profile/api'

export function NicknameEditDialog({
  open,
  onOpenChange,
  currentName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onSaved: (name: string) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(currentName)
  }, [currentName, open])

  const handleSave = async () => {
    if (!name.trim() || name.trim() === currentName) {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await updateUserProfile({ name: name.trim() })
      onSaved(name.trim())
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      onOpenChange(false)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border-0 p-5 shadow-none sm:p-6"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('profile.editNicknameTitle')}</DialogTitle>
          <DialogDescription>{t('profile.nicknameDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('profile.nicknamePlaceholder')}
            maxLength={20}
            className="border-0 bg-muted/45 shadow-none"
          />
          <p className="text-right text-xs text-muted-foreground">{name.length}/20</p>
        </div>
        <DialogFooter className="flex-row justify-between gap-3 sm:justify-between sm:space-x-0">
          <Button variant="secondary" className="min-w-0 flex-1 border-0 shadow-none" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button className="min-w-0 flex-1" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
