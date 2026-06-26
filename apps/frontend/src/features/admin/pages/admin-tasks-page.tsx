import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, ListChecks, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { adminTasksApi, type AdminTask, type AdminTaskDetail, type AdminTaskStatus } from '../api-admin-tasks';

const TYPE_LABELS: Record<string, string> = {
  'learning-package-content-prepare': '学习包内容准备',
};

const STATUS_META: Record<AdminTaskStatus, { label: string; icon: any; className: string }> = {
  queued: { label: '排队中', icon: Clock3, className: 'border-slate-300 text-slate-600' },
  running: { label: '执行中', icon: Loader2, className: 'border-blue-300 bg-blue-50 text-blue-700' },
  completed: { label: '已完成', icon: CheckCircle2, className: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  failed: { label: '失败', icon: AlertTriangle, className: 'border-red-300 bg-red-50 text-red-700' },
  canceled: { label: '已取消', icon: AlertTriangle, className: 'border-zinc-300 text-zinc-600' },
};

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: AdminTaskStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn('gap-1.5', meta.className)}>
      <Icon className={cn('size-3.5', status === 'running' && 'animate-spin')} />
      {meta.label}
    </Badge>
  );
}

function summaryText(task: AdminTask) {
  const summary = task.summary;
  if (!summary) return '暂无结果';
  const parts = [
    `词汇 ${summary.vocabEnriched ?? 0}/${summary.vocabChecked ?? 0}`,
    `句块 ${summary.chunkEnriched ?? 0}/${summary.chunkChecked ?? 0}`,
    `句型 ${summary.patternEnriched ?? 0}/${summary.patternChecked ?? 0}`,
  ];
  const errors = summary.errors?.length ?? task.failedItems;
  return `${parts.join(' · ')}${errors ? ` · 失败 ${errors}` : ''}`;
}

export function AdminTasksPage() {
  const [status, setStatus] = useState<AdminTaskStatus | 'all'>('all');
  const [items, setItems] = useState<AdminTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminTaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const selected = useMemo(
    () => detail ?? items.find((item) => item.id === selectedId) ?? null,
    [detail, items, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminTasksApi.list({
        type: 'learning-package-content-prepare',
        status,
        pageSize: 50,
      });
      setItems(result.items);
      if (!selectedId && result.items[0]) setSelectedId(result.items[0].id);
    } catch (error: any) {
      toast.error(error?.message || '任务列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [selectedId, status]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      setDetail(await adminTasksApi.get(id));
    } catch (error: any) {
      toast.error(error?.message || '任务详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    const hasActive = items.some((item) => item.status === 'running' || item.status === 'queued');
    if (!hasActive && selected?.status !== 'running' && selected?.status !== 'queued') return;
    const timer = window.setInterval(() => {
      void load();
      if (selectedId) void loadDetail(selectedId);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [items, load, loadDetail, selected?.status, selectedId]);

  const retry = async (task: AdminTask) => {
    try {
      const created = await adminTasksApi.retry(task.id);
      toast.success('已创建重试任务');
      setSelectedId(created.id);
      void load();
    } catch (error: any) {
      toast.error(error?.message || '重试失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">任务中心</h1>
          <p className="text-sm text-muted-foreground">查看学习包导入后的词汇、句块、句型后台准备状态</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onChange={(event) => setStatus(event.target.value as AdminTaskStatus | 'all')}>
            <option value="all">全部状态</option>
            <option value="queued">排队中</option>
            <option value="running">执行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </Select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}
            刷新
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="size-4" />
              内容任务
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && items.length === 0 ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
                <Search className="mb-3 size-10 opacity-40" />
                <p className="text-sm">暂无任务</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedId(task.id)}
                    className={cn(
                      'block w-full px-4 py-3 text-left transition-colors hover:bg-muted/50',
                      selectedId === task.id && 'bg-muted',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{task.title}</span>
                          <Badge variant="secondary" className="text-[10px]">{TYPE_LABELS[task.type] ?? task.type}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.currentStep || '-'} · {task.processedItems}/{task.totalItems} · {fmtDate(task.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={task.status} />
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={task.progress} className="h-2 flex-1" />
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{task.progress}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-4 xl:self-start">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" />
              任务详情
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="py-12 text-center text-sm text-muted-foreground">选择一个任务查看详情</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold leading-6">{selected.title}</h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  <Progress value={selected.progress} className="h-2" />
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>阶段：{selected.currentStep || '-'}</span>
                    <span>进度：{selected.processedItems}/{selected.totalItems}</span>
                    <span>成功：{selected.successItems}</span>
                    <span>失败：{selected.failedItems}</span>
                    <span>开始：{fmtDate(selected.startedAt)}</span>
                    <span>完成：{fmtDate(selected.finishedAt)}</span>
                  </div>
                </div>

                {selected.errorMessage && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {selected.errorMessage}
                  </div>
                )}

                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                  <p className="mb-1 font-medium">结果摘要</p>
                  <p className="text-muted-foreground">{summaryText(selected)}</p>
                </div>

                {selected.status === 'failed' && (
                  <Button variant="outline" size="sm" onClick={() => void retry(selected)}>
                    <RotateCcw className="mr-1 size-4" />
                    重试任务
                  </Button>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">最近日志</p>
                    {detailLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {(detail?.logs ?? []).length === 0 ? (
                      <p className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">暂无日志</p>
                    ) : (
                      detail!.logs.map((log) => (
                        <div key={log.id} className="rounded-md border border-border p-2 text-xs">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                log.level === 'error' && 'border-red-300 text-red-700',
                                log.level === 'warn' && 'border-amber-300 text-amber-700',
                              )}
                            >
                              {log.level}
                            </Badge>
                            <span className="text-muted-foreground">{fmtDate(log.createdAt)}</span>
                          </div>
                          <p className="leading-5">{log.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
