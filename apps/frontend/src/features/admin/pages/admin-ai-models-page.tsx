import React, { useEffect, useState, useCallback } from 'react';
import {
  Brain, Mic, Volume2, Cpu, Loader2, CheckCircle2, AlertCircle,
  Check, ExternalLink, Settings2, X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import {
  listAiProviders,
  updateAiProvider,
  activateAiProvider,
  type AiProviderItem,
} from '@/features/admin/api-ai-models';

// ─── Tab metadata ───────────────────────────────────────────

const TABS = [
  { key: 'stt', label: '语音识别', icon: Mic, color: 'text-sky-500' },
  { key: 'tts', label: '语音合成', icon: Volume2, color: 'text-violet-500' },
  { key: 'llm', label: '大语言模型', icon: Brain, color: 'text-amber-500' },
] as const;

const TYPE_LABELS: Record<string, string> = { stt: 'STT', tts: 'TTS', llm: 'LLM' };

// ─── Provider Card ──────────────────────────────────────────

function ProviderCard({
  item,
  onConfigure,
}: {
  item: AiProviderItem;
  onConfigure: (item: AiProviderItem) => void;
}) {
  const tabMeta = TABS.find((t) => t.key === item.type);
  const Icon = tabMeta?.icon ?? Cpu;

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-4 transition-all',
        item.isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card',
      )}
    >
      {item.isActive && (
        <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </div>
      )}
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn('size-4', tabMeta?.color)} />
        <span className="text-sm font-semibold text-foreground">{item.label}</span>
        <Badge variant="secondary" className="text-[10px]">{item.provider}</Badge>
      </div>
      {item.model && (
        <p className="text-xs text-muted-foreground">模型: {item.model}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {item.isActive ? (
          <Badge className="text-[10px] bg-primary/10 text-primary">当前使用</Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => activateAiProvider(item.id).then(() => window.location.reload())}
          >
            启用
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 w-7 p-0"
          onClick={() => onConfigure(item)}
        >
          <Settings2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Config Dialog ──────────────────────────────────────────

function ConfigDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: AiProviderItem | null;
}) {
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [temperature, setTemperature] = useState('0.2');
  const [enableTimestamps, setEnableTimestamps] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setModel(item.model ?? '');
      setApiKey(item.apiKey ?? '');
      setBaseUrl(item.baseUrl ?? '');
      const cfg = (item as any).config ?? {};
      setTemperature(String(cfg.temperature ?? 0.2));
      setEnableTimestamps(cfg.enableTimestamps !== false);
    }
  }, [item]);

  if (!item) return null;

  const isStt = item.type === 'stt';

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: any = {};
      if (isStt) {
        const t = Number(temperature);
        if (!isNaN(t)) config.temperature = t;
        config.enableTimestamps = enableTimestamps;
      }
      await updateAiProvider(item.id, {
        model,
        apiKey,
        baseUrl,
        ...(Object.keys(config).length ? { config: JSON.stringify(config) } : {}),
      });
      setToast('配置已保存');
      setTimeout(() => {
        setToast(null);
        onOpenChange(false);
        window.location.reload();
      }, 800);
    } catch {
      setToast('保存失败');
      setTimeout(() => setToast(null), 2000);
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = TYPE_LABELS[item.type] ?? item.type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          {(() => { const Icon = TABS.find((t) => t.key === item.type)?.icon ?? Cpu; return <Icon className="size-4" />; })()}
          配置 {item.label}
        </DialogTitle>
        <DialogDescription>
          {typeLabel} 供应商 · {item.provider}
        </DialogDescription>

        {toast && (
          <div className={cn(
            'rounded-lg px-3 py-2 text-xs',
            toast.includes('失败') ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600',
          )}>
            {toast}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>模型名称</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="如 deepseek-chat, gpt-4o, speech-2.8-hd"
            />
          </div>
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="font-mono text-sm"
              placeholder="https://api.example.com/v1"
            />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
              placeholder="sk-..."
            />
            <p className="text-[11px] text-muted-foreground">留空则回退到环境变量中的对应密钥</p>
          </div>

          {isStt && (
            <>
              <div className="space-y-2">
                <Label>Temperature ({temperature})</Label>
                <Input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">越高越随机，默认 0.2。仅 Whisper 生效</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <Label className="text-sm">词时间戳</Label>
                  <p className="text-[11px] text-muted-foreground">开启返回词级别时间，关闭可提速</p>
                </div>
                <Switch
                  checked={enableTimestamps}
                  onCheckedChange={setEnableTimestamps}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export function AdminAiModelsPage() {
  const [grouped, setGrouped] = useState<Record<string, AiProviderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stt');
  const [configItem, setConfigItem] = useState<AiProviderItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAiProviders();
      setGrouped(data);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeByType = (type: string) =>
    grouped[type]?.find((p) => p.isActive);

  const activeStt = activeByType('stt');
  const activeTts = activeByType('tts');
  const activeLlm = activeByType('llm');

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">大模型管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理 STT / TTS / LLM 供应商，点击 ⚙ 配置密钥和模型</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchData(); }}>
          刷新
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          {TABS.map((tab) => {
            const active = activeByType(tab.key);
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="flex-1 gap-2">
                <tab.icon className="size-4" />
                {tab.label}
                {active && <Badge className="ml-1 h-4 px-1 text-[9px]">{active.label}</Badge>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(grouped[tab.key] ?? []).map((item) => (
                <ProviderCard
                  key={item.id}
                  item={item}
                  onConfigure={setConfigItem}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* ── 当前组合 ── */}
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-4 py-4">
          <Cpu className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 text-sm">
            <span className="text-muted-foreground">当前激活：</span>
            {activeStt && <Badge variant="secondary" className="ml-1.5 text-[11px]">STT: {activeStt.label}</Badge>}
            {activeTts && <Badge variant="secondary" className="ml-1.5 text-[11px]">TTS: {activeTts.label} {activeTts.model && `/ ${activeTts.model}`}</Badge>}
            {activeLlm && <Badge variant="secondary" className="ml-1.5 text-[11px]">LLM: {activeLlm.label} {activeLlm.model && `/ ${activeLlm.model}`}</Badge>}
          </div>
        </CardContent>
      </Card>

      <ConfigDialog
        open={!!configItem}
        onOpenChange={(open) => { if (!open) setConfigItem(null); }}
        item={configItem}
      />
    </div>
  );
}
