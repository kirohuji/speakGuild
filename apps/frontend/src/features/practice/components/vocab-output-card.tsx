import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, Eye, Loader2, CheckCircle2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import { practiceAiApi, type DrillDirection } from '../api/english-practice-api'

interface VocabDrillSubItem {
  vocabId: string
  promptZh: string
  targetWords?: string[]
  suggestedAnswer?: string
  hint?: string
}

interface VocabOutputCardProps {
  title: string
  vocabs: VocabDrillSubItem[]
  direction?: DrillDirection
  onComplete?: (index: number, passed: boolean) => void
}

/** 高亮目标词汇 */
function highlightWords(text: string, words: string[]) {
  if (!words.length) return text
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(${pattern})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) => {
    if (words.some(w => w.toLowerCase() === part.toLowerCase())) {
      return <mark key={i} className="rounded bg-blue-500/20 px-0.5 text-blue-600 dark:text-blue-400 font-semibold">{part}</mark>
    }
    return part
  })
}

/** 词汇输出卡片 */
export function VocabOutputCard({
  title,
  vocabs,
  direction = 'zh_to_en',
  onComplete,
}: VocabOutputCardProps) {
  const { t } = useTranslation()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [judging, setJudging] = useState(false)
  const [result, setResult] = useState<{ passed: boolean; feedback: string; correction?: string } | null>(null)
  const [hintLevel, setHintLevel] = useState<'none' | 'hint' | 'answer'>('none')

  const current = vocabs[currentIdx]
  const totalItems = vocabs.length
  const isZhToEn = direction === 'zh_to_en'

  const teachingHint = useMemo(() => {
    if (current?.hint) return current.hint
    if (!current?.targetWords?.length) return null
    const words = current.targetWords.join('、')
    return `请使用以下词汇表达：${words}。试着把它们放进一个完整的句子里。`
  }, [current?.hint, current?.targetWords])

  const submit = useCallback(async () => {
    if (!userInput.trim() || !current || judging) return
    setJudging(true)
    setResult(null)
    try {
      const judgement = await practiceAiApi.judgeDialogueTurn({
        topicId: '',
        npcText: isZhToEn ? current.promptZh : (current.suggestedAnswer ?? current.promptZh),
        userText: userInput.trim(),
        objectives: isZhToEn ? [current.promptZh] : [`理解英文：${current.suggestedAnswer ?? ''}`],
        mode: 'targeted_output',
        ...(isZhToEn
          ? { targetWords: current.targetWords, targetChunks: current.suggestedAnswer ? [current.suggestedAnswer] : [] }
          : {}),
      })
      if (judgement.passed) {
        setResult({ passed: true, feedback: judgement.feedback || '正确！' })
        setHintLevel('answer')
        onComplete?.(currentIdx, true)
      } else {
        setResult({ passed: false, feedback: judgement.feedback || '再试一次', correction: judgement.correction || current.suggestedAnswer || '' })
      }
    } catch (err: any) {
      setResult({ passed: false, feedback: err?.message || t('practiceVn.feedbackUnavailable') })
    } finally {
      setJudging(false)
    }
  }, [userInput, current, judging, currentIdx, isZhToEn, onComplete, t])

  const advance = useCallback(() => {
    setResult(null)
    setUserInput('')
    setHintLevel('none')
    if (currentIdx < totalItems - 1) setCurrentIdx(prev => prev + 1)
  }, [currentIdx, totalItems])

  if (!current) return null

  const promptLabel = isZhToEn ? '用英文说出' : '用中文说出'
  const displayText = isZhToEn ? current.promptZh : (current.suggestedAnswer ?? current.promptZh)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">词汇</Badge>
        <Badge variant="outline" className="text-[10px]">{title}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground">{currentIdx + 1}/{totalItems}</span>
      </div>

      {/* Target words */}
      {isZhToEn && current.targetWords?.length ? (
        <div className="rounded-xl bg-gradient-to-br from-blue-500/8 to-blue-500/3 px-4 py-3">
          <p className="text-sm text-muted-foreground">目标词汇</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {current.targetWords.map((word) => (
              <span key={word} className="rounded-md bg-blue-500/15 px-2 py-1 text-sm font-medium text-blue-700 dark:text-blue-300">{word}</span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Task prompt */}
      <div className="rounded-lg bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">{promptLabel}</p>
        <p className="text-lg font-semibold text-foreground">{displayText}</p>
      </div>

      {/* Progressive hints */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => setHintLevel(hintLevel === 'none' ? 'hint' : hintLevel === 'hint' ? 'none' : 'none')}>
            <Lightbulb className="size-3.5" />💡 提示
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => setHintLevel(hintLevel === 'answer' ? 'none' : 'answer')}>
            <Eye className="size-3.5" />{hintLevel === 'answer' ? '隐藏答案' : '显示答案'}
          </Button>
        </div>

        {hintLevel !== 'none' && (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 space-y-2">
            {teachingHint && (
              <div className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                <p className="text-[11px] text-foreground/80">{teachingHint}</p>
              </div>
            )}
            {hintLevel === 'answer' && current.suggestedAnswer && (
              <>
                {teachingHint && <Separator className="opacity-50" />}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">参考答案</p>
                  <p className="text-sm font-medium text-foreground">
                    {highlightWords(current.suggestedAnswer, current.targetWords ?? [])}
                  </p>
                </div>
              </>
            )}
            {hintLevel === 'answer' && (
              <details className="text-[10px] text-muted-foreground">
                <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-foreground">
                  <ChevronDown className="size-3" /> 学习说明
                </summary>
                <p className="mt-1">记住搭配，在不同场景复用这个表达。</p>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Input — persist on success */}
      <Textarea
        value={userInput}
        onChange={(e) => { if (!result?.passed) { setUserInput(e.target.value); setResult(null) } }}
        placeholder={isZhToEn ? '输入英文...' : '输入中文...'}
        className="min-h-[60px] resize-none rounded-xl border-0 bg-background/70 text-base"
        disabled={judging || !!result?.passed}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
      />

      {/* Result */}
      {result && (
        <div className={cn('rounded-lg px-3 py-2.5', result.passed ? 'bg-green-500/10' : 'bg-amber-500/10')}>
          <div className="flex items-center gap-1.5">
            {result.passed ? <CheckCircle2 className="size-3.5 text-green-500" /> : null}
            <p className="text-xs font-medium">{result.passed ? '正确！' : '再试一次'}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{result.feedback}</p>
          {result.correction && !result.passed && (
            <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">{highlightWords(result.correction, current.targetWords ?? [])}</p>
          )}
        </div>
      )}

      {/* Actions */}
      {result?.passed ? (
        <Button className="w-full min-h-11 rounded-xl" onClick={advance}>
          {currentIdx < totalItems - 1 ? '下一题' : '完成'}
        </Button>
      ) : (
        <Button className="w-full min-h-11 rounded-xl" size="default" onClick={submit} disabled={judging || !userInput.trim()}>
          {judging ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          {judging ? '评判中...' : '提交'}
        </Button>
      )}
    </div>
  )
}
