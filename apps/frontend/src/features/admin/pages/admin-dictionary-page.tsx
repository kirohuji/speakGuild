import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Trash2, Eye, Sparkles, Loader2, ChevronLeft, ChevronRight,
  ExternalLink, ShieldCheck, ShieldX,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import {
  listDictionary, batchEnrichDictionary, deleteDictionaryEntry,
  type DictionaryEntry, type DictionaryCluster, type DictionarySense,
} from '@/features/admin/api-dictionary';

const POS_COLORS: Record<string, string> = {
  noun: 'bg-blue-100 text-blue-700', verb: 'bg-green-100 text-green-700',
  adj: 'bg-amber-100 text-amber-700', adv: 'bg-purple-100 text-purple-700',
  pronoun: 'bg-pink-100 text-pink-700', preposition: 'bg-cyan-100 text-cyan-700',
  conjunction: 'bg-orange-100 text-orange-700', interjection: 'bg-red-100 text-red-700',
  determiner: 'bg-indigo-100 text-indigo-700', article: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-700',
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function AdminDictionaryPage() {
  const [data, setData] = useState<{ items: DictionaryEntry[]; total: number; page: number; pageSize: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Add word dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addWords, setAddWords] = useState('');
  const [adding, setAdding] = useState(false);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<DictionaryEntry | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDictionary({ search, page, pageSize });
      setData(result);
    } catch {
      toast.error('加载词典列表失败');
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const words = addWords.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) { toast.error('请输入至少一个单词'); return; }
    setAdding(true);
    try {
      const result = await batchEnrichDictionary(words);
      toast.success(`完成：${result.succeeded} 成功，${result.failed} 失败`);
      setAddOpen(false);
      setAddWords('');
      load();
    } catch {
      toast.error('富化请求失败');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDictionaryEntry(deleteTarget);
      toast.success(`已删除 "${deleteTarget}"`);
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('删除失败');
    }
  };

  const openDetail = (entry: DictionaryEntry) => {
    setDetailEntry(entry);
    setDetailOpen(true);
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">词典管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理 FreeDictionaryAPI 清洗后的词典数据，支持搜索、批量富化、查看详情
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          新增单词
        </Button>
      </div>

      {/* Search & Pagination */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索单词..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>每页</span>
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span>条</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          共 {data?.total ?? 0} 个词条
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-sm tabular-nums">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">单词</th>
                <th className="px-4 py-3 text-left font-medium">词性</th>
                <th className="px-4 py-3 text-left font-medium">释义</th>
                <th className="px-4 py-3 text-center font-medium">簇数</th>
                <th className="px-4 py-3 text-center font-medium">义项</th>
                <th className="px-4 py-3 text-center font-medium">AI审核</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((entry) => {
                const clusters = entry.senseClusters ?? [];
                const primaryCluster = clusters.find((c) => c.rank === 1);
                const primarySense = primaryCluster?.senses?.[0];
                return (
                  <tr key={entry.word} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{entry.word}</td>
                    <td className="px-4 py-3">
                      {primaryCluster && (
                        <Badge className={cn('text-xs', POS_COLORS[primaryCluster.posBucket] ?? POS_COLORS.other)}>
                          {primaryCluster.posBucket}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                      {primarySense?.translations?.zh || primarySense?.definition || '—'}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{clusters.length}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{entry.senses?.length ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      {entry.aiReviewed ? (
                        <ShieldCheck className="inline size-4 text-emerald-500" />
                      ) : (
                        <ShieldX className="inline size-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetail(entry)}>
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(entry.word)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    暂无词条，点击"新增单词"开始添加
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Word Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5" /> 新增单词
            </DialogTitle>
            <DialogDescription>
              输入单词列表（换行或逗号分隔），系统将从 FreeDictionaryAPI 拉取数据并运行清洗流水线。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="dog&#10;cat&#10;hello, world, bank"
              rows={8}
              value={addWords}
              onChange={(e) => setAddWords(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              {adding ? '富化中...' : '开始富化'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog — Dictionary-style preview */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          {detailEntry && <DictionaryPreview entry={detailEntry} />}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除 <strong>"{deleteTarget}"</strong> 的词典数据吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Dictionary Preview — Chinese-first, expandable English
// ═══════════════════════════════════════════════════════════════

const POS_LABELS: Record<string, string> = {
  noun: 'n.', verb: 'v.', adj: 'adj.', adv: 'adv.',
  pronoun: 'pron.', preposition: 'prep.', conjunction: 'conj.',
  interjection: 'interj.', determiner: 'det.', article: 'art.',
  other: '',
};

const POS_LABELS_CN: Record<string, string> = {
  noun: '名', verb: '动', adj: '形', adv: '副',
  pronoun: '代', preposition: '介', conjunction: '连',
  interjection: '叹', determiner: '限', article: '冠',
  other: '',
};

function DictionaryPreview({ entry }: { entry: DictionaryEntry }) {
  const allSenses = entry.senseClusters?.flatMap((c) => c.senses) ?? [];
  const ukPron = entry.pronunciations?.find((p) => p.type === 'uk' && p.isPreferred)
    ?? entry.pronunciations?.find((p) => p.type === 'uk');
  const usPron = entry.pronunciations?.find((p) => p.type === 'us' && p.isPreferred)
    ?? entry.pronunciations?.find((p) => p.type === 'us');

  // Compute cluster display name: prefer the zh translation of the first sense
  const clusterName = (c: DictionaryCluster) => {
    const zh = c.senses?.[0]?.translations?.zh;
    if (zh && zh.length <= 12) return zh;
    if (zh) return zh.substring(0, 10) + '…';
    return c.label.length > 40 ? c.label.substring(0, 37) + '…' : c.label;
  };

  return (
    <div className="divide-y">
      {/* ── Header ── */}
      <div className="px-5 py-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-2xl font-bold tracking-tight">{entry.word}</h2>
          <span className="text-sm text-muted-foreground font-mono">
            {[ukPron?.ipa, usPron?.ipa].filter(Boolean).join('  ')}
          </span>
          {entry.aiReviewed && (
            <span className="text-[10px] text-emerald-600 ml-auto" title="AI 已审核">
              <ShieldCheck className="size-3 inline" />
            </span>
          )}
        </div>
        {entry.sourceUrl && (
          <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground">
            <ExternalLink className="size-2.5" /> Wiktionary CC BY-SA 4.0
          </a>
        )}
      </div>

      {/* ── POS Groups ── */}
      {entry.senseClusters?.map((cluster) => {
        const senses = cluster.senses ?? [];
        const cnLabel = POS_LABELS_CN[cluster.posBucket] ?? '';
        const enLabel = POS_LABELS[cluster.posBucket] ?? cluster.posBucket;
        return (
          <div key={cluster.id} className="px-5 py-4">
            {/* POS header row */}
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                'text-xs font-bold px-1.5 py-0.5 rounded',
                POS_COLORS[cluster.posBucket] ?? POS_COLORS.other,
              )}>
                {cnLabel || enLabel}
              </span>
              <span className="text-[11px] text-muted-foreground/60">{clusterName(cluster)}</span>
              {entry.senseClusters && entry.senseClusters.length === 1 && senses.length > 1 && (
                <span className="text-[11px] text-muted-foreground/40">{senses.length} 义</span>
              )}
            </div>

            {/* Sense list */}
            <div className="space-y-1">
              {senses.map((sense, si) => (
                <SenseItem key={sense.id} sense={sense} index={si + 1} word={entry.word} />
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Footer ── */}
      <div className="px-5 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground/40">
        <span>{allSenses.length} 个义项</span>
        {entry.aiReviewMeta && (
          <span>deepseek-chat · 修正 {entry.aiReviewMeta.fixesApplied} 处</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sense Item — Chinese-first, qualifier tags, bold target word
// ═══════════════════════════════════════════════════════════════

/** Parse "（贬义，俚语）懦夫..." → { qualifiers: ["贬义","俚语"], text: "懦夫..." } */
function parseZhQualifiers(zh: string): { qualifiers: string[]; text: string } {
  const match = zh.match(/^（([^）]+)）\s*/);
  if (match) {
    const qualifiers = match[1].split(/[，,、]/).map((s) => s.trim()).filter(Boolean);
    return { qualifiers, text: zh.slice(match[0].length) };
  }
  return { qualifiers: [], text: zh };
}

/** Parse "(derogatory, slang) A coward..." → { qualifiers: ["derogatory","slang"], text: "A coward..." } */
function parseEnQualifiers(en: string): { qualifiers: string[]; text: string } {
  const match = en.match(/^\(([^)]+)\)\s*/);
  if (match) {
    const qualifiers = match[1].split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    return { qualifiers, text: en.slice(match[0].length) };
  }
  return { qualifiers: [], text: en };
}

/** Bold the target word in a sentence (case-insensitive) */
function highlightWord(text: string, word: string): React.ReactNode {
  if (!word || !text) return text;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <strong key={i} className="font-bold text-foreground/90">{part}</strong> : part,
  );
}

function SenseItem({ sense, index, word }: { sense: DictionarySense; index: number; word: string }) {
  const [showEn, setShowEn] = useState(false);
  const { qualifiers: zhQuals, text: cleanZh } = parseZhQualifiers(sense.translations?.zh ?? '');
  const { qualifiers: enQuals, text: cleanEn } = parseEnQualifiers(sense.definition ?? '');
  const hasEn = !!sense.definition;

  return (
    <div className="group">
      <div className="flex items-start gap-2 py-1.5 -mx-1 px-1 rounded transition-colors hover:bg-muted/30">
        {/* Number */}
        <span className="text-xs text-muted-foreground/40 tabular-nums min-w-[1.25rem] text-right select-none pt-0.5">
          {index}.
        </span>

        {/* Main text — Chinese or English (toggle with eye icon) */}
        <span className="flex-1 min-w-0 inline-flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
          {showEn && hasEn ? (
            <>
              <span className="text-sm text-muted-foreground leading-snug">{cleanEn}</span>
              {enQuals.length > 0 && enQuals.map((q) => (
                <span key={q} className="inline-block text-[10px] px-1 py-0 rounded border border-border/60 text-muted-foreground/70 font-normal leading-tight">
                  {q}
                </span>
              ))}
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-foreground leading-snug">
                {cleanZh || sense.definition.substring(0, 60)}
              </span>
              {zhQuals.length > 0 && zhQuals.map((q) => (
                <span key={q} className="inline-block text-[10px] px-1 py-0 rounded border border-border/60 text-muted-foreground/70 font-normal leading-tight">
                  {q}
                </span>
              ))}
            </>
          )}
          {/* Eye toggle — always visible when English exists */}
          {hasEn && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowEn(!showEn); }}
              className={cn(
                'p-0.5 rounded transition-colors -my-0.5',
                showEn
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground/20 hover:text-muted-foreground/50',
              )}
              title={showEn ? '看中文' : '看英文'}
            >
              <Eye className="size-3.5" />
            </button>
          )}
        </span>

        {/* Wiktionary tags */}
        {sense.tags.length > 0 && (
          <span className="text-[10px] text-muted-foreground/40 shrink-0 pt-0.5 hidden sm:inline">
            {sense.tags.slice(0, 3).join('·')}
          </span>
        )}
      </div>

      {/* Examples — always visible */}
      {sense.examples.length > 0 && (
        <div className="ml-[2.25rem] mb-1.5 pl-4 border-l-2 border-border/30 space-y-2">
          {sense.examples.map((ex, ei) => (
            <div key={ei} className="flex gap-2 items-start">
              <span className="text-[10px] text-muted-foreground/25 tabular-nums min-w-[1rem] text-right pt-0.5 select-none">
                {ei + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground/70 italic leading-relaxed">
                  {highlightWord(ex.en, word)}
                </p>
                {ex.zh && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {highlightWord(ex.zh, word)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Synonyms / Antonyms — subtle footer */}
      {(sense.synonyms.length > 0 || sense.antonyms.length > 0) && (
        <div className="ml-[2.25rem] mb-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground/45">
          {sense.synonyms.length > 0 && (
            <span>
              <span className="font-medium">近</span>{' '}
              {sense.synonyms.slice(0, 5).join(' · ')}
              {sense.synonyms.length > 5 && <span className="text-muted-foreground/25"> +{sense.synonyms.length - 5}</span>}
            </span>
          )}
          {sense.antonyms.length > 0 && (
            <span>
              <span className="font-medium">反</span>{' '}
              {sense.antonyms.slice(0, 5).join(' · ')}
              {sense.antonyms.length > 5 && <span className="text-muted-foreground/25"> +{sense.antonyms.length - 5}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
