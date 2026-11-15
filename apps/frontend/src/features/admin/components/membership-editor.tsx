import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { getUserDetail, cancelMembership, updateMembership } from '@/features/admin/api'
import { getMemberPlans, type MemberPlan } from '@/features/membership/api'

function localDate(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function MembershipEditor({ userId, name, onSaved }: { userId: string; name: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [plans, setPlans] = useState<MemberPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [expiredAt, setExpiredAt] = useState('')
  const [active, setActive] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  async function load() {
    setOpen(true)
    setLoading(true)
    setReady(false)
    setError('')
    setConfirmCancel(false)
    try {
      const [catalog, user] = await Promise.all([getMemberPlans(), getUserDetail(userId)])
      const paidPlans = catalog.filter(plan => plan.level !== 'free')
      setPlans(paidPlans)
      const membership = user.membership
      setPlanId(paidPlans.find(plan => plan.planId === membership?.plan?.id)?.planId ?? paidPlans[0]?.planId ?? '')
      const isActive = membership?.status === 'active' && new Date(membership.expiredAt ?? '').getTime() > Date.now()
      setActive(isActive)
      setExpiredAt(localDate(isActive ? new Date(membership!.expiredAt!) : new Date(Date.now() + 30 * 86400000)))
      setReady(true)
    } catch {
      setError('加载会员信息失败，请关闭后重试')
    } finally {
      setLoading(false)
    }
  }

  async function save(cancel = false) {
    setError('')
    const expiry = new Date(expiredAt)
    if (!cancel && (!planId || !Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())) {
      setError('请选择会员套餐，并设置晚于当前时间的到期时间')
      return
    }
    setSaving(true)
    try {
      if (cancel) await cancelMembership(userId)
      else await updateMembership(userId, { planId, expiredAt: expiry.toISOString() })
      toast.success(cancel ? '已取消会员权益' : '会员设置已保存')
      setOpen(false)
      onSaved()
    } catch {
      setError('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <Button variant="outline" size="sm" onClick={event => { event.stopPropagation(); void load() }}>设置会员</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value) }}>
      <DialogContent onClick={event => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>设置会员</DialogTitle>
          <DialogDescription>为 {name} 开通、调整或取消会员权益。</DialogDescription>
        </DialogHeader>
        {loading ? <p role="status">正在加载会员信息…</p> : ready && <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">会员套餐
            <Select value={planId} onChange={event => setPlanId(event.target.value)} disabled={saving}>
              {plans.map(plan => <option key={plan.planId} value={plan.planId}>{plan.name}</option>)}
            </Select>
          </label>
          {plans.length === 0 && <p className="text-sm text-muted-foreground">暂无可用的会员套餐</p>}
          <label className="flex flex-col gap-2">到期时间（本地时间）
            <Input type="datetime-local" value={expiredAt} onChange={event => setExpiredAt(event.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-2">快捷增加时长
            <Select value="" disabled={saving} onChange={event => {
              const base = Math.max(new Date(expiredAt).getTime() || 0, Date.now())
              setExpiredAt(localDate(new Date(base + Number(event.target.value) * 86400000)))
            }}>
              <option value="" disabled>在当前有效期后增加…</option>
              <option value="7">7 天</option><option value="30">30 天</option>
              <option value="90">90 天</option><option value="365">365 天</option>
            </Select>
          </label>
          <p className="text-sm text-muted-foreground">保存后立即生效。取消会员将立即收回本站权益。商店订阅的扣费状态不受此操作影响，后续订阅同步可能更新此处设置。</p>
          {confirmCancel && <p role="alert" className="text-sm text-destructive">确定立即取消该用户的会员权益？</p>}
        </div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {active && ready && <Button variant="destructive" disabled={saving} onClick={() => confirmCancel ? void save(true) : setConfirmCancel(true)}>{confirmCancel ? '确认取消会员' : '取消会员'}</Button>}
          <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>关闭</Button>
          <Button disabled={loading || saving || !ready || !planId} onClick={() => void save()}>{saving ? '正在保存…' : '保存会员设置'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
