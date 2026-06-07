import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  BookmarkPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  ExternalLink,
  FileText,
  Layers,
  ListMusic,
  Loader2,
  Save,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
import { get } from '@/lib/request'
import { enrichWord, type WordEnrichmentResult } from '@/lib/practice-ai-api'
import { useWordsStore } from '@/stores/assets.store'
import type { DictionaryCluster, DictionaryEntry, DictionarySense } from '@/features/admin/api-dictionary'
import { expressionApi, type TopicDetail } from '../api/english-practice-api'

type VocabularyInsight = {
  kind: 'word'
  id: string
  word: string
  meaning?: string
  partOfSpeech?: string | null
  phoneticUs?: string | null
  phoneticUk?: string | null
  audioUsUrl?: string | null
  audioUkUrl?: string | null
  definitionEn?: string | null
  synonyms?: string[]
  examples?: unknown
  description?: string | null
  difficulty?: string
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
  /** 是否已保存到学习库 */
  saved?: boolean
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
  /** 是否已保存到学习库 */
  saved?: boolean
}

export type LearningInsightItem = VocabularyInsight | ChunkInsight | PatternInsight

const dictionaryCache = new Map<string, DictionaryEntry | null>()

const POS_LABELS_CN: Record<string, string> = {
  noun: '名',
  verb: '动',
  adj: '形',
  adv: '副',
  pronoun: '代',
  preposition: '介',
  conjunction: '连',
  interjection: '叹',
  determiner: '限',
  article: '冠',
  other: '',
}

const POS_LABELS: Record<string, string> = {
  noun: 'n.',
  verb: 'v.',
  adj: 'adj.',
  adv: 'adv.',
  pronoun: 'pron.',
  preposition: 'prep.',
  conjunction: 'conj.',
  interjection: 'interj.',
  determiner: 'det.',
  article: 'art.',
  other: '',
}

async function lookupManagedDictionary(word: string): Promise<DictionaryEntry | null> {
  const key = word.toLowerCase().trim()
  if (!key) return null
  if (dictionaryCache.has(key)) return dictionaryCache.get(key)!
  try {
    const entry = await get<DictionaryEntry>(`/dictionary/${encodeURIComponent(key)}`)
    dictionaryCache.set(key, entry)
    return entry
  } catch {
    dictionaryCache.set(key, null)
    return null
  }
}

function parseDefinitionLines(definitionEn?: string | null) {
  if (!definitionEn) return []
  return definitionEn
    .split(/;\s*|\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function posShortLabel(pos?: string | null) {
  if (!pos) return ''
  return POS_LABELS[pos] ?? (pos === 'adjective' ? 'adj.' : pos)
}

function parseVocabularyDefinitions(definitionEn?: string | null) {
  return parseDefinitionLines(definitionEn).map((line) => {
    const colonIndex = line.indexOf(': ')
    const partOfSpeech = colonIndex > 0 ? line.slice(0, colonIndex).trim() : ''
    const body = colonIndex > 0 ? line.slice(colonIndex + 2).trim() : line
    const zhMatch = body.match(/\s+\[(.+?)\]$/)
    const zhStart = zhMatch?.index ?? -1
    const definition = zhMatch && zhStart >= 0 ? body.slice(0, zhStart).trim() : body
    const chineseGloss = zhMatch?.[1]?.trim() ?? ''
    return {
      partOfSpeech,
      label: posShortLabel(partOfSpeech),
      definition,
      chineseGloss,
    }
  }).filter((item) => item.definition || item.chineseGloss)
}

function textOrEmpty(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeVocabExamples(value: unknown): Array<{ en: string; zh?: string; note?: string | null; level?: string }> {
  let raw = value
  if (typeof raw === 'string') {
    const text = raw.trim()
    try {
      raw = JSON.parse(raw)
    } catch {
      return text ? [{ en: text }] : []
    }
  }
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (typeof item === 'string') return { en: item.trim() }
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const en = textOrEmpty(record.en) || textOrEmpty(record.english) || textOrEmpty(record.sentence) || textOrEmpty(record.text)
      const zh = textOrEmpty(record.zh) || textOrEmpty(record.cn) || textOrEmpty(record.chinese) || textOrEmpty(record.translation)
      const note = textOrEmpty(record.note) || null
      const level = textOrEmpty(record.level)
      return en ? { en, ...(zh ? { zh } : {}), ...(note ? { note } : {}), ...(level ? { level } : {}) } : null
    })
    .filter(Boolean) as Array<{ en: string; zh?: string; note?: string | null; level?: string }>
}

function parseZhQualifiers(zh: string): { qualifiers: string[]; text: string } {
  const match = zh.match(/^（([^）]+)）\s*/)
  if (!match) return { qualifiers: [], text: zh }
  return {
    qualifiers: match[1].split(/[，,、]/).map((item) => item.trim()).filter(Boolean),
    text: zh.slice(match[0].length),
  }
}

function parseEnQualifiers(en: string): { qualifiers: string[]; text: string } {
  const match = en.match(/^\(([^)]+)\)\s*/)
  if (!match) return { qualifiers: [], text: en }
  return {
    qualifiers: match[1].split(/[,，、]/).map((item) => item.trim()).filter(Boolean),
    text: en.slice(match[0].length),
  }
}

function highlightWord(text: string, word: string): ReactNode {
  if (!word || !text) return text
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const isCJK = /^[\u4e00-\u9fff]+$/.test(word)
  const pattern = isCJK ? escaped : `\\b${escaped}\\b`
  const regex = new RegExp(`(${pattern})`, 'gi')
  return text.split(regex).map((part, index) =>
    regex.test(part) ? <strong key={index} className="font-semibold text-foreground">{part}</strong> : part,
  )
}

function clusterName(cluster: DictionaryCluster) {
  const zh = cluster.senses?.[0]?.translations?.zh
  if (zh && zh.length <= 12) return zh
  if (zh) return `${zh.substring(0, 10)}...`
  return cluster.label.length > 40 ? `${cluster.label.substring(0, 37)}...` : cluster.label
}

function RichText({ text }: { text: string }) {
  const normalized = text
    .replace(/\*\*(.+?)\*\*/g, '\n**$1** ')
    .trim()

  return (
    <div className="space-y-2 text-sm leading-6 text-muted-foreground">
      {normalized.split(/\n+/).filter(Boolean).map((line, lineIndex) => {
        const parts = line.split(/(\*\*.+?\*\*|`.+?`)/g).filter(Boolean)
        return (
          <p key={`${line}-${lineIndex}`}>
            {parts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={partIndex} className="font-semibold text-foreground/85">{part.slice(2, -2)}</strong>
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={partIndex} className="rounded bg-muted px-1 py-0.5 text-[12px] text-foreground/80">{part.slice(1, -1)}</code>
              }
              return <span key={partIndex}>{part}</span>
            })}
          </p>
        )
      })}
    </div>
  )
}

interface LearningInsightDialogProps {
  items: LearningInsightItem[]
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
  /** 在"我的学习库"页面使用时设为 true，隐藏保存按钮 */
  hideSaveActions?: boolean
}

export function LearningInsightDialog({
  items,
  index,
  open,
  onOpenChange,
  onIndexChange,
  hideSaveActions = false,
}: LearningInsightDialogProps) {
  const { t } = useTranslation()
  const current = items[index] ?? null
  const hasPrev = index > 0
  const hasNext = index < items.length - 1
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const touchStartX = useRef(0)

  const gotoPrev = useCallback(() => {
    if (hasPrev) onIndexChange(index - 1)
  }, [hasPrev, index, onIndexChange])

  const gotoNext = useCallback(() => {
    if (hasNext) onIndexChange(index + 1)
  }, [hasNext, index, onIndexChange])

  // 键盘导航
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') gotoPrev()
      if (event.key === 'ArrowRight') gotoNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, gotoPrev, gotoNext])

  // 触摸滑动切换
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current
      if (Math.abs(deltaX) < 50) return
      if (deltaX > 0) gotoPrev()
      else gotoNext()
    },
    [gotoPrev, gotoNext],
  )

  const selectFromPlaylist = (idx: number) => {
    onIndexChange(idx)
    setPlaylistOpen(false)
  }

  if (!current) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 pt-safe md:h-[88vh] md:max-w-3xl md:rounded-2xl md:pt-0 [&>button]:hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <DialogTitle className="sr-only">
            {current.kind === 'word' ? current.word : current.kind === 'chunk' ? current.text : current.pattern}
          </DialogTitle>
          <div className="flex h-full flex-col">
            {/* Header - 固定在顶部，关闭按钮在右侧 */}
            <InsightHeader item={current} onClose={() => onOpenChange(false)} />

            {/* Content - 中间弹性区域 */}
            <div className="flex-1 min-h-0">
              {current.kind === 'word' && <WordInsight item={current} hideSave={hideSaveActions} />}
              {current.kind === 'chunk' && <ChunkInsightView item={current} hideSave={hideSaveActions} />}
              {current.kind === 'pattern' && <PatternInsightView item={current} hideSave={hideSaveActions} />}
            </div>

            {/* Footer - 固定在底部 */}
            <div className={cn('flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3', isIOS() && 'pb-safe')}>
              <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev} className="gap-1">
                <ChevronLeft className="size-4" /> {t('insight.prev')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {index + 1} / {items.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={gotoNext} disabled={!hasNext} className="gap-1">
                  {t('insight.next')} <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPlaylistOpen(true)}
                  title={t('insight.playlist')}
                >
                  <ListMusic className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 播放列表抽屉 */}
      <Drawer open={playlistOpen} onOpenChange={setPlaylistOpen}>
        <DrawerContent className="h-[100dvh] rounded-none pt-safe">
          <div className="flex items-center justify-between px-5 py-3">
            <DrawerTitle className="text-lg">{t('insight.playlist')}</DrawerTitle>
            <button
              onClick={() => setPlaylistOpen(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>
          <ScrollArea className="flex-1 px-4 pb-8">
            <div className="space-y-1">
              {items.map((item, i) => {
                const Icon = item.kind === 'word' ? BookOpen : item.kind === 'chunk' ? Layers : Sparkles
                const title =
                  item.kind === 'word' ? item.word : item.kind === 'chunk' ? item.text : item.pattern
                const isActive = i === index

                return (
                  <button
                    key={item.id}
                    onClick={() => selectFromPlaylist(i)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{title}</p>
                      {item.meaning && (
                        <p className="truncate text-xs text-muted-foreground">{item.meaning}</p>
                      )}
                    </div>
                    {isActive && (
                      <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                        {t('insight.current')}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function InsightHeader({ item, onClose }: { item: LearningInsightItem; onClose: () => void }) {
  const { t } = useTranslation()
  const Icon = item.kind === 'word' ? BookOpen : item.kind === 'chunk' ? Layers : Sparkles
  const title = item.kind === 'word' ? item.word : item.kind === 'chunk' ? item.text : item.pattern
  const subtitle = item.kind === 'word' ? item.meaning : item.meaning
  const label = item.kind === 'word' ? t('insight.vocabulary') : item.kind === 'chunk' ? t('insight.chunk') : t('insight.pattern')

  return (
    <div className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-9 md:px-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <Badge variant="secondary" className="mb-1.5">{label}</Badge>
          <h2 className="break-words text-xl font-bold leading-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        {/* 关闭按钮放在 Header 右侧 */}
        <button
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

function WordInsight({ item, hideSave = false }: { item: VocabularyInsight; hideSave?: boolean }) {
  const { t } = useTranslation()
  const [dictData, setDictData] = useState<DictionaryEntry | null | 'loading'>(null)
  const [enrichData, setEnrichData] = useState<WordEnrichmentResult | null | 'loading'>(null)
  const [activeTab, setActiveTab] = useState('meaning')
  const [showDictionary, setShowDictionary] = useState(false)
  const [dictionaryRequested, setDictionaryRequested] = useState(false)
  const [showUncommon, setShowUncommon] = useState(false)
  const [saving, setSaving] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { addWord, hasWord } = useWordsStore()

  useEffect(() => {
    setDictData(null)
    setEnrichData(null)
    setActiveTab('meaning')
    setShowDictionary(false)
    setDictionaryRequested(false)
    setShowUncommon(false)
  }, [item.word])

  useEffect(() => {
    if (!dictionaryRequested || dictData === 'loading' || dictData) return
    setDictData('loading')
    lookupManagedDictionary(item.word).then(setDictData)
  }, [dictionaryRequested, dictData, item.word])

  useEffect(() => {
    const needsFallback = !textOrEmpty(item.meaning)
      || !textOrEmpty(item.description)
      || (!textOrEmpty(item.phoneticUs) && !textOrEmpty(item.phoneticUk))
      || normalizeVocabExamples(item.examples).length === 0
    if (!needsFallback || enrichData) return
    setEnrichData('loading')
    const summary = [item.meaning, item.definitionEn].filter(Boolean).join(' | ')
    enrichWord(item.word, summary).then(setEnrichData).catch(() => setEnrichData(null))
  }, [enrichData, item.definitionEn, item.description, item.examples, item.meaning, item.word])

  const enriched = enrichData !== 'loading' ? enrichData : null
  const localExamples = normalizeVocabExamples(item.examples)
  const fallbackExamples = !localExamples.length && enriched?.examples?.length ? enriched.examples : []
  const examples = localExamples.length ? localExamples : fallbackExamples
  const definitionEntries = parseVocabularyDefinitions(item.definitionEn)
  const meaningText = textOrEmpty(item.meaning)
    || textOrEmpty((item as any).translation)
    || textOrEmpty((item as any).definitionZh)
    || textOrEmpty((item as any).zh)
    || textOrEmpty(enriched?.chineseTranslation)
  const descriptionText = textOrEmpty(item.description)
  const fallbackPhonetic = textOrEmpty(enriched?.phonetic)
  const usPhonetic = textOrEmpty(item.phoneticUs) || fallbackPhonetic
  const ukPhonetic = textOrEmpty(item.phoneticUk)
  const usAudio = item.audioUsUrl || enriched?.audioUrl
  const ukAudio = item.audioUkUrl
  const dictEntry = dictData !== 'loading' ? dictData : null
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
    toast.success(saved ? t('insight.alreadyInVocab') : t('insight.addToVocab'))
    setSaving(false)
  }

  const openDictionary = () => {
    setDictionaryRequested(true)
    setShowDictionary(true)
  }

  const changeTab = (value: string) => {
    setActiveTab(value)
    if (value !== 'meaning') setShowDictionary(false)
  }

  return (
    <Tabs value={activeTab} onValueChange={changeTab} className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 md:px-6">
        <TabsList>
          <TabsTrigger value="meaning">{t('insight.meaning')}</TabsTrigger>
          <TabsTrigger value="examples">{t('insight.examples')}</TabsTrigger>
        </TabsList>
        {activeTab === 'meaning' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={showDictionary ? () => setShowDictionary(false) : openDictionary}
            className="h-9 shrink-0 gap-1.5 rounded-md px-2.5 text-xs"
          >
            <ArrowLeftRight className="size-3.5" />
            {showDictionary ? '返回释义' : '查看词典'}
          </Button>
        )}
      </div>
      {activeTab === 'meaning' && !showDictionary && (usPhonetic || ukPhonetic || item.partOfSpeech || item.difficulty) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 pt-2 md:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {usPhonetic && <PhoneticPill label="美式" value={usPhonetic} audioUrl={usAudio} onPlay={playAudio} />}
            {ukPhonetic && <PhoneticPill label="英式" value={ukPhonetic} audioUrl={ukAudio} onPlay={playAudio} />}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {item.partOfSpeech && (
              <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-xs font-bold">
                {POS_LABELS_CN[item.partOfSpeech] || posShortLabel(item.partOfSpeech) || item.partOfSpeech}
              </Badge>
            )}
            {item.difficulty && (
              <Badge variant="outline" className="rounded-md px-1.5 py-0.5 text-xs font-medium">
                {item.difficulty}
              </Badge>
            )}
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <TabsContent value="meaning" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          {showDictionary ? (
            <ScrollArea className="h-full">
              <div className="space-y-4 py-4">
                {dictData === 'loading' ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : dictEntry ? (
                  <ManagedDictionaryView
                    entry={dictEntry}
                    showUncommon={showUncommon}
                    onToggleUncommon={() => setShowUncommon((value) => !value)}
                    onPlay={playAudio}
                  />
                ) : (
                  <p className="rounded-md border border-border/70 bg-background p-4 text-sm text-muted-foreground">暂无释义</p>
                )}
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-4 py-4">
                <section className="overflow-hidden rounded-md border border-border/70 bg-background">
                  {definitionEntries.length > 0 ? (
                    <div className="divide-y divide-border/60">
                      {definitionEntries.map((definition, index) => (
                        <div key={`${definition.partOfSpeech}-${index}`} className="px-4 py-3.5">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 min-w-5 text-right text-xs tabular-nums text-muted-foreground/45">{index + 1}.</span>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {definition.label && (
                                  <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-xs font-bold">
                                    {definition.label}
                                  </Badge>
                                )}
                                <p className="text-sm font-medium leading-6 text-foreground">
                                  {definition.chineseGloss || definition.definition}
                                </p>
                              </div>
                              {definition.definition && definition.chineseGloss && (
                                <p className="text-xs leading-5 text-muted-foreground">{definition.definition}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : enriched?.meanings?.length ? (
                    <div className="divide-y divide-border/60">
                      {enriched.meanings.slice(0, 8).map((meaning, index) => (
                        <div key={`${meaning.partOfSpeech}-${index}`} className="px-4 py-3.5">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 min-w-5 text-right text-xs tabular-nums text-muted-foreground/45">{index + 1}.</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-xs font-bold">{posShortLabel(meaning.partOfSpeech) || meaning.partOfSpeech}</Badge>
                                <p className="text-sm font-medium leading-6 text-foreground">{meaning.chineseGloss}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : meaningText ? (
                    <p className="px-4 py-4 text-sm font-medium leading-6 text-foreground">
                      {meaningText}
                    </p>
                  ) : null}

                  <div className="border-t border-border/60 px-4 py-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <FileText className="size-4" /> 讲解/描述
                    </h3>
                    {descriptionText ? (
                      <RichText text={descriptionText} />
                    ) : enriched?.memoryTip ? (
                      <p className="text-sm leading-6 text-muted-foreground">{enriched.memoryTip}</p>
                    ) : enrichData === 'loading' ? (
                      <Skeleton className="h-16 w-full rounded-md" />
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无讲解/描述</p>
                    )}
                  </div>

                  {!hideSave && (
                    <div className="border-t border-border/60 px-4 py-3">
                      <Button size="sm" onClick={saveWord} disabled={saving} className="gap-1.5">
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <BookmarkPlus className="size-4" />}
                        {saved ? t('insight.alreadyAdded') : t('insight.addToVocab')}
                      </Button>
                    </div>
                  )}
                </section>
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="examples" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 py-4">
              {enrichData === 'loading' && examples.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : examples.length ? (
                examples.slice(0, 6).map((example, index) => (
                  <ExampleBlock key={index} en={example.en} zh={example.zh} note={example.note ?? undefined} level={example.level} />
                ))
              ) : (
                <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">{t('insight.noExamples')}</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </div>
    </Tabs>
  )
}

function PhoneticPill({
  label,
  value,
  audioUrl,
  onPlay,
}: {
  label: '美式' | '英式'
  value: string
  audioUrl?: string | null
  onPlay: (url: string) => void
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-muted px-2.5 font-mono text-xs text-muted-foreground">
      <span className="font-sans text-[10px] font-semibold text-foreground/70">{label}</span>
      <span>{value}</span>
      {audioUrl && (
        <button
          type="button"
          onClick={() => onPlay(audioUrl)}
          className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label={`${label}发音`}
        >
          <Volume2 className="size-3.5" />
        </button>
      )}
    </span>
  )
}

function ManagedDictionaryView({
  entry,
  showUncommon,
  onToggleUncommon,
  onPlay,
}: {
  entry: DictionaryEntry
  showUncommon: boolean
  onToggleUncommon: () => void
  onPlay: (url: string) => void
}) {
  const ukPron = entry.pronunciations?.find((p) => p.type === 'uk' && p.isPreferred)
    ?? entry.pronunciations?.find((p) => p.type === 'uk')
  const usPron = entry.pronunciations?.find((p) => p.type === 'us' && p.isPreferred)
    ?? entry.pronunciations?.find((p) => p.type === 'us')
  const clusters = (entry.senseClusters ?? [])
    .slice()
    .sort((a, b) => a.rank - b.rank)
  const allSenseCount = clusters.reduce((sum, cluster) => sum + (cluster.senses?.length ?? 0), 0)
  const dictionaryExamples = clusters
    .flatMap((cluster) => cluster.senses ?? [])
    .filter((sense) => showUncommon || sense.frequency !== 'uncommon')
    .flatMap((sense) => sense.examples ?? [])
    .filter((example) => example.en?.trim())
  const uncommonCount = clusters
    .flatMap((cluster) => cluster.senses ?? [])
    .filter((sense) => sense.frequency === 'uncommon').length

  return (
    <div className="overflow-hidden rounded-md border border-border/70 bg-background">
      <section className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-xl font-bold leading-tight text-foreground">{entry.word}</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {usPron?.ipa && <PhoneticPill label="美式" value={usPron.ipa} audioUrl={usPron.audioUrl} onPlay={onPlay} />}
          {ukPron?.ipa && <PhoneticPill label="英式" value={ukPron.ipa} audioUrl={ukPron.audioUrl} onPlay={onPlay} />}
          {!usPron?.ipa && !ukPron?.ipa && <span className="text-sm text-muted-foreground">暂无词典音标</span>}
        </div>

        {entry.wordForms?.length > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground/60">变形</span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              {entry.wordForms.slice(0, 10).map((form) => (
                <span key={`${form.word}-${form.tags.join('-')}`} className="inline-flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-foreground/85">{form.word}</span>
                  {form.tags?.length > 0 && <span className="text-[11px] text-muted-foreground/55">{form.tags.join(', ')}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {entry.entrySynonyms?.length > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground/60">近义</span>
            <p className="text-[13px] leading-5 text-foreground/70">
              {entry.entrySynonyms.slice(0, 16).join(', ')}
              {entry.entrySynonyms.length > 16 && <span className="text-muted-foreground/45"> +{entry.entrySynonyms.length - 16}</span>}
            </p>
          </div>
        )}
      </section>

      {clusters.length > 0 ? (
        <div className="divide-y divide-border/60">
          {clusters.map((cluster) => (
            <DictionaryClusterSection key={cluster.id} cluster={cluster} showUncommon={showUncommon} />
          ))}
        </div>
      ) : (
        <DictionaryEmptyState text="暂无释义" />
      )}

      {dictionaryExamples.length > 0 && (
        <section className="border-t border-border/60 px-4 py-4">
          <h4 className="mb-3 text-sm font-semibold text-foreground">词典例句</h4>
          <div className="space-y-3">
            {dictionaryExamples.slice(0, 6).map((example, index) => (
              <div key={`${example.en}-${index}`} className="rounded-md bg-muted/45 p-3">
                <p className="text-xs italic leading-5 text-muted-foreground/85">{highlightWord(example.en, entry.word)}</p>
                {example.zh && <p className="mt-1 text-[11px] leading-4 text-muted-foreground/70">{highlightWord(example.zh, entry.word)}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground/55">
        <div className="flex flex-wrap items-center gap-2">
          <span>{allSenseCount} 个义项</span>
          {uncommonCount > 0 && (
            <button
              type="button"
              onClick={onToggleUncommon}
              className="rounded border border-border/60 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {showUncommon ? '隐藏不常用' : `显示不常用 ${uncommonCount}`}
            </button>
          )}
        </div>
        {entry.sourceUrl ? (
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-3" />
            Wiktionary CC BY-SA 4.0
          </a>
        ) : (
          <span>内容来自后台词典</span>
        )}
      </div>
    </div>
  )
}

function DictionaryEmptyState({ text }: { text: string }) {
  return (
    <p className="border-t border-border/60 px-4 py-4 text-sm text-muted-foreground">{text}</p>
  )
}

function DictionaryClusterSection({ cluster, showUncommon }: { cluster: DictionaryCluster; showUncommon: boolean }) {
  const commonSenses = cluster.senses.filter((sense) => sense.frequency !== 'uncommon')
  const senses = showUncommon ? cluster.senses : commonSenses
  const cnLabel = POS_LABELS_CN[cluster.posBucket] ?? ''
  const enLabel = POS_LABELS[cluster.posBucket] ?? cluster.posBucket

  return (
    <section className="px-4 py-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-xs font-bold">{cnLabel || enLabel}</Badge>
        <span className="text-[11px] leading-4 text-muted-foreground/70">{clusterName(cluster)}</span>
        {cluster.senses.length > 1 && <span className="text-[11px] text-muted-foreground/45">{cluster.senses.length} 义</span>}
      </div>
      {senses.length > 0 ? (
        <div className="space-y-3">
          {senses.map((sense, index) => (
            <DictionarySenseRow key={sense.id} sense={sense} index={index + 1} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无常用释义</p>
      )}
    </section>
  )
}

function DictionarySenseRow({ sense, index }: { sense: DictionarySense; index: number }) {
  const { qualifiers: zhQuals, text: cleanZh } = parseZhQualifiers(sense.translations?.zh ?? '')
  const { qualifiers: enQuals, text: cleanEn } = parseEnQualifiers(sense.definition ?? '')

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 min-w-5 text-right text-xs tabular-nums text-muted-foreground/45">{index}.</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <p className="text-sm font-medium leading-6 text-foreground">{cleanZh || sense.definition.substring(0, 80)}</p>
            {zhQuals.map((qualifier) => (
              <span key={qualifier} className="rounded border border-border/60 px-1 py-0 text-[10px] leading-4 text-muted-foreground">
                {qualifier}
              </span>
            ))}
            {sense.frequency === 'uncommon' && (
              <span className="rounded bg-muted px-1 py-0 text-[10px] leading-4 text-muted-foreground/65">不常用</span>
            )}
          </div>
          {sense.definition && (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <p className="text-xs leading-5 text-muted-foreground">{cleanEn}</p>
              {enQuals.map((qualifier) => (
                <span key={qualifier} className="rounded border border-border/60 px-1 py-0 text-[10px] leading-4 text-muted-foreground">
                  {qualifier}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {(sense.synonyms.length > 0 || sense.antonyms.length > 0) && (
        <div className="ml-7 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground/60">
          {sense.synonyms.length > 0 && <span><span className="font-medium">近</span> {sense.synonyms.slice(0, 5).join(' · ')}</span>}
          {sense.antonyms.length > 0 && <span><span className="font-medium">反</span> {sense.antonyms.slice(0, 5).join(' · ')}</span>}
        </div>
      )}
    </div>
  )
}

function ChunkInsightView({ item, hideSave = false }: { item: ChunkInsight; hideSave?: boolean }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(item.saved ?? false)

  const saveChunk = async () => {
    if (saved) return
    setSaving(true)
    try {
      await expressionApi.create({
        type: 'chunk',
        chunkText: item.text,
        corrected: item.text,
        original: item.meaning,
        sceneName: item.sceneName,
      })
      setSaved(true)
      toast.success(t('insight.savedToLibrary'))
    } catch {
      toast.error(t('insight.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 px-5 py-5 md:px-6">
        {!hideSave && (
        <Button
          onClick={saveChunk}
          disabled={saved || saving}
          variant={saved ? 'secondary' : 'default'}
          className="gap-1.5"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saved ? t('insight.savedToLibrary') : t('insight.saveToLibrary')}
        </Button>
        )}

        {item.description && (
          <section className="rounded-xl bg-muted p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t('insight.usageGuide')}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </section>
        )}

        <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t('insight.examples')}</h3>
          {item.examples?.length ? (
            item.examples.map((example, index) => (
              <ExampleBlock
                key={index}
                en={example.en}
                zh={example.zh}
                note={example.note ?? undefined}
                level={example.level}
              />
            ))
          ) : (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t('insight.noExamplesConfig')}</p>
          )}
        </section>
      </div>
    </ScrollArea>
  )
}

function PatternInsightView({ item, hideSave = false }: { item: PatternInsight; hideSave?: boolean }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(item.saved ?? false)
  const slotText = useMemo(() => item.slots?.filter(Boolean).join(' / '), [item.slots])

  const savePattern = async () => {
    if (saved) return
    setSaving(true)
    try {
      await expressionApi.create({
        type: 'scene_phrase',
        chunkText: item.pattern,
        corrected: item.example || item.pattern,
        original: item.meaning,
        sceneName: item.sceneName,
      })
      setSaved(true)
      toast.success(t('insight.savedToLibrary'))
    } catch {
      toast.error(t('insight.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 px-5 py-5 md:px-6">
        {!hideSave && (
        <Button
          onClick={savePattern}
          disabled={saved || saving}
          variant={saved ? 'secondary' : 'default'}
          className="gap-1.5"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saved ? t('insight.savedToLibrary') : t('insight.saveToLibrary')}
        </Button>
        )}

        <section className="rounded-xl border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t('insight.structure')}</h3>
          <p className="font-mono text-sm leading-relaxed text-foreground">{item.pattern}</p>
          {slotText && <p className="mt-2 text-xs text-muted-foreground">{t('insight.replaceableSlots')}{slotText}</p>}
        </section>

        {item.example && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t('insight.exampleSentence')}</h3>
            <ExampleBlock en={item.example} zh={item.meaning ?? ''} level={item.difficulty} />
          </section>
        )}
      </div>
    </ScrollArea>
  )
}

function ExampleBlock({ en, zh, note, level }: { en: string; zh?: string; note?: string; level?: string }) {
  return (
    <div className="rounded-md bg-muted/60 p-3">
      <p className="text-sm font-medium leading-relaxed text-foreground">{en}</p>
      {zh && <p className="mt-1 text-xs text-muted-foreground">{zh}</p>}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
