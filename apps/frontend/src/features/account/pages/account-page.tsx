import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Camera, User, Loader2,
  Phone, ExternalLink, KeyRound, CheckCircle2, Mail,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from '@/components/ui/drawer'
import { useAuth } from '@/providers/auth-provider'
import { useLayoutStore } from '@/stores/layout.store'
import { getUserProfile, updateUserProfile, type UserProfile } from '@/features/profile/api'
import {
  uploadFileToCosAndComplete, getCurrentAvatar, setCurrentAvatar,
} from '@/features/file-assets/api'
import {
  listLinkedAccounts, linkSocialAccount, unlinkAccount,
  type LinkedAccount,
} from '@/features/account/api'
import { changePassword, sendEmailOtp } from '@/features/auth/api'

// ─── iOS 风格组件（与 profile-page 一致）──────────────────────────────────

function IosRow({
  iconBg,
  icon: Icon,
  label,
  subtitle,
  value,
  last = false,
  onTap,
  right,
}: {
  iconBg?: string
  icon?: React.ElementType
  label: string
  subtitle?: string
  value?: string
  last?: boolean
  onTap?: () => void
  right?: React.ReactNode
}) {
  const inner = (
    <div
      className={cn(
        'flex min-h-[52px] items-center gap-3 px-4 py-3 transition-colors',
        onTap && 'active:bg-muted/60',
        !last && 'border-b border-border/50',
      )}
    >
      {Icon && iconBg && (
        <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]', iconBg)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right ?? (
        <div className="flex items-center gap-1 text-muted-foreground">
          {value && <span className="text-sm">{value}</span>}
          {onTap && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
        </div>
      )}
    </div>
  )

  return onTap ? (
    <button type="button" onClick={onTap} className="w-full text-left">
      {inner}
    </button>
  ) : (
    <div>{inner}</div>
  )
}

function IosSection({ header, children }: { header?: string; children: React.ReactNode }) {
  return (
    <div>
      {header && (
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {header}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
        {children}
      </div>
    </div>
  )
}

// ─── 昵称编辑 Drawer ──────────────────────────────────────────────────────

function NicknameEditDrawer({
  open,
  onOpenChange,
  currentName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onSaved: (name: string) => void
}) {
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(currentName)
  }, [currentName, open])

  const handleSave = async () => {
    if (!name.trim() || name.trim() === currentName) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await updateUserProfile({ name: name.trim() })
      onSaved(name.trim())
      onOpenChange(false)
    } catch {
      // 静默失败
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl">
        <DrawerHeader>
          <DrawerTitle className="text-base">修改昵称</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入昵称"
            maxLength={20}
            autoFocus
          />
          <p className="mt-1.5 text-right text-[11px] text-muted-foreground">{name.length}/20</p>
        </div>
        <DrawerFooter>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// ─── 修改密码 Drawer ──────────────────────────────────────────────────────

function ChangePasswordDrawer({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('')
      setSuccess(false)
    }
  }, [open])

  const handleChange = async () => {
    if (!currentPassword) { setMessage('请输入当前密码'); return }
    if (newPassword.length < 8) { setMessage('新密码至少需要8位字符'); return }
    if (newPassword !== confirmPassword) { setMessage('两次密码不一致'); return }
    if (currentPassword === newPassword) { setMessage('新密码不能与旧密码相同'); return }

    setLoading(true)
    setMessage('')
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setMessage('密码修改成功')
      setTimeout(() => {
        onOpenChange(false)
        onDone?.()
      }, 1500)
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || '修改失败')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="rounded-t-3xl">
          <div className="flex flex-col items-center px-4 py-10">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-semibold">密码修改成功</p>
            <p className="mt-1 text-sm text-muted-foreground">下次登录请使用新密码</p>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl">
        <DrawerHeader>
          <DrawerTitle className="text-base">修改密码</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-3 pb-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">当前密码</Label>
            <Input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              placeholder="输入当前密码"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">新密码</Label>
            <Input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              placeholder="至少8位字符"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">确认新密码</Label>
            <Input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
          </div>
          {message && (
            <p className={cn(
              'text-sm text-center rounded-lg px-3 py-2',
              message.includes('成功') ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
            )}>
              {message}
            </p>
          )}
        </div>
        <DrawerFooter>
          <Button onClick={handleChange} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            确认修改
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// ─── 主页面 ────────────────────────────────────────────────────────────────

export function AccountPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const setBottomNavVisible = useLayoutStore((s) => s.setBottomNavVisible)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [nicknameDrawerOpen, setNicknameDrawerOpen] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [passwordDrawerOpen, setPasswordDrawerOpen] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

  const handleSendVerification = async () => {
    if (!sessionUser?.email) return
    setSendingVerification(true)
    try {
      await sendEmailOtp(sessionUser.email)
      setVerificationSent(true)
    } catch {
      // ignore
    } finally {
      setSendingVerification(false)
    }
  }

  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const sessionUser = session?.user ?? null

  const loadData = useCallback(async () => {
    try {
      const [p, avatar, accounts] = await Promise.all([
        getUserProfile(),
        getCurrentAvatar(),
        listLinkedAccounts().catch(() => [] as LinkedAccount[]),
      ])
      setProfile(p)
      setAvatarUrl(avatar?.url ?? null)
      setLinkedAccounts(accounts)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setBottomNavVisible(false)
    return () => setBottomNavVisible(true)
  }, [setBottomNavVisible])

  useEffect(() => {
    const handleFocus = () => {
      listLinkedAccounts()
        .then(setLinkedAccounts)
        .catch(() => {})
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // ── 头像操作 ──
  const onPickAvatar = () => {
    avatarInputRef.current?.click()
  }

  const onAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.currentTarget.value = ''
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    setAvatarUploading(true)
    try {
      const asset = await uploadFileToCosAndComplete({ file, group: 'avatar' })
      const current = await setCurrentAvatar(asset.id)
      setAvatarUrl(current.url)
    } catch {
      // ignore
    } finally {
      setAvatarUploading(false)
    }
  }

  // ── 绑定操作 ──
  const handleLinkSocial = async (provider: 'wechat' | 'apple') => {
    try {
      setLinkingProvider(provider)
      await linkSocialAccount(provider)
    } catch {
      setLinkingProvider(null)
    }
  }

  const handleUnlink = async (accountId: string) => {
    if (unlinkingId) return
    setUnlinkingId(accountId)
    try {
      await unlinkAccount(accountId)
      setLinkedAccounts((prev) => prev.filter((a) => a.id !== accountId))
    } catch {
      // ignore
    } finally {
      setUnlinkingId(null)
    }
  }

  const handleNicknameSaved = (name: string) => {
    setProfile((prev) => prev ? { ...prev, name } : prev)
  }

  // ── 判断绑定状态 ──
  const wechatBound = linkedAccounts.some((a) => a.provider === 'wechat')
  const appleBound = linkedAccounts.some((a) => a.provider === 'apple')
  const wechatAccount = linkedAccounts.find((a) => a.provider === 'wechat')
  const appleAccount = linkedAccounts.find((a) => a.provider === 'apple')

  const nickname = profile?.name || sessionUser?.name || '未设置'
  const phoneNumber = profile?.phoneNumber || sessionUser?.phoneNumber || null

  return (
    <div className="space-y-5">
      {/*
        iOS 风格返回栏 —— 与设置页完全一致：
        居中标题 + 左侧返回按钮（absolute 定位）
      */}
      <div className="relative flex items-center justify-center">
        <button
          type="button"
          aria-label="返回"
          onClick={() => navigate(-1)}
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold">账号信息</h1>
      </div>

      {/* 区域一：头像 */}
      <IosSection header="头像">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarFileChange}
            />
            <button
              type="button"
              disabled={avatarUploading}
              onClick={onPickAvatar}
              className="group relative flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/15"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-primary" />
              )}
              <span className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-0.5 bg-black/50 py-0.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-3 w-3" />
                {avatarUploading ? '上传中' : '更换'}
              </span>
            </button>
            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">点击更换头像</p>
              <p className="text-xs text-muted-foreground">支持 JPG、PNG、WebP 格式</p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </div>
        </div>
      </IosSection>

      {/* 区域二：昵称 + 手机号 */}
      <IosSection header="个人信息">
        {isLoading ? (
          <>
            <div className="px-4 py-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <div className="border-t border-border/50 px-4 py-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <div className="border-t border-border/50 px-4 py-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </div>
          </>
        ) : (
          <>
            <IosRow
              label="邮箱"
              value={sessionUser?.email || '未设置'}
              subtitle={sessionUser?.emailVerified ? '已验证' : '未验证'}
              iconBg="bg-blue-500"
              icon={Mail}
              right={!sessionUser?.emailVerified && sessionUser?.email ? (
                <button
                  type="button"
                  disabled={sendingVerification || verificationSent}
                  onClick={handleSendVerification}
                  className="text-xs font-medium text-primary"
                >
                  {verificationSent ? '已发送' : sendingVerification ? '发送中...' : '验证'}
                </button>
              ) : undefined}
            />
            <IosRow
              label="昵称"
              value={nickname}
              onTap={() => setNicknameDrawerOpen(true)}
              subtitle="点击修改昵称"
            />
            <IosRow
              icon={Phone}
              iconBg="bg-green-500"
              label="手机号"
              value={phoneNumber || '未绑定'}
              subtitle={phoneNumber ? (profile?.phoneNumberVerified ? '已验证' : '未验证') : undefined}
              last
            />
          </>
        )}
      </IosSection>

      {/* 区域三：第三方账号绑定 */}
      <IosSection header="账号绑定">
        {isLoading ? (
          <>
            <div className="px-4 py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-1 h-3 w-12" />
            </div>
            <div className="border-t border-border/50 px-4 py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-1 h-3 w-12" />
            </div>
          </>
        ) : (
          <>
            {/* 微信 */}
            <IosRow
              iconBg="bg-[#07C160]"
              label="微信"
              subtitle={wechatBound ? `已绑定${wechatAccount?.name ? `：${wechatAccount.name}` : ''}` : '绑定后可用微信登录'}
              right={
                wechatBound ? (
                  <button
                    type="button"
                    disabled={unlinkingId === wechatAccount?.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (wechatAccount) handleUnlink(wechatAccount.id)
                    }}
                    className="text-xs text-destructive active:text-destructive/70"
                  >
                    {unlinkingId === wechatAccount?.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      '解绑'
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={linkingProvider === 'wechat'}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLinkSocial('wechat')
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-[#07C160]/10 px-3 py-1 text-xs font-medium text-[#07C160]"
                  >
                    {linkingProvider === 'wechat' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3" />
                    )}
                    绑定
                  </button>
                )
              }
            />
            {/* Apple */}
            <IosRow
              iconBg="bg-black dark:bg-white"
              label="Apple ID"
              subtitle={appleBound ? `已绑定${appleAccount?.name ? `：${appleAccount.name}` : ''}` : '绑定后可用 Apple ID 登录'}
              last
              right={
                appleBound ? (
                  <button
                    type="button"
                    disabled={unlinkingId === appleAccount?.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (appleAccount) handleUnlink(appleAccount.id)
                    }}
                    className="text-xs text-destructive active:text-destructive/70"
                  >
                    {unlinkingId === appleAccount?.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      '解绑'
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={linkingProvider === 'apple'}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLinkSocial('apple')
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {linkingProvider === 'apple' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3" />
                    )}
                    绑定
                  </button>
                )
              }
            />
          </>
        )}
      </IosSection>

      {/* 区域四：安全设置 */}
      <IosSection header="安全设置">
        <IosRow
          icon={KeyRound}
          iconBg="bg-amber-500"
          label="修改密码"
          subtitle="定期更换密码保障账户安全"
          onTap={() => setPasswordDrawerOpen(true)}
          last
        />
      </IosSection>

      {/* 昵称编辑抽屉 */}
      <NicknameEditDrawer
        open={nicknameDrawerOpen}
        onOpenChange={setNicknameDrawerOpen}
        currentName={nickname}
        onSaved={handleNicknameSaved}
      />

      {/* 修改密码抽屉 */}
      <ChangePasswordDrawer
        open={passwordDrawerOpen}
        onOpenChange={setPasswordDrawerOpen}
      />
    </div>
  )
}
