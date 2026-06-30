import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Lightbulb, ListMusic, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { preloadWarmupLocalJudge, type WarmupReferencePreloadInput } from '@/lib/local-ai/warmup-local-judge'
import { isIOS } from '@/lib/native'
import { practiceRepository } from '@/lib/offline'
import { createWarmupPracticeItemId, dailyPracticeRepository, type DailyPracticeCandidate } from '@/lib/offline/daily-practice.repository'
import { useAuth } from '@/providers/auth-provider'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useWarmupSessionStore, type WarmupRecordEntry, type WarmupScore } from '@/stores/warmup-session.store'
import { toast } from 'sonner'
import { warmupRecordApi } from '../api/english-practice-api'
import { ChunkOutputDrillCard } from './chunk-output-drill-card'
import { PatternDrillCard } from './pattern-drill-card'
import { SentenceDecompositionCard } from './sentence-decomposition-card'
import { VocabOutputCard } from './vocab-output-card'

/** Interactive guided warmup — uses ChunkOutputDrillCard and VocabOutputCard */
function getWarmupStepStatusLabel(params: {
  isPassiveStep: boolean
  score?: WarmupScore
  isDone: boolean
}) {
  if (params.isPassiveStep) return '阅读'

  switch (params.score) {
    case 'strong':
      return '熟练'
    case 'ok':
      return '通过'
    case 'weak':
      return '待稳'
    case 'miss':
      return '复练'
    default:
      return params.isDone ? '完成' : '未做'
  }
}

export function GuidedWarmupPhase({
  packId,
  topicId,
  topicTitle,
  warmupItems,
  onBack,
  onComplete,
}: {
  packId?: string
  topicId: string
  topicTitle: string
  warmupItems: any[]
  onBack: () => void
  onComplete: () => void
}) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const isAdmin = session?.user?.role === 'admin'
  const storageKey = `guided-progress:${topicId}`
  const sessionStorageKey = `guided-session:${topicId}`
  const [warmupRunSeed, setWarmupRunSeed] = useState(() => {
    try {
      const existing = localStorage.getItem(sessionStorageKey)
      if (existing) return existing
      const next = String(Date.now())
      localStorage.setItem(sessionStorageKey, next)
      return next
    } catch {
      return String(Date.now())
    }
  })
  const recordStorageKey = `guided-warmup:${topicId}:${warmupRunSeed}:records`
  const localAiWarmupJudgeEnabled = usePreferencesStore((s) => s.localAiWarmupJudgeEnabled)

  // ── Store (must be before flatSteps) ──
  const warmupStore = useWarmupSessionStore()
  const hydrateWarmupSession = useWarmupSessionStore((s) => s.hydrateSession)
  const hydrateHistoricalStepStates = useWarmupSessionStore((s) => s.hydrateHistoricalStepStates)
  const clearWarmupSession = useWarmupSessionStore((s) => s.clearSession)
  const [assessing, setAssessing] = useState(false)
  const [lastAssessment, setLastAssessment] = useState<{ score: number; feedback: string } | null>(null)
  const [reviewRoundStarted, setReviewRoundStarted] = useState(false)
  const [reviewRoundFinished, setReviewRoundFinished] = useState(false)
  const [reviewRunNonce, setReviewRunNonce] = useState(0)
  const localAiPreloadKeyRef = useRef<string | null>(null)
  const warmupSessionSkipSaveRef = useRef<string | null>(null)

  // ── Flatten all warmup items into individual steps ──
  interface FlatStep {
    id: string
    itemId: string
    type: string
    label: string
    candidate: DailyPracticeCandidate | null
    render: () => React.ReactNode
  }
type SimplePromptItem = { zh: string; answer?: string; hint?: string; imageUrl?: string; audioUrl?: string }
type VocabPromptItem = { vocabId: string; promptZh: string; targetWords?: string[]; suggestedAnswer?: string; hint?: string }

  const buildWarmupReferencePreloads = useCallback((items: any[]): WarmupReferencePreloadInput[] => {
    const references: WarmupReferencePreloadInput[] = []
    for (const item of items) {
      if (item.type === 'chunk_substitution') {
        ;((item.items ?? []) as SimplePromptItem[]).forEach((prompt) => {
          const direction = item.direction ?? 'zh_to_en'
          references.push({
            stepType: 'chunk_substitution',
            direction,
            prompt: direction === 'zh_to_en' ? prompt.zh : (prompt.answer ?? prompt.zh),
            expectedAnswer: direction === 'zh_to_en' ? prompt.answer : prompt.zh,
          })
        })
      } else if (item.type === 'vocab_drill') {
        ;((item.vocabs ?? []) as VocabPromptItem[]).forEach((prompt) => {
          const direction = item.direction ?? 'zh_to_en'
          references.push({
            stepType: 'vocab_drill',
            direction,
            prompt: direction === 'zh_to_en' ? prompt.promptZh : (prompt.suggestedAnswer ?? prompt.promptZh),
            expectedAnswer: direction === 'zh_to_en' ? prompt.suggestedAnswer : prompt.promptZh,
          })
        })
      } else if (item.type === 'vocab_sentence_building') {
        for (const pattern of item.patterns ?? []) {
          ;((pattern.items ?? []) as SimplePromptItem[]).forEach((prompt) => {
            const direction = item.direction ?? 'zh_to_en'
            references.push({
              stepType: 'vocab_sentence_building',
              direction,
              prompt: direction === 'zh_to_en' ? prompt.zh : (prompt.answer ?? prompt.zh),
              expectedAnswer: direction === 'zh_to_en' ? prompt.answer : prompt.zh,
            })
          })
        }
      } else if (item.type === 'pattern_drill') {
        ;((item.items ?? []) as SimplePromptItem[]).forEach((prompt) => {
          const direction = item.direction ?? 'zh_to_en'
          references.push({
            stepType: 'pattern_drill',
            direction,
            prompt: direction === 'zh_to_en' ? prompt.zh : (prompt.answer ?? prompt.zh),
            expectedAnswer: direction === 'zh_to_en' ? prompt.answer : prompt.zh,
          })
        })
      }
    }
    return references
  }, [])

  const shuffleSteps = useCallback((steps: FlatStep[]) => {
    const shuffled = [...steps]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }, [])

  const flatSteps = useMemo<FlatStep[]>(() => {
    const steps: FlatStep[] = []
    const makeStep = (params: {
      item: any
      type: string
      prompt: any
      promptIndex: number
      pattern?: any
      patternIndex?: number
      label: string
      displayLabel: string
      headerContent: string
      render: (localStepId: string) => ReactNode
    }) => {
      const itemId = createWarmupPracticeItemId({
        packId: packId || 'unknown-pack',
        topicId,
        type: params.type,
        item: params.item,
        prompt: params.prompt,
        pattern: params.pattern,
      })
      const candidate: DailyPracticeCandidate | null = packId ? {
        itemId,
        packId,
        packTitle: '',
        topicId,
        topicTitle,
        type: params.type,
        item: params.item,
        prompt: params.prompt,
        promptIndex: params.promptIndex,
        patternIndex: params.patternIndex,
        label: params.label,
        displayLabel: params.displayLabel,
        headerContent: params.headerContent,
      } : null

      steps.push({
        id: itemId,
        itemId,
        type: params.type,
        label: params.label,
        candidate,
        render: () => params.render(itemId),
      })
    }

    for (const item of warmupItems) {
      if (item.type === 'chunk_substitution') {
        const dirLabel = item.direction === 'en_to_zh' ? '英→中' : '中→英'
        ;((item.items ?? []) as SimplePromptItem[]).forEach((sub, subIdx) => {
          makeStep({
            item,
            type: 'chunk_substitution',
            prompt: sub,
            promptIndex: subIdx,
            label: `${item.title} (${dirLabel})`,
            displayLabel: item.kind === 'word' ? '词汇替换' : '句块替换',
            headerContent: item.chunk || sub.zh || item.title || '',
            render: (stepId) => (
              <ChunkOutputDrillCard
                chunk={{ text: item.chunk, meaning: item.chunkMeaning || '', description: null }}
                items={[sub]}
                stepId={stepId}
                direction={item.direction ?? 'zh_to_en'}
                kind={item.kind ?? 'chunk'}
                groupTitle={item.title}
                onComplete={(_subIdx, _passed, score) => markDone(stepId, score)}
              />
            ),
          })
        })
      } else if (item.type === 'vocab_drill') {
        ;((item.vocabs ?? []) as VocabPromptItem[]).forEach((v, vIdx) => {
          makeStep({
            item,
            type: 'vocab_drill',
            prompt: v,
            promptIndex: vIdx,
            label: `${item.title}: ${v.targetWords?.join(', ') || v.promptZh?.slice(0, 20)}`,
            displayLabel: '词汇输出',
            headerContent: v.targetWords?.join(', ') || v.promptZh || item.title || '',
            render: (stepId) => (
              <VocabOutputCard
                title={item.title}
                stepId={stepId}
                direction={item.direction ?? 'zh_to_en'}
                vocabs={[v]}
                onComplete={(_idx, _passed, score) => markDone(stepId, score)}
              />
            ),
          })
        })
      } else if (item.type === 'vocab_sentence_building') {
        for (const [patternIndex, pattern] of (item.patterns ?? []).entries()) {
          ;((pattern.items ?? []) as SimplePromptItem[]).forEach((sub, subIdx) => {
            makeStep({
              item,
              type: 'vocab_sentence_building',
              prompt: { ...sub, pattern },
              pattern,
              promptIndex: subIdx,
              patternIndex,
              label: `${item.vocabWord} + ${pattern.chunk}`,
              displayLabel: '一词多句',
              headerContent: item.vocabWord || pattern.chunk || sub.zh || '',
              render: (flatId) => (
                <ChunkOutputDrillCard
                  chunk={{ text: item.vocabWord || pattern.chunk, meaning: item.vocabMeaning || '' }}
                  items={[sub]}
                  stepId={flatId}
                  stepType="vocab_sentence_building"
                  direction={item.direction ?? 'zh_to_en'}
                  kind="word"
                  groupTitle={`${item.vocabWord} + ${pattern.chunk}`}
                  onComplete={(_subIdx, _passed, score) => markDone(flatId, score)}
                />
              ),
            })
          })
        }
      } else if (item.type === 'sentence_decomposition') {
        const title = item.title || '句子拆解'
        makeStep({
          item,
          type: 'sentence_decomposition',
          prompt: { levels: item.levels, fullSentence: item.fullSentence },
          promptIndex: 0,
          label: title,
          displayLabel: '句子拆解',
          headerContent: item.levels?.[0]?.en || item.fullSentence || title,
          render: (stepId) => (
            <SentenceDecompositionCard
              title={title}
              levels={item.levels}
              stepId={stepId}
              onComplete={(_passed, score) => markDone(stepId, score)}
            />
          ),
        })
      } else if (item.type === 'pattern_drill') {
        const dirLabel = item.direction === 'en_to_zh' ? '英→中' : '中→英'
        ;((item.items ?? []) as SimplePromptItem[]).forEach((sub, subIdx) => {
          makeStep({
            item,
            type: 'pattern_drill',
            prompt: sub,
            promptIndex: subIdx,
            label: `${item.title} (${dirLabel})`,
            displayLabel: '句型操练',
            headerContent: item.pattern || sub.zh || item.title || '',
            render: (stepId) => (
              <PatternDrillCard
                pattern={item.pattern}
                patternMeaning={item.patternMeaning}
                items={[sub]}
                stepId={stepId}
                direction={item.direction ?? 'zh_to_en'}
                groupTitle={item.title}
                onComplete={(_subIdx, _passed, score) => markDone(stepId, score)}
              />
            ),
          })
        })
      }
    }
    return shuffleSteps(steps)
  }, [packId, shuffleSteps, topicId, topicTitle, warmupItems, warmupRunSeed])

  const totalSteps = flatSteps.length
  const warmupReferencePreloads = useMemo(() => buildWarmupReferencePreloads(warmupItems), [buildWarmupReferencePreloads, warmupItems])

  useEffect(() => {
    if (totalSteps === 0) return
    warmupSessionSkipSaveRef.current = recordStorageKey
    let cancelled = false
    void practiceRepository.getLocalWarmupRecord(recordStorageKey).then((record) => {
      if (cancelled) return
      const rawRecords = record?.items ?? []
      const stepIds = new Set(flatSteps.map((step) => step.id))
      const currentRecords = Array.isArray(rawRecords) ? (rawRecords as WarmupRecordEntry[])
        .filter((record) => stepIds.has(record.stepId))
        : []
      if (currentRecords.length > 0) {
        hydrateWarmupSession(currentRecords)
      } else {
        clearWarmupSession()
      }
      const missingStepIds = flatSteps
        .map((step) => step.id)
        .filter((stepId) => !currentRecords.some((record) => record.stepId === stepId))
      if (missingStepIds.length === 0) return
      void practiceRepository.getLatestWarmupEntriesByStepIds(missingStepIds, recordStorageKey).then((records) => {
        if (!cancelled && records.length > 0) hydrateHistoricalStepStates(records)
      })
    }).catch(() => {
      clearWarmupSession()
    })
    return () => { cancelled = true }
  }, [clearWarmupSession, flatSteps, hydrateHistoricalStepStates, hydrateWarmupSession, recordStorageKey, totalSteps])

  useEffect(() => {
    if (totalSteps === 0) return
    if (warmupSessionSkipSaveRef.current === recordStorageKey) {
      warmupSessionSkipSaveRef.current = null
      return
    }
    if (warmupStore.records.length === 0) return
    void practiceRepository.upsertLocalWarmupRecord({
      id: recordStorageKey,
      topicId,
      topicTitle,
      items: warmupStore.records,
      syncStatus: 'pending',
    }).catch(() => undefined)
  }, [recordStorageKey, topicId, topicTitle, totalSteps, warmupStore.records])

  useEffect(() => {
    if (!localAiWarmupJudgeEnabled) return
    const preloadKey = warmupReferencePreloads
      .map((item) => `${item.stepType}:${item.direction ?? ''}:${item.prompt}:${item.expectedAnswer ?? ''}`)
      .join('|')
    if (localAiPreloadKeyRef.current === preloadKey) return
    localAiPreloadKeyRef.current = preloadKey
    void preloadWarmupLocalJudge(warmupReferencePreloads, {
      source: 'guided_warmup',
      packId: packId ?? null,
      topicId,
    })
      .then((result) => {
        if (isAdmin && (result?.computedCount ?? 0) > 0) toast.success(`本地 AI 预加载成功 · ${result?.computedCount ?? warmupReferencePreloads.length} 题`)
      })
      .catch((error) => {
        console.warn('[warmup-local-judge] preload failed:', error)
        if (isAdmin) toast.warning(`本地 AI 预加载失败：${error instanceof Error ? error.message : String(error)}`)
      })
  }, [isAdmin, localAiWarmupJudgeEnabled, packId, topicId, warmupReferencePreloads])

  const [doneIds, setDoneIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) return new Set<string>(JSON.parse(raw) as string[])
      return new Set<string>()
    } catch { return new Set<string>() }
  })

  const persistDone = useCallback((ids: Set<string>) => {
    try { localStorage.setItem(storageKey, JSON.stringify([...ids])) } catch {}
  }, [storageKey])

  const markDone = useCallback((stepId: string, score: WarmupScore = 'strong') => {
    const candidate = flatSteps.find((step) => step.id === stepId)?.candidate
    if (candidate) void dailyPracticeRepository.completeAdHocItem(candidate, score)
    setDoneIds(prev => {
      const next = new Set(prev)
      next.add(stepId)
      persistDone(next)
      return next
    })
  }, [flatSteps, persistDone])

  const doneCount = doneIds.size
  const allDone = totalSteps > 0 && doneCount >= totalSteps
  const latestRecords = warmupStore.records
  const weakRecords = latestRecords.filter((record) => record.score === 'weak' || record.score === 'miss')
  const stableRecords = latestRecords.filter((record) => record.score === 'strong' || record.score === 'ok')
  const scoreSummary = useMemo(() => ({
    strong: latestRecords.filter((record) => record.score === 'strong').length,
    ok: latestRecords.filter((record) => record.score === 'ok').length,
    weak: latestRecords.filter((record) => record.score === 'weak').length,
    miss: latestRecords.filter((record) => record.score === 'miss').length,
  }), [latestRecords])
  const carryIntoSceneRecords = useMemo(() => {
    const candidates = stableRecords.length > 0 ? stableRecords : latestRecords
    return candidates.slice(0, 3)
  }, [latestRecords, stableRecords])
  const weakStepIds = useMemo(() => new Set(weakRecords.map((record) => record.stepId)), [weakRecords])
  const needsReviewRound = allDone && weakStepIds.size > 0 && !reviewRoundStarted && !reviewRoundFinished

  // ── Reset for re-practice ──
  const resetForRepractice = useCallback(() => {
    const nextSession = String(Date.now())
    try { localStorage.setItem(sessionStorageKey, nextSession) } catch {}
    setWarmupRunSeed(nextSession)
    setDoneIds(new Set())
    try { localStorage.removeItem(storageKey) } catch {}
    clearWarmupSession()
    setLastAssessment(null)
    setReviewRoundStarted(false)
    setReviewRoundFinished(false)
    setReviewRunNonce(0)
  }, [clearWarmupSession, sessionStorageKey, storageKey])

  const startWeakReviewRound = useCallback(() => {
    if (weakStepIds.size === 0) return
    setReviewRoundStarted(true)
    setReviewRoundFinished(false)
    setReviewRunNonce((value) => value + 1)
    setDoneIds(prev => {
      const next = new Set([...prev].filter((id) => !weakStepIds.has(id)))
      persistDone(next)
      return next
    })
    warmupStore.resetSteps([...weakStepIds])
    const firstWeakIndex = flatSteps.findIndex((step) => weakStepIds.has(step.id))
    setCurrentIdx(firstWeakIndex >= 0 ? firstWeakIndex : 0)
  }, [flatSteps, persistDone, warmupStore, weakStepIds])

  // ── AI assess when all done ──
  useEffect(() => {
    if (allDone && reviewRoundStarted && !reviewRoundFinished) {
      setReviewRoundFinished(true)
    }
  }, [allDone, reviewRoundFinished, reviewRoundStarted])

  useEffect(() => {
    if (allDone && !needsReviewRound && !assessing && !lastAssessment) {
      const records = warmupStore.getAssessmentRecords()
      if (records.length === 0) return
      setAssessing(true)
      const itemIds = flatSteps
        .map((step) => step.candidate?.itemId)
        .filter((itemId): itemId is string => Boolean(itemId))
      const syncProgress = packId && itemIds.length
        ? dailyPracticeRepository.syncAdHocRun({ packId, topicId, topicTitle, itemIds, records }).catch(() => undefined)
        : Promise.resolve()
      warmupRecordApi.assess(topicId, topicTitle, records)
        .then((res) => {
          setLastAssessment(res)
          void practiceRepository.markWarmupRecordSynced(recordStorageKey, res.id)
        })
        .catch(() => {
          setLastAssessment({ score: 0, feedback: '' })
          void practiceRepository.syncLocalWarmupRecord(recordStorageKey, topicId, topicTitle, records).catch(() => undefined)
        })
        .finally(() => {
          void syncProgress.finally(() => setAssessing(false))
        })
    }
  }, [allDone, flatSteps, needsReviewRound, packId, recordStorageKey, topicId, topicTitle, assessing, lastAssessment, warmupStore])

  // ── Carousel state ──
  const [currentIdx, setCurrentIdx] = useState(0)
  const gotoPrev = useCallback(() => setCurrentIdx(prev => Math.max(0, prev - 1)), [])
  const gotoNext = useCallback(() => setCurrentIdx(prev => Math.min(totalSteps - 1, prev + 1)), [totalSteps])
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < totalSteps - 1
  const currentStepDone = flatSteps[currentIdx] ? doneIds.has(flatSteps[currentIdx].id) : false
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [autoNextEnabled, setAutoNextEnabled] = useState(false)

  useEffect(() => {
    if (!autoNextEnabled || !hasNext || allDone || !currentStepDone) return
    const timer = window.setTimeout(() => {
      setCurrentIdx((prev) => Math.min(totalSteps - 1, prev + 1))
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [allDone, autoNextEnabled, currentIdx, currentStepDone, hasNext, totalSteps])

  if (totalSteps === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col px-4 pb-24 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-5" /></Button>
          <div className="flex-1"><p className="text-xs text-muted-foreground">{t('practiceSession.warmupTitle')}</p><h1 className="text-lg font-bold text-foreground">{topicTitle}</h1></div>
        </div>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">{t('practiceSession.noWarmupHint')}</p>
          <Button onClick={onComplete}>{t('practiceSession.startPractice')}</Button>
        </div>
      </div>
    )
  }

  if (needsReviewRound) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col px-4 pb-24 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-5" /></Button>
          <div className="flex-1"><p className="text-xs text-muted-foreground">{t('practiceSession.warmupTitle')}</p><h1 className="text-lg font-bold text-foreground">{topicTitle}</h1></div>
        </div>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/12 text-amber-600">
            <Lightbulb className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">还有 {weakStepIds.size} 个表达需要再稳一下</p>
            <p className="text-sm leading-6 text-muted-foreground">这些题刚才答错、跳过，或借助了完整答案。先集中再练一轮，再进入 VN 对话。</p>
          </div>
          <div className="w-full max-w-sm space-y-2 rounded-xl border bg-card p-3 text-left">
            {weakRecords.slice(0, 5).map((record) => (
              <div key={record.stepId} className="flex items-start gap-2 rounded-lg bg-muted/45 px-3 py-2">
                <Badge variant={record.score === 'miss' ? 'destructive' : 'secondary'} className="mt-0.5 shrink-0 text-[10px]">
                  {record.score}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{record.zh}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{record.answer}</p>
                </div>
              </div>
            ))}
            {weakRecords.length > 5 && (
              <p className="px-1 text-[11px] text-muted-foreground">还有 {weakRecords.length - 5} 题会一起进入复练。</p>
            )}
          </div>
          <div className="flex w-full max-w-sm gap-3">
            <Button variant="outline" className="flex-1" onClick={resetForRepractice}>整组重练</Button>
            <Button className="flex-1" onClick={startWeakReviewRound}>开始错题再练</Button>
          </div>
        </div>
      </div>
    )
  }

  if (allDone) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col px-4 pb-24 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-5" /></Button>
          <div className="flex-1"><p className="text-xs text-muted-foreground">{t('practiceSession.warmupTitle')}</p><h1 className="text-lg font-bold text-foreground">{topicTitle}</h1></div>
        </div>
        <div className="space-y-4 py-4">
          <div className="rounded-xl bg-primary/[0.06] p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-500/12 text-green-600">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">知识点热身完成</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  你已经把本场景会用到的表达过了一遍，可以回到准备页选择下一步。
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <WarmupSummaryMetric label="完成" value={`${doneCount}/${totalSteps}`} />
              <WarmupSummaryMetric label="稳妥" value={`${scoreSummary.strong + scoreSummary.ok}`} />
              <WarmupSummaryMetric label="待巩固" value={`${scoreSummary.weak + scoreSummary.miss}`} />
            </div>
          </div>

          {assessing ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> AI 综合评估中...
            </div>
          ) : lastAssessment ? (
            <div className="rounded-xl border bg-card px-4 py-3 text-left space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={lastAssessment.score >= 80 ? 'default' : 'secondary'} className="text-sm px-2">
                  {lastAssessment.score} 分
                </Badge>
                <span className="text-xs text-muted-foreground">综合评估</span>
              </div>
              <p className="text-sm text-foreground">{lastAssessment.feedback}</p>
            </div>
          ) : null}

          {carryIntoSceneRecords.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">建议保留在脑中的表达</p>
              </div>
              <div className="space-y-2">
                {carryIntoSceneRecords.map((record) => (
                  <WarmupRecordRow key={record.stepId} record={record} />
                ))}
              </div>
            </div>
          )}

          {weakRecords.length > 0 ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="size-4 text-amber-600" />
                <p className="text-sm font-semibold text-foreground">还不太稳的表达</p>
              </div>
              <div className="space-y-2">
                {weakRecords.slice(0, 3).map((record) => (
                  <WarmupRecordRow key={record.stepId} record={record} tone="weak" />
                ))}
                {weakRecords.length > 3 && (
                  <p className="px-1 text-[11px] text-muted-foreground">还有 {weakRecords.length - 3} 题可以一起复练。</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">
              这一轮没有明显薄弱项。回到准备页后，你可以直接开始场景对话，或者整组再刷一遍加深熟悉度。
            </div>
          )}

          <div className="grid gap-2">
            {weakStepIds.size > 0 && (
              <Button className="min-h-11" onClick={startWeakReviewRound}>
                只练薄弱项
              </Button>
            )}
            <Button variant="outline" className="min-h-11" onClick={resetForRepractice}>
              整组重练
            </Button>
            <Button variant="ghost" className="min-h-10 text-muted-foreground" onClick={onBack}>
              返回准备页
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden pt-[calc(1rem+env(safe-area-inset-top,0px))]">
      {/* Header */}
      <div className="mb-4 flex shrink-0 items-center gap-3 px-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-5" /></Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t('practiceSession.warmupTitle')} · {currentIdx + 1}/{totalSteps}</p>
          <h1 className="truncate text-lg font-bold text-foreground">{topicTitle}</h1>
          <p className="line-clamp-2 text-xs text-muted-foreground/70">{flatSteps[currentIdx]?.label ?? ''}</p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 rounded-full bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border/70">
          <span>自动</span>
          <Switch
            checked={autoNextEnabled}
            onCheckedChange={setAutoNextEnabled}
            disabled={totalSteps <= 1}
            className="origin-right scale-90"
          />
        </label>
      </div>
      <Progress value={((currentIdx + 1) / totalSteps) * 100} className="mb-4 h-1.5 shrink-0 px-4" />

      {/* Current card — scrollable */}
      <div className="min-h-0 min-w-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto px-4 pb-4">
        <div key={`${flatSteps[currentIdx]?.id}:${reviewRunNonce}`}>
          {flatSteps[currentIdx]?.render() ?? null}
        </div>
      </div>

      {/* Bottom nav — fixed at bottom like LearningInsightDialog */}
      <div className={cn('flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3', isIOS() && 'pb-safe')}>
        <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev} className="gap-1">
          <ChevronLeft className="size-4" /> 上一个
        </Button>
        <span className="text-xs text-muted-foreground">
          {currentIdx + 1} / {totalSteps}
        </span>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={gotoNext} disabled={!hasNext} className="gap-1">
            下一个 <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.currentTarget.blur()
              setPlaylistOpen(true)
            }}
            title="列表"
          >
            <ListMusic className="size-4" />
          </Button>
        </div>
      </div>

      {/* Playlist drawer */}
      <Drawer open={playlistOpen} onOpenChange={setPlaylistOpen}>
        <DrawerContent className={cn('h-[80dvh] w-full max-w-full overflow-hidden rounded-t-2xl !z-[10001]', isIOS() && 'pt-safe')} overlayClassName="!z-[10001]">
          <div className="flex min-w-0 items-center justify-between gap-3 px-5 py-3">
            <DrawerTitle className="min-w-0 truncate text-lg">题目列表</DrawerTitle>
            <button
              onClick={() => setPlaylistOpen(false)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>
          <ScrollArea className={cn('min-w-0 max-w-full flex-1 overflow-x-hidden px-4 pb-8', isIOS() && 'pb-safe')}>
            <div className="w-full max-w-full min-w-0 space-y-1 overflow-hidden">
              {flatSteps.map((step, i) => {
                const isDone = doneIds.has(step.id)
                const isCurrent = i === currentIdx
                const isPassiveStep = step.type === 'sentence_decomposition'
                const score = warmupStore.stepStates[step.id]?.score
                const statusLabel = getWarmupStepStatusLabel({ isPassiveStep, score, isDone })
                return (
                  <button
                    key={step.id}
                    onClick={() => { setCurrentIdx(i); setPlaylistOpen(false) }}
                    className={cn(
                      'grid w-full max-w-full min-w-0 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      isCurrent ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                    )}
                  >
                    <span className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium',
                      isCurrent ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                    )}>
                      {isPassiveStep ? <BookOpen className="size-3" /> : i + 1}
                    </span>
                    <span className="line-clamp-2 min-w-0 max-w-full overflow-hidden break-all leading-5 [overflow-wrap:anywhere]">
                      {step.label}
                    </span>
                    <span className={cn(
                      'max-w-[4.5rem] shrink-0 truncate rounded-full px-2 py-0.5 text-[10px] font-medium',
                      isPassiveStep
                        ? 'bg-muted text-muted-foreground'
                        : score === 'strong'
                          ? 'bg-primary/10 text-primary'
                          : score === 'ok'
                            ? 'bg-primary/10 text-primary/80'
                            : score === 'weak'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              : score === 'miss'
                                ? 'bg-destructive/10 text-destructive'
                                : isDone
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-muted/60 text-muted-foreground',
                    )}>
                      {statusLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function WarmupSummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/70 px-3 py-2 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function WarmupRecordRow({
  record,
  tone = 'default',
}: {
  record: WarmupRecordEntry
  tone?: 'default' | 'weak'
}) {
  const score = record.score ?? (record.passed ? 'ok' : 'miss')
  const scoreLabel: Record<WarmupScore, string> = {
    strong: '熟练',
    ok: '通过',
    weak: '待稳',
    miss: '漏掉',
  }
  const title = record.groupTitle || record.answer || record.zh
  const subtitle = record.groupTitle ? record.answer || record.zh : record.zh

  return (
    <div className={cn(
      'flex items-start gap-2 rounded-lg px-3 py-2 text-left',
      tone === 'weak' ? 'bg-background/70' : 'bg-muted/45',
    )}>
      <Badge
        variant={score === 'miss' ? 'destructive' : score === 'weak' ? 'secondary' : 'outline'}
        className="mt-0.5 shrink-0 text-[10px]"
      >
        {scoreLabel[score]}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{title}</p>
        {subtitle && subtitle !== title && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
