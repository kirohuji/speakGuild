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
  Plus,
  RefreshCw,
  Settings2,
  TestTube2,
  Trash2,
  Volume2,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import {
  activateAiProvider,
  createAiProvider,
  deleteAiProvider,
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
  { key: 'stt', label: 'Speech to Text', short: 'STT', icon: Mic, accent: 'text-sky-500', ring: 'ring-sky-500/25', tint: 'bg-sky-500/10' },
  { key: 'tts', label: 'Text to Speech', short: 'TTS', icon: Volume2, accent: 'text-emerald-500', ring: 'ring-emerald-500/25', tint: 'bg-emerald-500/10' },
  { key: 'llm', label: 'Language Model', short: 'LLM', icon: Brain, accent: 'text-amber-500', ring: 'ring-amber-500/25', tint: 'bg-amber-500/10' },
] as const;

const TYPE_LABELS: Record<string, string> = { stt: 'STT', tts: 'TTS', llm: 'LLM' };
const BUILT_IN_PROVIDERS = new Set(['whisper', 'tencent', 'minimax', 'cartesia', 'deepseek', 'openai']);

const DEEPSEEK_MODELS = [
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', hint: 'Flagship model for higher-quality reasoning and complex tasks.' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', hint: 'Faster and cheaper option for everyday dialogue and lightweight tasks.' },
  { value: 'deepseek-chat', label: 'deepseek-chat (legacy alias)', hint: 'Legacy alias. DeepSeek says it will be deprecated on 2026-07-24 15:59 UTC.' },
  { value: 'deepseek-reasoner', label: 'deepseek-reasoner (legacy alias)', hint: 'Legacy alias. DeepSeek says it will be deprecated on 2026-07-24 15:59 UTC.' },
];

const MINIMAX_MODELS = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo',
];

const SAMPLE_TEXT = 'Please read this sentence clearly and naturally for a language-learning exercise.';
const SAMPLE_PROMPT = 'Write one natural English sentence for ordering coffee at A2 level, then explain it in Chinese.';

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

type TtsTestField = {
  key: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  value: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
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

function nsToSeconds(value?: number) {
  return typeof value === 'number' ? value / 1_000_000_000 : 0;
}

function makeAudioUrl(audioBase64: string, mimeType: string) {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
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
  if (ms === null) return 'Not tested';
  if (ms < 1500) return 'Fast response';
  if (ms < 6000) return 'Normal response';
  return 'Slow response';
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
  if (item.provider === 'whisper') return item.baseUrl || 'Local inference URL not configured';
  if (item.provider === 'tencent') {
    const region = (item.config as Record<string, unknown> | undefined)?.region;
    return typeof region === 'string' && region ? `Region ${region}` : 'Tencent credentials not configured';
  }
  return item.model || 'Not set';
}

function getProviderPrimaryLabel(item: AiProviderItem) {
  if (item.provider === 'whisper') return 'Service';
  if (item.provider === 'tencent') return 'Region';
  return 'Model';
}

function canDeleteProvider(item: AiProviderItem) {
  return item.type === 'llm' && !item.isActive && !BUILT_IN_PROVIDERS.has(item.provider);
}

function getTtsFields(item: AiProviderItem): TtsTestField[] {
  if (item.provider === 'cartesia') {
    return [
      { key: 'speed', label: 'Speed', type: 'number', min: 0.6, max: 1.5, step: 0.1, value: '1' },
      { key: 'volume', label: 'Volume', type: 'number', min: 0.5, max: 2, step: 0.1, value: '1' },
      { key: 'emotion', label: 'Emotion', type: 'select', value: 'neutral', options: ['neutral', 'excited', 'content', 'sad', 'angry', 'scared'] },
    ];
  }
  if (item.provider === 'minimax') {
    return [
      { key: 'speed', label: 'Speed', type: 'number', min: 0.5, max: 2, step: 0.1, value: '1' },
      { key: 'vol', label: 'Volume', type: 'number', min: 0, max: 10, step: 0.1, value: '1' },
      { key: 'pitch', label: 'Pitch', type: 'number', min: -12, max: 12, step: 1, value: '0' },
      { key: 'emotion', label: 'Emotion', type: 'select', value: 'auto', options: ['auto', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral', 'calm', 'fluent'] },
      { key: 'language_boost', label: 'Language', type: 'select', value: 'auto', options: ['auto', 'Chinese', 'Chinese,Yue', 'English', 'Japanese', 'Korean', 'Spanish', 'French', 'German'] },
      { key: 'format', label: 'Format', type: 'select', value: 'mp3', options: ['mp3', 'wav', 'flac'] },
      { key: 'sample_rate', label: 'Sample rate', type: 'select', value: '32000', options: ['16000', '24000', '32000', '44100'] },
      { key: 'bitrate', label: 'Bitrate', type: 'select', value: '128000', options: ['64000', '128000', '256000'] },
      { key: 'channel', label: 'Channel', type: 'number', min: 1, max: 2, step: 1, value: '1' },
      { key: 'output_format', label: 'Response', type: 'select', value: 'hex', options: ['hex', 'url'] },
      { key: 'subtitle_enable', label: 'Subtitle', type: 'boolean', value: 'false' },
      { key: 'subtitle_type', label: 'Subtitle type', type: 'select', value: 'sentence', options: ['sentence', 'word'] },
    ];
  }
  return [
    { key: 'speed', label: 'Speed', type: 'number', min: 0.5, max: 2, step: 0.1, value: '1' },
    { key: 'pitch', label: 'Pitch', type: 'number', min: -12, max: 12, step: 0.5, value: '0' },
    { key: 'vol', label: 'Volume', type: 'number', min: 0.1, max: 2, step: 0.1, value: '1' },
  ];
}

function WordTimeline({ words, currentTime }: { words: AiWordTimestamp[] | null | undefined; currentTime: number }) {
  if (!words?.length) {
    return (
      <div className="flex h-16 items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/20">
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className="w-1 animate-pulse rounded-full bg-muted-foreground/30"
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
              className={cn('min-w-1 flex-1 rounded-t transition-all duration-150', active ? 'bg-primary' : passed ? 'bg-primary/35' : 'bg-muted')}
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
              className={cn('rounded px-1.5 py-0.5 text-xs transition-colors', active ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground')}
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
  onDelete,
  activating,
}: {
  item: AiProviderItem;
  onConfigure: (item: AiProviderItem) => void;
  onTest: (item: AiProviderItem) => void;
  onActivate: (item: AiProviderItem) => void;
  onDelete: (item: AiProviderItem) => void;
  activating: boolean;
}) {
  const tabMeta = TABS.find((tab) => tab.key === item.type);
  const Icon = tabMeta?.icon ?? Cpu;
  const configured = Boolean(item.model || item.apiKey || item.baseUrl);

  return (
    <div className={cn('group relative min-w-0 overflow-hidden rounded-md bg-muted/35 p-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/55 hover:shadow-md', item.isActive && 'bg-primary/5 ring-2', item.isActive && tabMeta?.ring)}>
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
          <span className="shrink-0 text-muted-foreground">Status</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', configured ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
            <span className="truncate">{configured ? 'Configured' : 'Needs setup'}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {item.isActive ? (
          <Badge className="flex h-8 w-full min-w-0 items-center justify-center rounded-md bg-primary/10 px-2 text-primary hover:bg-primary/10">
            <span className="truncate">Active</span>
          </Badge>
        ) : (
          <Button size="sm" variant="outline" className="h-8 w-full min-w-0 px-2" disabled={activating} onClick={() => onActivate(item)}>
            {activating ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Play className="mr-1.5 size-3.5" />}
            <span className="truncate">Activate</span>
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" className="h-8 min-w-0 px-2" onClick={() => onTest(item)}>
            <TestTube2 className="mr-1.5 size-3.5 shrink-0" />
            <span className="truncate">Test</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-8 min-w-0 px-2" onClick={() => onConfigure(item)}>
            <Settings2 className="mr-1.5 size-3.5 shrink-0" />
            <span className="truncate">Config</span>
          </Button>
        </div>
        {canDeleteProvider(item) && (
          <Button size="sm" variant="ghost" className="h-8 w-full min-w-0 px-2 text-destructive hover:text-destructive" onClick={() => onDelete(item)}>
            <Trash2 className="mr-1.5 size-3.5 shrink-0" />
            <span className="truncate">Delete</span>
          </Button>
        )}
      </div>
    </div>
  );
}

function ConfigDialog({ open, onOpenChange, item, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; item: AiProviderItem | null; onSaved: () => void }) {
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [groupId, setGroupId] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('300000');
  const [region, setRegion] = useState('ap-guangzhou');
  const [temperature, setTemperature] = useState('0.2');
  const [enableTimestamps, setEnableTimestamps] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    const cfg = item.config ?? {};
    setModel(item.provider === 'deepseek' ? (item.model || 'deepseek-v4-pro') : item.provider === 'minimax' ? (item.model || 'speech-2.8-hd') : (item.model ?? ''));
    setApiKey(item.apiKey ?? '');
    setBaseUrl(item.provider === 'deepseek' ? (item.baseUrl || 'https://api.deepseek.com') : (item.baseUrl ?? ''));
    setGroupId(String((cfg as Record<string, unknown>).groupId ?? ''));
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
  const isMiniMax = item.type === 'tts' && item.provider === 'minimax';

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
      } else if (isMiniMax) {
        config.groupId = groupId.trim();
      }
      await updateAiProvider(item.id, { model, apiKey, baseUrl, ...(Object.keys(config).length ? { config } : {}) });
      setMessage('Saved');
      onSaved();
      setTimeout(() => onOpenChange(false), 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2"><Settings2 className="size-4" />Configure {item.label}</DialogTitle>
        <DialogDescription>{TYPE_LABELS[item.type]} provider · {item.provider}</DialogDescription>
        {message && <div className={cn('rounded-md px-3 py-2 text-xs', message.includes('failed') ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600')}>{message}</div>}

        <div className="space-y-4 py-2">
          {isWhisper ? (
            <>
              <div className="space-y-2"><Label>WHISPER_INFERENCE_URL</Label><Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="font-mono text-sm" placeholder="http://127.0.0.1:9000/v1/audio/transcriptions" /></div>
              <div className="space-y-2"><Label>WHISPER_TIMEOUT_MS</Label><Input type="number" min="1000" step="1000" value={timeoutMs} onChange={(event) => setTimeoutMs(event.target.value)} className="font-mono text-sm" /></div>
            </>
          ) : isTencentAsr ? (
            <>
              <div className="space-y-2"><Label>TENCENT_SECRET_ID</Label><Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="font-mono text-sm" placeholder="AKID..." /></div>
              <div className="space-y-2"><Label>TENCENT_SECRET_KEY</Label><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="font-mono text-sm" placeholder="Use env var when empty" /></div>
              <div className="space-y-2"><Label>TENCENT_REGION</Label><Input value={region} onChange={(event) => setRegion(event.target.value)} className="font-mono text-sm" placeholder="ap-guangzhou" /></div>
            </>
          ) : isMiniMax ? (
            <>
              <div className="space-y-2"><Label>MiniMax model</Label><Select value={model} onChange={(event) => setModel(event.target.value)}>{MINIMAX_MODELS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</Select></div>
              <div className="space-y-2"><Label>MINIMAX_API_KEY</Label><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="font-mono text-sm" placeholder="Use env var when empty" /></div>
              <div className="space-y-2"><Label>MINIMAX_GROUP_ID</Label><Input value={groupId} onChange={(event) => setGroupId(event.target.value)} className="font-mono text-sm" placeholder="1943473439796896389" /></div>
            </>
          ) : isDeepSeek ? (
            <>
              <div className="space-y-2"><Label>DeepSeek model</Label><Select value={model} onChange={(event) => setModel(event.target.value)}>{DEEPSEEK_MODELS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</Select><p className="text-[11px] text-muted-foreground">{DEEPSEEK_MODELS.find((option) => option.value === model)?.hint}</p></div>
              <div className="space-y-2"><Label>Base URL</Label><Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="font-mono text-sm" placeholder="https://api.deepseek.com" /></div>
              <div className="space-y-2"><Label>DEEPSEEK_API_KEY</Label><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="font-mono text-sm" placeholder="Use env var when empty" /></div>
            </>
          ) : (
            <>
              <div className="space-y-2"><Label>Model</Label><Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="deepseek-v4-pro / gpt-4o" /></div>
              <div className="space-y-2"><Label>Base URL</Label><Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="font-mono text-sm" placeholder="https://api.example.com/v1" /></div>
              <div className="space-y-2"><Label>API Key</Label><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="font-mono text-sm" placeholder="Use env var when empty" /></div>
            </>
          )}

          {isStt && !isWhisper && !isTencentAsr && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="space-y-3">
                <div className="space-y-2"><Label>Temperature ({temperature})</Label><Input type="range" min="0" max="1" step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} /></div>
                <div className="flex items-center justify-between rounded-md bg-background px-3 py-2"><div><Label className="text-sm">Word timestamps</Label><p className="text-[11px] text-muted-foreground">Used by providers that support word-level timestamps.</p></div><Switch checked={enableTimestamps} onCheckedChange={setEnableTimestamps} /></div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLlmDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [provider, setProvider] = useState('');
  const [label, setLabel] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProvider('');
    setLabel('');
    setModel('');
    setBaseUrl('');
    setApiKey('');
    setMessage(null);
  }, [open]);

  const handleCreate = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await createAiProvider({ type: 'llm', provider, label, model, baseUrl, apiKey });
      onCreated();
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2"><Plus className="size-4" />Add LLM model</DialogTitle>
        <DialogDescription>Add an OpenAI-compatible LLM provider.</DialogDescription>
        {message && <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{message}</div>}
        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>Provider key</Label><Input value={provider} onChange={(event) => setProvider(event.target.value)} className="font-mono text-sm" placeholder="openrouter" /></div>
            <div className="space-y-2"><Label>Display name</Label><Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="OpenRouter" /></div>
          </div>
          <div className="space-y-2"><Label>Model</Label><Input value={model} onChange={(event) => setModel(event.target.value)} className="font-mono text-sm" placeholder="provider/model-name" /></div>
          <div className="space-y-2"><Label>Base URL</Label><Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="font-mono text-sm" placeholder="https://api.example.com/v1" /></div>
          <div className="space-y-2"><Label>API Key</Label><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="font-mono text-sm" placeholder="sk-..." /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving || !provider.trim() || !label.trim()}>{saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProviderDialog({ item, open, onOpenChange, onDeleted }: { item: AiProviderItem | null; open: boolean; onOpenChange: (open: boolean) => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) setMessage(null);
  }, [open]);

  if (!item) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setMessage(null);
    try {
      await deleteAiProvider(item.id);
      onDeleted();
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2"><Trash2 className="size-4 text-destructive" />Delete model</DialogTitle>
        <DialogDescription>Built-in or active providers cannot be deleted.</DialogDescription>
        <div className="rounded-md bg-muted/40 p-3 text-sm"><p className="font-medium">{item.label}</p><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.provider} · {item.model || 'no model'}</p></div>
        {message && <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{message}</div>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}Delete</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestDialog({ item, open, onOpenChange }: { item: AiProviderItem | null; open: boolean; onOpenChange: (open: boolean) => void }) {
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
    setState({ ...DEFAULT_TEST_STATE, params: ttsDefaults, temperature: String((item.config as Record<string, unknown> | undefined)?.temperature ?? '0.2'), enableTimestamps: (item.config as Record<string, unknown> | undefined)?.enableTimestamps !== false });
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
        if (!state.file) throw new Error('Please upload an audio file first.');
        setNewAudioUrl(URL.createObjectURL(state.file));
        const result = await testSttProvider(item, state.file, { language: state.language || undefined, temperature: supportsTemperature ? Number(state.temperature) : undefined, enableTimestamps: state.enableTimestamps });
        setElapsedMs(Math.round(performance.now() - startedAt));
        setSttResult(result);
        return;
      }
      if (item.type === 'tts') {
        if (!item.model) throw new Error('Please configure model first.');
        const params: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(state.params)) {
          const numeric = Number(value);
          params[key] = value !== '' && Number.isFinite(numeric) ? numeric : value;
        }
        const result = await testTtsProvider(item, { text: state.text.trim(), voiceId: state.voiceId.trim(), params });
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
      setError(caught instanceof Error ? caught.message : 'Test failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle className="flex items-center gap-2"><TestTube2 className="size-4" />Test {item.label}</DialogTitle>
        <DialogDescription>Run the selected provider with the current card config and test inputs.</DialogDescription>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex items-center gap-2"><Wand2 className="size-4 text-muted-foreground" /><span className="text-sm font-medium">Input</span></div>

              {item.type === 'stt' && (
                <div className="space-y-3">
                  <Label className="block">Audio file</Label>
                  <Input type="file" accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg" onChange={(event) => setState((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))} />
                  <div className={cn('grid gap-2', supportsTemperature ? 'grid-cols-2' : 'grid-cols-1')}>
                    <div className="space-y-2"><Label>Language</Label><Select value={state.language} onChange={(event) => setState((prev) => ({ ...prev, language: event.target.value }))}><SelectItem value="">Auto detect</SelectItem><SelectItem value="en">English</SelectItem><SelectItem value="zh-CN">Chinese</SelectItem></Select></div>
                    {supportsTemperature && <div className="space-y-2"><Label>Temperature</Label><Input type="number" min="0" max="1" step="0.1" value={state.temperature} onChange={(event) => setState((prev) => ({ ...prev, temperature: event.target.value }))} /></div>}
                  </div>
                  {supportsWordTimestamps ? (
                    <div className="flex items-center justify-between rounded-md bg-background px-3 py-2"><span className="text-sm">Word timestamps</span><Switch checked={state.enableTimestamps} onCheckedChange={(value) => setState((prev) => ({ ...prev, enableTimestamps: value }))} /></div>
                  ) : (
                    <div className="rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">Tencent SentenceRecognition does not return word timestamps.</div>
                  )}
                </div>
              )}

              {item.type === 'tts' && (
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Text</Label><Textarea value={state.text} onChange={(event) => setState((prev) => ({ ...prev, text: event.target.value }))} className="min-h-28" /></div>
                  <div className="space-y-2"><Label>Voice ID</Label><Input value={state.voiceId} onChange={(event) => setState((prev) => ({ ...prev, voiceId: event.target.value }))} placeholder={item.provider === 'cartesia' ? 'Required by Cartesia' : 'Leave empty to use default voice'} /></div>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                    {getTtsFields(item).map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        {field.type === 'select' && field.options ? (
                          <Select value={state.params[field.key] ?? field.value} onChange={(event) => setState((prev) => ({ ...prev, params: { ...prev.params, [field.key]: event.target.value } }))}>{field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</Select>
                        ) : field.type === 'boolean' ? (
                          <div className="flex h-9 items-center justify-between rounded-md bg-background px-3"><span className="text-xs text-muted-foreground">{(state.params[field.key] ?? field.value) === 'true' ? 'On' : 'Off'}</span><Switch checked={(state.params[field.key] ?? field.value) === 'true'} onCheckedChange={(value) => setState((prev) => ({ ...prev, params: { ...prev.params, [field.key]: String(value) } }))} /></div>
                        ) : (
                          <Input type="number" min={field.min} max={field.max} step={field.step} value={state.params[field.key] ?? field.value} onChange={(event) => setState((prev) => ({ ...prev, params: { ...prev.params, [field.key]: event.target.value } }))} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.type === 'llm' && <div className="space-y-2"><Label>Prompt</Label><Textarea value={state.prompt} onChange={(event) => setState((prev) => ({ ...prev, prompt: event.target.value }))} className="min-h-40" /></div>}
            </div>

            <Button className="w-full" onClick={runTest} disabled={running}>{running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Wand2 className="mr-2 size-4" />}{running ? 'Testing...' : 'Run test'}</Button>
            {error && <div className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div>}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border bg-background p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium"><FileAudio className="size-4 text-muted-foreground" />Result</div>
                <div className="flex items-center gap-2">
                  {elapsedMs !== null && <Badge variant="outline" className={cn('gap-1 font-mono', getLatencyTone(elapsedMs))}><Clock3 className="size-3" />{formatLatency(elapsedMs)}</Badge>}
                  {(sttResult || ttsResult || llmResult) && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" />Returned</Badge>}
                </div>
              </div>

              {elapsedMs !== null && (
                <div className="mb-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md bg-muted/40 px-3 py-2">
                  <div className="flex size-8 items-center justify-center rounded bg-background"><Clock3 className={cn('size-4', getLatencyTone(elapsedMs))} /></div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Latency</span><span className={cn('font-mono text-sm font-semibold', getLatencyTone(elapsedMs))}>{formatLatency(elapsedMs)}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background"><div className={cn('h-full rounded-full transition-all', elapsedMs < 1500 ? 'bg-emerald-500' : elapsedMs < 6000 ? 'bg-amber-500' : 'bg-destructive')} style={{ width: `${Math.min(100, Math.max(8, (elapsedMs / 10_000) * 100))}%` }} /></div>
                    <p className={cn('mt-1 text-[11px]', getLatencyTone(elapsedMs))}>{getLatencyLabel(elapsedMs)}</p>
                  </div>
                </div>
              )}

              {audioUrl && <audio className="mb-3 w-full" controls src={audioUrl} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)} />}
              {(item.type === 'tts' || (item.type === 'stt' && supportsWordTimestamps)) && <WordTimeline words={words} currentTime={currentTime} />}
              {item.type === 'stt' && !supportsWordTimestamps && <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">This provider does not return word timestamps.</div>}
              {sttResult && <div className="mt-3 rounded-md bg-muted/40 p-3"><p className="mb-1 text-xs text-muted-foreground">Transcript</p><p className="whitespace-pre-wrap text-sm">{sttResult.text || 'No text recognized'}</p></div>}
              {ttsResult && <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-md bg-muted/40 p-2"><p className="text-muted-foreground">Audio MIME</p><p className="font-mono">{ttsResult.mimeType}</p></div><div className="rounded-md bg-muted/40 p-2"><p className="text-muted-foreground">Timestamps</p><p>{ttsResult.wordTimestamps?.length ?? 0}</p></div></div>}
              {llmResult && <div className="space-y-3"><div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline" className="gap-1"><Clock3 className="size-3" />{formatLatency(elapsedMs ?? llmResult.elapsedMs)}</Badge><Badge variant="outline">{llmResult.provider}</Badge><Badge variant="outline">{llmResult.model}</Badge></div><div className="rounded-md bg-muted/40 p-3"><p className="mb-1 text-xs text-muted-foreground">Reply</p><p className="whitespace-pre-wrap text-sm leading-relaxed">{llmResult.text}</p></div></div>}
              {!sttResult && !ttsResult && !llmResult && !running && <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Run a test to see audio, timestamps, latency, or model output.</div>}
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
  const [deleteItem, setDeleteItem] = useState<AiProviderItem | null>(null);
  const [addLlmOpen, setAddLlmOpen] = useState(false);
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
    return <div className="space-y-3"><Skeleton className="h-8 w-56" /><Skeleton className="h-80 w-full" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div><h1 className="text-xl font-semibold tracking-normal">AI Models</h1><p className="mt-0.5 text-xs text-muted-foreground">Configure STT / TTS / LLM providers and run provider-specific tests.</p></div>
        <Button variant="outline" size="sm" onClick={fetchData} className="h-8 shrink-0"><RefreshCw className="mr-1.5 size-3.5" />Refresh</Button>
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
          <span className="mr-1 text-[11px] text-muted-foreground">Current</span>
          {currentLine.map(({ tab, item }) => (
            <Badge key={tab.key} variant="secondary" className="h-6 gap-1 rounded px-1.5 text-[10px]"><tab.icon className={cn('size-3', tab.accent)} />{tab.short}: {item ? item.label : 'None'}</Badge>
          ))}
        </div>

        {activeTab === 'llm' && <div className="mt-2 flex justify-end"><Button size="sm" className="h-8" onClick={() => setAddLlmOpen(true)}><Plus className="mr-1.5 size-3.5" />Add model</Button></div>}

        {TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-3">
            {(grouped[tab.key] ?? []).length ? (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
                {(grouped[tab.key] ?? []).map((item) => (
                  <ProviderCard key={item.id} item={item} activating={activatingId === item.id} onActivate={handleActivate} onConfigure={setConfigItem} onTest={setTestItem} onDelete={setDeleteItem} />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">No {tab.label} providers</div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ConfigDialog open={!!configItem} onOpenChange={(open) => { if (!open) setConfigItem(null); }} item={configItem} onSaved={fetchData} />
      <TestDialog open={!!testItem} onOpenChange={(open) => { if (!open) setTestItem(null); }} item={testItem} />
      <AddLlmDialog open={addLlmOpen} onOpenChange={setAddLlmOpen} onCreated={fetchData} />
      <DeleteProviderDialog open={!!deleteItem} onOpenChange={(open) => { if (!open) setDeleteItem(null); }} item={deleteItem} onDeleted={fetchData} />
    </div>
  );
}
