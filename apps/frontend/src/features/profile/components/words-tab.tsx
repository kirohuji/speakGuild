import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search, Volume2, Loader2, ChevronLeft, ChevronRight, Calendar, SortAsc,
  Sparkles, BookOpen, ExternalLink, Brain, BarChart2, CheckSquare,
  GraduationCap, CheckCircle2, Lightbulb, Link2, X, Star, BookMarked,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import {
  lookupWord, getBestPhonetic, getFirstAudio,
  type DictEntry, type Meaning,
} from '@/lib/dictionary-api'
import { enrichWord, type WordEnrichmentResult, type WordExampleItem } from '@/lib/practice-ai-api'
import { synthesizeText } from '@/lib/tts-api'
import { usePreferencesStore } from '@/stores/preferences.store'
import { learningContentRepository } from '@/lib/offline'

// ─── Types ──────────────────────────────────────────────────────────────────

type GroupMode = 'date' | 'alpha'

type SavedWordEntry = {
  word: string
  addedAt: string
}

function getDateLabel(iso: string, t: (key: string, options?: any) => string): string {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return t('profile.wordToday')
  if (diffDays === 1) return t('profile.wordYesterday')
  if (diffDays < 7) return t('profile.wordDaysAgo', { count: diffDays })
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function groupEntries(entries: SavedWordEntry[], mode: GroupMode, t: (key: string, opts?: any) => string) {
  if (mode === 'alpha') {
    const map = new Map<string, SavedWordEntry[]>()
    for (const e of [...entries].sort((a, b) => a.word.localeCompare(b.word))) {
      const letter = e.word[0]?.toUpperCase() ?? '#'
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter)!.push(e)
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  }
  const map = new Map<string, SavedWordEntry[]>()
  for (const e of [...entries].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  )) {
    const label = getDateLabel(e.addedAt, t)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(e)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

const POS_COLORS: Record<string, string> = {
  noun: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  verb: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  adjective: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  adverb: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  pronoun: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  preposition: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  conjunction: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}

// ─── MeaningSection ─────────────────────────────────────────────────────────

function MeaningSection({ meaning, chineseGloss }: { meaning: Meaning; chineseGloss?: string }) {
  const { t } = useTranslation()
  const posColor = POS_COLORS[meaning.partOfSpeech] ?? 'bg-muted text-muted-foreground'
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)

  const speakExample = (text: string, idx: number) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'en-US'; utt.rate = 0.9
    setPlayingIdx(idx)
    utt.onend = () => setPlayingIdx(null)
    window.speechSynthesis.speak(utt)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', posColor)}>
          {meaning.partOfSpeech}
        </span>
        {chineseGloss && (
          <span className="text-sm text-muted-foreground">{chineseGloss}</span>
        )}
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3">
        {meaning.definitions.slice(0, 5).map((def, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">{def.definition}</p>
            </div>
            {def.example && (
              <div className="ml-7 flex items-start gap-2 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 px-3 py-2 border border-blue-100 dark:border-blue-900/30">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                <p className="flex-1 text-sm italic text-blue-800 dark:text-blue-300 leading-relaxed">"{def.example}"</p>
                <button type="button" onClick={() => speakExample(def.example!, i)}
                  className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors">
                  {playingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
            {(def.synonyms.length > 0 || def.antonyms.length > 0) && (
              <div className="ml-7 flex flex-wrap gap-3 text-xs">
                {def.synonyms.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">{t('profile.synonymLabel')}</span>
                    {def.synonyms.slice(0, 5).map((s) => (
                      <span key={s} className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{s}</span>
                    ))}
                  </div>
                )}
                {def.antonyms.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">{t('profile.antonymLabel')}</span>
                    {def.antonyms.slice(0, 4).map((a) => (
                      <span key={a} className="rounded-md bg-red-50 px-1.5 py-0.5 text-red-700 dark:bg-red-900/20 dark:text-red-300">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function useLevelConfig() {
  const { t } = useTranslation()
  return {
    basic: { label: t('profile.levelBasic'), color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    intermediate: { label: t('profile.levelIntermediate'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    advanced: { label: t('profile.levelAdvanced'), color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  }
}

// ─── ExampleCard ────────────────────────────────────────────────────────────

function ExampleCard({ ex, idx }: { ex: WordExampleItem; idx: number }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cachedUrlRef = useRef<string | null>(null)
  const { ttsBackend, setTtsBackend } = usePreferencesStore()
  const levelConfig = useLevelConfig()
  const cfg = levelConfig[ex.level]
  const isMiniMax = ttsBackend.provider === 'minimax'

  const toggleTtsProvider = () => {
    if (isMiniMax) {
      setTtsBackend({
        provider: 'cartesia',
        model: 'sonic-3',
        voiceId: '79a125e8-cd45-4c13-8a67-188112f4dd22',
        params: { speed: 1, volume: 1 },
      })
      return
    }
    setTtsBackend({
      provider: 'minimax',
      model: 'speech-2.8-hd',
      voiceId: 'English_Trustworthy_Man',
      params: { speed: 1, vol: 1, pitch: 0 },
    })
  }

  const handleSpeak = async () => {
    if (state === 'loading') return

    if (cachedUrlRef.current) {
      audioRef.current?.play()
      return
    }

    setState('loading')
    try {
      const result = await synthesizeText({
        text: ex.en,
        provider: ttsBackend.provider,
        model: ttsBackend.model,
        voiceId: ttsBackend.voiceId,
        params: ttsBackend.params,
      })
      const url = `data:${result.mimeType};base64,${result.audioBase64}`
      cachedUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onplay = () => setState('playing')
      audio.onended = () => setState('idle')
      audio.onerror = () => setState('error')
      await audio.play()
    } catch {
      setState('error')
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t('profile.exampleLabel', { count: idx + 1 })}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.color)}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTtsProvider}
            className="rounded-full border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            title={t('profile.switchEngine')}
          >
            {isMiniMax ? 'MiniMax' : 'Cartesia'}
          </button>
          <button type="button" onClick={handleSpeak}
            disabled={state === 'loading'}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 transition-colors disabled:opacity-60">
            {state === 'loading'
              ? <><Loader2 className="h-3 w-3 animate-spin" />{t('profile.synthesizing')}</>
              : state === 'playing'
              ? <><Volume2 className="h-3 w-3" />{t('profile.playing')}</>
              : state === 'error'
              ? <><Volume2 className="h-3 w-3 text-destructive" />{t('profile.retry')}</>
              : <><Volume2 className="h-3 w-3" />{t('profile.play')}</>}
          </button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm font-medium leading-relaxed">{ex.en}</p>
        {ex.zh ? (
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">{ex.zh}</p>
        ) : null}
        {ex.note && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />{ex.note}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── WordDetailDialog ───────────────────────────────────────────────────────

function WordDetailDialog({
  entry, onClose, onPrev, onNext, hasPrev, hasNext,
}: {
  entry: SavedWordEntry | null
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  const { t } = useTranslation()
  const [dictData, setDictData] = useState<DictEntry[] | null | 'loading'>(null)
  const [enrichData, setEnrichData] = useState<WordEnrichmentResult | null | 'loading'>(null)
  const [enrichError, setEnrichError] = useState('')
  const [activeTab, setActiveTab] = useState<'meanings' | 'examples' | 'synonyms'>('meanings')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!entry) return
    setDictData('loading')
    setEnrichData('loading')
    setEnrichError('')
    setActiveTab('meanings')

    lookupWord(entry.word).then((data) => {
      setDictData(data)
      const summary = data
        ? data.flatMap(e => e.meanings).slice(0, 3)
            .map(m => `${m.partOfSpeech}: ${m.definitions[0]?.definition ?? ''}`)
            .join(' | ')
        : undefined
      enrichWord(entry.word, summary)
        .then(setEnrichData)
        .catch((e) => { setEnrichData(null); setEnrichError(e?.message ?? t('common.error')) })
    })
  }, [entry?.word])

  const playAudio = useCallback((url: string) => {
    audioRef.current?.pause()
    const a = new Audio(url.startsWith('//') ? 'https:' + url : url)
    audioRef.current = a
    a.play().catch(() => {})
  }, [])

  if (!entry) return null

  const dictEntries = Array.isArray(dictData) ? dictData : []
  const mainEntry = dictEntries[0]
  const phonetic = mainEntry ? getBestPhonetic(mainEntry) : null
  const phonetics = mainEntry?.phonetics.filter(p => p.text || p.audio) ?? []
  const audioUrl = mainEntry ? getFirstAudio(mainEntry.phonetics) : null
  const enriched = enrichData !== 'loading' && enrichData !== null ? enrichData : null
  const allMeanings = dictEntries.flatMap(e => e.meanings)

  const posGlossMap = new Map(
    (enriched?.meanings ?? []).map(m => [m.partOfSpeech, m.chineseGloss])
  )

  const allSynonyms = [...new Set(allMeanings.flatMap(m => [...m.synonyms, ...m.definitions.flatMap(d => d.synonyms)]))]
  const allAntonyms = [...new Set(allMeanings.flatMap(m => [...m.antonyms, ...m.definitions.flatMap(d => d.antonyms)]))]

  return (
    <Dialog open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="h-[100dvh] w-screen max-w-none flex flex-col p-0 gap-0 overflow-hidden rounded-none md:h-[90vh] md:max-w-4xl md:rounded-2xl [&>button]:hidden">

        {/* Header */}
        <div className="relative border-b border-border/50 bg-gradient-to-br from-primary/5 to-background px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{entry.word}</h1>
                {enriched?.chineseTranslation ? (
                  <span className="text-lg text-muted-foreground">{enriched.chineseTranslation}</span>
                ) : enrichData === 'loading' ? (
                  <Skeleton className="h-6 w-24 inline-block" />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {phonetics.length > 0 ? phonetics.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {p.text && <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{p.text}</span>}
                    {p.audio && (
                      <button type="button" onClick={() => playAudio(p.audio!)}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20 transition-colors">
                        <Volume2 className="h-3 w-3" />{i === 0 ? 'UK' : i === 1 ? 'US' : t('profile.pronounce')}
                      </button>
                    )}
                  </div>
                )) : phonetic ? (
                  <span className="font-mono text-sm text-muted-foreground">{phonetic}</span>
                ) : null}
                {audioUrl && !phonetics.some(p => p.audio) && (
                  <button type="button" onClick={() => playAudio(audioUrl)}
                    className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 transition-colors">
                    <Volume2 className="h-3.5 w-3.5" />{t('profile.pronounce')}
                  </button>
                )}
              </div>

              {enriched?.memoryTip && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2 w-fit">
                  <Brain className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-amber-800 dark:text-amber-300">{enriched.memoryTip}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
              title={t('profile.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {mainEntry?.origin && (
            <div className="mt-3 flex items-start gap-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium">{t('profile.origin')}</span>{mainEntry.origin}
              </p>
            </div>
          )}
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-1 border-b border-border/50 px-6 bg-muted/20">
          {([
            { key: 'meanings', icon: BookOpen, label: t('profile.tabMeanings'), count: allMeanings.length },
            { key: 'examples', icon: GraduationCap, label: t('profile.tabExamples'), count: enriched?.examples.length ?? 0 },
            { key: 'synonyms', icon: BarChart2, label: t('profile.tabSynonyms'), count: allSynonyms.length + allAntonyms.length },
          ] as const).map(({ key, icon: Icon, label, count }) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>
              <Icon className="h-3.5 w-3.5" />{label}
              {count > 0 && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  activeTab === key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-5">
            {activeTab === 'meanings' && (
              dictData === 'loading' ? (
                <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>)}</div>
              ) : !mainEntry ? (
                <div className="py-12 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm">{t('profile.noDictData')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {allMeanings.map((meaning, mi) => (
                    <MeaningSection key={mi} meaning={meaning} chineseGloss={posGlossMap.get(meaning.partOfSpeech)} />
                  ))}
                  {mainEntry.sourceUrls?.map(url => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3 w-3" />{t('profile.viewFullEntry')}
                    </a>
                  ))}
                </div>
              )
            )}

            {activeTab === 'examples' && (
              enrichData === 'loading' ? (
                <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="rounded-2xl border border-border/60 p-4 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>)}</div>
              ) : enrichError ? (
                <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{enrichError}</div>
              ) : !enriched?.examples.length ? (
                <div className="py-10 text-center text-muted-foreground">
                  <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  <p className="text-sm">{t('profile.aiExamplesRequireKey')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {t('profile.aiExamplesDesc')}
                  </p>
                  {enriched.examples.map((ex, i) => <ExampleCard key={i} ex={ex} idx={i} />)}
                </div>
              )
            )}

            {activeTab === 'synonyms' && (
              <div className="space-y-5">
                {allSynonyms.length > 0 && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />近义词
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {allSynonyms.slice(0, 20).map(s => (
                        <span key={s} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {allAntonyms.length > 0 && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />反义词
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {allAntonyms.slice(0, 20).map(a => (
                        <span key={a} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {allSynonyms.length === 0 && allAntonyms.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground text-sm">{t('profile.noSynonymData')}</div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 px-6 py-3 bg-muted/10">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />{t('profile.prevWord')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('profile.addedAt', { date: new Date(entry.addedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) })}
          </span>
          <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext} className="gap-1.5">
            {t('profile.nextWord')}<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── WordCard ───────────────────────────────────────────────────────────────

function WordCard({
  entry, isSelected, onClick, multiSelect, checked, onToggleSelect,
}: {
  entry: SavedWordEntry
  isSelected: boolean
  onClick: () => void
  multiSelect: boolean
  checked: boolean
  onToggleSelect: () => void
}) {
  const { t } = useTranslation()
  const [dictData, setDictData] = useState<DictEntry[] | null | 'loading'>('loading')

  useEffect(() => { lookupWord(entry.word).then(setDictData) }, [entry.word])

  const first = Array.isArray(dictData) ? dictData[0] : null
  const phonetic = first ? getBestPhonetic(first) : null
  const firstMeaning = first?.meanings[0]
  const firstDef = firstMeaning?.definitions[0]?.definition

  return (
    <Card
      className={cn(
        'group relative cursor-pointer transition-all hover:shadow-md active:scale-[0.98]',
        isSelected && 'ring-2 ring-primary',
        multiSelect && checked && 'ring-2 ring-primary',
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{entry.word}</p>
            {phonetic && <p className="text-[10px] text-muted-foreground font-mono">{phonetic}</p>}
          </div>
          {multiSelect && (
            <button
              type="button"
              className={cn(
                'shrink-0 rounded-md p-0.5 transition-colors',
                checked ? 'text-primary' : 'text-muted-foreground'
              )}
              onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {firstMeaning && <Badge variant="outline" className="text-[10px] h-4">{firstMeaning.partOfSpeech}</Badge>}
        {dictData === 'loading' ? (
          <div className="space-y-1"><Skeleton className="h-2.5 w-full" /><Skeleton className="h-2.5 w-3/4" /></div>
        ) : firstDef ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{firstDef}</p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic">{t('profile.noDefinition')}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── WordsTab ───────────────────────────────────────────────────────────────

export function WordsTab() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<SavedWordEntry[]>([])
  const [search, setSearch] = useState('')
  const [groupMode, setGroupMode] = useState<GroupMode>('date')
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedWords, setSelectedWords] = useState<string[]>([])

  const refreshEntries = useCallback(() => {
    learningContentRepository.listExpressionEntries('word').then((items) => {
      setEntries(items.map((item) => ({ word: item.original ?? '', addedAt: item.createdAt })).filter((item) => item.word))
    })
  }, [])

  useEffect(() => {
    refreshEntries()
  }, [refreshEntries])

  const removeWord = useCallback(async (word: string) => {
    await learningContentRepository.deleteExpressionByTextAndSync('word', word)
    setEntries((current) => current.filter((entry) => entry.word !== word))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter((e) => e.word.toLowerCase().includes(q))
  }, [entries, search])

  const flatList = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()),
    [filtered]
  )

  const groups = useMemo(() => groupEntries(filtered, groupMode, t), [filtered, groupMode, t])

  const selectedEntry = flatList.find((e) => e.word === selectedWord) ?? null
  const selectedIdx = selectedEntry ? flatList.indexOf(selectedEntry) : -1

  const openWord = useCallback((word: string) => {
    if (!multiSelectMode) setSelectedWord(word)
  }, [multiSelectMode])
  const closeDialog = useCallback(() => setSelectedWord(null), [])
  const gotoPrev = useCallback(() => {
    if (selectedIdx > 0) setSelectedWord(flatList[selectedIdx - 1].word)
  }, [selectedIdx, flatList])
  const gotoNext = useCallback(() => {
    if (selectedIdx < flatList.length - 1) setSelectedWord(flatList[selectedIdx + 1].word)
  }, [selectedIdx, flatList])

  const toggleMultiSelectMode = () => {
    setMultiSelectMode((prev) => {
      if (prev) setSelectedWords([])
      return !prev
    })
  }

  const toggleWordChecked = (word: string) => {
    setSelectedWords((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    )
  }

  const deleteSelectedWords = async () => {
    await Promise.all(selectedWords.map((word) => removeWord(word)))
    setSelectedWords([])
    setMultiSelectMode(false)
  }

  // 键盘 ← → 在 dialog 里切换
  useEffect(() => {
    if (!selectedWord) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gotoPrev()
      else if (e.key === 'ArrowRight') gotoNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedWord, gotoPrev, gotoNext])

  if (entries.length === 0 && !search) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-muted/40 py-16 text-center text-muted-foreground">
          <BookMarked className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>{t('profile.noWords')}</p>
          <p className="mt-1 text-xs opacity-70">{t('profile.addWordHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold">{t('profile.words')}</h2>
          <Badge variant="secondary">{entries.length}</Badge>
        </div>

        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('profile.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* 分组 + 多选 */}
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex rounded-lg bg-muted p-0.5">
            {([
              { mode: 'date', icon: Calendar, label: t('profile.groupByDate') },
              { mode: 'alpha', icon: SortAsc, label: t('profile.groupByAlpha') },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setGroupMode(mode)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all',
                  groupMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3 w-3" />{label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={multiSelectMode ? 'default' : 'outline'}
              className="h-8 w-8 p-0"
              onClick={toggleMultiSelectMode}
              title={multiSelectMode ? t('profile.cancelMultiSelect') : t('profile.multiSelect')}
              aria-label={multiSelectMode ? t('profile.cancelMultiSelect') : t('profile.enableMultiSelect')}
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
            {multiSelectMode && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8"
                onClick={deleteSelectedWords}
                disabled={selectedWords.length === 0}
              >
                {t('profile.deleteCount', { count: selectedWords.length })}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 分组卡片 */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <Search className="mx-auto mb-2 h-7 w-7 opacity-30" />
          {t('profile.noMatchWord')}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-2.5 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
                <Badge variant="outline" className="text-[10px] h-4">{group.items.length}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((e) => (
                  <WordCard
                    key={e.word}
                    entry={e}
                    isSelected={selectedWord === e.word}
                    onClick={() => {
                      if (multiSelectMode) toggleWordChecked(e.word)
                      else openWord(e.word)
                    }}
                    multiSelect={multiSelectMode}
                    checked={selectedWords.includes(e.word)}
                    onToggleSelect={() => toggleWordChecked(e.word)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 单词详情 Dialog */}
      <WordDetailDialog
        entry={selectedEntry}
        onClose={closeDialog}
        onPrev={gotoPrev}
        onNext={gotoNext}
        hasPrev={selectedIdx > 0}
        hasNext={selectedIdx < flatList.length - 1}
      />
    </div>
  )
}
