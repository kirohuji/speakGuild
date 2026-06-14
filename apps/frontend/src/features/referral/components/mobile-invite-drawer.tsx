import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CheckCircle2, Copy, Gift, Share2, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { getReferralCode, getReferralStats, type ReferralCodeData, type ReferralStats } from '@/features/referral/api'

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
    if (!open || codeData || loading) return
    setLoading(true)
    Promise.all([getReferralCode(), getReferralStats()])
      .then(([code, referralStats]) => {
        setCodeData(code)
        setStats(referralStats)
      })
      .catch((error: any) => {
        toast.error(error?.message || '暂时无法加载邀请码')
      })
      .finally(() => setLoading(false))
  }, [open, codeData, loading])

  const inviteLink = `${window.location.origin}/#/auth/register?ref=${codeData?.code || ''}`

  const handleCopyInvite = async () => {
    if (!codeData?.code) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败，请稍后重试')
    }
  }

  const handleShareInvite = async () => {
    if (!codeData?.code) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: '漫语町 - 邀请你一起学习',
          text: `用我的邀请码 ${codeData.code} 注册漫语町。你注册成功后，我可以获得 5 天会员奖励。`,
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
                    分享
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

              <div className="overflow-hidden rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">邀请记录</p>
                </div>
                {stats?.referrals && stats.referrals.length > 0 ? (
                  <div>
                    {stats.referrals.map((ref) => (
                      <div
                        key={ref.userId}
                        className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={ref.userImage || undefined} />
                          <AvatarFallback className="text-[10px]">{ref.userName?.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{ref.userName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(ref.joinedAt).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                        {ref.rewarded && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            已奖励
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    还没有邀请记录，分享给好友试试看。
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
