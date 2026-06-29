import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Gift, Loader2 } from 'lucide-react'
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
import { applyReferral } from '@/features/referral/api'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'
import { useCountdown } from '@/hooks/use-countdown'
import { promptSavePassword, readSavedPassword } from '@/lib/native/save-password'

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
  const [countdown, startCountdown, resetCountdown] = useCountdown(60)
  const [otpSent, setOtpSent] = useState(false)
  const [message, setMessage] = useState('')
  const actionRunningRef = useRef(false)
  const savedPasswordReadRef = useRef(false)
  const fromPath = (location.state as { from?: string } | null)?.from
  const initialReferralCode = new URLSearchParams(location.search).get('ref')?.trim().toUpperCase() || ''
  const [showReferralInput, setShowReferralInput] = useState(Boolean(initialReferralCode))
  const [referralInput, setReferralInput] = useState(initialReferralCode)
  const referralCode = referralInput.trim().toUpperCase()
  const registerPath = `/auth/register${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ''}`

  const navigateAfterLogin = async () => {
    if (referralCode) {
      await applyReferral(referralCode).catch(() => null)
    }
    navigate(fromPath || '/', { replace: true })
  }

  const handleCredentialInputFocus = () => {
    if (savedPasswordReadRef.current) return
    savedPasswordReadRef.current = true

    readSavedPassword().then((credentials) => {
      if (!credentials) return
      setEmail((current) => current || credentials.username)
      setPassword((current) => current || credentials.password)
    })
  }

  const runAction = async (
    task: () => Promise<any>,
    successMessage: string,
    onSuccess?: () => void | Promise<void>,
  ) => {
    if (actionRunningRef.current) return
    actionRunningRef.current = true
    try {
      setLoading(true)
      setMessage('')
      await task()
      setMessage(successMessage)
      if (onSuccess) await onSuccess()
    } catch (error: any) {
      setMessage(getLoginErrorMessage(error, t))
    } finally {
      actionRunningRef.current = false
      setLoading(false)
    }
  }

  const handleSendPhoneOtp = async () => {
    if (!phoneNumber) { setMessage(t('auth.enterPhone')); return }
    await runAction(
      () => sendPhoneOtp(phoneNumber),
      t('auth.otpSent'),
      () => { startCountdown(); setOtpSent(true) },
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
                onFocus={handleCredentialInputFocus}
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
                onFocus={handleCredentialInputFocus}
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
                    const username = email.trim()
                    await signIn(username, password)
                    await promptSavePassword(username, password)
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
                onChange={(e) => { setPhoneNumber(e.target.value); resetCountdown(); setOtpSent(false) }}
                placeholder={t('auth.phonePlaceholder')}
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
                  disabled={loading || countdown > 0}
                  onClick={handleSendPhoneOtp}
                >
                  {countdown > 0 ? `${countdown}s` : t('auth.getOtp')}
                </Button>
              </div>
            </div>
            <Button
              size="primary-lg"
              className="btn-cta w-full"
              disabled={loading || !otpSent || !phoneOtp}
              onClick={() =>
                runAction(
                  async () => {
                    if (!phoneNumber.trim()) throw new Error(t('auth.enterPhone'))
                    if (!phoneOtp.trim()) throw new Error(t('auth.enterOtp'))
                    await verifyPhoneOtp(phoneNumber, phoneOtp)
                    const nextSession = await refreshSession({ revokeOtherSessions: true })
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

        <div className="flex flex-col gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setShowReferralInput((current) => !current)}
            className="flex items-center justify-between text-left text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <span className="inline-flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5" />
              {referralCode ? `邀请码 ${referralCode}` : '输入邀请码'}
            </span>
            <span>{showReferralInput ? '收起' : '填写'}</span>
          </button>
          {showReferralInput && (
            <Input
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              placeholder="好友邀请码"
              className={cn(authInputClassName, 'h-10 bg-background/80 text-sm uppercase')}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={16}
            />
          )}
        </div>

        {/* 分割线 + 第三方登录 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">{t('auth.otherLogin')}</span>
          </div>
        </div>

        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="primary-lg"
            className="h-11 min-w-0 gap-2 rounded-xl bg-background/60 px-3 text-[#07C160]"
            disabled={loading}
            onClick={() =>
              runAction(
                async () => {
                  await signInWithWechat()
                  const nextSession = await refreshSession({ revokeOtherSessions: true })
                  if (nextSession?.user?.id) {
                    await navigateAfterLogin()
                  }
                },
                t('auth.wechatRedirecting'),
              )
            }
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor">
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.883-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.11.24-.245 0-.06-.023-.12-.038-.178l-.327-1.233a.49.49 0 01.177-.554C23.025 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zM14.033 13.5c.534 0 .967.44.967.982a.974.974 0 01-.967.983.974.974 0 01-.967-.983c0-.542.433-.982.967-.982zm4.835 0c.534 0 .967.44.967.982a.974.974 0 01-.967.983.974.974 0 01-.967-.983c0-.542.433-.982.967-.982z" />
            </svg>
            {t('auth.wechatLogin')}
          </Button>

          <Button
            variant="outline"
            size="primary-lg"
            className="h-11 min-w-0 gap-2 rounded-xl bg-background/60 px-3"
            disabled={loading}
            onClick={() =>
              runAction(
                async () => {
                  await signInWithApple()
                  const nextSession = await refreshSession({ revokeOtherSessions: true })
                  if (nextSession?.user?.id) {
                    await navigateAfterLogin()
                  }
                },
                '正在跳转 Apple 登录',
              )
            }
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            {t('auth.appleLogin')}
          </Button>
        </div>

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
          <Link to={registerPath} className="ml-1 font-semibold text-primary hover:underline">
            {t('auth.goRegister')}
          </Link>
        </p>
      </div>
    </AuthPageShell>
  )
}
