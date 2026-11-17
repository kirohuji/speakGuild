/** UI 显示 100% 时对应的真实增益上限（氛围底噪，避免盖过内容）。 */
export const BGM_VOLUME_MAX_GAIN = 0.3

/** 用户/主题未配置时的默认显示音量（界面 15% → 真实约 4.5%）。 */
export const BGM_VOLUME_DEFAULT_DISPLAY = 0.15

export function clampBgmDisplayVolume(display: number): number {
  if (!Number.isFinite(display)) return BGM_VOLUME_DEFAULT_DISPLAY
  return Math.min(1, Math.max(0, display))
}

/** 显示音量 0–1 → GainNode / 实际播放增益（最高 50% full scale）。 */
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
