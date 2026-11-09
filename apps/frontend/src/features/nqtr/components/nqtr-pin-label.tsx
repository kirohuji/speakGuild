import { resolveFileAssetUrl } from '@/lib/file-asset-reference'
import type { NqtrChrome } from '../model/nqtr-time-chrome'

/** 按文字长度略拉伸底板宽度（中文按全角估）。 */
export function pinLabelWidth(label: string, chrome: NqtrChrome) {
  const chars = Array.from(label || '')
  let units = 0
  for (const ch of chars) {
    units += /[\u3400-\u9fff]/.test(ch) ? 1 : 0.55
  }
  const pad = 24
  const estimated = Math.round(units * 12 + pad)
  return Math.max(chrome.pinLabelMinWidth, estimated)
}

/** 地图地点 / 热点名牌：外观底板 + 居中黑字，宽度随文字拉伸。 */
export function NqtrPinLabel({
  chrome,
  label,
  className,
}: {
  chrome: NqtrChrome
  label: string
  className?: string
}) {
  const height = chrome.pinLabelHeight
  const width = pinLabelWidth(label, chrome)
  const icon = chrome.pinLabelIcon ? resolveFileAssetUrl(chrome.pinLabelIcon) : ''

  return (
    <span
      className={className ?? 'relative inline-flex items-center justify-center'}
      style={{ width, height }}
    >
      {icon ? (
        <img src={icon} alt="" className="absolute inset-0 size-full object-fill" draggable={false} />
      ) : (
        <span className="absolute inset-0 rounded-md bg-white/85 shadow-sm ring-1 ring-black/10" />
      )}
      <span className="relative z-10 max-w-full truncate px-2 text-center text-xs font-semibold leading-none text-black">
        {label}
      </span>
    </span>
  )
}
