import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageSquare, Send, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectItem } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { submitFeedback, getMyFeedbacks, type FeedbackResult } from '@/features/feedback/api'
import { cn } from '@/lib/cn'

const TYPE_OPTIONS = [
  { value: 'bug', label: '问题反馈' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'other', label: '其他' },
]

const STATUS_MAP: Record<string, { label: string; variant: 'outline' | 'secondary' | 'default' }> = {
  pending: { label: '处理中', variant: 'secondary' },
  resolved: { label: '已解决', variant: 'default' },
  closed: { label: '已关闭', variant: 'outline' },
}

export function FeedbackPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [myFeedbacks, setMyFeedbacks] = useState<FeedbackResult[]>([])
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(true)

  useEffect(() => {
    getMyFeedbacks().then((res) => setMyFeedbacks(res.items)).finally(() => setLoadingFeedbacks(false))
  }, [])

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      await submitFeedback({ type, content, contact: contact || undefined })
      setSubmitted(true)
      setContent('')
      setContact('')
      // refresh list
      const res = await getMyFeedbacks()
      setMyFeedbacks(res.items)
    } catch { /* ignore */ }
    finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/profile?tab=settings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">帮助与反馈</h1>
          <p className="text-xs text-muted-foreground">提交问题或建议，帮助我们做得更好</p>
        </div>
      </div>

      {/* submit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            提交反馈
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mb-3" />
              <p className="font-medium">感谢您的反馈！</p>
              <p className="text-sm text-muted-foreground mt-1">我们会在 15 个工作日内处理</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSubmitted(false)}>
                继续提交
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1.5 block">反馈类型</label>
                <Select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">详细描述</label>
                <textarea
                  className="w-full min-h-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="请详细描述您遇到的问题或建议..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">联系方式（选填）</label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="手机号或邮箱，方便我们联系您"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>
              <Button onClick={handleSubmit} disabled={!content.trim() || submitting} className="w-full gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? '提交中...' : '提交反馈'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* my feedbacks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">我的反馈记录</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFeedbacks ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : myFeedbacks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">暂无反馈记录</p>
          ) : (
            <div className="space-y-3">
              {myFeedbacks.map((fb) => (
                <div key={fb.id} className="rounded-lg border border-border/60 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {TYPE_OPTIONS.find((t) => t.value === fb.type)?.label || fb.type}
                    </Badge>
                    <Badge variant={STATUS_MAP[fb.status]?.variant || 'outline'} className="text-[10px]">
                      {STATUS_MAP[fb.status]?.label || fb.status}
                    </Badge>
                  </div>
                  <p className="text-sm line-clamp-2">{fb.content}</p>
                  {fb.adminNote && (
                    <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
                      客服回复：{fb.adminNote}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60">
                    {new Date(fb.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
