import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, Edit3, MessageSquare, Volume2, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import { synthesizeText } from '@/lib/tts-api'
import { practiceAiApi } from '../api/english-practice-api'

type DrillStatus = 'idle' | 'playing' | 'judging' | 'passed' | 'failed'

interface ChunkOutputDrillCardProps {
  chunk: { text: string; meaning?: string; description?: string | null }
  items: { zh: string; answer?: string }[]
  groupTitle?: string
  onComplete?: (itemIndex: number, passed: boolean) => void
}

/** Chunk 输出热身卡片 — 跟读/替换/回答三步 */
export function ChunkOutputDrillCard({
  chunk,
  items,
  groupTitle,
  onComplete,
}: ChunkOutputDrillCardProps) {
  const { t } = useTranslation()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [status, setStatus] = useState<DrillStatus>('idle')
  const [feedback, setFeedback] = useState('')
  const [correction, setCorrection] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)

  const current = items[currentIdx]
  const totalItems = items.length

  // ── 播放 TTS 跟读范文 ──
  const playAudio = useCallback(async () => {
    if (!current?.answer) return
    setAudioPlaying(true)
    try {
      const result = await synthesizeText({
        text: current.answer,
        provider: 'minimax' as any,
        model: 'speech-02',
      })
      const blob = await fetch(`data:${result.mimeType};base64,${result.audioBase64}`).then(r => r.blob())
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => { URL.revokeObjectURL(url); setAudioPlaying(false) }
      audio.onerror = () => { setAudioPlaying(false) }
      await audio.play()
    } catch {
      setAudioPlaying(false)
    }
  }, [current?.answer])

  // ── 提交判断 ──
  const submit = useCallback(async () => {
    if (!userInput.trim() || !current || status === 'judging') return
    setStatus('judging')
    setFeedback('')
    try {
      const judgement = await practiceAiApi.judgeDialogueTurn({
        topicId: '', // not needed for drill
        npcText: current.zh,
        userText: userInput.trim(),
        objectives: [current.zh],
        targetChunks: current.answer ? [current.answer] : [],
        mode: 'targeted_output',
        requiredChunks: current.answer ? [current.answer] : [],
      })
      if (judgement.passed) {
        setStatus('passed')
        setFeedback(judgement.feedback || '通过！')
        onComplete?.(currentIdx, true)
        setTimeout(() => advance(), 1000)
      } else {
        setStatus('failed')
        setFeedback(judgement.feedback || '再试一次')
        setCorrection(judgement.correction || current.answer || '')
      }
    } catch (err: any) {
      setStatus('failed')
      setFeedback(err?.message || '判断失败')
    }
  }, [userInput, current, status, currentIdx, onComplete])

  // ── 前进到下一题 ──
  const advance = useCallback(() => {
    setStatus('idle')
    setUserInput('')
    setFeedback('')
    setCorrection('')
    setShowAnswer(false)
    if (currentIdx < totalItems - 1) {
      setCurrentIdx(prev => prev + 1)
    }
  }, [currentIdx, totalItems])

  if (!current) return null

  return (
    <Card className="border-0 bg-muted/30 shadow-none">
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">Chunk</Badge>
          {groupTitle && <Badge variant="outline" className="text-[10px]">{groupTitle}</Badge>}
          <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
        </div>

        {/* Chunk display */}
        <div className="rounded-md bg-primary/5 px-3 py-2">
          <p className="text-sm font-semibold text-primary">{chunk.text}</p>
          {chunk.meaning && <p className="mt-0.5 text-[11px] text-muted-foreground">{chunk.meaning}</p>}
        </div>

        {/* Task prompt */}
        <div>
          <p className="text-xs text-muted-foreground">{t('practiceSession.sayInEnglish')}:</p>
          <p className="text-base font-semibold text-foreground">{current.zh}</p>
        </div>

        {/* Action buttons: 跟读 / 提示 / 跳过 */}
        <div className="flex gap-2">
          <Button size="default" variant="outline" className="min-h-11 flex-1 gap-1.5 text-sm" onClick={playAudio} disabled={audioPlaying}>
            {audioPlaying ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
            {'跟读'}
          </Button>
          <Button size="default" variant="outline" className="min-h-11 flex-1 gap-1.5 text-sm" onClick={() => setShowAnswer(!showAnswer)}>
            <Edit3 className="size-4" />
            {showAnswer ? '隐藏' : '提示'}
          </Button>
          <Button size="default" variant="outline" className="min-h-11 flex-1 gap-1.5 text-sm" onClick={advance}>
            <MessageSquare className="size-4" />
            跳过
          </Button>
        </div>

        {/* Answer hint */}
        {showAnswer && current.answer && (
          <div className="rounded-md bg-muted/60 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{current.answer}</p>
          </div>
        )}

        {/* Input area */}
        <Textarea
          value={userInput}
          onChange={(e) => { setUserInput(e.target.value); setStatus('idle'); setFeedback('') }}
          placeholder="输入英文或使用语音..."
          className="min-h-[60px] resize-none rounded-xl border-0 bg-background/70 text-base"
          disabled={status === 'judging' || status === 'passed'}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        />

        {/* Feedback */}
        {feedback && (
          <div className={cn('rounded-md px-3 py-2', status === 'passed' ? 'bg-green-500/10' : 'bg-amber-500/10')}>
            <div className="flex items-center gap-1.5">
              {status === 'passed' ? <CheckCircle2 className="size-3.5 text-green-500" /> : null}
              <p className="text-[11px] font-medium">{status === 'passed' ? '通过' : '再试一次'}</p>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{feedback}</p>
            {correction && (
              <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">{correction}</p>
            )}
          </div>
        )}

        {/* Submit */}
        <Button className="w-full min-h-11" size="default" onClick={submit} disabled={status === 'judging' || status === 'passed' || !userInput.trim()}>
          {status === 'judging' ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          {status === 'judging' ? '判断中...' : status === 'passed' ? '已通过' : '提交'}
        </Button>
      </CardContent>
    </Card>
  )
}
