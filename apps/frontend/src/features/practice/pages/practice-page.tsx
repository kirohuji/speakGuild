import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, ArrowRight, Star, Eye, EyeOff, Languages, ChevronLeft, ChevronRight,
  Plus, Minus, SlidersHorizontal, Mic2, Loader2, AlertCircle, RotateCcw,
  Send, Mic, MessageSquare, Lightbulb, BookOpen, Volume2, GraduationCap,
  CheckCircle2, StopCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AudioPlayer } from '@/components/common/audio-player'
import { TtsSettingsDialog } from '@/components/common/tts-settings-dialog'
import { VoiceRecorder } from '@/components/common/voice-recorder'
import { getTopicQuestions, recordAction, type Question, type TopicQuestionsResult } from '@/features/practice/api'
import { addFavorite as apiFavorite, removeFavorite as apiUnfavorite } from '@/features/assets/api'
import { useAssetsStore, useWordsStore } from '@/stores/assets.store'
import { usePreferencesStore } from '@/stores/preferences.store'
import { synthesizeQuestion, synthesizeText, getAudioUrl, type TtsWordTimestamp } from '@/lib/tts-api'
import { transcribeRecording, streamFeedback, streamTeaching } from '@/lib/practice-ai-api'
import { cn } from '@/lib/cn'

// ---------- 音频状态 ----------
type AudioState =
  | { status: 'idle' }
  | { status: 'generating' }
  | { status: 'ready'; audioId: string; wordTimestamps: TtsWordTimestamp[] | null; provider: string }
  | { status: 'error'; message: string }

// 教学指导音频状态（直接存 URL，因为用任意文本合成接口）
type TeachAudioState =
  | { status: 'idle' }
  | { status: 'generating' }
  | { status: 'ready'; audioUrl: string; wordTimestamps: TtsWordTimestamp[] | null; provider: string }
  | { status: 'error'; message: string }

// ---------- 内联 AI 朗读按钮 ----------
function InlineTtsButton({
  audioState,
  ttsBackend,
  onGenerate,
  label,
}: {
  audioState: AudioState
  ttsBackend: { provider: string; model: string }
  onGenerate: () => void
  label?: string
}) {
  if (audioState.status === 'idle') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onGenerate}
        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary"
      >
        <Mic2 className="size-3.5" />
        {label ?? 'AI 朗读'}
      </Button>
    )
  }
  if (audioState.status === 'generating') {
    return (
      <Button variant="ghost" size="sm" disabled className="h-7 gap-1.5 text-xs">
        <Loader2 className="size-3.5 animate-spin" />
        合成中…
      </Button>
    )
  }
  if (audioState.status === 'error') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onGenerate}
        className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
      >
        <AlertCircle className="size-3.5" />
        重试
      </Button>
    )
  }
  // ready: show regenerate
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onGenerate}
      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary"
    >
      <RotateCcw className="size-3.5" />
      重新生成
    </Button>
  )
}

// ---------- 流式 Markdown 渲染（简单版）----------
function StreamingMarkdown({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  return (
    <div className="relative">
      <div
        className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
      />
      {isStreaming && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
      )}
    </div>
  )
}

/** markdown → HTML，正确包裹列表、处理段落 */
function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // h3
    if (/^### (.+)/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h3 class="mt-5 mb-2 text-sm font-semibold text-foreground flex items-center gap-1.5">${line.replace(/^### /, '')}</h3>`)
      continue
    }
    // h2
    if (/^## (.+)/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h2 class="mt-6 mb-2 text-base font-semibold text-foreground">${line.replace(/^## /, '')}</h2>`)
      continue
    }
    // list item (* or -)
    if (/^[*-] (.+)/.test(line)) {
      if (!inList) { out.push('<ul class="my-1.5 space-y-1 pl-1">'); inList = true }
      const text = line.replace(/^[*-] /, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      out.push(`<li class="flex gap-2 text-sm text-foreground/90"><span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60"></span><span>${text}</span></li>`)
      continue
    }
    // empty line
    if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false }
      continue
    }
    // plain text
    if (inList) { out.push('</ul>'); inList = false }
    const text = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    out.push(`<p class="text-sm text-foreground/90 leading-relaxed mb-1">${text}</p>`)
  }

  if (inList) out.push('</ul>')
  return out.join('\n')
}

export function PracticePage() {
  const { topicId } = useParams<{ topicId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { isFavorite, addFavorite, removeFavorite } = useAssetsStore()
  const { hasWord, addWord, removeWord } = useWordsStore()
  const { ttsBackend } = usePreferencesStore()

  const [topicData, setTopicData] = useState<TopicQuestionsResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [mode, setMode] = useState<'practice' | 'study'>('practice')
  const [ttsSettingsOpen, setTtsSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'answer' | 'feedback' | 'reference' | 'vocab'>('answer')

  // TTS 音频状态
  const [questionAudio, setQuestionAudio] = useState<AudioState>({ status: 'idle' })
  const [answerAudio, setAnswerAudio] = useState<AudioState>({ status: 'idle' })

  // 作答
  const [textAnswer, setTextAnswer] = useState('')
  const [voiceAnswer, setVoiceAnswer] = useState('')
  const [isVoiceMode, setIsVoiceMode] = useState(false)

  // AI 流式评分
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackStreaming, setFeedbackStreaming] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const feedbackAbortRef = useRef<AbortController | null>(null)

  // AI 教学指导（流式）
  const [teachText, setTeachText] = useState('')
  const [teachStreaming, setTeachStreaming] = useState(false)
  const [teachError, setTeachError] = useState('')
  const [showTeach, setShowTeach] = useState(false)
  const teachAbortRef = useRef<AbortController | null>(null)

  // 教学指导朗读
  const [teachAudio, setTeachAudio] = useState<TeachAudioState>({ status: 'idle' })
  const [showTeachPlayer, setShowTeachPlayer] = useState(false)

  const currentQuestion: Question | undefined = topicData?.questions[currentIndex]

  // 加载题目
  useEffect(() => {
    if (!topicId) return
    setIsLoading(true)
    getTopicQuestions(topicId)
      .then((data) => setTopicData(data))
      .catch(() => setError(t('common.error')))
      .finally(() => setIsLoading(false))
  }, [topicId, t])

  // 切题重置
  useEffect(() => {
    setQuestionAudio({ status: 'idle' })
    setAnswerAudio({ status: 'idle' })
    setTextAnswer('')
    setVoiceAnswer('')
    setFeedbackText('')
    setFeedbackError('')
    setTeachText('')
    setTeachError('')
    setShowTeach(false)
    setTeachAudio({ status: 'idle' })
    setShowTeachPlayer(false)
    setIsVoiceMode(false)
    setActiveTab('answer')
    setShowAnswer(false)
    setShowTranslation(false)
    feedbackAbortRef.current?.abort()
    teachAbortRef.current?.abort()
  }, [currentIndex, currentQuestion?.questionId])

  // TTS 配置变更时也重置
  useEffect(() => {
    setQuestionAudio({ status: 'idle' })
    setAnswerAudio({ status: 'idle' })
  }, [ttsBackend.provider, ttsBackend.model, ttsBackend.voiceId])

  const handleGenerateAudio = useCallback(async (textType: 'question' | 'answer') => {
    if (!currentQuestion) return
    const setter = textType === 'question' ? setQuestionAudio : setAnswerAudio
    setter({ status: 'generating' })
    try {
      const result = await synthesizeQuestion({
        questionId: currentQuestion.questionId,
        provider: ttsBackend.provider,
        model: ttsBackend.model,
        voiceId: ttsBackend.voiceId,
        params: ttsBackend.params,
        textType,
      })
      setter({
        status: 'ready',
        audioId: result.id,
        wordTimestamps: result.wordTimestamps as TtsWordTimestamp[] | null,
        provider: ttsBackend.provider,
      })
    } catch (e: any) {
      setter({ status: 'error', message: e?.response?.data?.message || e?.message || '生成失败' })
    }
  }, [currentQuestion, ttsBackend])

  // 流式 AI 评分
  const handleStreamFeedback = useCallback(async (isVoice: boolean) => {
    if (!currentQuestion) return
    const answer = isVoice ? voiceAnswer : textAnswer
    if (!answer.trim()) return

    feedbackAbortRef.current?.abort()
    const ctrl = new AbortController()
    feedbackAbortRef.current = ctrl

    setFeedbackStreaming(true)
    setFeedbackText('')
    setFeedbackError('')
    setIsVoiceMode(isVoice)
    setActiveTab('feedback')

    try {
      await streamFeedback(
        { questionId: currentQuestion.questionId, userAnswer: answer.trim(), isVoice },
        (delta) => setFeedbackText((prev) => prev + delta),
        ctrl.signal,
      )
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setFeedbackError(e?.message || 'AI 评分失败，请检查 DEEPSEEK_API_KEY')
      }
    } finally {
      setFeedbackStreaming(false)
    }
  }, [currentQuestion, textAnswer, voiceAnswer])

  // 流式教学指导
  const handleStreamTeach = useCallback(async () => {
    if (!currentQuestion) return

    teachAbortRef.current?.abort()
    const ctrl = new AbortController()
    teachAbortRef.current = ctrl

    setTeachStreaming(true)
    setTeachText('')
    setTeachError('')
    setShowTeach(true)
    setTeachAudio({ status: 'idle' })
    setShowTeachPlayer(false)

    try {
      await streamTeaching(
        { questionId: currentQuestion.questionId, userDraft: textAnswer || voiceAnswer },
        (delta) => setTeachText((prev) => prev + delta),
        ctrl.signal,
      )
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setTeachError(e?.message || '教学指导失败')
      }
    } finally {
      setTeachStreaming(false)
    }
  }, [currentQuestion, textAnswer, voiceAnswer])

  // 教学指导朗读合成
  const handleGenerateTeachAudio = useCallback(async () => {
    if (!teachText || teachStreaming) return
    setTeachAudio({ status: 'generating' })
    try {
      const result = await synthesizeText({
        text: teachText,
        provider: ttsBackend.provider,
        model: ttsBackend.model,
        voiceId: ttsBackend.voiceId,
        params: ttsBackend.params,
      })
      const url = `data:${result.mimeType};base64,${result.audioBase64}`
      setTeachAudio({
        status: 'ready',
        audioUrl: url,
        wordTimestamps: result.wordTimestamps,
        provider: ttsBackend.provider,
      })
      setShowTeachPlayer(true)
    } catch (e: any) {
      setTeachAudio({ status: 'error', message: e?.message || '生成失败' })
    }
  }, [teachText, teachStreaming, ttsBackend])

  const goToQuestion = useCallback(
    (index: number) => {
      if (!topicData) return
      const clamped = Math.max(0, Math.min(topicData.questions.length - 1, index))
      setCurrentIndex(clamped)
    },
    [topicData]
  )

  const handlePrev = useCallback(() => goToQuestion(currentIndex - 1), [currentIndex, goToQuestion])
  const handleNext = useCallback(() => goToQuestion(currentIndex + 1), [currentIndex, goToQuestion])

  const handleToggleFavorite = useCallback(async () => {
    if (!currentQuestion) return
    const qid = currentQuestion.questionId
    if (isFavorite(qid)) {
      removeFavorite(qid)
      try { await apiUnfavorite(qid) } catch {}
    } else {
      addFavorite(qid)
      try { await apiFavorite(qid) } catch {}
    }
    try {
      await recordAction({ questionId: qid, actionType: 'favorite', payload: { isFavorite: !isFavorite(qid) } })
    } catch {}
  }, [currentQuestion, isFavorite, addFavorite, removeFavorite])

  // 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      switch (e.key) {
        case 'a': case 'A': setShowAnswer((v) => !v); break
        case 't': case 'T': setShowTranslation((v) => !v); break
        case 'f': case 'F': handleToggleFavorite(); break
        case 'ArrowLeft': handlePrev(); break
        case 'ArrowRight': case 'Enter': handleNext(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePrev, handleNext, handleToggleFavorite])

  // ---------- Loading / Error ----------
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error) {
    return <div className="rounded-2xl bg-destructive/10 p-8 text-center text-destructive">{error}</div>
  }
  if (!topicData || topicData.questions.length === 0) {
    return <div className="py-20 text-center text-muted-foreground">{t('practice.noQuestions')}</div>
  }

  const total = topicData.questions.length
  const progress = Math.round(((currentIndex + 1) / total) * 100)
  const isFav = currentQuestion ? isFavorite(currentQuestion.questionId) : false
  const canSubmit = textAnswer.trim().length > 0 || voiceAnswer.trim().length > 0

  return (
    <div className="flex flex-col gap-4 pb-8">
      <TtsSettingsDialog open={ttsSettingsOpen} onOpenChange={setTtsSettingsOpen} />

      {/* ── 顶栏 ── */}
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-1">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="flex items-center gap-2">
          {/* 练习 / 学习模式 */}
          <div className="flex rounded-full bg-muted p-0.5">
          {(['practice', 'study'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-all',
                mode === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
              )}
            >
                {m === 'practice' ? '练习' : '学习'}
            </button>
          ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setTtsSettingsOpen(true)}
          >
            <SlidersHorizontal className="h-3 w-3" />
            语音
          </Button>
        </div>
      </div>

      {/* ── 进度条 ── */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{currentIndex + 1}</span>
          {' /'} {total}
                </span>
        <Progress value={progress} className="h-1.5 flex-1" />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline" size="icon"
            onClick={handlePrev} disabled={currentIndex === 0}
            className="h-7 w-7"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
          <Button
            variant="outline" size="icon"
            onClick={handleNext} disabled={currentIndex === total - 1}
            className="h-7 w-7"
          >
            <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

      {/* ── 题目卡（始终可见，紧凑） ── */}
      {currentQuestion && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* 标题行 */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">#{currentIndex + 1}</Badge>
                {currentQuestion.difficulty && (
                  <Badge variant="secondary" className="text-[10px]">{currentQuestion.difficulty}</Badge>
                )}
                {currentQuestion.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* 教学提示按钮 */}
                <Button
                  variant={showTeach ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleStreamTeach}
                  disabled={teachStreaming}
                >
                  {teachStreaming
                    ? <><Loader2 className="size-3 animate-spin" />思考中…</>
                    : <><Lightbulb className="size-3" />教学提示</>
                  }
                </Button>
                {/* 收藏 */}
                <Button
                  variant="ghost" size="icon"
                  onClick={handleToggleFavorite}
                  className={cn('h-7 w-7', isFav && 'text-yellow-500')}
                >
                  <Star className={cn('h-3.5 w-3.5', isFav && 'fill-yellow-400')} />
                </Button>
              </div>
            </div>

            {/* 题目文本 */}
            <div className="rounded-xl bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium leading-relaxed">{currentQuestion.questionText}</p>
            </div>

            {/* 翻译（折叠） */}
            {currentQuestion.translation && (
              <div>
                <button
                  onClick={() => setShowTranslation(!showTranslation)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Languages className="h-3 w-3" />
                  {showTranslation ? '隐藏翻译' : '查看翻译'}
                </button>
                {showTranslation && (
                  <div className="mt-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    {currentQuestion.translation}
                  </div>
                )}
              </div>
            )}

            {/* 题目朗读（内联） */}
            <div className="border-t border-border/40 pt-2">
              <div className="flex items-center gap-2">
                <Volume2 className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">题目朗读</span>
                <InlineTtsButton
                  audioState={questionAudio}
                  ttsBackend={ttsBackend}
                  onGenerate={() => handleGenerateAudio('question')}
                />
              </div>
              {questionAudio.status === 'ready' && (
                <div className="mt-2">
                  <AudioPlayer
                    audioUrl={getAudioUrl(questionAudio.audioId)}
                    wordTimestamps={questionAudio.wordTimestamps}
                    audioProvider={questionAudio.provider}
                  />
                </div>
              )}
            </div>

            {/* 教学指导面板（内联展开） */}
            {showTeach && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="size-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">AI 教学指导</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 朗读按钮（仅生成完毕后显示） */}
                    {!teachStreaming && teachText && !teachError && (
                      <>
                        {teachAudio.status === 'idle' && (
                          <button
                            onClick={handleGenerateTeachAudio}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Volume2 className="size-3" />朗读
                          </button>
                        )}
                        {teachAudio.status === 'generating' && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />合成中…
                          </span>
                        )}
                        {teachAudio.status === 'error' && (
                          <button
                            onClick={handleGenerateTeachAudio}
                            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80"
                          >
                            <AlertCircle className="size-3" />重试
                          </button>
                        )}
                        {teachAudio.status === 'ready' && (
                          <button
                            onClick={() => setShowTeachPlayer((v) => !v)}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            <Volume2 className="size-3" />
                            {showTeachPlayer ? '收起音频' : '展开音频'}
                          </button>
                        )}
                      </>
                    )}
                    {teachStreaming && (
                      <button
                        onClick={() => teachAbortRef.current?.abort()}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <StopCircle className="size-3" />停止
                      </button>
                    )}
                    <button
                      onClick={() => setShowTeach(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      收起
                    </button>
                  </div>
                </div>
                {teachError ? (
                  <div className="text-xs text-destructive">{teachError}</div>
                ) : (
                  <StreamingMarkdown content={teachText} isStreaming={teachStreaming} />
                )}
                {/* 朗读播放器（默认折叠） */}
                {teachAudio.status === 'ready' && showTeachPlayer && (
                  <div className="mt-3 border-t border-primary/20 pt-3">
                    <AudioPlayer
                      audioUrl={teachAudio.audioUrl}
                      wordTimestamps={teachAudio.wordTimestamps}
                      audioProvider={teachAudio.provider}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 主 Tab 面板 ── */}
      {currentQuestion && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 h-10 rounded-2xl bg-muted p-1">
            <TabsTrigger value="answer" className="rounded-xl text-xs gap-1.5">
              <MessageSquare className="size-3" />
              作答
            </TabsTrigger>
            <TabsTrigger value="feedback" className="rounded-xl text-xs gap-1.5 relative">
              <CheckCircle2 className="size-3" />
              AI 点评
              {feedbackText && !feedbackStreaming && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="reference" className="rounded-xl text-xs gap-1.5">
              <BookOpen className="size-3" />
              参考答案
            </TabsTrigger>
            <TabsTrigger value="vocab" className="rounded-xl text-xs gap-1.5">
              <Mic className="size-3" />
              词汇
            </TabsTrigger>
          </TabsList>

          {/* ── 作答 Tab ── */}
          <TabsContent value="answer" className="mt-3">
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* 合并作答：文字 + 录音同屏 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MessageSquare className="size-3.5" />
                    文字作答
                  </div>
                  <textarea
                    className="min-h-[130px] w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="用英语回答这道题目，尽量覆盖关键词和知识点…"
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{textAnswer.length} 字符</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleStreamTeach}
                        disabled={teachStreaming}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Lightbulb className="size-3.5" />
                        获取提示
                      </Button>
                      <Button
                        size="sm"
                        disabled={!textAnswer.trim() || feedbackStreaming}
                        onClick={() => handleStreamFeedback(false)}
                        className="h-8 gap-1.5"
                      >
                        {feedbackStreaming
                          ? <><Loader2 className="size-3.5 animate-spin" />评分中…</>
                          : <><Send className="size-3.5" />文字评分</>
                        }
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Mic className="size-3.5" />
                    录音作答
                  </div>
                  <VoiceRecorder onTranscribed={(text) => setVoiceAnswer(text)} />
                  {voiceAnswer && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">转写完成，可提交 AI 评分</span>
                      <Button
                        size="sm"
                        disabled={feedbackStreaming}
                        onClick={() => handleStreamFeedback(true)}
                        className="h-8 gap-1.5"
                      >
                        {feedbackStreaming
                          ? <><Loader2 className="size-3.5 animate-spin" />评分中…</>
                          : <><Send className="size-3.5" />录音评分</>
                        }
                      </Button>
                    </div>
                  )}
                </div>

                {/* 提交后的快捷跳转提示 */}
                {canSubmit && !feedbackText && !feedbackStreaming && (
                  <p className="text-center text-xs text-muted-foreground">
                    点击「AI 评分」后，结果将在「AI 点评」标签页中流式展示
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AI 点评 Tab ── */}
          <TabsContent value="feedback" className="mt-3">
            <Card>
              <CardContent className="p-4 space-y-3">
                {!feedbackText && !feedbackStreaming && !feedbackError && (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <CheckCircle2 className="size-10 text-muted-foreground/30" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">尚无评分结果</p>
                      <p className="text-xs text-muted-foreground/70">
                        在「作答」标签页输入答案后点击「AI 评分」
                      </p>
                    </div>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setActiveTab('answer')}
                      className="gap-1.5"
                    >
                      <MessageSquare className="size-3.5" />
                      去作答
                    </Button>
                  </div>
                )}

                {feedbackError && (
                  <div className="flex items-start gap-3 rounded-xl bg-destructive/10 p-4">
                    <AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" />
                    <div className="space-y-2">
                      <p className="text-sm text-destructive">{feedbackError}</p>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleStreamFeedback(isVoiceMode)}
                        className="h-7 gap-1.5 text-xs"
                      >
                        <RotateCcw className="size-3" />重试
                      </Button>
                    </div>
                  </div>
                )}

                {(feedbackText || feedbackStreaming) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-primary" />
                        <span className="text-sm font-semibold">AI 点评</span>
                        {isVoiceMode && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Mic className="mr-1 size-2.5" />语音作答
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {feedbackStreaming && (
                          <button
                            onClick={() => feedbackAbortRef.current?.abort()}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                          >
                            <StopCircle className="size-3" />停止
                          </button>
                        )}
                        {!feedbackStreaming && feedbackText && (
                          <button
                            onClick={() => handleStreamFeedback(isVoiceMode)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            <RotateCcw className="size-3" />重新评分
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-4">
                      <StreamingMarkdown content={feedbackText} isStreaming={feedbackStreaming} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 参考答案 Tab ── */}
          <TabsContent value="reference" className="mt-3">
            <Card>
              <CardContent className="p-4 space-y-4">
                {currentQuestion.referenceAnswer ? (
                  <>
                    <div className="relative">
                      {!showAnswer && mode === 'practice' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-muted/80 backdrop-blur-sm z-10">
                          <Eye className="size-6 text-muted-foreground/50" />
                          <Button
                            size="sm"
                            onClick={() => setShowAnswer(true)}
                            className="gap-1.5"
                          >
                            <Eye className="size-3.5" />
                            揭示参考答案
                          </Button>
                        </div>
                      )}
                      <p className="text-xs font-medium text-muted-foreground mb-2">参考答案</p>
                      <p className="text-sm leading-relaxed">{currentQuestion.referenceAnswer}</p>
                    </div>

                    {(showAnswer || mode === 'study') && (
                      <button
                        onClick={() => setShowAnswer(false)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <EyeOff className="h-3 w-3" />
                        重新遮挡
                      </button>
                    )}

                    {/* 答案朗读 */}
                    <div className="border-t border-border/40 pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Volume2 className="size-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">答案朗读</span>
                        <InlineTtsButton
                          audioState={answerAudio}
                          ttsBackend={ttsBackend}
                          onGenerate={() => handleGenerateAudio('answer')}
                        />
                      </div>
                      {answerAudio.status === 'ready' && (
                        <AudioPlayer
                          audioUrl={getAudioUrl(answerAudio.audioId)}
                          wordTimestamps={answerAudio.wordTimestamps}
                          audioProvider={answerAudio.provider}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    暂无参考答案
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 词汇 Tab ── */}
          <TabsContent value="vocab" className="mt-3">
            <div className="space-y-3">
              {/* 关键词 */}
              {(currentQuestion.keywords?.length || 0) > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">{t('practice.keywords')}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                      {currentQuestion.keywords?.map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => { if (hasWord(kw)) removeWord(kw); else addWord(kw) }}
                          className={cn(
                            'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all',
                            hasWord(kw)
                              ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          {kw}
                          {hasWord(kw)
                            ? <Minus className="h-2.5 w-2.5" />
                            : <Plus className="h-2.5 w-2.5" />
                          }
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 词汇列表 */}
              {(currentQuestion.vocabulary?.length || 0) > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">{t('practice.vocabulary')}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {currentQuestion.vocabulary?.map((v) => (
                      <div
                        key={v.word}
                        className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 p-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{v.word}</span>
                            {v.phonetic && (
                              <span className="text-xs text-muted-foreground">[{v.phonetic}]</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{v.meaning}</p>
                          {(v as any).example && (
                            <p className="text-xs italic text-muted-foreground/70 mt-1">{(v as any).example}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-7 w-7 shrink-0',
                            hasWord(v.word) && 'text-primary',
                          )}
                          onClick={() => { if (hasWord(v.word)) removeWord(v.word); else addWord(v.word) }}
                        >
                          {hasWord(v.word)
                            ? <Minus className="h-3.5 w-3.5 text-destructive" />
                            : <Plus className="h-3.5 w-3.5 text-primary" />
                          }
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

          {/* 题目信息 */}
          <Card>
                <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">{t('practice.info')}</CardTitle>
            </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>题目 ID</span>
                <span className="font-mono text-xs">{currentQuestion.questionId.slice(-8)}</span>
              </div>
              {currentQuestion.difficulty && (
                <div className="flex justify-between">
                  <span>难度</span>
                  <span>{currentQuestion.difficulty}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>序号</span>
                <span>{currentQuestion.orderIndex}</span>
              </div>
            </CardContent>
          </Card>

              {!(currentQuestion.keywords?.length || 0) && !(currentQuestion.vocabulary?.length || 0) && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无词汇数据
                </div>
                        )}
                      </div>
          </TabsContent>
        </Tabs>
      )}

      {/* ── 底部导航 ── */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          上一题
        </Button>
        <span className="text-xs text-muted-foreground">A·T·F·←→ 快捷键</span>
        <Button
          onClick={handleNext}
          disabled={currentIndex === total - 1}
          className="gap-2"
        >
          下一题
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
