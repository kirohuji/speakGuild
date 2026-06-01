import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AuthPageShell,
  authInputClassName,
  authLabelClassName,
} from '@/features/auth/components/auth-page-shell'
import { sendForgotPasswordOtp } from '@/features/auth/api'
import { cn } from '@/lib/cn'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setMessage(t('auth.enterEmailFirst'))
      return
    }
    try {
      setLoading(true)
      setMessage('')
      await sendForgotPasswordOtp(email)
      setSent(true)
      setMessage(t('auth.otpSent'))
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || t('auth.sendFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setMessage(t('auth.otpLengthHint'))
      return
    }
    if (newPassword.length < 8) {
      setMessage(t('auth.passwordMinLengthHint'))
      return
    }

    try {
      setLoading(true)
      setMessage('')
      const { resetPasswordByOtp: resetApi } = await import('@/features/auth/api')
      await resetApi(email, otp, newPassword)
      setMessage(t('auth.resetSuccess'))
      setTimeout(() => navigate('/auth/login'), 1500)
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || t('auth.resetFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthPageShell
        description={t('auth.otpSentHint')}
        backLabel={t('auth.backToLogin')}
        onBack={() => navigate('/auth/login')}
      >
        <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={authLabelClassName}>{t('auth.emailPlaceholder')}</Label>
                <Input value={email} disabled className={cn(authInputClassName, 'opacity-60')} />
              </div>

              <div className="space-y-1.5">
                <Label className={authLabelClassName}>{t('auth.enterOtp')}</Label>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('auth.otpPlaceholder')}
                  className={authInputClassName}
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>

              <div className="space-y-1.5">
                <Label className={authLabelClassName}>{t('auth.newPassword')}</Label>
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  placeholder={t('auth.passwordMinLengthHint')}
                  className={authInputClassName}
                  autoComplete="new-password"
                />
              </div>

              <Button
                size="primary-lg"
                className="btn-cta w-full"
                disabled={loading}
                onClick={handleReset}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.resetPassword')}
              </Button>

              <button
                type="button"
                onClick={() => setSent(false)}
                className="w-full rounded-xl py-1 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                重新发送验证码
              </button>

              {message && (
                <p className={cn(
                  'rounded-xl px-4 py-3 text-center text-sm',
                  message.includes('成功') ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
                )}>
                  {message}
                </p>
              )}
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      description={t('auth.enterEmailFirst')}
      backLabel={t('auth.backToLogin')}
      onBack={() => navigate('/auth/login')}
      footer={(
        <div>
          记起密码了？
          <Link to="/auth/login" className="ml-1 font-semibold text-primary hover:underline">
            {t('auth.goLogin')}
          </Link>
        </div>
      )}
    >
      <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className={authLabelClassName}>{t('auth.emailPlaceholder')}</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={authInputClassName}
                autoComplete="email"
                type="email"
              />
            </div>

            <Button
              size="primary-lg"
              className="btn-cta w-full"
              disabled={loading}
              onClick={handleSendOtp}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.sendOtp')}
            </Button>

            {message && (
              <p className={cn(
                'rounded-xl px-4 py-3 text-center text-sm',
                message.includes('发送') || message.includes('成功') ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
              )}>
                {message}
              </p>
            )}
      </div>
    </AuthPageShell>
  )
}
