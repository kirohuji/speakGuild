import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, BookText, MessageSquareText,
  Target,
  BookmarkPlus, Search,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { type ChunkItem, type SentencePattern, type TrainingTopicItem, type UnitDetail, type VocabItem } from '../api/learning-api'
import { useLearningStore } from '@/stores/learning.store'
import { expressionApi } from '@/features/practice/api/english-practice-api'
import {
  LearningInsightDialog,
  type LearningInsightItem,
} from '@/features/practice/components/learning-insight-dialog'

const PREP_PAGE_SIZE = 8

export function LearningUnitPage() {
  const { t } = useTranslation()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()

  // 数据：来自 store
  const unit = useLearningStore((s) => s.unitDetail)
  const loading = useLearningStore((s) => s.unitDetailLoading)
  const fetchUnitDetail = useLearningStore((s) => s.fetchUnitDetail)

  const [activeTab, setActiveTab] = useState('vocab')
  const [prepPage, setPrepPage] = useState({ vocab: 1, chunk: 1, pattern: 1 })

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogKind, setDialogKind] = useState<'vocab' | 'chunk' | 'pattern'>('vocab')

  // 展开的列表项（点击高亮 + 展开显示详情）
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // 已收集文本（按需加载，各 tab 独立）
  const [collectedTexts, setCollectedTexts] = useState<Set<string>>(new Set())
  const loadedTabs = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!unitId) return
    fetchUnitDetail(unitId)
  }, [unitId, fetchUnitDetail])

  // 切 tab 时按需加载已收集状态
  const loadCollectedForTab = useCallback((tab: string) => {
    if (loadedTabs.current.has(tab)) return
    loadedTabs.current.add(tab)

    if (tab === 'vocab') {
      expressionApi.list({ type: 'word' }).catch(() => ([] as any)).then((res: any) => {
        const items = Array.isArray(res) ? res : (res?.items ?? [])
        setCollectedTexts((prev) => {
          const next = new Set(prev)
          for (const item of items) { if (item.original) next.add(item.original) }
          return next
        })
      })
    } else if (tab === 'chunk') {
      expressionApi.list({ type: 'chunk' }).catch(() => ([] as any)).then((res: any) => {
        const items = Array.isArray(res) ? res : (res?.items ?? [])
        setCollectedTexts((prev) => {
          const next = new Set(prev)
          for (const item of items) { if (item.chunkText) next.add(item.chunkText) }
          return next
        })
      })
    } else if (tab === 'pattern') {
      expressionApi.list({ type: 'scene_phrase' }).catch(() => ([] as any)).then((res: any) => {
        const items = Array.isArray(res) ? res : (res?.items ?? [])
        setCollectedTexts((prev) => {
          const next = new Set(prev)
          for (const item of items) { if (item.chunkText) next.add(item.chunkText) }
          return next
        })
      })
    }
  }, [])

  useEffect(() => { loadCollectedForTab(activeTab) }, [activeTab, loadCollectedForTab])

  const handleCollectChunk = useCallback(async (text: string, meaning: string) => {
    try {
      await expressionApi.create({ type: 'chunk', chunkText: text, original: meaning, sceneName: unit?.title })
      setCollectedTexts((prev) => new Set([...prev, text]))
      toast.success(t('learning.addedToLibrary'))
    } catch { toast.error(t('learning.addFailed')) }
  }, [unit?.title])

  const handleCollectWord = useCallback(async (word: string, meaning: string) => {
    try {
      await expressionApi.create({ type: 'word', chunkText: meaning, original: word, sceneName: unit?.title })
      setCollectedTexts((prev) => new Set([...prev, word]))
      toast.success(t('learning.addedToLibrary'))
    } catch { toast.error(t('learning.addFailed')) }
  }, [unit?.title])

  const handleRemoveExpression = useCallback(async (text: string) => {
    try {
      // 先查询找到对应 expression 的 ID
      const list = await expressionApi.list()
      const items = Array.isArray(list) ? list : (list as any)?.items ?? []
      const match = items.find(
        (item: any) => item.chunkText === text || item.original === text,
      )
      if (!match?.id) { toast.error(t('learning.notFound')); return }
      await expressionApi.remove(match.id)
      setCollectedTexts((prev) => { const s = new Set(prev); s.delete(text); return s })
      toast.success(t('learning.removedFromLibrary'))
    } catch { toast.error(t('learning.removeFailed')) }
  }, [])

  const vocabDialogItems = useMemo<LearningInsightItem[]>(() =>
    (unit?.vocabularies ?? []).map((v) => ({
      kind: 'word' as const,
      id: v.id,
      word: v.word,
      meaning: v.meaning,
      partOfSpeech: v.partOfSpeech,
      phoneticUs: v.phoneticUs,
      phoneticUk: v.phoneticUk,
      audioUsUrl: v.audioUsUrl,
      audioUkUrl: v.audioUkUrl,
      definitionEn: v.definitionEn,
      synonyms: v.synonyms,
      examples: v.examples,
      description: v.description,
      difficulty: v.difficulty,
      sceneName: unit?.title,
    })), [unit])

  const chunkDialogItems = useMemo<LearningInsightItem[]>(() =>
    (unit?.chunks ?? []).map((c) => ({
      kind: 'chunk' as const,
      id: c.id,
      text: c.text,
      meaning: c.meaning,
      description: c.description,
      examples: c.examples,
      sceneName: unit?.title,
    })), [unit])

  const allVocabCount = vocabDialogItems.length
  const allChunkCount = chunkDialogItems.length
  const patternDialogItems = useMemo<LearningInsightItem[]>(() =>
    (unit?.sentencePatterns ?? []).map((p, index) => ({
      kind: 'pattern' as const,
      id: `${p.topicId}-${index}`,
      pattern: p.pattern,
      meaning: p.meaning,
      slots: p.slots,
      example: p.example,
      difficulty: p.difficulty,
      sceneName: unit?.title,
    })), [unit])

  const currentDialogItems = useMemo(() => {
    if (dialogKind === 'chunk') return chunkDialogItems
    if (dialogKind === 'pattern') return patternDialogItems
    return vocabDialogItems
  }, [chunkDialogItems, dialogKind, patternDialogItems, vocabDialogItems])

  // 打开 Dialog
  const openDialog = useCallback((kind: 'vocab' | 'chunk' | 'pattern', startIndex: number) => {
    const nextItems =
      kind === 'chunk' ? chunkDialogItems : kind === 'pattern' ? patternDialogItems : vocabDialogItems
    setDialogKind(kind)
    setDialogIndex(Math.min(startIndex, nextItems.length - 1))
    setDialogOpen(true)
  }, [chunkDialogItems, patternDialogItems, vocabDialogItems])

  // 点击列表项展开/收起详情
  const handleItemClick = useCallback((itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId))
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open)
  }, [])

  const vocabPageItems = useMemo(
    () => paginateItems(unit?.vocabularies ?? [], prepPage.vocab, PREP_PAGE_SIZE),
    [prepPage.vocab, unit?.vocabularies],
  )
  const chunkPageItems = useMemo(
    () => paginateItems(unit?.chunks ?? [], prepPage.chunk, PREP_PAGE_SIZE),
    [prepPage.chunk, unit?.chunks],
  )
  const patternPageItems = useMemo(
    () => paginateItems(unit?.sentencePatterns ?? [], prepPage.pattern, PREP_PAGE_SIZE),
    [prepPage.pattern, unit?.sentencePatterns],
  )

  const changePrepPage = useCallback((kind: keyof typeof prepPage, page: number) => {
    setPrepPage((current) => ({ ...current, [kind]: page }))
    setExpandedItemId(null)
  }, [])

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
    setExpandedItemId(null)
  }, [])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>
  if (!unit) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Target className="size-12 text-muted-foreground/40" />
      <p className="text-muted-foreground">{t('learning.unitNotFound')}</p>
      <Button variant="outline" asChild><Link to="/learning">{t('learning.backToPlan')}</Link></Button>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* ===== Header ===== */}
      <div className="mb-4">
        <Link to="/learning" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {t('learning.learningPlan')}
        </Link>
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-2 rounded-full">{unit.category}</Badge>
            <h1 className="text-xl font-bold leading-tight text-foreground">{unit.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{unit.location}</p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Target className="size-5" />
          </div>
        </div>
      </div>

      {/* ===== 说明 ===== */}
      <section className="mb-5">
        <SectionHeader
          eyebrow="1"
          title={t('learning.preparationTitle')}
          subtitle={t('learning.prepSubtitle')}
        />
        <div className="rounded-lg bg-muted/30 p-4">
          {unit.description ? (
            <p className="text-sm leading-6 text-muted-foreground">{unit.description}</p>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">{t('learning.prepFallback')}</p>
          )}
          {/* <div className="mt-4 grid grid-cols-3 gap-2">
            <UnitMetric label={t('learning.readiness')} value={`${unit.progress?.readiness ?? 0}%`} />
            <UnitMetric label={t('learning.vocab')} value={`${unit.progress?.vocabLearned ?? 0}/${unit.vocabCount}`} />
            <UnitMetric label={t('learning.chunks')} value={`${unit.progress?.chunkMastered ?? 0}/${unit.chunkCount}`} />
          </div> */}
        </div>
      </section>

      {/* ===== 知识点 ===== */}
      <section className="mb-5">
        <SectionHeader
          eyebrow="2"
          title={t('learning.knowledgePoints')}
          subtitle={t('learning.knowledgeSubtitle')}
          meta={`${allVocabCount + allChunkCount + patternDialogItems.length}${t('learning.items')}`}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-3">
          <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-muted/70 p-1">
            <TabsTrigger value="vocab" className="gap-1.5 rounded-md text-xs">
              <BookText className="size-3.5" /> {t('learning.vocab')} {allVocabCount}
            </TabsTrigger>
            <TabsTrigger value="chunk" className="gap-1.5 rounded-md text-xs">
              <MessageSquareText className="size-3.5" /> {t('learning.chunks')} {allChunkCount}
            </TabsTrigger>
            <TabsTrigger value="pattern" className="gap-1.5 rounded-md text-xs">
              <Search className="size-3.5" /> {t('learning.patterns')} {patternDialogItems.length}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vocab" className="mt-0 space-y-2">
            {unit.vocabularies.length > 0 ? (
              <>
                {vocabPageItems.items.map((vocab, index) => (
                  <VocabPrepCard
                    key={vocab.id}
                    vocab={vocab}
                    collected={collectedTexts.has(vocab.word)}
                    expanded={expandedItemId === vocab.id}
                    onToggle={() => handleItemClick(vocab.id)}
                    onOpen={() => openDialog('vocab', vocabPageItems.startIndex + index)}
                    onCollect={() => handleCollectWord(vocab.word, vocab.meaning)}
                    onRemove={() => handleRemoveExpression(vocab.word)}
                    {...(index === 0 ? { 'data-spotlight': 'first-vocab-card' as any } : {})}
                  />
                ))}
                <PrepPager
                  currentPage={prepPage.vocab}
                  totalPages={vocabPageItems.totalPages}
                  totalItems={unit.vocabularies.length}
                  onPageChange={(page) => changePrepPage('vocab', page)}
                />
              </>
            ) : (
              <EmptyPrepState label={t('learning.noVocab')} />
            )}
          </TabsContent>

          <TabsContent value="chunk" className="mt-0 space-y-2">
            {unit.chunks.length > 0 ? (
              <>
                {chunkPageItems.items.map((chunk, index) => (
                  <ChunkPrepCard
                    key={chunk.id}
                    chunk={chunk}
                    collected={collectedTexts.has(chunk.text)}
                    expanded={expandedItemId === chunk.id}
                    onToggle={() => handleItemClick(chunk.id)}
                    onOpen={() => openDialog('chunk', chunkPageItems.startIndex + index)}
                    onCollect={() => handleCollectChunk(chunk.text, chunk.meaning)}
                    onRemove={() => handleRemoveExpression(chunk.text)}                  />
                ))}
                <PrepPager
                  currentPage={prepPage.chunk}
                  totalPages={chunkPageItems.totalPages}
                  totalItems={unit.chunks.length}
                  onPageChange={(page) => changePrepPage('chunk', page)}
                />
              </>
            ) : (
              <EmptyPrepState label={t('learning.noChunks')} />
            )}
          </TabsContent>

          <TabsContent value="pattern" className="mt-0 space-y-2">
            {unit.sentencePatterns.length > 0 ? (
              <>
                {patternPageItems.items.map((pattern, index) => {
                  const absoluteIndex = patternPageItems.startIndex + index
                  const key = `${pattern.topicId}-${absoluteIndex}`
                  return (
                    <PatternPrepCard
                      key={key}
                      pattern={pattern}
                      expanded={expandedItemId === key}
                      onToggle={() => handleItemClick(key)}
                      onOpen={() => openDialog('pattern', absoluteIndex)}
                    />
                  )
                })}
                <PrepPager
                  currentPage={prepPage.pattern}
                  totalPages={patternPageItems.totalPages}
                  totalItems={unit.sentencePatterns.length}
                  onPageChange={(page) => changePrepPage('pattern', page)}
                />
              </>
            ) : (
              <EmptyPrepState label={t('learning.noPatterns')} />
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* ===== 题目 ===== */}
      {unit.trainingTopics.length > 0 && (
        <section className="mb-5">
          <SectionHeader
            eyebrow="3"
            title={t('learning.practiceTitle')}
            subtitle={t('learning.practiceSubtitle')}
            meta={`${unit.trainingTopics.length}${t('learning.questions')}`}
          />
          <div className="space-y-2">
            {unit.trainingTopics.map((topic, i) => (
              <PracticeTopicCard
                key={topic.id}
                topic={topic}
                index={i}
                onStart={() => navigate(`/practice/session/${topic.id}?unitId=${unitId}`)}
                {...(i === 0 ? { 'data-spotlight': 'start-vn-practice' as any } : {})}
              />
            ))}
          </div>
        </section>
      )}

      {/* Dialog */}
      <LearningInsightDialog
        items={currentDialogItems}
        index={Math.min(dialogIndex, Math.max(currentDialogItems.length - 1, 0))}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onIndexChange={setDialogIndex}
      />
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  meta,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  meta?: string
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {eyebrow}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {meta && (
        <Badge variant="outline" className="shrink-0 rounded-full text-[11px]">
          {meta}
        </Badge>
      )}
    </div>
  )
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIndex = (currentPage - 1) * pageSize

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    startIndex,
    totalPages,
  }
}

function PrepPager({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/35 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">
        {t('common.total')} {totalItems} {t('learning.items')}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          {t('common.prevPage')}
        </Button>
        <span className="min-w-10 text-center text-[11px] text-muted-foreground">
          {currentPage}/{totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          {t('common.nextPage')}
        </Button>
      </div>
    </div>
  )
}

function UnitMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/45 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function VocabPrepCard({
  vocab,
  collected,
  expanded,
  onToggle,
  onOpen,
  onCollect,
  onRemove,
  ...rest
}: {
  vocab: VocabItem
  collected: boolean
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
  onCollect: () => void
  onRemove: () => void
} & Record<string, any>) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const handleClick = () => {
    setSaving(true)
    const action = collected ? onRemove() : onCollect()
    Promise.resolve(action).finally(() => setSaving(false))
  }

  return (
    <Card className={cn('border-0 bg-muted/30 shadow-none transition-colors', expanded && 'bg-primary/[0.06]')}>
      <CardContent className="p-0">
        <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle} {...rest}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <BookText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{vocab.word}</p>
              {collected && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{t('learning.collected')}</Badge>}
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{vocab.meaning}</p>
          </div>
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </button>

        {expanded && (
          <div className="px-3 pb-3 pt-2">
            {vocab.description && <p className="mb-3 text-xs leading-5 text-muted-foreground">{vocab.description}</p>}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 text-xs" onClick={onOpen}>
                <Search className="size-3.5" /> {t('learning.view')}
              </Button>
              <Button size="sm" variant={collected ? 'secondary' : 'default'} className="h-8 flex-1 gap-1.5 text-xs" disabled={saving} onClick={handleClick} data-spotlight="bookmark-btn">
                <BookmarkPlus className="size-3.5" /> {saving ? t('learning.processing') : collected ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChunkPrepCard({
  chunk,
  collected,
  expanded,
  onToggle,
  onOpen,
  onCollect,
  onRemove,
}: {
  chunk: ChunkItem
  collected: boolean
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
  onCollect: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const handleClick = () => {
    setSaving(true)
    const action = collected ? onRemove() : onCollect()
    Promise.resolve(action).finally(() => setSaving(false))
  }

  return (
    <Card className={cn('border-0 bg-muted/30 shadow-none transition-colors', expanded && 'bg-primary/[0.06]')}>
      <CardContent className="p-0">
        <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <MessageSquareText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{chunk.text}</p>
              {collected && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{t('learning.collected')}</Badge>}
              <Badge variant="outline" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{chunk.difficulty}</Badge>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{chunk.meaning}</p>
          </div>
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </button>

        {expanded && (
          <div className="px-3 pb-3 pt-2">
            {chunk.description && <p className="mb-3 text-xs leading-5 text-muted-foreground">{chunk.description}</p>}
            {chunk.examples[0] && (
              <div className="mb-3 rounded-md bg-muted/45 p-2.5">
                <p className="text-xs font-medium leading-5 text-foreground">{chunk.examples[0].en}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{chunk.examples[0].zh}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 text-xs" onClick={onOpen}>
                <Search className="size-3.5" /> {t('learning.viewExpression')}
              </Button>
              <Button
                size="sm"
                variant={collected ? 'secondary' : 'default'}
                className="h-8 flex-1 gap-1.5 text-xs"
                disabled={saving}
                onClick={handleClick}
              >
                <BookmarkPlus className="size-3.5" />
                {saving ? t('learning.processing') : collected ? t('learning.alreadyAdded') : t('learning.addToLibrary')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PatternPrepCard({
  pattern,
  expanded,
  onToggle,
  onOpen,
}: {
  pattern: SentencePattern
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card className={cn('border-0 bg-muted/30 shadow-none transition-colors', expanded && 'bg-primary/[0.06]')}>
      <CardContent className="p-0">
        <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Search className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{pattern.pattern}</p>
              <Badge variant="outline" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{pattern.difficulty}</Badge>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{pattern.meaning}</p>
          </div>
          <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </button>

        {expanded && (
          <div className="px-3 pb-3 pt-2">
            <div className="mb-3 rounded-md bg-muted/45 p-2.5">
              <p className="text-xs font-medium leading-5 text-foreground">{pattern.example}</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{pattern.topicTitle}</p>
            </div>
            {(pattern.slots ?? []).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {pattern.slots.map((slot) => (
                  <Badge key={slot} variant="secondary" className="rounded-full px-2 text-[10px]">{slot}</Badge>
                ))}
              </div>
            )}
            <Button size="sm" variant="outline" className="h-8 w-full gap-1.5 text-xs" onClick={onOpen}>
              <Search className="size-3.5" /> {t('learning.viewPattern')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PracticeTopicCard({
  topic,
  index,
  onStart,
  ...rest
}: {
  topic: TrainingTopicItem
  index: number
  onStart: () => void
  [key: `data-${string}`]: string | undefined
}) {
  const { t } = useTranslation()
  return (
    <Card
      className="cursor-pointer border-0 bg-orange-500/[0.06] shadow-none transition-colors hover:bg-orange-500/[0.1]"
      onClick={onStart}
      {...rest}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
            <span className="text-sm font-bold text-orange-500">{index + 1}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground">{topic.title}</p>
              <Badge variant="secondary" className="text-[10px]">{topic.difficulty}</Badge>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{topic.promptZh}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {t('practiceHub.suggested')} {Math.round(topic.suggestedDurationSec / 60)} {t('practiceSession.minutes')}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </div>
        {topic.activeChunks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 rounded-md bg-background/45 p-2.5">
            {topic.activeChunks.slice(0, 3).map((chunk) => (
              <Badge key={chunk.id} variant="outline" className="rounded-full px-2 text-[10px]">
                {chunk.text}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyPrepState({ label }: { label: string }) {
  return (
    <div className="rounded-lg bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
