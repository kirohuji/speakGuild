import { useState, useEffect, useRef, useCallback, useMemo, Component, type ReactNode, type ErrorInfo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Mic, MicOff, BookOpen, Send, Play, Info,
  Lightbulb, CheckCircle2, RotateCcw, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/cn'
import { VnPlayer } from '@/features/vn-engine/vn-player'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { practiceApi, practiceAiApi, chunkApi, type TopicDetail } from '../api/english-practice-api'
import { ChunkActivationPanel } from '../components/chunk-activation-panel'
import { LearningInsightDialog, type LearningInsightItem } from '../components/learning-insight-dialog'
import { PracticeVnDrawer } from '../components/practice-vn-drawer'
import { PracticeAnalysisPanel } from '../components/practice-analysis-panel'
import { useLayoutStore } from '@/stores/layout.store'

type Phase = 'prepare' | 'practice' | 'analysis'

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

export function PracticeSessionPage() {
  const { topicId } = useParams<{ topicId: string }>()
  const navigate = useNavigate()

  // ── Data ──
  const [detail, setDetail] = useState<TopicDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Phase ──
  const [phase, setPhase] = useState<Phase>('prepare')

  // ── Prepare state ──
  const [activatedChunks, setActivatedChunks] = useState<Set<string>>(new Set())
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null)
  const [expandedVocabId, setExpandedVocabId] = useState<string | null>(null)
  const [insightIndex, setInsightIndex] = useState(0)
  const [insightOpen, setInsightOpen] = useState(false)

  // ── Practice (VN) state ──
  const [inkJson, setInkJson] = useState<Record<string, any> | null>(null)
  const [dialogueRounds, setDialogueRounds] = useState<{ speaker: string; text: string; isNpc: boolean }[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [inputText, setInputText] = useState('')
  const [transcript, setTranscript] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Fallback NPC dialogue (when no Ink script)
  const [fallbackRound, setFallbackRound] = useState(0)
  const fallbackNpcName = detail?.scene?.title ?? 'NPC'

  // Side drawer state
  const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(new Set())
  const [usedChunks, setUsedChunks] = useState<Set<string>>(new Set())
  const [aiHints, setAiHints] = useState<{ type: 'chunk' | 'pattern'; text: string; meaning?: string; example?: string }[]>([])

  // ── Analysis state ──
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // ── Immersive mode (hide layout chrome during practice) ──
  const setImmersiveMode = useLayoutStore((s) => s.setImmersiveMode)
  useEffect(() => {
    if (phase === 'practice') {
      setImmersiveMode(true)
    } else {
      setImmersiveMode(false)
    }
    return () => { setImmersiveMode(false) }
  }, [phase, setImmersiveMode])

  // Switch to immersive mode BEFORE mounting PixiVnStage, so layout is stable
  const handleStartPractice = useCallback(() => {
    setImmersiveMode(true)
    setPhase('practice')
  }, [setImmersiveMode])

  // ── Objectives & chunks from detail ──
  const objectives = useMemo(() => {
    const objs: string[] = []
    if (detail?.topic.sentencePatterns?.length) {
      detail.topic.sentencePatterns.forEach((p) => objs.push(`使用句型: ${p.pattern}`))
    }
    if (detail?.topic.sentenceSkeleton) {
      objs.push(`参考结构: ${detail.topic.sentenceSkeleton}`)
    }
    objs.push(`围绕话题 "${detail?.topic.title}" 展开对话`)
    if (objs.length === 0) objs.push('完成至少3轮对话互动')
    return objs
  }, [detail])

  const coreChunkTexts = useMemo(() => {
    return (detail?.activeChunks ?? []).map((c) => ({ text: c.text, meaning: c.meaning }))
  }, [detail])

  // ==================== Load Data ====================
  useEffect(() => {
    if (!topicId) return
    setLoading(true)
    practiceApi
      .getTopicDetail(topicId)
      .then((data) => {
        setDetail(data)
        const learnedChunkIds = data.activeChunks
          .filter((chunk) => chunk.masteryStatus !== 'not_learned')
          .map((chunk) => chunk.id)
        setActivatedChunks(new Set(learnedChunkIds))
        setExpandedChunkId(data.activeChunks[0]?.id ?? null)

        // Load Ink script if available
        if (data.inkScript?.inkJson) {
          setInkJson(data.inkScript.inkJson)
        } else if (data.topic.inkScriptId) {
          practiceApi.getTopicInk(topicId).then((ink) => {
            if (ink?.inkJson) setInkJson(ink.inkJson)
          }).catch(() => {})
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [topicId])

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

  const {
    lines: inkLines,
    choices: inkChoices,
    isWaiting: inkWaiting,
    advanceStory,
    handleChoice,
    resumeAfterInput,
  } = useInkStory(inkJson, { onExternalFunction: handleExternalFn })

  // Sync Ink lines to dialogue display
  useEffect(() => {
    if (inkLines.length === 0) return
    const newDialogues = inkLines.map((line) => ({
      speaker: line.speaker ?? (line.tags?.includes('npc') ? fallbackNpcName : ''),
      text: line.text,
      isNpc: line.tags?.includes('npc') || !!line.speaker,
    }))
    setDialogueRounds(newDialogues)
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
      kind: 'word', id: `word:${v.id}`, word: v.word, meaning: v.meaning, sceneName,
    }))
    const chunks: LearningInsightItem[] = detail.activeChunks.map((c) => ({
      kind: 'chunk', id: `chunk:${c.id}`, text: c.text, meaning: c.meaning,
      description: c.description, examples: c.examples, sceneName,
    }))
    const patterns: LearningInsightItem[] = detail.topic.sentencePatterns?.length
      ? detail.topic.sentencePatterns.map((p, i) => ({
          kind: 'pattern', id: `pattern:${i}`, pattern: p.pattern,
          meaning: p.meaning, example: p.example, difficulty: p.difficulty, sceneName,
        }))
      : []
    return [...words, ...chunks, ...patterns]
  }, [detail])

  const openInsight = useCallback((id: string) => {
    const idx = insightItems.findIndex((item) => item.id === id)
    if (idx < 0) return
    setInsightIndex(idx)
    setInsightOpen(true)
  }, [insightItems])

  // ==================== Practice: Recording ====================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setTranscript('')
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, 60000)
    } catch { alert('无法访问麦克风，请检查权限设置') }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    setTranscript('[语音转写] 用户回答内容...')
  }

  // ==================== Practice: Send Input ====================
  const sendUserInput = useCallback((text: string) => {
    if (!text.trim()) return

    const round = dialogueRounds.length + 1
    const userMsg = text.trim()

    setDialogueRounds((prev) => [...prev, { speaker: '你', text: userMsg, isNpc: false }])
    setTranscript('')
    setInputText('')

    // Track chunk usage
    coreChunkTexts.forEach((c) => {
      if (userMsg.toLowerCase().includes(c.text.toLowerCase())) {
        setUsedChunks((prev) => new Set([...prev, c.text]))
      }
    })

    // If using Ink engine
    if (inkJson) {
      practiceApi.submitDialogue(topicId!, {
        round,
        npcText: dialogueRounds[dialogueRounds.length - 1]?.text ?? '',
        userText: userMsg,
        objectivesCompleted: [...completedObjectives],
        chunksUsed: [...usedChunks],
      }).catch(() => {})
      resumeAfterInput(userMsg)
      return
    }

    // Fallback: simulate NPC response
    const npcResponses = [
      `That's interesting! Tell me more about that.`,
      `I see. Could you give me an example?`,
      `Great point! What else comes to mind?`,
      `I understand. Let me ask you another question—why do you think that is?`,
    ]
    const npcText = npcResponses[fallbackRound % npcResponses.length]

    setTimeout(() => {
      setDialogueRounds((prev) => [
        ...prev,
        { speaker: fallbackNpcName, text: npcText, isNpc: true },
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
  }, [dialogueRounds, fallbackRound, inkJson, topicId, resumeAfterInput, completedObjectives, usedChunks, coreChunkTexts, objectives, fallbackNpcName])

  const handleSendText = () => {
    if (!inputText.trim()) return
    sendUserInput(inputText)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  // ==================== Analysis ====================
  const startAnalysis = useCallback(async () => {
    if (!topicId || !detail) return
    setPhase('analysis')
    setAnalysisLoading(true)
    try {
      const res = await practiceAiApi.dialogueSummary({
        topicId,
        topicTitle: detail.topic.title,
        promptEn: detail.topic.promptEn,
        objectives,
        coreChunks: coreChunkTexts.map((c) => c.text),
      })
      setAnalysisResult(res.analysis ?? res)
    } catch (e: any) {
      setAnalysisResult({ summary: `分析失败: ${e.message}` })
    } finally {
      setAnalysisLoading(false)
    }
  }, [topicId, detail, objectives, coreChunkTexts])

  const resetPractice = () => {
    setDialogueRounds([])
    setFallbackRound(0)
    setCompletedObjectives(new Set())
    setUsedChunks(new Set())
    setAiHints([])
    setTranscript('')
    setInputText('')
    setPhase('prepare')
  }

  // ==================== Loading / Error ====================
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-destructive">{error || '话题不存在'}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>返回</Button>
      </div>
    )
  }

  // ==================== Phase: Prepare ====================
  if (phase === 'prepare') {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
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
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3">
          <Info className="size-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">准备阶段</p>
            <p className="text-xs text-muted-foreground">熟悉话题、词汇和表达，准备好后开始练习</p>
          </div>
          <Button
            size="sm"
            onClick={handleStartPractice}
            className="shrink-0"
          >
            <Play className="mr-1 size-4" /> 开始练习
          </Button>
        </div>

        <div className="space-y-4">
          {/* 题目 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4" /> 题目
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-lg font-medium text-foreground">{detail.topic.promptEn}</p>
              <p className="text-sm text-muted-foreground">{detail.topic.promptZh}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>建议时长：{detail.topic.suggestedDurationSec} 秒</span>
              </div>
            </CardContent>
          </Card>

          {/* 介绍说明 */}
          {detail.topic.description && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="size-4" /> 介绍说明
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {detail.topic.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* 知识点讲解 */}
          {(detail.topic.knowledgePoints || detail.topic.sentencePatterns?.length) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="size-4" /> 知识点讲解
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {detail.topic.knowledgePoints && (
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {detail.topic.knowledgePoints}
                  </p>
                )}
                {detail.topic.sentencePatterns?.map((p, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                    <Badge variant="outline" className="mb-1 text-xs">{p.difficulty ?? '句型'}</Badge>
                    <p className="text-sm font-mono text-foreground">{p.pattern}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.meaning}</p>
                    {p.example && (
                      <p className="mt-1 text-xs italic text-muted-foreground">例: {p.example}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tabs: 场景词汇 | 核心表达 */}
          <Tabs defaultValue="vocab" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="vocab" className="flex-1 text-xs">场景词汇 ({detail.vocabularies.length})</TabsTrigger>
              <TabsTrigger value="chunk" className="flex-1 text-xs">核心表达 ({detail.activeChunks.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="vocab" className="mt-2">
              {detail.vocabularies.length > 0 ? (
                <div className="space-y-1">
                  {detail.vocabularies.map((v) => {
                    const isExpanded = expandedVocabId === v.id
                    return (
                      <div key={v.id} className={cn(
                        'rounded-lg border transition-all',
                        isExpanded ? 'border-blue-500/40 bg-blue-500/5' : 'border-border bg-card',
                      )}>
                        <button
                          onClick={() => setExpandedVocabId((prev) => (prev === v.id ? null : v.id))}
                          className="flex w-full items-center justify-between p-2.5 text-left"
                        >
                          <span className={cn('text-sm font-bold', isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-foreground')}>
                            {v.word}
                          </span>
                          {!isExpanded && <span className="text-xs text-muted-foreground">{v.meaning}</span>}
                        </button>
                        {isExpanded && (
                          <div className="border-t border-blue-500/20 px-3 pb-2.5 pt-1.5">
                            <p className="text-sm text-foreground">{v.meaning}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">本话题暂无场景词汇</p>
              )}
            </TabsContent>

            <TabsContent value="chunk" className="mt-2">
              <ChunkActivationPanel
                chunks={detail.activeChunks}
                activatedIds={activatedChunks}
                expandedId={expandedChunkId}
                onActivate={activateChunk}
                onExpand={setExpandedChunkId}
                onInspect={(chunkId) => openInsight(`chunk:${chunkId}`)}
              />
            </TabsContent>
          </Tabs>

          {/* Bottom Start button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleStartPractice}
          >
            <Play className="mr-2 size-5" /> 开始练习
          </Button>
        </div>

        <LearningInsightDialog
          items={insightItems}
          index={Math.min(insightIndex, Math.max(insightItems.length - 1, 0))}
          open={insightOpen}
          onOpenChange={setInsightOpen}
          onIndexChange={setInsightIndex}
        />
      </div>
    )
  }

  // ==================== Phase: Practice (VN) ====================
  if (phase === 'practice') {
    const showInkChoices = inkChoices.length > 0
    const isInputDisabled = isRecording || showInkChoices
    const currentLine = dialogueRounds[dialogueRounds.length - 1]

    return (
      <div className="relative flex h-dvh flex-col bg-background">
        {/* Floating minimal top bar */}
        <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPhase('prepare')}
            className="rounded-full bg-background/40 text-xs text-muted-foreground backdrop-blur-md hover:bg-background/60 hover:text-foreground"
          >
            <ArrowLeft className="mr-1 size-3.5" /> 返回
          </Button>

          <div className="flex items-center gap-1.5 rounded-full bg-background/40 px-2.5 py-1 backdrop-blur-md">
            <span className="text-xs text-muted-foreground">
              轮次 <span className="font-mono font-medium text-foreground">{dialogueRounds.filter(d => !d.isNpc).length}</span>
            </span>
            <span className="mx-1 text-border">·</span>
            <button
              onClick={startAnalysis}
              disabled={dialogueRounds.filter(d => !d.isNpc).length < 2}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            >
              结束对话
            </button>
          </div>

          <div className="w-[68px]" />
        </div>

        <div className="min-h-0 flex-1 bg-black">
          <VnPlayerBoundary>
            <VnPlayer
              className="h-full max-w-none rounded-none border-none"
              stageClassName="min-h-0"
              currentLine={currentLine ? { speaker: currentLine.speaker, text: currentLine.text, isUser: !currentLine.isNpc } : null}
              history={dialogueRounds.map((line) => ({ speaker: line.speaker, text: line.text, isUser: !line.isNpc }))}
              choices={inkChoices}
              isWaiting={inkWaiting}
              onChoice={handleChoice}
              onAdvance={inkJson ? advanceStory : undefined}
            />
          </VnPlayerBoundary>
        </div>

        {(isRecording || transcript) && (
          <div className="absolute inset-x-4 bottom-24 z-40 rounded-xl border border-border/60 bg-background/92 p-3 shadow-lg backdrop-blur-md">
            {isRecording ? (
              <div className="flex items-center justify-center gap-2 text-sm text-destructive">
                <Mic className="size-4 animate-pulse" />
                正在录音...
              </div>
            ) : (
              <div>
                <p className="text-sm text-foreground">{transcript}</p>
                <p className="mt-1 text-xs text-muted-foreground">转写预览</p>
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="px-3 pb-3 pt-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
          {transcript ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setTranscript('')}>
                重新录音
              </Button>
              <Button className="flex-1" onClick={() => sendUserInput(transcript)}>
                <Send className="mr-1 size-4" /> 发送
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant={isRecording ? 'destructive' : 'outline'}
                size="icon"
                className="shrink-0"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isInputDisabled && !isRecording}
              >
                {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </Button>
              <div className="relative flex-1">
                <textarea
                  className="w-full resize-none rounded-xl border border-border bg-background/80 p-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={2}
                  placeholder={isInputDisabled ? '等待 NPC 说完...' : '输入你的回答...'}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isInputDisabled}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute bottom-1 right-1 size-7"
                  onClick={handleSendText}
                  disabled={!inputText.trim() || isInputDisabled}
                >
                  <Send className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Side drawers */}
        <PracticeVnDrawer
          objectives={objectives.map((o) => ({ text: o, completed: completedObjectives.has(o) }))}
          hints={aiHints}
          coreChunks={coreChunkTexts}
          usedChunkTexts={usedChunks}
        />
      </div>
    )
  }

  // ==================== Phase: Analysis ====================
  if (phase === 'analysis') {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
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
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-green-500/10 px-4 py-3">
          <CheckCircle2 className="size-5 text-green-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">对话复盘</p>
            <p className="text-xs text-muted-foreground">AI 分析你的对话表现</p>
          </div>
        </div>

        <PracticeAnalysisPanel
          analysis={analysisResult}
          loading={analysisLoading}
          topicTitle={detail.topic.title}
          onBack={() => setPhase('practice')}
          onFinish={() => navigate('/expressions')}
        />

        {/* Action buttons */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={resetPractice}
          >
            <RotateCcw className="mr-1 size-4" /> 重新练习
          </Button>
          <Button
            className="flex-1"
            onClick={() => navigate('/expressions')}
          >
            查看表达库 <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>
    )
  }

  return null
}
