import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Loader2, CheckCircle2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { submitFeedback } from '@/features/feedback/api'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { t } = useTranslation()
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      await submitFeedback({ type, content, contact: contact || undefined })
      setSubmitted(true)
    } finally { setSubmitting(false) }
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setSubmitted(false)
      setContent('')
      setContact('')
      setType('bug')
    }, 300)
  }

  const typeOptions = [
    { value: 'bug', label: t('feedback.typeBug') },
    { value: 'suggestion', label: t('feedback.typeSuggestion') },
    { value: 'other', label: t('feedback.typeOther') },
  ]

  const formContent = (
    <div className="flex flex-col gap-4">
      {submitted ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-success mb-3" />
          <p className="text-lg font-medium">{t('feedback.thanks')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('feedback.processingHint')}</p>
          <Button variant="outline" size="sm" className="mt-5" onClick={handleClose}>
            {t('common.close')}
          </Button>
        </div>
      ) : (
        <>
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t('feedback.type')}</label>
            <Select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
              {typeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t('feedback.detail')}</label>
            <Textarea
              className="min-h-[120px] resize-none"
              placeholder={t('feedback.detailPlaceholder')}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t('feedback.contact')}</label>
            <Input
              placeholder={t('feedback.contactPlaceholder')}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          <Button onClick={handleSubmit} disabled={!content.trim() || submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? t('feedback.submitting') : t('feedback.submit')}
          </Button>
        </>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl p-5 sm:p-6"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('feedback.title')}
          </DialogTitle>
          <DialogDescription>{t('feedback.subtitle')}</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  )
}
