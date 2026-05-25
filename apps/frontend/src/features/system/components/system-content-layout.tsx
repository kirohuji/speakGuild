import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

interface SystemContentLayoutProps {
  title: string
  children: React.ReactNode
  backPath?: string
}

export function SystemContentLayout({ title, children, backPath }: SystemContentLayoutProps) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const handleBack = () => {
    if (backPath) {
      navigate(backPath)
    } else {
      navigate(-1 as unknown as string)
    }
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        {/* 移动端头部导航 */}
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/50 bg-background/95 backdrop-blur-xl px-4 h-12">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/60 active:bg-muted"
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold truncate pr-8">{title}</h1>
        </div>
        {/* 移动端内容区 */}
        <div className="px-4 py-5 pb-24">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:py-10">
      {/* PC 端头部导航 */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="mb-4 gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </Button>
        <h1 className="font-display text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
      </div>
      {/* PC 端内容区 */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 lg:p-8 shadow-sm">
        {children}
      </div>
    </div>
  )
}
