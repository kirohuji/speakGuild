import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Play, Info,
  Lightbulb, CheckCircle2, ChevronRight,
  History, Settings, ChevronDown, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { VnPlayer, type VnPlayerHandle } from '@/features/vn-engine/vn-player'
import type { VnInputRecording } from '@/features/vn-engine/vn-input-panel'
import { persistUserRecordingAsset } from '@/features/vn-engine/persist-user-recording'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { useInstalledVnMedia } from '@/features/vn-engine/use-installed-vn-media'
import { useVnTagVisuals } from '@/features/vn-engine/use-vn-tag-visuals'
import { practiceApi, practiceAiApi, chunkApi, expressionApi, type TopicDetail } from '../api/english-practice-api'
import { learningContentRepository } from '@/lib/offline/learning-content.repository'
import { practiceRepository } from '@/lib/offline/practice.repository'
import { listContentPage } from '@/lib/offline/learning-pack-read-model'
import { type InstalledAssetMap } from '@/lib/offline/installed-pack-media'
import { GuidedWarmupPhase } from '../components/guided-warmup-phase'
import { LearningInsightDialog, type LearningInsightItem } from '../components/learning-insight-dialog'
import { SaveToNotebookDrawer } from '@/features/expression/components/save-to-notebook-drawer'
import { ExpressionPrepSection } from '@/features/learning/components/expression-prep-section'

import { PracticeTurnFeedback } from '../components/practice-turn-feedback'
import { PracticeVnDrawer } from '../components/practice-vn-drawer'
import { PracticeAnalysisPanel } from '../components/practice-analysis-panel'
import { VnPlayerBoundary } from '../components/vn-player-boundary'
import { useLayoutStore } from '@/stores/layout.store'
import { usePracticeStore } from '@/stores/practice.store'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { useFeatureFlagsStore } from '@/stores/feature-flags.store'
import { useEffectivePracticeTimer } from '@/hooks/use-effective-practice-timer'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'
import {
  characterMatchesSpeaker,
  compilePracticeInk,
  parseVnTags,
  readInputNodeId,
  readListTags,
  readTagValue,
} from '../lib/practice-session-utils'
import {
  PASSED_FEEDBACK_LINGER_MS,
  type Phase,
  type TurnFeedback,
} from '../types/practice-session'

export function PracticeSessionPage() {
  const { t } = useTranslation()
  const { topicId } = useParams<{ topicId: string }>()
  const [searchParams] = useSearchParams()
  const unitId = searchParams.get('unitId')
  const navigate = useNavigate()

  // ── Feature flag guard ──
  const flagsLoading = useFeatureFlagsStore((s) => s.loading)
  const flagsLoaded = useFeatureFlagsStore((s) => s.loaded)
  const scriptPracticeEnabled = useFeatureFlagsStore((s) => s.scriptPracticeEnabled)

  // ── Data ──
  const detail = usePracticeStore((s) => s.topicDetail)
  const projected = Boolean((detail as { __offlineProjection?: boolean } | null)?.__offlineProjection)
  const fetchTopicDetail = usePracticeStore((s) => s.fetchTopicDetail)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Phase ──
  const [phase, setPhase] = useState<Phase>('prepare')

  // ── Prepare state ──
  const [activatedChunks, setActivatedChunks] = useState<Set<string>>(new Set())
  const [runtimePipeline, setRuntimePipeline] = useState<any[] | null>(null)
  const [insightIndex, setInsightIndex] = useState(0)
  const [insightOpen, setInsightOpen] = useState(false)
  const [fallbackInsightItem, setFallbackInsightItem] = useState<LearningInsightItem | null>(null)
  const [collectedTexts, setCollectedTexts] = useState<Set<string>>(new Set())
  const [savingTexts, setSavingTexts] = useState<Set<string>>(new Set())
  const [saveDrawerOpen, setSaveDrawerOpen] = useState(false)
  const [pendingSave, setPendingSave] = useState<
    | { kind: 'word'; word: string; meaning: string }
    | { kind: 'chunk'; item: TopicDetail['activeChunks'][number] }
    | { kind: 'pattern'; item: { pattern: string; meaning?: string; example?: string; sceneName?: string } }
    | { kind: 'raw'; item: { type: string; original?: string; corrected?: string; chunkText?: string; sceneName?: string } }
    | null
  >(null)
  const [confirmAbandonOpen, setConfirmAbandonOpen] = useState(false)

  // ── Practice (VN) state ──
  const [inkJson, setInkJson] = useState<Record<string, any> | null>(null)
  const [packInkAssetMap, setPackInkAssetMap] = useState<InstalledAssetMap | null>(null)
  const [packInkSourceReady, setPackInkSourceReady] = useState(false)
  const [dialogueRounds, setDialogueRounds] = useState<{
    speaker: string
    text: string
    isNpc: boolean
    translation?: string
    audioUrl?: string
    tags?: string[]
  }[]>([])
  const [practiceSessionId, setPracticeSessionId] = useState<string | null>(null)
  const [turnFeedback, setTurnFeedback] = useState<TurnFeedback | null>(null)
  // Retry state: when AI suggests correction, user must re-speak before advancing
  const [retryState, setRetryState] = useState<'idle' | 'retrying'>('idle')
  const retryCountRef = useRef(0)
  const lastRetryFocusRef = useRef<{ chunk?: string | null; prompt?: string | null }>({})
  const parentRoundRef = useRef<number>(0) // round number when retry started

  // Fallback NPC dialogue (when no Ink script)
  const [fallbackRound, setFallbackRound] = useState(0)
  const fallbackNpcName = detail?.scene?.title ?? 'NPC'

  // Side drawer state
  const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(new Set())
  const [usedChunks, setUsedChunks] = useState<Set<string>>(new Set())
  const [aiHints, setAiHints] = useState<{ type: 'chunk' | 'pattern'; text: string; meaning?: string; example?: string }[]>([])
  const [teachingMarkdown, setTeachingMarkdown] = useState('')

  useEffectivePracticeTimer({
    enabled: phase === 'practice' && Boolean(practiceSessionId),
    sourceId: practiceSessionId,
    scope: 'dialogue',
    questionCount: dialogueRounds.filter((round) => !round.isNpc).length,
  })

  // ── Analysis state ──
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [practiceView, setPracticeView] = useState<'play' | 'analysis'>('play')

  // ── History dialog visibility (hide drawer toggles when open) ──
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // ── Teaching drawer (controlled from prepare phase) ──
  const [teachingOpen, setTeachingOpen] = useState(false)
  useEffectivePracticeTimer({
    enabled: phase === 'prepare' && teachingOpen && Boolean(topicId),
    sourceId: topicId ? `learning-guide:${topicId}` : null,
    scope: 'learning',
    idlePauseMs: 3 * 60_000,
  })
  const vnPlayerRef = useRef<VnPlayerHandle | null>(null)
  const syncedInkLineCountRef = useRef(0)

  // Only show history/settings in header when chat mode is active
  const [isChatMode, setIsChatMode] = useState(() => {
    try {
      const raw = localStorage.getItem('manyu-vn-player-settings')
      if (!raw) return false
      return (JSON.parse(raw) as any)?.displayMode === 'chat'
    } catch { return false }
  })
  const handleVnDisplayModeChange = useCallback((displayMode: 'vn' | 'chat') => {
    setIsChatMode(displayMode === 'chat')
  }, [])
  // ── Immersive mode (hide layout chrome during practice) ──
  const setImmersiveMode = useLayoutStore((s) => s.setImmersiveMode)
  const [guidedOpen, setGuidedOpen] = useState(false)
  useEffect(() => {
    if (phase === 'practice' || guidedOpen) {
      setImmersiveMode(true)
    } else {
      setImmersiveMode(false)
    }
    return () => { setImmersiveMode(false) }
  }, [phase, guidedOpen, setImmersiveMode])

  // Switch to immersive mode BEFORE mounting PixiVnStage, so layout is stable
  const ensurePipeline = useCallback(async () => {
    if (!projected || !topicId) return
    const row = await practiceRepository.getTopicRuntime(topicId)
    const output = row?.metadata?.outputTraining
    const pipeline = output?.enabled === false ? [] : (output?.pipeline ?? row?.metadata?.pipeline ?? [])
    setRuntimePipeline(pipeline)
  }, [projected, topicId])

  const handleStartPractice = useCallback(async () => {
    setImmersiveMode(true)
    await ensurePipeline()
    setPhase('practice')
    if (!topicId) return
    try {
      const session = await practiceRepository.createSession(topicId)
      setPracticeSessionId(session.id)
    } catch (err) {
      console.error('[practice-session] ❌ 创建会话失败:', err)
      // Keep local practice usable even if session persistence is temporarily unavailable.
    }
  }, [ensurePipeline, setImmersiveMode, topicId])

  // Switch to guided warmup phase before practice
  const handleStartGuided = useCallback(async () => {
    setImmersiveMode(true)
    await ensurePipeline()
    setGuidedOpen(true)
  }, [ensurePipeline, setImmersiveMode])

  // Complete guided and go to practice
  const handleGuidedComplete = useCallback(async () => {
    setGuidedOpen(false)
    setPhase('practice')
    if (!topicId) return
    try {
      const session = await practiceRepository.createSession(topicId)
      setPracticeSessionId(session.id)
    } catch (err) {
      console.error('[practice-session] ❌ 创建会话失败:', err)
    }
  }, [topicId])

  // ── Objectives & chunks from detail ──
  const objectives = useMemo(() => {
    const objs: string[] = []
    if (detail?.sentencePatterns?.length) {
      detail.sentencePatterns.forEach((p) => objs.push(`${t('practiceSession.usePattern')}: ${p.pattern}`))
    }
    objs.push(`${t('practiceSession.aroundTopic')} "${detail?.topic.title}" ${t('practiceSession.startDialogue')}`)
    if (objs.length === 0) objs.push(t('practiceSession.completionHint'))
    return objs
  }, [detail])

  const coreChunkTexts = useMemo(() => {
    return (detail?.activeChunks ?? []).map((c) => ({ text: c.text, meaning: c.meaning }))
  }, [detail])

  const warmupItems = useMemo(() => {
    const pipeline = projected
      ? (runtimePipeline ?? [])
      : (detail?.topic?.metadata?.outputTraining?.pipeline ?? [])
    const metadataItems = pipeline.filter((item: any) =>
      item.type === 'chunk_substitution' || item.type === 'vocab_drill' || item.type === 'vocab_sentence_building' || item.type === 'sentence_decomposition' || item.type === 'pattern_drill'
    )
    if (metadataItems.length > 0) return metadataItems
    return (detail?.activeChunks ?? [])
      .filter(c => c.examples?.length)
      .map(c => ({
        id: c.id,
        type: 'chunk_substitution' as const,
        title: c.text,
        chunk: c.text,
        chunkMeaning: c.meaning || '',
        items: (c.examples ?? []).map((e: any) => ({ zh: e.zh, answer: e.en })),
      }))
  }, [detail, projected, runtimePipeline])

  const onboardingCompletedSegments = useOnboardingStore((s) => s.completedSegments)
  useEffect(() => {
    if (phase !== 'prepare' || !detail || loading) return
    const hasWarmup = projected
      ? warmupItems.length > 0
      : Boolean(detail.topic?.metadata?.outputTraining?.enabled && detail.topic?.metadata?.outputTraining?.pipeline?.length > 0)
    const canShowPractice = !flagsLoaded || scriptPracticeEnabled

    if (hasWarmup && !onboardingCompletedSegments['practice-warmup']) {
      useOnboardingStore.getState().tryStartSegment('practice-warmup')
      return
    }
    if (canShowPractice) {
      useOnboardingStore.getState().tryStartSegment('practice-vn-start')
    }
  }, [
    phase,
    detail,
    loading,
    projected,
    warmupItems.length,
    flagsLoaded,
    scriptPracticeEnabled,
    onboardingCompletedSegments,
  ])

  // ==================== Load Data ====================
  useEffect(() => {
    if (!topicId) return
    setLoading(true)
    fetchTopicDetail(topicId).finally(() => setLoading(false))
  }, [topicId, fetchTopicDetail])

  // detail 加载完成后做后处理（Ink 编译 + assetMap 源准备；本地媒体解析交给 useInstalledVnMedia）
  useEffect(() => {
    if (!detail) return
    const learnedChunkIds = detail.activeChunks
      .filter((chunk) => chunk.masteryStatus !== 'not_learned')
      .map((chunk) => chunk.id)
    setActivatedChunks(new Set(learnedChunkIds))

    if (!(detail as { __offlineProjection?: boolean }).__offlineProjection) {
      setTeachingMarkdown(detail.topic.teachingMarkdown || '')
    }

    let cancelled = false
    setPackInkSourceReady(false)
    setPackInkAssetMap(null)

    void (async () => {
      try {
        const inkRecord = detail.inkScript
          ?? (detail.topic.inkScriptId && topicId ? await practiceRepository.getTopicInk(topicId) : null)
        if (cancelled) return

        const compiledInk = compilePracticeInk(
          (inkRecord as { inkSource?: string | null } | null)?.inkSource ?? detail.inkScript?.inkSource,
          (inkRecord as { inkJson?: any } | null)?.inkJson ?? detail.inkScript?.inkJson,
        )
        if (compiledInk) setInkJson(compiledInk)

        const nextMap = (
          (inkRecord as { assetMap?: InstalledAssetMap | null } | null)?.assetMap
          ?? (detail.inkScript as { assetMap?: InstalledAssetMap | null } | undefined)?.assetMap
          ?? null
        )
        setPackInkAssetMap(nextMap)
      } catch (error) {
        console.warn('[practice-session] ink prepare failed', error)
        if (!cancelled) {
          const compiledInk = compilePracticeInk(detail.inkScript?.inkSource, detail.inkScript?.inkJson)
          if (compiledInk) setInkJson(compiledInk)
          setPackInkAssetMap(
            (detail.inkScript as { assetMap?: InstalledAssetMap | null } | undefined)?.assetMap ?? null,
          )
        }
      } finally {
        if (!cancelled) setPackInkSourceReady(true)
      }
    })()

    return () => { cancelled = true }
  }, [detail, topicId, unitId])

  const practicePackageId = packInkSourceReady && detail
    ? (unitId || detail.scene.id)
    : ''
  const { mediaReady: packMediaReady, assetMap: resolvedAssetMap, scene: resolvedScene } = useInstalledVnMedia({
    packageId: practicePackageId,
    revision: `${topicId || ''}:${practicePackageId}:${packInkSourceReady ? '1' : '0'}`,
    rawAssetMap: packInkAssetMap,
    rawScene: detail?.scene,
  })
  const activeScene = (resolvedScene as TopicDetail['scene'] | null) ?? detail?.scene

  // 句型 tab 也需要展示收藏状态，mount 时加载
  useEffect(() => {
    learningContentRepository.listExpressionTexts('pattern').then((texts) => {
      setCollectedTexts((prev) => new Set([...prev, ...texts]))
    })
  }, [])

  const [prepCollapsed, setPrepCollapsed] = useState(true)
  const [prepMaterials, setPrepMaterials] = useState<{
    vocabularies: TopicDetail['vocabularies']
    chunks: TopicDetail['activeChunks']
    patterns: NonNullable<TopicDetail['sentencePatterns']>
  }>({ vocabularies: [], chunks: [], patterns: [] })
  useEffect(() => {
    if (!detail) {
      setPrepMaterials({ vocabularies: [], chunks: [], patterns: [] })
      return
    }
    if (!projected || !topicId) {
      setPrepMaterials({
        vocabularies: detail.vocabularies ?? [],
        chunks: detail.activeChunks ?? [],
        patterns: detail.sentencePatterns ?? [],
      })
      return
    }
    let cancelled = false
    Promise.all([
      listContentPage({ topicId, kind: 'vocab', page: 1, pageSize: 500 }),
      listContentPage({ topicId, kind: 'chunk', page: 1, pageSize: 500 }),
      listContentPage({ topicId, kind: 'pattern', page: 1, pageSize: 500 }),
    ]).then(([vocab, chunk, pattern]) => {
      if (cancelled) return
      setPrepMaterials({
        vocabularies: vocab.items as TopicDetail['vocabularies'],
        chunks: chunk.items as TopicDetail['activeChunks'],
        patterns: pattern.items as NonNullable<TopicDetail['sentencePatterns']>,
      })
    }).catch(() => {
      if (cancelled) return
      setPrepMaterials({
        vocabularies: detail.vocabularies ?? [],
        chunks: detail.activeChunks ?? [],
        patterns: detail.sentencePatterns ?? [],
      })
    })
    return () => { cancelled = true }
  }, [detail, projected, topicId])
  useEffect(() => {
    if (!teachingOpen || !projected || !topicId) return
    practiceRepository.getTopicDocument(topicId).then((document) => {
      setTeachingMarkdown(document?.teachingMarkdown || '')
    }).catch(() => {})
  }, [projected, teachingOpen, topicId])

  // ==================== Ink Story Hook ====================
  const handleExternalFn = useCallback((name: string, args: any[]) => {
    if (name === 'waitForUserInput') return true
    if (name === 'showExpression') {
      if (args[0]) setAiHints((prev) => [...prev, { type: 'chunk', text: String(args[0]) }])
      return true
    }
    if (name === 'setFlag') {
      if (args[0]) setCompletedObjectives((prev) => new Set([...prev, String(args[0])]))
      return true
    }
    return undefined
  }, [])

  const refreshTeachingMarkdown = useCallback(async () => {
    if (!topicId) return
    try {
      const result = await practiceApi.getTopicTeachingMarkdown(topicId)
      setTeachingMarkdown(result.teachingMarkdown || '')
    } catch {
      // Keep the initially loaded document available when refreshing fails.
    }
  }, [topicId])

  // Restart from header — reset state and re-trigger Ink init without leaving practice phase
  const [restartKey, setRestartKey] = useState(0)
  const restartPractice = useCallback(() => {
    setDialogueRounds([])
    setPracticeSessionId(null)
    syncedInkLineCountRef.current = 0
    setFallbackRound(0)
    setCompletedObjectives(new Set())
    setUsedChunks(new Set())
    setAiHints([])
    setTurnFeedback(null)
    setAnalysisResult(null)
    setAnalysisLoading(false)
    setPracticeView('play')
    setRestartKey((k) => k + 1)
  }, [])

  const {
    lines: inkLines,
    choices: inkChoices,
    isWaiting: inkWaiting,
    isEnded: inkEnded,
    currentTags,
    advanceStory,
    handleChoice,
    resumeAfterInput,
  } = useInkStory(
    useMemo(() => inkJson ? { ...inkJson, __restartKey: restartKey } : null, [inkJson, restartKey]),
    { onExternalFunction: handleExternalFn },
  )

  const latestNpcSpeaker = useMemo(
    () => [...dialogueRounds].reverse().find((line) => line.isNpc && line.speaker)?.speaker,
    [dialogueRounds],
  )
  const vnVisual = useVnTagVisuals({
    currentTags,
    mediaReady: packMediaReady,
    assetMap: resolvedAssetMap,
    sceneBackgroundUrl: activeScene?.backgroundUrl,
    isWaiting: inkWaiting,
    fallbackSpeaker: latestNpcSpeaker,
  })

  useEffect(() => {
    syncedInkLineCountRef.current = 0
  }, [inkJson])

  // Parse #input hint tags for the PracticeVnDrawer (visuals come from useVnTagVisuals).
  useEffect(() => {
    const tags = currentTags
    if (tags.length === 0) return
    const hintText = readTagValue(tags, 'hint:')
    const objectiveText = readTagValue(tags, 'objective:')
    const chunkTexts = readListTags(tags, 'chunks:')
    if (!hintText && !objectiveText && chunkTexts.length === 0) return
    setAiHints((prev) => {
      const next = [...prev]
      if (objectiveText) next.push({ type: 'pattern' as const, text: objectiveText })
      if (hintText) next.push({ type: 'pattern' as const, text: hintText })
      for (const c of chunkTexts) {
        if (!next.some((h) => h.text === c)) next.push({ type: 'chunk' as const, text: c })
      }
      return next
    })
  }, [currentTags])

  // Sync Ink lines to dialogue display. Keep tags so TTS can re-resolve when
  // installed assetMap becomes ready (same contract as script VN live).
  useEffect(() => {
    const newLines = inkLines.slice(syncedInkLineCountRef.current)
    if (newLines.length === 0) return
    syncedInkLineCountRef.current = inkLines.length
    const newDialogues = newLines.filter(Boolean).map((line) => {
      const parsed = parseVnTags(line.tags, packMediaReady ? resolvedAssetMap : undefined)
      return {
        speaker: line.speaker ?? (line.tags?.includes('npc') ? fallbackNpcName : ''),
        text: line.text,
        isNpc: true, // All Ink lines are NPC/narration; user lines added by sendUserInput
        translation: parsed.translation,
        audioUrl: parsed.audio,
        tags: line.tags,
      }
    })
    setDialogueRounds((prev) => [...prev, ...newDialogues])
  }, [fallbackNpcName, inkLines, packMediaReady, resolvedAssetMap])

  const vnDialogueLines = useMemo(() => {
    return dialogueRounds.map((line) => {
      if (!line.isNpc) {
        return {
          speaker: line.speaker,
          text: line.text,
          isUser: true as const,
          translation: line.translation,
          audioUrl: line.audioUrl,
        }
      }
      const parsed = line.tags?.length
        ? parseVnTags(line.tags, packMediaReady ? resolvedAssetMap : undefined)
        : null
      return {
        speaker: line.speaker,
        text: line.text,
        isUser: false as const,
        translation: parsed?.translation || line.translation,
        audioUrl: parsed?.audio || line.audioUrl,
      }
    })
  }, [dialogueRounds, packMediaReady, resolvedAssetMap])

  // Fallback NPC greeting when no Ink script
  useEffect(() => {
    if (!inkJson && detail && dialogueRounds.length === 0 && phase === 'practice') {
      const timer = setTimeout(() => {
        setDialogueRounds([{
          speaker: fallbackNpcName,
          text: `Hi! Welcome. ${detail.topic.promptEn}`,
          isNpc: true,
        }])
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [inkJson, detail, dialogueRounds.length, phase, fallbackNpcName])

  // ==================== Prepare Helpers ====================
  const activateChunk = useCallback(async (chunkId: string) => {
    try { await chunkApi.activate(chunkId) } catch {}
    setActivatedChunks((prev) => new Set([...prev, chunkId]))
  }, [])

  const insightItems = useMemo<LearningInsightItem[]>(() => {
    if (!detail) return []
    const sceneName = detail.scene.title
    const words: LearningInsightItem[] = detail.vocabularies.map((v) => ({
      kind: 'word',
      id: `word:${v.id}`,
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
      sceneName,
    }))
    const chunks: LearningInsightItem[] = detail.activeChunks.map((c) => ({
      kind: 'chunk', id: `chunk:${c.id}`, text: c.text, meaning: c.meaning,
      description: c.description, examples: c.examples, sceneName,
    }))
    const patterns: LearningInsightItem[] = detail.sentencePatterns?.length
      ? detail.sentencePatterns.map((p, i) => ({
          kind: 'pattern', id: `pattern:${i}`, pattern: p.pattern,
          meaning: p.meaning, example: p.example, description: p.description, difficulty: p.difficulty, sceneName,
        }))
      : []
    return [...words, ...chunks, ...patterns]
  }, [detail])

  const allInsightItems = useMemo(
    () => fallbackInsightItem ? [...insightItems, fallbackInsightItem] : insightItems,
    [insightItems, fallbackInsightItem],
  )

  /** VN 对话中长按单词 → 打开单词详情 dialog */
  const handleWordInsight = useCallback((word: string) => {
    const lower = word.toLowerCase()
    // 先在已有词汇表中查找
    const idx = insightItems.findIndex((item) => item.kind === 'word' && item.word.toLowerCase() === lower)
    if (idx >= 0) {
      setFallbackInsightItem(null)
      setInsightIndex(idx)
      setInsightOpen(true)
      return
    }
    // 未找到则构造临时词条，追加到列表末尾
    const fallbackItem: LearningInsightItem = {
      kind: 'word',
      id: `word:vn:${word}`,
      word,
    }
    setFallbackInsightItem(fallbackItem)
    setInsightIndex(insightItems.length)
    setInsightOpen(true)
  }, [insightItems])

  const savePendingToNotebooks = useCallback(async (notebookIds: string[]) => {
    if (!pendingSave) return
    const text = pendingSave.kind === 'word'
      ? pendingSave.word
      : pendingSave.kind === 'chunk'
        ? pendingSave.item.text
        : pendingSave.kind === 'pattern'
          ? pendingSave.item.pattern
          : pendingSave.item.chunkText ?? pendingSave.item.original ?? pendingSave.item.corrected ?? ''
    setSavingTexts((prev) => new Set([...prev, text]))
    try {
      if (pendingSave.kind === 'word') {
        const vocab = detail?.vocabularies?.find((item) => item.word.toLowerCase() === pendingSave.word.toLowerCase())
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'word',
          text: pendingSave.word,
          meaning: vocab?.meaning ?? pendingSave.meaning,
        sceneName: detail?.scene.title,
          contentSnapshot: vocab ?? { word: pendingSave.word, meaning: pendingSave.meaning },
        sourceType: 'vocabulary',
          sourceId: vocab?.id,
          notebookIds,
      })
      } else if (pendingSave.kind === 'pattern') {
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'pattern',
          text: pendingSave.item.pattern,
          meaning: pendingSave.item.meaning,
          sceneName: pendingSave.item.sceneName,
          contentSnapshot: pendingSave.item,
        sourceType: 'sentence_pattern',
          sourceId: (pendingSave.item as any).id,
          notebookIds,
      })
      } else if (pendingSave.kind === 'chunk') {
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'chunk',
          text: pendingSave.item.text,
          meaning: pendingSave.item.meaning,
        sceneName: detail?.scene.title,
          contentSnapshot: pendingSave.item,
        sourceType: 'chunk',
          sourceId: pendingSave.item.id,
          notebookIds,
      })
      } else {
        await expressionApi.create({ ...pendingSave.item, notebookIds })
      }
      setCollectedTexts((prev) => new Set([...prev, text]))
      toast.success(t('learning.addedToLibrary'))
    } catch { toast.error(t('learning.addFailed')) }
    setSavingTexts((prev) => { const s = new Set(prev); s.delete(text); return s })
    setPendingSave(null)
  }, [detail, pendingSave, t])

  const vocabTotal = prepMaterials.vocabularies.length
  const chunkTotal = prepMaterials.chunks.length
  const patternTotal = prepMaterials.patterns.length

  // ==================== Practice: Send Input ====================
  const sendUserInput = useCallback(async (text: string, audioUrl?: string, recording?: VnInputRecording) => {
    if (!text.trim()) return

    const round = dialogueRounds.length + 1
    const userMsg = text.trim()
    const npcText = [...dialogueRounds].reverse().find((line) => line.isNpc)?.text ?? ''
    const taggedChunkTexts = readListTags(currentTags, 'chunks:')
    const targetChunksForRound = taggedChunkTexts.length
      ? taggedChunkTexts
      : coreChunkTexts.map((chunk) => chunk.text)
    const objectiveForRound = readListTags(currentTags, 'objective:').length
      ? readListTags(currentTags, 'objective:')
      : objectives
    const hintForRound = readTagValue(currentTags, 'hint:')
    const sessionKey = practiceSessionId || topicId || 'practice'
    // Upload in parallel with AI judge so turn latency stays close to story VN.
    const durableAudioPromise = persistUserRecordingAsset({
      recording,
      fallbackAudioUrl: audioUrl,
      bizType: 'practice_turn_recording',
      bizId: `${sessionKey}:${round}`,
    })
    // Story-pack live VN keeps the panel's session URL (blob:/capacitor:) on the
    // timeline. Durable asset:// is only written to submitTurn for later replay.
    const liveUserAudioUrl = audioUrl && !audioUrl.startsWith('asset:')
      ? audioUrl
      : undefined

    // If using Ink engine
    if (inkJson) {
      let objectiveCompleted = [...completedObjectives]
      let chunksUsedForRound = [...usedChunks]
      let inkVariables: Record<string, string | number | boolean> | undefined
      let turnJudgement: any
      let passed = false

      setTurnFeedback({
        status: 'loading',
        userText: userMsg,
        objective: objectiveForRound.join('；'),
        hint: hintForRound,
        targetChunks: targetChunksForRound,
      })

      try {
        const judgement = await practiceAiApi.judgeDialogueTurn({
          topicId: topicId!,
          inputNodeId: readInputNodeId(currentTags),
          npcText,
          userText: userMsg,
          objectives: objectiveForRound,
          targetChunks: targetChunksForRound,
          mode: retryState === 'retrying' ? 'targeted_output' : undefined,
          requiredChunks: retryState === 'retrying' && lastRetryFocusRef.current.chunk
            ? [lastRetryFocusRef.current.chunk] : undefined,
        })

        objectiveCompleted = judgement.objectiveCompleted ?? objectiveCompleted
        chunksUsedForRound = judgement.chunksUsed ?? chunksUsedForRound
        inkVariables = judgement.inkVariables
        turnJudgement = judgement
        passed = judgement.passed

        // ── Retry flow ──
        if (retryState === 'retrying') {
          retryCountRef.current += 1
          if (passed) {
            // Retry succeeded
            setRetryState('idle')
            retryCountRef.current = 0
            lastRetryFocusRef.current = {}
          } else if (retryCountRef.current >= 2) {
            // Max retries exceeded, allow skip
            setRetryState('idle')
            retryCountRef.current = 0
            lastRetryFocusRef.current = {}
            passed = true // Let it through after max attempts
          }
          // Still retrying: stay in retryState, show feedback
        } else if (judgement.retryRequired && judgement.passed) {
          // First-time: expression is understandable but unnatural → require retry
          setRetryState('retrying')
          retryCountRef.current = 0
          parentRoundRef.current = round
          lastRetryFocusRef.current = {
            chunk: judgement.focusChunk,
            prompt: judgement.retryPrompt,
          }
          passed = false // Don't advance the story yet
        }
        // ── End retry flow ──

        setTurnFeedback({
          status: 'success',
          userText: userMsg,
          objective: objectiveForRound.join('；'),
          hint: hintForRound,
          targetChunks: targetChunksForRound,
          result: { ...judgement, passed },
        })

        if (passed && objectiveCompleted.length) {
          setCompletedObjectives((prev) => new Set([...prev, ...objectiveCompleted]))
        }
        if (passed && chunksUsedForRound.length) {
          setUsedChunks((prev) => new Set([...prev, ...chunksUsedForRound]))
        }
      } catch (error: any) {
        setTurnFeedback({
          status: 'error',
          userText: userMsg,
          objective: objectiveForRound.join('；'),
          hint: hintForRound,
          targetChunks: targetChunksForRound,
          error: error?.response?.data?.message || error?.message || t('practiceSession.aiEvalUnavailable'),
        })
        return
      }

      const durableUserAudioUrl = await durableAudioPromise
      if (practiceSessionId) {
        practiceRepository.submitTurn(practiceSessionId, {
          round,
          npcText,
          userText: userMsg,
          userAudioUrl: durableUserAudioUrl,
          inputNodeId: readInputNodeId(currentTags),
          tags: currentTags,
          judgement: turnJudgement,
          objectivesCompleted: objectiveCompleted,
          chunksUsed: chunksUsedForRound,
          isRetry: retryState === 'retrying',
          parentTurnId: retryState === 'retrying' ? String(parentRoundRef.current) : undefined,
        }).catch((err) => {
          console.error(`[practice-session] ❌ submitTurn 失败 | round=${round}:`, err)
        })
      }

      if (passed) {
        // Match story-pack live VN: keep blob: on the timeline for in-session
        // playback; durable asset:// is only for submitTurn / later replay.
        setDialogueRounds((prev) => [...prev, {
          speaker: t('practiceSession.speakerYou'),
          text: userMsg,
          isNpc: false,
          audioUrl: liveUserAudioUrl || durableUserAudioUrl,
        }])
        practiceApi.submitDialogue(topicId!, {
          round,
          npcText,
          userText: userMsg,
          objectivesCompleted: objectiveCompleted,
          chunksUsed: chunksUsedForRound,
        }).catch(() => {})
        await new Promise((resolve) => setTimeout(resolve, PASSED_FEEDBACK_LINGER_MS))
        resumeAfterInput(userMsg, inkVariables)
      }
      return
    }

    const durableUserAudioUrl = await durableAudioPromise
    setDialogueRounds((prev) => [...prev, {
      speaker: t('practiceSession.speakerYou'),
      text: userMsg,
      isNpc: false,
      audioUrl: liveUserAudioUrl || durableUserAudioUrl,
    }])
    targetChunksForRound.forEach((chunkText) => {
      if (userMsg.toLowerCase().includes(chunkText.toLowerCase())) {
        setUsedChunks((prev) => new Set([...prev, chunkText]))
      }
    })

    // Fallback: simulate NPC response
    const npcResponses = [
      `That's interesting! Tell me more about that.`,
      `I see. Could you give me an example?`,
      `Great point! What else comes to mind?`,
      `I understand. Let me ask you another question—why do you think that is?`,
    ]
    const fallbackNpcText = npcResponses[fallbackRound % npcResponses.length]

    if (practiceSessionId) {
      practiceRepository.submitTurn(practiceSessionId, {
        round,
        npcText,
        userText: userMsg,
        userAudioUrl: durableUserAudioUrl,
        objectivesCompleted: [...completedObjectives],
        chunksUsed: [...usedChunks],
      }).catch((err) => {
        console.error(`[practice-session] ❌ submitTurn 失败 | round=${round}:`, err)
      })
    }

    setTimeout(() => {
      setDialogueRounds((prev) => [
        ...prev,
        { speaker: fallbackNpcName, text: fallbackNpcText, isNpc: true },
      ])
      setFallbackRound((r) => r + 1)

      const unusedChunks = coreChunkTexts.filter((c) => !usedChunks.has(c.text))
      if (unusedChunks.length > 0 && fallbackRound > 1) {
        const hint = unusedChunks[Math.floor(Math.random() * unusedChunks.length)]
        setAiHints((prev) => [...prev, {
          type: 'chunk',
          text: `${t('practiceSession.tryUsing')}: "${hint.text}"`,
          meaning: hint.meaning,
        }])
      }
    }, 800)

    if (fallbackRound > 0 && fallbackRound % 2 === 0 && objectives.length > 0) {
      const idx = fallbackRound % objectives.length
      setCompletedObjectives((prev) => new Set([...prev, objectives[idx]]))
    }
  }, [dialogueRounds, fallbackRound, inkJson, topicId, resumeAfterInput, completedObjectives, usedChunks, coreChunkTexts, objectives, fallbackNpcName, currentTags, practiceSessionId, t, retryState])

  const continueDespiteFeedback = useCallback(() => {
    if (!turnFeedback) return
    setRetryState('idle')
    retryCountRef.current = 0
    parentRoundRef.current = 0
    lastRetryFocusRef.current = {}
    resumeAfterInput(turnFeedback.userText, turnFeedback.result?.inkVariables)
    setTurnFeedback(null)
  }, [resumeAfterInput, turnFeedback])

  // ==================== Analysis ====================
  const goBackToScene = useCallback(() => {
    // Use history back so user returns to the page they came from (today, learning, etc.)
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate(unitId ? `/learning/units/${unitId}` : '/learning', { replace: true })
    }
  }, [navigate, unitId])

  const startAnalysis = useCallback(async () => {
    if (!topicId || !detail) return
    setPracticeView('analysis')
    if (analysisResult || analysisLoading) return
    setAnalysisLoading(true)
    try {
      if (!practiceSessionId) {
        console.warn('[practice-session] ⚠️ startAnalysis 时 practiceSessionId 为 null，无法分析')
        setAnalysisResult({ summary: t('practiceSession.noSessionRecords') })
        return
      }
      const res = await practiceRepository.completeSession(practiceSessionId).then(() => practiceRepository.analyzeSession(practiceSessionId))
      setAnalysisResult(res.analysis ?? res)
    } catch (e: any) {
      setAnalysisResult({ summary: `${t('practiceSession.analysisFailedMsg')}: ${e.message}` })
    } finally {
      setAnalysisLoading(false)
    }
  }, [topicId, detail, analysisResult, analysisLoading, practiceSessionId, t])

  const saveAnalysisExpression = useCallback(async (data: {
    type: string
    original?: string
    corrected?: string
    chunkText?: string
    sceneName?: string
  }) => {
    setPendingSave({
      kind: 'raw',
      item: {
        ...data,
        sceneName: data.sceneName || detail?.scene.title,
      },
    })
    setSaveDrawerOpen(true)
  }, [detail?.scene.title])

  const resetPractice = () => {
    setDialogueRounds([])
    setPracticeSessionId(null)
    syncedInkLineCountRef.current = 0
    setFallbackRound(0)
    setCompletedObjectives(new Set())
    setUsedChunks(new Set())
    setAiHints([])
    setTurnFeedback(null)
    setRetryState('idle')
    retryCountRef.current = 0
    parentRoundRef.current = 0
    lastRetryFocusRef.current = {}
    setAnalysisResult(null)
    setAnalysisLoading(false)
    setPracticeView('play')
    setRestartKey((k) => k + 1)
    setPhase('prepare')
  }

  // ==================== Loading / Error ====================
  if (loading) {
    return <MobilePageLoading rows={5} minHeightClassName="min-h-screen" />
  }

  if (error || !detail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-destructive">{error || t('practiceSession.notFound')}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>{t('practiceSession.back')}</Button>
      </div>
    )
  }

  const canShowPractice = !flagsLoaded || scriptPracticeEnabled
  const hasWarmup = projected
    ? warmupItems.length > 0
    : Boolean(detail?.topic?.metadata?.outputTraining?.enabled && detail?.topic?.metadata?.outputTraining?.pipeline?.length > 0)
  const hasExamples = detail?.activeChunks?.some(c => c.examples?.length)

  function renderPracticeButtons() {
    const warmupBtn = (
      <Button className="min-h-11 flex-1 border-0 shadow-none" variant="secondary" size="default" onClick={handleStartGuided} data-spotlight="start-guided-warmup">
        {t('practiceSession.startWarmup')}
      </Button>
    )
    const practiceBtn = (
      <Button className="flex-1 min-h-11 bg-accent text-accent-foreground hover:bg-accent/85" size="default" onClick={handleStartPractice} data-spotlight="start-vn-practice">
        <Play className="mr-1.5 size-4" /> {t('practiceSession.startPractice')}
      </Button>
    )
    const practiceBtnFull = (
      <Button className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" size="lg" onClick={handleStartPractice} data-spotlight="start-vn-practice">
        <Play className="mr-2 size-5" /> {t('practiceSession.startPractice')}
      </Button>
    )

    if (hasWarmup || hasExamples) {
      return (
        <div className="mt-4 flex gap-3">
          {warmupBtn}
          {canShowPractice && practiceBtn}
        </div>
      )
    }

    if (canShowPractice) {
      return practiceBtnFull
    }

    return null
  }

  // ==================== Phase: Prepare ====================
  if (phase === 'prepare') {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-3 md:pt-4">
        {/* Header */}
        <div className="mb-4 flex min-h-10 items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={goBackToScene}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label={t('practiceSession.back')}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
            <p className="truncate text-xs text-muted-foreground">{detail.scene.category} · {detail.scene.title}</p>
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{detail.topic.title}</h1>
          </div>
          <Badge variant="secondary" className="shrink-0">{detail.topic.difficulty}</Badge>
        </div>
        <div className="mb-4 hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="icon" onClick={goBackToScene}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{detail.scene.category} · {detail.scene.title}</p>
            <h1 className="text-lg font-bold text-foreground">{detail.topic.title}</h1>
          </div>
          <Badge variant="secondary">{detail.topic.difficulty}</Badge>
        </div>

        <div className="space-y-5">
          {(detail.topic.description || detail.topic.knowledgePoints) && (
            <section className="rounded-lg bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Info className="size-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">{t('practiceSession.explanationTitle')}</p>
              </div>
              <div className="space-y-3">
                {detail.topic.description && (
                  <MarkdownRenderer
                    content={detail.topic.description}
                    className="text-muted-foreground prose-p:my-0 prose-ul:my-1 prose-ol:my-1"
                  />
                )}
                {detail.topic.knowledgePoints && (
                  <div className="rounded-md bg-background/55 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Lightbulb className="size-3.5 text-primary" /> {t('practiceSession.keyPoint')}
                    </div>
                    <MarkdownRenderer
                      content={detail.topic.knowledgePoints}
                      className="text-muted-foreground prose-p:my-0 prose-ul:my-1 prose-ol:my-1"
                    />
                  </div>
                )}
              </div>
              <Button variant="outline-primary" className="mt-4 min-h-11 w-full shadow-none" size="default" onClick={() => setTeachingOpen(true)}>
                <BookOpen className="size-4" />
                {t('practiceVn.teaching')}
              </Button>
            </section>
          )}

          {/* Teaching drawer — controlled, trigger is the Button above */}
          <PracticeVnDrawer
            teachingMarkdown={teachingMarkdown || detail.topic.teachingMarkdown || ''}
            hideToggles
            open={teachingOpen}
            onOpenChange={setTeachingOpen}
            unitId={unitId ?? undefined}
            topicId={topicId}
          />

          <section>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t('practiceSession.preparationTitle')}</h2>
                {!prepCollapsed && (
                <p className="mt-0.5 text-xs text-muted-foreground">{t('practiceSession.preparationSubtitle')}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full border-0 text-[11px] shadow-none">
                  {vocabTotal + chunkTotal + patternTotal} {t('practiceSession.items')}
                </Badge>
                <button
                  type="button"
                  onClick={() => setPrepCollapsed((prev) => !prev)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                  aria-label={prepCollapsed ? t('practiceSession.expandPrep') : t('practiceSession.collapsePrep')}
                >
                  <ChevronDown className={cn('size-4 transition-transform duration-200', prepCollapsed && '-rotate-90')} />
                </button>
              </div>
            </div>

            <ExpressionPrepSection
              vocabularies={prepMaterials.vocabularies}
              chunks={prepMaterials.chunks}
              patterns={prepMaterials.patterns}
              sceneName={detail.scene.title}
              collapsed={prepCollapsed}
              onCollapsedChange={setPrepCollapsed}
              collapsible
              onChunkExpand={activateChunk}
            />
          </section>

          <section className="rounded-lg bg-accent/[0.06] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">{t('practiceSession.practiceTitle')}</p>
              </div>
            </div>
            <p className="text-lg font-semibold leading-7 text-foreground">{detail.topic.promptEn}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail.topic.promptZh}</p>
            {renderPracticeButtons()}
          </section>
        </div>

        <LearningInsightDialog
          items={allInsightItems}
          index={Math.min(insightIndex, Math.max(allInsightItems.length - 1, 0))}
          open={insightOpen}
          onOpenChange={setInsightOpen}
          onIndexChange={setInsightIndex}
        />
        <SaveToNotebookDrawer
          open={saveDrawerOpen}
          onOpenChange={setSaveDrawerOpen}
          onSave={savePendingToNotebooks}
        />

        <Dialog open={guidedOpen} onOpenChange={(open) => { setGuidedOpen(open); if (!open) setImmersiveMode(false) }}>
          <DialogContent
            data-keyboard-overlay="practice"
            className="app-surface drawer-surface left-0 top-0 !z-[10000] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 md:left-[50%] md:top-[50%] md:h-[88vh] md:max-w-3xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl [&>button]:hidden"
          >
            <DialogTitle className="sr-only">{t('todayTask.practiceItem')}</DialogTitle>
            <DialogDescription className="sr-only">{t('practiceSession.warmupOutput')}</DialogDescription>
            <GuidedWarmupPhase
              packId={detail?.scene.id}
              topicId={topicId || ''}
              topicTitle={detail?.topic.title || ''}
              warmupItems={warmupItems}
              onBack={() => { setGuidedOpen(false); setImmersiveMode(false) }}
              onComplete={handleGuidedComplete}
            />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ==================== Phase: Practice (VN) ====================
  if (phase === 'practice') {
    const currentLine = vnDialogueLines[vnDialogueLines.length - 1]
    const canReview = inkEnded
    const characters = activeScene?.characters ?? detail.scene.characters ?? []
    const currentCharacter = characters.find((character) => {
      const speaker = vnVisual.speaker || (currentLine && !currentLine.isUser ? currentLine.speaker : undefined)
      return characterMatchesSpeaker(character, speaker)
    }) || (characters.length === 1 ? characters[0] : undefined)
    const expressionMap = currentCharacter?.expressions && typeof currentCharacter.expressions === 'object'
      ? currentCharacter.expressions as Record<string, string | { spriteUrl?: string; avatarUrl?: string }>
      : {}
    const currentState = (vnVisual.expression ? expressionMap[vnVisual.expression] : undefined) || expressionMap.default
    const stateSpriteUrl = typeof currentState === 'string' ? currentState : currentState?.spriteUrl
    const stateAvatarUrl = typeof currentState === 'object' ? currentState?.avatarUrl : undefined
    const currentSpriteUrl = currentCharacter
      ? stateSpriteUrl || currentCharacter.spriteBaseUrl || undefined
      : undefined
    const spritePosition = vnVisual.position || currentCharacter?.defaultPosition || 'center'
    const inputGuidance = {
      objective: readTagValue(currentTags, 'objective:'),
      hint: readTagValue(currentTags, 'hint:'),
    }

    return (<>
      <div className="app-surface relative flex h-dvh flex-col">
        {/* Floating minimal top bar */}
        <div className="absolute inset-x-0 top-0 z-40 flex justify-center px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
          <div className="grid h-9 w-full max-w-[400px] grid-cols-[1fr_auto_1fr] items-center gap-1 rounded-full bg-background/90 px-1.5 text-foreground shadow-none backdrop-blur-2xl">
          <div className="flex items-center justify-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Story finished (or already reviewing): leave freely. Mid-run still confirms abandon.
                if (inkEnded || analysisResult || practiceView === 'analysis') {
                  goBackToScene()
                } else {
                  setConfirmAbandonOpen(true)
                }
              }}
              className="h-7 shrink-0 rounded-full px-2.5 text-xs font-medium text-foreground/80 shadow-none hover:bg-primary/[0.16] hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> {t('practiceSession.back')}
            </Button>
          </div>

          <p className="max-w-[10rem] truncate text-center text-xs font-medium text-foreground/70" title={detail.topic.title}>
            {canReview
              ? (practiceView === 'analysis' ? t('scripts.aiReviewTab') : t('scripts.dialogueReplay'))
              : detail.topic.title}
          </p>

          <div className="flex items-center justify-end gap-1">
          {canReview && (
            <>
              <Sparkles className={cn('size-3.5', practiceView === 'analysis' ? 'text-primary' : 'text-muted-foreground')} />
              <Switch
                checked={practiceView === 'analysis'}
                onCheckedChange={(checked) => {
                  if (checked) void startAnalysis()
                  else setPracticeView('play')
                }}
                aria-label={t('learning.toggleAiReview')}
                title={practiceView === 'analysis' ? t('scripts.dialogueReplay') : t('scripts.aiReviewTab')}
              />
            </>
          )}

          {/* History & Settings — only in chat mode */}
          {isChatMode && practiceView === 'play' && (
          <>
          <button
            type="button"
            aria-label={t('vnHistory.title')}
            title={t('vnHistory.title')}
            onClick={() => vnPlayerRef.current?.toggleHistory()}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-primary/[0.16] hover:text-foreground"
          >
            <History className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={t('vnSettings.title')}
            title={t('vnSettings.title')}
            onClick={() => vnPlayerRef.current?.toggleSettings()}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-primary/[0.16] hover:text-foreground"
          >
            <Settings className="size-3.5" />
          </button>
          </>
          )}
          </div>
          </div>
        </div>

        {practiceView === 'analysis' ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-background px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
            <PracticeAnalysisPanel
              analysis={analysisResult}
              loading={analysisLoading}
              topicTitle={detail.topic.title}
              onBack={() => setPracticeView('play')}
              onRestart={resetPractice}
              onSaveExpression={saveAnalysisExpression}
            />
          </div>
        ) : (
        <div className="min-h-0 flex-1 bg-black">
          <VnPlayerBoundary>
            <VnPlayer
              ref={vnPlayerRef}
              className="h-full max-w-none rounded-none border-none bg-black"
              stageClassName="min-h-0"
              offlineOnly
              backgroundUrl={packMediaReady ? vnVisual.backgroundUrl : undefined}
              backgroundFit={vnVisual.backgroundFit}
              currentLine={!packMediaReady || inkEnded ? null : currentLine ?? null}
              history={packMediaReady ? vnDialogueLines : []}
              choices={packMediaReady ? inkChoices : []}
              currentSpriteUrl={packMediaReady ? currentSpriteUrl : undefined}
              spriteAlt={currentCharacter?.displayName || currentCharacter?.name}
              spritePosition={spritePosition}
              currentAvatarUrl={packMediaReady ? (stateAvatarUrl || currentCharacter?.avatarUrl || undefined) : undefined}
              currentAvatarAlt={currentCharacter?.displayName || currentCharacter?.name}
              isWaiting={!packMediaReady || inkWaiting}
              isEnded={packMediaReady && inkEnded}
              onSubmitInput={packMediaReady ? sendUserInput : undefined}
              inputFeedback={turnFeedback ? <PracticeTurnFeedback feedback={turnFeedback} onContinue={continueDespiteFeedback} /> : null}
              inputFeedbackChat={turnFeedback ? <PracticeTurnFeedback feedback={turnFeedback} onContinue={continueDespiteFeedback} tone="chat" /> : null}
              inputGuidance={inputGuidance}
              inputDisabled={!packMediaReady || turnFeedback?.status === 'loading' || Boolean(turnFeedback?.result?.passed)}
              onChoice={packMediaReady ? ((choiceIndex) => { setTurnFeedback(null); handleChoice(choiceIndex) }) : undefined}
              onAdvance={packMediaReady && inkJson ? () => { setTurnFeedback(null); advanceStory() } : undefined}
              hideChatTopBar
              endedActions={(
                <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full border-0 bg-background/70 px-4 text-xs text-foreground shadow-none hover:bg-muted hover:text-foreground"
                    onClick={goBackToScene}
                  >
                    {t('practiceSession.backToScene')}
                  </Button>
                  <Button type="button" size="sm" className="h-8 rounded-full border-0 px-4 text-xs shadow-none" onClick={() => void startAnalysis()}>
                    {t('practiceSession.viewReview')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full border-0 bg-background/70 px-4 text-xs text-foreground shadow-none hover:bg-muted hover:text-foreground"
                    onClick={restartPractice}
                  >
                    {t('practiceSession.retry')}
                  </Button>
                </div>
              )}
              onHistoryOpenChange={setIsHistoryOpen}
              onDisplayModeChange={handleVnDisplayModeChange}
              onWordInsight={handleWordInsight}
            />
          </VnPlayerBoundary>
        </div>
        )}

      </div>
      <LearningInsightDialog
        items={allInsightItems}
        index={Math.min(insightIndex, Math.max(allInsightItems.length - 1, 0))}
        open={insightOpen}
        onOpenChange={setInsightOpen}
        onIndexChange={setInsightIndex}
      />

      {/* 中途退出确认 */}
      <Dialog open={confirmAbandonOpen} onOpenChange={setConfirmAbandonOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-0 w-[90vw] shadow-none">
          <DialogHeader>
            <DialogTitle>{t('practiceSession.abandonTitle')}</DialogTitle>
            <DialogDescription>{t('practiceSession.abandonDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="!flex-row justify-center gap-2">
            <Button variant="secondary" className="border-0 shadow-none" onClick={() => setConfirmAbandonOpen(false)}>{t('practiceSession.continuePractice')}</Button>
            <Button
              onClick={() => {
                setConfirmAbandonOpen(false)
                setTurnFeedback(null)
                resetPractice()
              }}
            >
              {t('practiceSession.abandon')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    )
  }

  return null
}
