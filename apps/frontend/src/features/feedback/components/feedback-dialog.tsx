import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Loader2, CheckCircle2, MessageSquare, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FeedbackTypePicker } from '@/features/feedback/components/feedback-type-picker'
import { submitAnonymousFeedback, submitFeedback } from '@/features/feedback/api'
import { useAuth } from '@/providers/auth-provider'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const isLoggedIn = !!session?.user?.id
  const [email, setEmail] = useState('')
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const handleSubmit = async () => {
    if (!content.trim()) return
    if (!isLoggedIn && !email.trim()) return
    setSubmitting(true)
    try {
      if (isLoggedIn) {
        await submitFeedback({ type, content: content.trim(), contact: contact || undefined })
      } else {
        await submitAnonymousFeedback({ email: email.trim(), content: content.trim() })
      }
      setSubmitted(true)
    } finally { setSubmitting(false) }
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setSubmitted(false)
      setEmail('')
      setType('bug')
      setContent('')
      setContact('')
    }, 300)
  }

  const canSubmit = isLoggedIn
    ? content.trim() && !submitting
    : email.trim() && content.trim() && isValidEmail(email) && !submitting

  const formContent = (
    <div className="flex flex-col gap-4">
      {submitted ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-success mb-3" />
          <p className="text-lg font-medium">{t('feedback.thanks', { defaultValue: '感谢您的反馈' })}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoggedIn
              ? t('feedback.thanksLoggedIn', { defaultValue: '我们会认真查看您的反馈' })
              : t('feedback.thanksAnonymous', { defaultValue: '我们会在 3 个工作日内通过邮件回复您' })}
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={handleClose}>
            {t('common.close', { defaultValue: '关闭' })}
          </Button>
        </div>
      ) : (
        <>
          {isLoggedIn ? (
            <>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('feedback.type', { defaultValue: '反馈类型' })}</label>
                <FeedbackTypePicker value={type} onValueChange={setType} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('feedback.content', { defaultValue: '反馈内容' })} <span className="text-destructive">*</span>
                </label>
                <Textarea
                  className="min-h-[120px] resize-none"
                  placeholder={t('feedback.contentPlaceholder', { defaultValue: '请描述您的意见或遇到的问题...' })}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('feedback.contactOptional', { defaultValue: '联系方式（选填）' })}</label>
                <Input
                  placeholder={t('feedback.contactPlaceholder', { defaultValue: '邮箱或手机号，方便我们联系您' })}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('feedback.email', { defaultValue: '邮箱地址' })} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    type="email"
                    placeholder={t('feedback.emailPlaceholder', { defaultValue: '请输入您的邮箱地址，以便我们回复您' })}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('feedback.content', { defaultValue: '反馈内容' })} <span className="text-destructive">*</span>
                </label>
                <Textarea
                  className="min-h-[120px] resize-none"
                  placeholder={t('feedback.contentPlaceholder', { defaultValue: '请描述您的意见或遇到的问题...' })}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </>
          )}
          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? t('common.submitting', { defaultValue: '提交中...' }) : t('feedback.submit', { defaultValue: '提交反馈' })}
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
            {t('feedback.title', { defaultValue: '意见与反馈' })}
          </DialogTitle>
          {
            !submitted && <DialogDescription>
              {isLoggedIn
                ? t('feedback.description', { defaultValue: '请选择反馈类型并描述您的问题或建议' })
                : t('feedback.descriptionAnonymous', { defaultValue: '请留下您的邮箱和反馈内容，我们会尽快回复' })}
            </DialogDescription>
          }
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  )
}
