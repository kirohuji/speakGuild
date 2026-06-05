import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  BookmarkPlus,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
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
        ? data
            .flatMap((entry) => entry.meanings)
            .slice(0, 3)
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
    toast.success(saved ? t('insight.alreadyInVocab') : t('insight.addToVocab'))
    setSaving(false)
  }

  return (
    <Tabs defaultValue="meaning" className="flex h-full flex-col">
      {/* 固定在 Content 顶部的 Tab 栏 */}
      <div className="shrink-0 px-5 pt-3 md:px-6">
        <TabsList>
          <TabsTrigger value="meaning">{t('insight.meaning')}</TabsTrigger>
          <TabsTrigger value="examples">{t('insight.examples')}</TabsTrigger>
        </TabsList>
      </div>

      {/* Tab 内容区：relative 容器 + absolute 叠加，避免 flex 布局冲突 */}
      <div className="flex-1 min-h-0 relative">
        {/* 释义 Tab */}
        <TabsContent value="meaning" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="space-y-5 py-3">
              {/* 音标 / 发音 / 生词本 */}
              <div className="flex flex-wrap items-center gap-2">
                {phonetic && (
                  <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-muted-foreground">
                    {phonetic}
                  </span>
                )}
                {audioUrl && (
                  <Button variant="outline" size="sm" onClick={() => playAudio(audioUrl)} className="gap-1.5">
                    <Volume2 className="size-4" /> {t('insight.pronunciation')}
                  </Button>
                )}
                {!hideSave && (
                <Button size="sm" onClick={saveWord} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <BookmarkPlus className="size-4" />}
                  {saved ? t('insight.alreadyAdded') : t('insight.addToVocab')}
                </Button>
                )}
              </div>

              {/* 记忆提示 */}
              {enrichData === 'loading' ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : enriched?.memoryTip ? (
                <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <Brain className="mt-0.5 size-4 shrink-0" />
                  <span>{t('insight.memoryTip')}：{enriched.memoryTip}</span>
                </div>
              ) : null}

              {/* 词典释义 */}
              {dictData === 'loading' ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : meanings.length > 0 ? (
                <div className="space-y-3">
                  {meanings.slice(0, 5).map((meaning, index) => (
                    <div key={`${meaning.partOfSpeech}-${index}`} className="rounded-xl border border-border p-3">
                      <Badge variant="outline" className="mb-2">
                        {meaning.partOfSpeech}
                      </Badge>
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
                <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                  {item.meaning ?? t('insight.noDefinition')}
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* 例句 Tab */}
        <TabsContent value="examples" className="absolute inset-0 mt-0 overflow-hidden px-5 md:px-6 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 py-4">
              {enrichData === 'loading' ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : enriched?.examples?.length ? (
                enriched.examples.slice(0, 6).map((example, index) => (
                  <ExampleBlock
                    key={index}
                    en={example.en}
                    zh={example.zh}
                    note={example.note}
                    level={example.level}
                  />
                ))
              ) : (
                <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                  {t('insight.noExamples')}
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </div>
    </Tabs>
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
