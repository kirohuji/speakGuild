import { Map as MapIcon, MapPin } from 'lucide-react'
import { resolveFileAssetUrl } from '@/lib/file-asset-reference'
import type { NqtrChrome, NqtrCommandKey } from '../model/nqtr-time-chrome'

const COMMAND_FALLBACK = {
  map: MapIcon,
  place: MapPin,
}

export function NqtrCommandIcon({
  chrome,
  command,
  label,
  onClick,
  className,
}: {
  chrome: NqtrChrome
  command: NqtrCommandKey
  label: string
  onClick: () => void
  className?: string
}) {
  const style = chrome.commands[command]
  const icon = style.icon ? resolveFileAssetUrl(style.icon) : ''
  const Fallback = COMMAND_FALLBACK[command]
  return (
    <button type="button" aria-label={label} title={label} className={`bg-transparent ${className ?? ''}`} onClick={onClick}>
      {icon
        ? <img src={icon} alt="" style={{ width: style.size, height: style.size }} className="object-contain" />
        : <Fallback className="text-white drop-shadow" style={{ width: style.size, height: style.size }} />}
    </button>
  )
}
