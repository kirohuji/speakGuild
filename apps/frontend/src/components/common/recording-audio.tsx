import type { AudioHTMLAttributes } from 'react'
import { useRecordingPlaybackUrl } from '@/hooks/use-recording-playback-url'
export function RecordingAudio({ src, ...props }: AudioHTMLAttributes<HTMLAudioElement>) {
  const url = useRecordingPlaybackUrl(src)
  return <audio {...props} src={url} />
}
