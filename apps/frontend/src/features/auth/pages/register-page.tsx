import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUpWithEmailPassword } from '@/features/auth/api'
import { cn } from '@/lib/cn'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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
      setMessage(t('auth.registerSuccess'))
      setTimeout(() => navigate('/profile'), 1200)
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || t('auth.registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  const strengthColor = (p: string) => {
    if (p.length < 8) return 'bg-red-400'
    if (p.length < 12) return 'bg-yellow-400'
    return 'bg-green-400'
  }

  const strengthLabel = (p: string, t: (key: string) => string) => {
    if (p.length === 0) return null
    if (p.length < 8) return t('auth.passwordStrength.weak')
    if (p.length < 12) return t('auth.passwordStrength.medium')
    return t('auth.passwordStrength.strong')
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-6 md:py-8">
      {/* 品牌标题区 */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t('auth.createAccount')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('auth.hasAccount')}
          <Link to="/auth/login" className="ml-1 text-primary hover:underline font-medium">
            {t('auth.goLogin')}
          </Link>
        </p>
      </div>

      {/* 居中窄卡片 */}
      <div className="w-full max-w-sm">
        <Card className="shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)]">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('auth.userName')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.displayNameHint')}
                className="h-10"
                autoComplete="name"
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">{t('auth.showInProfile')}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t('auth.emailPlaceholder')}</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-10"
                autoComplete="email"
                type="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t('auth.passwordPlaceholder')}</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="至少8位字符"
                className="h-10"
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-300', strengthColor(password))} style={{ width: `${Math.min(100, (password.length / 16) * 100)}%` }} />
                  </div>
                  <span className={cn('text-xs font-medium', password.length < 8 ? 'text-red-500' : password.length < 12 ? 'text-yellow-500' : 'text-green-600')}>
                    {strengthLabel(password, t)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t('auth.confirmPassword')}</Label>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                placeholder={t('auth.confirmPasswordHint')}
                className="h-10"
                autoComplete="new-password"
              />
            </div>

            <Button
              size="primary-lg"
              className="w-full"
              disabled={loading}
              onClick={onRegister}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.registerButton')}
            </Button>

            {message && (
              <p className={cn(
                'text-sm text-center rounded-lg px-4 py-3',
                message.includes('成功') ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
              )}>
                {message}
              </p>
            )}

            <p className="text-xs text-center text-muted-foreground leading-relaxed">
              {t('auth.agreeToTerms')}
              <Link to="/terms" className="text-primary hover:underline">{t('auth.termsOfService')}</Link>
              {t('auth.and')}
              <Link to="/privacy" className="text-primary hover:underline">{t('auth.privacyPolicy')}</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}