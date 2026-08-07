import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useUserStore } from '@/stores/user.store'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { assetCacheService } from '@/lib/offline'

const OFFLINE_MISSING = '__offline_resource_missing__'

/**
 * 将远程头像 URL 解析为可显示 URL：
 * - native：优先返回本地缓存（local_assets）的 URI，离线也能显示；未缓存且在线时下载
 * - web：直接返回原 URL
 * 解析失败/离线且未缓存时返回 null，由 Avatar 组件回退到字母。
 *
 * 头像 URL 变化时，在新头像可用后清理旧头像的本地缓存文件，避免磁盘累积。
 */
function useResolvedAvatarUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null)
  const prevUrlRef = useRef<string | null | undefined>(null)

  useEffect(() => {
    let active = true
    const previous = prevUrlRef.current
    prevUrlRef.current = url
    setResolved(null)
    if (!url) return

    const run = async () => {
      let displayUrl: string | null = null
      try {
        const local = await assetCacheService.resolve({ url })
        if (!active) return
        if (local && local !== OFFLINE_MISSING) {
          displayUrl = local
        } else if (typeof navigator === 'undefined' || navigator.onLine) {
          const downloaded = await assetCacheService.download({ url })
          if (!active) return
          displayUrl = downloaded && downloaded !== OFFLINE_MISSING ? downloaded : url
        }
      } catch {
        displayUrl = null
      }
      if (!active) return
      setResolved(displayUrl)
      // 新头像确认可用后，清理旧头像的本地缓存（幂等，多个组件同时触发无害）
      if (displayUrl && previous && previous !== url) {
        void assetCacheService.removeRef({ url: previous }).catch(() => {
          // 清理失败不影响显示
        })
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [url])

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
  const user = session?.user
  const effectiveUrl = avatarUrl || user?.image || null
  const resolved = useResolvedAvatarUrl(effectiveUrl)
  const fallback = (user?.name || user?.email || 'U').slice(0, 1).toUpperCase()

  return (
    <Avatar className={className}>
      <AvatarImage src={resolved ?? undefined} alt={user?.name || 'avatar'} />
      <AvatarFallback className={fallbackClassName}>{fallback}</AvatarFallback>
    </Avatar>
  )
}
