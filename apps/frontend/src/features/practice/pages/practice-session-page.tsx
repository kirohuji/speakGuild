import { useState, useEffect, useRef, useCallback, useMemo, Component, type ReactNode, type ErrorInfo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Play, Info,
  Lightbulb, CheckCircle2, ChevronRight,
  BookText, Search, BookmarkPlus, History, Settings, ChevronDown, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
import { VnPlayer, type VnPlayerHandle } from '@/features/vn-engine/vn-player'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { compileInk } from '@/features/admin/components/ink-compiler'
import { practiceApi, practiceAiApi, chunkApi, type TopicDetail } from '../api/english-practice-api'
import { learningContentRepository, practiceRepository } from '@/lib/offline'
import { ChunkActivationPanel } from '../components/chunk-activation-panel'
import { ChunkOutputDrillCard } from '../components/chunk-output-drill-card'
import { VocabOutputCard } from '../components/vocab-output-card'
import { SentenceDecompositionCard } from '../components/sentence-decomposition-card'
import { LearningInsightDialog, type LearningInsightItem } from '../components/learning-insight-dialog'
import { PracticeVnDrawer } from '../components/practice-vn-drawer'
import { PracticeAnalysisPanel } from '../components/practice-analysis-panel'
import { useLayoutStore } from '@/stores/layout.store'
import { usePracticeStore } from '@/stores/practice.store'
import { MarkdownRenderer } from '@/components/common/markdown-renderer'

type Phase = 'prepare' | 'guided' | 'practice' | 'analysis'
const PASSED_FEEDBACK_LINGER_MS = 1500

interface TurnFeedback {
  status: 'loading' | 'success' | 'error'
  userText: string
  objective: string
  hint?: string
  targetChunks: string[]
  result?: {
    passed: boolean
    feedback: string
    chunksUsed: string[]
    targetWordsUsed?: string[]
    missingTargets?: string[]
    inkVariables: Record<string, string | number | boolean>
    correction?: string | null
    upgraded?: string | null
    retryRequired?: boolean
    retryPrompt?: string | null
    focusChunk?: string | null
    grammarIssues?: Array<{ type: string; original: string; correction: string }>
  }
  error?: string
}

function compilePracticeInk(inkSource?: string | null, fallbackJson?: Record<string, any> | null) {
  if (inkSource) {
    const result = compileInk(inkSource)
    if (result.success && result.json) return result.json
  }
  return fallbackJson ?? null
}

function readTagValue(tags: string[], prefix: string) {
  const raw = tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length).trim()
  if (!raw) return undefined
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function readInputNodeId(tags: string[]) {
  const inputTag = readTagValue(tags, 'input:') || readTagValue(tags, 'wait:')
  if (inputTag) return inputTag.match(/(?:^|[;,]\s*)id=([^;,]+)/)?.[1]?.trim() || inputTag
  if (tags.includes('input')) return 'input'
  if (tags.includes('wait')) return 'wait'
  return undefined
}

function readListTags(tags: string[], prefix: string) {
  return tags
    .filter((tag) => tag.startsWith(prefix))
    .flatMap((tag) => {
      const value = readTagValue([tag], prefix)
      return value ? value.split(/[|,]/).map((item) => item.trim()).filter(Boolean) : []
    })
}

function decodeTagValue(value?: string) {
  if (!value) return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseVnTags(tags: string[]) {
  const speaker = tags.find((t) => t.startsWith('speaker:'))?.replace('speaker:', '').trim()
  const expression = tags.find((t) => t.startsWith('expression:'))?.replace('expression:', '').trim()
  const audio = decodeTagValue(tags.find((t) => t.startsWith('audio:'))?.replace('audio:', '').trim())
  const bg = decodeTagValue(tags.find((t) => t.startsWith('bg:'))?.replace('bg:', '').trim())
  const bgFit = tags.find((t) => t.startsWith('bgFit:'))?.replace('bgFit:', '').trim()
  const position = tags.find((t) => t.startsWith('position:'))?.replace('position:', '').trim()
  const translation = decodeTagValue(tags.find((t) => t.startsWith('translation:'))?.replace('translation:', '').trim())
  return { speaker, expression, audio, bg, bgFit, position, translation }
}

function isBackgroundFit(value?: string): value is 'cover' | 'contain' | 'stretch' | 'repeat' {
  return value === 'cover' || value === 'contain' || value === 'stretch' || value === 'repeat'
}

function isSpritePosition(value?: string): value is 'left' | 'center' | 'right' {
  return value === 'left' || value === 'center' || value === 'right'
}

function normalizeSpeakerName(value?: string) {
  return (value || '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function characterMatchesSpeaker(character: NonNullable<TopicDetail['scene']['characters']>[number], speaker?: string) {
  const normalizedSpeaker = normalizeSpeakerName(speaker)
  if (!normalizedSpeaker) return false
  const candidates = [character.name, character.displayName].map(normalizeSpeakerName).filter(Boolean)
  return candidates.some((candidate) =>
    candidate === normalizedSpeaker ||
    normalizedSpeaker.startsWith(candidate) ||
    candidate.startsWith(normalizedSpeaker),
  )
}

/** Catches errors from VnPlayer / PixiVnStage to prevent cascading crashes */
class VnPlayerBoundary extends Component<
  { children: ReactNode; onFallback?: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onFallback?: () => void }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.warn('[VnPlayerBoundary] Caught:', error.message)
    this.props.onFallback?.()
  }

  render() {
    return this.props.children
  }
}

function PracticeTurnFeedback({
  feedback,
  onContinue,
  tone = 'vn',
}: {
  feedback: TurnFeedback
  onContinue: () => void
  tone?: 'vn' | 'chat'
}) {
  const { t } = useTranslation()
  const isLoading = feedback.status === 'loading'
  const isError = feedback.status === 'error'
  const isPassed = Boolean(feedback.result?.passed)
  const isRetry = Boolean(feedback.result?.retryRequired)
  const correction = feedback.result?.correction
  const upgraded = feedback.result?.upgraded
  const retryPrompt = feedback.result?.retryPrompt
  const grammarIssues = feedback.result?.grammarIssues ?? []
  const suggestedChunks = feedback.targetChunks.filter((chunk) => !feedback.result?.chunksUsed.includes(chunk))
  const example = suggestedChunks.length ? suggestedChunks.join(' ') : feedback.targetChunks.join(' ')
  const isChat = tone === 'chat'

  const icon = isLoading
    ? <Loader2 className="size-3.5 animate-spin text-primary" />
    : isPassed && !isRetry
      ? <CheckCircle2 className="size-3.5 text-green-500" />
      : isRetry
        ? <CheckCircle2 className="size-3.5 text-blue-500" />
        : <Lightbulb className="size-3.5 text-amber-500" />

  const title = isLoading
    ? t('practiceVn.feedbackEvaluating')
    : isPassed && !isRetry
      ? t('practiceVn.feedbackPassed')
      : isRetry
        ? '请重说一遍'
        : isError
          ? t('practiceVn.feedbackUnavailable')
          : t('practiceVn.feedbackRetry')

  return (
    <div className={cn(
      isChat
        ? 'rounded-lg bg-muted/65 px-3 py-2.5 text-foreground ring-1 ring-border/45'
        : 'border-t border-border/45 bg-background/72 px-3 py-2 pb-safe text-foreground backdrop-blur-xl',
    )}>
      <div className={cn('flex gap-2 mb-2', (isPassed && !isLoading) ? 'items-start' : 'items-center')}>
        <div className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full', isChat ? 'bg-background/70' : 'bg-muted/70')}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">{title}</p>
            {!isLoading && (!isPassed || isRetry) && (
              <button type="button" onClick={onContinue} className="shrink-0 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
                {t('practiceVn.continueAnyway')}
              </button>
            )}
          </div>
          {!isLoading && (
            <p className="mt-1 text-[11px] leading-4 text-foreground/75">
              {isError ? feedback.error : feedback.result?.feedback || t('practiceVn.feedbackContinue')}
            </p>
          )}

          {/* Retry correction: reuse existing card style */}
          {!isLoading && isRetry && (correction || upgraded) && (
            <div className="mt-2 space-y-1.5">
              {correction && (
                <div className="rounded bg-blue-500/10 px-2 py-1.5">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">{correction}</p>
                </div>
              )}
              {upgraded && (
                <div className="rounded bg-blue-500/5 px-2 py-1.5">
                  <p className="text-[10px] text-blue-500/70 dark:text-blue-300/70">{upgraded}</p>
                </div>
              )}
              {retryPrompt && (
                <p className="text-[11px] font-medium text-foreground/85">{retryPrompt}</p>
              )}
            </div>
          )}

          {/* Grammar issues */}
          {!isLoading && grammarIssues.length > 0 && (
            <div className="mt-2 space-y-1">
              {grammarIssues.slice(0, 3).map((issue, idx) => (
                <div key={idx} className="rounded bg-muted/60 px-2 py-1">
                  <p className="text-[10px] text-muted-foreground line-through">{issue.original}</p>
                  <p className="text-[10px] text-foreground/75">→ {issue.correction}</p>
                </div>
              ))}
            </div>
          )}

          {!isLoading && !isPassed && !isRetry && suggestedChunks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {suggestedChunks.map((chunk) => (
                <span key={chunk} className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">{chunk}</span>
              ))}
            </div>
          )}
          {!isLoading && !isPassed && !isRetry && (
            <details className="mt-2 text-[11px] text-foreground/75">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-foreground/75 hover:text-foreground">
                <ChevronDown className="size-3" />
                {t('practiceVn.viewExplanation')}
              </summary>
              <div className="mt-1.5 space-y-1 rounded bg-background/90 p-2 leading-4 text-foreground/80 ring-1 ring-border/35">
                <p><span className="text-muted-foreground">{t('practiceVn.objective')}：</span>{feedback.objective || t('practiceVn.defaultObjective')}</p>
                {feedback.hint && <p><span className="text-muted-foreground">{t('practiceVn.hint')}：</span>{feedback.hint}</p>}
                <p><span className="text-muted-foreground">{t('practiceVn.reference')}：</span>{example || t('practiceVn.defaultReference')}</p>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

/** Interactive guided warmup — uses ChunkOutputDrillCard and VocabOutputCard */
function GuidedWarmupPhase({
  topicId,
  topicTitle,
  warmupItems,
  onBack,
  onComplete,
  onStartPractice,
}: {
  topicId: string
  topicTitle: string
  warmupItems: any[]
  onBack: () => void
  onComplete: () => void
  onStartPractice: () => void
}) {
  const { t } = useTranslation()
  const storageKey = `guided-progress:${topicId}`

  // Count total sub-items
  const totalSteps = useMemo(() => {
    let count = 0
    for (const item of warmupItems) {
      if (item.type === 'chunk_substitution' || item.type === 'vocab_drill') {
        count += (item.items ?? item.vocabs ?? []).length
      } else if (item.type === 'vocab_sentence_building') {
        for (const p of (item.patterns ?? [])) count += (p.items ?? []).length
      } else if (item.type === 'sentence_decomposition') {
        count += (item.levels ?? []).length
      }
    }
    return count
  }, [warmupItems])

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

  const markDone = useCallback((stepId: string) => {
    setDoneIds(prev => {
      const next = new Set(prev)
      next.add(stepId)
      persistDone(next)
      return next
    })
  }, [persistDone])

  const doneCount = doneIds.size
  const allDone = totalSteps > 0 && doneCount >= totalSteps

  if (totalSteps === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col px-4 pb-24 pt-4">
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

  if (allDone) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col px-4 pb-24 pt-4">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-5" /></Button>
          <div className="flex-1"><p className="text-xs text-muted-foreground">{t('practiceSession.warmupTitle')}</p><h1 className="text-lg font-bold text-foreground">{topicTitle}</h1></div>
        </div>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle2 className="size-12 text-green-500" />
          <p className="text-sm font-semibold text-foreground">{doneCount}/{totalSteps} 已完成</p>
          <p className="text-xs text-muted-foreground">热身完成，开始 VN 对话吧</p>
          <Button onClick={onComplete}>{t('practiceSession.startPractice')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-5" /></Button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{t('practiceSession.warmupTitle')} · {doneCount}/{totalSteps}</p>
          <h1 className="text-lg font-bold text-foreground">{topicTitle}</h1>
        </div>
      </div>
      <Progress value={(doneCount / totalSteps) * 100} className="mb-4 h-1.5" />

      <div className="flex flex-col gap-4">
        {warmupItems.map((item: any) => {
          if (item.type === 'chunk_substitution') {
            return (
              <ChunkOutputDrillCard
                key={item.id}
                chunk={{ text: item.chunk, meaning: item.chunkMeaning || '', description: null }}
                items={(item.items ?? []).map((sub: any) => ({ zh: sub.zh, answer: sub.answer }))}
                direction={item.direction ?? 'zh_to_en'}
                groupTitle={item.title}
                onComplete={(_subIdx, _passed) => {
                  markDone(`${item.id}_${_subIdx}`)
                }}
              />
            )
          }
          if (item.type === 'vocab_drill') {
            return (
              <VocabOutputCard
                key={item.id}
                title={item.title}
                direction={item.direction ?? 'zh_to_en'}
                vocabs={(item.vocabs ?? []).map((v: any) => ({
                  vocabId: v.vocabId,
                  promptZh: v.promptZh,
                  targetWords: v.targetWords,
                  suggestedAnswer: v.suggestedAnswer,
                }))}
                onComplete={(_idx, _passed) => {
                  markDone(`${item.id}_${_idx}`)
                }}
              />
            )
          }
          if (item.type === 'vocab_sentence_building') {
            // 拆成多个 ChunkOutputDrillCard，每组一种 Chunk 搭配
            let flatIdx = 0
            return (
              <Card key={item.id} className="border-0 bg-muted/30 shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">核心词</Badge>
                    <span className="text-sm font-semibold text-primary">{item.vocabWord}</span>
                    <span className="text-xs text-muted-foreground">{item.vocabMeaning}</span>
                  </div>
                  {(item.patterns ?? []).map((pattern: any, patternIdx: number) => {
                    const startIdx = flatIdx
                    flatIdx += (pattern.items ?? []).length
                    return (
                      <ChunkOutputDrillCard
                        key={`${item.id}_${patternIdx}`}
                        chunk={{ text: pattern.chunk }}
                        items={pattern.items}
                        direction={item.direction ?? 'zh_to_en'}
                        groupTitle={`${item.vocabWord} + ${pattern.chunk}`}
                        onComplete={(subIdx, _passed) => {
                          markDone(`${item.id}_${startIdx + subIdx}`)
                        }}
                      />
                    )
                  })}
                </CardContent>
              </Card>
            )
          }
          if (item.type === 'sentence_decomposition') {
            return (
              <SentenceDecompositionCard
                key={item.id}
                title={item.title}
                levels={item.levels}
                onComplete={(_passed) => markDone(item.id)}
              />
            )
          }
          return null
        })}
      </div>

      {/* <div className="mt-6">
        <Button variant="ghost" className="w-full min-h-11" size="default" onClick={onStartPractice}>
          {t('practiceSession.startPractice')}
        </Button>
      </div> */}
    </div>
  )
}

export function PracticeSessionPage() {
  const { t } = useTranslation()
  const { topicId } = useParams<{ topicId: string }>()
  const [searchParams] = useSearchParams()
  const unitId = searchParams.get('unitId')
  const navigate = useNavigate()

  // ── Data ──
  const detail = usePracticeStore((s) => s.topicDetail)
  const fetchTopicDetail = usePracticeStore((s) => s.fetchTopicDetail)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Phase ──
  const [phase, setPhase] = useState<Phase>('prepare')

  // ── Prepare state ──
  const [activatedChunks, setActivatedChunks] = useState<Set<string>>(new Set())
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null)
  const [expandedVocabId, setExpandedVocabId] = useState<string | null>(null)
  const [expandedPatternIdx, setExpandedPatternIdx] = useState<number | null>(null)
  const [insightIndex, setInsightIndex] = useState(0)
  const [insightOpen, setInsightOpen] = useState(false)
  const [fallbackInsightItem, setFallbackInsightItem] = useState<LearningInsightItem | null>(null)
  const [collectedTexts, setCollectedTexts] = useState<Set<string>>(new Set())
  const [savingTexts, setSavingTexts] = useState<Set<string>>(new Set())
  const [confirmAbandonOpen, setConfirmAbandonOpen] = useState(false)

  // ── Practice (VN) state ──
  const [inkJson, setInkJson] = useState<Record<string, any> | null>(null)
  const [dialogueRounds, setDialogueRounds] = useState<{ speaker: string; text: string; isNpc: boolean; translation?: string; audioUrl?: string }[]>([])
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

  // ── Analysis state ──
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // ── History dialog visibility (hide drawer toggles when open) ──
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
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
  const [vnVisual, setVnVisual] = useState<{
    backgroundUrl?: string
    backgroundFit: 'cover' | 'contain' | 'stretch' | 'repeat'
    speaker?: string
    expression?: string
    position?: 'left' | 'center' | 'right'
  }>({ backgroundFit: 'cover' })

  // ── Immersive mode (hide layout chrome during practice) ──
  const setImmersiveMode = useLayoutStore((s) => s.setImmersiveMode)
  useEffect(() => {
    if (phase === 'practice' || phase === 'guided') {
      setImmersiveMode(true)
    } else {
      setImmersiveMode(false)
    }
    return () => { setImmersiveMode(false) }
  }, [phase, setImmersiveMode])

  // Switch to immersive mode BEFORE mounting PixiVnStage, so layout is stable
  const handleStartPractice = useCallback(async () => {
    setImmersiveMode(true)
    setPhase('practice')
    if (!topicId) return
    try {
      const session = await practiceRepository.createSession(topicId)
      console.log('[practice-session] 🆕 创建练习会话:', session.id)
      setPracticeSessionId(session.id)
    } catch (err) {
      console.error('[practice-session] ❌ 创建会话失败:', err)
      // Keep local practice usable even if session persistence is temporarily unavailable.
    }
  }, [setImmersiveMode, topicId])

  // Switch to guided warmup phase before practice
  const handleStartGuided = useCallback(() => {
    setImmersiveMode(true)
    setPhase('guided')
  }, [setImmersiveMode])

  // Complete guided and go to practice
  const handleGuidedComplete = useCallback(async () => {
    setPhase('practice')
    if (!topicId) return
    try {
      const session = await practiceRepository.createSession(topicId)
      console.log('[practice-session] 🆕 创建练习会话:', session.id)
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

  // ==================== Load Data ====================
  useEffect(() => {
    if (!topicId) return
    setLoading(true)
    fetchTopicDetail(topicId).finally(() => setLoading(false))
  }, [topicId, fetchTopicDetail])

  // detail 加载完成后做后处理
  useEffect(() => {
    if (!detail) return
    const learnedChunkIds = detail.activeChunks
      .filter((chunk) => chunk.masteryStatus !== 'not_learned')
      .map((chunk) => chunk.id)
    setActivatedChunks(new Set(learnedChunkIds))
    setExpandedChunkId(detail.activeChunks[0]?.id ?? null)

    const compiledInk = compilePracticeInk(detail.inkScript?.inkSource, detail.inkScript?.inkJson)
    setTeachingMarkdown(detail.topic.teachingMarkdown || '')
    if (compiledInk) {
      setInkJson(compiledInk)
    } else if (detail.topic.inkScriptId) {
      practiceRepository.getTopicInk(topicId!).then((ink) => {
        const compiled = compilePracticeInk(ink?.inkSource, ink?.inkJson)
        if (compiled) setInkJson(compiled)
      }).catch(() => {})
    }
  }, [detail, topicId])

  // 句型表达式始终可见（不在 tab 内），mount 时加载
  useEffect(() => {
    learningContentRepository.listExpressionTexts('pattern').then((texts) => {
      setCollectedTexts((prev) => new Set([...prev, ...texts]))
    })
  }, [])

  // 按 tab 懒加载：vocab → word, chunk → chunk
  const [prepTab, setPrepTab] = useState('vocab')
  const loadedPrepTabs = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (loadedPrepTabs.current.has(prepTab)) return
    loadedPrepTabs.current.add(prepTab)
    if (prepTab === 'vocab') {
      learningContentRepository.listExpressionTexts('word').then((texts) => {
        setCollectedTexts((prev) => new Set([...prev, ...texts]))
      })
    } else if (prepTab === 'chunk') {
      learningContentRepository.listExpressionTexts('chunk').then((texts) => {
        setCollectedTexts((prev) => new Set([...prev, ...texts]))
      })
    }
  }, [prepTab])

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

  useEffect(() => {
    syncedInkLineCountRef.current = 0
  }, [inkJson])

  useEffect(() => {
    setVnVisual({
      backgroundUrl: detail?.scene.backgroundUrl || undefined,
      backgroundFit: 'cover',
    })
  }, [detail?.scene.backgroundUrl, inkJson])

  useEffect(() => {
    const tags = currentTags
    if (tags.length === 0) return

    const parsed = parseVnTags(tags)
    const latestNpcLine = [...dialogueRounds].reverse().find((line) => line.isNpc && line.speaker)

    setVnVisual((prev) => ({
      backgroundUrl: parsed.bg || prev.backgroundUrl || detail?.scene.backgroundUrl || undefined,
      backgroundFit: isBackgroundFit(parsed.bgFit) ? parsed.bgFit : prev.backgroundFit,
      speaker: parsed.speaker || latestNpcLine?.speaker || prev.speaker,
      expression: parsed.expression || prev.expression || 'default',
      position: isSpritePosition(parsed.position) ? parsed.position : prev.position,
    }))

    // Parse #input hint tags for the PracticeVnDrawer
    const hintText = readTagValue(tags, 'hint:')
    const objectiveText = readTagValue(tags, 'objective:')
    const chunkTexts = readListTags(tags, 'chunks:')

    if (hintText || objectiveText || chunkTexts.length > 0) {
      setAiHints((prev) => {
        const next = [...prev]
        if (objectiveText) next.push({ type: 'pattern' as const, text: objectiveText })
        if (hintText) next.push({ type: 'pattern' as const, text: hintText })
        for (const c of chunkTexts) {
          if (!next.some((h) => h.text === c)) next.push({ type: 'chunk' as const, text: c })
        }
        return next
      })
    }
  }, [currentTags, detail?.scene.backgroundUrl, dialogueRounds])

  // Sync Ink lines to dialogue display
  useEffect(() => {
    const newLines = inkLines.slice(syncedInkLineCountRef.current)
    if (newLines.length === 0) return
    syncedInkLineCountRef.current = inkLines.length
    const newDialogues = newLines.filter(Boolean).map((line) => ({
      speaker: line.speaker ?? (line.tags?.includes('npc') ? fallbackNpcName : ''),
      text: line.text,
      isNpc: true, // All Ink lines are NPC/narration; user lines added by sendUserInput
      translation: parseVnTags(line.tags).translation,
      audioUrl: parseVnTags(line.tags).audio,
    }))
    setDialogueRounds((prev) => [...prev, ...newDialogues])
  }, [inkLines, fallbackNpcName])

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
          meaning: p.meaning, example: p.example, difficulty: p.difficulty, sceneName,
        }))
      : []
    return [...words, ...chunks, ...patterns]
  }, [detail])

  const allInsightItems = useMemo(
    () => fallbackInsightItem ? [...insightItems, fallbackInsightItem] : insightItems,
    [insightItems, fallbackInsightItem],
  )

  const openInsight = useCallback((id: string) => {
    const idx = insightItems.findIndex((item) => item.id === id)
    if (idx < 0) return
    setInsightIndex(idx)
    setInsightOpen(true)
  }, [insightItems])

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

  const handleCollectWord = useCallback(async (word: string, meaning: string) => {
    setSavingTexts((prev) => new Set([...prev, word]))
    try {
      const vocab = detail?.vocabularies?.find((item) => item.word.toLowerCase() === word.toLowerCase())
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'word',
        text: word,
        meaning: vocab?.meaning ?? meaning,
        sceneName: detail?.scene.title,
        contentSnapshot: vocab ?? { word, meaning },
        sourceType: 'learning-library',
      })
      setCollectedTexts((prev) => new Set([...prev, word]))
      toast.success('已加入学习库')
    } catch { toast.error('加入失败') }
    setSavingTexts((prev) => { const s = new Set(prev); s.delete(word); return s })
  }, [detail])

  const handleCollectPattern = useCallback(async (pattern: { pattern: string; meaning?: string; example?: string; sceneName?: string }) => {
    setSavingTexts((prev) => new Set([...prev, pattern.pattern]))
    try {
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'pattern',
        text: pattern.pattern,
        meaning: pattern.meaning,
        sceneName: pattern.sceneName,
        contentSnapshot: pattern,
        sourceType: 'learning-library',
      })
      setCollectedTexts((prev) => new Set([...prev, pattern.pattern]))
      toast.success('已加入学习库')
    } catch { toast.error('加入失败') }
    setSavingTexts((prev) => { const s = new Set(prev); s.delete(pattern.pattern); return s })
  }, [])

  const handleCollectChunk = useCallback(async (chunk: TopicDetail['activeChunks'][number]) => {
    setSavingTexts((prev) => new Set([...prev, chunk.text]))
    try {
      await learningContentRepository.saveExpressionEntryAndSync({
        kind: 'chunk',
        text: chunk.text,
        meaning: chunk.meaning,
        sceneName: detail?.scene.title,
        contentSnapshot: chunk,
        sourceType: 'learning-library',
      })
      setCollectedTexts((prev) => new Set([...prev, chunk.text]))
      toast.success('已加入学习库')
    } catch { toast.error('加入失败') }
    setSavingTexts((prev) => { const s = new Set(prev); s.delete(chunk.text); return s })
  }, [detail])

  const handleRemoveExpression = useCallback(async (kind: 'word' | 'chunk' | 'pattern', text: string) => {
    setSavingTexts((prev) => new Set([...prev, text]))
    try {
      await learningContentRepository.deleteExpressionByTextAndSync(kind, text)
      setCollectedTexts((prev) => { const s = new Set(prev); s.delete(text); return s })
      toast.success('已从学习库移除')
    } catch { toast.error('移除失败') }
    setSavingTexts((prev) => { const s = new Set(prev); s.delete(text); return s })
  }, [])

  // ==================== Practice: Send Input ====================
  const sendUserInput = useCallback(async (text: string, audioUrl?: string) => {
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
          error: error?.response?.data?.message || error?.message || 'AI 评估暂时不可用',
        })
        return
      }

      if (practiceSessionId) {
        console.log(`[practice-session] 📤 submitTurn Ink路径 | round=${round} | sessionId=${practiceSessionId} | passed=${passed} | userText="${userMsg.slice(0, 40)}..."`)
        practiceRepository.submitTurn(practiceSessionId, {
          round,
          npcText,
          userText: userMsg,
          userAudioUrl: audioUrl,
          inputNodeId: readInputNodeId(currentTags),
          tags: currentTags,
          judgement: turnJudgement,
          objectivesCompleted: objectiveCompleted,
          chunksUsed: chunksUsedForRound,
          isRetry: retryState === 'retrying',
          parentTurnId: retryState === 'retrying' ? String(parentRoundRef.current) : undefined,
        }).then(() => {
          console.log(`[practice-session] ✅ submitTurn 成功 | round=${round}`)
        }).catch((err) => {
          console.error(`[practice-session] ❌ submitTurn 失败 | round=${round}:`, err)
        })
      }

      if (passed) {
        setDialogueRounds((prev) => [...prev, { speaker: '你', text: userMsg, isNpc: false, audioUrl }])
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

    setDialogueRounds((prev) => [...prev, { speaker: '你', text: userMsg, isNpc: false, audioUrl }])
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
      console.log(`[practice-session] 📤 submitTurn Fallback路径 | round=${round} | sessionId=${practiceSessionId} | userText="${userMsg.slice(0, 40)}..."`)
      practiceRepository.submitTurn(practiceSessionId, {
        round,
        npcText,
        userText: userMsg,
        userAudioUrl: audioUrl,
        objectivesCompleted: [...completedObjectives],
        chunksUsed: [...usedChunks],
      }).then(() => {
        console.log(`[practice-session] ✅ submitTurn 成功 | round=${round}`)
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
          text: `试试使用: "${hint.text}"`,
          meaning: hint.meaning,
        }])
      }
    }, 800)

    if (fallbackRound > 0 && fallbackRound % 2 === 0 && objectives.length > 0) {
      const idx = fallbackRound % objectives.length
      setCompletedObjectives((prev) => new Set([...prev, objectives[idx]]))
    }
  }, [dialogueRounds, fallbackRound, inkJson, topicId, resumeAfterInput, completedObjectives, usedChunks, coreChunkTexts, objectives, fallbackNpcName, currentTags, practiceSessionId])

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
    if (analysisResult) {
      setPhase('analysis')
      return
    }
    setPhase('analysis')
    setAnalysisLoading(true)
    try {
      if (!practiceSessionId) {
        console.warn('[practice-session] ⚠️ startAnalysis 时 practiceSessionId 为 null，无法分析')
        setAnalysisResult({ summary: '缺少练习会话记录，无法进行分析' })
        setAnalysisLoading(false)
        return
      }
      console.log(`[practice-session] 🔍 开始复盘分析 | practiceSessionId=${practiceSessionId}`)
      const res = await practiceRepository.completeSession(practiceSessionId).then(() => practiceRepository.analyzeSession(practiceSessionId))
      console.log(`[practice-session] 🔍 分析返回:`, res?.analysis ? `有结果 (summary=${res.analysis.summary?.slice(0, 50)}...)` : '无结果')
      setAnalysisResult(res.analysis ?? res)
    } catch (e: any) {
      setAnalysisResult({ summary: `分析失败: ${e.message}` })
    } finally {
      setAnalysisLoading(false)
    }
  }, [topicId, detail, analysisResult, practiceSessionId])

  const saveAnalysisExpression = useCallback(async (data: {
    type: string
    original?: string
    corrected?: string
    chunkText?: string
    sceneName?: string
  }) => {
    await practiceApi.saveExpression({
      ...data,
      sceneName: data.sceneName || detail?.scene.title,
    })
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

  // ==================== Phase: Prepare ====================
  if (phase === 'prepare') {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
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
          {(detail.topic.description || detail.topic.knowledgePoints || detail.sentencePatterns?.length) && (
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
                {detail.sentencePatterns?.length ? (
                  <div className="space-y-2">
                    {detail.sentencePatterns.map((p, i) => {
                      const isExpanded = expandedPatternIdx === i
                      return (
                        <Card key={i} className={cn('border-0 bg-muted/30 shadow-none transition-colors', isExpanded && 'bg-primary/[0.06]')}>
                          <CardContent className="p-0">
                            <button
                              type="button"
                              onClick={() => setExpandedPatternIdx((prev) => (prev === i ? null : i))}
                              className="flex w-full items-center gap-3 p-3 text-left"
                            >
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
                                <Search className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-foreground">{p.pattern}</p>
                                  <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">{p.difficulty ?? '句型'}</Badge>
                                  {collectedTexts.has(p.pattern) && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">已收录</Badge>}
                                </div>
                                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{p.meaning}</p>
                              </div>
                              <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                            </button>
                            {isExpanded && (
                              <div className="border-t border-border/50 px-3 pb-3 pt-2">
                                {p.example && <p className="text-sm leading-6 text-muted-foreground">{t('practiceSession.example')}: {p.example}</p>}
                                <div className="flex gap-2 mt-2">
                                  <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 text-xs" onClick={() => openInsight(`pattern:${i}`)}>
                                    <Search className="size-3.5" /> 查看
                                  </Button>
                                  <Button size="sm" variant={collectedTexts.has(p.pattern) ? 'secondary' : 'default'} className="h-8 flex-1 gap-1.5 text-xs" disabled={savingTexts.has(p.pattern)} onClick={collectedTexts.has(p.pattern) ? () => handleRemoveExpression('pattern', p.pattern) : () => handleCollectPattern({ pattern: p.pattern, meaning: p.meaning, example: p.example, sceneName: detail?.scene.title })} data-spotlight="bookmark-btn">
                                    <BookmarkPlus className="size-3.5" /> {savingTexts.has(p.pattern) ? '处理中...' : collectedTexts.has(p.pattern) ? '已加入' : '加入学习库'}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t('practiceSession.preparationTitle')}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('practiceSession.preparationSubtitle')}</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[11px]">
                {detail.vocabularies.length + detail.activeChunks.length} {t('practiceSession.items')}
              </Badge>
            </div>

            <Tabs value={prepTab} onValueChange={setPrepTab} className="w-full">
              <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg bg-muted/70 p-1">
                <TabsTrigger value="vocab" className="rounded-md text-xs">{t('practiceSession.sceneVocab')} ({detail.vocabularies.length})</TabsTrigger>
                <TabsTrigger value="chunk" className="rounded-md text-xs">{t('practiceSession.coreExpressions')} ({detail.activeChunks.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="vocab" className="mt-3">
                {detail.vocabularies.length > 0 ? (
                  <div className="space-y-2">
                    {detail.vocabularies.map((v) => {
                      const isExpanded = expandedVocabId === v.id
                      return (
                        <Card
                          key={v.id}
                          className={cn(
                            'border-0 bg-muted/30 shadow-none transition-colors',
                            isExpanded && 'bg-primary/[0.06]',
                          )}
                        >
                          <CardContent className="p-0">
                            <button
                              type="button"
                              onClick={() => setExpandedVocabId((prev) => (prev === v.id ? null : v.id))}
                              className="flex w-full items-center gap-3 p-3 text-left"
                            >
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                <BookText className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-foreground">{v.word}</p>
                                  {collectedTexts.has(v.word) && <Badge variant="secondary" className="h-5 shrink-0 rounded-full px-2 text-[10px]">已收录</Badge>}
                                </div>
                                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{v.meaning}</p>
                              </div>
                              <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                            </button>
                            {isExpanded && (
                              <div className="border-t border-border/50 px-3 pb-3 pt-2">
                                {/* <p className="text-sm leading-6 text-muted-foreground">{v.meaning}</p> */}
                                <div className="flex gap-2 mt-2">
                                  <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 text-xs" onClick={() => openInsight(`word:${v.id}`)}>
                                    <Search className="size-3.5" /> 查看
                                  </Button>
                                  <Button size="sm" variant={collectedTexts.has(v.word) ? 'secondary' : 'default'} className="h-8 flex-1 gap-1.5 text-xs" disabled={savingTexts.has(v.word)} onClick={collectedTexts.has(v.word) ? () => handleRemoveExpression('word', v.word) : () => handleCollectWord(v.word, v.meaning)}>
                                    <BookmarkPlus className="size-3.5" /> {savingTexts.has(v.word) ? '处理中...' : collectedTexts.has(v.word) ? '已加入' : '加入学习库'}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg bg-muted/25 py-8 text-center text-sm text-muted-foreground">{t('practiceSession.noVocab')}</p>
                )}
              </TabsContent>

              <TabsContent value="chunk" className="mt-3">
                <ChunkActivationPanel
                  chunks={detail.activeChunks}
                  activatedIds={activatedChunks}
                  collectedTexts={collectedTexts}
                  savingTexts={savingTexts}
                  expandedId={expandedChunkId}
                  onActivate={activateChunk}
                  onExpand={setExpandedChunkId}
                  onInspect={(chunkId) => openInsight(`chunk:${chunkId}`)}
                  onCollect={handleCollectChunk}
                  onRemove={(chunk) => handleRemoveExpression('chunk', chunk.text)}
                />
              </TabsContent>
            </Tabs>
          </section>

          <section className="rounded-lg bg-accent/[0.06] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">{t('practiceSession.practiceTitle')}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {t('practiceHub.suggested')} {Math.max(1, Math.round(detail.topic.suggestedDurationSec / 60))} {t('practiceSession.minutes')}
              </span>
            </div>
            <p className="text-lg font-semibold leading-7 text-foreground">{detail.topic.promptEn}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail.topic.promptZh}</p>
            {detail?.topic?.metadata?.outputTraining?.enabled && detail?.topic?.metadata?.outputTraining?.pipeline?.length > 0 ? (
              <div className="mt-4 flex gap-3">
                <Button className="flex-1 min-h-11" variant="outline" size="default" onClick={handleStartGuided} data-spotlight="start-guided-warmup">
                  {t('practiceSession.startWarmup')}
                </Button>
                <Button className="flex-1 min-h-11 bg-accent text-accent-foreground hover:bg-accent/85" size="default" onClick={handleStartPractice}>
                  <Play className="mr-1.5 size-4" /> {t('practiceSession.startPractice')}
                </Button>
              </div>
            ) : detail?.activeChunks?.some(c => c.examples?.length) ? (
              <div className="mt-4 flex gap-3">
                <Button className="flex-1 min-h-11" variant="outline" size="default" onClick={handleStartGuided} data-spotlight="start-guided-warmup">
                  {t('practiceSession.startWarmup')}
                </Button>
                <Button className="flex-1 min-h-11 bg-accent text-accent-foreground hover:bg-accent/85" size="default" onClick={handleStartPractice}>
                  <Play className="mr-1.5 size-4" /> {t('practiceSession.startPractice')}
                </Button>
              </div>
            ) : (
              <Button className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/85" size="lg" onClick={handleStartPractice} data-spotlight="start-vn-practice">
                <Play className="mr-2 size-5" /> {t('practiceSession.startPractice')}
              </Button>
            )}
          </section>
        </div>

        <LearningInsightDialog
          items={allInsightItems}
          index={Math.min(insightIndex, Math.max(allInsightItems.length - 1, 0))}
          open={insightOpen}
          onOpenChange={setInsightOpen}
          onIndexChange={setInsightIndex}
        />
      </div>
    )
  }

  // ==================== Phase: Guided (输出热身) ====================
  if (phase === 'guided') {
    const metadataPipeline = detail?.topic?.metadata?.outputTraining?.pipeline ?? []
    const metadataItems = metadataPipeline.filter((item: any) =>
      item.type === 'chunk_substitution' || item.type === 'vocab_drill' || item.type === 'vocab_sentence_building' || item.type === 'sentence_decomposition'
    )

    // Auto-generate warmup items from activeChunks with examples if no metadata pipeline
    const autoItems = metadataItems.length === 0
      ? (detail?.activeChunks ?? [])
          .filter(c => c.examples?.length)
          .map(c => ({
            id: c.id,
            type: 'chunk_substitution' as const,
            title: c.text,
            chunk: c.text,
            chunkMeaning: c.meaning || '',
            items: (c.examples ?? []).map((e: any) => ({ zh: e.zh, answer: e.en })),
          }))
      : []

    const warmupItems = metadataItems.length > 0 ? metadataItems : autoItems

    return (
      <GuidedWarmupPhase
        topicId={topicId || ''}
        topicTitle={detail?.topic.title || ''}
        warmupItems={warmupItems}
        onBack={() => setPhase('prepare')}
        onComplete={handleGuidedComplete}
        onStartPractice={handleStartPractice}
      />
    )
  }

  // ==================== Phase: Practice (VN) ====================
  if (phase === 'practice') {
    const currentLine = dialogueRounds[dialogueRounds.length - 1]
    const canReview = inkEnded
    const characters = detail.scene.characters ?? []
    const currentCharacter = characters.find((character) => {
      const speaker = vnVisual.speaker || (currentLine?.isNpc ? currentLine.speaker : undefined)
      return characterMatchesSpeaker(character, speaker)
    }) || (characters.length === 1 ? characters[0] : undefined)
    const expressionMap = currentCharacter?.expressions && typeof currentCharacter.expressions === 'object'
      ? currentCharacter.expressions as Record<string, string>
      : {}
    const currentSpriteUrl = currentCharacter
      ? (vnVisual.expression ? expressionMap[vnVisual.expression] : undefined) || expressionMap.default || currentCharacter.spriteBaseUrl || undefined
      : undefined
    const spritePosition = vnVisual.position || currentCharacter?.defaultPosition || 'center'
    const inputGuidance = {
      objective: readTagValue(currentTags, 'objective:'),
      hint: readTagValue(currentTags, 'hint:'),
    }

    return (<>
      <div className="relative flex h-dvh flex-col bg-background">
        {/* Floating minimal top bar */}
        <div className="absolute inset-x-0 top-0 z-30 flex justify-center px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
          <div className="flex h-9 w-full max-w-[400px] items-center gap-1 rounded-full border border-border/55 bg-background/90 px-1.5 text-foreground shadow-lg ring-1 ring-primary/[0.08] backdrop-blur-2xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (analysisResult) {
                goBackToScene()
              } else {
                setConfirmAbandonOpen(true)
              }
            }}
            className="h-7 shrink-0 rounded-full px-2.5 text-xs font-medium text-foreground/80 shadow-none hover:bg-primary/[0.16] hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> {t('practiceSession.back')}
          </Button>

          <PracticeVnDrawer
            teachingMarkdown={teachingMarkdown}
            onOpen={refreshTeachingMarkdown}
            hideToggles={isHistoryOpen}
            plainTrigger
            triggerClassName="mx-auto inline-flex h-7 min-w-[92px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-primary/[0.16] active:bg-primary/[0.22]"
          />

          {canReview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startAnalysis}
              className="h-7 shrink-0 rounded-full px-2.5 text-xs font-medium text-foreground/80 shadow-none hover:bg-primary/[0.16] hover:text-foreground"
            >
              <CheckCircle2 className="size-3.5" />
              {t('practiceSession.review')}
            </Button>
          )}

          {/* History & Settings — only in chat mode */}
          {isChatMode && (
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

        <div className="min-h-0 flex-1 bg-background">
          <VnPlayerBoundary>
            <VnPlayer
              ref={vnPlayerRef}
              className="h-full max-w-none rounded-none border-none"
              stageClassName="min-h-0"
              backgroundUrl={vnVisual.backgroundUrl || detail.scene.backgroundUrl || undefined}
              backgroundFit={vnVisual.backgroundFit}
              currentLine={inkEnded ? null : currentLine ? { speaker: currentLine.speaker, text: currentLine.text, isUser: !currentLine.isNpc, translation: currentLine.translation, audioUrl: currentLine.audioUrl } : null}
              history={dialogueRounds.map((line) => ({ speaker: line.speaker, text: line.text, isUser: !line.isNpc, translation: line.translation, audioUrl: line.audioUrl }))}
              choices={inkChoices}
              currentSpriteUrl={currentSpriteUrl}
              spriteAlt={currentCharacter?.displayName || currentCharacter?.name}
              spritePosition={spritePosition}
              currentAvatarUrl={currentCharacter?.avatarUrl || undefined}
              currentAvatarAlt={currentCharacter?.displayName || currentCharacter?.name}
              isWaiting={inkWaiting}
              isEnded={inkEnded}
              onSubmitInput={sendUserInput}
              inputFeedback={turnFeedback ? <PracticeTurnFeedback feedback={turnFeedback} onContinue={continueDespiteFeedback} /> : null}
              inputFeedbackChat={turnFeedback ? <PracticeTurnFeedback feedback={turnFeedback} onContinue={continueDespiteFeedback} tone="chat" /> : null}
              inputGuidance={inputGuidance}
              inputDisabled={turnFeedback?.status === 'loading' || Boolean(turnFeedback?.result?.passed)}
              onChoice={(choiceIndex) => { setTurnFeedback(null); handleChoice(choiceIndex) }}
              onAdvance={inkJson ? () => { setTurnFeedback(null); advanceStory() } : undefined}
              hideChatTopBar
              endedActions={(
                <div className="flex gap-2">
                  <Button type="button" size="sm" className="h-8 rounded-full px-4 text-xs" onClick={startAnalysis}>
                    {t('practiceSession.viewReview')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full border-border/60 bg-background/70 px-4 text-xs text-foreground hover:bg-muted hover:text-foreground"
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

        {/* Input area — hidden for now */}
        <div className="hidden" />

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
        <DialogContent className="max-w-sm rounded-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>放弃本次练习？</DialogTitle>
            <DialogDescription>中途退出不会计入记录，当前进度将丢失。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="!flex-row justify-center gap-2">
            <Button variant="outline" onClick={() => setConfirmAbandonOpen(false)}>继续练习</Button>
            <Button
              onClick={() => {
                setConfirmAbandonOpen(false)
                setTurnFeedback(null)
                resetPractice()
              }}
            >
              放弃
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    )
  }

  // ==================== Phase: Analysis ====================
  if (phase === 'analysis') {
    return (<>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{detail.scene.category} · {detail.scene.title}</p>
            <h1 className="text-lg font-bold text-foreground">{detail.topic.title}</h1>
          </div>
          <Badge variant="secondary">{detail.topic.difficulty}</Badge>
        </div>

        {/* Phase indicator */}
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-green-500/10 px-3.5 py-3">
          <CheckCircle2 className="size-5 text-green-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{t('practiceSession.reviewTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('practiceSession.reviewSubtitle')}</p>
          </div>
        </div>

        <PracticeAnalysisPanel
          analysis={analysisResult}
          loading={analysisLoading}
          topicTitle={detail.topic.title}
          onBack={goBackToScene}
          onRestart={resetPractice}
          onSaveExpression={saveAnalysisExpression}
        />
      </div>
      <LearningInsightDialog
        items={allInsightItems}
        index={Math.min(insightIndex, Math.max(allInsightItems.length - 1, 0))}
        open={insightOpen}
        onOpenChange={setInsightOpen}
        onIndexChange={setInsightIndex}
      />
    </>
    )
  }

  return null
}
