import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardCheck, Database, Headphones, ListChecks, LockKeyhole, Loader2, PenLine, RefreshCw, Save, Search, ShieldCheck, SpellCheck2, Trash2, Volume2, WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import {
  clearDictionaryPronunciation, getPronunciationAudit, refreshDictionaryPronunciation,
  generateDictionaryPronunciationAudio,
  lockTrustedAiWiktionaryPronunciations,
  normalizeNoncanonicalPronunciations,
  normalizeDictionaryPronunciation, saveManualDictionaryPronunciation,
  enqueuePronunciationRefreshCurrentPage,
  enqueuePronunciationAudioCurrentPage,
  setDictionaryPronunciationLocked,
  type PronunciationAuditAccent, type PronunciationAuditFilter, type PronunciationAuditItem,
  type PronunciationAuditResult, type PronunciationProvider, type PronunciationScope,
} from '@/features/admin/api-dictionary';

const PROVIDER_LABELS: Record<PronunciationProvider, string> = {
  auto: '自动择优（多源 + AI）',
  wiktionary: 'Wiktionary 官方 API',
  freedictionaryapi: 'FreeDictionaryAPI',
  'dictionaryapi.dev': 'dictionaryapi.dev',
  datamuse: 'Datamuse（US·需复核）',
  ai_verify: 'AI 生成 / 评估',
};

const SCOPE_LABELS: Record<PronunciationScope, string> = {
  all: 'UK + US',
  uk: '仅 UK',
  us: '仅 US',
};

function summarizePage(items: PronunciationAuditItem[]): PronunciationAuditResult['pageStats'] {
  return {
    passed: items.filter((item) => item.status === 'passed').length,
    attention: items.filter((item) => item.status === 'attention').length,
    missing: items.filter((item) => item.status === 'missing').length,
    withAudio: items.filter((item) => item.uk.hasAudio || item.us.hasAudio).length,
  };
}

function AccentIpa({
  label,
  accent,
  disabled,
  normalizing,
  onManualEdit,
  onNormalize,
}: {
  label: 'UK' | 'US';
  accent: PronunciationAuditAccent;
  disabled: boolean;
  normalizing: boolean;
  onManualEdit: () => void;
  onNormalize: () => void;
}) {
  const invalid = !accent.ipa || !accent.isIpa || !!accent.invalidVariantIpa;
  const canNormalize = !!accent.ipa
    && !!accent.normalizedIpa
    && accent.ipa !== accent.normalizedIpa;
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] items-start gap-2">
      <Badge variant={invalid ? 'destructive' : 'outline'}>{label}</Badge>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className={cn('min-w-0 font-ipa text-sm leading-6', invalid && 'font-semibold text-destructive')}>
            {accent.ipa ?? '缺失'}
          </p>
          {canNormalize && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={onNormalize}
                  disabled={disabled}
                  aria-label={`应用 ${label} IPA 规范写法 ${accent.normalizedIpa}`}
                >
                  {normalizing ? <Loader2 className="animate-spin" /> : <SpellCheck2 />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                应用规范写法：<span className="font-ipa">{accent.normalizedIpa}</span>
              </TooltipContent>
            </Tooltip>
          )}
          {invalid && (
            <Button type="button" variant="outline" size="sm" onClick={onManualEdit} disabled={disabled}>
              <PenLine data-icon="inline-start" />手动填写
            </Button>
          )}
        </div>
        {accent.invalidVariantIpa && (
          <p className="mt-1 flex items-start gap-1.5 font-ipa text-xs font-semibold leading-5 text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-all">异常变体 {accent.invalidVariantIpa}</span>
          </p>
        )}
        {accent.issues.length > 0 && (
          <p className={cn('mt-0.5 text-[11px] leading-4', invalid ? 'text-destructive' : 'text-muted-foreground')}>
            {accent.issues.join('；')}
          </p>
        )}
      </div>
    </div>
  );
}

function SourcePair({ item }: { item: PronunciationAuditItem }) {
  return (
    <div className="flex flex-col gap-2 text-xs">
      {(['uk', 'us'] as const).map((type) => {
        const accent = item[type];
        return (
          <div key={type} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
            <span className="font-medium uppercase text-muted-foreground">{type}</span>
            <div className="min-w-0">
              <p className="truncate" title={accent.aiReason ?? accent.source}>{accent.source}</p>
              {accent.aiConfidence !== null && (
                <p className="text-[11px] text-muted-foreground">
                  AI 置信度 {Math.round(accent.aiConfidence * 100)}%
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AudioPair({
  item,
  generating,
  onGenerate,
}: {
  item: PronunciationAuditItem;
  generating?: 'uk' | 'us';
  onGenerate: (type: 'uk' | 'us', gender: 'female' | 'male') => void;
}) {
  const [genders, setGenders] = useState<Record<'uk' | 'us', 'female' | 'male'>>({
    uk: 'female',
    us: 'female',
  });
  const play = (url: string) => {
    const audio = new Audio(url);
    void audio.play().catch(() => toast.error('音频播放失败'));
  };
  return (
    <div className="flex flex-col gap-1.5">
      {(['uk', 'us'] as const).map((type) => {
        const accent = item[type];
        return (
          <div key={type} className="flex flex-wrap items-center gap-2">
            <span className="w-6 text-[11px] font-medium uppercase text-muted-foreground">{type}</span>
            {accent.audioUrl ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => play(accent.audioUrl!)}
                    aria-label={`播放 ${item.word} ${type.toUpperCase()} 音频`}
                  >
                    <Volume2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>播放 {type.toUpperCase()} 音频</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Badge variant="secondary" className="h-6 px-1.5 text-[10px]">无</Badge>
                <Select
                  value={genders[type]}
                  onChange={(event) => setGenders((current) => ({
                    ...current,
                    [type]: event.target.value as 'female' | 'male',
                  }))}
                  aria-label={`${item.word} ${type.toUpperCase()} 生成音色`}
                  className="h-8 min-w-[54px] px-1.5 text-xs"
                  disabled={!!generating}
                >
                  <option value="female">女</option>
                  <option value="male">男</option>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline-primary"
                      size="icon-sm"
                      onClick={() => onGenerate(type, genders[type])}
                      disabled={!!generating}
                      aria-label={`生成 ${item.word} ${type.toUpperCase()} 音频`}
                    >
                      {generating === type
                        ? <Loader2 className="animate-spin" />
                        : <WandSparkles />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>生成 {type.toUpperCase()} {genders[type] === 'female' ? '女声' : '男声'}音频</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DictionaryPronunciationAuditDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<PronunciationAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [jumpDraft, setJumpDraft] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PronunciationAuditFilter>('all');
  const [providers, setProviders] = useState<Record<string, PronunciationProvider>>({});
  const [scopes, setScopes] = useState<Record<string, PronunciationScope>>({});
  const [processingActions, setProcessingActions] = useState<Record<string, 'update' | 'clear' | 'manual' | 'normalize-uk' | 'normalize-us' | 'lock' | 'audio-uk' | 'audio-us'>>({});
  const [manualEditor, setManualEditor] = useState<{ word: string; type: 'uk' | 'us' } | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [audioBatchSubmitting, setAudioBatchSubmitting] = useState(false);
  const [autoLocking, setAutoLocking] = useState(false);
  const [normalizingAll, setNormalizingAll] = useState(false);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      setData(await getPronunciationAudit({ page, search: search || undefined, filter }));
    } catch (error: any) {
      toast.error(error?.message || '音标审查数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [filter, open, page, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!open) setManualEditor(null); }, [open]);

  const visibleRange = useMemo(() => {
    if (!data?.total) return '0';
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.total, data.page * data.pageSize);
    return `${start}–${end}`;
  }, [data]);

  const updateWord = async (word: string) => {
    if (processingActions[word]) return;
    const provider = providers[word] ?? 'auto';
    const scope = scopes[word] ?? 'all';
    setProcessingActions((current) => ({ ...current, [word]: 'update' }));
    try {
      const updatedItem = await refreshDictionaryPronunciation(word, provider, scope);
      setData((current) => {
        if (!current) return current;
        const items = current.items.map((item) => item.word === word ? updatedItem : item);
        return { ...current, items, pageStats: summarizePage(items) };
      });
      toast.success(`${word} 的${SCOPE_LABELS[scope]} IPA 已从 ${PROVIDER_LABELS[provider]} 更新`);
    } catch (error: any) {
      toast.error(error?.message || `${word} 更新失败`);
    } finally {
      setProcessingActions((current) => {
        const next = { ...current };
        delete next[word];
        return next;
      });
    }
  };

  const setWordLocked = async (word: string, locked: boolean) => {
    if (processingActions[word]) return;
    setProcessingActions((current) => ({ ...current, [word]: 'lock' }));
    try {
      const updatedItem = await setDictionaryPronunciationLocked(word, locked);
      setData((current) => {
        if (!current) return current;
        const items = current.items.map((item) => item.word === word ? updatedItem : item);
        return { ...current, items, pageStats: summarizePage(items) };
      });
      toast.success(locked ? `${word} 已确认无误并锁定，批量检查将跳过它` : `${word} 已解除锁定，会参与后续批量检查`);
    } catch (error: any) {
      toast.error(error?.message || `${word} 锁定状态更新失败`);
    } finally {
      setProcessingActions((current) => {
        const next = { ...current };
        delete next[word];
        return next;
      });
    }
  };

  const generateAudio = async (
    word: string,
    type: 'uk' | 'us',
    gender: 'female' | 'male',
  ) => {
    if (processingActions[word]) return;
    setProcessingActions((current) => ({ ...current, [word]: `audio-${type}` }));
    try {
      const updatedItem = await generateDictionaryPronunciationAudio(word, type, gender);
      setData((current) => {
        if (!current) return current;
        const items = current.items.map((item) => item.word === word ? updatedItem : item);
        return { ...current, items, pageStats: summarizePage(items) };
      });
      toast.success(`${word} 的 ${type.toUpperCase()} ${gender === 'female' ? '女声' : '男声'}音频已生成`);
    } catch (error: any) {
      toast.error(error?.message || `${word} 的 ${type.toUpperCase()} 音频生成失败`);
    } finally {
      setProcessingActions((current) => {
        const next = { ...current };
        delete next[word];
        return next;
      });
    }
  };

  const clearWord = async (word: string) => {
    if (processingActions[word]) return;
    const scope = scopes[word] ?? 'all';
    setProcessingActions((current) => ({ ...current, [word]: 'clear' }));
    try {
      const updatedItem = await clearDictionaryPronunciation(word, scope);
      setData((current) => {
        if (!current) return current;
        const items = current.items.map((item) => item.word === word ? updatedItem : item);
        return { ...current, items, pageStats: summarizePage(items) };
      });
      toast.success(`${word} 的${SCOPE_LABELS[scope]}音标和发音已清空`);
    } catch (error: any) {
      toast.error(error?.message || `${word} 清空失败`);
    } finally {
      setProcessingActions((current) => {
        const next = { ...current };
        delete next[word];
        return next;
      });
    }
  };

  const normalizeAccent = async (word: string, type: 'uk' | 'us') => {
    if (processingActions[word]) return;
    setProcessingActions((current) => ({ ...current, [word]: `normalize-${type}` }));
    try {
      const updatedItem = await normalizeDictionaryPronunciation(word, type);
      setData((current) => {
        if (!current) return current;
        const items = current.items.map((item) => item.word === word ? updatedItem : item);
        return { ...current, items, pageStats: summarizePage(items) };
      });
      toast.success(`${word} 的 ${type.toUpperCase()} IPA 已规范化`);
    } catch (error: any) {
      toast.error(error?.message || `${word} 的 ${type.toUpperCase()} IPA 规范化失败`);
    } finally {
      setProcessingActions((current) => {
        const next = { ...current };
        delete next[word];
        return next;
      });
    }
  };

  const openManualEditor = (item: PronunciationAuditItem, type: 'uk' | 'us') => {
    const current = item[type].ipa ?? '';
    setManualValue(current.replace(/^\//, '').replace(/\/$/, ''));
    setManualEditor({ word: item.word, type });
  };

  const saveManual = async () => {
    if (!manualEditor || processingActions[manualEditor.word] || !manualValue.trim()) return;
    const { word, type } = manualEditor;
    setProcessingActions((current) => ({ ...current, [word]: 'manual' }));
    try {
      const updatedItem = await saveManualDictionaryPronunciation(word, type, manualValue);
      setData((current) => {
        if (!current) return current;
        const items = current.items.map((item) => item.word === word ? updatedItem : item);
        return { ...current, items, pageStats: summarizePage(items) };
      });
      setManualEditor(null);
      setManualValue('');
      toast.success(`${word} 的 ${type.toUpperCase()} IPA 已手动保存`);
    } catch (error: any) {
      toast.error(error?.message || `${word} 手动保存失败`);
    } finally {
      setProcessingActions((current) => {
        const next = { ...current };
        delete next[word];
        return next;
      });
    }
  };

  const runSearch = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const refreshCurrentPageInTaskCenter = async () => {
    if (!data || batchSubmitting) return;
    setBatchSubmitting(true);
    try {
      await enqueuePronunciationRefreshCurrentPage({
        page: data.page,
        search: search || undefined,
        filter,
      });
      toast.success(`已创建本页 ${data.items.length} 个单词的音标检查任务，可在任务中心查看进度`);
    } catch (error: any) {
      toast.error(error?.message || '创建音标检查任务失败');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const generateCurrentPageAudioInTaskCenter = async () => {
    if (!data || audioBatchSubmitting) return;
    setAudioBatchSubmitting(true);
    try {
      const task = await enqueuePronunciationAudioCurrentPage({
        page: data.page,
        search: search || undefined,
        filter,
      });
      toast.success(`已创建本页 ${task.totalItems} 条缺失音频的补全任务，可在任务中心查看进度`);
    } catch (error: any) {
      toast.error(error?.message || '创建本页音频补全任务失败');
    } finally {
      setAudioBatchSubmitting(false);
    }
  };

  const autoLockTrustedPronunciations = async () => {
    if (autoLocking) return;
    setAutoLocking(true);
    try {
      const result = await lockTrustedAiWiktionaryPronunciations();
      if (result.locked > 0) {
        toast.success(`已自动锁定 ${result.locked} 个高可信词条；${result.alreadyLocked} 个此前已锁定`);
      } else {
        toast.success(`没有新的词条需要锁定；已有 ${result.alreadyLocked} 个符合条件`);
      }
      await load();
    } catch (error: any) {
      toast.error(error?.message || '自动锁定高可信音标失败');
    } finally {
      setAutoLocking(false);
    }
  };

  const normalizeAllPronunciations = async () => {
    if (normalizingAll) return;
    setNormalizingAll(true);
    try {
      const result = await normalizeNoncanonicalPronunciations();
      toast.success(result.wordsUpdated > 0
        ? `已统一 ${result.wordsUpdated} 个词条：改写 ${result.pronunciationsUpdated} 处，清理 ${result.pronunciationsRemoved} 条异常备用变体`
        : '所有音标写法已经统一');
      await load();
    } catch (error: any) {
      toast.error(error?.message || '统一音标写法失败');
    } finally {
      setNormalizingAll(false);
    }
  };

  const stats = data?.pageStats ?? { passed: 0, attention: 0, missing: 0, withAudio: 0 };
  const manualBody = manualValue.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const manualSaving = !!manualEditor && processingActions[manualEditor.word] === 'manual';

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] w-[calc(100vw-32px)] max-w-[1500px] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>音标质量审查</DialogTitle>
          <DialogDescription>每次审查一百个单词的英式与美式 IPA、来源及音频覆盖。</DialogDescription>
        </DialogHeader>

        <div className="grid h-full min-h-0 grid-cols-[270px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r bg-muted/20">
            <div className="border-b px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardCheck className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">音标质量审查</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">统一 UK / US 国际音标</p>
                </div>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-5 p-5">
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">当前审查批次</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight">{visibleRange}</p>
                  <p className="mt-1 text-xs text-muted-foreground">固定每页 100 个 · 共 {data?.total ?? 0} 个词</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '通过', value: stats.passed },
                    { label: '需复核', value: stats.attention },
                    { label: '有缺失', value: stats.missing },
                    { label: '有音频', value: stats.withAudio },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border bg-background px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                      <p className="mt-0.5 text-xl font-semibold tabular-nums">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium text-muted-foreground">审查标准</p>
                  <div className="flex items-start gap-2 text-xs leading-5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p>只接受以 <code>/.../</code> 表示的宽式 IPA，并且只分 UK 与 US。</p>
                  </div>
                  <div className="flex items-start gap-2 text-xs leading-5">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p>精细标音 <code>[...]</code>、格式异常或缺失会直接标红。</p>
                  </div>
                  <div className="flex items-start gap-2 text-xs leading-5">
                    <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p>旧版自动推导的数据保留展示，但必须重新选择可信来源更新。</p>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <Button variant="outline" className="w-full" onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
                重新检查本页
              </Button>
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col">
            <div className="border-b py-4 pl-6 pr-14">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">音标审查报告</h3>
                  {stats.attention > 0 && <Badge variant="secondary">{stats.attention} 个需复核</Badge>}
                  {stats.missing > 0 && <Badge variant="destructive">{stats.missing} 个有缺失</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">更新与清空均按所选 UK / US 范围执行，不改释义、例句和词形。</p>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">查看</span>
                    <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={filter}
                    onValueChange={(value) => {
                      if (!value) return;
                      setPage(1);
                      setFilter(value as PronunciationAuditFilter);
                    }}
                    aria-label="筛选音标审查结果"
                  >
                    <ToggleGroupItem value="all" aria-label="显示全部音标">全部</ToggleGroupItem>
                    <ToggleGroupItem value="missing" aria-label="只显示缺失音标">
                      只看缺失{filter === 'missing' && data ? ` ${data.total}` : ''}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="noncanonical" aria-label="只显示写法不统一的音标">
                      写法不统一{filter === 'noncanonical' && data ? ` ${data.total}` : ''}
                    </ToggleGroupItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem
                          value="invalid"
                          aria-label="显示精细标音、格式异常或缺失音标"
                          className="text-destructive hover:text-destructive data-[state=on]:border-destructive/40 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
                        >
                          <AlertCircle />
                          异常{filter === 'invalid' && data ? ` ${data.total}` : ''}
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>显示所有精细标音 […]、格式异常或缺失项</TooltipContent>
                    </Tooltip>
                    </ToggleGroup>
                  </div>

                  <form
                    className="flex min-w-0 gap-2 xl:w-80"
                    onSubmit={(event) => { event.preventDefault(); runSearch(); }}
                  >
                    <Input
                      value={searchDraft}
                      onChange={(event) => setSearchDraft(event.target.value)}
                      placeholder="按原单词定位..."
                      aria-label="搜索原单词"
                    />
                    <Button type="submit" variant="outline">
                      <Search data-icon="inline-start" />搜索
                    </Button>
                  </form>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <span className="mr-1 text-xs font-medium text-muted-foreground">批量操作</span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void refreshCurrentPageInTaskCenter()}
                    disabled={loading || !data?.items.length || batchSubmitting}
                  >
                    {batchSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <ListChecks data-icon="inline-start" />}
                    检查本页
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline-primary"
                        onClick={() => void generateCurrentPageAudioInTaskCenter()}
                        disabled={loading || !data?.items.length || audioBatchSubmitting}
                      >
                        {audioBatchSubmitting
                          ? <Loader2 data-icon="inline-start" className="animate-spin" />
                          : <Headphones data-icon="inline-start" />}
                        补本页音频
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>仅生成当前页缺少的 UK / US 音频，男女声稳定自动分配</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void normalizeAllPronunciations()}
                        disabled={loading || normalizingAll}
                      >
                        {normalizingAll ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <SpellCheck2 data-icon="inline-start" />}
                        统一全部写法
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>统一全库写法；已有正常音标时，同时清理 […] 等无法作为整词音标的异常备用变体</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void autoLockTrustedPronunciations()}
                        disabled={loading || autoLocking}
                      >
                        {autoLocking ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <ShieldCheck data-icon="inline-start" />}
                        锁定 ≥90%
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>扫描数据库全部词条，锁定 UK、US 均来自 AI selected / Wiktionary Action API 且置信度不低于 90% 的词条</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {loading && !data ? (
                <div className="flex flex-col gap-2 p-6">
                  {Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-[13%] pl-5">原单词</TableHead>
                        <TableHead className="w-[31%]">英式 / 美式 IPA 写法</TableHead>
                        <TableHead className="w-[19%]">对应来源</TableHead>
                        <TableHead className="w-[17%]">发音</TableHead>
                        <TableHead className="w-[20%] pr-5 text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.items.map((item) => {
                        const selectedProvider = providers[item.word] ?? 'auto';
                        const selectedScope = scopes[item.word] ?? 'all';
                        const processingAction = processingActions[item.word];
                        const isProcessing = !!processingAction;
                        return (
                          <TableRow
                            key={item.word}
                            className={cn((
                              !item.uk.isIpa
                              || !item.us.isIpa
                              || !!item.uk.invalidVariantIpa
                              || !!item.us.invalidVariantIpa
                            ) && 'bg-destructive/5')}
                          >
                            <TableCell className="py-3 pl-5 align-top">
                              <div className="flex items-center gap-2">
                                <span className="font-english font-semibold">{item.word}</span>
                                {item.locked && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <LockKeyhole className="size-4 shrink-0 text-emerald-600" aria-label="音标已确认并锁定" />
                                    </TooltipTrigger>
                                    <TooltipContent>已确认并锁定</TooltipContent>
                                  </Tooltip>
                                )}
                                {item.status === 'passed'
                                  ? <CheckCircle2 className="size-4 text-primary" />
                                  : <AlertCircle className="size-4 text-destructive" />}
                              </div>
                            </TableCell>
                            <TableCell className="py-3 align-top">
                              <div className="flex flex-col gap-3">
                                <AccentIpa
                                  label="UK"
                                  accent={item.uk}
                                  disabled={isProcessing}
                                  normalizing={processingAction === 'normalize-uk'}
                                  onManualEdit={() => openManualEditor(item, 'uk')}
                                  onNormalize={() => void normalizeAccent(item.word, 'uk')}
                                />
                                <AccentIpa
                                  label="US"
                                  accent={item.us}
                                  disabled={isProcessing}
                                  normalizing={processingAction === 'normalize-us'}
                                  onManualEdit={() => openManualEditor(item, 'us')}
                                  onNormalize={() => void normalizeAccent(item.word, 'us')}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="py-3 align-top"><SourcePair item={item} /></TableCell>
                            <TableCell className="py-3 align-top">
                              <AudioPair
                                item={item}
                                generating={processingAction === 'audio-uk'
                                  ? 'uk'
                                  : processingAction === 'audio-us' ? 'us' : undefined}
                                onGenerate={(type, gender) => void generateAudio(item.word, type, gender)}
                              />
                            </TableCell>
                            <TableCell className="py-3 pr-5 align-top">
                              <div className="ml-auto flex max-w-[230px] flex-col items-stretch gap-1.5">
                                <Select
                                  value={selectedProvider}
                                  onChange={(event) => setProviders((current) => ({
                                    ...current,
                                    [item.word]: event.target.value as PronunciationProvider,
                                  }))}
                                  aria-label={`${item.word} 的更新来源`}
                                  className="h-8 min-w-[160px] text-xs"
                                  disabled={isProcessing}
                                >
                                  {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </Select>
                                <div className="flex justify-end gap-1.5">
                                  <Select
                                    value={selectedScope}
                                    onChange={(event) => setScopes((current) => ({
                                      ...current,
                                      [item.word]: event.target.value as PronunciationScope,
                                    }))}
                                    aria-label={`${item.word} 的操作范围`}
                                    className="h-8 min-w-[78px] flex-1 text-xs"
                                    disabled={isProcessing}
                                  >
                                    {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                                      <option key={value} value={value}>{label}</option>
                                    ))}
                                  </Select>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon-sm"
                                        onClick={() => void clearWord(item.word)}
                                        disabled={isProcessing}
                                        aria-label={`清空 ${item.word} 的音标和发音`}
                                      >
                                        {processingAction === 'clear' ? <Loader2 className="animate-spin" /> : <Trash2 />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>清空音标和发音</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon-sm"
                                        onClick={() => void updateWord(item.word)}
                                        disabled={isProcessing}
                                        aria-label={`更新 ${item.word} 的音标`}
                                      >
                                        {processingAction === 'update' ? <Loader2 className="animate-spin" /> : <Database />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>更新音标</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant={item.locked ? 'outline' : 'secondary'}
                                        size="icon-sm"
                                        onClick={() => void setWordLocked(item.word, !item.locked)}
                                        disabled={isProcessing}
                                        className={cn(item.locked && 'border-emerald-600/30 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700')}
                                        aria-label={item.locked ? `解除 ${item.word} 的音标锁定` : `确认 ${item.word} 的音标无误并锁定`}
                                      >
                                        {processingAction === 'lock'
                                          ? <Loader2 className="animate-spin" />
                                          : item.locked ? <LockKeyhole /> : <ClipboardCheck />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {item.locked
                                        ? '点击解除人工确认，使其重新参与批量检查'
                                        : '人工核对音标与发音后确认；确认后不再提示算法估读'}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {data?.items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                            没有找到需要审查的单词
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>

            <div className="flex items-center justify-between border-t bg-background px-6 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Headphones className="size-4" />
                第 {data?.page ?? page} / {Math.max(1, data?.totalPages ?? 1)} 页 · 每页固定 100 个
              </div>
              <div className="flex items-center gap-3">
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const target = Number.parseInt(jumpDraft, 10);
                    const totalPages = Math.max(1, data?.totalPages ?? 1);
                    if (Number.isNaN(target)) return;
                    setPage(Math.min(totalPages, Math.max(1, target)));
                    setJumpDraft('');
                  }}
                >
                  <span className="text-xs text-muted-foreground">跳转到</span>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, data?.totalPages ?? 1)}
                    value={jumpDraft}
                    onChange={(event) => setJumpDraft(event.target.value)}
                    placeholder={`1-${Math.max(1, data?.totalPages ?? 1)}`}
                    aria-label="跳转到第几页"
                    className="h-8 w-20"
                  />
                  <span className="text-xs text-muted-foreground">页</span>
                  <Button type="submit" variant="outline" size="sm" disabled={loading}>
                    跳转
                  </Button>
                </form>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft data-icon="inline-start" />上一组
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= (data?.totalPages ?? 1) || loading}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    下一组<ChevronRight data-icon="inline-end" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
      </Dialog>

      <Dialog
        open={!!manualEditor}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !manualSaving) {
            setManualEditor(null);
            setManualValue('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              手动填写 {manualEditor?.type.toUpperCase()} 音标
            </DialogTitle>
            <DialogDescription>
              为 <span className="font-english font-medium text-foreground">{manualEditor?.word}</span> 保存人工确认的宽式 IPA。
              可以只输入音标内容，系统会自动补齐两侧斜杠。
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveManual();
            }}
          >
            <Input
              autoFocus
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="例如：əˈbɒl.ɪʃ.mənt"
              aria-label={`${manualEditor?.word ?? ''} ${manualEditor?.type.toUpperCase() ?? ''} 手动 IPA`}
              disabled={manualSaving}
              className="font-ipa"
            />

            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">保存预览：</span>{' '}
              <code className="font-ipa text-foreground">{manualBody ? `/${manualBody}/` : '/.../'}</code>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setManualEditor(null);
                  setManualValue('');
                }}
                disabled={manualSaving}
              >
                取消
              </Button>
              <Button type="submit" disabled={!manualBody || manualSaving}>
                {manualSaving
                  ? <Loader2 data-icon="inline-start" className="animate-spin" />
                  : <Save data-icon="inline-start" />}
                保存音标
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
