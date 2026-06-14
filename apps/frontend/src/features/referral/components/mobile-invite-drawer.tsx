import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CheckCircle2, Copy, Gift, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { getReferralCode, getReferralStats, type ReferralCodeData, type ReferralStats } from '@/features/referral/api'
import { isNative } from '@/lib/native/platform'

const PUBLIC_INVITE_BASE_URL =
  ((import.meta.env.VITE_INVITE_BASE_URL as string | undefined)?.replace(/\/$/, '')) ||
  window.location.origin

function buildInviteLink(code?: string) {
  const normalizedCode = code?.trim()
  return `${PUBLIC_INVITE_BASE_URL}/#/auth/login${normalizedCode ? `?ref=${encodeURIComponent(normalizedCode)}` : ''}`
}

export function MobileInviteDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [codeData, setCodeData] = useState<ReferralCodeData | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    getReferralCode()
      .then(async (code) => {
        if (cancelled) return
        setCodeData(code)
        const referralStats = await getReferralStats()
        if (cancelled) return
        setStats(referralStats)
      })
      .catch((error: any) => {
        if (!cancelled) toast.error(error?.message || '暂时无法加载邀请码')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const inviteLink = buildInviteLink(codeData?.code)
  const shareTitle = '漫语町 - 邀请你一起学习'
  const shareText = `用我的邀请码 ${codeData?.code || ''} 注册漫语町。你注册成功后，我可以获得会员奖励。`

  const handleCopyInvite = async () => {
    if (!codeData?.code) return
    try {
      if (isNative()) {
        const { Clipboard } = await import('@capacitor/clipboard')
        await Clipboard.write({ string: inviteLink })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink)
      } else {
        throw new Error('Clipboard is unavailable')
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败，请稍后重试')
    }
  }

  const handleShareInvite = async () => {
    if (!codeData?.code) return

    if (isNative()) {
      try {
        const { CapacitorWechat } = await import('@capgo/capacitor-wechat')
        const { installed } = await CapacitorWechat.isInstalled()
        if (installed) {
          await CapacitorWechat.share({
            scene: 0,
            type: 'link',
            title: shareTitle,
            description: shareText,
            link: inviteLink,
          })
          return
        }
      } catch {
        // Fall back to the system share sheet below.
      }
    }

    try {
      const { Share } = await import('@capacitor/share')
      const { value: canShare } = await Share.canShare()
      if (canShare) {
        await Share.share({
          title: shareTitle,
          text: shareText,
          url: inviteLink,
          dialogTitle: '分享给好友',
        })
        return
      }
    } catch {
      // Fall back to Web Share or copy below.
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: inviteLink,
        })
      } catch {
        /* user cancelled */
      }
      return
    }
    await handleCopyInvite()
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh] rounded-t-3xl drawer-surface">
        <DrawerHeader className="px-4 pb-2 text-left">
          <DrawerTitle className="text-base">{t('invite.title')}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[calc(1rem+var(--safe-area-inset-bottom))]">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/30 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-pink-500">
                    <Gift className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">邀请好友，你得 5 天会员</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      好友通过你的邀请码注册后，你将获得会员奖励。
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-background px-4 py-3 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">邀请码</p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-primary">
                    {codeData?.code || '----'}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" className="rounded-lg" onClick={handleCopyInvite} disabled={!codeData?.code}>
                    {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    {copied ? '已复制' : '复制链接'}
                  </Button>
                  <Button className="rounded-lg" onClick={handleShareInvite} disabled={!codeData?.code}>
                    <Share2 className="h-4 w-4" />
                    分享微信
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/30 px-4 py-3 text-center">
                  <p className="text-xl font-semibold text-primary">{stats?.totalInvited || 0}</p>
                  <p className="mt-1 text-xs text-muted-foreground">已邀请人数</p>
                </div>
                <div className="rounded-lg bg-muted/30 px-4 py-3 text-center">
                  <p className="text-xl font-semibold text-amber-600">{stats?.totalReward || 0}</p>
                  <p className="mt-1 text-xs text-muted-foreground">累计奖励天数</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
