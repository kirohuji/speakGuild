import { useState } from 'react';
import {
  ExternalLink, ShieldCheck, ChevronDown, Eye,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { DictionaryEntry, DictionaryCluster, DictionarySense } from '@/features/admin/api-dictionary';

// ═══════════════════════════════════════════════════════════════
// Shared Dictionary Preview — used by admin-dictionary + content-library
// ═══════════════════════════════════════════════════════════════

const POS_COLORS: Record<string, string> = {
  noun: 'bg-blue-100 text-blue-700', verb: 'bg-green-100 text-green-700',
  adj: 'bg-amber-100 text-amber-700', adv: 'bg-purple-100 text-purple-700',
  pronoun: 'bg-pink-100 text-pink-700', preposition: 'bg-cyan-100 text-cyan-700',
  conjunction: 'bg-orange-100 text-orange-700', interjection: 'bg-red-100 text-red-700',
  determiner: 'bg-indigo-100 text-indigo-700', article: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-700',
};

const POS_LABELS_CN: Record<string, string> = {
  noun: '名', verb: '动', adj: '形', adv: '副',
  pronoun: '代', preposition: '介', conjunction: '连',
  interjection: '叹', determiner: '限', article: '冠',
  other: '',
};

const POS_LABELS: Record<string, string> = {
  noun: 'n.', verb: 'v.', adj: 'adj.', adv: 'adv.',
  pronoun: 'pron.', preposition: 'prep.', conjunction: 'conj.',
  interjection: 'interj.', determiner: 'det.', article: 'art.',
  other: '',
};

/** Parse "（贬义，俚语）懦夫..." → { qualifiers, text } */
function parseZhQualifiers(zh: string): { qualifiers: string[]; text: string } {
  const match = zh.match(/^（([^）]+)）\s*/);
  if (match) {
    const qualifiers = match[1].split(/[，,、]/).map((s) => s.trim()).filter(Boolean);
    return { qualifiers, text: zh.slice(match[0].length) };
  }
  return { qualifiers: [], text: zh };
}

/** Parse "(derogatory, slang) A coward..." → { qualifiers, text } */
function parseEnQualifiers(en: string): { qualifiers: string[]; text: string } {
  const match = en.match(/^\(([^)]+)\)\s*/);
  if (match) {
    const qualifiers = match[1].split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    return { qualifiers, text: en.slice(match[0].length) };
  }
  return { qualifiers: [], text: en };
}

/** Bold the target word — whole-word match only */
function highlightWord(text: string, word: string): React.ReactNode {
  if (!word || !text) return text;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isCJK = /^[\u4e00-\u9fff]+$/.test(word);
  const pattern = isCJK ? escaped : `\\b${escaped}\\b`;
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <strong key={i} className="font-bold text-foreground/90">{part}</strong> : part,
  );
}

export function DictionaryPreview({ entry }: { entry: DictionaryEntry }) {
  const allSenses = entry.senseClusters?.flatMap((c) => c.senses) ?? [];
  const ukPron = entry.pronunciations?.find((p) => p.type === 'uk' && p.isPreferred)
    ?? entry.pronunciations?.find((p) => p.type === 'uk');
  const usPron = entry.pronunciations?.find((p) => p.type === 'us' && p.isPreferred)
    ?? entry.pronunciations?.find((p) => p.type === 'us');

  const [allEn, setAllEn] = useState(false);
  const [senseStates, setSenseStates] = useState<Record<string, boolean>>({});
  const [allDetails, setAllDetails] = useState(false);
  const [detailStates, setDetailStates] = useState<Record<string, boolean>>({});
  const [showUncommon, setShowUncommon] = useState(false);

  const toggleAllEn = () => {
    const next = !allEn; setAllEn(next);
    const states: Record<string, boolean> = {};
    if (next) allSenses.forEach((s) => { states[s.id] = true; });
    setSenseStates(states);
  };
  const toggleSenseEn = (id: string) => setSenseStates((p) => {
    const n = { ...p, [id]: !p[id] }; setAllEn(allSenses.every((s) => n[s.id])); return n;
  });
  const toggleAllDetails = () => {
    const next = !allDetails; setAllDetails(next);
    const states: Record<string, boolean> = {};
    if (next) allSenses.forEach((s) => { states[s.id] = true; });
    setDetailStates(states);
  };
  const toggleSenseDetails = (id: string) => setDetailStates((p) => {
    const n = { ...p, [id]: !p[id] }; setAllDetails(allSenses.every((s) => n[s.id])); return n;
  });

  const clusterName = (c: DictionaryCluster) => {
    const zh = c.senses?.[0]?.translations?.zh;
    if (zh && zh.length <= 12) return zh;
    if (zh) return zh.substring(0, 10) + '…';
    return c.label.length > 40 ? c.label.substring(0, 37) + '…' : c.label;
  };

  return (
    <div className="divide-y">
      <div className="px-5 py-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-2xl font-bold tracking-tight">{entry.word}</h2>
          <span className="text-sm text-muted-foreground font-mono">
            {[ukPron?.ipa, usPron?.ipa].filter(Boolean).join('  ')}
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <button onClick={toggleAllEn} className={cn('text-[11px] px-2 py-0.5 rounded border transition-colors', allEn ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground/50 hover:text-muted-foreground')}>{allEn ? '收起英文' : '展开英文'}</button>
            <button onClick={toggleAllDetails} className={cn('text-[11px] px-2 py-0.5 rounded border transition-colors', allDetails ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground/50 hover:text-muted-foreground')}>{allDetails ? '收起例句' : '展开例句'}</button>
            <button onClick={() => setShowUncommon(!showUncommon)} className={cn('text-[11px] px-2 py-0.5 rounded border transition-colors', showUncommon ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground/50 hover:text-muted-foreground')}>{showUncommon ? '隐藏不常用' : '显示不常用'}</button>
          </div>
        </div>
        {entry.sourceUrl && (
          <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground"><ExternalLink className="size-2.5" /> Wiktionary CC BY-SA 4.0</a>
        )}
        {entry.wordForms?.length > 0 && (
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground/50 shrink-0">变形</span>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {entry.wordForms.map((f) => (<span key={f.word} className="inline-flex items-baseline gap-1.5"><span className="text-sm font-semibold text-foreground/80">{f.word}</span>{f.tags?.length > 0 && <span className="text-[11px] text-muted-foreground/45">{f.tags.join(', ')}</span>}</span>))}
            </div>
          </div>
        )}
        {entry.entrySynonyms?.length > 0 && (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground/50 shrink-0">近义</span>
            <p className="text-[13px] text-foreground/65 leading-relaxed">{entry.entrySynonyms.slice(0, 20).join(', ')}{entry.entrySynonyms.length > 20 && <span className="text-muted-foreground/30"> +{entry.entrySynonyms.length - 20}</span>}</p>
          </div>
        )}
      </div>

      {entry.senseClusters?.map((cluster) => {
        const senses = cluster.senses ?? [];
        const cnLabel = POS_LABELS_CN[cluster.posBucket] ?? '';
        const enLabel = POS_LABELS[cluster.posBucket] ?? cluster.posBucket;
        return (
          <div key={cluster.id} className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', POS_COLORS[cluster.posBucket] ?? POS_COLORS.other)}>{cnLabel || enLabel}</span>
              <span className="text-[11px] text-muted-foreground/60">{clusterName(cluster)}</span>
              {entry.senseClusters && entry.senseClusters.length === 1 && senses.length > 1 && (<span className="text-[11px] text-muted-foreground/40">{senses.length} 义</span>)}
            </div>
            <div className="space-y-1">
              {senses.filter((s) => showUncommon || s.frequency !== 'uncommon').map((sense, si) => (
                <SenseItem key={sense.id} sense={sense} index={si + 1} word={entry.word} showEn={!!senseStates[sense.id]} onToggleEn={() => toggleSenseEn(sense.id)} showDetails={!!detailStates[sense.id]} onToggleDetails={() => toggleSenseDetails(sense.id)} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="px-5 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground/40">
        <span>{allSenses.length} 个义项</span>
        {entry.aiReviewMeta && <span>deepseek-chat · 修正 {entry.aiReviewMeta.fixesApplied} 处</span>}
      </div>
    </div>
  );
}

function SenseItem({ sense, index, word, showEn, onToggleEn, showDetails, onToggleDetails }: {
  sense: DictionarySense; index: number; word: string;
  showEn: boolean; onToggleEn: () => void;
  showDetails: boolean; onToggleDetails: () => void;
}) {
  const { qualifiers: zhQuals, text: cleanZh } = parseZhQualifiers(sense.translations?.zh ?? '');
  const { qualifiers: enQuals, text: cleanEn } = parseEnQualifiers(sense.definition ?? '');
  const hasEn = !!sense.definition;
  const hasDetails = sense.examples.length > 0 || sense.synonyms.length > 0 || sense.antonyms.length > 0;

  return (
    <div className="group">
      <div className="flex items-start gap-2 py-1.5 -mx-1 px-1 rounded transition-colors hover:bg-muted/30">
        <span className="text-xs text-muted-foreground/40 tabular-nums min-w-[1.25rem] text-right select-none pt-0.5">{index}.</span>
        <span className="flex-1 min-w-0 inline-flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
          {showEn && hasEn ? (<><span className="text-sm text-muted-foreground leading-snug">{cleanEn}</span>{enQuals.length > 0 && enQuals.map((q) => (<span key={q} className="inline-block text-[10px] px-1 py-0 rounded border border-border/60 text-muted-foreground/70 font-normal leading-tight">{q}</span>))}</>) : (<><span className="text-sm font-medium text-foreground leading-snug">{cleanZh || sense.definition.substring(0, 60)}</span>{zhQuals.length > 0 && zhQuals.map((q) => (<span key={q} className="inline-block text-[10px] px-1 py-0 rounded border border-border/60 text-muted-foreground/70 font-normal leading-tight">{q}</span>))}</>)}
          {sense.frequency === 'uncommon' && (<span className="inline-block text-[10px] px-1 py-0 rounded bg-muted text-muted-foreground/50 font-normal leading-tight">不常用</span>)}
          {hasEn && (<button onClick={(e) => { e.stopPropagation(); onToggleEn(); }} className={cn('p-0.5 rounded transition-colors -my-0.5', showEn ? 'text-primary bg-primary/10' : 'text-muted-foreground/20 hover:text-muted-foreground/50')} title={showEn ? '看中文' : '看英文'}><Eye className="size-3.5" /></button>)}
          {hasDetails && (<button onClick={(e) => { e.stopPropagation(); onToggleDetails(); }} className={cn('p-0.5 rounded transition-colors -my-0.5', showDetails ? 'text-primary bg-primary/10' : 'text-muted-foreground/20 hover:text-muted-foreground/50')} title={showDetails ? '收起详情' : '展开详情'}><ChevronDown className={cn('size-3.5 transition-transform', showDetails && 'rotate-180')} /></button>)}
        </span>
        {sense.tags.length > 0 && (<span className="text-[10px] text-muted-foreground/40 shrink-0 pt-0.5 hidden sm:inline">{sense.tags.slice(0, 3).join('·')}</span>)}
      </div>
      {hasDetails && showDetails && (
        <div className="ml-[2.25rem] mb-1.5 pl-4 border-l-2 border-border/30">
          {sense.examples.length > 0 && (<div className="space-y-2">{sense.examples.map((ex, ei) => (<div key={ei} className="flex gap-2 items-start"><span className="text-[10px] text-muted-foreground/25 tabular-nums min-w-[1rem] text-right pt-0.5 select-none">{ei + 1}</span><div className="min-w-0"><p className="text-sm text-muted-foreground/70 italic leading-relaxed">{highlightWord(ex.en, word)}</p>{ex.zh && <p className="text-xs text-muted-foreground/60 mt-0.5">{highlightWord(ex.zh, word)}</p>}</div></div>))}</div>)}
          {(sense.synonyms.length > 0 || sense.antonyms.length > 0) && (<div className="mt-2 mb-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground/45">{sense.synonyms.length > 0 && (<span><span className="font-medium">近</span> {sense.synonyms.slice(0, 5).join(' · ')}{sense.synonyms.length > 5 && <span className="text-muted-foreground/25"> +{sense.synonyms.length - 5}</span>}</span>)}{sense.antonyms.length > 0 && (<span><span className="font-medium">反</span> {sense.antonyms.slice(0, 5).join(' · ')}{sense.antonyms.length > 5 && <span className="text-muted-foreground/25"> +{sense.antonyms.length - 5}</span>}</span>)}</div>)}
        </div>
      )}
    </div>
  );
}
