import { resolveFileAssetUrl } from '@/lib/file-asset-reference'
import type { NqtrChrome } from '../model/nqtr-time-chrome'

/** 左上角状态牌：底板图 + 居中两行（时间 / 地点）。 */
export function NqtrStatusBadge({
  chrome,
  timeText,
  placeText,
  className,
}: {
  chrome: NqtrChrome
  timeText: string
  placeText: string
  className?: string
}) {
  const width = chrome.statusBadgeWidth
  const height = chrome.statusBadgeHeight
  const icon = chrome.statusBadgeIcon ? resolveFileAssetUrl(chrome.statusBadgeIcon) : ''

  return (
    <div
      className={className ?? 'pointer-events-none absolute left-[-8px] top-3 z-40'}
      style={{ width, height }}
      aria-label={`${timeText} ${placeText}`}
    >
      {icon ? (
        <img src={icon} alt="" className="absolute inset-0 size-full object-contain" draggable={false} />
      ) : (
        <div className="absolute inset-0 rounded-md bg-black/55 shadow-sm ring-1 ring-white/10" />
      )}
      <div className="relative z-10 flex size-full flex-col items-center justify-center px-2 text-center leading-tight text-black">
        <span className="max-w-full truncate text-[11px] font-semibold tracking-wide">
          {timeText}
        </span>
        <span className="mt-0.5 max-w-full truncate text-[9px] font-medium">
          {placeText}
        </span>
      </div>
    </div>
  )
}
