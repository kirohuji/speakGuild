import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { HardDrive, Database, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { IosRow, IosSection } from '@/features/profile/components/ios-components'
import { offlineStorageService, type OfflineCacheCategory, type OfflineStorageStats } from '@/lib/offline'

function formatBytes(bytes?: number) {
  const value = Number(bytes ?? 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function MobileStorageView() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<OfflineStorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState<OfflineCacheCategory | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    offlineStorageService.getStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleClear = useCallback(async (category: OfflineCacheCategory) => {
    setClearing(category)
    try {
      await offlineStorageService.clearCategory(category)
      toast.success(category === 'all' ? t('profile.cacheAllCleared', { defaultValue: '缓存已全部清除' }) : t('profile.cacheCleared', { defaultValue: '缓存已清除' }))
      await offlineStorageService.getStats().then(setStats)
    } catch (error: any) {
      toast.error(error?.message || t('profile.cleanupFailed', { defaultValue: '清理失败' }))
    } finally {
      setClearing(null)
    }
  }, [])

  const totalBytes = stats?.totalCacheBytes ?? 0
  const segments = [
    { key: 'packs' as const, label: t('profile.cachePacks', { defaultValue: '学习包内容' }), value: stats?.downloadedPackBytes ?? 0, color: 'bg-blue-500' },
    { key: 'assets' as const, label: t('profile.cacheAssets', { defaultValue: '资源文件' }), value: stats?.localAssetBytes ?? 0, color: 'bg-emerald-500' },
    { key: 'dictionary' as const, label: t('profile.cacheDictionary', { defaultValue: '词典缓存' }), value: stats?.dictionaryBytes ?? 0, color: 'bg-violet-500' },
    { key: 'expressions' as const, label: t('profile.cacheExpressions', { defaultValue: '学习库缓存' }), value: stats?.expressionBytes ?? 0, color: 'bg-amber-500' },
  ]
  const activeSegments = segments.filter((segment) => segment.value > 0)

  const ClearButton = ({ category }: { category: OfflineCacheCategory }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={loading || clearing !== null}
      onClick={(event) => {
        event.stopPropagation()
        void handleClear(category)
      }}
      className="h-8 px-2 text-xs text-red-500 hover:text-red-600"
    >
      {clearing === category ? t('common.clearing', { defaultValue: '清除中' }) : t('common.clear', { defaultValue: '清除' })}
    </Button>
  )

  return (
    <div className="space-y-5">
      <IosSection header={t('profile.cacheDistribution', { defaultValue: '缓存分布' })}>
        <div className="space-y-4 px-4 py-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{t('profile.totalCache', { defaultValue: '本地缓存总量' })}</span>
              <span className="text-sm text-muted-foreground">{loading ? '...' : formatBytes(totalBytes)}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {activeSegments.length === 0 || totalBytes <= 0 ? (
                <div className="h-full w-full bg-muted-foreground/20" />
              ) : (
                activeSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className={segment.color}
                    style={{ width: `${Math.max((segment.value / totalBytes) * 100, 5)}%` }}
                  />
                ))
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', segment.color)} />
                  <span className="truncate">{segment.label}</span>
                </span>
                <span className="flex-shrink-0 font-medium">{loading ? '...' : formatBytes(segment.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </IosSection>

      <IosSection header={t('profile.localLearningData', { defaultValue: '本地学习数据' })}>
        <IosRow
          icon={HardDrive}
          iconBg="bg-blue-500"
          label={t('profile.downloadedPacks', { defaultValue: '已下载学习包' })}
          subtitle={loading ? undefined : `${stats?.downloadedPackCount ?? 0} ${t('profile.packCount', { defaultValue: '个学习包' })}`}
          right={<ClearButton category="packs" />}
        />
        <IosRow
          icon={Database}
          iconBg="bg-emerald-500"
          label={t('profile.localAssets', { defaultValue: '本地资源文件' })}
          subtitle={loading ? undefined : `${stats?.localAssetCount ?? 0} ${t('profile.fileCount', { defaultValue: '个文件' })} · ${formatBytes(stats?.localAssetBytes)}`}
          right={<ClearButton category="assets" />}
        />
        <IosRow
          label={t('profile.offlineDictionary', { defaultValue: '离线词典缓存' })}
          subtitle={loading ? undefined : `${stats?.dictionaryEntryCount ?? 0} ${t('profile.recordCount', { defaultValue: '条记录' })} · ${formatBytes(stats?.dictionaryBytes)}`}
          right={<ClearButton category="dictionary" />}
        />
        <IosRow
          label={t('profile.expressionCache', { defaultValue: '学习库缓存' })}
          subtitle={loading ? undefined : `${stats?.expressionEntryCount ?? 0} ${t('profile.recordCount', { defaultValue: '条记录' })} · ${formatBytes(stats?.expressionBytes)}`}
          right={<ClearButton category="expressions" />}
          last
        />
      </IosSection>

      <IosSection header={t('profile.syncStatus', { defaultValue: '同步状态' })}>
        <IosRow label={t('profile.pendingSync', { defaultValue: '待同步操作' })} value={loading ? '...' : String(stats?.pendingOutboxCount ?? 0)} last />
      </IosSection>

      <IosSection>
        <IosRow
          icon={Trash2}
          iconBg="bg-red-500"
          label={clearing === 'all' ? t('common.clearing', { defaultValue: '清除中...' }) : t('profile.clearAll', { defaultValue: '全部清除' })}
          subtitle={t('profile.clearAllHint', { defaultValue: '清除学习包、资源文件、词典缓存和学习库缓存' })}
          last
          onTap={clearing ? undefined : () => handleClear('all')}
        />
      </IosSection>
    </div>
  )
}
