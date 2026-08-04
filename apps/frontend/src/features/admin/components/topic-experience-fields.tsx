import { useMemo, useState } from 'react'
import { BookOpen, ClipboardCheck, Eye, FilePenLine, Headphones, Loader2, Plus, Sparkles, Target, Trash2, Upload, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { WritingTaskCard } from '@/features/learning/components/writing-task-card'
import { ReadingTaskCard } from '@/features/learning/components/reading-task-card'
import { cn } from '@/lib/cn'
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
    promptZh?: string
    difficulty?: string
    suggestedDurationSec?: number
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
  if (mode === 'reading') return <ReadingFields context={draftContext} value={value.reading ?? { questions: [] }} onChange={(reading) => onChange({ contentConfig: { ...value, reading } })} />
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
        currentQuestionMarkdown: value.questionMarkdown,
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

  const requirements: string[] = value.requirements ?? []

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border/70 bg-muted/25 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
              <div><p className="text-sm font-semibold">AI 命题助手</p><p className="text-xs text-muted-foreground">描述考试场景和能力目标，AI 会生成完整题干与评分要点；生成后仍需人工审题。</p></div>
            </div>
            <Textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              className="min-h-20 resize-y bg-background"
              maxLength={2000}
              placeholder="例如：B1 学生收到学校社团延期通知，需要给组织者写一封邮件，说明影响、提出两个问题并建议新的时间。"
            />
          </div>
          <Button type="button" onClick={generateDraft} disabled={generating} className="min-w-36">
            {generating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {generating ? '正在命题' : '生成完整题目'}
          </Button>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-4">
            <SectionHeading icon={FilePenLine} step="01" title="题目" description="这是考生真正作答的题目正文；支持 Markdown、表格与图片，编辑方式和教学文档一致。" />
            <MarkdownEditor
              label="题目正文"
              value={value.questionMarkdown ?? ''}
              onChange={(questionMarkdown) => onChange({ ...value, questionMarkdown })}
              height={420}
              preview="live"
              placeholder={'## Writing Task\n\n请阅读材料并完成写作。\n\n![题目配图](https://example.com/image.jpg)\n\n**要求：**\n\n- 明确表达观点\n- 使用材料中的信息支持回答'}
            />
            <p className="text-xs leading-5 text-muted-foreground">图片可通过编辑器工具栏插入，使用标准 Markdown 图片语法；保存后移动端会按相同样式渲染。</p>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeading icon={UserRound} step="02" title="任务边界" description="明确考生身份、受众、沟通目的和提交规格。" />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1.5"><Label>文体</Label><Select value={value.genre ?? 'paragraph'} onChange={(event) => onChange({ ...value, genre: event.target.value })}><option value="journal">日记</option><option value="message">消息</option><option value="email">邮件/书信</option><option value="paragraph">段落</option><option value="essay">议论文</option></Select></div>
              <div className="flex flex-col gap-1.5"><Label>最少词数</Label><Input type="number" min={20} value={value.minWords ?? 80} onChange={(event) => onChange({ ...value, minWords: Number(event.target.value) })} /></div>
              <div className="flex flex-col gap-1.5"><Label>最多词数</Label><Input type="number" min={20} value={value.maxWords ?? 180} onChange={(event) => onChange({ ...value, maxWords: Number(event.target.value) })} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5"><Label>考生身份</Label><Input value={value.candidateRole ?? ''} onChange={(event) => onChange({ ...value, candidateRole: event.target.value })} placeholder="例如：参加过学校工作坊的学生" /></div>
              <div className="flex flex-col gap-1.5"><Label>写作对象</Label><Input value={value.audience ?? ''} onChange={(event) => onChange({ ...value, audience: event.target.value })} placeholder="例如：工作坊组织者" /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>写作目的</Label><Input value={value.purpose ?? ''} onChange={(event) => onChange({ ...value, purpose: event.target.value })} placeholder="例如：反馈体验并提出改进建议" /></div>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeading icon={Target} step="03" title="作答要求" description="每一项都应当可以从考生作文中直接判断是否完成。" />
            <div className="flex flex-col gap-1.5"><Label>必须覆盖的要点（每行一项）</Label><Textarea value={requirements.join('\n')} onChange={(event) => onChange({ ...value, requirements: lines(event.target.value) })} placeholder={'说明相关背景\n完成明确的沟通动作\n覆盖指定细节\n给出合适的结尾或下一步'} className="min-h-32" /></div>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeading icon={ClipboardCheck} step="04" title="评分标准" description="用于 AI 反馈，不展示给考生；维度应简短、互不重复。" />
            <div className="flex flex-col gap-1.5"><Label>评分维度（每行一项）</Label><Textarea value={(value.rubric ?? ['任务完成', '结构与衔接', '词汇与表达', '语法准确性', '语域与得体性']).join('\n')} onChange={(event) => onChange({ ...value, rubric: lines(event.target.value) })} className="min-h-28" /></div>
          </section>
        </div>

        <aside className="sticky top-0 overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2"><Eye className="size-4 text-primary" /><p className="text-sm font-semibold">考生视图</p></div>
            <Badge variant="secondary">实时预览</Badge>
          </div>
          <div className="bg-[#fffefb] p-3 dark:bg-background">
            <div className="mb-3 px-1">
              <p className="text-xs text-muted-foreground">移动端写作页</p>
              <h3 className="mt-1 text-base font-semibold leading-6">{context?.title || '未命名写作题'}</h3>
            </div>
            <WritingTaskCard
              questionMarkdown={value.questionMarkdown}
              promptEn={context?.promptEn}
              promptZh={context?.promptZh}
              genre={value.genre}
              minWords={value.minWords}
              maxWords={value.maxWords}
              durationMinutes={Math.max(1, Math.round((context?.suggestedDurationSec ?? 900) / 60))}
              onStart={() => undefined}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function SectionHeading({ icon: Icon, step, title, description }: { icon: typeof FilePenLine; step: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 pb-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Badge variant="outline" className="h-5 px-1.5 text-[10px]">{step}</Badge><h3 className="text-sm font-semibold">{title}</h3></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
    </div>
  )
}

function ReadingFields({ value, context, onChange }: { value: Record<string, any>; context?: Props['draftContext']; onChange: (value: Record<string, any>) => void }) {
  const questions: any[] = value.questions ?? []
  const updateQuestion = (index: number, patch: Record<string, any>) => onChange({ ...value, questions: questions.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question) })
  const addOption = (index: number) => {
    const options = questions[index]?.options ?? []
    updateQuestion(index, { options: [...options, ''] })
  }
  const updateOption = (questionIndex: number, optionIndex: number, option: string) => {
    const previous = questions[questionIndex]
    const options = (previous?.options ?? []).map((item: string, index: number) => index === optionIndex ? option : item)
    updateQuestion(questionIndex, { options, answer: previous.answer === previous.options?.[optionIndex] ? option : previous.answer })
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="min-w-0 space-y-7">
        <section className="space-y-4">
        <SectionHeading icon={BookOpen} step="01" title="阅读题目" description="这是学习者在移动端真正阅读的题目正文；支持 Markdown、图片、表格和引用。" />
        <MarkdownEditor
          label="题目正文"
          value={value.questionMarkdown ?? ''}
          onChange={(questionMarkdown) => onChange({ ...value, questionMarkdown })}
          height={440}
          preview="live"
          placeholder={'## Read the passage\n\n在这里编写阅读材料。\n\n![材料配图](https://example.com/image.jpg)'}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <div><Label>文章来源</Label><Input value={value.source ?? ''} onChange={(event) => onChange({ ...value, source: event.target.value })} /></div>
          <div><Label>预计词数</Label><Input type="number" min={1} value={value.wordCount ?? ''} onChange={(event) => onChange({ ...value, wordCount: Number(event.target.value) })} /></div>
          <div><Label>阅读等级</Label><Input value={value.cefr ?? ''} onChange={(event) => onChange({ ...value, cefr: event.target.value })} placeholder="A2 / B1" /></div>
        </div>
        </section>

        <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading icon={ClipboardCheck} step="02" title="理解题" description="配置学习者读完材料后需要完成的题目与判定答案。" />
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => onChange({ ...value, questions: [...questions, { type: 'choice', prompt: '', options: ['', ''], answer: '', evidence: '' }] })}><Plus className="mr-1 size-3.5" />添加题目</Button>
        </div>
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={index} className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 flex items-center gap-2">
                <Badge>第 {index + 1} 题</Badge>
                <Select className="w-36" value={question.type ?? 'choice'} onChange={(event) => updateQuestion(index, { type: event.target.value, options: event.target.value === 'choice' ? (question.options?.length ? question.options : ['', '']) : [] })}>
                  <option value="choice">单项选择</option>
                  <option value="boolean">判断题</option>
                  <option value="short">简答题</option>
                  <option value="open">开放回答</option>
                </Select>
                <Button size="icon" variant="ghost" className="ml-auto size-8 text-destructive" onClick={() => onChange({ ...value, questions: questions.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="size-3.5" /></Button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5"><Label>题干</Label><Input value={question.prompt ?? ''} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="根据文章，作者为什么……？" /></div>
                {question.type === 'choice' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><Label>选项与正确答案</Label><Button type="button" size="sm" variant="ghost" onClick={() => addOption(index)}><Plus className="mr-1 size-3.5" />添加选项</Button></div>
                    {(question.options ?? []).map((option: string, optionIndex: number) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuestion(index, { answer: option })}
                          className={cn('flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', question.answer === option && option ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground')}
                          aria-label={`将选项 ${optionIndex + 1} 设为正确答案`}
                        >{String.fromCharCode(65 + optionIndex)}</button>
                        <Input className="flex-1" value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} placeholder={`选项 ${String.fromCharCode(65 + optionIndex)}`} />
                        <Button type="button" size="icon" variant="ghost" className="size-9 text-muted-foreground" onClick={() => updateQuestion(index, { options: question.options.filter((_: string, itemIndex: number) => itemIndex !== optionIndex), answer: question.answer === option ? '' : question.answer })}><Trash2 className="size-3.5" /></Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">点击左侧字母设置正确答案。</p>
                  </div>
                )}
                {question.type === 'boolean' && (
                  <div className="space-y-1.5"><Label>正确答案</Label><div className="grid grid-cols-2 gap-2">{['正确', '错误'].map((option) => <Button key={option} type="button" variant={question.answer === option ? 'default' : 'outline'} onClick={() => updateQuestion(index, { answer: option })}>{option}</Button>)}</div></div>
                )}
                {['short', 'open'].includes(question.type) && <div className="space-y-1.5"><Label>参考答案</Label><Textarea value={question.answer ?? ''} onChange={(event) => updateQuestion(index, { answer: event.target.value })} placeholder="用于反馈和判定，不会在作答前展示" /></div>}
                <div className="space-y-1.5"><Label>原文证据</Label><Textarea value={question.evidence ?? ''} onChange={(event) => updateQuestion(index, { evidence: event.target.value })} className="min-h-20" placeholder="粘贴支持正确答案的原文片段" /></div>
              </div>
            </div>
          ))}
          {questions.length === 0 && <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">还没有理解题</div>}
        </div>
        </section>
      </div>

      <aside className="sticky top-0 overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3"><div className="flex items-center gap-2"><Eye className="size-4 text-primary" /><p className="text-sm font-semibold">学习者视图</p></div><Badge variant="secondary">实时预览</Badge></div>
        <div className="bg-[#fffefb] p-3 dark:bg-background">
          <ReadingTaskCard questionMarkdown={value.questionMarkdown} durationMinutes={Math.max(1, Math.round((context?.suggestedDurationSec ?? 900) / 60))} questionCount={questions.length} wordCount={value.wordCount} onStart={() => undefined} />
        </div>
      </aside>
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
