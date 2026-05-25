import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUpWithEmailPassword } from '@/features/auth/api'
import { cn } from '@/lib/cn'

export function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const validate = () => {
    if (!name.trim()) { setMessage('请输入用户名'); return false }
    if (!email.trim()) { setMessage('请输入邮箱'); return false }
    if (password.length < 8) { setMessage('密码至少8位'); return false }
    if (password !== confirmPassword) { setMessage('两次密码不一致'); return false }
    return true
  }

  const onRegister = async () => {
    if (!validate()) return
    try {
      setLoading(true)
      setMessage('')
      await signUpWithEmailPassword(email, password, name.trim())
      setMessage('注册成功，正在跳转个人中心')
      setTimeout(() => navigate('/profile'), 1200)
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const strengthColor = (p: string) => {
    if (p.length < 8) return 'bg-red-400'
    if (p.length < 12) return 'bg-yellow-400'
    return 'bg-green-400'
  }

  const strengthLabel = (p: string) => {
    if (p.length === 0) return null
    if (p.length < 8) return '弱'
    if (p.length < 12) return '中'
    return '强'
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-6 md:py-8">
      {/* 品牌标题区 */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">创建账号</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          已有账号？
          <Link to="/auth/login" className="ml-1 text-primary hover:underline font-medium">
            去登录
          </Link>
        </p>
      </div>

      {/* 居中窄卡片 */}
      <div className="w-full max-w-sm">
        <Card className="shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)]">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm">用户名</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的显示名称"
                className="h-10"
                autoComplete="name"
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">将显示在你的个人中心和练习记录中</p>
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

            <div className="space-y-1.5">
              <Label className="text-sm">密码</Label>
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
                    {strengthLabel(password)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">确认密码</Label>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                placeholder="再次输入密码"
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '立即注册'}
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
              注册即表示同意
              <Link to="/terms" className="text-primary hover:underline">服务条款</Link>
              和
              <Link to="/privacy" className="text-primary hover:underline">隐私政策</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}