import { cn } from '@/lib/cn'

/** 贴图本体：透明底 + 轮廓阴影，避免矩形卡片裁切不规则边缘 */
export function NotificationStickerImage({
  src,
  alt,
  className,
  onClick,
}: {
  src: string
  alt: string
  className?: string
  onClick?: () => void
}) {
  const img = (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn(
        'max-h-[min(70vh,520px)] max-w-[min(86vw,420px)] object-contain select-none',
        '[filter:drop-shadow(0_18px_28px_rgba(0,0,0,0.28))]',
        className,
      )}
    />
  )

  if (!onClick) return img

  return (
    <button
      type="button"
      onClick={onClick}
      className="block cursor-pointer rounded-none border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {img}
    </button>
  )
}

/** 管理后台：模拟首页贴图浮层预览（棋盘格表示透明） */
export function NotificationStickerPreview({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60',
        className,
      )}
    >
      <div
        className="flex min-h-[220px] items-center justify-center bg-[length:16px_16px] p-6"
        style={{
          backgroundColor: '#d4d4d8',
          backgroundImage:
            'linear-gradient(45deg, #e4e4e7 25%, transparent 25%), linear-gradient(-45deg, #e4e4e7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e4e4e7 75%), linear-gradient(-45deg, transparent 75%, #e4e4e7 75%)',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
        }}
      >
        <div className="absolute inset-0 bg-black/35" aria-hidden />
        <NotificationStickerImage
          src={src}
          alt={alt}
          className="relative z-[1] max-h-[200px] max-w-full"
        />
      </div>
      <p className="border-t border-border/50 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
        首页贴图预览 · 请使用透明底 PNG/WebP，外围不要留实色底
      </p>
    </div>
  )
}
