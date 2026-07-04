import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, CheckCircle2, Mic, Square, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/cn'
import { startBestNativeVoiceInput, type NativeVoiceInputSession } from '@/lib/native/vn-voice-input'
import { useWarmupSessionStore, type WarmupScore } from '@/stores/warmup-session.store'
import { useCachedAudio } from '@/hooks/use-cached-audio'

interface DecompositionLevel {
  level: number
  label: string
  en: string
  zh: string
  highlight?: string
  hint?: string
  audioUrl?: string
  audioAssetId?: string
}

interface SentenceDecompositionCardProps {
  title: string
  levels: DecompositionLevel[]
  stepId: string
  onComplete?: (passed: boolean, score: WarmupScore) => void
  /** Dialog 已提供题型标签时，隐藏内部 header badge */
  hideHeader?: boolean
  /** 只读回顾模式 */
  reviewData?: {
    /** 每级的录音 URL，JSON 序列化的 Record<levelIndex, audioUrl> */
    levelAudios?: Record<number, string> | null
  } | null
}

/** 长句拆解 — 从简单句逐级扩展到复杂长句 */
export function SentenceDecompositionCard({
  title,
  levels,
  stepId,
  onComplete,
  hideHeader = false,
  reviewData,
}: SentenceDecompositionCardProps) {
  const { t } = useTranslation()
  const isReview = !!reviewData
  const store = useWarmupSessionStore()

  // 回顾模式：从 reviewData 恢复录音
  const reviewAudios = useMemo(() => {
    if (!reviewData?.levelAudios) return new Map<number, { audioUrl: string }>()
    return new Map(Object.entries(reviewData.levelAudios).map(([k, v]) => [Number(k), { audioUrl: v }]))
  }, [reviewData])

  const totalLevels = levels.length
  const [currentIdx, setCurrentIdx] = useState(0)

  const current = levels[currentIdx]
  const exerciseAudio = useCachedAudio()
  const previous = currentIdx > 0 ? levels[currentIdx - 1] : null
  const isDone = currentIdx >= totalLevels
  const isFirst = currentIdx === 0
  const isLast = currentIdx === totalLevels - 1

  // ── 录音 & 回放（每级独立，暂不需要转写识别）──
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle')
  const [recordingElapsed, setRecordingElapsed] = useState(0)
  const [levelRecordings, setLevelRecordings] = useState<Map<number, { audioUrl: string }>>(() => new Map())
  const [isPlaying, setIsPlaying] = useState(false)
  const nativeSessionRef = useRef<NativeVoiceInputSession | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const levelRecordingsRef = useRef(levelRecordings)

  const advance = useCallback(() => {
    if (currentIdx < totalLevels - 1) {
      setCurrentIdx(prev => prev + 1)
    } else {
      setCurrentIdx(totalLevels)
      // 保存记录到 warmup store（levels 数据存入 correction 字段）
      if (!isReview) {
        const finalSentence = levels[totalLevels - 1].en
        const levelAudioObj: Record<number, string> = {}
        levelRecordings.forEach((v, k) => { levelAudioObj[k] = v.audioUrl })
        const levelsData = JSON.stringify(levels)
        store.recordStep(stepId, { userAnswer: JSON.stringify(levelAudioObj), passed: true, feedback: '', score: 'strong', correction: levelsData })
        store.recordEntry({ stepId, stepType: 'sentence_decomposition', zh: title, answer: finalSentence, userAnswer: JSON.stringify(levelAudioObj), passed: true, feedback: '', displayLabel: '句子拆解', score: 'strong', correction: levelsData })
      }
      onComplete?.(true, 'strong')
    }
  }, [currentIdx, totalLevels, onComplete, isReview, store, stepId, title, levels, levelRecordings])

  const goBack = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1)
    }
  }, [currentIdx])

  const saveLevelRecording = useCallback((levelIndex: number, audioUrl: string) => {
    setLevelRecordings((prev) => {
      const previous = prev.get(levelIndex)?.audioUrl
      if (previous && previous !== audioUrl) URL.revokeObjectURL(previous)
      const next = new Map(prev)
      next.set(levelIndex, { audioUrl })
      return next
    })
  }, [])

  const cleanupRecording = useCallback(() => {
    nativeSessionRef.current?.cancel().catch(() => undefined)
    nativeSessionRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => {
    levelRecordingsRef.current = levelRecordings
  }, [levelRecordings])

  useEffect(() => () => {
    cleanupRecording()
    levelRecordingsRef.current.forEach((recording) => URL.revokeObjectURL(recording.audioUrl))
  }, [cleanupRecording])

  const startRecording = useCallback(async () => {
    if (recordingStatus !== 'idle') return
    cleanupRecording()
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false) }
    setRecordingElapsed(0)

    try {
      // 原生录音（仅取音频 blob，不用 speech 识别）
      const nativeSession = await startBestNativeVoiceInput({
        language: 'en-US',
        useNativeSpeechRecognition: false,
      })
      if (nativeSession) {
        nativeSessionRef.current = nativeSession
        setRecordingStatus('recording')
        const startedAt = Date.now()
        timerRef.current = setInterval(() => setRecordingElapsed(Date.now() - startedAt), 200)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        saveLevelRecording(currentIdx, url)
        setRecordingStatus('idle')
      }

      mediaRecorderRef.current = mr
      mr.start(200)
      setRecordingStatus('recording')
      const startedAt = Date.now()
      timerRef.current = setInterval(() => setRecordingElapsed(Date.now() - startedAt), 200)
    } catch {
      setRecordingStatus('idle')
    }
  }, [recordingStatus, cleanupRecording, currentIdx, saveLevelRecording])

  const stopRecording = useCallback(() => {
    const ns = nativeSessionRef.current
    if (ns) {
      nativeSessionRef.current = null
      // 原生录音：speech 类型无音频 blob，跳过；audio 类型获取 blob 保存
      if (ns.kind !== 'speech') {
        ns.stop().then((result) => {
          const url = URL.createObjectURL(result.blob)
          saveLevelRecording(currentIdx, url)
        }).catch(() => {})
      }
      setRecordingStatus('idle')
      return
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [currentIdx, saveLevelRecording])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { audio.play().catch(() => {}); setIsPlaying(true) }
    else { audio.pause(); setIsPlaying(false) }
  }, [])

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  // 切换 level 时加载该级的录音（回顾模式优先用 reviewData）
  const displayAudioUrl = isReview
    ? (reviewAudios.get(currentIdx)?.audioUrl ?? null)
    : (levelRecordings.get(currentIdx)?.audioUrl ?? null)

  const doneLevelAudios = isReview ? reviewAudios : levelRecordings

  // 全部完成
  if (isDone) {
    return (
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-6">
          {/* <CheckCircle2 className="size-10 text-green-500" /> */}
          {/* <p className="text-sm font-semibold text-foreground">已掌握完整长句</p>
          <div className="w-full rounded-md bg-muted/50 px-4 py-2">
            <p className="text-sm text-foreground">{levels[totalLevels - 1].en}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{levels[totalLevels - 1].zh}</p>
          </div> */}
          <div className="w-full space-y-2">
            {levels.map((level, idx) => {
              const audioUrl = doneLevelAudios.get(idx)?.audioUrl ?? null
              return (
                <div key={`${level.level}-${idx}`} className="rounded-md border border-border/60 bg-background/65 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-muted-foreground">
                        第 {level.level} 级 · {level.label}
                      </p>
                      <p className="mt-0.5 text-sm font-medium leading-relaxed text-foreground">{level.en}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{level.zh}</p>
                    </div>
                    {audioUrl && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">已录音</Badge>
                    )}
                  </div>
                  {audioUrl && (
                    // biome-ignore lint/a11y/useMediaCaption: short self-recording replay
                    <audio src={audioUrl} controls preload="metadata" className="mt-2 h-8 w-full" />
                  )}
                </div>
              )
            })}
          </div>
          <Button
            size="default"
            variant="outline"
            className="mt-1 gap-1.5 text-sm"
            onClick={goBack}
          >
            <ChevronLeft className="size-4" />
            上一级
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!current) return null

  // 构建上一级展示文字（高亮当前新增部分）
  const renderPreviousLine = previous ? (
    <div className="rounded-md bg-muted/60 px-3 py-2">
      <p className="text-[10px] text-muted-foreground mb-0.5">{t('practiceSession.previousLevel')}</p>
      <p className="text-sm text-foreground/60">{previous.en}</p>
      <p className="text-[11px] text-muted-foreground/60 mt-0.5">{previous.zh}</p>
    </div>
  ) : null

  // 构建本级展示文字（高亮部分用 primary 色标记）
  const renderCurrentLine = () => {
    if (!current.highlight) {
      return <p className="text-base font-semibold text-foreground">{current.en}</p>
    }
    // 在句子中标记 highlight 部分
    const idx = current.en.toLowerCase().indexOf(current.highlight.toLowerCase())
    if (idx < 0) return <p className="text-base font-semibold text-foreground">{current.en}</p>
    const before = current.en.slice(0, idx)
    const match = current.en.slice(idx, idx + current.highlight.length)
    const after = current.en.slice(idx + current.highlight.length)
    return (
      <p className="text-base font-semibold text-foreground">
        {before}
        <span className="rounded bg-primary/15 px-0.5 text-primary font-bold">{match}</span>
        {after}
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{t('practiceSession.sentenceDecomposition')}</Badge>
          <Badge variant="outline" className="text-[10px]">{title}</Badge>
          <span className="ml-auto text-[10px] text-muted-foreground">{current.level}/{totalLevels}</span>
        </div>
      )}

      {/* Progress */}
      <Progress value={(current.level / totalLevels) * 100} className="h-1" />

      {/* 当前层级标签 */}
      <p className="text-xs font-medium text-foreground/70">
        {t('practiceSession.currentLevel', { n: current.level, label: current.label })}
      </p>

      {/* 上一级 */}
      {renderPreviousLine}

      {/* 本级 — 高亮新增 */}
      <div className="rounded-md bg-primary/[0.04] px-3 py-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{renderCurrentLine()}</div>
          {(current.audioUrl || current.audioAssetId) && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 shrink-0 rounded-full"
              title="播放句子音频"
              onClick={() => exerciseAudio.play(current.audioUrl, current.audioAssetId, 'warmup_audio')}
            >
              <Play className="size-3.5" />
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{current.zh}</p>
        {current.hint && (
          <p className="mt-1 text-[11px] text-primary/70">{current.hint}</p>
        )}
      </div>

      {/* ── 录音 & 回放（回顾模式只显示回放）── */}
      <div className="flex items-center gap-2">
        {!isReview && recordingStatus === 'idle' && (
          <Button
            variant="outline"
            size="sm"
            onClick={startRecording}
            className="gap-1.5 rounded-full"
          >
            <Mic className="size-3.5" />
            {displayAudioUrl ? '重录' : '录音'}
          </Button>
        )}
        {!isReview && recordingStatus === 'recording' && (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="gap-1.5 rounded-full"
            >
              <Square className="size-3.5 fill-current" />
              停止
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
              {formatElapsed(recordingElapsed)}
            </span>
          </>
        )}
        {displayAudioUrl && recordingStatus === 'idle' && (
          <>
            <button
              type="button"
              onClick={togglePlay}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-0.5" />}
            </button>
            {/* biome-ignore lint/a11y/useMediaCaption: short self-recording replay */}
            <audio
              ref={audioRef}
              src={displayAudioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              preload="auto"
            />
            <span className="text-[11px] text-muted-foreground">{isReview ? '录音回放' : ''}</span>
          </>
        )}
      </div>
      {/* Navigation: 上一级 / 下一级 */}
      <div className="flex gap-2">
        <Button
          size="default"
          variant="outline"
          className="min-h-11 flex-1 gap-1.5 text-sm"
          onClick={goBack}
          disabled={isFirst}
        >
          <ChevronLeft className="size-4" />
          上一级
        </Button>
        <Button
          size="default"
          variant="outline"
          className="min-h-11 flex-1 gap-1.5 text-sm"
          onClick={advance}
        >
          {isLast ? '完成' : '下一级'}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
