import { useState } from 'react'
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
import { claimPromoTrial, signUpWithEmailPassword } from '@/features/auth/api'
import { applyReferral } from '@/features/referral/api'
import { cn } from '@/lib/cn'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const initialReferralCode = new URLSearchParams(location.search).get('ref')?.trim().toUpperCase() || ''
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showReferralInput, setShowReferralInput] = useState(Boolean(initialReferralCode))
  const [referralInput, setReferralInput] = useState(initialReferralCode)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const referralCode = referralInput.trim().toUpperCase()

  const validate = () => {
    if (!name.trim()) { setMessage(t('auth.enterName')); return false }
    if (!email.trim()) { setMessage(t('auth.enterEmail')); return false }
    if (password.length < 8) { setMessage(t('auth.passwordMinLength')); return false }
    if (password !== confirmPassword) { setMessage(t('auth.passwordMismatch')); return false }
    return true
  }

  const onRegister = async () => {
    if (!validate()) return
    try {
      setLoading(true)
      setMessage('')
      await signUpWithEmailPassword(email, password, name.trim())
      const grants: string[] = []
      const promoResult = await claimPromoTrial().catch(() => null)
      if (promoResult?.granted && promoResult.days) {
        grants.push(t('auth.newUserDays', { days: promoResult.days }))
      }
      if (referralCode) {
        await applyReferral(referralCode).catch(() => null)
      }
      setMessage(grants.length > 0 ? t('auth.registerSuccessWithGrant', { grants: grants.join('、') }) : t('auth.registerSuccess'))
      setTimeout(() => navigate('/profile'), 1200)
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || t('auth.registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  const strengthColor = (p: string) => {
    if (p.length < 8) return 'bg-destructive'
    if (p.length < 12) return 'bg-warning'
    return 'bg-success'
  }

  const strengthLabel = (p: string, t: (key: string) => string) => {
    if (p.length === 0) return null
    if (p.length < 8) return t('auth.passwordStrength.weak')
    if (p.length < 12) return t('auth.passwordStrength.medium')
    return t('auth.passwordStrength.strong')
  }

  return (
    <AuthPageShell
      backLabel={t('auth.backToLogin')}
      onBack={() => navigate('/auth/login')}
      footer={(
        <p>
          {t('auth.hasAccount')}
          <Link to="/auth/login" className="ml-1 font-semibold text-primary hover:underline">
            {t('auth.goLogin')}
          </Link>
        </p>
      )}
    >
      <div className="space-y-4">
            <div className="flex flex-col gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
              <button
                type="button"
                onClick={() => setShowReferralInput((current) => !current)}
                className="flex items-center justify-between text-left text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5" />
                  {referralCode ? `${t('auth.inviteCode')} ${referralCode}` : t('auth.inviteCodePlaceholder')}
                </span>
                <span>{showReferralInput ? t('auth.collapse') : t('auth.fill')}</span>
              </button>
              {showReferralInput && (
                <>
                  <Input
                    value={referralInput}
                    onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                    placeholder={t('auth.friendInviteCode')}
                    className={cn(authInputClassName, 'h-10 bg-background/80 text-sm uppercase')}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={16}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t('auth.inviteHint')}
                  </p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className={authLabelClassName}>{t('auth.userName')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.displayNameHint')}
                className={authInputClassName}
                autoComplete="name"
                maxLength={30}
              />
            </div>

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

            <div className="space-y-1.5">
              <Label className={authLabelClassName}>{t('auth.passwordPlaceholder')}</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={t('auth.passwordMinLengthHint')}
                className={authInputClassName}
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="flex items-center gap-2 px-0.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full transition-all duration-300', strengthColor(password))} style={{ width: `${Math.min(100, (password.length / 16) * 100)}%` }} />
                  </div>
                  <span className={cn('text-xs font-medium', password.length < 8 ? 'text-destructive' : password.length < 12 ? 'text-warning' : 'text-success')}>
                    {strengthLabel(password, t)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className={authLabelClassName}>{t('auth.confirmPassword')}</Label>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                placeholder={t('auth.confirmPasswordHint')}
                className={authInputClassName}
                autoComplete="new-password"
              />
            </div>

            <Button
              size="primary-lg"
              className="btn-cta w-full"
              disabled={loading}
              onClick={onRegister}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.registerButton')}
            </Button>

            {message && (
              <p className={cn(
                'rounded-xl px-4 py-3 text-center text-sm',
                message.includes('成功') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
              )}>
                {message}
              </p>
            )}

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              {t('auth.agreeToTerms')}
              <Link to="/system/terms" className="mx-1 font-medium text-primary hover:underline">{t('auth.termsOfService')}</Link>
              {t('auth.and')}
              <Link to="/system/privacy" className="mx-1 font-medium text-primary hover:underline">{t('auth.privacyPolicy')}</Link>
            </p>
      </div>
    </AuthPageShell>
  )
}
