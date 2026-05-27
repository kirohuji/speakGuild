import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm">
          <Card className="shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)]">
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-lg font-semibold">{t('auth.otpSentTitle')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('auth.otpSentHint')}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t('auth.emailPlaceholder')}</Label>
                <Input value={email} disabled className="h-10 opacity-60" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t('auth.enterOtp')}</Label>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('auth.otpPlaceholder')}
                  className="h-10"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t('auth.newPassword')}</Label>
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  placeholder={t('auth.passwordMinLengthHint')}
                  className="h-10"
                  autoComplete="new-password"
                />
              </div>

              <Button
                size="primary-lg"
                className="w-full"
                disabled={loading}
                onClick={handleReset}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.resetPassword')}
              </Button>

              <button
                type="button"
                onClick={() => setSent(false)}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                重新发送验证码
              </button>

              {message && (
                <p className={cn(
                  'text-sm text-center rounded-lg px-4 py-3',
                  message.includes('成功') ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
                )}>
                  {message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm">
        {/* 返回按钮 */}
        <button
          type="button"
          onClick={() => navigate('/auth/login')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回登录
        </button>

        <Card className="shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)]">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold">忘记密码</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                输入注册邮箱，我们将发送验证码
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">邮箱</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-10"
                autoComplete="email"
                type="email"
              />
            </div>

            <Button
              size="primary-lg"
              className="w-full"
              disabled={loading}
              onClick={handleSendOtp}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '发送验证码'}
            </Button>

            {message && (
              <p className={cn(
                'text-sm text-center rounded-lg px-4 py-3',
                message.includes('发送') || message.includes('成功') ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
              )}>
                {message}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          记起密码了？
          <Link to="/auth/login" className="ml-1 text-primary hover:underline font-medium">
            去登录
          </Link>
        </div>
      </div>
    </div>
  )
}
