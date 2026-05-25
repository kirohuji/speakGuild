import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, MicOff, Sparkles, BookOpen, Eye, EyeOff, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/cn'
import { practiceApi, practiceAiApi, chunkApi, type TopicDetail } from '../api/english-practice-api'
import { ChunkActivationPanel } from '../components/chunk-activation-panel'
import { SentencePatternPanel } from '../components/sentence-pattern-panel'

type Step = 'preview' | 'chunks' | 'record' | 'feedback' | 'upgrade' | 'retell'

export function PracticeSessionPage() {
  const { topicId } = useParams<{ topicId: string }>()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<TopicDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Flow state
  const [step, setStep] = useState<Step>('preview')
  const [activatedChunks, setActivatedChunks] = useState<Set<string>>(new Set())
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null)

  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // AI feedback
  const [feedbackText, setFeedbackText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [upgraded, setUpgraded] = useState<{ clear: string; natural: string; advanced: string } | null>(null)

  // Retell
  const [showMask, setShowMask] = useState(true)
  const [retellText, setRetellText] = useState('')
  const [selectedUpgrade, setSelectedUpgrade] = useState<'clear' | 'natural' | 'advanced'>('natural')

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
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [topicId])

  const activateChunk = useCallback(async (chunkId: string) => {
    try { await chunkApi.activate(chunkId) } catch {}
    setActivatedChunks((prev) => new Set([...prev, chunkId]))
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setTranscript('')

      // Auto-stop after suggested duration
      const duration = (detail?.topic.suggestedDurationSec ?? 60) * 1000
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, duration)
    } catch {
      alert('无法访问麦克风，请检查权限设置')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    // Simulate transcript for now (Whisper integration in later phase)
    setTranscript('[模拟转写] 用户已录音，等待语音转文字...')
  }

  const requestFeedback = async () => {
    setStep('feedback')
    setIsStreaming(true)
    setFeedbackText('')

    try {
      const res = await practiceAiApi.streamFeedback({
        userTranscript: transcript,
        promptEn: detail?.topic.promptEn,
        sceneTitle: detail?.scene.title,
        topicTitle: detail?.topic.title,
        outputLevel: 'L2',
      })
      if (!res.body) throw new Error('No stream body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setFeedbackText((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch (e: any) {
      setFeedbackText(`AI 反馈获取失败：${e.message}`)
    } finally {
      setIsStreaming(false)
    }
  }

  const loadUpgrade = async () => {
    setStep('upgrade')
    try {
      const res: any = await practiceAiApi.upgrade({
        userTranscript: transcript,
        outputLevel: 'L2',
      })
      // Try to parse JSON from AI response
      const match = res?.result?.match(/```json\s*([\s\S]*?)\s*```/)
      if (match) {
        setUpgraded(JSON.parse(match[1]))
      }
    } catch {}
  }

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

      {/* Step indicator */}
      <div className="mb-6 flex gap-1">
        {(['preview', 'chunks', 'record', 'feedback', 'upgrade', 'retell'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              step === s ? 'bg-primary' : steps.indexOf(step) > i ? 'bg-primary/40' : 'bg-muted',
            )}
          />
        ))}
      </div>

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4" /> 题目
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-foreground">{detail.topic.promptEn}</p>
              <p className="text-sm text-muted-foreground">{detail.topic.promptZh}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>建议时长：{detail.topic.suggestedDurationSec} 秒</span>
              </div>
            </CardContent>
          </Card>

          {detail.vocabularies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="size-4" /> 场景词汇 ({detail.vocabularies.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {detail.vocabularies.map((v) => (
                    <Badge key={v.id} variant="outline" className="text-sm">
                      {v.word}
                      <span className="ml-1 text-xs text-muted-foreground">{v.meaning}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button className="w-full" onClick={() => setStep('chunks')}>
            下一步：激活 Chunk
          </Button>
        </div>
      )}

      {/* Step: Chunks */}
      {step === 'chunks' && (
        <div className="space-y-4">
          <ChunkActivationPanel
            chunks={detail.activeChunks}
            activatedIds={activatedChunks}
            expandedId={expandedChunkId}
            onActivate={activateChunk}
            onExpand={setExpandedChunkId}
            onContinue={() => setStep('record')}
          />
          <SentencePatternPanel topic={detail.topic} />
        </div>
      )}

      {/* Step: Record */}
      {step === 'record' && (
        <div className="space-y-4">
          <Card className="text-center">
            <CardContent className="flex flex-col items-center gap-6 py-12">
              <p className="text-foreground">{detail.topic.promptEn}</p>
              <Button
                size="lg"
                variant={isRecording ? 'destructive' : 'default'}
                className={cn('size-24 rounded-full', isRecording && 'animate-pulse')}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? <MicOff className="size-10" /> : <Mic className="size-10" />}
              </Button>
              <p className="text-sm text-muted-foreground">
                {isRecording ? '正在录音...' : '点击开始录音'}
              </p>
              {transcript && (
                <div className="w-full rounded-lg bg-muted p-4 text-left">
                  <p className="text-sm text-foreground">{transcript}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('chunks')}>
              返回
            </Button>
            <Button
              className="flex-1"
              disabled={!transcript || isRecording}
              onClick={requestFeedback}
            >
              <Sparkles className="mr-1 size-4" /> AI 纠错
            </Button>
          </div>
        </div>
      )}

      {/* Step: Feedback */}
      {step === 'feedback' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" /> AI 纠错反馈
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isStreaming && !feedbackText && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Spinner className="size-4" /> AI 分析中...
                </div>
              )}
              {feedbackText && (
                <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm text-foreground">
                  {feedbackText}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('record')}>
              重新录音
            </Button>
            <Button className="flex-1" onClick={loadUpgrade} disabled={!feedbackText}>
              查看表达升级
            </Button>
          </div>
        </div>
      )}

      {/* Step: Upgrade */}
      {step === 'upgrade' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" /> 表达升级
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upgraded ? (
                <>
                  {(['clear', 'natural', 'advanced'] as const).map((level) => (
                    <div key={level} className="space-y-1">
                      <Badge variant="outline">
                        {level === 'clear' ? '清楚版' : level === 'natural' ? '自然版' : '进阶版'}
                      </Badge>
                      <p className="rounded-lg bg-muted p-3 text-sm text-foreground">{upgraded[level]}</p>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">AI 正在生成升级版本...</p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('feedback')}>
              返回
            </Button>
            <Button className="flex-1" onClick={() => setStep('retell')} disabled={!upgraded}>
              开始复述
            </Button>
          </div>
        </div>
      )}

      {/* Step: Retell */}
      {step === 'retell' && upgraded && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>遮挡复述</span>
                <Button variant="ghost" size="sm" onClick={() => setShowMask(!showMask)}>
                  {showMask ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {(['clear', 'natural', 'advanced'] as const).map((l) => (
                  <Badge
                    key={l}
                    variant={selectedUpgrade === l ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedUpgrade(l)}
                  >
                    {l === 'clear' ? '清楚' : l === 'natural' ? '自然' : '进阶'}
                  </Badge>
                ))}
              </div>
              <p className="rounded-lg bg-muted p-4 text-foreground">
                {showMask ? maskText(upgraded[selectedUpgrade]) : upgraded[selectedUpgrade]}
              </p>
              <textarea
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground"
                rows={3}
                placeholder="请复述以上内容..."
                value={retellText}
                onChange={(e) => setRetellText(e.target.value)}
              />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('upgrade')}>
              返回
            </Button>
            <Button className="flex-1" onClick={() => navigate('/expressions')}>
              <Save className="mr-1 size-4" /> 保存并完成
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const steps: Step[] = ['preview', 'chunks', 'record', 'feedback', 'upgrade', 'retell']

/** 简单遮挡：每三个词遮一个 */
function maskText(text: string): string {
  return text
    .split(' ')
    .map((w, i) => ((i + 1) % 3 === 0 ? '____' : w))
    .join(' ')
}
