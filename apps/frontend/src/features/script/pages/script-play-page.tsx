import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, MicOff, CheckCircle2, Star, Target, BookOpen, Sparkles, Send, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { Separator } from '@/components/ui/separator'
import { VnScene } from '@/features/vn-engine/vn-scene'
import { DialogueBox } from '@/features/vn-engine/dialogue-box'
import { ChoiceButtons } from '@/features/vn-engine/choice-buttons'
import { useInkStory, type InkLine, type InkChoice } from '@/features/vn-engine/use-ink-story'
import { scriptApi, type EpisodeDetail, type EpisodeReadiness } from '../api/script-api'
import { cn } from '@/lib/cn'

type Phase = 'intro' | 'playing' | 'judging' | 'recap'

export function ScriptPlayPage() {
  const { episodeId } = useParams<{ episodeId: string }>()
  const navigate = useNavigate()

  const [episode, setEpisode] = useState<EpisodeDetail | null>(null)
  const [readiness, setReadiness] = useState<EpisodeReadiness | null>(null)
  const [inkJson, setInkJson] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('intro')

  // Dialogue simulation (fallback when no Ink script)
  const [dialogueIndex, setDialogueIndex] = useState(0)
  const [completedObj, setCompletedObj] = useState<string[]>([])
  const [usedChunks, setUsedChunks] = useState<string[]>([])
  const [round, setRound] = useState(0)
  const maxRounds = 5

  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [userLines, setUserLines] = useState<string[]>([])

  // Recap
  const [recapFeedback, setRecapFeedback] = useState('')

  useEffect(() => {
    if (!episodeId) return
    Promise.all([
      scriptApi.getEpisode(episodeId),
      scriptApi.getReadiness(episodeId),
      scriptApi.getInk(episodeId).catch(() => null),
    ])
      .then(([ep, rdy, ink]) => {
        setEpisode(ep)
        setReadiness(rdy)
        if (ink?.inkJson) setInkJson(ink.inkJson)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [episodeId])

  // Simulated NPC dialogue lines (fallback)
  const npcLines = [
    { speaker: episode?.npcName ?? 'NPC', text: `Hi! Welcome. ${episode?.npcRole ? `I'm ${episode.npcRole}.` : ''} How can I help you today?` },
    { speaker: episode?.npcName ?? 'NPC', text: "Great, let me help you with that. Could you tell me more?" },
    { speaker: episode?.npcName ?? 'NPC', text: "I see. Is there anything else you need?" },
    { speaker: episode?.npcName ?? 'NPC', text: "Alright, let me check on that for you." },
    { speaker: episode?.npcName ?? 'NPC', text: "Thank you! That's all I needed. Have a great day!" },
  ]

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recorder.start()
      setIsRecording(true)
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, 30000)
    } catch { alert('无法访问麦克风') }
  }

  const stopRecording = () => {
    setIsRecording(false)
    const simulated = `[转写] 用户回答了关于 ${episode?.objectives?.[0] ?? '任务'} 的内容...`
    setTranscript(simulated)
    setUserLines((prev) => [...prev, simulated])
  }

  const submitForJudgement = () => {
    setPhase('judging')
    // Simulate AI judgement
    setCompletedObj((prev) => {
      const remaining = (episode?.objectives ?? []).filter((o) => !prev.includes(o))
      if (remaining.length > 0) return [...prev, remaining[0]]
      return prev
    })
    setUsedChunks((prev) => {
      const chunks = episode?.coreChunks ?? []
      if (chunks.length > prev.length) return [...prev, chunks[prev.length]?.chunk?.text ?? '']
      return prev
    })
    setRound((r) => r + 1)
    setDialogueIndex((i) => Math.min(i + 1, npcLines.length - 1))

    setTimeout(() => {
      if (round + 1 >= maxRounds || completedObj.length >= (episode?.objectives?.length ?? 0)) {
        finishEpisode()
      } else {
        setPhase('playing')
        setTranscript('')
      }
    }, 1500)
  }

  const finishEpisode = async () => {
    setPhase('recap')
    setRecapFeedback('本次对话中，你完成了大部分任务目标，使用了核心表达。继续练习可以进一步提升流利度。')
    try {
      await scriptApi.complete(episodeId!, {
        passed: true,
        objectivesDone: completedObj.length,
        chunksUsed: usedChunks.length,
        dialogueRounds: round + 1,
        retellCompleted: true,
      })
    } catch {}
  }

  if (loading) return <MobilePageLoading rows={5} minHeightClassName="min-h-screen" />
  if (!episode) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8"><p className="text-destructive">关卡不存在</p><Button variant="outline" onClick={() => navigate(-1)}>返回</Button></div>

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{episode.chapterTitle}</p>
          <h1 className="text-lg font-bold text-foreground">{episode.title}</h1>
        </div>
        <Badge variant="secondary">{episode.requiredOutputLevel ?? 'L2'}</Badge>
      </div>

      {/* Phase: Intro */}
      {phase === 'intro' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4" /> 任务目标
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(episode.objectives ?? []).map((obj: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <Star className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    {obj}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {episode.coreChunks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="size-4" /> 核心 Chunk ({episode.coreChunks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {episode.coreChunks.map((cc: any) => (
                    <Badge key={cc.chunk?.id ?? cc.chunkId} variant="outline" className="text-sm">
                      {cc.chunk?.text ?? cc.chunkId}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {readiness && readiness.readiness < 70 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 text-sm text-amber-600 dark:text-amber-400">
                场景准备度 {readiness.readiness}%，建议先在练习模式中掌握核心 Chunk
              </CardContent>
            </Card>
          )}

          <Button className="w-full" size="lg" onClick={() => setPhase('playing')}>
            <Play className="mr-2 size-5" /> 开始挑战
          </Button>
        </div>
      )}

      {/* Phase: Playing */}
      {phase === 'playing' && (
        <div className="space-y-4">
          {/* HUD */}
          <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">目标</p>
              <Progress value={(completedObj.length / Math.max(episode.objectives.length, 1)) * 100} className="h-1.5" />
              <p className="mt-0.5 text-xs text-muted-foreground">{completedObj.length}/{episode.objectives.length}</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Chunk</p>
              <Progress value={(usedChunks.length / Math.max(episode.coreChunks.length, 1)) * 100} className="h-1.5" />
              <p className="mt-0.5 text-xs text-muted-foreground">{usedChunks.length}/{episode.coreChunks.length}</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">轮次</p>
              <p className="text-sm font-bold text-foreground">{round}/{maxRounds}</p>
            </div>
          </div>

          {/* VN Scene */}
          <VnScene className="min-h-[350px]">
            <div className="space-y-3">
              {/* NPC dialogue */}
              {npcLines.slice(0, dialogueIndex + 1).map((line, i) => (
                <DialogueBox
                  key={i}
                  speaker={line.speaker}
                  text={line.text}
                  isCurrent={i === dialogueIndex}
                />
              ))}

              {/* User responses */}
              {userLines.map((line, i) => (
                <div key={`u-${i}`} className="flex justify-end">
                  <div className="max-w-[80%] rounded-xl bg-primary/15 px-4 py-2">
                    <p className="text-sm text-foreground">{line}</p>
                    <p className="text-xs text-muted-foreground">你</p>
                  </div>
                </div>
              ))}

              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-destructive/10 py-3">
                  <Mic className="size-4 animate-pulse text-destructive" />
                  <span className="text-sm text-destructive">正在录音...</span>
                </div>
              )}

              {/* Transcript preview */}
              {transcript && !isRecording && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-xl bg-muted px-4 py-2">
                    <p className="text-sm text-foreground">{transcript}</p>
                    <p className="text-xs text-muted-foreground">转写预览</p>
                  </div>
                </div>
              )}
            </div>
          </VnScene>

          {/* Controls */}
          <div className="flex gap-2">
            {!transcript ? (
              <Button
                className="flex-1"
                size="lg"
                variant={isRecording ? 'destructive' : 'default'}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? <MicOff className="mr-2 size-5" /> : <Mic className="mr-2 size-5" />}
                {isRecording ? '停止录音' : '按住录音'}
              </Button>
            ) : (
              <>
                <Button variant="outline" className="flex-1" onClick={() => setTranscript('')}>
                  重新录音
                </Button>
                <Button className="flex-1" onClick={submitForJudgement}>
                  <Send className="mr-2 size-4" /> 提交回答
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Phase: Judging */}
      {phase === 'judging' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <Sparkles className="size-10 animate-pulse text-primary" />
              <p className="text-foreground">AI 正在分析你的回答...</p>
              <Progress value={60} className="w-48 h-1.5" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase: Recap */}
      {phase === 'recap' && (
        <div className="space-y-4">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-5 text-green-500" /> 关卡完成!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{completedObj.length}/{episode.objectives.length}</p>
                  <p className="text-xs text-muted-foreground">目标完成</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{usedChunks.length}/{episode.coreChunks.length}</p>
                  <p className="text-xs text-muted-foreground">Chunk 使用</p>
                </div>
              </div>
              {recapFeedback && (
                <p className="text-sm text-muted-foreground">{recapFeedback}</p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setPhase('playing'); setDialogueIndex(0); setRound(0); setCompletedObj([]); setUsedChunks([]); setUserLines([]) }}>
              重新挑战
            </Button>
            <Button className="flex-1" onClick={() => navigate('/script')}>
              返回剧本列表
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
