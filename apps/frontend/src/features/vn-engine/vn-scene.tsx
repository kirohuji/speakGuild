import { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface VnSceneProps {
  backgroundUrl?: string
  className?: string
  children: ReactNode
}

/**
 * 视觉小说场景容器
 * Phase 2: React + CSS 实现背景图 + 立绘 + 对话框布局
 * V1.1: 替换为 PIXI.js 渲染
 */
export function VnScene({ backgroundUrl, className, children }: VnSceneProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-border',
        className,
      )}
      style={
        backgroundUrl
          ? {
              backgroundImage: `url(${backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }
      }
    >
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Content area */}
      <div className="relative z-10 flex flex-1 flex-col justify-end p-4">{children}</div>
    </div>
  )
}
