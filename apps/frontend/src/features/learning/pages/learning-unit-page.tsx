import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, BookText, MessageSquareText,
  Mic, Play, CheckCircle2, Sparkles, Target, ArrowRight,
  Lightbulb, Quote, GraduationCap, ListChecks,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { learningApi, type UnitDetail, type VocabItem, type ChunkItem } from '../api/learning-api'
import { chunkApi } from '@/features/practice/api/english-practice-api'

// ---- Step 定义 ----
type StepType = 'vocab' | 'chunk' | 'sentence' | 'practice' | 'script'

interface Step {
  type: StepType
  label: string
  icon: typeof BookText
  description: string
}

const STEPS: Step[] = [
  { type: 'vocab', label: '场景词汇', icon: BookText, description: '先熟悉本单元的核心词汇' },
  { type: 'chunk', label: '核心表达', icon: MessageSquareText, description: '掌握地道表达方式' },
  { type: 'sentence', label: '句型骨架', icon: Quote, description: '学会这些句型能帮你组织语言' },
  { type: 'practice', label: '开口练习', icon: Mic, description: '用刚学的内容进行口语练习' },
  { type: 'script', label: '剧本挑战', icon: Play, description: '在剧情中运用所学' },
]

export function LearningUnitPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [unit, setUnit] = useState<UnitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<StepType>>(new Set())

  useEffect(() => {
    if (!unitId) return
    setLoading(true)
    learningApi.getUnitDetail(unitId)
      .then((data) => {
        setUnit(data)
        // 跳过空步骤
        if (data) findFirstNonEmptyStep(data)
      })
      .catch(() => setUnit(null))
      .finally(() => setLoading(false))
  }, [unitId])

  const findFirstNonEmptyStep = (data: UnitDetail) => {
    if (data.vocabularies.length === 0) {
      // 没有词汇，跳到 chunk
      if (data.chunks.length === 0) {
        if (data.sentencePatterns.length === 0) {
          if (data.trainingTopics.length === 0) {
            if (data.firstEpisode) setCurrentStepIdx(4)
            else setCurrentStepIdx(0)
          } else setCurrentStepIdx(3)
        } else setCurrentStepIdx(2)
      } else setCurrentStepIdx(1)
    }
  }

  const completeStep = useCallback(async (stepType: StepType) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      next.add(stepType)
      return next
    })

    // 更新后端进度
    if (unit && unitId) {
      const updateData: any = {}
      if (stepType === 'vocab') updateData.vocabLearned = unit.vocabCount
      if (stepType === 'chunk') updateData.chunkMastered = unit.chunkCount
      if (stepType === 'practice') updateData.completedPractice = true
      if (stepType === 'script') updateData.completedScript = true
      if (Object.keys(updateData).length > 0) {
        learningApi.updateProgress(unitId, updateData).catch(() => {})
      }
    }
  }, [unit, unitId])

  const goToNextStep = () => {
    const nextIdx = currentStepIdx + 1
    if (nextIdx >= STEPS.length) return
    // 跳过没有内容的步骤
    const nextStep = STEPS[nextIdx]
    if (!hasContentForStep(nextStep.type)) {
      setCompletedSteps((prev) => {
        const next = new Set(prev)
        next.add(nextStep.type)
        return next
      })
      setCurrentStepIdx(nextIdx + 1)
      return
    }
    setCurrentStepIdx(nextIdx)
  }

  const hasContentForStep = (type: StepType): boolean => {
    if (!unit) return false
    switch (type) {
      case 'vocab': return (unit.vocabularies?.length ?? 0) > 0
      case 'chunk': return (unit.chunks?.length ?? 0) > 0
      case 'sentence': return (unit.sentencePatterns?.length ?? 0) > 0
      case 'practice': return (unit.trainingTopics?.length ?? 0) > 0
      case 'script': return unit.firstEpisode != null
      default: return false
    }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>
  if (!unit) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Target className="size-12 text-muted-foreground/40" />
      <p className="text-muted-foreground">学习单元不存在</p>
      <Button variant="outline" asChild><Link to="/learning">返回学习计划</Link></Button>
    </div>
  )

  const currentStep = STEPS[currentStepIdx]
  const allDone = completedSteps.size >= STEPS.filter((s) => hasContentForStep(s.type)).length

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Header with back */}
      <div className="mb-4">
        <Link
          to="/learning"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          学习计划
        </Link>
        <h1 className="text-xl font-bold text-foreground">{unit.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{unit.location}</p>
      </div>

      {/* Step Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STEPS.map((step, i) => {
              const hasContent = hasContentForStep(step.type)
              const isDone = completedSteps.has(step.type)
              const isCurrent = i === currentStepIdx
              if (!hasContent) return null

              return (
                <div key={step.type} className="flex items-center gap-1">
                  {i > 0 && STEPS.slice(0, i).some((s) => hasContentForStep(s.type)) && (
                    <div className={cn('h-px w-3', isDone || isCurrent ? 'bg-primary' : 'bg-muted')} />
                  )}
                  <button
                    onClick={() => {
                      if (isDone || isCurrent) setCurrentStepIdx(i)
                    }}
                    disabled={!isDone && !isCurrent}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors',
                      isDone && 'bg-green-500 text-white',
                      isCurrent && !isDone && 'bg-primary text-primary-foreground',
                      !isDone && !isCurrent && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isDone ? <CheckCircle2 className="size-4" /> : i + 1}
                  </button>
                </div>
              )
            })}
          </div>
          <span className="text-xs text-muted-foreground">
            {completedSteps.size}/{STEPS.filter((s) => hasContentForStep(s.type)).length}
          </span>
        </div>
        <Progress
          value={
            (completedSteps.size / Math.max(STEPS.filter((s) => hasContentForStep(s.type)).length, 1)) *
            100
          }
          className="mt-2 h-1"
        />
      </div>

      {/* Step Content */}
      {allDone ? (
        <CompletionView unit={unit} />
      ) : currentStep ? (
        <>
          <div className="mb-4 flex items-center gap-2">
            <div className={cn(
              'flex size-8 items-center justify-center rounded-lg',
              currentStep.type === 'vocab' && 'bg-blue-500/10 text-blue-500',
              currentStep.type === 'chunk' && 'bg-purple-500/10 text-purple-500',
              currentStep.type === 'sentence' && 'bg-amber-500/10 text-amber-500',
              currentStep.type === 'practice' && 'bg-orange-500/10 text-orange-500',
              currentStep.type === 'script' && 'bg-green-500/10 text-green-500',
            )}>
              <currentStep.icon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{currentStep.label}</p>
              <p className="text-xs text-muted-foreground">{currentStep.description}</p>
            </div>
          </div>

          <StepContent
            step={currentStep.type}
            unit={unit}
            onComplete={() => {
              completeStep(currentStep.type)
              goToNextStep()
            }}
          />
        </>
      ) : null}
    </div>
  )
}

// ---- Step Content Renderer ----

function StepContent({
  step,
  unit,
  onComplete,
}: {
  step: StepType
  unit: UnitDetail
  onComplete: () => void
}) {
  switch (step) {
    case 'vocab':
      return <VocabStep vocabularies={unit.vocabularies} onComplete={onComplete} />
    case 'chunk':
      return <ChunkStep chunks={unit.chunks} onComplete={onComplete} />
    case 'sentence':
      return <SentenceStep patterns={unit.sentencePatterns} onComplete={onComplete} />
    case 'practice':
      return <PracticeStep topics={unit.trainingTopics} unitTitle={unit.title} onComplete={onComplete} />
    case 'script':
      return <ScriptStep episode={unit.firstEpisode!} unitId={unit.id} onComplete={onComplete} />
    default:
      return null
  }
}

// ---- 1. Vocab Step ----

function VocabStep({ vocabularies, onComplete }: { vocabularies: VocabItem[]; onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())

  const current = vocabularies[currentIndex]
  const isLast = currentIndex >= vocabularies.length - 1

  const handleNext = () => {
    if (current) setSeenIds((prev) => new Set(prev).add(current.id))
    setFlipped(false)
    if (isLast) {
      onComplete()
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>词汇学习</span>
        <div className="flex-1">
          <Progress value={((currentIndex + 1) / vocabularies.length) * 100} className="h-1" />
        </div>
        <span className="shrink-0">{currentIndex + 1}/{vocabularies.length}</span>
      </div>

      {/* Flash Card */}
      <div className="relative">
        <button
          onClick={() => setFlipped(!flipped)}
          className="w-full rounded-xl border border-border bg-card p-8 text-center transition-all hover:shadow-md active:scale-[0.98]"
          style={{ minHeight: 200 }}
        >
          {flipped ? (
            <div className="space-y-3">
              <p className="text-2xl font-bold text-muted-foreground">{current.meaning}</p>
              <div className="mx-auto h-px w-12 bg-border" />
              <p className="text-lg text-foreground">{current.word}</p>
              {current.description && (
                <p className="text-sm text-muted-foreground">{current.description}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-3xl font-bold text-foreground">{current.word}</p>
              <p className="text-sm text-muted-foreground">点击翻转查看释义</p>
            </div>
          )}
        </button>
      </div>

      <Button className="w-full" onClick={handleNext}>
        {isLast ? '完成词汇学习' : '下一个'}
        <ChevronRight className="ml-1 size-4" />
      </Button>
    </div>
  )
}

// ---- 2. Chunk Step ----

function ChunkStep({ chunks, onComplete }: { chunks: ChunkItem[]; onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const current = chunks[currentIndex]
  const isLast = currentIndex >= chunks.length - 1

  const handleNext = async () => {
    if (current) {
      try { await chunkApi.activate(current.id) } catch {}
    }
    setFlipped(false)
    if (isLast) {
      onComplete()
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  if (!current) {
    return <EmptyStep message="本单元暂无核心表达" onComplete={onComplete} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>表达积累</span>
        <div className="flex-1">
          <Progress value={((currentIndex + 1) / chunks.length) * 100} className="h-1" />
        </div>
        <span className="shrink-0">{currentIndex + 1}/{chunks.length}</span>
      </div>

      {/* Chunk Card */}
      <button
        onClick={() => setFlipped(!flipped)}
        className="w-full rounded-xl border border-border bg-card p-6 text-center transition-all hover:shadow-md active:scale-[0.98]"
        style={{ minHeight: 200 }}
      >
        {flipped ? (
          <div className="space-y-4">
            <p className="text-xl font-bold text-foreground">{current.text}</p>
            <p className="text-base text-muted-foreground">{current.meaning}</p>
            {current.description && (
              <p className="text-sm text-muted-foreground/80">{current.description}</p>
            )}
            {current.examples.length > 0 && (
              <div className="mt-4 space-y-2 rounded-lg bg-muted/50 p-3 text-left">
                <p className="text-xs font-medium text-muted-foreground">例句</p>
                {current.examples.slice(0, 2).map((ex, i) => (
                  <div key={i} className="text-sm">
                    <p className="text-foreground">{ex.en}</p>
                    <p className="text-xs text-muted-foreground">{ex.zh}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-3xl font-bold text-foreground">{current.text}</p>
            <p className="text-sm text-muted-foreground">点击查看释义和例句</p>
          </div>
        )}
      </button>

      <Button className="w-full" onClick={handleNext}>
        {isLast ? '完成表达学习' : '下一个'}
        <ChevronRight className="ml-1 size-4" />
      </Button>
    </div>
  )
}

// ---- 3. Sentence Pattern Step ----

function SentenceStep({ patterns, onComplete }: { patterns: UnitDetail['sentencePatterns']; onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const current = patterns[currentIndex]
  const isLast = currentIndex >= patterns.length - 1

  if (patterns.length === 0) {
    return <EmptyStep message="本单元暂无句型骨架" onComplete={onComplete} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>句型学习</span>
        <div className="flex-1">
          <Progress value={((currentIndex + 1) / patterns.length) * 100} className="h-1" />
        </div>
        <span className="shrink-0">{currentIndex + 1}/{patterns.length}</span>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="bg-amber-500/5 pb-3">
          <CardTitle className="text-base">{current.pattern}</CardTitle>
          <CardDescription>{current.meaning}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {current.slots?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">可替换部分</p>
              <div className="flex flex-wrap gap-1.5">
                {current.slots.map((slot, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {slot}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {current.example && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">示例</p>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-foreground">{current.example}</p>
              </div>
            </div>
          )}
          {current.topicTitle && (
            <p className="text-xs text-muted-foreground">
              关联练习：{current.topicTitle}
            </p>
          )}
        </CardContent>
      </Card>

      <Button className="w-full" onClick={() => (isLast ? onComplete() : setCurrentIndex((i) => i + 1))}>
        {isLast ? '完成句型学习' : '下一个句型'}
        <ChevronRight className="ml-1 size-4" />
      </Button>
    </div>
  )
}

// ---- 4. Practice Step ----

function PracticeStep({ topics, unitTitle, onComplete }: { topics: UnitDetail['trainingTopics']; unitTitle: string; onComplete: () => void }) {
  const navigate = useNavigate()

  if (topics.length === 0) {
    return <EmptyStep message="本单元暂无练习话题" onComplete={onComplete} />
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        用刚学的词汇和表达，完成以下口语练习
      </p>

      <div className="space-y-3">
        {topics.map((topic) => (
          <Card key={topic.id} className="hover:bg-muted/30 transition-colors">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                <Mic className="size-5 text-orange-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{topic.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{topic.promptZh}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  建议 {Math.round(topic.suggestedDurationSec / 60)} 分钟
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => navigate(`/practice/session/${topic.id}`)}
              >
                开始
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button className="w-full" variant="outline" onClick={onComplete}>
        已完成练习
        <CheckCircle2 className="ml-1 size-4" />
      </Button>
    </div>
  )
}

// ---- 5. Script Step ----

function ScriptStep({ episode, unitId, onComplete }: { episode: NonNullable<UnitDetail['firstEpisode']>; unitId: string; onComplete: () => void }) {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10">
        <CardContent className="p-6 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-500/20">
            <Play className="size-7 text-green-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground">{episode.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{episode.chapterTitle}</p>
          {episode.description && (
            <p className="mt-2 text-sm text-muted-foreground">{episode.description}</p>
          )}
          <div className="mt-4 flex justify-center gap-2">
            <Badge variant="secondary">最低等级 {episode.requiredOutputLevel}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">准备好了吗？</p>
        <p className="text-sm text-muted-foreground">
          在剧本中你会和一个 NPC 进行对话，用上刚学的词汇和表达来完成任务。
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
            <span>使用本单元词汇完成对话</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
            <span>运用学过的 Chunk 和句型</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
            <span>完成 NPC 给出的任务目标</span>
          </li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button
          className="flex-1"
          onClick={() => navigate(`/script/${episode.id}`)}
        >
          开始挑战
          <Play className="ml-1 size-4" />
        </Button>
        <Button variant="outline" onClick={onComplete}>
          稍后再做
        </Button>
      </div>
    </div>
  )
}

// ---- Completion View ----

function CompletionView({ unit }: { unit: UnitDetail }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-green-500/20">
        <Sparkles className="size-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-foreground">恭喜完成本单元学习！</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        你已完成「{unit.title}」的所有学习步骤
      </p>

      <div className="mt-6 grid w-full grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <BookText className="mb-1 size-5 text-blue-500" />
            <p className="text-lg font-bold text-foreground">{unit.vocabCount}</p>
            <p className="text-xs text-muted-foreground">词汇</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <MessageSquareText className="mb-1 size-5 text-purple-500" />
            <p className="text-lg font-bold text-foreground">{unit.chunkCount}</p>
            <p className="text-xs text-muted-foreground">表达</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Mic className="mb-1 size-5 text-orange-500" />
            <p className="text-lg font-bold text-foreground">{unit.topicCount}</p>
            <p className="text-xs text-muted-foreground">练习</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Play className="mb-1 size-5 text-green-500" />
            <p className="text-lg font-bold text-foreground">{unit.scriptCount}</p>
            <p className="text-xs text-muted-foreground">剧本</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link to="/learning">
            返回学习计划
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/today">
            查看明日任务
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ---- Empty Step Fallback ----

function EmptyStep({ message, onComplete }: { message: string; onComplete: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Target className="size-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onComplete}>
        跳过
        <ChevronRight className="ml-1 size-4" />
      </Button>
    </div>
  )
}
