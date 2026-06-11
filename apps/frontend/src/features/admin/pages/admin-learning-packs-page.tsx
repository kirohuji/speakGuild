import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Loader2, PackagePlus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function AdminLearningPacksPage() {
  const [packs, setPacks] = useState<LearningPackItem[]>([]);
  const [scenes, setScenes] = useState<LearningPackSceneOption[]>([]);
  const [sceneId, setSceneId] = useState('');
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === sceneId) ?? null,
    [sceneId, scenes],
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
    } catch (error) {
      console.error(error);
      toast.error('加载学习包失败');
    } finally {
      setLoading(false);
    }
  }, [sceneId]);

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
          <p className="mt-1 text-sm text-muted-foreground">生成并发布移动端离线学习包。</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="size-4" />
          刷新
        </Button>
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
            已生成学习包
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
                      <td className="py-3 pr-4">{fmtSize(pack.zipSize ?? pack.fileAsset?.size)}</td>
                      <td className="py-3 pr-4">{fmtDate(pack.publishedAt)}</td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
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
    </div>
  );
}
