import { useEffect, useState } from 'react'
import { LOCAL_RECORDING_SCHEME, resolveLocalRecording } from '@/lib/offline/user-recordings'
import { resolveFileAssetUrl } from '@/lib/file-asset-reference'

export function useRecordingPlaybackUrl(reference?: string | null) {
  const [resolved, setResolved] = useState<string | undefined>()
  useEffect(() => {
    let cancelled = false
    setResolved(undefined)
    if (reference?.startsWith(LOCAL_RECORDING_SCHEME)) {
      resolveLocalRecording(reference).then(url => { if (!cancelled) setResolved(resolveFileAssetUrl(url)) }).catch(() => undefined)
    }
    return () => { cancelled = true }
  }, [reference])
  return reference?.startsWith(LOCAL_RECORDING_SCHEME) ? resolved : resolveFileAssetUrl(reference ?? undefined)
}
