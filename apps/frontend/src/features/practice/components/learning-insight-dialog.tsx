import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  BookmarkPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Layers,
  ArrowLeftRight,
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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { MarkdownContent } from '@/features/system/components/markdown-content'
import { isIOS } from '@/lib/native'
import { get } from '@/lib/request'
import { enrichWord, type WordEnrichmentResult } from '@/lib/practice-ai-api'
import { learningContentRepository } from '@/lib/offline'
import { useAttemptedRequest } from '@/hooks/use-attempted-request'
import { useCachedAudio } from '@/hooks/use-cached-audio'
import type { DictionaryCluster, DictionaryEntry, DictionarySense } from '@/features/admin/api-dictionary'
import { type TopicDetail } from '../api/english-practice-api'

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
  description?: string | null
  examples?: unknown
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
  const localEntry = await learningContentRepository.getDictionaryEntry(key)
  const localData = localEntry?.data ?? localEntry
  if (localData?.word || localData?.senseClusters || localData?.senses) {
    dictionaryCache.set(key, localData as DictionaryEntry)
    return localData as DictionaryEntry
  }
  try {
    const entry = await get<DictionaryEntry>(`/dictionary/${encodeURIComponent(key)}`)
    await learningContentRepository.saveDictionaryEntry(key, entry)
    dictionaryCache.set(key, entry)
    return entry
  } catch {
    dictionaryCache.set(key, null)
    return null
  }
}

function posShortLabel(pos?: string | null) {
  if (!pos) return ''
  return POS_LABELS[pos] ?? (pos === 'adjective' ? 'adj.' : pos)
}

/** 解析 definitionEn 字段：noun: English def.  [中文释义]; verb: ... */
function parseVocabularyDefinitions(definitionEn?: string | null) {
  if (!definitionEn) return []
  const results: Array<{ partOfSpeech: string; label: string; definition: string; chineseGloss: string }> = []
  // 匹配每个词条：词性: 英文释义  [中文释义]
  const entryRe = /(\w+):\s+(.+?)\s+\[(.+?)\](?:\s*;\s*|$)/g
  let match: RegExpExecArray | null
  while ((match = entryRe.exec(definitionEn)) !== null) {
    const [, partOfSpeech, definition, chineseGloss] = match
    results.push({
      partOfSpeech,
      label: posShortLabel(partOfSpeech),
      definition: definition.trim(),
      chineseGloss: chineseGloss.trim(),
    })
  }
  return results.filter((item) => item.definition || item.chineseGloss)
}

function textOrEmpty(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeVocabExamples(value: unknown): Array<{ en: string; zh?: string; note?: string | null; level?: string; audioUrl?: string | null }> {
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
      const audioUrl = textOrEmpty(record.audioUrl) || null
      return en ? { en, ...(zh ? { zh } : {}), ...(note ? { note } : {}), ...(level ? { level } : {}), ...(audioUrl ? { audioUrl } : {}) } : null
    })
    .filter(Boolean) as Array<{ en: string; zh?: string; note?: string | null; level?: string; audioUrl?: string | null }>
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

/** 解析 description 文本中的 **标题：** 段落结构 */
function parseDescriptionSections(text: string): { title: string; body: string }[] {
  if (!text.trim()) return []

  // 按 **xxx：** 或 **xxx:** 分割（注意：冒号在 ** 内部）
  const parts = text.split(/(\*\*[^*]+\*\*\s*)/g)
  const sections: { title: string; body: string }[] = []

  for (let i = 0; i < parts.length; i++) {
    const trimmed = parts[i].trim()
    if (!trimmed) continue

    // 匹配 **标题：** 或 **标题:**
    const headerMatch = trimmed.match(/^\*\*([^*]+)\*\*$/)
    if (headerMatch) {
      // 去掉标题末尾的 ： 或 :
      const title = headerMatch[1].trim().replace(/[：:]\s*$/, '')
      const body = i + 1 < parts.length ? parts[i + 1].trim() : ''
      sections.push({ title, body })
      i++ // 跳过已消费的 body
    } else {
      // 第一个标题之前的前导文字
      sections.push({ title: '', body: trimmed })
    }
  }

  return sections
}

/** 将 body 文本拆成条目：按换行或按 "1. 2. 3." / "- " 模式 */
function splitBodyItems(body: string): { prefix?: string; content: string }[] {
  // 有换行：仅当行含列表标记时才拆成条目，否则保持为整段文本
  if (body.includes('\n')) {
    const lines = body.split(/\n+/).filter(Boolean)
    const hasListMarker = lines.some((line) => /^(\d+[.、)]\s+|[-•]\s+)/.test(line.trim()))
    if (hasListMarker) {
      return lines.map((line) => {
        const trimmed = line.trim()
        const numMatch = trimmed.match(/^(\d+)[.、)]\s+/)
        const bulletMatch = trimmed.match(/^[-•]\s+/)
        if (numMatch) return { prefix: numMatch[1], content: trimmed.slice(numMatch[0].length) }
        if (bulletMatch) return { content: trimmed.slice(bulletMatch[0].length) }
        return { content: trimmed }
      })
    }
    // 无列表标记 → 作为单段文本
    return [{ content: body.trim() }]
  }

  // 无换行但含编号列表："1. xxx 2. xxx"
  const numberedSplit = body.split(/(?=\d+[.、)]\s+)/g).filter(Boolean)
  if (numberedSplit.length > 1) {
    return numberedSplit.map((part) => {
      const trimmed = part.trim()
      const numMatch = trimmed.match(/^(\d+)[.、)]\s+/)
      if (numMatch) return { prefix: numMatch[1], content: trimmed.slice(numMatch[0].length) }
      return { content: trimmed }
    })
  }

  // 无换行但含 - 列表："- xxx - yyy"
  const bulletSplit = body.split(/(?=[-•]\s+)/g).filter(Boolean)
  if (bulletSplit.length > 1) {
    return bulletSplit.map((part) => {
      const trimmed = part.trim()
      const bulletMatch = trimmed.match(/^[-•]\s+/)
      if (bulletMatch) return { content: trimmed.slice(bulletMatch[0].length) }
      return { content: trimmed }
    })
  }

  return [{ content: body.trim() }]
}

/** 渲染 section body：单段文本、有序列表（编号）或无序列表（bullet） */
function SectionBody({ text }: { text: string }) {
  const items = splitBodyItems(text)

  if (items.length === 1 && !items[0].prefix) {
    return <p className="text-sm leading-6 text-muted-foreground">{renderInline(items[0].content)}</p>
  }

  // 全部有数字前缀 → 有序列表
  const isOrdered = items.every((item) => item.prefix)

  if (isOrdered) {
    return (
      <ol className="space-y-1.5" style={{ listStyleType: 'none', paddingLeft: 0 }}>
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <span className="shrink-0 text-right text-xs tabular-nums leading-6 text-muted-foreground/50">{item.prefix}.</span>
            <span className="min-w-0">{renderInline(item.content)}</span>
          </li>
        ))}
      </ol>
    )
  }

  // 无序列表
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <span className="mt-[7px] block size-1 shrink-0 rounded-full bg-muted-foreground/25" />
          <span className="min-w-0">{renderInline(item.content)}</span>
        </li>
      ))}
    </ul>
  )
}

/** 行内渲染：处理 `code` 和 **bold** */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*.+?\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground/85">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-muted px-1 py-0.5 text-[12px] text-foreground/80">{part.slice(1, -1)}</code>
    }
    return <span key={i}>{part}</span>
  })
}

function RichText({ text }: { text: string }) {
  if (!text.trim()) return null
  return <MarkdownContent content={text} />
}

interface LearningInsightDialogProps {
  items: LearningInsightItem[]
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
  /** 在"我的学习库"页面使用时设为 true，隐藏保存按钮 */
  hideSaveActions?: boolean
  /** 'inspect' | 'guided' | 'review' — review 模式底部显示复述输入 */
  mode?: string
}

export function LearningInsightDialog({
  items,
  index,
  open,
  onOpenChange,
  onIndexChange,
  hideSaveActions = false,
  mode,
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
          data-keyboard-overlay="practice"
          className="left-0 top-0 !z-[10000] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 pt-safe md:left-[50%] md:top-[50%] md:h-[88vh] md:max-w-3xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl md:pt-0 [&>button]:hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <DialogTitle className="sr-only">
            {current.kind === 'word' ? current.word : current.kind === 'chunk' ? current.text : current.pattern}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {current.kind === 'word' ? current.meaning : current.kind === 'chunk' ? current.meaning : ''}
          </DialogDescription>
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Header - 固定在顶部，关闭按钮在右侧 */}
            <InsightHeader item={current} onClose={() => onOpenChange(false)} />

            {/* Content - 中间弹性区域，可滚动 */}
            <div className="min-h-0 flex-1 overflow-y-auto">
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
        <DrawerContent className="h-[100dvh] rounded-none pt-safe !z-[10001]" overlayClassName="!z-[10001]">
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
  const isWord = item.kind === 'word'
  const hasBothPhonetics = isWord && item.phoneticUs && item.phoneticUk
  const [showUk, setShowUk] = useState(false)

  const { play: playAudio } = useCachedAudio()

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
          {/* 音标：切换按钮在左，音标在右 */}
          {isWord && (item.phoneticUs || item.phoneticUk) && (
            <div className="mt-2 flex items-center gap-1.5">
              {hasBothPhonetics ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowUk((prev) => !prev)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={showUk ? '切换美式' : '切换英式'}
                  >
                    <ArrowLeftRight className="size-3.5" />
                  </button>
                  <PhoneticPill
                    label={showUk ? '英' : '美'}
                    value={showUk ? item.phoneticUk! : item.phoneticUs!}
                    audioUrl={showUk ? item.audioUkUrl : item.audioUsUrl}
                    onPlay={playAudio}
                  />
                </>
              ) : (
                <PhoneticPill
                  label={item.phoneticUs ? '美' : '英'}
                  value={(item.phoneticUs || item.phoneticUk)!}
                  audioUrl={item.phoneticUs ? item.audioUsUrl : item.audioUkUrl}
                  onPlay={playAudio}
                />
              )}
            </div>
          )}
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
  const [dictionaryRequested, setDictionaryRequested] = useState(false)
  const [showUncommon, setShowUncommon] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { play: playAudio } = useCachedAudio()
  const { hasAttempted, resetAttempted, runOnce } = useAttemptedRequest()

  useEffect(() => {
    setDictData(null)
    setEnrichData(null)
    setActiveTab('meaning')
    setDictionaryRequested(false)
    resetAttempted()
    setShowUncommon(false)
  }, [item.word, resetAttempted])

  useEffect(() => {
    if (hideSave) return
    learningContentRepository.getExpressionByText('word', item.word).then((entry) => setSaved(Boolean(entry)))
  }, [hideSave, item.word])

  useEffect(() => {
    const attemptKey = `dictionary:${item.word}`
    if (!dictionaryRequested || hasAttempted(attemptKey) || dictData === 'loading' || dictData) return
    setDictData('loading')
    runOnce(attemptKey, () => lookupManagedDictionary(item.word))
      .then((result) => {
        if (result !== undefined) setDictData(result)
      })
      .catch(() => setDictData(null))
  }, [dictionaryRequested, dictData, hasAttempted, item.word, runOnce])

  useEffect(() => {
    const needsFallback = !textOrEmpty(item.meaning)
      || !textOrEmpty(item.description)
      || (!textOrEmpty(item.phoneticUs) && !textOrEmpty(item.phoneticUk))
      || normalizeVocabExamples(item.examples).length === 0
    const attemptKey = `enrich:${item.word}`
    if (!needsFallback || hasAttempted(attemptKey) || enrichData) return
    setEnrichData('loading')
    const summary = [item.meaning, item.definitionEn].filter(Boolean).join(' | ')
    runOnce(attemptKey, () => enrichWord(item.word, summary))
      .then((result) => {
        if (result !== undefined) setEnrichData(result)
      })
      .catch(() => setEnrichData(null))
  }, [enrichData, hasAttempted, item.definitionEn, item.description, item.examples, item.meaning, item.word, runOnce])

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
  const dictEntry = dictData !== 'loading' ? dictData : null

  const saveWord = async () => {
    setSaving(true)
    try {
      if (saved) {
        await learningContentRepository.deleteExpressionByTextAndSync('word', item.word)
        setSaved(false)
      } else {
        await learningContentRepository.saveExpressionEntryAndSync({
          kind: 'word',
          text: item.word,
          meaning: item.meaning,
          sceneName: item.sceneName,
          corrected: item.description,
          contentSnapshot: item,
          sourceType: 'learning-library',
        })
        setSaved(true)
        toast.success(t('insight.savedToLibrary'))
      }
    } finally {
      setSaving(false)
    }
  }

  const changeTab = (value: string) => {
    setActiveTab(value)
    if (value === 'dictionary') setDictionaryRequested(true)
  }

  return (
    <Tabs value={activeTab} onValueChange={changeTab} className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-5 pt-3 md:px-6">
        <TabsList>
          <TabsTrigger value="meaning">{t('insight.meaning')}</TabsTrigger>
          <TabsTrigger value="description">讲解</TabsTrigger>
          <TabsTrigger value="examples">{t('insight.examples')}</TabsTrigger>
          <TabsTrigger value="dictionary">词典</TabsTrigger>
        </TabsList>
        {!hideSave && (
          <Button onClick={saveWord} disabled={saving} variant={saved ? 'secondary' : 'default'} size="sm" className="ml-auto h-7 gap-1 px-2 text-[11px]">
            {saving ? <Loader2 className="size-3 animate-spin" /> : <BookmarkPlus className="size-3" />}
            {saving ? t('learning.processing') : saved ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
          </Button>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        {/* 释义 */}
        <TabsContent value="meaning" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 py-4">
              <section className="overflow-hidden rounded-md border border-border/70 bg-background">
                {definitionEntries.length > 0 ? (
                  <div className="divide-y divide-border/60">
                    {definitionEntries.map((definition, index) => {
                      const zhParsed = definition.chineseGloss ? parseZhQualifiers(definition.chineseGloss) : null
                      const qualifiers = zhParsed?.qualifiers ?? []
                      const zhText = zhParsed?.text ?? definition.chineseGloss ?? ''
                      return (
                        <div key={`${definition.partOfSpeech}-${index}`} className="px-4 py-3.5">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 text-right text-xs tabular-nums leading-6 text-muted-foreground/40">{index + 1}.</span>
                            <div className="min-w-0 flex-1">
                              {/* 中文释义 + 词性标签同行 */}
                              <div className="flex items-baseline gap-2">
                                <span className="min-w-0 flex-1">
                                  {qualifiers.length > 0 && qualifiers.map((q) => (
                                    <span key={q} className="mr-1.5 inline-flex items-center rounded border border-border/50 bg-muted/50 px-1 py-px text-[11px] leading-none text-muted-foreground">{q}</span>
                                  ))}
                                  <span className="text-sm font-medium leading-6 text-foreground">{zhText || definition.definition}</span>
                                </span>
                                {definition.label && (
                                  <span className="shrink-0 text-xs text-muted-foreground/50">{definition.label}</span>
                                )}
                              </div>
                              {definition.definition && definition.chineseGloss && (
                                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{definition.definition}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : enriched?.meanings?.length ? (
                  <div className="divide-y divide-border/60">
                    {enriched.meanings.slice(0, 8).map((meaning, index) => {
                      const zhParsed = meaning.chineseGloss ? parseZhQualifiers(meaning.chineseGloss) : null
                      const qualifiers = zhParsed?.qualifiers ?? []
                      const zhText = zhParsed?.text ?? meaning.chineseGloss ?? ''
                      return (
                        <div key={`${meaning.partOfSpeech}-${index}`} className="px-4 py-3.5">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 text-right text-xs tabular-nums leading-6 text-muted-foreground/40">{index + 1}.</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="min-w-0 flex-1">
                                  {qualifiers.length > 0 && qualifiers.map((q) => (
                                    <span key={q} className="mr-1.5 inline-flex items-center rounded border border-border/50 bg-muted/50 px-1 py-px text-[11px] leading-none text-muted-foreground">{q}</span>
                                  ))}
                                  <span className="text-sm font-medium leading-6 text-foreground">{zhText}</span>
                                </span>
                                {meaning.partOfSpeech && (
                                  <span className="shrink-0 text-xs text-muted-foreground/50">{posShortLabel(meaning.partOfSpeech) || meaning.partOfSpeech}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : meaningText ? (
                  <p className="px-4 py-4 text-sm font-medium leading-6 text-foreground">
                    {meaningText}
                  </p>
                ) : (
                  <p className="px-4 py-4 text-sm text-muted-foreground">暂无释义</p>
                )}
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* 讲解 */}
        <TabsContent value="description" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="py-4">
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
          </ScrollArea>
        </TabsContent>

        {/* 词典 */}
        <TabsContent value="dictionary" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
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
                <p className="rounded-md border border-border/70 bg-background p-4 text-sm text-muted-foreground">暂无词典数据</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* 例句 */}
        <TabsContent value="examples" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 py-4">
              {enrichData === 'loading' && examples.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : examples.length ? (
                examples.slice(0, 6).map((example, index) => (
                  <ExampleBlock key={index} en={example.en} zh={example.zh} note={example.note ?? undefined} level={example.level} audioUrl={example.audioUrl} onPlayAudio={playAudio} />
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
  label: '美' | '英'
  value: string
  audioUrl?: string | null
  onPlay: (url: string) => void
}) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 font-mono text-[11px] text-muted-foreground">
      <span className="font-sans text-[10px] font-semibold text-foreground/70">{label}</span>
      <span>{value}</span>
      {audioUrl && (
        <button
          type="button"
          onClick={() => onPlay(audioUrl)}
          className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label={`${label}发音`}
        >
          <Volume2 className="size-3" />
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xl font-bold leading-tight text-foreground">{entry.word}</h3>
          {uncommonCount > 0 && (
            <button
              type="button"
              onClick={onToggleUncommon}
              className="shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {showUncommon ? '隐藏不常用' : `显示不常用 ${uncommonCount}`}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {false && usPron?.ipa && <PhoneticPill label="美" value={usPron.ipa} audioUrl={usPron.audioUrl} onPlay={onPlay} />}
          {false && ukPron?.ipa && <PhoneticPill label="英" value={ukPron.ipa} audioUrl={ukPron.audioUrl} onPlay={onPlay} />}
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
        <span>{allSenseCount} 个义项</span>
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
  const [activeTab, setActiveTab] = useState('description')
  const { play: playAudio } = useCachedAudio()

  const saveChunk = async () => {
    if (saved) return
    setSaving(true)
    setSaved(true)
    await learningContentRepository.saveExpressionEntryAndSync({
      kind: 'chunk',
      text: item.text,
      meaning: item.meaning,
      sceneName: item.sceneName,
      contentSnapshot: item,
      sourceType: 'learning-library',
    })
    toast.success(t('insight.savedToLibrary'))
    setSaving(false)
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-5 pt-3 md:px-6">
        <TabsList>
          <TabsTrigger value="description">讲解</TabsTrigger>
          <TabsTrigger value="examples">{t('insight.examples')}</TabsTrigger>
        </TabsList>
        {!hideSave && (
          <Button onClick={saveChunk} disabled={saving} variant={saved ? 'secondary' : 'default'} size="sm" className="ml-auto h-7 gap-1 px-2 text-[11px]">
            {saving ? <Loader2 className="size-3 animate-spin" /> : <BookmarkPlus className="size-3" />}
            {saving ? t('learning.processing') : saved ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
          </Button>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <TabsContent value="description" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="py-4">
              {item.description ? <RichText text={item.description} /> : <p className="text-sm text-muted-foreground">暂无讲解</p>}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="examples" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 py-4">
              {item.examples?.length ? (
                item.examples.map((ex, i) => <ExampleBlock key={i} en={ex.en} zh={ex.zh} note={ex.note ?? undefined} level={ex.level} audioUrl={(ex as any).audioUrl} onPlayAudio={playAudio} />)
              ) : (
                <p className="text-sm text-muted-foreground">{t('insight.noExamplesConfig')}</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </div>
    </Tabs>
  )
}

function PatternInsightView({ item, hideSave = false }: { item: PatternInsight; hideSave?: boolean }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(item.saved ?? false)
  const slotText = useMemo(() => item.slots?.filter(Boolean).join(' / '), [item.slots])
  const examples = useMemo(() => normalizeVocabExamples(item.examples), [item.examples])
  const [activeTab, setActiveTab] = useState('structure')
  const { play: playAudio } = useCachedAudio()

  const savePattern = async () => {
    if (saved) return
    setSaving(true)
    setSaved(true)
    await learningContentRepository.saveExpressionEntryAndSync({
      kind: 'pattern', text: item.pattern, meaning: item.meaning,
      sceneName: item.sceneName, corrected: item.example,
      contentSnapshot: item, sourceType: 'learning-library',
    })
    toast.success(t('insight.savedToLibrary'))
    setSaving(false)
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-5 pt-3 md:px-6">
        <TabsList>
          <TabsTrigger value="structure">结构</TabsTrigger>
          <TabsTrigger value="description">讲解</TabsTrigger>
          <TabsTrigger value="examples">{t('insight.examples')}</TabsTrigger>
        </TabsList>
        {!hideSave && (
          <Button onClick={savePattern} disabled={saving} variant={saved ? 'secondary' : 'default'} size="sm" className="ml-auto h-7 gap-1 px-2 text-[11px]">
            {saving ? <Loader2 className="size-3 animate-spin" /> : <BookmarkPlus className="size-3" />}
            {saving ? t('learning.processing') : saved ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
          </Button>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <TabsContent value="structure" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 py-4">
              <section className="rounded-xl border border-border p-4">
                <p className="font-mono text-sm leading-relaxed text-foreground">{item.pattern}</p>
                {slotText && <p className="mt-2 text-xs text-muted-foreground">可替换部分：{slotText}</p>}
                {item.meaning && <p className="mt-1.5 text-sm text-muted-foreground">{item.meaning}</p>}
              </section>
              {item.example && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t('insight.exampleSentence')}</h3>
                  <ExampleBlock en={item.example} zh={item.meaning ?? ''} level={item.difficulty} />
                </section>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="description" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="py-4">
              {item.description ? <RichText text={item.description} /> : <p className="text-sm text-muted-foreground">暂无讲解</p>}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="examples" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 py-4">
              {examples.length > 0 ? (
                examples.map((ex, i) => <ExampleBlock key={i} en={ex.en} zh={ex.zh} note={ex.note ?? undefined} level={ex.level} audioUrl={ex.audioUrl} onPlayAudio={playAudio} />)
              ) : (
                <p className="text-sm text-muted-foreground">{t('insight.noExamplesConfig')}</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </div>
    </Tabs>
  )
}

function ExampleBlock({ en, zh, note, level, audioUrl, onPlayAudio }: {
  en: string
  zh?: string
  note?: string
  level?: string
  audioUrl?: string | null
  onPlayAudio?: (url: string) => void
}) {
  return (
    <div className="rounded-md bg-muted/60 p-3">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-foreground">{en}</p>
        {audioUrl && onPlayAudio && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPlayAudio(audioUrl) }}
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            aria-label="播放例句发音"
          >
            <Volume2 className="size-3.5" />
          </button>
        )}
      </div>
      {zh && <p className="mt-1 text-xs text-muted-foreground">{zh}</p>}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
