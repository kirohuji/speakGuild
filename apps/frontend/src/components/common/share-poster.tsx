import { useState, useCallback, useRef } from 'react'
import { Share2, Download, Copy, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

export interface SharePosterData {
  title: string
  score?: number
  days?: number
  subtitle?: string
}

interface SharePosterProps {
  data: SharePosterData
}

export function SharePoster({ data }: SharePosterProps) {
  const isMobile = useIsMobile()
  const posterRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    if (!posterRef.current) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: null,
        scale: 2,
      })
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      )
      if (navigator.share && isMobile) {
        const file = new File([blob], 'learning-result.png', { type: 'image/png' })
        await navigator.share({ title: data.title, files: [file] })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'learning-result.png'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch { handleCopy() }
  }, [data, isMobile])

  const handleCopy = useCallback(() => {
    const text = `${data.title}${data.score ? ` - 得分：${data.score}分` : ''}${data.days ? ` - 连续打卡：${data.days}天` : ''}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [data])

  return (
    <div className="space-y-4">
      <div
        ref={posterRef}
        className="relative mx-auto w-full max-w-sm rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 text-white shadow-xl"
      >
        <div className="text-center space-y-3">
          <h3 className="text-lg font-bold">{data.title}</h3>
          {data.score !== undefined && (
            <div>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">模考成绩</p>
              <p className="text-4xl font-black">{data.score}<span className="text-lg font-normal"> 分</span></p>
            </div>
          )}
          {data.days !== undefined && (
            <div>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">连续打卡</p>
              <p className="text-4xl font-black">{data.days}<span className="text-lg font-normal"> 天</span></p>
            </div>
          )}
          {data.subtitle && <p className="text-xs opacity-80">{data.subtitle}</p>}
          <div className="pt-2">
            <p className="text-[10px] opacity-60">导游说 · GuideReady</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={handleShare} className="gap-2">
          <Share2 className="h-4 w-4" />
          {isMobile ? '分享' : '下载图片'}
        </Button>
        <Button onClick={handleCopy} variant="outline" className="gap-2">
          {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {copied ? '已复制' : '复制文字'}
        </Button>
      </div>
    </div>
  )
}
