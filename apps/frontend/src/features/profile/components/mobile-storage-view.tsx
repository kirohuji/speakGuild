import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BrainCircuit, ChevronDown, ChevronRight, Database, Download, Globe2, HardDrive, Loader2, Mic, Smartphone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { IosRow, IosSection } from '@/features/profile/components/ios-components'
import { offlineStorageService, type OfflineCacheCategory, type OfflineStorageDetails, type OfflineStorageStats } from '@/lib/offline'
import { useAuth } from '@/providers/auth-provider'
import { usePreferencesStore } from '@/stores/preferences.store'
import { isNative } from '@/lib/native'
import {
  LOCAL_WARMUP_MODEL_VARIANTS,
  warmupModelManager,
  type LocalWarmupModelStatus,
  type LocalWarmupModelVariantId,
} from '@/lib/local-ai/warmup-model-manager'
import { getCurrentWarmupLocalJudgeModelKey } from '@/lib/local-ai/warmup-local-judge'
import {
  warmupEmbeddingCacheRepository,
  type WarmupEmbeddingCacheStats,
} from '@/lib/local-ai/warmup-embedding-cache.repository'
import {
  LOCAL_STT_MODEL_VARIANTS,
  localSttModelManager,
  type LocalSttModelStatus,
  type LocalSttModelVariantId,
} from '@/lib/local-stt/local-stt-model-manager'

function formatBytes(bytes?: number) {
  const value = Number(bytes ?? 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDateTime(value?: string | null) {
  if (!value) return '' // will be handled by caller with i18n
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileStorageView() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const isAdmin = session?.user?.role === 'admin'
  const [stats, setStats] = useState<OfflineStorageStats | null>(null)
  const [details, setDetails] = useState<OfflineStorageDetails | null>(null)
  const [modelStatus, setModelStatus] = useState<LocalWarmupModelStatus | null>(null)
  const [sttModelStatus, setSttModelStatus] = useState<LocalSttModelStatus | null>(null)
  const [embeddingStats, setEmbeddingStats] = useState<WarmupEmbeddingCacheStats | null>(null)
  const [embeddingModelKey, setEmbeddingModelKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modelLoading, setModelLoading] = useState(true)
  const [sttModelLoading, setSttModelLoading] = useState(true)
  const [clearing, setClearing] = useState<OfflineCacheCategory | null>(null)
  const [embeddingClearing, setEmbeddingClearing] = useState(false)
  const [deletingPackId, setDeletingPackId] = useState<string | null>(null)
  const [modelDeleting, setModelDeleting] = useState(false)
  const [sttModelDeleting, setSttModelDeleting] = useState(false)
  const [modelDownload, setModelDownload] = useState<{ active: boolean; percent: number; file?: string }>({ active: false, percent: 0 })
  const [sttModelDownload, setSttModelDownload] = useState<{ active: boolean; percent: number; file?: string }>({ active: false, percent: 0 })
  const [expanded, setExpanded] = useState<{ packs: boolean; assets: boolean; sync: boolean; models: boolean; sttModels: boolean }>({ packs: false, assets: false, sync: false, models: false, sttModels: false })
  const {
    localAiWarmupJudgeEnabled,
    localAiWarmupModelVariant,
    localSttEnabled,
    localSttModelVariant,
    localSttFallbackToCloud,
    setLocalAiWarmupJudgeEnabled,
    setLocalAiWarmupModelVariant,
    setLocalSttEnabled,
    setLocalSttModelVariant,
    setLocalSttFallbackToCloud,
  } = usePreferencesStore()

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

  const refreshModelStatus = useCallback((variantId: LocalWarmupModelVariantId = localAiWarmupModelVariant) => {
    setModelLoading(true)
    Promise.all([
      warmupModelManager.getStatus(variantId),
      getCurrentWarmupLocalJudgeModelKey().catch(() => null),
    ])
      .then(async ([status, currentModelKey]) => {
        setModelStatus(status)
        setEmbeddingModelKey(currentModelKey)
        setEmbeddingStats(await warmupEmbeddingCacheRepository.getStats(currentModelKey ?? undefined))
      })
      .finally(() => setModelLoading(false))
  }, [localAiWarmupModelVariant])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    refreshModelStatus(localAiWarmupModelVariant)
  }, [localAiWarmupModelVariant, refreshModelStatus])

  const refreshSttModelStatus = useCallback((variantId: LocalSttModelVariantId = localSttModelVariant) => {
    setSttModelLoading(true)
    localSttModelManager.getStatus(variantId)
      .then(setSttModelStatus)
      .finally(() => setSttModelLoading(false))
  }, [localSttModelVariant])

  useEffect(() => {
    refreshSttModelStatus(localSttModelVariant)
  }, [localSttModelVariant, refreshSttModelStatus])

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

  const handleDownloadModel = useCallback(async () => {
    setModelDownload({ active: true, percent: 0 })
    toast.info(t('settings.storage.localModelDownloadStarted', { defaultValue: '本地 AI 模型开始下载' }))
    try {
      await warmupModelManager.download(localAiWarmupModelVariant, (progress) => {
        setModelDownload({ active: true, percent: progress.percent, file: progress.file })
      })
      toast.success(t('settings.storage.localModelDownloaded', { defaultValue: '本地 AI 模型已下载' }))
      refreshModelStatus(localAiWarmupModelVariant)
    } catch (error: any) {
      toast.error(error?.message || t('settings.storage.localModelDownloadFailed', { defaultValue: '模型下载失败' }))
    } finally {
      setModelDownload({ active: false, percent: 0 })
    }
  }, [localAiWarmupModelVariant, refreshModelStatus, t])

  const handleDeleteModel = useCallback(async () => {
    setModelDeleting(true)
    try {
      const currentModelKey = await getCurrentWarmupLocalJudgeModelKey().catch(() => null)
      await warmupModelManager.remove()
      if (currentModelKey) await warmupEmbeddingCacheRepository.clear(currentModelKey)
      setLocalAiWarmupJudgeEnabled(false)
      toast.success(t('settings.storage.localModelDeleted', { defaultValue: '本地 AI 模型已删除' }))
      refresh()
      refreshModelStatus(localAiWarmupModelVariant)
    } catch (error: any) {
      toast.error(error?.message || t('profile.cleanupFailed', { defaultValue: '清理失败' }))
    } finally {
      setModelDeleting(false)
    }
  }, [localAiWarmupModelVariant, refresh, refreshModelStatus, setLocalAiWarmupJudgeEnabled, t])

  const handleClearEmbeddingCache = useCallback(async () => {
    setEmbeddingClearing(true)
    try {
      await warmupEmbeddingCacheRepository.clear(embeddingModelKey ?? undefined)
      toast.success(t('settings.storage.embeddingCacheCleared', { defaultValue: '判题向量缓存已清除' }))
      refresh()
      refreshModelStatus(localAiWarmupModelVariant)
    } catch (error: any) {
      toast.error(error?.message || t('profile.cleanupFailed', { defaultValue: '清理失败' }))
    } finally {
      setEmbeddingClearing(false)
    }
  }, [embeddingModelKey, localAiWarmupModelVariant, refresh, refreshModelStatus, t])

  const handleDownloadSttModel = useCallback(async () => {
    setSttModelDownload({ active: true, percent: 0 })
    toast.info(t('settings.storage.localSttModelDownloadStarted', { defaultValue: '本地 STT 模型开始下载' }))
    try {
      await localSttModelManager.download(localSttModelVariant, (progress) => {
        setSttModelDownload({ active: true, percent: progress.percent, file: progress.file })
      })
      toast.success(t('settings.storage.localSttModelDownloaded', { defaultValue: '本地 STT 模型已下载' }))
      refreshSttModelStatus(localSttModelVariant)
    } catch (error: any) {
      toast.error(error?.message || t('settings.storage.localModelDownloadFailed', { defaultValue: '模型下载失败' }))
    } finally {
      setSttModelDownload({ active: false, percent: 0 })
    }
  }, [localSttModelVariant, refreshSttModelStatus, t])

  const handleDeleteSttModel = useCallback(async () => {
    setSttModelDeleting(true)
    try {
      await localSttModelManager.remove(localSttModelVariant)
      setLocalSttEnabled(false)
      toast.success(t('settings.storage.localSttModelDeleted', { defaultValue: '本地 STT 模型已删除' }))
      refreshSttModelStatus(localSttModelVariant)
    } catch (error: any) {
      toast.error(error?.message || t('profile.cleanupFailed', { defaultValue: '清理失败' }))
    } finally {
      setSttModelDeleting(false)
    }
  }, [localSttModelVariant, refreshSttModelStatus, setLocalSttEnabled, t])

  const totalBytes = stats?.totalCacheBytes ?? 0
  const segments = [
    { key: 'packs' as const, label: t('profile.cachePacks', { defaultValue: '学习包内容' }), value: stats?.downloadedPackBytes ?? 0, color: 'bg-blue-500' },
    { key: 'assets' as const, label: t('profile.cacheAssets', { defaultValue: '资源文件' }), value: stats?.localAssetBytes ?? 0, color: 'bg-emerald-500' },
    { key: 'dictionary' as const, label: t('profile.cacheDictionary', { defaultValue: '词典缓存' }), value: stats?.dictionaryBytes ?? 0, color: 'bg-violet-500' },
    { key: 'expressions' as const, label: t('profile.cacheExpressions', { defaultValue: '学习库缓存' }), value: stats?.expressionBytes ?? 0, color: 'bg-amber-500' },
    { key: 'embeddings' as const, label: t('settings.storage.embeddingCache', { defaultValue: '判题向量缓存' }), value: stats?.embeddingCacheBytes ?? 0, color: 'bg-cyan-500' },
  ]
  const activeSegments = segments.filter((segment) => segment.value > 0)
  const selectedVariant = LOCAL_WARMUP_MODEL_VARIANTS.find((variant) => variant.id === localAiWarmupModelVariant) ?? LOCAL_WARMUP_MODEL_VARIANTS[0]
  const selectedSttVariant = LOCAL_STT_MODEL_VARIANTS.find((variant) => variant.id === localSttModelVariant) ?? LOCAL_STT_MODEL_VARIANTS[0]
  const modelInstalled = Boolean(modelStatus?.installed)
  const sttModelInstalled = Boolean(sttModelStatus?.installed)
  const modelUnavailable = modelStatus?.nativeAvailable === false
  const sttModelUnavailable = sttModelStatus?.nativeAvailable === false
  const isNativeRuntime = isNative()
  const modelRuntimeLabel = isNativeRuntime
    ? t('settings.storage.localModelRuntimeCapacitor', { defaultValue: 'Capacitor 端' })
    : t('settings.storage.localModelRuntimeWeb', { defaultValue: 'Web 端' })

  function getModelStatusText(): string {
    // Web 端有浏览器缓存能力
    if (!isNativeRuntime && modelStatus?.nativeAvailable) {
      return t('settings.storage.localModelWebReady', { defaultValue: '浏览器缓存 · 首次在线加载' })
    }
    // 原生不可用
    if (modelUnavailable) {
      return t('settings.storage.localModelNativeOnly', { defaultValue: '仅支持 iOS / Android App' })
    }
    // 正在下载
    if (modelDownload.active) {
      return t('settings.storage.localModelDownloading', {
        percent: modelDownload.percent,
        defaultValue: `下载中 ${modelDownload.percent}%`,
      })
    }
    // 加载中
    if (modelLoading) return '...'
    // 已下载
    if (modelInstalled) {
      return `${t('settings.storage.localModelInstalled', { defaultValue: '已下载' })} · ${formatBytes(modelStatus?.bytes)}`
    }
    // 需要重新下载
    if (modelStatus?.health === 'manifest_missing' || modelStatus?.health === 'manifest_mismatch') {
      return `${t('settings.storage.localModelNeedsRedownload', { defaultValue: '需要重新下载' })} · ${formatBytes(modelStatus?.bytes)}`
    }
    // 未下载
    return `${t('settings.storage.localModelNotInstalled', { defaultValue: '未下载' })} · ${formatBytes(selectedVariant.estimatedBytes)}`
  }

  function getSttModelStatusText(): string {
    if (!isNativeRuntime && sttModelStatus?.nativeAvailable) {
      return t('settings.storage.localSttModelWebReady', { defaultValue: '浏览器缓存 · 首次在线加载' })
    }
    if (sttModelUnavailable) {
      return t('settings.storage.localModelNativeOnly', { defaultValue: '仅支持 iOS / Android App' })
    }
    if (sttModelDownload.active) {
      return t('settings.storage.localModelDownloading', {
        percent: sttModelDownload.percent,
        defaultValue: `下载中 ${sttModelDownload.percent}%`,
      })
    }
    if (sttModelLoading) return '...'
    if (sttModelInstalled) {
      return `${t('settings.storage.localModelInstalled', { defaultValue: '已下载' })} · ${formatBytes(sttModelStatus?.bytes)}`
    }
    if (sttModelStatus?.health === 'manifest_missing' || sttModelStatus?.health === 'manifest_mismatch') {
      return `${t('settings.storage.localModelNeedsRedownload', { defaultValue: '需要重新下载' })} · ${formatBytes(sttModelStatus?.bytes)}`
    }
    return `${t('settings.storage.localModelNotInstalled', { defaultValue: '未下载' })} · ${formatBytes(selectedSttVariant.estimatedBytes)}`
  }

  const modelStatusText = getModelStatusText()
  const sttModelStatusText = getSttModelStatusText()
  const embeddingCacheCount = embeddingModelKey ? embeddingStats?.currentModelCount ?? 0 : embeddingStats?.count ?? 0
  const embeddingCacheBytes = embeddingModelKey ? embeddingStats?.currentModelBytes ?? 0 : embeddingStats?.bytes ?? 0

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
      <span className="text-xs font-medium tabular-nums">
        {count ?? 0} {t('profile.fileCount', { defaultValue: '个文件' })} · {formatBytes(bytes)}
      </span>
    </div>
  )

  const outboxLabel = (type: string) => ({
    my_unit: t('settings.storage.outboxLearningPlan'),
    word_entry: t('settings.storage.outboxWordEntry'),
    chunk_entry: t('settings.storage.outboxChunkEntry'),
    pattern_entry: t('settings.storage.outboxPatternEntry'),
    practice_session: t('settings.storage.outboxPracticeSession'),
    practice_turn: t('settings.storage.outboxPracticeTurn'),
    warmup_records: t('settings.storage.outboxWarmupRecords'),
    learning_pack: t('settings.storage.outboxLearningPack'),
    daily_practice: t('settings.storage.outboxDailyPractice'),
  } as Record<string, string>)[type] ?? type

  const operationLabel = (operation: string) => ({
    create: t('settings.storage.opCreate'),
    update: t('settings.storage.opUpdate'),
    delete: t('settings.storage.opDelete'),
  } as Record<string, string>)[operation] ?? operation

  const detailContainerClass = 'border-b border-border/50 bg-muted/10 pl-[4.5rem] pr-4'
  const detailRowClass = 'border-b border-border/50 py-3 last:border-b-0'

  // 计算中动画：立即展示，Web 端最短停留 2 秒；Capacitor 端数据到了就消
  const [showCalculating, setShowCalculating] = useState(false)
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdActiveRef = React.useRef(false)

  useEffect(() => {
    if (loading && !stats) {
      setShowCalculating(true)
      holdActiveRef.current = false
    }
  }, [loading, stats])

  useEffect(() => {
    if (!loading && stats && !holdActiveRef.current) {
      holdActiveRef.current = true
      if (isNativeRuntime) {
        // Capacitor 端数据到了直接消，不额外等待
        setShowCalculating(false)
        holdActiveRef.current = false
      } else {
        // Web 端保留最短停留，确保用户能看到动画
        holdTimerRef.current = setTimeout(() => {
          setShowCalculating(false)
          holdActiveRef.current = false
        }, 2000)
      }
    }
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [loading, stats])

  const showRefreshing = loading && stats

  // ── iOS 风格"计算中"加载态 ──
  if (showCalculating) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
          <div className="relative flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        </div>
        <p className="mt-5 text-sm font-medium text-foreground">
          {t('profile.calculating', { defaultValue: '正在计算缓存大小…' })}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('profile.calculatingHint', { defaultValue: '这可能需要几秒钟' })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 刷新中顶部指示器 */}
      {showRefreshing && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-transparent">
          <div className="h-full w-1/3 animate-[mobile-progress_1.1s_ease-in-out_infinite] rounded-full bg-primary/70" />
        </div>
      )}

      <IosSection header={t('profile.cacheDistribution', { defaultValue: '缓存分布' })}>
        <div className="space-y-4 px-4 py-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{t('profile.totalCache', { defaultValue: '本地缓存总量' })}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{formatBytes(totalBytes)}</span>
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
                <span className="flex-shrink-0 font-medium tabular-nums">{formatBytes(segment.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </IosSection>

      <IosSection header={t('settings.storage.localAiModels', { defaultValue: '本地 AI 模型' })}>
        <IosRow
          icon={BrainCircuit}
          iconBg="bg-indigo-500"
          label={t('settings.storage.warmupJudgeModel', { defaultValue: '知识点判题模型' })}
          subtitle={`${t(`settings.storage.localModelVariants.${selectedVariant.id}.label`)} · ${modelStatusText}`}
          right={(
            <div className="flex items-center gap-1.5">
              {isNativeRuntime && modelInstalled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={modelDeleting || modelDownload.active}
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDeleteModel()
                  }}
                  className="h-8 px-2 text-xs text-red-500 hover:text-red-600"
                >
                  {modelDeleting ? t('settings.storage.deleting') : t('settings.storage.deleteText')}
                </Button>
              ) : isNativeRuntime ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={modelUnavailable || modelDownload.active}
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDownloadModel()
                  }}
                  className="h-8 px-2 text-xs text-primary"
                >
                  <Download className="mr-1 size-3.5" />
                  {modelDownload.active ? t('settings.storage.downloading', { defaultValue: '下载中' }) : t('settings.storage.download', { defaultValue: '下载' })}
                </Button>
              ) : (
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {modelRuntimeLabel}
                </span>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setExpanded((current) => ({ ...current, models: !current.models }))
                }}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted/60"
              >
                <ToggleIcon open={expanded.models} />
              </button>
            </div>
          )}
        />
        {expanded.models && (
          <div className={detailContainerClass}>
            <div className="space-y-3 py-3">
              <div className="grid grid-cols-1 gap-2">
                {LOCAL_WARMUP_MODEL_VARIANTS.map((variant) => {
                  const active = variant.id === localAiWarmupModelVariant
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={modelDownload.active}
                      onClick={() => setLocalAiWarmupModelVariant(variant.id)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-left transition-colors',
                        active ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-background/60 active:bg-muted/60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold">{t(`settings.storage.localModelVariants.${variant.id}.label`)}</span>
                        <span className="text-[11px] text-muted-foreground">{formatBytes(variant.estimatedBytes)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{t(`settings.storage.localModelVariants.${variant.id}.description`)}</p>
                    </button>
                  )
                })}
              </div>

              {modelDownload.active && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{modelDownload.file ?? t('settings.storage.downloading', { defaultValue: '下载中' })}</span>
                    <span>{modelDownload.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, modelDownload.percent))}%` }} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className={cn(
                  'rounded-md border px-3 py-2',
                  !isNativeRuntime ? 'border-primary/45 bg-primary/10' : 'border-border/60 bg-background/60',
                )}>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Globe2 className="size-3.5" />
                    {t('settings.storage.localModelRuntimeWeb', { defaultValue: 'Web 端' })}
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {t('settings.storage.localModelWebModeDesc', { defaultValue: '首次判题时在线加载，之后复用浏览器模型缓存。' })}
                  </p>
                </div>
                <div className={cn(
                  'rounded-md border px-3 py-2',
                  isNativeRuntime ? 'border-primary/45 bg-primary/10' : 'border-border/60 bg-background/60',
                )}>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Smartphone className="size-3.5" />
                    {t('settings.storage.localModelRuntimeCapacitor', { defaultValue: 'Capacitor 端' })}
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {t('settings.storage.localModelCapacitorModeDesc', { defaultValue: '模型文件下载到 App 数据目录，校验完整后可离线判题。' })}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] leading-5 text-muted-foreground">
                <p>{t('settings.storage.localModelPath', { defaultValue: '存储位置' })}: {isNativeRuntime ? 'Directory.Data / ai-models' : t('settings.storage.localModelBrowserCache', { defaultValue: '浏览器模型缓存' })}</p>
                <p>{t('settings.storage.localModelFiles', { defaultValue: '文件' })}: config.json · tokenizer.json · onnx/{selectedVariant.modelFile.split('/').pop()}</p>
                {modelStatus?.updatedAt && <p>{t('settings.storage.updated', { updated: formatDateTime(modelStatus.updatedAt) || t('settings.storage.unknownTime') })}</p>}
                {modelStatus?.missingFiles.length ? (
                  <p className="line-clamp-2 text-amber-600">{t('settings.storage.localModelMissing', { defaultValue: '缺少文件' })}: {modelStatus.missingFiles.join(', ')}</p>
                ) : null}
                {modelStatus?.health === 'manifest_missing' || modelStatus?.health === 'manifest_mismatch' ? (
                  <p className="text-amber-600">{t('settings.storage.localModelNeedsRedownloadHint', { defaultValue: '模型记录不完整，请重新下载后再启用本地判断' })}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{t('settings.storage.embeddingCache', { defaultValue: '判题向量缓存' })}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                    {modelLoading
                      ? '...'
                      : `${embeddingCacheCount} ${t('profile.recordCount', { defaultValue: '条记录' })} · ${formatBytes(embeddingCacheBytes)}`}
                  </p>
                  {(embeddingStats?.count ?? 0) > embeddingCacheCount && (
                    <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground/75">
                      {t('settings.storage.embeddingCacheOtherModels', {
                        count: (embeddingStats?.count ?? 0) - embeddingCacheCount,
                        defaultValue: `其他模型 ${(embeddingStats?.count ?? 0) - embeddingCacheCount} 条`,
                      })}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={modelLoading || embeddingClearing || embeddingCacheCount === 0}
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleClearEmbeddingCache()
                  }}
                  className="h-8 px-2 text-xs text-red-500 hover:text-red-600"
                >
                  {embeddingClearing ? t('common.clearing', { defaultValue: '清除中' }) : t('common.clear', { defaultValue: '清除' })}
                </Button>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t('settings.localAiWarmupJudge')}</p>
                    <p className="text-xs text-muted-foreground">
                      {localAiWarmupJudgeEnabled ? t('settings.localAiWarmupJudgeOn') : t('settings.localAiWarmupJudgeOff')}
                    </p>
                  </div>
                  <Switch
                    checked={localAiWarmupJudgeEnabled}
                    disabled={!modelInstalled}
                    onCheckedChange={setLocalAiWarmupJudgeEnabled}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        <IosRow
          icon={Mic}
          iconBg="bg-emerald-500"
          label={t('settings.storage.localSttModel', { defaultValue: '本地语音识别模型' })}
          subtitle={`${selectedSttVariant.label} · ${sttModelStatusText}`}
          right={(
            <div className="flex items-center gap-1.5">
              {isNativeRuntime && sttModelInstalled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={sttModelDeleting || sttModelDownload.active}
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDeleteSttModel()
                  }}
                  className="h-8 px-2 text-xs text-red-500 hover:text-red-600"
                >
                  {sttModelDeleting ? t('settings.storage.deleting') : t('settings.storage.deleteText')}
                </Button>
              ) : isNativeRuntime ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={sttModelUnavailable || sttModelDownload.active}
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDownloadSttModel()
                  }}
                  className="h-8 px-2 text-xs text-primary"
                >
                  <Download className="mr-1 size-3.5" />
                  {sttModelDownload.active ? t('settings.storage.downloading', { defaultValue: '下载中' }) : t('settings.storage.download', { defaultValue: '下载' })}
                </Button>
              ) : (
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {modelRuntimeLabel}
                </span>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setExpanded((current) => ({ ...current, sttModels: !current.sttModels }))
                }}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted/60"
              >
                <ToggleIcon open={expanded.sttModels} />
              </button>
            </div>
          )}
        />
        {expanded.sttModels && (
          <div className={detailContainerClass}>
            <div className="space-y-3 py-3">
              <div className="grid grid-cols-1 gap-2">
                {LOCAL_STT_MODEL_VARIANTS.map((variant) => {
                  const active = variant.id === localSttModelVariant
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={sttModelDownload.active}
                      onClick={() => setLocalSttModelVariant(variant.id)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-left transition-colors',
                        active ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-background/60 active:bg-muted/60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold">{variant.label}</span>
                        <span className="text-[11px] text-muted-foreground">{formatBytes(variant.estimatedBytes)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        {variant.id === 'tiny-en-q8'
                          ? t('settings.storage.localSttTinyDesc', { defaultValue: '更轻，适合移动端快速识别。' })
                          : variant.id === 'base-en-q8'
                            ? t('settings.storage.localSttBaseDesc', { defaultValue: '准确率和体积更均衡。' })
                            : t('settings.storage.localSttSmallDesc', { defaultValue: '更准但更大，适合高频口语练习。' })}
                      </p>
                    </button>
                  )
                })}
              </div>

              {sttModelDownload.active && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{sttModelDownload.file ?? t('settings.storage.downloading', { defaultValue: '下载中' })}</span>
                    <span>{sttModelDownload.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, sttModelDownload.percent))}%` }} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5 text-[11px] leading-5 text-muted-foreground">
                <p>{t('settings.storage.localModelPath', { defaultValue: '存储位置' })}: {isNativeRuntime ? 'Directory.Data / local-stt-models' : t('settings.storage.localModelBrowserCache', { defaultValue: '浏览器模型缓存' })}</p>
                <p>{t('settings.storage.localModelFiles', { defaultValue: '文件' })}: config.json · tokenizer.json · onnx/encoder_model_quantized.onnx · onnx/decoder_model_merged_quantized.onnx</p>
                {sttModelStatus?.updatedAt && <p>{t('settings.storage.updated', { updated: formatDateTime(sttModelStatus.updatedAt) || t('settings.storage.unknownTime') })}</p>}
                {sttModelStatus?.missingFiles.length ? (
                  <p className="line-clamp-2 text-amber-600">{t('settings.storage.localModelMissing', { defaultValue: '缺少文件' })}: {sttModelStatus.missingFiles.join(', ')}</p>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-border/50 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t('settings.localStt', { defaultValue: '使用本地语音识别' })}</p>
                    <p className="text-xs text-muted-foreground">
                      {localSttEnabled
                        ? t('settings.localSttOn', { defaultValue: '录音优先用本地 Whisper 转写' })
                        : t('settings.localSttOff', { defaultValue: '录音使用云端 Whisper 转写' })}
                    </p>
                  </div>
                  <Switch
                    checked={localSttEnabled}
                    disabled={isNativeRuntime && !sttModelInstalled}
                    onCheckedChange={setLocalSttEnabled}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t('settings.localSttFallback', { defaultValue: '失败时回退云端' })}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.localSttFallbackHint', { defaultValue: '本地识别失败或模型未准备好时，联网状态下自动使用云端。' })}
                    </p>
                  </div>
                  <Switch checked={localSttFallbackToCloud} onCheckedChange={setLocalSttFallbackToCloud} />
                </div>
              </div>
            </div>
          </div>
        )}
      </IosSection>

      <IosSection header={t('profile.localLearningData', { defaultValue: '本地学习数据' })}>
        <IosRow
          icon={HardDrive}
          iconBg="bg-blue-500"
          label={t('profile.downloadedPacks', { defaultValue: '已下载学习包' })}
          subtitle={`${stats?.downloadedPackCount ?? 0} ${t('profile.packCount', { defaultValue: '个学习包' })} · ${stats?.offlineVocabularyCount ?? 0} ${t('settings.storage.words')}`}
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
            {!details?.packs.length ? (
              <p className="py-3 text-xs text-muted-foreground">{t('settings.storage.noPacks')}</p>
            ) : (
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
                        {deletingPackId === pack.packId ? t('settings.storage.deleting') : t('settings.storage.deleteText')}
                      </button>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                      {pack.topicCount} {t('settings.storage.topicsUnit')} · {pack.vocabularyCount} {t('settings.storage.words')} · {pack.chunkCount} {t('settings.storage.chunksUnit')} · {pack.patternCount} {t('settings.storage.patternsUnit')}
                    </p>
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      {pack.assetCount} {t('settings.storage.resources')} · {formatBytes(pack.bytes)}
                    </p>
                    <p className="text-[10px] leading-4 text-muted-foreground/80">
                      {t('settings.storage.installed', { installed: formatDateTime(pack.installedAt) || t('settings.storage.unknownTime') })} · {t('settings.storage.updated', { updated: formatDateTime(pack.updatedAt) || t('settings.storage.unknownTime') })}
                    </p>
                    {pack.lastError && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-red-500">{pack.lastError}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <IosRow
          icon={Database}
          iconBg="bg-emerald-500"
          label={t('profile.localAssets', { defaultValue: '本地资源文件' })}
          subtitle={`${stats?.localAssetCount ?? 0} ${t('profile.fileCount', { defaultValue: '个文件' })} · ${formatBytes(stats?.localAssetBytes)} · ${stats?.audioAssetCount ?? 0} ${t('settings.storage.audio')} · ${stats?.imageAssetCount ?? 0} ${t('settings.storage.images')}`}
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
            <AssetStatRow label={t('settings.storage.audioAssets')} count={details?.assets.audio.count} bytes={details?.assets.audio.bytes} />
            <AssetStatRow label={t('settings.storage.imageAssets')} count={details?.assets.image.count} bytes={details?.assets.image.bytes} />
            <AssetStatRow label={t('settings.storage.otherAssets')} count={details?.assets.other.count} bytes={details?.assets.other.bytes} />
            {(details?.assets.failed.count ?? 0) > 0 && (
              <AssetStatRow label={t('settings.storage.failedAssets')} count={details?.assets.failed.count} bytes={details?.assets.failed.bytes} />
            )}
          </div>
        )}
        <IosRow
          label={t('profile.offlineDictionary', { defaultValue: '离线词典缓存' })}
          subtitle={`${stats?.dictionaryEntryCount ?? 0} ${t('profile.recordCount', { defaultValue: '条记录' })} · ${formatBytes(stats?.dictionaryBytes)}`}
          right={<ClearButton category="dictionary" />}
        />
        <IosRow
          label={t('profile.expressionCache', { defaultValue: '学习库缓存' })}
          subtitle={`${stats?.expressionEntryCount ?? 0} ${t('profile.recordCount', { defaultValue: '条记录' })} · ${formatBytes(stats?.expressionBytes)}`}
          right={<ClearButton category="expressions" />}
          last
        />
      </IosSection>

      <IosSection header={t('profile.syncStatus', { defaultValue: '同步状态' })}>
        <IosRow
          label={t('profile.pendingSync', { defaultValue: '待同步操作' })}
          value={String(stats?.pendingOutboxCount ?? 0)}
          onTap={() => setExpanded((current) => ({ ...current, sync: !current.sync }))}
          right={<div className="flex items-center gap-1 text-muted-foreground"><span className="text-sm tabular-nums">{String(stats?.pendingOutboxCount ?? 0)}</span><ToggleIcon open={expanded.sync} /></div>}
          last={!expanded.sync}
        />
        {expanded.sync && (
          <div className="bg-muted/10 pl-4 pr-4">
            {!details?.outbox.length ? (
              <p className="py-3 text-xs text-muted-foreground">{t('settings.storage.noPendingOps')}</p>
            ) : (
              <div>
                {details.outbox.map((item) => (
                  <div key={item.id} className={detailRowClass}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium">{outboxLabel(item.entityType)} · {operationLabel(item.operation)}</p>
                      <span className={cn('flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', item.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600')}>
                        {item.status === 'failed' ? t('settings.storage.statusFailed') : item.status === 'syncing' ? t('settings.storage.statusSyncing') : t('settings.storage.statusPending')}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] leading-5 text-muted-foreground">{item.entityId}</p>
                    {item.lastError && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-red-500">{item.lastError}</p>}
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{t('settings.storage.retryCount', { count: item.retryCount })} · {new Date(item.updatedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </IosSection>

      <IosSection header="测试数据">
        <IosRow
          icon={Trash2}
          iconBg="bg-orange-500"
          label={clearing === 'practice' ? t('common.clearing', { defaultValue: '清除中...' }) : '清空练习测试数据'}
          subtitle="清除今日任务、知识点练习、练习记录、进度和相关待同步操作；保留学习包与资源缓存"
          last
          onTap={clearing ? undefined : () => handleClear('practice')}
        />
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
