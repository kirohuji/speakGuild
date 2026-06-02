import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AuthPageShell,
  authInputClassName,
  authLabelClassName,
} from '@/features/auth/components/auth-page-shell'
import {
  sendPhoneOtp,
  signInWithWechat,
  signInWithApple,
  verifyPhoneOtp,
} from '@/features/auth/api'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'

type LoginMode = 'password' | 'phone-otp'

function getLoginErrorMessage(error: any, t: (key: string) => string): string {
  const rawMessage =
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    ''

  const message = String(rawMessage).toLowerCase()

  if (!message) return t('auth.loginFailed')
  if (message.includes('invalid email') || message.includes('password')) return t('auth.invalidCredentials')
  if (message.includes('otp') || message.includes('verification code')) return t('auth.invalidOtp')
  if (message.includes('user not found')) return t('auth.userNotFound')
  if (message.includes('too many requests') || message.includes('rate limit')) return t('auth.rateLimit')
  if (message.includes('network') || message.includes('failed to fetch')) return t('auth.networkError')
  if (message.includes('email')) return t('auth.invalidEmail')

  return rawMessage || t('auth.loginFailed')
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, refreshSession } = useAuth()
  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [message, setMessage] = useState('')
  const fromPath = (location.state as { from?: string } | null)?.from

  const navigateAfterLogin = () => {
    navigate(fromPath || '/', { replace: true })
  }

  const runAction = async (
    task: () => Promise<any>,
    successMessage: string,
    onSuccess?: () => void,
  ) => {
    try {
      setLoading(true)
      setMessage('')
      await task()
      setMessage(successMessage)
      if (onSuccess) onSuccess()
    } catch (error: any) {
      setMessage(getLoginErrorMessage(error, t))
    } finally {
      setLoading(false)
    }
  }

  const handleSendPhoneOtp = async () => {
    if (!phoneNumber) { setMessage(t('auth.enterPhone')); return }
    await runAction(
      () => sendPhoneOtp(phoneNumber),
      t('auth.otpSent'),
      () => setPhoneOtpSent(true),
    )
  }

  return (
    <AuthPageShell
      footer={(
        <>
          登录即表示同意
          <Link to="/system/terms" className="mx-1 font-medium text-primary hover:underline">服务条款</Link>
          和
          <Link to="/system/privacy" className="mx-1 font-medium text-primary hover:underline">隐私政策</Link>
        </>
      )}
    >
      <div className="space-y-4">
        {/* 密码登录 */}
        {mode === 'password' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className={authLabelClassName}>{t('auth.emailPlaceholder')}</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={authInputClassName}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={authLabelClassName}>{t('auth.passwordPlaceholder')}</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={t('auth.enterPassword')}
                className={authInputClassName}
                autoComplete="current-password"
              />
            </div>
            <Button
              size="primary-lg"
              className="btn-cta w-full"
              disabled={loading}
              onClick={() =>
                runAction(
                  async () => {
                    if (!email.trim()) throw new Error(t('auth.enterEmail'))
                    if (!password) throw new Error(t('auth.enterPassword'))
                    await signIn(email, password)
                  },
                  t('auth.loginSuccess'),
                  navigateAfterLogin,
                )
              }
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.loginButton')}
            </Button>

            <div className="text-right text-xs">
              <Link to="/auth/forgot-password" className="text-muted-foreground hover:text-primary transition-colors">
                {t('auth.forgotPasswordHint')}
              </Link>
            </div>
          </div>
        )}

        {/* 手机验证码登录 */}
        {mode === 'phone-otp' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className={authLabelClassName}>{t('auth.phoneNumber')}</Label>
              <Input
                value={phoneNumber}
                onChange={(e) => { setPhoneNumber(e.target.value); setPhoneOtpSent(false) }}
                placeholder="+8613800000000"
                className={authInputClassName}
                autoComplete="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={authLabelClassName}>{t('auth.verificationCode')}</Label>
              <div className="flex gap-2">
                <Input
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value)}
                  placeholder={t('auth.otpPlaceholder')}
                  className={cn(authInputClassName, 'flex-1')}
                  maxLength={6}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 shrink-0 rounded-xl px-3"
                  disabled={loading || phoneOtpSent}
                  onClick={handleSendPhoneOtp}
                >
                  {phoneOtpSent ? t('auth.sent') : t('auth.getOtp')}
                </Button>
              </div>
            </div>
            <Button
              size="primary-lg"
              className="btn-cta w-full"
              disabled={loading || !phoneOtpSent || !phoneOtp}
              onClick={() =>
                runAction(
                  async () => {
                    if (!phoneNumber.trim()) throw new Error(t('auth.enterPhone'))
                    if (!phoneOtp.trim()) throw new Error(t('auth.enterOtp'))
                    await verifyPhoneOtp(phoneNumber, phoneOtp)
                    const nextSession = await refreshSession()
                    if (!nextSession?.user?.id) {
                      throw new Error(t('auth.loginFailedOtp'))
                    }
                  },
                  t('auth.loginSuccess'),
                  navigateAfterLogin,
                )
              }
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.verifyAndLogin')}
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setMode((current) => current === 'password' ? 'phone-otp' : 'password')
            setMessage('')
          }}
          className="w-full text-center text-xs font-medium text-primary transition-colors hover:text-primary/75"
        >
          {mode === 'password'
            ? `${t('auth.phone')}${t('auth.verificationCode')}${t('auth.login')}`
            : t('auth.passwordLogin')}
        </button>

        {/* 分割线 + 微信登录 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">{t('auth.otherLogin')}</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="primary-lg"
          className="h-11 w-full gap-2 rounded-xl bg-background/60"
          disabled={loading}
          onClick={() =>
            runAction(
              async () => {
                await signInWithWechat()
                const nextSession = await refreshSession()
                if (nextSession?.user?.id) {
                  navigateAfterLogin()
                }
              },
              '正在跳转微信登录',
            )
          }
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M8.5 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm7 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM12 2C6.48 2 2 6.03 2 11c0 2.76 1.36 5.22 3.57 6.87L2 20l3.89-2.14A9.36 9.36 0 0012 22c5.52 0 10-4.03 10-9S17.52 2 12 2z" />
          </svg>
          {t('auth.wechatLogin')}
        </Button>

        <Button
          variant="outline"
          size="primary-lg"
          className="h-11 w-full gap-2 rounded-xl bg-background/60"
          disabled={loading}
          onClick={() =>
            runAction(
              async () => {
                await signInWithApple()
                const nextSession = await refreshSession()
                if (nextSession?.user?.id) {
                  navigateAfterLogin()
                }
              },
              '正在跳转 Apple 登录',
            )
          }
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          {t('auth.appleLogin')}
        </Button>

        {message && (
          <p className={cn(
            'rounded-xl px-3 py-2 text-center text-xs',
            message.includes(t('auth.success')) ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
          )}>
            {message}
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground">
          {t('auth.noAccount')}
          <Link to="/auth/register" className="ml-1 font-semibold text-primary hover:underline">
            {t('auth.goRegister')}
          </Link>
        </p>
      </div>
    </AuthPageShell>
  )
}
