import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ChevronLeft, Loader2, BarChart2, Compass, BookOpen, CheckCircle2,
  Mic, Square, ClipboardList, GraduationCap, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import {
  runPlacementAssessment,
  type UserProfile,
  type PlacementAssessmentResult,
} from '@/features/profile/api'
import { useAuth } from '@/providers/auth-provider'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useProfileCacheStore } from '@/features/profile/profile-cache.store'
import { startBestNativeVoiceInput, type NativeVoiceInputSession } from '@/lib/native/vn-voice-input'
import { transcribeRecording } from '@/lib/practice-ai-api'
import {
  Home, BriefcaseBusiness, Shield, Compass as CompassIcon,
} from 'lucide-react'

export const LEARNING_GOAL_OPTIONS = [
  { value: 'foundation_start', label: '零基础开口', desc: '自我介绍、基础句、敢说第一句', icon: Shield, tint: 'text-rose-600 bg-rose-500/10' },
  { value: 'daily_scenes', label: '日常实战', desc: '吃饭、住宿、交通、社交求助', icon: Home, tint: 'text-emerald-600 bg-emerald-500/10' },
  { value: 'exam_ielts', label: '雅思口语', desc: 'Part 1/2/3、观点、展开和追问', icon: GraduationCap, tint: 'text-blue-600 bg-blue-500/10' },
  { value: 'story_roleplay', label: '故事剧情', desc: '角色扮演、剧情选择、自由探索', icon: CompassIcon, tint: 'text-violet-600 bg-violet-500/10' },
  { value: 'course_system', label: '系统课程', desc: '发音、句型、表达策略系统补齐', icon: BriefcaseBusiness, tint: 'text-amber-600 bg-amber-500/10' },
] as const

export const goalLabelMap: Record<string, string> = {
  ...Object.fromEntries(LEARNING_GOAL_OPTIONS.map((goal) => [goal.value, goal.label])),
  arrival_roots: '日常实战',
  daily_hustle: '日常实战',
  people: '日常实战',
  work_study: '系统课程',
  crisis_mode: '日常实战',
  out_about: '日常实战',
}
const learningGoalValueSet = new Set(LEARNING_GOAL_OPTIONS.map((goal) => goal.value))
const legacyGoalAliases: Record<string, typeof LEARNING_GOAL_OPTIONS[number]['value']> = {
  arrival_roots: 'daily_scenes',
  daily_hustle: 'daily_scenes',
  people: 'daily_scenes',
  work_study: 'course_system',
  crisis_mode: 'daily_scenes',
  out_about: 'daily_scenes',
}

export function normalizeLearningGoals(goals?: string[] | null) {
  return Array.from(new Set((goals ?? [])
    .map((goal) => legacyGoalAliases[goal] ?? goal)
    .filter((goal) => learningGoalValueSet.has(goal as typeof LEARNING_GOAL_OPTIONS[number]['value']))))
    .slice(0, 3)
}

const PLACEMENT_PROMPTS = [
  {
    id: 'foundation_intro',
    title: '介绍自己和目标',
    prompt: 'Introduce yourself briefly and say why you want to improve your English speaking.',
    promptZh: '请用英语简单介绍自己，并说明你为什么想提升英语口语。',
    helper: '可以写名字、身份、学习原因，以及最想先解决的问题。',
  },
  {
    id: 'daily_request',
    title: '处理一个真实请求',
    prompt: 'You just arrived at a hotel, but the room is not ready. Write what you would say to the front desk.',
    promptZh: '你到了酒店，但房间还没准备好。请用英语对前台说明情况并提出请求。',
    helper: '说明情况、提出请求，也可以补充你希望怎么安排。',
  },
  {
    id: 'exam_story_opinion',
    title: '讲述经历并表达观点',
    prompt: 'Describe a place or experience you remember clearly, and explain why it was important to you.',
    promptZh: '请用英语描述一个你印象深刻的地点或经历，并解释它为什么重要。',
    helper: '尽量包含具体细节、感受和原因，这会帮助判断考试表达和故事表达能力。',
  },
] as const

function pickAssessmentMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(
      (mimeType) => MediaRecorder.isTypeSupported(mimeType),
    ) ?? ''
  )
}

function formatAssessmentElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function normalizeAssessmentTranscript(value: string) {
  return value.replace(/\r\n?/g, '\n').trim()
}

function AssessmentAnswerInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const nativeSpeechRecognitionEnabled = usePreferencesStore((s) => s.nativeSpeechRecognitionEnabled)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'processing'>('idle')
  const [voiceError, setVoiceError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const nativeVoiceSessionRef = useRef<NativeVoiceInputSession | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordedBlobRef = useRef<Blob | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const cleanupRecording = useCallback(() => {
    nativeVoiceSessionRef.current?.cancel().catch(() => undefined)
    nativeVoiceSessionRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    recordedBlobRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => cleanupRecording(), [cleanupRecording])

  useEffect(() => {
    if (voiceStatus !== 'recording') return
    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 200)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [voiceStatus])

  const processAudioBlob = useCallback(async (blob: Blob, filename: string) => {
    setVoiceStatus('processing')
    try {
      const result = await transcribeRecording(blob, filename)
      const text = normalizeAssessmentTranscript(result.text ?? '')
      if (!text) {
        setVoiceError(t('profile.placement.voiceNoContent'))
        setVoiceStatus('idle')
        return
      }
      onChange(text)
      setVoiceError('')
      setVoiceStatus('idle')
    } catch {
      setVoiceError(t('profile.placement.voiceFailed'))
      setVoiceStatus('idle')
    }
  }, [onChange, t])

  const startRecording = useCallback(async () => {
    if (disabled || voiceStatus !== 'idle') return
    setVoiceError('')
    setElapsed(0)
    cleanupRecording()

    try {
      const nativeSession = await startBestNativeVoiceInput({
        language: 'en-US',
        useNativeSpeechRecognition: nativeSpeechRecognitionEnabled,
        onPartial: (partialText) => {
          const text = normalizeAssessmentTranscript(partialText)
          if (text) onChange(text)
        },
      })

      if (nativeSession) {
        nativeVoiceSessionRef.current = nativeSession
        setVoiceStatus('recording')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickAssessmentMimeType()
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || mimeType || 'audio/webm' })
        recordedBlobRef.current = blob
        await processAudioBlob(blob, `assessment.${ext}`)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(200)
      setVoiceStatus('recording')
    } catch {
      setVoiceError(t('profile.placement.micDenied'))
      setVoiceStatus('idle')
    }
  }, [cleanupRecording, disabled, nativeSpeechRecognitionEnabled, onChange, processAudioBlob, t, voiceStatus])

  const stopRecording = useCallback(async () => {
    const nativeSession = nativeVoiceSessionRef.current
    if (nativeSession) {
      nativeVoiceSessionRef.current = null
      setVoiceStatus('processing')
      try {
        if (nativeSession.kind === 'speech') {
          const result = await nativeSession.stop()
          const text = normalizeAssessmentTranscript(result.text)
          if (text) {
            onChange(text)
            setVoiceError('')
          } else {
            setVoiceError(t('profile.placement.voiceNoContent'))
          }
          setVoiceStatus('idle')
          return
        }
        const result = await nativeSession.stop()
        recordedBlobRef.current = result.blob
        await processAudioBlob(result.blob, result.filename)
      } catch {
        setVoiceError(t('profile.placement.voiceFailed'))
        setVoiceStatus('idle')
      }
      return
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [onChange, processAudioBlob, t])

  const isRecording = voiceStatus === 'recording'
  const isProcessing = voiceStatus === 'processing'
  const hasRecording = !isRecording && !isProcessing && recordedBlobRef.current !== null

  const handlePlayback = () => {
    if (!recordedBlobRef.current) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    const url = URL.createObjectURL(recordedBlobRef.current)
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => {
      URL.revokeObjectURL(url)
      audioRef.current = null
    }
    audio.play().catch(() => void 0)
  }

  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('profile.placement.voicePlaceholder')}
        disabled={disabled || isProcessing}
        className="min-h-[112px] resize-none rounded-lg border-0 bg-background/70 p-3 text-base shadow-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={cn('min-w-0 flex-1 truncate text-xs text-muted-foreground', voiceError && 'text-destructive')}>
          {voiceError || (isRecording
            ? t('profile.placement.voiceRecording', { time: formatAssessmentElapsed(elapsed) })
            : isProcessing
              ? t('profile.placement.voiceProcessing')
              : value.trim().length > 0 && value.trim().length < 5
                ? t('profile.placement.charHint', { current: value.trim().length, min: 5, defaultValue: '至少输入 {{min}} 个字符（当前 {{current}}）' })
              : t('profile.placement.voiceIdle'))}
        </p>
        <div className="flex items-center gap-1.5">
          {hasRecording && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled || isProcessing}
              onClick={handlePlayback}
              className="h-9 shrink-0 rounded-full px-3"
            >
              <svg className="mr-1.5 size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              回放
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={isRecording ? 'destructive' : 'outline'}
            disabled={disabled || isProcessing}
            onClick={isRecording ? stopRecording : startRecording}
            className="h-9 shrink-0 rounded-full px-3"
          >
            {isProcessing ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : isRecording ? (
              <Square className="mr-1.5 size-3.5 fill-current" />
            ) : (
              <Mic className="mr-1.5 size-4" />
            )}
            {isRecording ? t('profile.placement.voiceStop') : isProcessing ? t('profile.placement.voiceProcessingButton') : t('profile.placement.voiceButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function LearningAssessmentDialog({
  open,
  onOpenChange,
  profile,
  required = false,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: UserProfile | null
  required?: boolean
  onCompleted?: () => void
}) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const patchCachedProfile = useProfileCacheStore((s) => s.patchProfile)
  const [step, setStep] = useState(0)
  const [selectedGoals, setSelectedGoals] = useState<string[]>(() => normalizeLearningGoals(profile?.learningGoals))
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<PlacementAssessmentResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)
  const wasOpenRef = useRef(false)
  const confirmedRef = useRef(false)
  const goalStep = 1
  const firstPromptStep = 2
  const resultStep = firstPromptStep + PLACEMENT_PROMPTS.length
  const selectedGoalLabels = selectedGoals.map((goal) => t(`profile.placement.goals.${goal}.label`, { defaultValue: goalLabelMap[goal] ?? goal }))
  const answeredCount = PLACEMENT_PROMPTS.filter((item) => (answers[item.id] ?? '').trim().length >= 5).length
  const canSubmit = selectedGoals.length > 0 && answeredCount >= PLACEMENT_PROMPTS.length
  const totalSteps = resultStep + 1
  const currentPrompt = step >= firstPromptStep && step < resultStep ? PLACEMENT_PROMPTS[step - firstPromptStep] : null
  const currentAnswer = currentPrompt ? answers[currentPrompt.id] ?? '' : ''
  const canSkipPlacement = session?.user?.role === 'admin'
  const canGoNext = step === 0
    ? true
    : step === goalStep
    ? selectedGoals.length > 0
    : currentPrompt
      ? currentAnswer.trim().length >= 5
      : true

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep(0)
      setSelectedGoals(normalizeLearningGoals(profile?.learningGoals))
      setAnswers({})
      setResult(null)
    }
    wasOpenRef.current = open
  }, [open])

  const toggleGoal = (goal: string) => {
    setSelectedGoals((current) => {
      const normalized = normalizeLearningGoals(current)
      if (normalized.includes(goal)) return normalized.filter((item) => item !== goal)
      if (normalized.length >= 3) {
        toast.message(t('profile.placement.maxGoals'))
        return normalized
      }
      return [...normalized, goal]
    })
  }

  const handleSubmit = async () => {
    if (selectedGoals.length === 0) {
      toast.message(t('profile.placement.chooseGoal'))
      return
    }
    if (!canSubmit) {
      toast.message(t('profile.placement.completeAll'))
      return
    }
    setSaving(true)
    try {
      const assessment = await runPlacementAssessment({
        learningGoals: selectedGoals,
        answers: PLACEMENT_PROMPTS.map((item) => ({
          promptId: item.id,
          prompt: item.prompt,
          answer: answers[item.id].trim(),
        })),
      })
      setResult(assessment)
      patchCachedProfile({
        outputLevel: assessment.outputLevel,
        learningGoals: assessment.learningGoals,
        outputLevelDetail: assessment.outputLevelDetail,
      })
      toast.success(t('profile.placement.success'))
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || t('profile.placement.failed'))
    } finally {
      setSaving(false)
    }
  }

  // 到达结果步骤时自动提交测评
  useEffect(() => {
    if (step === resultStep && !result && !saving && selectedGoals.length > 0 && canSubmit) {
      handleSubmit()
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrimary = () => {
    if (saving) return
    if (step < resultStep) {
      if (!canGoNext) {
        toast.message(step === goalStep ? t('profile.placement.chooseGoal') : t('profile.placement.answerRequired'))
        return
      }
      setStep((current) => current + 1)
      return
    }
    if (!result) {
      void handleSubmit()
      return
    }
    onCompleted?.()
    onOpenChange(false)
  }

  const handleAdminSkip = () => {
    if (!canSkipPlacement || saving) return
    onCompleted?.()
    onOpenChange(false)
  }

  const handleBack = () => {
    if (saving) return
    if (step > 0) setStep((current) => current - 1)
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (required && !nextOpen && !result) return
    if (!nextOpen && !confirmedRef.current) {
      setPendingClose(true)
      return
    }
    confirmedRef.current = false
    setPendingClose(false)
    onOpenChange(nextOpen)
  }

  const handleConfirmExit = () => {
    confirmedRef.current = true
    setPendingClose(false)
    onOpenChange(false)
  }

  const handleCancelExit = () => {
    confirmedRef.current = false
    setPendingClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className={cn(
          'flex h-[min(640px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-lg border border-border/70 bg-background p-0 shadow-lg',
          required && '[&>button:last-child]:hidden',
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('profile.placement.title')}</DialogTitle>
          <DialogDescription>{t('profile.placement.description')}</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-border/50 px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0 || saving}
              className={cn(
                'flex size-8 items-center justify-center rounded-full transition-colors',
                step === 0 ? 'text-muted-foreground/30' : 'bg-muted/60 text-foreground active:bg-muted',
              )}
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="min-w-0 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.placement.testLabel')}</p>
              <p className="truncate text-sm font-semibold">{t('profile.placement.title')}</p>
            </div>
            <div className="size-8" aria-hidden="true" />
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  index <= step ? 'bg-primary' : 'bg-muted',
                )}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {step === 0 && (
            <div className="flex min-h-full flex-col py-2">
              <div className="text-center">
                <h2 className="mt-4 text-lg font-semibold tracking-tight">{t('profile.placement.introTitle')}</h2>
                <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-muted-foreground">
                  {t('profile.placement.introDesc')}
                </p>
              </div>
              <div className="grid gap-2 mt-4">
                {[
                  { icon: ClipboardList, label: t('profile.placement.introGoal'), tint: 'bg-sky-500/10 text-sky-600' },
                  { icon: Mic, label: t('profile.placement.introAnswer'), tint: 'bg-emerald-500/10 text-emerald-600' },
                  { icon: BarChart2, label: t('profile.placement.introResult'), tint: 'bg-amber-500/10 text-amber-600' },
                ].map(({ icon: Icon, label, tint }) => (
                  <div key={label} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                    <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', tint)}>
                      <Icon className="size-4" />
                    </div>
                    <p className="text-sm font-medium leading-5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === goalStep && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Compass className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight">{t('profile.placement.goalTitle')}</h2>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {t('profile.placement.goalDesc')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LEARNING_GOAL_OPTIONS.map((goal) => {
                  const Icon = goal.icon
                  const active = selectedGoals.includes(goal.value)
                  return (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={() => toggleGoal(goal.value)}
                      className={cn(
                        'relative min-h-[86px] rounded-lg border border-transparent bg-muted/30 p-2.5 text-left transition-colors active:bg-muted/60',
                        active && 'border-primary/30 bg-primary/[0.07]',
                      )}
                    >
                      <div className={cn('mb-1.5 flex size-7 items-center justify-center rounded-md', goal.tint)}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-5">{t(`profile.placement.goals.${goal.value}.label`, { defaultValue: goal.label })}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-muted-foreground">{t(`profile.placement.goals.${goal.value}.desc`, { defaultValue: goal.desc })}</p>
                      </div>
                      <span className={cn(
                        'absolute right-2 top-2 flex size-4 items-center justify-center rounded-full',
                        active ? 'bg-primary text-primary-foreground' : 'bg-background',
                      )}>
                        {active && <CheckCircle2 className="size-3" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {currentPrompt && (
            <div className="flex min-h-full flex-col">
              <div className="mb-3">
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {t('profile.placement.question', { current: step - firstPromptStep + 1, total: PLACEMENT_PROMPTS.length })}
                </Badge>
                <h2 className="mt-2 text-base font-semibold tracking-tight">{t(`profile.placement.prompts.${currentPrompt.id}.title`, { defaultValue: currentPrompt.title })}</h2>
                <div className="mt-2 rounded-lg bg-muted/30 p-3">
                  <p className="text-sm leading-6 text-foreground">{t(`profile.placement.prompts.${currentPrompt.id}.prompt`, { defaultValue: currentPrompt.prompt })}</p>
                  <p className="mt-2 border-t border-border/50 pt-2 text-xs leading-5 text-muted-foreground">{t(`profile.placement.prompts.${currentPrompt.id}.promptZh`, { defaultValue: currentPrompt.promptZh })}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t(`profile.placement.prompts.${currentPrompt.id}.helper`, { defaultValue: currentPrompt.helper })}
                </p>
              </div>
              <AssessmentAnswerInput
                value={currentAnswer}
                onChange={(nextValue) => setAnswers((current) => ({ ...current, [currentPrompt.id]: nextValue }))}
                disabled={saving}
              />
            </div>
          )}

          {step === resultStep && (
            <div className="space-y-5">
              {!result ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {saving ? <Loader2 className="size-6 animate-spin" /> : <BarChart2 className="size-6" />}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold tracking-tight">
                    {saving ? t('profile.placement.analyzing') : t('profile.placement.preparing')}
                  </h2>
                  <p className="mt-2 max-w-[280px] text-sm leading-6 text-muted-foreground">
                    {t('profile.placement.analyzingDesc')}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {selectedGoalLabels.map((label) => (
                      <Badge key={label} variant="secondary" className="rounded-full">{label}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <section className="rounded-lg border-0 bg-primary/[0.07] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{t('profile.placement.report')}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{result.analysis.summary}</p>
                    </div>
                    <Badge className="rounded-full">{result.outputLevel}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    {result.analysis.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t('profile.placement.strengths')}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {result.analysis.strengths.map((item) => <Badge key={item} variant="secondary" className="rounded-full">{item}</Badge>)}
                        </div>
                      </div>
                    )}
                    {result.analysis.improvements.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t('profile.placement.improvements')}</p>
                        <div className="mt-1 space-y-1">
                          {result.analysis.improvements.map((item) => <p key={item} className="text-xs leading-5 text-muted-foreground">• {item}</p>)}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* {result.analysis.recommendedUnits.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-muted-foreground">{t('profile.placement.recommendedUnits')}</p>
                      <div className="mt-2 space-y-2">
                        {result.analysis.recommendedUnits.map((unit) => (
                          <Link
                            key={unit.id}
                            to={`/learning/units/${unit.id}`}
                            onClick={() => onOpenChange(false)}
                            className="flex items-center gap-3 rounded-lg bg-background/80 p-3"
                          >
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <BookOpen className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-1 text-sm font-semibold">{unit.title}</p>
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {unit.categoryName} · {t('profile.placement.topicCount', { count: unit.topicCount })}
                              </p>
                            </div>
                            <ChevronRight className="size-4 text-muted-foreground/60" />
                          </Link>
                        ))}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{result.analysis.recommendationReason}</p>
                    </div>
                  )} */}
                </section>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/50 p-4">
          <Button
            onClick={handlePrimary}
            disabled={saving || (step < resultStep && !canGoNext) || (step === resultStep && !canSubmit)}
            className={cn(
              'h-11 rounded-full text-sm font-semibold',
              step === 0 && canSkipPlacement ? 'flex-1' : 'w-full',
            )}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {step === 0
              ? t('profile.placement.start')
              : step < resultStep
                ? t('profile.placement.continue')
              : result
                ? t('profile.placement.finish')
                : t('profile.placement.submit')}
          </Button>
          {step === 0 && canSkipPlacement && (
            <Button
              type="button"
              variant="outline"
              onClick={handleAdminSkip}
              disabled={saving}
              className="h-11 flex-1 rounded-full text-sm font-semibold"
            >
              {t('profile.placement.skipForAdmin')}
            </Button>
          )}
        </DialogFooter>

        {pendingClose && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
            <div className="mx-auto max-w-[260px] text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <svg className="size-6 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold">{t('profile.placement.exitTitle', { defaultValue: '确定退出测评？' })}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('profile.placement.exitDesc', { defaultValue: '退出后当前回答将不会保存' })}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Button onClick={handleConfirmExit} variant="destructive" className="h-11 w-full rounded-full text-sm font-semibold">
                  {t('profile.placement.exitConfirm', { defaultValue: '确认退出' })}
                </Button>
                <Button onClick={handleCancelExit} variant="outline" className="h-11 w-full rounded-full text-sm font-semibold">
                  {t('profile.placement.exitCancel', { defaultValue: '继续测评' })}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
