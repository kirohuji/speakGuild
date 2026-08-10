import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileWarning,
  Layers3,
  ListChecks,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { adminTasksApi, type AdminTask, type AdminTaskDetail, type AdminTaskStatus, type QueuesStatusResult } from '../api-admin-tasks';

const TYPE_LABELS: Record<string, string> = {
  'warmup-pipeline-generate': '知识点练习 AI 生成',
  'scene-topic-batch-generate': '学习包批量生成（教学文档+知识点训练）',
  'learning-package-content-prepare': '学习包内容准备',
  'vocabulary-csv-import': '词汇CSV批量导入',
  'vocabulary-missing-meaning-enrich': '词汇字段检查与 AI 补全（词典+AI）',
  'vocabulary-polish': '词汇例句翻译补全与释义精简',
  'chunk-missing-meaning-enrich': '句块字段检查与 AI 补全',
  'pattern-missing-meaning-enrich': '句型字段检查与 AI 补全',
  'script-video-render': '剧本演出视频',
  'narrative-video-render': '叙事视频预览',
};

const STEP_LABELS: Record<string, string> = {
  'loading-topic': '读取话题内容',
  'generating-warmup': 'AI 生成练习',
  'saving-warmup': '写入练习结果',
  scan: '扫描内容',
  vocabulary: '补全词汇',
  chunk: '补全句块',
  pattern: '补全句型',
  completed: '完成',
  failed: '失败',
  canceled: '已取消',
  write: '写入词汇',
  enrich: 'AI富化词汇',
  bundling: '准备渲染器',
  'initializing-renderer': '初始化渲染器',
  rendering: '生成视频',
  uploading: '上传成片',
};

const ERROR_TYPE_LABELS: Record<string, string> = {
  vocabulary: '词汇',
  chunk: '句块',
  pattern: '句型',
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

function fmtStep(step?: string | null) {
  if (!step) return '-';
  // 支持 "phase:当前处理项" 格式（如 enrich:hello (1/3000)）
  const colon = step.indexOf(':');
  if (colon > 0) {
    const phase = STEP_LABELS[step.slice(0, colon)] ?? step.slice(0, colon);
    return `${phase}：${step.slice(colon + 1)}`;
  }
  return STEP_LABELS[step] ?? step;
}

function taskErrors(task: AdminTask | AdminTaskDetail | null) {
  const errors = (task?.summary as any)?.errors;
  return Array.isArray(errors) ? errors : [];
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

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' | 'muted' }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/25 px-3 py-2">
      <p className={cn(
        'text-lg font-semibold leading-none',
        tone === 'good' && 'text-emerald-600',
        tone === 'bad' && 'text-red-600',
        tone === 'muted' && 'text-muted-foreground',
      )}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ──── AI 用量（真实 token 统计）────

interface AiUsageData {
  calls?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** 优先取任务 summary.usage（已完成/后端已补齐），否则取日志中最近一条 ai-usage（日志按时间倒序返回） */
function getAiUsage(task: AdminTask | AdminTaskDetail | null): AiUsageData | null {
  if (!task) return null;
  const fromSummary = (task.summary as any)?.usage;
  if (fromSummary && (fromSummary.calls || fromSummary.totalTokens)) return fromSummary;
  const logs = (task as AdminTaskDetail).logs;
  if (Array.isArray(logs)) {
    for (let i = 0; i < logs.length; i++) {
      const meta = logs[i].meta as any;
      if (logs[i].step === 'ai-usage' && meta?.totalTokens) return meta;
    }
  }
  return null;
}

/** 按 deepseek-chat 约 1 元/百万输入 token、2 元/百万输出 token 估算 */
function estimateCost(usage: AiUsageData) {
  const input = usage.promptTokens ?? 0;
  const output = usage.completionTokens ?? 0;
  return (input / 1e6) * 1 + (output / 1e6) * 2;
}

function fmtTokens(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function AiUsageCard({ task }: { task: AdminTask | AdminTaskDetail }) {
  const usage = getAiUsage(task);
  if (!usage) return null;
  const cost = estimateCost(usage);
  const items = [
    { label: '调用次数', value: String(usage.calls ?? 0) },
    { label: '输入 tokens', value: fmtTokens(usage.promptTokens ?? 0) },
    { label: '输出 tokens', value: fmtTokens(usage.completionTokens ?? 0) },
  ];
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" />
        AI 用量
        {task.status === 'running' && <span className="text-[10px] text-muted-foreground/70">（实时累计，约每 50~100 项刷新一次）</span>}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-md bg-background/70 p-2">
            <p className="text-base font-semibold leading-none">{item.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
        <span className="text-muted-foreground">合计 {fmtTokens(usage.totalTokens ?? 0)} tokens</span>
        <span className="font-medium text-amber-600">≈ ¥{cost.toFixed(2)}</span>
      </div>
    </div>
  );
}

function SummaryPanel({ task }: { task: AdminTask }) {
  const summary = task.summary as any;
  if (task.type === 'scene-topic-batch-generate' && summary) {
    const errors = (Array.isArray(summary.errors) ? summary.errors : []);
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
        <div className="grid grid-cols-4 gap-2">
          <Metric label="话题数" value={summary.topicCount ?? 0} tone="muted" />
          <Metric label="教学文档生成" value={summary.teachingGenerated ?? 0} tone="good" />
          <Metric label="知识点训练生成" value={summary.warmupGenerated ?? 0} tone="good" />
          <Metric label="失败" value={errors.length} tone={errors.length ? 'bad' : 'muted'} />
        </div>
        <p className="text-xs text-muted-foreground">
          教学文档 {summary.teachingSkipped ?? 0} 篇已达标跳过；知识点训练 {summary.warmupSkipped ?? 0} 组已有跳过。
        </p>
        {errors.length > 0 && (
          <div className="space-y-1 rounded-md bg-destructive/10 p-2">
            {errors.slice(0, 5).map((err: any, index: number) => (
              <p key={index} className="text-xs text-destructive">
                {err.topicTitle} · {err.item}：{err.message}
              </p>
            ))}
            {errors.length > 5 && <p className="text-xs text-destructive">等 {errors.length} 项失败</p>}
          </div>
        )}
        {summary.actionUrl && (
          <Button size="sm" variant="outline" onClick={() => { window.location.hash = `#${summary.actionUrl}` }}>
            打开学习包
            <ArrowUpRight className="ml-1 size-3.5" />
          </Button>
        )}
      </div>
    );
  }
  if (task.type === 'warmup-pipeline-generate' && summary) {
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="新增题组" value={summary.generatedGroups ?? 0} tone="good" />
          <Metric label="题组总数" value={summary.afterGroups ?? 0} tone="muted" />
          <Metric label="题目总数" value={summary.afterItems ?? 0} tone="muted" />
        </div>
        <p className="text-xs text-muted-foreground">生成结果已自动写入话题，原有 {summary.beforeGroups ?? 0} 个题组 / {summary.beforeItems ?? 0} 道题。</p>
        {summary.actionUrl && (
          <Button size="sm" variant="outline" onClick={() => { window.location.hash = `#${summary.actionUrl}` }}>
            打开对应话题
            <ArrowUpRight className="ml-1 size-3.5" />
          </Button>
        )}
      </div>
    );
  }
  if (task.type === 'script-video-render' || task.type === 'narrative-video-render') {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
        <p className="font-medium">视频渲染结果</p>
        <p className="mt-1 text-muted-foreground">
          {summary?.videoAssetId ? '成片已上传并可播放。' : '视频由后台渲染队列处理，完成后会自动同步到对应作品。'}
        </p>
        {summary?.videoAssetId && (
          <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">资源：{summary.videoAssetId}</p>
        )}
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        暂无结果摘要
      </div>
    );
  }

  if (task.type === 'vocabulary-polish') {
    const errors = taskErrors(task).length || summary.failed || task.failedItems;
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="已检查" value={summary.scanned ?? 0} tone="muted" />
          <Metric label="已修补" value={summary.enriched ?? 0} tone="good" />
          <Metric label="失败" value={errors} tone={errors ? 'bad' : 'muted'} />
        </div>
        <p className="text-xs text-muted-foreground">发现例句缺中文翻译或释义过长 {summary.missingEnrich ?? 0} 个。</p>
      </div>
    );
  }

  if (task.type === 'vocabulary-missing-meaning-enrich') {
    const errors = taskErrors(task).length || summary.failed || task.failedItems;
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="已检查" value={summary.scanned ?? 0} tone="muted" />
          <Metric label="已富化" value={summary.enriched ?? 0} tone="good" />
          <Metric label="失败" value={errors} tone={errors ? 'bad' : 'muted'} />
        </div>
        <p className="text-xs text-muted-foreground">发现缺失中文释义、讲解/描述或例句 {summary.missingEnrich ?? 0} 个。</p>
      </div>
    );
  }

  if (task.type === 'chunk-missing-meaning-enrich' || task.type === 'pattern-missing-meaning-enrich') {
    const errors = taskErrors(task).length || summary.failed || task.failedItems;
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="已检查" value={summary.scanned ?? 0} tone="muted" />
          <Metric label="已富化" value={summary.enriched ?? 0} tone="good" />
          <Metric label="失败" value={errors} tone={errors ? 'bad' : 'muted'} />
        </div>
        <p className="text-xs text-muted-foreground">发现缺失中文释义、讲解/描述或例句 {summary.missingEnrich ?? 0} 个。</p>
      </div>
    );
  }

  const totalUpdated = (summary.vocabEnriched ?? 0) + (summary.chunkEnriched ?? 0) + (summary.patternEnriched ?? 0);
  const totalSkipped = (summary.vocabSkipped ?? 0) + (summary.chunkSkipped ?? 0) + (summary.patternSkipped ?? 0);
  const errors = taskErrors(task).length || task.failedItems;

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="补全" value={totalUpdated} tone="good" />
        <Metric label="跳过" value={totalSkipped} tone="muted" />
        <Metric label="失败" value={errors} tone={errors ? 'bad' : 'muted'} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-background/70 p-2">
          <p className="font-medium">词汇</p>
          <p className="mt-1 text-muted-foreground">补全 {summary.vocabEnriched ?? 0} / 跳过 {summary.vocabSkipped ?? 0} / 检查 {summary.vocabChecked ?? 0}</p>
        </div>
        <div className="rounded-md bg-background/70 p-2">
          <p className="font-medium">句块</p>
          <p className="mt-1 text-muted-foreground">补全 {summary.chunkEnriched ?? 0} / 跳过 {summary.chunkSkipped ?? 0} / 检查 {summary.chunkChecked ?? 0}</p>
        </div>
        <div className="rounded-md bg-background/70 p-2">
          <p className="font-medium">句型</p>
          <p className="mt-1 text-muted-foreground">补全 {summary.patternEnriched ?? 0} / 跳过 {summary.patternSkipped ?? 0} / 检查 {summary.patternChecked ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

export function AdminTasksPage() {
  const [status, setStatus] = useState<AdminTaskStatus | 'all'>('all');
  const [type, setType] = useState<'all' | 'learning-package-content-prepare' | 'warmup-pipeline-generate' | 'scene-topic-batch-generate' | 'vocabulary-csv-import' | 'vocabulary-missing-meaning-enrich' | 'vocabulary-polish' | 'chunk-missing-meaning-enrich' | 'pattern-missing-meaning-enrich' | 'script-video-render' | 'narrative-video-render'>('all');
  const [items, setItems] = useState<AdminTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminTaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Queue status
  const [queuesStatus, setQueuesStatus] = useState<QueuesStatusResult | null>(null);
  const [queuesLoading, setQueuesLoading] = useState(false);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const queuesRequestRef = useRef(0);

  const selected = useMemo(
    () => (detail?.id === selectedId ? detail : items.find((item) => item.id === selectedId)) ?? null,
    [detail, items, selectedId],
  );
  const selectedErrors = taskErrors(selected);

  const loadQueuesStatus = useCallback(async () => {
    const requestId = queuesRequestRef.current + 1;
    queuesRequestRef.current = requestId;
    setQueuesLoading(true);
    try {
      const result = await adminTasksApi.getQueuesStatus();
      if (requestId === queuesRequestRef.current) setQueuesStatus(result);
    } catch {
      // silently fail — queue monitoring is auxiliary
    } finally {
      if (requestId === queuesRequestRef.current) setQueuesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    const requestId = listRequestRef.current + 1;
    listRequestRef.current = requestId;
    setLoading(true);
    try {
      const result = await adminTasksApi.list({
        type: type === 'all' ? undefined : type,
        status,
        page,
        pageSize: 12,
      });
      if (requestId !== listRequestRef.current) return;
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(Math.max(1, result.totalPages));
      if (page > Math.max(1, result.totalPages)) {
        setPage(Math.max(1, result.totalPages));
        return;
      }
      setSelectedId((currentId) => {
        if (result.items.some((item) => item.id === currentId)) return currentId;
        return result.items[0]?.id ?? null;
      });
    } catch (error: any) {
      if (requestId === listRequestRef.current) toast.error(error?.message || '任务列表加载失败');
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [page, status, type]);

  const loadDetail = useCallback(async (id: string) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailLoading(true);
    try {
      const result = await adminTasksApi.get(id);
      if (requestId === detailRequestRef.current) setDetail(result);
    } catch (error: any) {
      if (requestId === detailRequestRef.current) toast.error(error?.message || '任务详情加载失败');
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadQueuesStatus();
  }, [loadQueuesStatus]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    const hasActive = items.some((item) => item.status === 'running' || item.status === 'queued');
    if (!hasActive && selected?.status !== 'running' && selected?.status !== 'queued') return;
    const timer = window.setInterval(() => {
      void load();
      void loadQueuesStatus();
      if (selectedId) void loadDetail(selectedId);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [items, load, loadDetail, loadQueuesStatus, selected?.status, selectedId]);

  const retry = async (task: AdminTask) => {
    try {
      const created = await adminTasksApi.retry(task.id);
      toast.success(selectedErrors.length ? '已创建失败项重试任务' : '已创建重试任务');
      setSelectedId(created.id);
      void load();
    } catch (error: any) {
      toast.error(error?.message || '重试失败');
    }
  };

  const cancelTask = async (task: AdminTask) => {
    try {
      await adminTasksApi.cancel(task.id);
      toast.success('任务已取消');
      void load();
      void loadQueuesStatus();
      if (selectedId === task.id) void loadDetail(task.id);
    } catch (error: any) {
      toast.error(error?.message || '取消失败');
    }
  };

  const prioritizeTask = async (task: AdminTask) => {
    try {
      await adminTasksApi.prioritize(task.id);
      toast.success('任务已插队到队列最前面');
      void load();
      void loadQueuesStatus();
      if (selectedId === task.id) void loadDetail(task.id);
    } catch (error: any) {
      toast.error(error?.message || '插队失败');
    }
  };

  const forceRunTask = async (task: AdminTask) => {
    try {
      const result = await adminTasksApi.forceRun(task.id);
      toast.success('任务已强制执行，新任务已插队');
      setPage(1);
      setSelectedId(result.id);
      void load();
      void loadQueuesStatus();
    } catch (error: any) {
      toast.error(error?.message || '强制执行失败');
    }
  };

  const canRetry = (task: AdminTask) =>
    task.type === 'learning-package-content-prepare'
    || task.type === 'warmup-pipeline-generate'
    || task.type === 'scene-topic-batch-generate'
    || task.type === 'vocabulary-missing-meaning-enrich'
    || task.type === 'vocabulary-polish'
    || task.type === 'chunk-missing-meaning-enrich'
    || task.type === 'pattern-missing-meaning-enrich'
    || task.type === 'script-video-render'
    || task.type === 'narrative-video-render';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">任务中心</h1>
          <p className="text-sm text-muted-foreground">统一跟踪内容准备、词汇 AI 富化与后台视频渲染；可在这里查看日志、取消和重试。</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={type} onChange={(event) => { setType(event.target.value as typeof type); setPage(1); }}>
            <option value="all">全部任务类型</option>
            <option value="scene-topic-batch-generate">学习包批量生成（教学文档+知识点训练）</option>
            <option value="learning-package-content-prepare">学习包内容准备</option>
            <option value="vocabulary-csv-import">词汇 CSV 批量导入</option>
            <option value="vocabulary-polish">词汇例句翻译补全与释义精简</option>
            <option value="vocabulary-missing-meaning-enrich">词汇字段检查与 AI 补全（词典+AI）</option>
            <option value="chunk-missing-meaning-enrich">句块字段检查与 AI 补全</option>
            <option value="pattern-missing-meaning-enrich">句型字段检查与 AI 补全</option>
            <option value="script-video-render">剧本演出视频</option>
            <option value="narrative-video-render">叙事视频预览</option>
            <option value="warmup-pipeline-generate">知识点练习 AI 生成</option>
          </Select>
          <Select value={status} onChange={(event) => { setStatus(event.target.value as AdminTaskStatus | 'all'); setPage(1); }}>
            <option value="all">全部状态</option>
            <option value="queued">排队中</option>
            <option value="running">执行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="canceled">已取消</option>
          </Select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}
            刷新
          </Button>
        </div>
      </div>

      {/* 队列状态面板 —— 全宽 */}
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {queuesLoading ? <Loader2 className="size-4 animate-spin" /> : <Layers3 className="size-4" />}
            队列状态
            <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={() => void loadQueuesStatus()}>
              <RefreshCw className="size-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {!queuesStatus ? (
            <p className="py-4 text-center text-xs text-muted-foreground">加载队列状态中...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {queuesStatus.queues.map((q) => (
                <div key={q.name} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{q.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{q.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {q.active > 0 && (
                      <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 gap-1">
                        <Loader2 className="size-3 animate-spin" />执行中 {q.active}
                      </Badge>
                    )}
                    {q.waiting > 0 && (
                      <Badge variant="outline" className="border-slate-300 text-slate-600 gap-1">
                        <Clock3 className="size-3" />等待 {q.waiting}
                      </Badge>
                    )}
                    {q.delayed > 0 && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 gap-1">
                        <Clock3 className="size-3" />延迟 {q.delayed}
                      </Badge>
                    )}
                    {q.failed > 0 && (
                      <Badge variant="outline" className="border-red-300 text-red-700 gap-1">
                        <AlertTriangle className="size-3" />失败 {q.failed}
                      </Badge>
                    )}
                    {q.completed > 0 && (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700 gap-1">
                        <CheckCircle2 className="size-3" />完成 {q.completed}
                      </Badge>
                    )}
                    {q.active === 0 && q.waiting === 0 && q.delayed === 0 && q.failed === 0 && q.completed === 0 && (
                      <span className="text-xs text-muted-foreground">空闲</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {queuesStatus && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>总计</span>
              <span className="flex gap-3">
                <span className="text-blue-600">执行 {queuesStatus.totalActive}</span>
                <span>等待 {queuesStatus.totalWaiting}</span>
                {queuesStatus.totalDelayed > 0 && <span className="text-amber-600">延迟 {queuesStatus.totalDelayed}</span>}
                {queuesStatus.totalFailed > 0 && <span className="text-red-600">失败 {queuesStatus.totalFailed}</span>}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* 任务列表 */}
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="size-4" />
              后台任务
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
                {items.map((task) => {
                  const errors = taskErrors(task);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedId(task.id)}
                      className={cn(
                        'block w-full px-4 py-2 text-left transition-colors hover:bg-muted/50',
                        selectedId === task.id && 'bg-muted',
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{task.title}</span>
                            <Badge variant="secondary" className="text-[10px]">{TYPE_LABELS[task.type] ?? task.type}</Badge>
                            {errors.length > 0 && (
                              <Badge variant="outline" className="border-red-300 text-[10px] text-red-700">
                                {errors.length} 个失败项
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {fmtStep(task.currentStep)} · {task.processedItems}/{task.totalItems} · {fmtDate(task.createdAt)}
                          </p>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={task.progress} className="h-1.5 flex-1" />
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{task.progress}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {total > 0 && (
              <div className="flex items-center justify-between border-t px-4 py-2">
                <span className="text-xs text-muted-foreground">第 {page} / {totalPages} 页 · 每页 12 条</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    <ChevronLeft className="mr-1 size-3.5" />上一页
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                    下一页<ChevronRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-4 xl:self-start">
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" />
              任务详情
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {!selected ? (
              <p className="py-12 text-center text-sm text-muted-foreground">选择一个任务查看详情</p>
            ) : (
              <div className="space-y-4">
                {/* 概览头部 */}
                <div className="overflow-hidden rounded-md border border-border">
                  <div className="border-b border-border/60 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold leading-6">{selected.title}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {TYPE_LABELS[selected.type] ?? selected.type} · 创建于 {fmtDate(selected.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={selected.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canRetry(selected) && (selected.status === 'failed' || selected.status === 'canceled' || selectedErrors.length > 0) && (
                        <Button variant="outline" size="sm" onClick={() => void retry(selected)}>
                          <RotateCcw className="mr-1 size-4" />
                          {selected.status === 'canceled'
                            ? '重新执行'
                            : selectedErrors.length > 0
                              ? '重试失败项'
                              : '重试任务'}
                        </Button>
                      )}
                      {(selected.status === 'queued' || selected.status === 'running') && (
                        <Button variant="outline" size="sm" onClick={() => void cancelTask(selected)}>
                          <XCircle className="mr-1 size-4" />
                          取消任务
                        </Button>
                      )}
                      {selected.status === 'queued' && (
                        <Button variant="outline" size="sm" onClick={() => void prioritizeTask(selected)}>
                          <ArrowUpRight className="mr-1 size-4" />
                          插队
                        </Button>
                      )}
                      {(selected.status === 'queued' || selected.status === 'failed') && (
                        <Button variant="default" size="sm" onClick={() => void forceRunTask(selected)}>
                          <Zap className="mr-1 size-4" />
                          强制执行
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    {/* 当前处理项 */}
                    <div className="flex items-center gap-2 text-xs">
                      <Loader2 className={cn('size-3.5 shrink-0', selected.status === 'running' ? 'animate-spin text-primary' : 'text-muted-foreground')} />
                      <span className="shrink-0 text-muted-foreground">当前处理</span>
                      <span className="truncate font-medium">{fmtStep(selected.currentStep)}</span>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{selected.processedItems}/{selected.totalItems}</span>
                        <span>{selected.progress}%</span>
                      </div>
                      <Progress value={selected.progress} className="h-2" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Metric label="成功" value={selected.successItems} tone="good" />
                      <Metric label="失败" value={selected.failedItems} tone={selected.failedItems ? 'bad' : 'muted'} />
                      <Metric label="AI 调用" value={getAiUsage(selected)?.calls ?? 0} tone="muted" />
                    </div>
                    <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      <span>开始 {fmtDate(selected.startedAt)}</span>
                      <span>结束 {fmtDate(selected.finishedAt)}</span>
                    </div>
                  </div>
                </div>

                {selected.errorMessage && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {selected.errorMessage}
                  </div>
                )}

                <AiUsageCard task={selected} />

                <SummaryPanel task={selected} />

                {selectedErrors.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                      <FileWarning className="size-3.5" />
                      失败项
                    </p>
                    <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
                      {selectedErrors.map((error: any, index: number) => (
                        <div key={`${error.type}-${error.id || index}`} className="rounded-md border border-red-200 bg-red-50/60 p-2 text-xs">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <Badge variant="outline" className="border-red-300 text-[10px] text-red-700">
                              {ERROR_TYPE_LABELS[error.type] ?? error.type}
                            </Badge>
                            {error.id && <span className="font-mono text-[10px] text-red-600/70">{error.id}</span>}
                          </div>
                          <p className="font-medium">{error.key || '-'}</p>
                          <p className="mt-1 leading-5 text-red-700">{error.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Layers3 className="size-3.5" />
                      最近日志
                    </p>
                    {detailLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {(detail?.logs ?? []).length === 0 ? (
                      <p className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">暂无日志</p>
                    ) : (
                      detail!.logs.map((log) => (
                        <div key={log.id} className="rounded-md border border-border p-2 text-xs">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
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
                              {log.step && <span className="text-[11px] text-muted-foreground">{fmtStep(log.step)}</span>}
                            </div>
                            <span className="text-muted-foreground">{fmtDate(log.createdAt)}</span>
                          </div>
                          <p className="leading-5">{log.message}</p>
                          {log.meta && (
                            <pre className="mt-2 max-h-24 overflow-auto rounded bg-muted/50 p-2 text-[10px] text-muted-foreground">
                              {JSON.stringify(log.meta, null, 2)}
                            </pre>
                          )}
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
