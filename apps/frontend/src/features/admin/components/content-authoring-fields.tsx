import { useMemo, useState } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import type { Chunk, ChunkExample, SentencePattern, SentencePatternFull, Vocabulary } from '../api-content-admin'

const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5']
const EXAMPLE_LEVELS = ['basic', 'intermediate', 'advanced']

export function DynamicStringList({
  label,
  value,
  onChange,
  placeholder,
  addLabel = '添加',
}: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  addLabel?: string
}) {
  const items = value.length ? value : ['']

  const updateAt = (index: number, next: string) => {
    onChange(items.map((item, i) => (i === index ? next : item)).filter((item, i, arr) => item.trim() || i === arr.length - 1))
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder={placeholder}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive"
              disabled={items.length === 1}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items.filter(Boolean), ''])}>
        <Plus className="mr-1.5 size-3.5" />
        {addLabel}
      </Button>
    </div>
  )
}

export function ChunkExamplesEditor({
  value,
  onChange,
}: {
  value: ChunkExample[]
  onChange: (value: ChunkExample[]) => void
}) {
  const items = value.length ? value : [{ en: '', zh: '', level: 'basic' }]

  const updateAt = (index: number, patch: Partial<ChunkExample>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="space-y-2">
      <Label>示例句子</Label>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border border-border/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge variant="secondary" className="text-[10px]">示例 {index + 1}</Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                disabled={items.length === 1}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-2">
              <Input value={item.en} onChange={(e) => updateAt(index, { en: e.target.value })} placeholder="English example sentence" />
              <Input value={item.zh} onChange={(e) => updateAt(index, { zh: e.target.value })} placeholder="中文翻译" />
              <div className="grid grid-cols-2 gap-2">
                <Select value={item.level ?? 'basic'} onChange={(e) => updateAt(index, { level: e.target.value })}>
                  {EXAMPLE_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </Select>
                <Input value={item.note ?? ''} onChange={(e) => updateAt(index, { note: e.target.value })} placeholder="使用提示，可选" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { en: '', zh: '', level: 'basic' }])}>
        <Plus className="mr-1.5 size-3.5" />
        添加示例句
      </Button>
    </div>
  )
}

export function SentencePatternEditor({
  value,
  onChange,
}: {
  value: SentencePattern[]
  onChange: (value: SentencePattern[]) => void
}) {
  const items = value.length ? value : [{ pattern: '', meaning: '', slots: [], example: '', difficulty: 'L1' }]

  const updateAt = (index: number, patch: Partial<SentencePattern>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="space-y-2">
      <div>
        <Label>句型骨架</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">给学生可替换的表达框架，例如 “I'm here to ___.”</p>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border border-border/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge variant="secondary" className="text-[10px]">骨架 {index + 1}</Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                disabled={items.length === 1}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-2">
              <Input value={item.pattern} onChange={(e) => updateAt(index, { pattern: e.target.value })} placeholder="I'm here to ___." />
              <Input value={item.meaning} onChange={(e) => updateAt(index, { meaning: e.target.value })} placeholder="说明来意" />
              <Input value={item.example} onChange={(e) => updateAt(index, { example: e.target.value })} placeholder="I'm here to check in." />
              <div className="grid grid-cols-2 gap-2">
                <Select value={item.difficulty} onChange={(e) => updateAt(index, { difficulty: e.target.value })}>
                  {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </Select>
                <Input
                  value={(item.slots ?? []).join(', ')}
                  onChange={(e) => updateAt(index, { slots: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                  placeholder="check in, ask about my room"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { pattern: '', meaning: '', slots: [], example: '', difficulty: 'L1' }])}>
        <Plus className="mr-1.5 size-3.5" />
        添加句型
      </Button>
    </div>
  )
}

export function ChunkMultiSelect({
  chunks,
  value,
  onChange,
}: {
  chunks: Chunk[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [keyword, setKeyword] = useState('')
  const selected = chunks.filter((chunk) => value.includes(chunk.id))
  const results = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return chunks
      .filter((chunk) => !value.includes(chunk.id))
      .filter((chunk) => !q || chunk.text.toLowerCase().includes(q) || chunk.meaning.includes(keyword) || (chunk.category ?? '').includes(keyword))
      .slice(0, 12)
  }, [chunks, keyword, value])

  return (
    <div className="space-y-2">
      <Label>关联 Chunk</Label>
      <div className="rounded-lg border border-border/70">
        <div className="relative border-b border-border/70">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="border-0 pl-9 shadow-none focus-visible:ring-0"
            placeholder="搜索英文、中文含义或分类..."
          />
        </div>
        <div className="grid max-h-56 gap-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">没有可选 Chunk</p>
          ) : results.map((chunk) => (
            <button
              type="button"
              key={chunk.id}
              onClick={() => onChange([...value, chunk.id])}
              className="rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{chunk.text}</span>
                <Badge variant="outline" className="text-[10px]">{chunk.difficulty}</Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{chunk.meaning}</p>
            </button>
          ))}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((chunk) => (
            <Badge key={chunk.id} variant="secondary" className={cn('gap-1 pr-1 text-xs')}>
              {chunk.text}
              <button type="button" onClick={() => onChange(value.filter((id) => id !== chunk.id))}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function VocabMultiSelect({
  vocabs,
  value,
  onChange,
}: {
  vocabs: Vocabulary[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [keyword, setKeyword] = useState('')
  const selected = vocabs.filter((vocab) => value.includes(vocab.id))
  const results = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return vocabs
      .filter((vocab) => !value.includes(vocab.id))
      .filter((vocab) => !q || vocab.word.toLowerCase().includes(q) || vocab.meaning.includes(keyword))
      .slice(0, 12)
  }, [vocabs, keyword, value])

  return (
    <div className="space-y-2">
      <Label>关联词汇</Label>
      <div className="rounded-lg border border-border/70">
        <div className="relative border-b border-border/70">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="border-0 pl-9 shadow-none focus-visible:ring-0"
            placeholder="搜索英文或中文含义..."
          />
        </div>
        <div className="grid max-h-56 gap-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">没有可选词汇</p>
          ) : results.map((vocab) => (
            <button
              type="button"
              key={vocab.id}
              onClick={() => onChange([...value, vocab.id])}
              className="rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{vocab.word}</span>
                <span className="text-xs text-muted-foreground">{vocab.meaning}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((vocab) => (
            <Badge key={vocab.id} variant="secondary" className={cn('gap-1 pr-1 text-xs')}>
              {vocab.word}
              <button type="button" onClick={() => onChange(value.filter((id) => id !== vocab.id))}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function SentencePatternMultiSelect({
  patterns,
  value,
  onChange,
}: {
  patterns: SentencePatternFull[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [keyword, setKeyword] = useState('')
  const selected = patterns.filter((p) => value.includes(p.id))
  const results = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return patterns
      .filter((p) => !value.includes(p.id))
      .filter((p) => !q || p.pattern.toLowerCase().includes(q) || (p.meaning ?? '').includes(keyword))
      .slice(0, 12)
  }, [patterns, keyword, value])

  return (
    <div className="space-y-2">
      <Label>关联句型骨架</Label>
      <div className="rounded-lg border border-border/70">
        <div className="relative border-b border-border/70">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="border-0 pl-9 shadow-none focus-visible:ring-0"
            placeholder="搜索句型或含义..."
          />
        </div>
        <div className="grid max-h-56 gap-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">没有可选句型</p>
          ) : results.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => onChange([...value, p.id])}
              className="rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{p.pattern}</span>
                <Badge variant="outline" className="text-[10px]">{p.difficulty}</Badge>
              </div>
              {p.meaning && <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.meaning}</p>}
            </button>
          ))}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <Badge key={p.id} variant="secondary" className={cn('gap-1 pr-1 text-xs')}>
              <span className="font-mono">{p.pattern}</span>
              <button type="button" onClick={() => onChange(value.filter((id) => id !== p.id))}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
