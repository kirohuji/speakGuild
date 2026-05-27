import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ClipboardCheck, Mic, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { VoiceRecorder } from '@/components/common/voice-recorder'
import { cn } from '@/lib/cn'
import { onboardingApi } from '../api/onboarding-api'

const QUESTIONS = [
  {
    id: 'self_intro',
    title: '介绍一下你自己',
    prompt: 'Please introduce yourself, including your background and why you want to improve English speaking.',
  },
  {
    id: 'daily_scene',
    title: '讲一个真实场景',
    prompt: 'Describe a recent situation where you needed to use English. What happened?',
  },
  {
    id: 'opinion',
    title: '表达一个观点',
    prompt: 'What is one skill you want to improve this month, and how will you practice it?',
  },
]

type DiagnosticPhase = 'intro' | 'recording' | 'result'

type DiagnosticAnswer = {
  questionId: string
  question: string
  transcript: string
}

type DiagnosticResult = {
  outputLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  levelDescription: string
  dimensions: Record<string, { score: number; comment: string }>
  mainProblems: string[]
  recommendedPath: string
  recommendedScenes: string[]
  answers: DiagnosticAnswer[]
}

const LEVEL_COPY: Record<DiagnosticResult['outputLevel'], string> = {
  L1: '能说出关键词和简单句，需要先建立开口习惯。',
  L2: '能回答基础问题，但句子长度和连接还不稳定。',
  L3: '能完成日常表达，下一步要提升自然度和完整度。',
  L4: '能自然交流常见话题，可以训练更复杂的观点表达。',
  L5: '表达较成熟，适合打磨准确度、语气和高阶表达。',
}

function clampScore(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)))
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function scoreDiagnostic(answers: DiagnosticAnswer[]): DiagnosticResult {
  const transcripts = answers.map((answer) => answer.transcript.trim()).filter(Boolean)
  const words = transcripts.reduce((sum, text) => sum + wordCount(text), 0)
  const answeredCount = transcripts.length
  const avgWords = answeredCount ? words / answeredCount : 0
  const joined = transcripts.join(' ').toLowerCase()
  const connectorHits = (joined.match(/\b(and|but|because|so|then|also|first|finally|however|for example)\b/g) ?? []).length
  const sentenceCount = Math.max(1, (joined.match(/[.!?]/g) ?? []).length)
  const fillerHits = (joined.match(/\b(um|uh|er|like you know)\b/g) ?? []).length

  const answerLength = clampScore(avgWords / 6)
  const grammarAccuracy = clampScore(6 + Math.min(2, sentenceCount / 4) - Math.min(3, fillerHits / 3))
  const chunkUsage = clampScore(4 + Math.min(4, connectorHits))
  const logicCompleteness = clampScore(answeredCount * 2.2 + Math.min(3, connectorHits / 2))
  const naturalness = clampScore(5 + Math.min(3, avgWords / 28) - Math.min(2, fillerHits / 5))
  const fluency = clampScore(4 + Math.min(4, words / 90) - Math.min(2, fillerHits / 4))
  const average = (answerLength + grammarAccuracy + chunkUsage + logicCompleteness + naturalness + fluency) / 6
  const outputLevel: DiagnosticResult['outputLevel'] =
    average >= 8.2 ? 'L5' : average >= 6.8 ? 'L4' : average >= 5.2 ? 'L3' : average >= 3.4 ? 'L2' : 'L1'

  const mainProblems: string[] = []
  if (answerLength < 5) mainProblems.push('回答偏短，需要扩展细节')
  if (chunkUsage < 6) mainProblems.push('连接词和表达块使用偏少')
  if (logicCompleteness < 6) mainProblems.push('回答结构还不够完整')
  if (fluency < 6) mainProblems.push('流利度需要通过短轮次练习提升')
  if (mainProblems.length === 0) mainProblems.push('继续提升表达自然度和高级表达密度')

  return {
    outputLevel,
    levelDescription: LEVEL_COPY[outputLevel],
    dimensions: {
      answerLength: { score: answerLength, comment: `平均每题约 ${Math.round(avgWords)} 个词` },
      grammarAccuracy: { score: grammarAccuracy, comment: '根据句子完整度和停顿词粗略估计' },
      chunkUsage: { score: chunkUsage, comment: `检测到 ${connectorHits} 个连接或组织表达` },
      logicCompleteness: { score: logicCompleteness, comment: `完成 ${answeredCount}/${QUESTIONS.length} 个诊断问题` },
      naturalness: { score: naturalness, comment: '根据回答长度、连接和停顿情况估计' },
      fluency: { score: fluency, comment: '根据总输出量和停顿词粗略估计' },
    },
    mainProblems,
    recommendedPath: outputLevel === 'L1' || outputLevel === 'L2'
      ? '先练日常生活和自我介绍场景，目标是稳定说出完整句。'
      : '继续练校园生活、观点表达和真实任务对话，目标是说得更自然。',
    recommendedScenes: outputLevel === 'L1' || outputLevel === 'L2'
      ? ['self_intro', 'daily_routine', 'campus_basic']
      : ['small_talk', 'group_discussion', 'interview_intro'],
    answers,
  }
}

export function DiagnosticPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<DiagnosticPhase>('intro')
  const [activeIndex, setActiveIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [saving, setSaving] = useState(false)

  const answeredCount = QUESTIONS.filter((question) => answers[question.id]?.trim()).length
  const activeQuestion = QUESTIONS[activeIndex]
  const canSubmit = answeredCount === QUESTIONS.length

  const answerList = useMemo<DiagnosticAnswer[]>(() => QUESTIONS.map((question) => ({
    questionId: question.id,
    question: question.prompt,
    transcript: answers[question.id]?.trim() ?? '',
  })), [answers])

  const updateAnswer = (questionId: string, transcript: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: transcript }))
  }

  const submit = async () => {
    if (!canSubmit) return
    const nextResult = scoreDiagnostic(answerList)
    setSaving(true)
    try {
      await onboardingApi.submitDiagnostic(nextResult)
    } catch {
      // Keep onboarding usable even if the network is temporarily unavailable.
    } finally {
      setResult(nextResult)
      setPhase('result')
      setSaving(false)
    }
  }

  if (phase === 'intro') {
    return (
      <Card className="mx-4 overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mic className="size-6" />
          </div>
          <div>
            <CardTitle className="text-2xl">2 分钟口语诊断</CardTitle>
            <CardDescription className="mt-2 leading-6">
              回答 3 个简短问题，我们会根据转写文本估算你的输出等级，并为后续练习匹配难度。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {QUESTIONS.map((question, index) => (
              <div key={question.id} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold text-muted-foreground">问题 {index + 1}</p>
                <p className="mt-1 text-sm leading-6">{question.title}</p>
              </div>
            ))}
          </div>
          <Button className="w-full" size="lg" onClick={() => setPhase('recording')}>
            开始诊断 <ArrowRight className="ml-2 size-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (phase === 'result' && result) {
    return (
      <Card className="mx-4 overflow-hidden border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">诊断完成</CardTitle>
              <CardDescription className="mt-2">你的当前输出等级</CardDescription>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-primary">{result.outputLevel}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="rounded-lg bg-muted/30 p-4 text-sm leading-6">{result.levelDescription}</p>
          <div className="grid gap-3">
            {Object.entries(result.dimensions).map(([key, item]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">{key}</span>
                  <span className="tabular-nums">{item.score}/10</span>
                </div>
                <Progress value={item.score * 10} />
                <p className="text-xs text-muted-foreground">{item.comment}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold">建议路径</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.recommendedPath}</p>
          </div>
          <Button className="w-full" size="lg" onClick={() => navigate('/')}>
            进入首页 <CheckCircle2 className="ml-2 size-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-4 overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>口语诊断</CardTitle>
            <CardDescription className="mt-1">每题建议回答 20 到 40 秒</CardDescription>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {answeredCount}/{QUESTIONS.length}
          </div>
        </div>
        <Progress value={(answeredCount / QUESTIONS.length) * 100} />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-2">
          {QUESTIONS.map((question, index) => {
            const active = index === activeIndex
            const done = !!answers[question.id]?.trim()
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'flex h-9 flex-1 items-center justify-center rounded-md border text-xs transition-colors',
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/20 text-muted-foreground',
                  done && !active && 'border-green-500/30 text-green-600',
                )}
              >
                {done ? <CheckCircle2 className="size-3.5" /> : index + 1}
              </button>
            )
          })}
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">问题 {activeIndex + 1}</p>
          <h2 className="mt-2 text-lg font-semibold">{activeQuestion.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeQuestion.prompt}</p>
        </section>

        <VoiceRecorder
          key={activeQuestion.id}
          onTranscribed={(text) => updateAnswer(activeQuestion.id, text)}
        />

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">转写文本，也可以手动修正</p>
          <Textarea
            value={answers[activeQuestion.id] ?? ''}
            onChange={(event) => updateAnswer(activeQuestion.id, event.target.value)}
            className="min-h-28"
            placeholder="录音转写会出现在这里。如果转写服务不可用，可以直接输入你的回答。"
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {
              setAnswers({})
              setActiveIndex(0)
            }}
          >
            <RotateCcw className="mr-2 size-4" /> 重来
          </Button>
          {activeIndex < QUESTIONS.length - 1 ? (
            <Button type="button" className="flex-1" onClick={() => setActiveIndex((index) => Math.min(index + 1, QUESTIONS.length - 1))}>
              下一题 <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button type="button" className="flex-1" disabled={!canSubmit || saving} onClick={submit}>
              {saving ? '提交中...' : '生成结果'} <ClipboardCheck className="ml-2 size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
