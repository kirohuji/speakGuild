import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Database, HardDrive, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { IosRow, IosSection } from '@/features/profile/components/ios-components'
import { offlineStorageService, type OfflineCacheCategory, type OfflineStorageDetails, type OfflineStorageStats } from '@/lib/offline'

function formatBytes(bytes?: number) {
  const value = Number(bytes ?? 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDateTime(value?: string | null) {
  if (!value) return '未知时间'
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileStorageView() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<OfflineStorageStats | null>(null)
  const [details, setDetails] = useState<OfflineStorageDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState<OfflineCacheCategory | null>(null)
  const [deletingPackId, setDeletingPackId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<{ packs: boolean; assets: boolean; sync: boolean }>({ packs: false, assets: false, sync: false })

  const refresh = useCallback(() => {
    setLoading(true)
    Promise.all([offlineStorageService.getStats(), offlineStorageService.getDetails()])
      .then(([nextStats, nextDetails]) => {
        console.log('[learning-pack] mobile storage view packs', nextDetails.packs.map((pack) => ({
          packId: pack.packId,
          title: pack.title,
          storedVersion: pack.version,
          status: pack.status,
          installedAt: pack.installedAt,
          updatedAt: pack.updatedAt,
        })))
        setStats(nextStats)
        setDetails(nextDetails)
      })
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
      refresh()
    } catch (error: any) {
      toast.error(error?.message || t('profile.cleanupFailed', { defaultValue: '清理失败' }))
    } finally {
      setClearing(null)
    }
  }, [refresh, t])

  const handleClearPack = useCallback(async (packId: string) => {
    setDeletingPackId(packId)
    try {
      await offlineStorageService.clearPack(packId)
      toast.success(t('profile.cacheCleared', { defaultValue: '缓存已清除' }))
      refresh()
    } catch (error: any) {
      toast.error(error?.message || t('profile.cleanupFailed', { defaultValue: '清理失败' }))
    } finally {
      setDeletingPackId(null)
    }
  }, [refresh, t])

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

  const ToggleIcon = ({ open }: { open: boolean }) => (
    open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />
  )

  const AssetStatRow = ({ label, count, bytes }: { label: string; count?: number; bytes?: number }) => (
    <div className="flex items-center justify-between border-b border-border/50 py-2.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">
        {loading ? '...' : `${count ?? 0} ${t('profile.fileCount', { defaultValue: '个文件' })} · ${formatBytes(bytes)}`}
      </span>
    </div>
  )

  const outboxLabel = (type: string) => ({
    my_unit: '学习计划',
    word_entry: '生词本',
    chunk_entry: '句块库',
    pattern_entry: '句型库',
    practice_session: '练习会话',
    practice_turn: '练习回答',
    warmup_records: '练习话题',
    learning_pack: '学习包',
    daily_practice: '今日练习',
  } as Record<string, string>)[type] ?? type

  const operationLabel = (operation: string) => ({
    create: '新增',
    update: '更新',
    delete: '删除',
  } as Record<string, string>)[operation] ?? operation

  const detailContainerClass = 'border-b border-border/50 bg-muted/10 pl-[4.5rem] pr-4'
  const detailRowClass = 'border-b border-border/50 py-3 last:border-b-0'

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
          subtitle={loading ? undefined : `${stats?.downloadedPackCount ?? 0} ${t('profile.packCount', { defaultValue: '个学习包' })} · ${stats?.offlineVocabularyCount ?? 0} 单词`}
          right={(
            <div className="flex items-center gap-1.5">
              <ClearButton category="packs" />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setExpanded((current) => ({ ...current, packs: !current.packs }))
                }}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted/60"
              >
                <ToggleIcon open={expanded.packs} />
              </button>
            </div>
          )}
        />
        {expanded.packs && (
          <div className={detailContainerClass}>
            {loading ? (
              <p className="py-3 text-xs text-muted-foreground">...</p>
            ) : details?.packs.length ? (
              <div>
                {details.packs.map((pack) => (
                  <div key={pack.packId} className={detailRowClass}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex flex-1 items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-medium">{pack.title}</p>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          v{pack.version}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(deletingPackId)}
                        onClick={() => void handleClearPack(pack.packId)}
                        className="h-7 flex-shrink-0 rounded-full px-2 text-xs font-medium text-red-500 disabled:opacity-50 active:bg-red-500/10"
                      >
                        {deletingPackId === pack.packId ? '删除中' : '删除'}
                      </button>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                      {pack.topicCount} 话题 · {pack.vocabularyCount} 单词 · {pack.chunkCount} 句块 · {pack.patternCount} 句型
                    </p>
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      {pack.assetCount} 资源 · {formatBytes(pack.bytes)}
                    </p>
                    <p className="text-[10px] leading-4 text-muted-foreground/80">
                      安装 {formatDateTime(pack.installedAt)} · 更新 {formatDateTime(pack.updatedAt)}
                    </p>
                    {pack.lastError && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-red-500">{pack.lastError}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-3 text-xs text-muted-foreground">暂无已下载学习包</p>
            )}
          </div>
        )}
        <IosRow
          icon={Database}
          iconBg="bg-emerald-500"
          label={t('profile.localAssets', { defaultValue: '本地资源文件' })}
          subtitle={loading ? undefined : `${stats?.localAssetCount ?? 0} ${t('profile.fileCount', { defaultValue: '个文件' })} · ${formatBytes(stats?.localAssetBytes)} · ${stats?.audioAssetCount ?? 0} 音频 · ${stats?.imageAssetCount ?? 0} 图片`}
          right={(
            <div className="flex items-center gap-1.5">
              <ClearButton category="assets" />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setExpanded((current) => ({ ...current, assets: !current.assets }))
                }}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted/60"
              >
                <ToggleIcon open={expanded.assets} />
              </button>
            </div>
          )}
        />
        {expanded.assets && (
          <div className={detailContainerClass}>
            <AssetStatRow label="音频资源" count={details?.assets.audio.count} bytes={details?.assets.audio.bytes} />
            <AssetStatRow label="图片资源" count={details?.assets.image.count} bytes={details?.assets.image.bytes} />
            <AssetStatRow label="其它资源" count={details?.assets.other.count} bytes={details?.assets.other.bytes} />
            {(details?.assets.failed.count ?? 0) > 0 && (
              <AssetStatRow label="失败资源" count={details?.assets.failed.count} bytes={details?.assets.failed.bytes} />
            )}
          </div>
        )}
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
        <IosRow
          label={t('profile.pendingSync', { defaultValue: '待同步操作' })}
          value={loading ? '...' : String(stats?.pendingOutboxCount ?? 0)}
          onTap={() => setExpanded((current) => ({ ...current, sync: !current.sync }))}
          right={<div className="flex items-center gap-1 text-muted-foreground"><span className="text-sm">{loading ? '...' : String(stats?.pendingOutboxCount ?? 0)}</span><ToggleIcon open={expanded.sync} /></div>}
          last={!expanded.sync}
        />
        {expanded.sync && (
          <div className="bg-muted/10 pl-4 pr-4">
            {loading ? (
              <p className="py-3 text-xs text-muted-foreground">...</p>
            ) : details?.outbox.length ? (
              <div>
                {details.outbox.map((item) => (
                  <div key={item.id} className={detailRowClass}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium">{outboxLabel(item.entityType)} · {operationLabel(item.operation)}</p>
                      <span className={cn('flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', item.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600')}>
                        {item.status === 'failed' ? '失败' : item.status === 'syncing' ? '同步中' : '待同步'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] leading-5 text-muted-foreground">{item.entityId}</p>
                    {item.lastError && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-red-500">{item.lastError}</p>}
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">重试 {item.retryCount} 次 · {new Date(item.updatedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-3 text-xs text-muted-foreground">没有待同步操作</p>
            )}
          </div>
        )}
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
