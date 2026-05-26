import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  BookmarkPlus,
  Brain,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Save,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { lookupWord, getBestPhonetic, getFirstAudio, type DictEntry } from '@/lib/dictionary-api'
import { enrichWord, type WordEnrichmentResult } from '@/lib/practice-ai-api'
import { useWordsStore } from '@/stores/assets.store'
import { expressionApi, type TopicDetail } from '../api/english-practice-api'

type VocabularyInsight = {
  kind: 'word'
  id: string
  word: string
  meaning?: string
  sceneName?: string
}

type ChunkInsight = {
  kind: 'chunk'
  id: string
  text: string
  meaning: string
  description?: string | null
  examples?: TopicDetail['activeChunks'][number]['examples']
  sceneName?: string
}

type PatternInsight = {
  kind: 'pattern'
  id: string
  pattern: string
  meaning?: string
  slots?: string[]
  example?: string
  difficulty?: string
  sceneName?: string
}

export type LearningInsightItem = VocabularyInsight | ChunkInsight | PatternInsight

interface LearningInsightDialogProps {
  items: LearningInsightItem[]
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
}

export function LearningInsightDialog({
  items,
  index,
  open,
  onOpenChange,
  onIndexChange,
}: LearningInsightDialogProps) {
  const current = items[index] ?? null
  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  const gotoPrev = useCallback(() => {
    if (hasPrev) onIndexChange(index - 1)
  }, [hasPrev, index, onIndexChange])

  const gotoNext = useCallback(() => {
    if (hasNext) onIndexChange(index + 1)
  }, [hasNext, index, onIndexChange])

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') gotoPrev()
      if (event.key === 'ArrowRight') gotoNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, gotoPrev, gotoNext])

  if (!current) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 md:h-[88vh] md:max-w-3xl md:rounded-2xl [&>button]:hidden">
        {/* 关闭按钮（用 div 包裹避免被 [&>button]:hidden 隐藏） */}
        <div className="absolute left-3 top-3 z-50 md:left-4 md:top-4">
          <button
            onClick={() => onOpenChange(false)}
            className="flex size-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex h-full flex-col">
          <InsightHeader item={current} />
          <ScrollArea className="flex-1">
            <div className="px-5 py-5 md:px-6">
              {current.kind === 'word' && <WordInsight item={current} />}
              {current.kind === 'chunk' && <ChunkInsightView item={current} />}
              {current.kind === 'pattern' && <PatternInsightView item={current} />}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3">
            <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev} className="gap-1">
              <ChevronLeft className="size-4" /> 上一个
            </Button>
            <span className="text-xs text-muted-foreground">{index + 1} / {items.length}</span>
            <Button variant="outline" size="sm" onClick={gotoNext} disabled={!hasNext} className="gap-1">
              下一个 <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InsightHeader({ item }: { item: LearningInsightItem }) {
  const Icon = item.kind === 'word' ? BookOpen : item.kind === 'chunk' ? Layers : Sparkles
  const title = item.kind === 'word' ? item.word : item.kind === 'chunk' ? item.text : item.pattern
  const subtitle = item.kind === 'word' ? item.meaning : item.meaning
  const label = item.kind === 'word' ? '场景词汇' : item.kind === 'chunk' ? '核心 Chunk' : '句型骨架'

  return (
    <div className="border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-5 pt-12 md:px-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <Badge variant="secondary" className="mb-2">{label}</Badge>
          <h2 className="break-words text-2xl font-bold leading-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

function WordInsight({ item }: { item: VocabularyInsight }) {
  const [dictData, setDictData] = useState<DictEntry[] | null | 'loading'>('loading')
  const [enrichData, setEnrichData] = useState<WordEnrichmentResult | null | 'loading'>('loading')
  const [saving, setSaving] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { addWord, hasWord } = useWordsStore()

  useEffect(() => {
    setDictData('loading')
    setEnrichData('loading')
    lookupWord(item.word).then((data) => {
      setDictData(data)
      const summary = data
        ? data.flatMap((entry) => entry.meanings).slice(0, 3)
          .map((meaning) => `${meaning.partOfSpeech}: ${meaning.definitions[0]?.definition ?? ''}`)
          .join(' | ')
        : item.meaning
      enrichWord(item.word, summary).then(setEnrichData).catch(() => setEnrichData(null))
    })
  }, [item.word, item.meaning])

  const dictEntries = Array.isArray(dictData) ? dictData : []
  const mainEntry = dictEntries[0]
  const phonetic = mainEntry ? getBestPhonetic(mainEntry) : null
  const audioUrl = mainEntry ? getFirstAudio(mainEntry.phonetics) : null
  const meanings = dictEntries.flatMap((entry) => entry.meanings)
  const enriched = enrichData !== 'loading' ? enrichData : null
  const saved = hasWord(item.word)

  const playAudio = useCallback((url: string) => {
    audioRef.current?.pause()
    const audio = new Audio(url.startsWith('//') ? `https:${url}` : url)
    audioRef.current = audio
    audio.play().catch(() => {})
  }, [])

  const saveWord = () => {
    setSaving(true)
    addWord(item.word)
    toast.success(saved ? '已在生词本中' : '已加入生词本')
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {phonetic && <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-muted-foreground">{phonetic}</span>}
        {audioUrl && (
          <Button variant="outline" size="sm" onClick={() => playAudio(audioUrl)} className="gap-1.5">
            <Volume2 className="size-4" /> 发音
          </Button>
        )}
        <Button size="sm" onClick={saveWord} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <BookmarkPlus className="size-4" />}
          {saved ? '已加入' : '加入生词本'}
        </Button>
      </div>

      {enrichData === 'loading' ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : enriched?.memoryTip ? (
        <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <Brain className="mt-0.5 size-4 shrink-0" />
          <span>{enriched.memoryTip}</span>
        </div>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">释义</h3>
        {dictData === 'loading' ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : meanings.length > 0 ? (
          <div className="space-y-3">
            {meanings.slice(0, 5).map((meaning, index) => (
              <div key={`${meaning.partOfSpeech}-${index}`} className="rounded-xl border border-border p-3">
                <Badge variant="outline" className="mb-2">{meaning.partOfSpeech}</Badge>
                <div className="space-y-2">
                  {meaning.definitions.slice(0, 3).map((definition, defIndex) => (
                    <p key={defIndex} className="text-sm leading-relaxed text-foreground">
                      {definition.definition}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{item.meaning ?? '暂无词典释义'}</p>
        )}
      </section>

      {enriched?.examples?.length ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">例句</h3>
          {enriched.examples.slice(0, 4).map((example, index) => (
            <ExampleBlock key={index} en={example.en} zh={example.zh} note={example.note} level={example.level} />
          ))}
        </section>
      ) : null}
    </div>
  )
}

function ChunkInsightView({ item }: { item: ChunkInsight }) {
  const [saving, setSaving] = useState(false)

  const saveChunk = async () => {
    setSaving(true)
    try {
      await expressionApi.create({
        type: 'chunk',
        chunkText: item.text,
        corrected: item.text,
        original: item.meaning,
        sceneName: item.sceneName,
      })
      toast.success('已保存到表达库')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <Button onClick={saveChunk} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        保存到表达库
      </Button>

      {item.description && (
        <section className="rounded-xl bg-muted p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">用法讲解</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">示例句</h3>
        {item.examples?.length ? (
          item.examples.map((example, index) => (
            <ExampleBlock key={index} en={example.en} zh={example.zh} note={example.note ?? undefined} level={example.level} />
          ))
        ) : (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">后台还没有配置示例句。</p>
        )}
      </section>
    </div>
  )
}

function PatternInsightView({ item }: { item: PatternInsight }) {
  const [saving, setSaving] = useState(false)
  const slotText = useMemo(() => item.slots?.filter(Boolean).join(' / '), [item.slots])

  const savePattern = async () => {
    setSaving(true)
    try {
      await expressionApi.create({
        type: 'scene_phrase',
        chunkText: item.pattern,
        corrected: item.example || item.pattern,
        original: item.meaning,
        sceneName: item.sceneName,
      })
      toast.success('已保存到表达库')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <Button onClick={savePattern} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        保存到表达库
      </Button>

      <section className="rounded-xl border border-border p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">结构</h3>
        <p className="font-mono text-sm leading-relaxed text-foreground">{item.pattern}</p>
        {slotText && <p className="mt-2 text-xs text-muted-foreground">可替换位置：{slotText}</p>}
      </section>

      {item.example && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">套用示例</h3>
          <ExampleBlock en={item.example} zh={item.meaning ?? ''} level={item.difficulty} />
        </section>
      )}
    </div>
  )
}

function ExampleBlock({ en, zh, note, level }: { en: string; zh?: string; note?: string; level?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-[10px]">{level ?? 'example'}</Badge>
      </div>
      <p className="text-sm font-medium leading-relaxed text-foreground">{en}</p>
      {zh && <p className="mt-2 border-l-2 border-primary/30 pl-3 text-sm leading-relaxed text-muted-foreground">{zh}</p>}
      {note && <p className="mt-2 text-xs leading-relaxed text-amber-600 dark:text-amber-400">{note}</p>}
    </div>
  )
}
