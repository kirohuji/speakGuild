import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Loader2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AuthPageShell,
  authLabelClassName,
} from '@/features/auth/components/auth-page-shell'
import { submitTestflightRequest } from '@/features/feedback/api'
import { cn } from '@/lib/cn'

const TESTFLIGHT_APP_URL = 'https://apps.apple.com/app/testflight/id899247664'

const fieldClassName =
  'h-11 rounded-xl border-0 bg-background px-3.5 shadow-none focus-visible:ring-2 focus-visible:ring-ring'

export function TestflightPage() {
  const { t } = useTranslation()
  const [appleId, setAppleId] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const onSubmit = async () => {
    const value = appleId.trim()
    if (!value) {
      setSuccess(false)
      setMessage(t('testflight.enterAppleId'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setSuccess(false)
      setMessage(t('testflight.invalidAppleId'))
      return
    }

    setLoading(true)
    setMessage('')
    try {
      await submitTestflightRequest({
        appleId: value,
        note: note.trim() || undefined,
      })
      setSubmitted(true)
      setSuccess(true)
      setMessage(t('testflight.submitSuccess'))
    } catch (error: any) {
      setSuccess(false)
      setMessage(error?.response?.data?.message || error?.message || t('testflight.submitFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      description={t('testflight.description')}
      footer={(
        <p className="text-muted-foreground">
          {t('testflight.footerHint')}
        </p>
      )}
    >
      {submitted ? (
        <div className="flex flex-col gap-3 py-4 text-center">
          <p className="text-base font-semibold text-foreground">{t('testflight.submitSuccessTitle')}</p>
          <p className="text-xs leading-5 text-muted-foreground">{t('testflight.submitSuccessHint')}</p>
          <a
            href={TESTFLIGHT_APP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            {t('testflight.openTestflight')}
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-background/70 px-3.5 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Smartphone className="size-4 text-primary" />
              {t('testflight.stepDownloadTitle')}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {t('testflight.stepDownloadBody')}
            </p>
            <Button
              asChild
              variant="ghost"
              className="mt-2 h-9 px-0 text-primary hover:bg-transparent hover:text-primary"
            >
              <a href={TESTFLIGHT_APP_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" data-icon="inline-start" />
                {t('testflight.openTestflight')}
              </a>
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className={authLabelClassName}>{t('testflight.appleId')}</Label>
            <Input
              value={appleId}
              onChange={(e) => setAppleId(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder={t('testflight.appleIdPlaceholder')}
              className={fieldClassName}
            />
            <p className="px-0.5 text-[11px] leading-4 text-muted-foreground">
              {t('testflight.appleIdHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className={authLabelClassName}>{t('testflight.noteOptional')}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('testflight.notePlaceholder')}
              className="min-h-[88px] rounded-xl border-0 bg-background px-3.5 py-2.5 shadow-none focus-visible:ring-2 focus-visible:ring-ring"
              maxLength={200}
            />
          </div>

          <Button
            size="primary-lg"
            className="btn-cta w-full shadow-none hover:shadow-none"
            disabled={loading}
            onClick={onSubmit}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : t('testflight.submit')}
          </Button>

          {message && (
            <p
              className={cn(
                'rounded-xl px-4 py-3 text-center text-sm',
                success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
              )}
            >
              {message}
            </p>
          )}
        </div>
      )}
    </AuthPageShell>
  )
}
