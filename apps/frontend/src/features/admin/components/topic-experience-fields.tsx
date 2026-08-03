import { useMemo, useState } from 'react'
import { Headphones, Loader2, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Scene, TrainingTopic } from '../api-content-admin'
import { contentExperienceAdminApi, type AiWritingTopicDraft } from '../api-content-experiences'
import { FileUploadField } from './file-upload-field'

type Props = {
  mode: Exclude<Scene['contentMode'], 'practice' | 'novel' | 'story'>
  value: Record<string, any>
  mediaAssetId?: string | null
  transcript?: TrainingTopic['transcript']
  sceneId: string
  draftContext?: {
    title?: string
    promptEn?: string
    difficulty?: string
    vocabulary?: string[]
    chunks?: string[]
    sentencePatterns?: string[]
  }
  onApplyDraft?: (draft: AiWritingTopicDraft) => void
  onChange: (next: { contentConfig?: Record<string, any>; mediaAssetId?: string | null; transcript?: TrainingTopic['transcript'] }) => void
}

const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean)

export function TopicExperienceFields({ mode, value, mediaAssetId, transcript, sceneId, draftContext, onApplyDraft, onChange }: Props) {
  if (mode === 'writing') return <WritingFields sceneId={sceneId} context={draftContext} value={value.writing ?? {}} onApplyDraft={onApplyDraft} onChange={(writing) => onChange({ contentConfig: { ...value, writing } })} />
  if (mode === 'reading') return <ReadingFields value={value.reading ?? { questions: [] }} onChange={(reading) => onChange({ contentConfig: { ...value, reading } })} />
  return <ListeningFields value={value.listening ?? {}} mediaAssetId={mediaAssetId} transcript={transcript ?? []} onChange={(next) => onChange({ contentConfig: { ...value, listening: next.listening }, mediaAssetId: next.mediaAssetId, transcript: next.transcript })} />
}

function WritingFields({
  value,
  sceneId,
  context,
  onApplyDraft,
  onChange,
}: {
  value: Record<string, any>
  sceneId: string
  context?: Props['draftContext']
  onApplyDraft?: (draft: AiWritingTopicDraft) => void
  onChange: (value: Record<string, any>) => void
}) {
  const [instruction, setInstruction] = useState('')
  const [generating, setGenerating] = useState(false)

  const generateDraft = async () => {
    if (generating) return
    setGenerating(true)
    try {
      const draft = await contentExperienceAdminApi.generateWritingTopic(sceneId, {
        instruction: instruction.trim() || undefined,
        genre: value.genre ?? 'paragraph',
        minWords: Number(value.minWords) || 80,
        maxWords: Number(value.maxWords) || 180,
        difficulty: context?.difficulty,
        currentTitle: context?.title,
        currentPromptEn: context?.promptEn,
        vocabulary: context?.vocabulary,
        chunks: context?.chunks,
        sentencePatterns: context?.sentencePatterns,
      })
      onApplyDraft?.(draft)
      toast.success('AI 题目已回填，请检查后保存')
    } catch (error: any) {
      toast.error(error?.message || 'AI 写作题生成失败')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-amber-300/60 bg-[linear-gradient(135deg,rgba(251,191,36,0.11),rgba(255,255,255,0)_58%)] dark:border-amber-700/50">
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-amber-500 text-white shadow-sm"><Sparkles className="size-4" /></span>
              <div><p className="text-sm font-semibold">AI 写作题起稿台</p><p className="text-xs text-muted-foreground">会参考学习包和已绑定语言素材，结果仅回填表单，不会自动保存。</p></div>
            </div>
            <Textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              className="min-h-24 resize-y bg-background/80"
              maxLength={2000}
              placeholder="可选：描述想生成的情境，例如“为准备出国交换的 B1 学生生成一封向房东反馈暖气问题的邮件”。留空则由 AI 根据学习包自行设计。"
            />
          </div>
          <Button type="button" onClick={generateDraft} disabled={generating} className="min-w-36 bg-amber-600 text-white hover:bg-amber-700">
            {generating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {generating ? '正在起稿' : 'AI 生成题目'}
          </Button>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <div><Label>文体</Label><Select value={value.genre ?? 'paragraph'} onChange={(event) => onChange({ ...value, genre: event.target.value })}><option value="journal">日记</option><option value="message">消息</option><option value="email">邮件</option><option value="paragraph">段落</option><option value="essay">文章</option></Select></div>
        <div><Label>最少字数</Label><Input type="number" min={1} value={value.minWords ?? 80} onChange={(event) => onChange({ ...value, minWords: Number(event.target.value) })} /></div>
        <div><Label>最多字数</Label><Input type="number" min={1} value={value.maxWords ?? 180} onChange={(event) => onChange({ ...value, maxWords: Number(event.target.value) })} /></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><Label>写作受众</Label><Input value={value.audience ?? ''} onChange={(event) => onChange({ ...value, audience: event.target.value })} placeholder="同事、朋友、考试阅卷人" /></div>
        <div><Label>写作目的</Label><Input value={value.purpose ?? ''} onChange={(event) => onChange({ ...value, purpose: event.target.value })} placeholder="解释、说服、叙述、提出请求" /></div>
      </div>
      <div><Label>必须覆盖的要点（每行一项）</Label><Textarea value={(value.requirements ?? []).join('\n')} onChange={(event) => onChange({ ...value, requirements: lines(event.target.value) })} placeholder={'说明背景\n提出请求\n给出下一步'} className="min-h-32" /></div>
      <div><Label>AI 评分维度（每行一项）</Label><Textarea value={(value.rubric ?? ['任务完成', '结构清晰', '语言准确', '表达丰富']).join('\n')} onChange={(event) => onChange({ ...value, rubric: lines(event.target.value) })} className="min-h-28" /></div>
    </div>
  )
}

function ReadingFields({ value, onChange }: { value: Record<string, any>; onChange: (value: Record<string, any>) => void }) {
  const questions: any[] = value.questions ?? []
  const updateQuestion = (index: number, patch: Record<string, any>) => onChange({ ...value, questions: questions.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question) })
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div><Label>文章来源</Label><Input value={value.source ?? ''} onChange={(event) => onChange({ ...value, source: event.target.value })} /></div>
        <div><Label>预计词数</Label><Input type="number" min={1} value={value.wordCount ?? ''} onChange={(event) => onChange({ ...value, wordCount: Number(event.target.value) })} /></div>
        <div><Label>阅读等级</Label><Input value={value.cefr ?? ''} onChange={(event) => onChange({ ...value, cefr: event.target.value })} placeholder="A2 / B1" /></div>
      </div>
      <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">阅读理解题</p><p className="text-xs text-muted-foreground">正文继续使用“基础信息 → 教学内容”；这里配置作答组件和证据。</p></div><Button size="sm" variant="outline" onClick={() => onChange({ ...value, questions: [...questions, { type: 'short', prompt: '', options: [], answer: '', evidence: '' }] })}><Plus className="mr-1 size-3.5" />添加题目</Button></div>
      <div className="space-y-3">
        {questions.map((question, index) => (
          <div key={index} className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2"><Badge variant="outline">第 {index + 1} 题</Badge><Select className="w-36" value={question.type ?? 'short'} onChange={(event) => updateQuestion(index, { type: event.target.value })}><option value="choice">选择题</option><option value="boolean">判断题</option><option value="short">简答题</option><option value="open">开放回答</option></Select><Button size="icon" variant="ghost" className="ml-auto size-8 text-destructive" onClick={() => onChange({ ...value, questions: questions.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="size-3.5" /></Button></div>
            <div className="space-y-3">
              <Input value={question.prompt ?? ''} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="题目" />
              {question.type === 'choice' && <Textarea value={(question.options ?? []).join('\n')} onChange={(event) => updateQuestion(index, { options: lines(event.target.value) })} placeholder="每行一个选项" />}
              <div className="grid gap-3 md:grid-cols-2"><Input value={question.answer ?? ''} onChange={(event) => updateQuestion(index, { answer: event.target.value })} placeholder="标准答案或可接受答案" /><Input value={question.evidence ?? ''} onChange={(event) => updateQuestion(index, { evidence: event.target.value })} placeholder="原文证据" /></div>
            </div>
          </div>
        ))}
        {questions.length === 0 && <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">还没有理解题</div>}
      </div>
    </div>
  )
}

function ListeningFields({
  value,
  mediaAssetId,
  transcript,
  onChange,
}: {
  value: Record<string, any>
  mediaAssetId?: string | null
  transcript: NonNullable<TrainingTopic['transcript']>
  onChange: (next: { listening: Record<string, any>; mediaAssetId?: string | null; transcript: NonNullable<TrainingTopic['transcript']> }) => void
}) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(transcript, null, 2))
  const [jsonError, setJsonError] = useState('')
  const duration = useMemo(() => transcript.reduce((max, segment) => Math.max(max, segment.endMs), 0), [transcript])
  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText)
      if (!Array.isArray(parsed)) throw new Error('字幕必须是数组')
      for (const segment of parsed) {
        if (typeof segment.text !== 'string' || !Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs) || segment.endMs <= segment.startMs) throw new Error('每句必须包含 text、startMs 和大于 startMs 的 endMs')
        for (const word of segment.words ?? []) if (!Number.isFinite(word.startMs) || !Number.isFinite(word.endMs) || word.startMs < segment.startMs || word.endMs > segment.endMs) throw new Error(`“${segment.text}”存在越界词时间戳`)
      }
      setJsonError('')
      onChange({ listening: value, mediaAssetId, transcript: parsed })
    } catch (error: any) {
      setJsonError(error?.message || 'JSON 格式错误')
    }
  }
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/70 bg-sky-500/[0.04] p-4">
        <div className="mb-3 flex items-center gap-2"><Headphones className="size-4 text-sky-600" /><p className="text-sm font-semibold">听力媒体</p></div>
        <FileUploadField accept="audio/*,.mp3,.m4a,.wav,.ogg" group="library" uploadLabel="上传听力音频" onUploaded={(_url, assetId) => onChange({ listening: value, mediaAssetId: assetId, transcript })} />
        {mediaAssetId && <p className="mt-2 text-xs text-muted-foreground">已关联资产：{mediaAssetId}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div><Label>默认语速</Label><Input type="number" min={0.5} max={2} step={0.1} value={value.defaultRate ?? 1} onChange={(event) => onChange({ listening: { ...value, defaultRate: Number(event.target.value) }, mediaAssetId, transcript })} /></div>
        <div><Label>句间停顿（ms）</Label><Input type="number" min={0} value={value.pauseMs ?? 400} onChange={(event) => onChange({ listening: { ...value, pauseMs: Number(event.target.value) }, mediaAssetId, transcript })} /></div>
        <div className="rounded-lg border border-border/70 px-3 py-2"><p className="text-xs text-muted-foreground">时间轴</p><p className="mt-1 text-sm font-semibold">{transcript.length} 句 · {(duration / 1000).toFixed(1)} 秒</p></div>
      </div>
      <div><div className="mb-2 flex items-end justify-between"><div><Label>逐句与词级时间戳 JSON</Label><p className="text-xs text-muted-foreground">每句：text / translation / startMs / endMs；words 中保存 token / startMs / endMs。</p></div><Button size="sm" variant="outline" onClick={applyJson}><Upload className="mr-1 size-3.5" />校验并应用</Button></div><Textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} className="min-h-[360px] font-mono text-xs" spellCheck={false} />{jsonError && <p className="mt-2 text-xs text-destructive">{jsonError}</p>}</div>
    </div>
  )
}
