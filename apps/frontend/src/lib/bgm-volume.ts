/** UI 显示 100% 时对应的真实增益上限（氛围底噪，避免盖过内容）。 */
export const BGM_VOLUME_MAX_GAIN = 0.05

/** 用户/主题未配置时的默认显示音量（界面 15% → 真实约 2.25%）。 */
export const BGM_VOLUME_DEFAULT_DISPLAY = 0.05

export function clampBgmDisplayVolume(display: number): number {
  if (!Number.isFinite(display)) return BGM_VOLUME_DEFAULT_DISPLAY
  return Math.min(1, Math.max(0, display))
}

/** 显示音量 0–1 → GainNode / 实际播放增益（最高 15% full scale）。 */
export function toBgmGain(display: number): number {
  return clampBgmDisplayVolume(display) * BGM_VOLUME_MAX_GAIN
}

export function resolveBgmDisplayVolume(
  userVolume: number | null | undefined,
  presetVolume: number | null | undefined,
): number {
  if (userVolume != null && Number.isFinite(userVolume)) return clampBgmDisplayVolume(userVolume)
  if (presetVolume != null && Number.isFinite(presetVolume)) return clampBgmDisplayVolume(presetVolume)
  return BGM_VOLUME_DEFAULT_DISPLAY
}

function isLocalCapacitorPlaybackUrl(url: string) {
  return url.startsWith('capacitor://')
    || url.startsWith('file:')
    || url.startsWith('http://localhost/_capacitor_file_')
    || url.startsWith('https://localhost/_capacitor_file_')
}

/**
 * MediaElementSource stays audible only for same-origin / Capacitor local URLs.
 * Cross-origin COS URLs produce CORS silence once wired into Web Audio.
 */
export function canUseBgmWebAudioGraph(src: string | null | undefined): boolean {
  if (!src) return false
  if (isLocalCapacitorPlaybackUrl(src)) return true
  if (src.startsWith('blob:') || src.startsWith('data:')) return true
  if (typeof window === 'undefined') return false
  try {
    return new URL(src, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}
