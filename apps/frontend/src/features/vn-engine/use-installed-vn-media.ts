import { useEffect, useRef, useState } from 'react'
import {
  resolveInstalledAssetMap,
  resolveInstalledScene,
  type InstalledAssetMap,
} from '@/lib/offline/installed-pack-media'

type SceneLike = {
  backgroundUrl?: string | null
  characters?: unknown
  [key: string]: unknown
} | null | undefined

/**
 * Single readiness gate for installed-pack scene + Ink assetMap.
 * Failures still flip mediaReady so the stage never hangs forever.
 *
 * Prepared maps must win in the *same render* they arrive. Deferring them to
 * useEffect left one paint where mediaReady was already true from an earlier
 * empty resolve while assetMap was still {} — repeat replay then built frames
 * with raw Ink aliases (bg_*) and Pixi tried to load `/bg_xxx`.
 */
export function useInstalledVnMedia(input: {
  packageId: string
  /** Bump when the underlying episode/topic payload changes. */
  revision: string
  rawAssetMap?: InstalledAssetMap | null
  rawScene?: SceneLike
  preparedAssetMap?: InstalledAssetMap | null
  preparedScene?: NonNullable<SceneLike> | null
}) {
  const rawAssetMapRef = useRef(input.rawAssetMap)
  const rawSceneRef = useRef(input.rawScene)
  rawAssetMapRef.current = input.rawAssetMap
  rawSceneRef.current = input.rawScene

  const hasPrepared = Boolean(input.preparedAssetMap && input.preparedScene)
  const [mediaReady, setMediaReady] = useState(hasPrepared)
  const [assetMap, setAssetMap] = useState<InstalledAssetMap>(
    input.preparedAssetMap ?? {},
  )
  const [scene, setScene] = useState<SceneLike>(
    input.preparedScene ?? input.rawScene ?? null,
  )

  useEffect(() => {
    if (!input.packageId) {
      // No pack to resolve — do not leave callers stuck on mediaReady=false.
      setAssetMap({})
      setScene(rawSceneRef.current ?? null)
      setMediaReady(true)
      return
    }

    if (input.preparedAssetMap && input.preparedScene) {
      setAssetMap(input.preparedAssetMap)
      setScene(input.preparedScene)
      setMediaReady(true)
      return
    }

    let cancelled = false
    setMediaReady(false)

    void Promise.all([
      resolveInstalledAssetMap(input.packageId, rawAssetMapRef.current ?? null),
      resolveInstalledScene(input.packageId, rawSceneRef.current as any),
    ])
      .then(([resolvedMap, resolvedScene]) => {
        if (cancelled) return
        setAssetMap(resolvedMap)
        setScene(resolvedScene)
      })
      .catch((error) => {
        console.warn('[vn-media] installed pack media resolve failed', {
          packageId: input.packageId,
          error,
        })
        if (cancelled) return
        setAssetMap({})
        setScene(rawSceneRef.current ?? null)
      })
      .finally(() => {
        if (!cancelled) setMediaReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [
    input.packageId,
    input.preparedAssetMap,
    input.preparedScene,
    input.revision,
  ])

  // Prefer prepared props over effect-lagged state so callers never see the
  // empty-map / mediaReady=true interstitial that leaks Ink aliases.
  if (input.preparedAssetMap && input.preparedScene) {
    return {
      mediaReady: true,
      assetMap: input.preparedAssetMap,
      scene: input.preparedScene,
    }
  }

  return { mediaReady, assetMap, scene }
}
