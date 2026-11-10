import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useUserStore } from '@/stores/user.store'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { fileAssetIdFromUrl } from '@/lib/file-asset-reference'
import { isNative } from '@/lib/native'
import {
  assetCacheService,
  isCachedPlaybackUrl,
  OFFLINE_RESOURCE_MISSING,
  stableRemoteUrl,
} from '@/lib/offline/asset-cache.service'

function sameRemoteAsset(a: string, b: string) {
  return stableRemoteUrl(a) === stableRemoteUrl(b)
}

/**
 * 将远程头像 URL 解析为可显示 URL：
 * - web：直接用远程 URL（浏览器无需本地缓存，也避免无意义 resolve miss 日志）
 * - native：优先本地缓存；未缓存且在线时下载，离线可继续显示
 * 解析失败/离线且未缓存时返回 null，由 Avatar 组件回退到字母。
 *
 * 头像真正更换时（稳定路径 / assetId 变了），清理旧头像本地缓存。
 */
function useResolvedAvatarUrl(
  url: string | null | undefined,
  fileAssetId?: string | null,
): string | null {
  const [resolved, setResolved] = useState<string | null>(null)
  const prevUrlRef = useRef<string | null | undefined>(null)
  const prevAssetIdRef = useRef<string | null | undefined>(null)

  useEffect(() => {
    let active = true
    const previousUrl = prevUrlRef.current
    const previousAssetId = prevAssetIdRef.current
    prevUrlRef.current = url
    prevAssetIdRef.current = fileAssetId

    if (!url) {
      setResolved(null)
      return
    }

    const normalized = url.startsWith('//') ? `https:${url}` : url
    const resolvedFileAssetId = fileAssetId || fileAssetIdFromUrl(normalized) || undefined

    // Web: remote URL is enough. No local filesystem cache, no miss noise.
    if (!isNative()) {
      setResolved(normalized)
      return
    }

    // Native: show remote immediately, then upgrade to local cache when ready.
    setResolved(normalized)

    const run = async () => {
      let displayUrl: string | null = normalized
      const ref = {
        url: normalized,
        fileAssetId: resolvedFileAssetId,
        role: 'avatar',
      }
      try {
        const local = await assetCacheService.resolve(ref)
        if (!active) return
        if (local && local !== OFFLINE_RESOURCE_MISSING && isCachedPlaybackUrl(local)) {
          displayUrl = local
        } else if (typeof navigator === 'undefined' || navigator.onLine) {
          const downloaded = await assetCacheService.download(ref)
          if (!active) return
          if (downloaded && downloaded !== OFFLINE_RESOURCE_MISSING) {
            displayUrl = downloaded
          }
        } else {
          displayUrl = null
        }
      } catch {
        displayUrl = typeof navigator !== 'undefined' && !navigator.onLine ? null : normalized
      }
      if (!active) return
      setResolved(displayUrl)

      const assetChanged = Boolean(
        previousUrl
        && (
          (previousAssetId || resolvedFileAssetId)
            ? previousAssetId !== resolvedFileAssetId
            : !sameRemoteAsset(previousUrl, normalized)
        ),
      )
      if (displayUrl && assetChanged && previousUrl) {
        void assetCacheService.removeRef({
          url: previousUrl,
          fileAssetId: previousAssetId || fileAssetIdFromUrl(previousUrl) || undefined,
          assetId: previousAssetId || undefined,
        }).catch(() => {
          // 清理失败不影响显示
        })
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [url, fileAssetId])

  return resolved
}

export interface UserAvatarProps {
  className?: string
  fallbackClassName?: string
}

/**
 * 全局统一用户头像。
 *
 * 数据源统一：user store 的 avatarUrl（App 上传/服务端当前头像）
 * 与 OAuth image（微信/Apple 登录头像）在此合并解析；
 * 渲染统一：离线优先本地缓存图片；
 * fallback 统一：名字首字母。
 */
export function UserAvatar({ className, fallbackClassName }: UserAvatarProps) {
  const { session } = useAuth()
  const avatarUrl = useUserStore((s) => s.avatarUrl)
  const avatarAssetId = useUserStore((s) => s.avatarAssetId)
  const user = session?.user
  const effectiveUrl = avatarUrl || user?.image || null
  const resolved = useResolvedAvatarUrl(effectiveUrl, avatarUrl ? avatarAssetId : null)
  const fallback = (user?.name || user?.email || 'U').slice(0, 1).toUpperCase()

  return (
    <Avatar className={className}>
      <AvatarImage src={resolved ?? undefined} alt={user?.name || 'avatar'} />
      <AvatarFallback className={fallbackClassName}>{fallback}</AvatarFallback>
    </Avatar>
  )
}
