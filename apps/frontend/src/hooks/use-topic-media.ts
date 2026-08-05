import { useEffect, useState } from 'react'
import { assetCacheService } from '@/lib/offline/asset-cache.service'
import { localDb } from '@/lib/offline/unified-storage'
import { isNative } from '@/lib/native'
import { getFileAssetPrivateUrl } from '@/features/file-assets/api'

export type TopicMediaSource = {
  mediaUrl?: string | null
  mediaAssetId?: string | null
}

/**
 * 将听力话题的音频解析为可播放 URL。
 *
 * - Web：直接使用后端返回的签名 `mediaUrl`；缺失时回退到按 assetId 拉取新签名。
 * - 移动端（离线包已安装）：优先从本地资产缓存解析 —— 离线包里的 topic JSON
 *   只带稳定的 `mediaAssetId`（没有 mediaUrl），客户端据此在
 *   `downloaded_packs` manifest 中找到对应资源，再经 assetCacheService 命中
 *   已落盘的文件（capacitor:// 本地 URL，完全离线可用）。
 * - 移动端本地未命中：最后回退到线上签名 URL 再解析。
 */
export function useTopicMediaUrl(topic: TopicMediaSource | null | undefined, unitId?: string | null) {
  const mediaUrl = topic?.mediaUrl ?? null
  const mediaAssetId = topic?.mediaAssetId ?? null
  const [resolved, setResolved] = useState<string | null>(mediaUrl)
  // 首帧就确定是否需要进行异步解析，避免先闪"不可用"再变"加载中"
  const [resolving, setResolving] = useState<boolean>(
    isNative()
      ? Boolean(mediaUrl || mediaAssetId)
      : Boolean(!mediaUrl && mediaAssetId),
  )

  useEffect(() => {
    let cancelled = false
    setResolved(mediaUrl)
    if (!mediaUrl && !mediaAssetId) return

    // Web 且已有签名 URL：无需任何异步解析，直接可播
    if (!isNative() && mediaUrl) return

    async function resolve() {
      setResolving(true)
      try {
        // ── Web：mediaUrl 缺失时按 assetId 拉取新签名 ──
        if (!isNative()) {
          if (mediaAssetId) {
            try {
              const fresh = await getFileAssetPrivateUrl(mediaAssetId)
              if (!cancelled) setResolved(fresh.url)
            } catch {
              if (!cancelled) setResolved(null)
            }
          }
          return
        }

        // ── 移动端：优先本地离线文件 ──
        const local = await resolveNative()
        if (!cancelled) setResolved(local)
      } finally {
        if (!cancelled) setResolving(false)
      }
    }

    async function resolveNative(): Promise<string | null> {
      // 1) 已安装学习包：用稳定的 assetId 在 manifest 中定位资源（完全离线）
      try {
        const pack = unitId ? await localDb.get<any>('downloaded_packs', unitId) : null
        const asset = pack?.manifest?.assets?.find(
          (a: any) => a.assetId === mediaAssetId || a.fileAssetId === mediaAssetId,
        )
        if (asset?.url) {
          const local = await assetCacheService.resolve({
            url: asset.url,
            assetId: mediaAssetId ?? undefined,
            sha256: asset.sha256,
            mimeType: asset.mimeType,
            role: 'topic_media',
          }).catch(() => null)
          if (local) return local
        }
      } catch { /* 继续回退 */ }

      // 2) 已有签名 URL：直接经资产缓存解析
      if (mediaUrl) {
        const local = await assetCacheService.resolve({
          url: mediaUrl,
          assetId: mediaAssetId ?? undefined,
          role: 'topic_media',
        }).catch(() => null)
        if (local) return local
      }

      // 3) 兜底：线上拉取新签名 URL 再解析（在线场景）
      if (mediaAssetId) {
        try {
          const fresh = await getFileAssetPrivateUrl(mediaAssetId)
          const local = await assetCacheService.resolve({
            url: fresh.url,
            assetId: mediaAssetId,
            role: 'topic_media',
          }).catch(() => fresh.url)
          return local || fresh.url
        } catch { /* 资源不可用 */ }
      }

      return mediaUrl
    }

    void resolve()
    return () => {
      cancelled = true
    }
  }, [mediaUrl, mediaAssetId, unitId])

  return { mediaUrl: resolved, resolving }
}
