import { useState } from 'react'
import { Send, Loader2, CheckCircle2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Select, SelectItem } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { submitFeedback } from '@/features/feedback/api'

const TYPE_OPTIONS = [
  { value: 'bug', label: '问题反馈' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'other', label: '其他' },
]

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const isMobile = useIsMobile()
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      await submitFeedback({ type, content, contact: contact || undefined })
      setSubmitted(true)
    } finally { setSubmitting(false) }
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setSubmitted(false)
      setContent('')
      setContact('')
      setType('bug')
    }, 300)
  }

  const formContent = (
    <div className="space-y-4">
      {submitted ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-success mb-3" />
          <p className="text-lg font-medium">感谢您的反馈！</p>
          <p className="text-sm text-muted-foreground mt-1">我们会在 15 个工作日内处理</p>
          <Button variant="outline" size="sm" className="mt-5" onClick={handleClose}>
            关闭
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
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && handleClose()}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              帮助与反馈
            </DrawerTitle>
          </DrawerHeader>
          {formContent}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            帮助与反馈
          </DialogTitle>
          <DialogDescription>提交问题或建议，帮助我们做得更好</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  )
}
