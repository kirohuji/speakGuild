import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Brain,
  Check,
  CheckCircle2,
  Clock3,
  Cpu,
  FileAudio,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  TestTube2,
  Volume2,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import {
  activateAiProvider,
  listAiProviders,
  testLlmProvider,
  testSttProvider,
  testTtsProvider,
  updateAiProvider,
  type AiProviderItem,
  type AiWordTimestamp,
  type LlmTestResult,
  type SttTestResult,
  type TtsTestResult,
} from '@/features/admin/api-ai-models';

const TABS = [
  { key: 'stt', label: '语音识别', short: 'STT', icon: Mic, accent: 'text-sky-500', ring: 'ring-sky-500/25', tint: 'bg-sky-500/10' },
  { key: 'tts', label: '语音合成', short: 'TTS', icon: Volume2, accent: 'text-emerald-500', ring: 'ring-emerald-500/25', tint: 'bg-emerald-500/10' },
  { key: 'llm', label: '大语言模型', short: 'LLM', icon: Brain, accent: 'text-amber-500', ring: 'ring-amber-500/25', tint: 'bg-amber-500/10' },
] as const;

const TYPE_LABELS: Record<string, string> = { stt: 'STT', tts: 'TTS', llm: 'LLM' };

const DEEPSEEK_MODELS = [
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', hint: '旗舰模型，适合高质量推理与复杂任务' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', hint: '更快、更省，适合日常对话与轻量任务' },
  { value: 'deepseek-chat', label: 'deepseek-chat（旧别名）', hint: '2026-07-24 后废弃，当前映射到 V4 Flash 非思考模式' },
  { value: 'deepseek-reasoner', label: 'deepseek-reasoner（旧别名）', hint: '2026-07-24 后废弃，当前映射到 V4 Flash 思考模式' },
];

const SAMPLE_TEXT = 'Please read this sentence clearly and naturally for a language-learning exercise.';
const SAMPLE_PROMPT = '用英文给一位 A2 水平学习者写一句自然的咖啡店点单表达，并附中文解释。';

type TestState = {
  text: string;
  prompt: string;
  language: string;
  temperature: string;
  enableTimestamps: boolean;
  voiceId: string;
  params: Record<string, string>;
  file: File | null;
};

const DEFAULT_TEST_STATE: TestState = {
  text: SAMPLE_TEXT,
  prompt: SAMPLE_PROMPT,
  language: '',
  temperature: '0.2',
  enableTimestamps: true,
  voiceId: '',
  params: {},
  file: null,
};

function StatStrip({ grouped }: { grouped: Record<string, AiProviderItem[]> }) {
  const stats = useMemo(() => {
    const total = Object.values(grouped).reduce((sum, items) => sum + items.length, 0);
    const active = Object.values(grouped).reduce((sum, items) => sum + items.filter((i) => i.isActive).length, 0);
    const configured = Object.values(grouped).reduce(
      (sum, items) => sum + items.filter((i) => i.model || i.apiKey || i.baseUrl).length,
      0,
    );
    return { total, active, configured };
  }, [grouped]);

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: '总供应商', value: stats.total, accent: 'text-muted-foreground' },
        { label: '已启用', value: stats.active, accent: 'text-primary' },
        { label: '已配置', value: stats.configured, accent: 'text-emerald-500' },
      ].map(({ label, value, accent }) => (
        <div key={label} className="flex flex-col gap-0.5 rounded-lg border bg-card p-3">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={cn('text-2xl font-semibold tracking-tight', accent)}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function nsToSeconds(value?: number) {
  return typeof value === 'number' ? value / 1_000_000_000 : 0;
}

function makeAudioUrl(audioBase64: string, mimeType: string) {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function getProviderInitials(item: AiProviderItem) {
  return item.label
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || item.provider.slice(0, 2).toUpperCase();
}

function getProviderPrimaryLine(item: AiProviderItem) {
  if (item.provider === 'whisper') return item.baseUrl || '本地推理服务未配置';
  if (item.provider === 'tencent') {
    const region = (item.config as Record<string, unknown> | undefined)?.region;
    return typeof region === 'string' && region ? `地域 ${region}` : '腾讯云凭据未配置';
  }
  return item.model || '未填写';
}

function getProviderPrimaryLabel(item: AiProviderItem) {
  if (item.provider === 'whisper') return '服务';
  if (item.provider === 'tencent') return '地域';
  return '模型';
}

function formatLatency(ms: number | null) {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

function getLatencyTone(ms: number | null) {
  if (ms === null) return 'text-muted-foreground';
  if (ms < 1500) return 'text-emerald-600';
  if (ms < 6000) return 'text-amber-600';
  return 'text-destructive';
}

function getLatencyLabel(ms: number | null) {
  if (ms === null) return '未测试';
  if (ms < 1500) return '响应很快';
  if (ms < 6000) return '响应正常';
  return '响应偏慢';
}

function getTtsFields(item: AiProviderItem) {
  if (item.provider === 'cartesia') {
    return [
      { key: 'speed', label: '语速', type: 'number', min: 0.6, max: 1.5, step: 0.1, value: '1' },
      { key: 'volume', label: '音量', type: 'number', min: 0.5, max: 2, step: 0.1, value: '1' },
      { key: 'emotion', label: '情绪', type: 'text', value: 'neutral' },
    ] as const;
  }
  return [
    { key: 'speed', label: '语速', type: 'number', min: 0.5, max: 2, step: 0.1, value: '1' },
    { key: 'pitch', label: '音高', type: 'number', min: -12, max: 12, step: 0.5, value: '0' },
    { key: 'vol', label: '音量', type: 'number', min: 0.1, max: 2, step: 0.1, value: '1' },
  ] as const;
}

function WordTimeline({
  words,
  currentTime,
}: {
  words: AiWordTimestamp[] | null | undefined;
  currentTime: number;
}) {
  if (!words?.length) {
    return (
      <div className="flex h-16 items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/20">
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className="w-1 rounded-full bg-muted-foreground/30 animate-pulse"
            style={{ height: 8 + ((index * 7) % 28), animationDelay: `${index * 45}ms` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <div className="mb-3 flex h-12 items-end gap-1 overflow-hidden">
        {words.slice(0, 80).map((word, index) => {
          const start = nsToSeconds(word.start_time);
          const end = nsToSeconds(word.end_time) || start + 0.25;
          const active = currentTime >= start && currentTime <= end;
          const passed = currentTime > end;
          return (
            <span
              key={`${word.text}-${word.start_time}-${index}`}
              className={cn(
                'min-w-1 flex-1 rounded-t transition-all duration-150',
                active ? 'bg-primary' : passed ? 'bg-primary/35' : 'bg-muted',
              )}
              style={{ height: active ? '100%' : `${22 + ((index * 11) % 54)}%` }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {words.slice(0, 120).map((word, index) => {
          const start = nsToSeconds(word.start_time);
          const end = nsToSeconds(word.end_time) || start + 0.25;
          const active = currentTime >= start && currentTime <= end;
          return (
            <span
              key={`${word.text}-${word.start_time}-token-${index}`}
              className={cn(
                'rounded px-1.5 py-0.5 text-xs transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground',
              )}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ProviderCard({
  item,
  onConfigure,
  onTest,
  onActivate,
  activating,
}: {
  item: AiProviderItem;
  onConfigure: (item: AiProviderItem) => void;
  onTest: (item: AiProviderItem) => void;
  onActivate: (item: AiProviderItem) => void;
  activating: boolean;
}) {
  const tabMeta = TABS.find((tab) => tab.key === item.type);
  const Icon = tabMeta?.icon ?? Cpu;
  const configured = Boolean(item.model || item.apiKey || item.baseUrl);

  return (
    <div
      className={cn(
        'group relative min-w-0 overflow-hidden rounded-md bg-muted/35 p-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/55 hover:shadow-md',
        item.isActive && 'bg-primary/5 ring-2',
        item.isActive && tabMeta?.ring,
      )}
    >
    
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-md bg-background/80', item.isActive && tabMeta?.tint)}>
          <Icon className={cn('size-4', tabMeta?.accent)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{item.label}</h3>
            <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">{getProviderInitials(item)}</Badge>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{item.provider}</p>
        </div>
        {item.isActive && (
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 text-xs">
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted/40 px-2.5 py-2">
          <span className="shrink-0 text-muted-foreground">{getProviderPrimaryLabel(item)}</span>
          <span className="min-w-0 flex-1 truncate text-right font-mono" title={getProviderPrimaryLine(item)}>{getProviderPrimaryLine(item)}</span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted/40 px-2.5 py-2">
          <span className="shrink-0 text-muted-foreground">状态</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', configured ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
            <span className="truncate">{configured ? '已配置' : '待配置'}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {item.isActive ? (
          <Badge className="flex h-8 w-full min-w-0 items-center justify-center rounded-md bg-primary/10 px-2 text-primary hover:bg-primary/10">
            <span className="truncate">当前使用</span>
          </Badge>
        ) : (
          <Button size="sm" variant="outline" className="h-8 w-full min-w-0 px-2" disabled={activating} onClick={() => onActivate(item)}>
            {activating ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Play className="mr-1.5 size-3.5" />}
            <span className="truncate">启用</span>
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" className="h-8 min-w-0 px-2" onClick={() => onTest(item)}>
            <TestTube2 className="mr-1.5 size-3.5 shrink-0" />
            <span className="truncate">测试</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-8 min-w-0 px-2" onClick={() => onConfigure(item)}>
            <Settings2 className="mr-1.5 size-3.5 shrink-0" />
            <span className="truncate">配置</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfigDialog({
  open,
  onOpenChange,
  item,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: AiProviderItem | null;
  onSaved: () => void;
}) {
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('300000');
  const [region, setRegion] = useState('ap-guangzhou');
  const [temperature, setTemperature] = useState('0.2');
  const [enableTimestamps, setEnableTimestamps] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    const cfg = item.config ?? {};
    setModel(item.provider === 'deepseek' ? (item.model || 'deepseek-v4-pro') : (item.model ?? ''));
    setApiKey(item.apiKey ?? '');
    setBaseUrl(item.provider === 'deepseek' ? (item.baseUrl || 'https://api.deepseek.com') : (item.baseUrl ?? ''));
    setTimeoutMs(String((cfg as Record<string, unknown>).timeoutMs ?? 300000));
    setRegion(String((cfg as Record<string, unknown>).region ?? 'ap-guangzhou'));
    setTemperature(String((cfg as Record<string, unknown>).temperature ?? 0.2));
    setEnableTimestamps((cfg as Record<string, unknown>).enableTimestamps !== false);
    setMessage(null);
  }, [item]);

  if (!item) return null;

  const isStt = item.type === 'stt';
  const isWhisper = item.type === 'stt' && item.provider === 'whisper';
  const isTencentAsr = item.type === 'stt' && item.provider === 'tencent';
  const isDeepSeek = item.type === 'llm' && item.provider === 'deepseek';

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const config: Record<string, unknown> = {};
      if (isWhisper) {
        const timeout = Number(timeoutMs);
        if (Number.isFinite(timeout)) config.timeoutMs = timeout;
      } else if (isTencentAsr) {
        config.region = region.trim() || 'ap-guangzhou';
      } else if (isStt) {
        const t = Number(temperature);
        if (Number.isFinite(t)) config.temperature = t;
        config.enableTimestamps = enableTimestamps;
      }
      await updateAiProvider(item.id, {
        model,
        apiKey,
        baseUrl,
        ...(Object.keys(config).length ? { config } : {}),
      });
      setMessage('配置已保存');
      onSaved();
      setTimeout(() => onOpenChange(false), 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2">
          <Settings2 className="size-4" />
          配置 {item.label}
        </DialogTitle>
        <DialogDescription>
          {TYPE_LABELS[item.type]} 供应商 · {item.provider}
        </DialogDescription>

        {message && (
          <div className={cn(
            'rounded-md px-3 py-2 text-xs',
            message.includes('失败') ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600',
          )}>
            {message}
          </div>
        )}

        <div className="space-y-4 py-2">
          {isWhisper ? (
            <>
              <div className="space-y-2">
                <Label>WHISPER_INFERENCE_URL</Label>
                <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="font-mono text-sm" placeholder="http://127.0.0.1:9000/v1/audio/transcriptions" />
              </div>
              <div className="space-y-2">
                <Label>WHISPER_TIMEOUT_MS</Label>
                <Input type="number" min="1000" step="1000" value={timeoutMs} onChange={(event) => setTimeoutMs(event.target.value)} className="font-mono text-sm" />
              </div>
            </>
          ) : isTencentAsr ? (
            <>
              <div className="space-y-2">
                <Label>TENCENT_SECRET_ID</Label>
                <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="font-mono text-sm" placeholder="AKID..." />
              </div>
              <div className="space-y-2">
                <Label>TENCENT_SECRET_KEY</Label>
                <Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="font-mono text-sm" placeholder="留空则使用环境变量" />
              </div>
              <div className="space-y-2">
                <Label>TENCENT_REGION</Label>
                <Input value={region} onChange={(event) => setRegion(event.target.value)} className="font-mono text-sm" placeholder="ap-guangzhou" />
              </div>
            </>
          ) : isDeepSeek ? (
            <>
              <div className="space-y-2">
                <Label>DeepSeek 模型</Label>
                <Select value={model} onChange={(event) => setModel(event.target.value)}>
                  {DEEPSEEK_MODELS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {DEEPSEEK_MODELS.find((option) => option.value === model)?.hint ?? '官方模型名称会直接传给 DeepSeek Chat API'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="font-mono text-sm" placeholder="https://api.deepseek.com" />
              </div>
              <div className="space-y-2">
                <Label>DEEPSEEK_API_KEY</Label>
                <Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="font-mono text-sm" placeholder="留空则使用环境变量" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>模型名称</Label>
                <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="例如 deepseek-chat / gpt-4o / speech-2.8-hd" />
              </div>
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="font-mono text-sm" placeholder="https://api.example.com/v1" />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="font-mono text-sm" placeholder="留空则使用环境变量" />
              </div>
            </>
          )}

          {isStt && !isWhisper && !isTencentAsr && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">识别参数</span>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Temperature ({temperature})</Label>
                  <Input type="range" min="0" max="1" step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-md bg-background px-3 py-2">
                  <div>
                    <Label className="text-sm">词时间戳</Label>
                    <p className="text-[11px] text-muted-foreground">Whisper 开启后可展示逐词动画</p>
                  </div>
                  <Switch checked={enableTimestamps} onCheckedChange={setEnableTimestamps} />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestDialog({
  item,
  open,
  onOpenChange,
}: {
  item: AiProviderItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<TestState>(DEFAULT_TEST_STATE);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sttResult, setSttResult] = useState<SttTestResult | null>(null);
  const [ttsResult, setTtsResult] = useState<TtsTestResult | null>(null);
  const [llmResult, setLlmResult] = useState<LlmTestResult | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    if (!item || !open) return;
    const ttsDefaults = Object.fromEntries(getTtsFields(item).map((field) => [field.key, field.value]));
    setState({
      ...DEFAULT_TEST_STATE,
      params: ttsDefaults,
      temperature: String((item.config as Record<string, unknown> | undefined)?.temperature ?? '0.2'),
      enableTimestamps: (item.config as Record<string, unknown> | undefined)?.enableTimestamps !== false,
    });
    setError(null);
    setSttResult(null);
    setTtsResult(null);
    setLlmResult(null);
    setCurrentTime(0);
    setElapsedMs(null);
  }, [item, open]);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const setNewAudioUrl = (url: string | null) => {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  if (!item) return null;

  const words = sttResult?.wordTimestamps ?? ttsResult?.wordTimestamps ?? null;
  const supportsWordTimestamps = item.type !== 'stt' || item.provider !== 'tencent';
  const supportsTemperature = item.type !== 'stt' || item.provider !== 'tencent';

  const runTest = async () => {
    setRunning(true);
    setError(null);
    setSttResult(null);
    setTtsResult(null);
    setLlmResult(null);
    setCurrentTime(0);
    setElapsedMs(null);
    const startedAt = performance.now();
    try {
      if (item.type === 'stt') {
        if (!state.file) throw new Error('请先上传一段录音文件');
        const localAudioUrl = URL.createObjectURL(state.file);
        setNewAudioUrl(localAudioUrl);
        const result = await testSttProvider(item, state.file, {
          language: state.language || undefined,
          temperature: supportsTemperature ? Number(state.temperature) : undefined,
          enableTimestamps: state.enableTimestamps,
        });
        setElapsedMs(Math.round(performance.now() - startedAt));
        setSttResult(result);
        return;
      }

      if (item.type === 'tts') {
        if (!item.model) throw new Error('请先配置模型名称');
        const params: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(state.params)) {
          const numeric = Number(value);
          params[key] = value !== '' && Number.isFinite(numeric) ? numeric : value;
        }
        const result = await testTtsProvider(item, {
          text: state.text.trim(),
          voiceId: state.voiceId.trim(),
          params,
        });
        setElapsedMs(Math.round(performance.now() - startedAt));
        setTtsResult(result);
        setNewAudioUrl(makeAudioUrl(result.audioBase64, result.mimeType));
        return;
      }

      const result = await testLlmProvider(item.id, state.prompt.trim());
      setElapsedMs(result.elapsedMs ?? Math.round(performance.now() - startedAt));
      setLlmResult(result);
      setNewAudioUrl(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '测试失败');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle className="flex items-center gap-2">
          <TestTube2 className="size-4" />
          测试 {item.label}
        </DialogTitle>
        <DialogDescription>
          按当前卡片的 provider / model 调用，用于快速验证参数和返回结构。
        </DialogDescription>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">测试输入</span>
              </div>

              {item.type === 'stt' && (
                <div className="space-y-3">
                  <Label className="block">录音文件</Label>
                  <Input
                    type="file"
                    accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg"
                    onChange={(event) => setState((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))}
                  />
                  <div className={cn('grid gap-2', supportsTemperature ? 'grid-cols-2' : 'grid-cols-1')}>
                    <div className="space-y-2">
                      <Label>语言</Label>
                      <Select value={state.language} onChange={(event) => setState((prev) => ({ ...prev, language: event.target.value }))}>
                        <SelectItem value="">自动检测</SelectItem>
                        <SelectItem value="en">英文</SelectItem>
                        <SelectItem value="zh-CN">中文</SelectItem>
                      </Select>
                    </div>
                    {supportsTemperature && (
                      <div className="space-y-2">
                        <Label>Temperature</Label>
                        <Input type="number" min="0" max="1" step="0.1" value={state.temperature} onChange={(event) => setState((prev) => ({ ...prev, temperature: event.target.value }))} />
                      </div>
                    )}
                  </div>
                  {supportsWordTimestamps ? (
                    <div className="flex items-center justify-between rounded-md bg-background px-3 py-2">
                      <span className="text-sm">词时间戳</span>
                      <Switch checked={state.enableTimestamps} onCheckedChange={(value) => setState((prev) => ({ ...prev, enableTimestamps: value }))} />
                    </div>
                  ) : (
                    <div className="rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
                      腾讯云一句话识别不返回词时间戳
                    </div>
                  )}
                </div>
              )}

              {item.type === 'tts' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>合成文本</Label>
                    <Textarea value={state.text} onChange={(event) => setState((prev) => ({ ...prev, text: event.target.value }))} className="min-h-28" />
                  </div>
                  <div className="space-y-2">
                    <Label>Voice ID</Label>
                    <Input value={state.voiceId} onChange={(event) => setState((prev) => ({ ...prev, voiceId: event.target.value }))} placeholder={item.provider === 'cartesia' ? 'Cartesia 必填' : '留空自动选择'} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {getTtsFields(item).map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        <Input
                          type={field.type}
                          min={'min' in field ? field.min : undefined}
                          max={'max' in field ? field.max : undefined}
                          step={'step' in field ? field.step : undefined}
                          value={state.params[field.key] ?? field.value}
                          onChange={(event) => setState((prev) => ({ ...prev, params: { ...prev.params, [field.key]: event.target.value } }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.type === 'llm' && (
                <div className="space-y-2">
                  <Label>Prompt</Label>
                  <Textarea value={state.prompt} onChange={(event) => setState((prev) => ({ ...prev, prompt: event.target.value }))} className="min-h-40" />
                </div>
              )}
            </div>

            <Button className="w-full" onClick={runTest} disabled={running}>
              {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Wand2 className="mr-2 size-4" />}
              {running ? '测试中...' : '开始测试'}
            </Button>

            {error && (
              <div className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border bg-background p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileAudio className="size-4 text-muted-foreground" />
                  测试结果
                </div>
                <div className="flex items-center gap-2">
                  {elapsedMs !== null && (
                    <Badge variant="outline" className={cn('gap-1 font-mono', getLatencyTone(elapsedMs))}>
                      <Clock3 className="size-3" />
                      {formatLatency(elapsedMs)}
                    </Badge>
                  )}
                  {(sttResult || ttsResult || llmResult) && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="size-3" />
                      已返回
                    </Badge>
                  )}
                </div>
              </div>

              {elapsedMs !== null && (
                <div className="mb-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md bg-muted/40 px-3 py-2">
                  <div className="flex size-8 items-center justify-center rounded bg-background">
                    <Clock3 className={cn('size-4', getLatencyTone(elapsedMs))} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">端到端延迟</span>
                      <span className={cn('font-mono text-sm font-semibold', getLatencyTone(elapsedMs))}>{formatLatency(elapsedMs)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          elapsedMs < 1500 ? 'bg-emerald-500' : elapsedMs < 6000 ? 'bg-amber-500' : 'bg-destructive',
                        )}
                        style={{ width: `${Math.min(100, Math.max(8, (elapsedMs / 10_000) * 100))}%` }}
                      />
                    </div>
                    <p className={cn('mt-1 text-[11px]', getLatencyTone(elapsedMs))}>{getLatencyLabel(elapsedMs)}</p>
                  </div>
                </div>
              )}

              {audioUrl && (
                <audio
                  className="mb-3 w-full"
                  controls
                  src={audioUrl}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
                />
              )}

              {(item.type === 'tts' || (item.type === 'stt' && supportsWordTimestamps)) && (
                <WordTimeline words={words} currentTime={currentTime} />
              )}

              {item.type === 'stt' && !supportsWordTimestamps && (
                <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                  腾讯云 ASR 当前接口无词时间戳，测试结果仅展示转写文本和延迟。
                </div>
              )}

              {sttResult && (
                <div className="mt-3 rounded-md bg-muted/40 p-3">
                  <p className="mb-1 text-xs text-muted-foreground">转写文本</p>
                  <p className="whitespace-pre-wrap text-sm">{sttResult.text || '未识别到文本'}</p>
                </div>
              )}

              {ttsResult && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-muted-foreground">音频格式</p>
                    <p className="font-mono">{ttsResult.mimeType}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-muted-foreground">词时间戳</p>
                    <p>{ttsResult.wordTimestamps?.length ?? 0} 个</p>
                  </div>
                </div>
              )}

              {llmResult && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Clock3 className="size-3" />
                      {formatLatency(elapsedMs ?? llmResult.elapsedMs)}
                    </Badge>
                    <Badge variant="outline">{llmResult.provider}</Badge>
                    <Badge variant="outline">{llmResult.model}</Badge>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="mb-1 text-xs text-muted-foreground">模型回复</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{llmResult.text}</p>
                  </div>
                </div>
              )}

              {!sttResult && !ttsResult && !llmResult && !running && (
                <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  运行一次测试后，这里会显示音频、时间戳动画或模型回复
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminAiModelsPage() {
  const [grouped, setGrouped] = useState<Record<string, AiProviderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stt');
  const [configItem, setConfigItem] = useState<AiProviderItem | null>(null);
  const [testItem, setTestItem] = useState<AiProviderItem | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setGrouped(await listAiProviders());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeByType = useCallback((type: string) => grouped[type]?.find((item) => item.isActive), [grouped]);
  const currentLine = useMemo(() => TABS.map((tab) => ({ tab, item: activeByType(tab.key) })), [activeByType]);

  const handleActivate = async (item: AiProviderItem) => {
    setActivatingId(item.id);
    try {
      await activateAiProvider(item.id);
      await fetchData();
    } finally {
      setActivatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">大模型管理</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">配置 STT / TTS / LLM，并直接在卡片上发起测试。</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="h-8 shrink-0">
          <RefreshCw className="mr-1.5 size-3.5" />
          刷新
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
          <TabsList className="grid h-10 w-full grid-cols-3 rounded-md bg-muted/50 p-1">
            {TABS.map((tab) => {
              const active = activeByType(tab.key);
              return (
                <TabsTrigger key={tab.key} value={tab.key} className="h-8 gap-2 rounded">
                  <tab.icon className={cn('size-4', activeTab === tab.key && tab.accent)} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.short}</span>
                  {active && <span className="hidden max-w-24 truncate rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">{active.label}</span>}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1.5">
            <span className="mr-1 text-[11px] text-muted-foreground">当前链路</span>
            {currentLine.map(({ tab, item }) => (
              <Badge key={tab.key} variant="secondary" className="h-6 gap-1 rounded px-1.5 text-[10px]">
                <tab.icon className={cn('size-3', tab.accent)} />
                {tab.short}: {item ? item.label : '未启用'}
              </Badge>
            ))}
          </div>

          {TABS.map((tab) => (
            <TabsContent key={tab.key} value={tab.key} className="mt-3">
              {(grouped[tab.key] ?? []).length ? (
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
                  {(grouped[tab.key] ?? []).map((item) => (
                    <ProviderCard
                      key={item.id}
                      item={item}
                      activating={activatingId === item.id}
                      onActivate={handleActivate}
                      onConfigure={setConfigItem}
                      onTest={setTestItem}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
                  暂无 {tab.label} 供应商
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

      <ConfigDialog
        open={!!configItem}
        onOpenChange={(open) => { if (!open) setConfigItem(null); }}
        item={configItem}
        onSaved={fetchData}
      />
      <TestDialog
        open={!!testItem}
        onOpenChange={(open) => { if (!open) setTestItem(null); }}
        item={testItem}
      />
    </div>
  );
}
