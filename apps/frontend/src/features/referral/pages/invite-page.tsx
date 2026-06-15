import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Share2, Users, Gift, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getReferralCode, getReferralStats, type ReferralCodeData, type ReferralStats } from '@/features/referral/api'

export function InvitePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [codeData, setCodeData] = useState<ReferralCodeData | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([getReferralCode(), getReferralStats()])
      .then(([code, s]) => { setCodeData(code); setStats(s) })
      .finally(() => setLoading(false))
  }, [])

  const inviteLink = `${window.location.origin}/#/auth/register?ref=${codeData?.code || ''}`

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [inviteLink])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('invite.shareTitle'),
          text: t('invite.shareText', { code: codeData?.code || '' }),
          url: inviteLink,
        })
      } catch { /* ignore */ }
    } else {
      handleCopy()
    }
  }, [inviteLink, codeData?.code, handleCopy])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/profile')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">{t('invite.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('invite.guestSubtitle')}</p>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-primary/[0.02] border-primary/20">
        <CardContent className="p-6 text-center space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{t('invite.rewardTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('invite.rewardDescFull')}
            </p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-background px-6 py-3">
            <span className="text-2xl font-mono font-bold tracking-wider text-primary">
              {codeData?.code || '---'}
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={handleCopy} variant="outline" className="gap-2">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? t('invite.copied') : t('invite.copyLink')}
            </Button>
            <Button onClick={handleShare} className="gap-2">
              <Share2 className="h-4 w-4" />
              {t('invite.shareDialogTitle')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> {t('invite.records')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl bg-muted/30 p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats?.totalInvited || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('invite.totalInvited')}</p>
            </div>
            <div className="rounded-xl bg-muted/30 p-4 text-center">
              <p className="text-2xl font-bold text-accent">{stats?.totalReward || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('invite.totalReward')}</p>
            </div>
          </div>
          {stats?.referrals && stats.referrals.length > 0 ? (
            <div className="space-y-2">
              {stats.referrals.map((ref) => (
                <div key={ref.userId} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={ref.userImage || undefined} />
                    <AvatarFallback className="text-[10px]">{ref.userName?.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ref.userName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(ref.joinedAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  {ref.rewarded && (
                    <span className="text-[10px] text-success flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {t('invite.rewarded')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">{t('invite.emptyRecords')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
