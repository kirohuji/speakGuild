import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  sendEmailOtp,
  sendPhoneOtp,
  signInWithEmailOtp,
  signInWithWechat,
  verifyPhoneOtp,
} from '@/features/auth/api'
import { cn } from '@/lib/cn'
import { useAuth } from '@/providers/auth-provider'

type AuthTab = 'password' | 'email-otp' | 'phone-otp'

function getLoginErrorMessage(error: any): string {
  const rawMessage =
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    ''

  const message = String(rawMessage).toLowerCase()

  if (!message) return '登录失败，请稍后重试'
  if (message.includes('invalid email') || message.includes('password')) return '邮箱或密码错误'
  if (message.includes('otp') || message.includes('verification code')) return '验证码错误或已过期'
  if (message.includes('user not found')) return '账号不存在'
  if (message.includes('too many requests') || message.includes('rate limit')) return '请求过于频繁，请稍后再试'
  if (message.includes('network') || message.includes('failed to fetch')) return '网络异常，请检查网络后重试'
  if (message.includes('email')) return '邮箱格式不正确'

  return rawMessage || '登录失败，请稍后重试'
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, refreshSession } = useAuth()
  const [activeTab, setActiveTab] = useState<AuthTab>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpsent, setOtpsent] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [message, setMessage] = useState('')
  const fromPath = (location.state as { from?: string } | null)?.from

  const navigateAfterLogin = () => {
    navigate(fromPath || '/profile', { replace: true })
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
      setMessage(getLoginErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmailOtp = async () => {
    if (!email) { setMessage('请先输入邮箱'); return }
    await runAction(
      () => sendEmailOtp(email),
      '验证码已发送（开发环境请看后端日志）',
      () => setOtpsent(true),
    )
  }

  const handleSendPhoneOtp = async () => {
    if (!phoneNumber) { setMessage('请先输入手机号'); return }
    await runAction(
      () => sendPhoneOtp(phoneNumber),
      '验证码已发送（开发环境请看后端日志）',
      () => setPhoneOtpSent(true),
    )
  }

  const tabButtonClass = (tab: AuthTab) =>
    cn(
      'flex-1 h-9 text-sm font-medium rounded-md transition-all duration-200',
      activeTab === tab
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
    )

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-6 md:py-8">
      {/* 品牌 Logo 区 */}
      <div className="mb-8 text-center">
        <img
          src="/logo.png"
          alt="GuideReady 导游说"
          className="h-8 w-auto mx-auto mb-3 dark:invert"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          还没有账号？
          <Link to="/auth/register" className="ml-1 text-primary hover:underline font-medium">
            立即注册
          </Link>
        </p>
      </div>

      {/* 居中窄卡片 */}
      <div className="w-full max-w-sm">
        <Card className="shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)]">
          <CardContent className="p-6 space-y-5">
            {/* Tab 切换 */}
            <div className="flex rounded-lg bg-muted/60 p-1">
              <button type="button" onClick={() => setActiveTab('password')} className={tabButtonClass('password')}>
                密码登录
              </button>
              <button type="button" onClick={() => setActiveTab('email-otp')} className={tabButtonClass('email-otp')}>
                邮箱
              </button>
              <button type="button" onClick={() => setActiveTab('phone-otp')} className={tabButtonClass('phone-otp')}>
                手机
              </button>
            </div>

            {/* 密码登录 */}
            {activeTab === 'password' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">邮箱</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">密码</Label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="请输入密码"
                    className="h-10"
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  size="primary-lg"
                  className="w-full"
                  disabled={loading}
                  onClick={() =>
                    runAction(
                      async () => {
                        if (!email.trim()) throw new Error('请输入邮箱')
                        if (!password) throw new Error('请输入密码')
                        await signIn(email, password)
                      },
                      '登录成功，即将跳转',
                      navigateAfterLogin,
                    )
                  }
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '登录'}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <Link to="/auth/forgot-password" className="text-muted-foreground hover:text-primary transition-colors">
                    忘记密码？
                  </Link>
                  <Link to="/auth/register" className="text-muted-foreground hover:text-primary transition-colors">
                    注册账号
                  </Link>
                </div>
              </div>
            )}

            {/* 邮箱验证码登录 */}
            {activeTab === 'email-otp' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">邮箱</Label>
                  <Input
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setOtpsent(false) }}
                    placeholder="you@example.com"
                    className="h-10"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value)}
                      placeholder="6位验证码"
                      className="h-10 flex-1"
                      maxLength={6}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 shrink-0 px-3"
                      disabled={loading || otpsent}
                      onClick={handleSendEmailOtp}
                    >
                      {otpsent ? '已发' : '获取'}
                    </Button>
                  </div>
                </div>
                <Button
                  size="primary-lg"
                  className="w-full"
                  disabled={loading || !otpsent || !emailOtp}
                  onClick={() =>
                    runAction(
                      async () => {
                        if (!email.trim()) throw new Error('请输入邮箱')
                        if (!emailOtp.trim()) throw new Error('请输入验证码')
                        await signInWithEmailOtp(email, emailOtp)
                        const nextSession = await refreshSession()
                        if (!nextSession?.user?.id) {
                          throw new Error('登录失败，请检查验证码后重试')
                        }
                      },
                      '登录成功，即将跳转',
                      navigateAfterLogin,
                    )
                  }
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '验证并登录'}
                </Button>
              </div>
            )}

            {/* 手机验证码登录 */}
            {activeTab === 'phone-otp' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">手机号</Label>
                  <Input
                    value={phoneNumber}
                    onChange={(e) => { setPhoneNumber(e.target.value); setPhoneOtpSent(false) }}
                    placeholder="+8613800000000"
                    className="h-10"
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value)}
                      placeholder="6位验证码"
                      className="h-10 flex-1"
                      maxLength={6}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 shrink-0 px-3"
                      disabled={loading || phoneOtpSent}
                      onClick={handleSendPhoneOtp}
                    >
                      {phoneOtpSent ? '已发' : '获取'}
                    </Button>
                  </div>
                </div>
                <Button
                  size="primary-lg"
                  className="w-full"
                  disabled={loading || !phoneOtpSent || !phoneOtp}
                  onClick={() =>
                    runAction(
                      async () => {
                        if (!phoneNumber.trim()) throw new Error('请输入手机号')
                        if (!phoneOtp.trim()) throw new Error('请输入验证码')
                        await verifyPhoneOtp(phoneNumber, phoneOtp)
                        const nextSession = await refreshSession()
                        if (!nextSession?.user?.id) {
                          throw new Error('登录失败，请检查验证码后重试')
                        }
                      },
                      '登录成功，即将跳转',
                      navigateAfterLogin,
                    )
                  }
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '验证并登录'}
                </Button>
              </div>
            )}

            {/* 分割线 + 微信登录 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs text-muted-foreground">其他登录方式</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="primary-lg"
              className="w-full gap-2"
              disabled={loading}
              onClick={() =>
                runAction(
                  async () => {
                    await signInWithWechat()
                    await refreshSession()
                  },
                  '正在跳转微信登录',
                )
              }
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M8.5 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm7 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM12 2C6.48 2 2 6.03 2 11c0 2.76 1.36 5.22 3.57 6.87L2 20l3.89-2.14A9.36 9.36 0 0012 22c5.52 0 10-4.03 10-9S17.52 2 12 2z" />
              </svg>
              微信登录
            </Button>

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

        <p className="mt-4 text-center text-xs text-muted-foreground">
          登录即表示同意
          <Link to="/terms" className="text-primary hover:underline mx-1">服务条款</Link>
          和
          <Link to="/privacy" className="text-primary hover:underline mx-1">隐私政策</Link>
        </p>
      </div>
    </div>
  )
}