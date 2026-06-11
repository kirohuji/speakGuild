import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Download, FileArchive, Loader2, PackagePlus, RefreshCw, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  type LearningPackItem,
  type LearningPackSceneOption,
  type LearningPackStatus,
} from '../api-learning-packs';

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
  return {
    draft: '草稿',
    building: '生成中',
    published: '已发布',
    failed: '失败',
  }[status];
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
  const [sceneId, setSceneId] = useState('');
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [uploadSceneId, setUploadSceneId] = useState('');
  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAssetId, setUploadAssetId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === sceneId) ?? null,
    [sceneId, scenes],
  );

  const selectedUploadScene = useMemo(
    () => scenes.find((scene) => scene.id === uploadSceneId) ?? null,
    [uploadSceneId, scenes],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [packResult, sceneResult] = await Promise.all([
        learningPackAdminApi.list({ pageSize: 100 }),
        learningPackAdminApi.scenes(),
      ]);
      setPacks(packResult.list);
      setScenes(sceneResult);
      if (!sceneId && sceneResult[0]) setSceneId(sceneResult[0].id);
      if (!uploadSceneId && sceneResult[0]) setUploadSceneId(sceneResult[0].id);
    } catch (error) {
      console.error(error);
      toast.error('加载学习包失败');
    } finally {
      setLoading(false);
    }
  }, [sceneId, uploadSceneId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    if (!sceneId || generating) return;
    setGenerating(true);
    try {
      await learningPackAdminApi.generate({
        sceneId,
        version: version ? Number(version) : undefined,
        title: title || undefined,
        publish: true,
      });
      setVersion('');
      setTitle('');
      toast.success('学习包已生成并发布');
      await load();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || '生成学习包失败');
    } finally {
      setGenerating(false);
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
      console.error(error);
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">学习包管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">生成、上传、发布和导出移动端离线学习包。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />
            上传 zip
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="size-4" />
            刷新
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackagePlus className="size-4" />
            生成学习包
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[minmax(240px,1fr)_160px_minmax(220px,1fr)_auto]">
          <div className="space-y-2">
            <Label>学习单元</Label>
            <select
              value={sceneId}
              onChange={(event) => setSceneId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.title} - {scene.location}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>版本号</Label>
            <Input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="自动递增" />
          </div>
          <div className="space-y-2">
            <Label>标题</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={selectedScene ? `${selectedScene.title} 离线包` : '可选'}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full gap-2" onClick={generate} disabled={!sceneId || generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
              生成并发布
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="size-4" />
            学习包列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
          ) : packs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">暂无学习包</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4 font-medium">学习单元</th>
                    <th className="py-3 pr-4 font-medium">版本</th>
                    <th className="py-3 pr-4 font-medium">状态</th>
                    <th className="py-3 pr-4 font-medium">文件</th>
                    <th className="py-3 pr-4 font-medium">大小</th>
                    <th className="py-3 pr-4 font-medium">发布时间</th>
                    <th className="py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {packs.map((pack) => (
                    <tr key={pack.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{pack.scene?.title ?? pack.title}</div>
                        <div className="text-xs text-muted-foreground">{pack.scene?.location ?? pack.sceneId}</div>
                        {pack.buildLog && <div className="mt-1 max-w-md truncate text-xs text-muted-foreground">{pack.buildLog}</div>}
                      </td>
                      <td className="py-3 pr-4">v{pack.version}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant(pack.status)}>{statusLabel(pack.status)}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex max-w-[220px] items-center gap-2 text-xs text-muted-foreground">
                          <FileArchive className="size-3.5 shrink-0" />
                          <span className="truncate">{pack.fileAsset?.filename ?? '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">{fmtSize(pack.zipSize ?? pack.fileAsset?.size)}</td>
                      <td className="py-3 pr-4">{fmtDate(pack.publishedAt)}</td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={mutatingId === pack.id || !pack.fileAssetId}
                            onClick={() => void exportPack(pack)}
                          >
                            <Download className="size-3.5" />
                            导出
                          </Button>
                          {pack.status !== 'published' && (
                            <Button size="sm" variant="outline" className="gap-1" disabled={mutatingId === pack.id} onClick={() => void publish(pack)}>
                              <Send className="size-3.5" />
                              发布
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" disabled={mutatingId === pack.id} onClick={() => void remove(pack)}>
                            <Trash2 className="size-3.5" />
                            删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
                    {scene.title} - {scene.location}
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
                onChange={(url) => {
                  if (!url) setUploadAssetId('');
                }}
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
