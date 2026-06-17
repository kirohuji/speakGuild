import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ChevronRight, Download, FileArchive, Loader2, PackagePlus, RefreshCw, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUploadField } from '@/features/admin/components/file-upload-field';
import {
  learningPackAdminApi,
  type LearningPackFilters,
  type LearningPackItem,
  type LearningPackSceneOption,
  type LearningPackStatus,
  type LearningPackType,
} from '../api-learning-packs';
import { listSceneCategories, type SceneCategory } from '../api-content-admin';
import { cn } from '@/lib/cn';

function fmtSize(bytes?: number | null) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

function statusVariant(status: LearningPackStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'published') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'building') return 'secondary';
  return 'outline';
}

function statusLabel(status: LearningPackStatus) {
  return { draft: '草稿', building: '生成中', published: '已发布', failed: '失败' }[status];
}

function packageTypeLabel(type?: LearningPackType) {
  if (type === 'exam') return '考试';
  if (type === 'story') return '故事';
  if (type === 'course') return '课程';
  if (type === 'foundation') return '零基础';
  return '日常';
}

function saveBlob(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AdminLearningPacksPage() {
  const [packs, setPacks] = useState<LearningPackItem[]>([]);
  const [scenes, setScenes] = useState<LearningPackSceneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  // ── List filters ──
  const [packageTypeFilter, setPackageTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [filterOptions, setFilterOptions] = useState<LearningPackFilters>({ packageTypes: [], categories: [] });
  const [categories, setCategories] = useState<SceneCategory[]>([]);

  // ── Expand/collapse ──
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());

  // ── Create dialog ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createSceneId, setCreateSceneId] = useState('');
  const [createVersion, setCreateVersion] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  // Dialog filters
  const [dialogPackageType, setDialogPackageType] = useState<string>('daily');
  const [dialogCategoryId, setDialogCategoryId] = useState<string>('all');
  const [dialogCategories, setDialogCategories] = useState<SceneCategory[]>([]);

  // ── Upload dialog ──
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSceneId, setUploadSceneId] = useState('');
  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAssetId, setUploadAssetId] = useState('');
  const [uploading, setUploading] = useState(false);

  const selectedUploadScene = useMemo(
    () => scenes.find((s) => s.id === uploadSceneId) ?? null,
    [uploadSceneId, scenes],
  );

  // ── Group packs by scene ──
  const groupedPacks = useMemo(() => {
    const map = new Map<string, { scene: LearningPackSceneOption; versions: LearningPackItem[] }>();
    for (const pack of packs) {
      const sid = pack.sceneId;
      if (!map.has(sid)) {
        map.set(sid, {
          scene: pack.scene ?? { id: sid, title: pack.title || sid, location: '', packageType: pack.type },
          versions: [],
        });
      }
      map.get(sid)!.versions.push(pack);
    }
    // Sort versions by version desc
    for (const entry of map.values()) {
      entry.versions.sort((a, b) => b.version - a.version);
    }
    return Array.from(map.values());
  }, [packs]);

  const toggleExpand = (sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  // ── Load data ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const listParams: any = { pageSize: 200 };
      if (packageTypeFilter !== 'all') listParams.packageType = packageTypeFilter;
      if (categoryFilter !== 'all') listParams.categoryId = categoryFilter;

      const [packResult, sceneResult, filterResult] = await Promise.all([
        learningPackAdminApi.list(listParams),
        learningPackAdminApi.scenes(),
        learningPackAdminApi.filters(),
      ]);
      setPacks(packResult.list);
      setScenes(sceneResult);
      setFilterOptions(filterResult);
      if (!uploadSceneId && sceneResult[0]) setUploadSceneId(sceneResult[0].id);
    } catch {
      toast.error('加载学习包失败');
    } finally {
      setLoading(false);
    }
  }, [uploadSceneId, packageTypeFilter, categoryFilter]);

  useEffect(() => { void load(); }, [load]);

  // ── Read URL params on mount for cross-page navigation (parse from hash for HashRouter) ──
  useEffect(() => {
    const hashQuery = location.hash.includes('?') ? location.hash.split('?')[1] : ''
    const params = new URLSearchParams(hashQuery)
    const pt = params.get('packageType')
    const cid = params.get('categoryId')
    if (pt) setPackageTypeFilter(pt)
    if (cid) setCategoryFilter(cid)
  }, [])

  // ── Cascading filters ──
  useEffect(() => {
    listSceneCategories(packageTypeFilter !== 'all' ? packageTypeFilter as any : undefined)
      .then(setCategories).catch(() => {});
  }, [packageTypeFilter]);
  useEffect(() => { setCategoryFilter('all'); }, [packageTypeFilter]);
  useEffect(() => {
    if (categoryFilter !== 'all' && !categories.some((c) => c.id === categoryFilter))
      setCategoryFilter('all');
  }, [categories, categoryFilter]);

  // Dialog cascading
  useEffect(() => {
    listSceneCategories(dialogPackageType !== 'all' ? dialogPackageType as any : undefined)
      .then(setDialogCategories).catch(() => {});
  }, [dialogPackageType]);
  useEffect(() => { setDialogCategoryId('all'); }, [dialogPackageType]);

  // Filtered scenes for dialog
  const dialogScenes = useMemo(() => {
    return scenes.filter((s) => {
      if (dialogPackageType !== 'all' && s.packageType !== dialogPackageType) return false;
      return true;
    });
  }, [scenes, dialogPackageType]);

  const selectedCreateScene = useMemo(
    () => dialogScenes.find((s) => s.id === createSceneId) ?? null,
    [createSceneId, dialogScenes],
  );

  const openCreateDialog = () => {
    setCreateVersion('');
    setCreateTitle('');
    setDialogPackageType(packageTypeFilter !== 'all' ? packageTypeFilter : 'daily');
    // Init first scene
    const filtered = scenes.filter((s) =>
      (packageTypeFilter !== 'all' ? s.packageType === packageTypeFilter : true)
    );
    setCreateSceneId(filtered[0]?.id ?? '');
    setCreateOpen(true);
  };

  // ── Actions ──
  const generate = async () => {
    if (!createSceneId || generating) return;
    setGenerating(true);
    try {
      await learningPackAdminApi.generate({
        sceneId: createSceneId,
        version: createVersion ? Number(createVersion) : undefined,
        title: createTitle || undefined,
        publish: true,
      });
      setCreateVersion('');
      setCreateTitle('');
      toast.success('学习包已生成并发布');
      await load();
    } catch (error: any) {
      toast.error(error?.message || '生成学习包失败');
    } finally {
      setGenerating(false);
    }
  };

  const generateForScene = async (sceneId: string) => {
    setMutatingId(sceneId);
    try {
      await learningPackAdminApi.generate({ sceneId, publish: true });
      toast.success('已生成并发布最新版');
      await load();
    } catch (error: any) {
      toast.error(error?.message || '生成失败');
    } finally {
      setMutatingId(null);
    }
  };

  const upload = async () => {
    if (!uploadSceneId || !uploadAssetId || uploading) return;
    setUploading(true);
    try {
      await learningPackAdminApi.upload({
        sceneId: uploadSceneId,
        assetId: uploadAssetId,
        version: uploadVersion ? Number(uploadVersion) : undefined,
        title: uploadTitle || undefined,
        publish: true,
      });
      setUploadVersion('');
      setUploadTitle('');
      setUploadAssetId('');
      setUploadOpen(false);
      toast.success('学习包已上传并发布');
      await load();
    } catch (error: any) {
      toast.error(error?.message || '上传学习包失败');
    } finally {
      setUploading(false);
    }
  };

  const publish = async (pack: LearningPackItem) => {
    setMutatingId(pack.id);
    try {
      await learningPackAdminApi.publish(pack.id);
      toast.success('已发布');
      await load();
    } catch (error: any) {
      toast.error(error?.message || '发布失败');
    } finally {
      setMutatingId(null);
    }
  };

  const exportPack = async (pack: LearningPackItem) => {
    setMutatingId(pack.id);
    try {
      const buffer = await learningPackAdminApi.download(pack.id);
      saveBlob(buffer, pack.fileAsset?.filename ?? `${pack.sceneId}-v${pack.version}.zip`);
    } catch (error: any) {
      toast.error(error?.message || '导出失败');
    } finally {
      setMutatingId(null);
    }
  };

  const remove = async (pack: LearningPackItem) => {
    if (!window.confirm(`删除学习包「${pack.title}」？`)) return;
    setMutatingId(pack.id);
    try {
      await learningPackAdminApi.remove(pack.id);
      toast.success('已删除');
      await load();
    } catch (error: any) {
      toast.error(error?.message || '删除失败');
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">学习包管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">按学习单元管理离线包版本，支持生成、上传、发布和导出。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />
            上传 zip
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <PackagePlus className="size-4" />
            新建学习包
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="size-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={packageTypeFilter} onChange={(e) => setPackageTypeFilter((e.target as HTMLSelectElement).value)} className="w-[130px]">
          <SelectItem value="all">一级分类</SelectItem>
          {filterOptions.packageTypes.map((t) => (
            <SelectItem key={t} value={t}>{packageTypeLabel(t as LearningPackType)}</SelectItem>
          ))}
        </Select>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter((e.target as HTMLSelectElement).value)} className="w-[150px]">
          <SelectItem value="all">二级分类</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </Select>
        <span className="text-sm text-muted-foreground">共 {groupedPacks.length} 个学习单元</span>
      </div>

      {/* Table grouped by scene */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="size-4" />
            学习包列表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>
          ) : groupedPacks.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">暂无学习包，点击「新建学习包」开始。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-8" />
                    <th className="py-3 pr-4 font-medium">学习单元</th>
                    <th className="py-3 pr-4 font-medium">类型</th>
                    <th className="py-3 pr-4 font-medium">最新版本</th>
                    <th className="py-3 pr-4 font-medium">版本数</th>
                    <th className="py-3 pr-4 font-medium">最新发布时间</th>
                    <th className="py-3 pr-4 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedPacks.map(({ scene, versions }) => {
                    const latest = versions[0];
                    const isExpanded = expandedScenes.has(scene.id);
                    return (
                      <>
                        {/* Main row */}
                        <tr
                          key={scene.id}
                          className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => toggleExpand(scene.id)}
                        >
                          <td className="py-3 pl-4 pr-2">
                            <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                          </td>
                          <td className="py-3 pr-4">
                            <div className="font-medium">{scene.title}</div>
                            <div className="text-xs text-muted-foreground">{scene.location || scene.id}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline" className="text-[10px]">{packageTypeLabel(scene.packageType ?? latest?.type)}</Badge>
                          </td>
                          <td className="py-3 pr-4">
                            {latest ? (
                              <span className="font-mono text-xs">v{latest.version}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground">{versions.length}</td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground">{fmtDate(latest?.publishedAt)}</td>
                          <td className="py-3 pr-4">
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-[11px]"
                                disabled={mutatingId === scene.id}
                                onClick={() => generateForScene(scene.id)}
                              >
                                {mutatingId === scene.id ? <Loader2 className="size-3 animate-spin" /> : <PackagePlus className="size-3" />}
                                生成最新版
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {/* Expanded sub-rows */}
                        {isExpanded && versions.map((pack) => (
                          <tr key={pack.id} className="border-b bg-muted/10">
                            <td />
                            <td className="py-2 pr-4 pl-10" colSpan={2}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">v{pack.version}</span>
                                <Badge variant={statusVariant(pack.status)} className="text-[10px]">{statusLabel(pack.status)}</Badge>
                              </div>
                              {pack.buildLog && (
                                <div className="mt-0.5 max-w-md truncate text-[10px] text-muted-foreground">{pack.buildLog}</div>
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex max-w-[200px] items-center gap-1.5 text-xs text-muted-foreground">
                                <FileArchive className="size-3 shrink-0" />
                                <span className="truncate">{pack.fileAsset?.filename ?? '-'}</span>
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{fmtSize(pack.zipSize ?? pack.fileAsset?.size)}</td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{fmtDate(pack.publishedAt)}</td>
                            <td className="py-2 pr-4">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm" variant="outline" className="h-6 text-[10px] gap-0.5"
                                  disabled={mutatingId === pack.id || !pack.fileAssetId}
                                  onClick={() => void exportPack(pack)}
                                >
                                  <Download className="size-2.5" />导出
                                </Button>
                                {pack.status !== 'published' && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-0.5"
                                    disabled={mutatingId === pack.id} onClick={() => void publish(pack)}>
                                    <Send className="size-2.5" />发布
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-0.5 text-destructive hover:text-destructive"
                                  disabled={mutatingId === pack.id} onClick={() => void remove(pack)}>
                                  <Trash2 className="size-2.5" />删除
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建学习包</DialogTitle>
            <DialogDescription>选择一个学习单元，生成并发布离线学习包。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>一级分类</Label>
                <Select value={dialogPackageType} onChange={(e) => setDialogPackageType((e.target as HTMLSelectElement).value)}>
                  <SelectItem value="all">全部</SelectItem>
                  {filterOptions.packageTypes.map((t) => (
                    <SelectItem key={t} value={t}>{packageTypeLabel(t as LearningPackType)}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>二级分类</Label>
                <Select value={dialogCategoryId} onChange={(e) => setDialogCategoryId((e.target as HTMLSelectElement).value)}>
                  <SelectItem value="all">全部</SelectItem>
                  {dialogCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>学习单元</Label>
              <select
                value={createSceneId}
                onChange={(e) => setCreateSceneId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {dialogScenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{packageTypeLabel(s.packageType)}] {s.title} - {s.location}
                  </option>
                ))}
              </select>
              {dialogScenes.length === 0 && (
                <p className="text-xs text-muted-foreground">当前筛选条件下没有学习单元。</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>版本号</Label>
                <Input value={createVersion} onChange={(e) => setCreateVersion(e.target.value)} placeholder="自动递增" />
              </div>
              <div className="space-y-2">
                <Label>标题</Label>
                <Input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder={selectedCreateScene ? `${selectedCreateScene.title} 离线包` : '可选'}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button className="gap-2" onClick={generate} disabled={!createSceneId || generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
              生成并发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>上传 zip 新建学习包</DialogTitle>
            <DialogDescription>上传已打好的学习包 zip，并绑定到一个学习单元版本。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>学习单元</Label>
              <select
                value={uploadSceneId}
                onChange={(event) => setUploadSceneId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    [{packageTypeLabel(scene.packageType)}] {scene.title} - {scene.location}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>版本号</Label>
                <Input value={uploadVersion} onChange={(event) => setUploadVersion(event.target.value)} placeholder="自动递增" />
              </div>
              <div className="space-y-2">
                <Label>标题</Label>
                <Input
                  value={uploadTitle}
                  onChange={(event) => setUploadTitle(event.target.value)}
                  placeholder={selectedUploadScene ? `${selectedUploadScene.title} 离线包` : '可选'}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>zip 文件</Label>
              <FileUploadField
                accept=".zip,application/zip"
                group="learning_pack"
                uploadLabel="上传 zip"
                placeholder="点击上传或拖拽学习包 zip 到这里"
                onChange={(url) => { if (!url) setUploadAssetId(''); }}
                onUploaded={(_url, id) => setUploadAssetId(id)}
                className={uploadAssetId ? 'border-emerald-500/50' : ''}
              />
              {uploadAssetId && <p className="text-xs text-emerald-600">已上传：{uploadAssetId}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>取消</Button>
            <Button className="gap-2" onClick={upload} disabled={!uploadSceneId || !uploadAssetId || uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              上传并发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
