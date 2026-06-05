import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Smartphone, Search, Plus, Trash2, Power, PowerOff,
  ChevronLeft, ChevronRight, Loader2, ArrowLeft, ShieldAlert,
  Upload, FileArchive, Globe, CheckCircle2, XCircle, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/cn';
import { useAuth } from '@/providers/auth-provider';
import { get, post, patch, del } from '@/lib/request';
import { FileUploadField } from '@/features/admin/components/file-upload-field';

// ─── Types ──────────────────────────────────────────────────

interface MobileBundle {
  id: string;
  version: string;
  platform: string;
  channel: string;
  assetId: string;
  checksum: string;
  minNativeVersion: string | null;
  rolloutPercent: number;
  enabled: boolean;
  isMandatory: boolean;
  releaseNotes: string | null;
  createdAt: string;
  updatedAt: string;
  asset?: {
    id: string;
    filename: string;
    cosKey: string;
    size: number;
    mimeType: string;
  };
}

interface BundleListResult {
  items: MobileBundle[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Helpers ────────────────────────────────────────────────

const platformLabel = (p: string) => p === 'ios' ? 'iOS' : p === 'android' ? 'Android' : p;
const platformColor = (p: string): 'default' | 'secondary' | 'outline' =>
  p === 'ios' ? 'default' : 'secondary';

const channelLabel = (c: string) => c === 'production' ? '正式版' : c === 'staging' ? '预发布' : c;
const channelColor = (c: string) => c === 'production' ? 'default' : 'outline';

const fmtSize = (bytes: number | undefined) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
});

const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n) + '...' : s;

// ─── Create/Edit Dialog ─────────────────────────────────────

function BundleFormDialog({
  open,
  onOpenChange,
  bundle,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle?: MobileBundle | null;
  onSaved: () => void;
}) {
  const isEdit = !!bundle;
  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('ios');
  const [channel, setChannel] = useState('production');
  const [assetId, setAssetId] = useState('');
  const [checksum, setChecksum] = useState('');
  const [minNativeVersion, setMinNativeVersion] = useState('');
  const [rolloutPercent, setRolloutPercent] = useState(100);
  const [enabled, setEnabled] = useState(true);
  const [isMandatory, setIsMandatory] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bundle) {
      setVersion(bundle.version);
      setPlatform(bundle.platform);
      setChannel(bundle.channel);
      setAssetId(bundle.assetId);
      setChecksum(bundle.checksum);
      setMinNativeVersion(bundle.minNativeVersion || '');
      setRolloutPercent(bundle.rolloutPercent);
      setEnabled(bundle.enabled);
      setIsMandatory(bundle.isMandatory ?? false);
      setReleaseNotes(bundle.releaseNotes || '');
    } else {
      setVersion('');
      setPlatform('ios');
      setChannel('production');
      setAssetId('');
      setChecksum('');
      setMinNativeVersion('');
      setRolloutPercent(100);
      setEnabled(true);
      setIsMandatory(false);
      setReleaseNotes('');
    }
  }, [bundle, open]);

  const handleSave = async () => {
    if (!version || !platform || !assetId || !checksum) return;
    setSaving(true);
    try {
      if (isEdit) {
        await patch(`/admin/mobile-bundles/${bundle!.id}`, {
          assetId: assetId || undefined,
          checksum: checksum || undefined,
          minNativeVersion: minNativeVersion || undefined,
          rolloutPercent,
          enabled,
          isMandatory: isMandatory || undefined,
          releaseNotes: releaseNotes || undefined,
        });
      } else {
        await post('/admin/mobile-bundles', {
          version,
          platform,
          channel,
          assetId,
          checksum,
          minNativeVersion: minNativeVersion || undefined,
          rolloutPercent,
          enabled,
          isMandatory: isMandatory || undefined,
          releaseNotes: releaseNotes || undefined,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Save bundle failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑安装包' : '新增安装包'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改版本信息、灰度比例或启用状态' : '填写版本信息，关联已上传到 COS 的 zip 文件'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!isEdit && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bundle-version">版本号 *</Label>
                <Input
                  id="bundle-version"
                  placeholder="如 1.2.3"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bundle-platform">平台 *</Label>
                  <select
                    id="bundle-platform"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    <option value="ios">iOS</option>
                    <option value="android">Android</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bundle-channel">渠道</Label>
                  <select
                    id="bundle-channel"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    <option value="production">正式版</option>
                    <option value="staging">预发布</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>安装包文件 (zip) *</Label>
            <FileUploadField
              accept=".zip"
              group="mobile_bundle"
              uploadLabel="上传 zip"
              placeholder="点击上传或拖拽 .zip 文件到 COS"
              onUploaded={(_cosUrl, id) => setAssetId(id)}
              className={assetId ? 'border-emerald-500/50' : ''}
            />
            {assetId ? (
              <p className="text-xs text-emerald-600">已上传: {assetId}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                或手动输入已存在的
                <button
                  type="button"
                  className="ml-1 underline hover:text-foreground"
                  onClick={() => {
                    const id = prompt('请输入 FileAsset ID:');
                    if (id) setAssetId(id.trim());
                  }}
                >
                  FileAsset ID
                </button>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bundle-checksum">SHA256 校验值 *</Label>
            <Input
              id="bundle-checksum"
              placeholder="sha256..."
              value={checksum}
              onChange={(e) => setChecksum(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bundle-minNative">最低原生版本</Label>
            <Input
              id="bundle-minNative"
              placeholder="如 1.0.0（留空表示不限制）"
              value={minNativeVersion}
              onChange={(e) => setMinNativeVersion(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>灰度比例: {rolloutPercent}%</Label>
            <div className="flex items-center gap-3 pt-1">
              <Slider
                value={[rolloutPercent]}
                onValueChange={([v]) => setRolloutPercent(v)}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="w-10 text-right text-sm text-muted-foreground">{rolloutPercent}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <Label className="text-sm">启用状态</Label>
              <p className="text-xs text-muted-foreground">关闭后客户端将不再收到此版本更新</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <div>
              <Label className="text-sm text-red-600 dark:text-red-400">强制更新</Label>
              <p className="text-xs text-muted-foreground">
                开启后跳过灰度，下载完成后立即提示用户重启 App
              </p>
            </div>
            <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bundle-notes">更新日志</Label>
            <textarea
              id="bundle-notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              placeholder="此版本的更新内容..."
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" data-icon="inline-start" />}
            {isEdit ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export function AdminMobileBundlesPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [data, setData] = useState<BundleListResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [platformFilter, setPlatformFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<MobileBundle | null>(null);

  const fetchBundles = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (platformFilter) params.set('platform', platformFilter);
      if (channelFilter) params.set('channel', channelFilter);
      const result = await get<BundleListResult>(`/admin/mobile-bundles?${params.toString()}`);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, platformFilter, channelFilter]);

  useEffect(() => {
    fetchBundles();
  }, [fetchBundles]);

  const handleToggle = async (bundle: MobileBundle) => {
    try {
      await post(`/admin/mobile-bundles/${bundle.id}/toggle`);
      fetchBundles();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDelete = async (bundle: MobileBundle) => {
    if (!confirm(`确定要删除版本 ${bundle.version} (${platformLabel(bundle.platform)}) 吗？`)) return;
    try {
      await del(`/admin/mobile-bundles/${bundle.id}`);
      fetchBundles();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Admin guard
  if (session && (session.user as any)?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert className="h-16 w-16 text-muted-foreground/30" />
        <p className="mt-4 text-lg font-semibold text-muted-foreground">需要管理员权限</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />返回首页
        </Button>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">OTA 安装包管理</h1>
          <p className="text-sm text-muted-foreground">管理 iOS/Android 热更新安装包，支持灰度和快速下架</p>
        </div>
        <Button
          onClick={() => {
            setEditingBundle(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" data-icon="inline-start" />
          新增安装包
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={platformFilter}
            onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
          >
            <option value="">全部平台</option>
            <option value="ios">iOS</option>
            <option value="android">Android</option>
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
          >
            <option value="">全部渠道</option>
            <option value="production">正式版</option>
            <option value="staging">预发布</option>
          </select>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={fetchBundles} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            安装包列表
            {data && <span className="ml-2 text-sm font-normal text-muted-foreground">共 {data.total} 个</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <FileArchive className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p>暂无安装包</p>
              <p className="text-sm">点击"新增安装包"开始</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-muted-foreground">
                      <th className="pb-2.5 pr-3 font-medium">版本</th>
                      <th className="pb-2.5 pr-3 font-medium">平台</th>
                      <th className="pb-2.5 pr-3 font-medium">渠道</th>
                      <th className="pb-2.5 pr-3 font-medium">文件</th>
                      <th className="pb-2.5 pr-3 font-medium">大小</th>
                      <th className="pb-2.5 pr-3 font-medium">灰度</th>
                      <th className="pb-2.5 pr-3 font-medium">状态</th>
                      <th className="pb-2.5 pr-3 font-medium">创建时间</th>
                      <th className="pb-2.5 pr-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((bundle) => (
                      <tr key={bundle.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <FileArchive className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono font-medium">v{bundle.version}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge variant={platformColor(bundle.platform)}>
                            <Smartphone className="mr-1 h-3 w-3" />
                            {platformLabel(bundle.platform)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge variant={channelColor(bundle.channel)}>{channelLabel(bundle.channel)}</Badge>
                        </td>
                        <td className="py-3 pr-3 max-w-[180px]">
                          <span className="truncate block text-muted-foreground" title={bundle.asset?.filename || bundle.assetId}>
                            {bundle.asset?.filename || truncate(bundle.assetId, 20)}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {fmtSize(bundle.asset?.size)}
                        </td>
                        <td className="py-3 pr-3">
                          {bundle.rolloutPercent < 100 ? (
                            <span className="text-amber-500 font-medium">{bundle.rolloutPercent}%</span>
                          ) : (
                            <span className="text-muted-foreground">全量</span>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-1.5">
                            {bundle.enabled ? (
                              <Badge variant="default" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" />启用
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 text-muted-foreground">
                                <XCircle className="h-3 w-3" />已下架
                              </Badge>
                            )}
                            {bundle.isMandatory && (
                              <Badge variant="destructive" className="gap-1 text-xs">强制</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          {fmtDate(bundle.createdAt)}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={bundle.enabled ? '下架' : '启用'}
                              onClick={() => handleToggle(bundle)}
                            >
                              {bundle.enabled ? (
                                <PowerOff className="h-3.5 w-3.5 text-amber-500" />
                              ) : (
                                <Power className="h-3.5 w-3.5 text-emerald-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingBundle(bundle);
                                setDialogOpen(true);
                              }}
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDelete(bundle)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-muted-foreground">
                    第 {page} / {totalPages} 页
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页<ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <BundleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bundle={editingBundle}
        onSaved={fetchBundles}
      />
    </div>
  );
}
