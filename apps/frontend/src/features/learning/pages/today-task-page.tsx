import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  BookText, MessageSquareText, Mic, Play, ChevronRight,
  CheckCircle2, Target, Clock, ArrowRight, Sparkles, ListChecks,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  learningApi,
  type TodayPlan,
  type TodayTask,
} from '../api/learning-api'

const TASK_ICONS = {
  vocab: BookText,
  chunk: MessageSquareText,
  practice: Mic,
  script: Play,
} as const

const TASK_COLORS = {
  vocab: 'text-blue-500 bg-blue-500/10',
  chunk: 'text-purple-500 bg-purple-500/10',
  practice: 'text-orange-500 bg-orange-500/10',
  script: 'text-green-500 bg-green-500/10',
} as const

export function TodayTaskPage() {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    learningApi.getTodayTasks()
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false))
  }, [])

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const allTasks = plan?.tasks ?? []
  const totalTasks = allTasks.length
  const doneTasks = completedTasks.size
  const allDone = totalTasks > 0 && doneTasks === totalTasks

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

  if (!plan || allTasks.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t('learning.todayTaskTitle')}</h1>
          <p className="mt-1 text-muted-foreground">{t('learning.noTasks')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">{t('learning.chooseMaterial')}</p>
          <Button className="mt-4" asChild>
            <Link to="/learning">
              {t('learning.browsePlan')}
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{t('learning.todayTaskTitle')}</h1>
          <Badge variant={allDone ? 'default' : 'secondary'} className="text-xs">
            {doneTasks}/{totalTasks} {t('learning.done')}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          {t('learning.continueLearning')}{plan.currentUnit?.title ?? t('common.notSet')}
        </p>
      </div>

      {/* Overall Progress */}
      <Card className="mb-6 border-0 bg-primary/[0.07] shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/20">
                <ListChecks className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {allDone ? t('learning.allDone') : `${t('learning.todayProgress')} ${doneTasks}/${totalTasks}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.currentUnit?.title}
                  {plan.currentUnit?.progress && (
                    <> · {t('learning.vocab')} {plan.currentUnit.progress.vocabLearned}/{plan.currentUnit.progress.vocabTotal} · {t('learning.chunks')} {plan.currentUnit.progress.chunkMastered}/{plan.currentUnit.progress.chunkTotal}</>
                  )}
                </p>
              </div>
            </div>
            {allDone && <Sparkles className="size-5 text-amber-500" />}
          </div>
          <Progress
            value={(doneTasks / Math.max(totalTasks, 1)) * 100}
            className="mt-3 h-2"
          />
        </CardContent>
      </Card>

      {/* Task List */}
      <div className="space-y-3">
        {allTasks.map((task) => {
          const Icon = TASK_ICONS[task.type]
          const isDone = completedTasks.has(task.id)

          return (
            <Card
              key={task.id}
              className={cn(
                'border-0 bg-muted/30 shadow-none transition-all',
                isDone && 'opacity-60',
              )}
            >
              <CardContent className="flex items-start gap-3 p-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleTask(task.id)}
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors',
                    isDone
                      ? 'bg-green-500 text-white'
                      : 'bg-background/80 hover:bg-primary/15',
                  )}
                >
                  {isDone && <CheckCircle2 className="size-5" />}
                </button>

                {/* Icon */}
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TASK_COLORS[task.type])}>
                  <Icon className="size-5" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-medium', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                      {task.title}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {t(`learning.taskLabel.${task.type}`)}
                    </Badge>
                  </div>
                  <p className={cn('mt-0.5 text-xs', isDone ? 'text-muted-foreground/60' : 'text-muted-foreground')}>
                    {task.description}
                  </p>

                  {/* Progress for vocab/chunk tasks */}
                  {(task.type === 'vocab' || task.type === 'chunk') && task.total && (
                    <div className="mt-2 flex items-center gap-2">
                      <Progress
                        value={(task.done! / Math.max(task.total!, 1)) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {task.done}/{task.total}
                      </span>
                    </div>
                  )}

                  {/* Duration for practice tasks */}
                  {task.type === 'practice' && task.durationSec && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{t('practiceHub.suggested')} {Math.round(task.durationSec / 60)} {t('practiceSession.minutes')}</span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <TaskAction task={task} isDone={isDone} />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Completion Message */}
      {allDone && (
        <div className="mt-6 rounded-lg bg-green-500/10 p-4 text-center">
          <Sparkles className="mx-auto mb-2 size-6 text-amber-500" />
          <p className="font-medium text-foreground">{t('learning.allTasksDone')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            坚持每天练习，英语表达会越来越自然
          </p>
          <Button className="mt-3" variant="outline" asChild>
            <Link to="/learning">浏览更多学习材料</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function TaskAction({ task, isDone }: { task: TodayTask; isDone: boolean }) {
  if (isDone) return null

  const baseClass = 'flex shrink-0 items-center gap-1 text-xs font-medium'

  switch (task.type) {
    case 'vocab':
      return (
        <Link
          to={`/learning/units/${task.unitId}`}
          className={cn(baseClass, 'text-primary hover:underline')}
        >
          学习
          <ChevronRight className="size-3" />
        </Link>
      )
    case 'chunk':
      return (
        <Link
          to={`/learning/units/${task.unitId}`}
          className={cn(baseClass, 'text-primary hover:underline')}
        >
          学习
          <ChevronRight className="size-3" />
        </Link>
      )
    case 'practice':
      return (
        <Link
          to={`/practice/session/${task.topicId}`}
          className={cn(baseClass, 'text-primary hover:underline')}
        >
          开始
          <ChevronRight className="size-3" />
        </Link>
      )
    case 'script':
      return (
        <Link
          to={`/script/${task.episodeId}`}
          className={cn(baseClass, 'text-primary hover:underline')}
        >
          挑战
          <ChevronRight className="size-3" />
        </Link>
      )
    default:
      return null
  }
}
