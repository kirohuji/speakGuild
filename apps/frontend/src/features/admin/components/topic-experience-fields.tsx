import { useMemo, useState, useRef, useEffect } from 'react'
import { BookOpen, ClipboardCheck, Eye, FilePenLine, Headphones, Languages, Loader2, Plus, Sparkles, Target, Trash2, Upload, UserRound, Play, Pause, Clock, Music, FileAudio, GripVertical, Volume2, Split } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WritingTaskCard } from '@/features/learning/components/writing-task-card'
import { ReadingTaskCard } from '@/features/learning/components/reading-task-card'
import { cn } from '@/lib/cn'
import { getFileAssetPrivateUrl } from '@/features/file-assets/api'
import type { Scene, TrainingTopic } from '../api-content-admin'
import { contentExperienceAdminApi, type AiWritingTopicDraft } from '../api-content-experiences'
import {
  listeningPipelineFromText,
  listeningPipelineFromAudio,
  type ListeningTranscriptSegment,
} from '../api-content-admin'
import { listAiProviders, type AiProviderItem } from '../api-ai-models'

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
  const isDialogue = value.genre === 'dialogue'
  const isTranslation = value.genre === 'translation'
  const isFormal = value.genre === 'essay' || value.genre === 'email'

  const generateDraft = async () => {
    if (generating) return
    setGenerating(true)
    try {
      const draft = await contentExperienceAdminApi.generateWritingTopic(sceneId, {
        instruction: instruction.trim() || undefined,
        genre: value.genre ?? 'paragraph',
        translationDirection: value.direction ?? 'zh_to_en',
        translationScope: value.scope ?? 'sentence',
        minWords: isTranslation ? undefined : Number(value.minWords) || (isDialogue ? 40 : 80),
        maxWords: isTranslation ? undefined : Number(value.maxWords) || (isDialogue ? 120 : 180),
        difficulty: context?.difficulty,
        currentTitle: context?.title,
        currentPromptEn: context?.promptEn,
        currentQuestionMarkdown: isDialogue || isTranslation ? undefined : value.questionMarkdown,
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
  const turns: Array<{ aText: string; hint: string }> = value.turns ?? []

  return (
    <div className="flex flex-col gap-5">
      {/* AI 命题助手 */}
      <section className="rounded-xl border border-border/70 bg-muted/25 p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-3.5" /></span>
              <div><p className="text-sm font-semibold">AI 命题助手</p><p className="text-xs text-muted-foreground">{isTranslation ? '描述主题、难度和翻译方向，AI 会生成可逐段审核的原文、参考译文与提示。' : isDialogue ? '描述对话场景和角色关系，AI 生成对话轮次和提示。' : '描述考试场景和能力目标，AI 会生成完整题干与评分要点；生成后仍需人工审题。'}</p></div>
            </div>
            <Textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              className="min-h-16 resize-y bg-background"
              maxLength={2000}
              placeholder={isTranslation
                ? '例如：B1 难度，中译英篇章，主题是第一次租房时与房东沟通水电和入住时间。每段给出提示但不要泄露完整译文。'
                : isDialogue
                ? '例如：两个学生在食堂讨论周末计划，A 邀请 B 去爬山，B 有事但想改天。'
                : '例如：B1 学生收到学校社团延期通知，需要给组织者写一封邮件，说明影响、提出两个问题并建议新的时间。'}
            />
          </div>
          <Button type="button" onClick={generateDraft} disabled={generating} size="sm" className="min-w-32">
            {generating ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Sparkles className="mr-1.5 size-3.5" />}
            {generating ? '正在命题' : '生成完整题目'}
          </Button>
        </div>
      </section>

      {/* 文体 + 词数（所有写作类型共用） */}
      <section className="flex flex-col gap-3">
        <SectionHeading icon={FilePenLine} step="01" title="文体与规格" description="选择写作类型；不同文体的题目结构不同，切换文体可能会清空已填内容。" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label>文体</Label>
            <Select
              value={value.genre ?? 'paragraph'}
              onChange={(event) => {
                const nextGenre = event.target.value
                // 切换文体时清空不兼容字段
                const reset: Record<string, any> = { genre: nextGenre }
                if (nextGenre === 'translation') {
                  reset.questionMarkdown = undefined
                  reset.candidateRole = undefined
                  reset.audience = undefined
                  reset.purpose = undefined
                  reset.requirements = undefined
                  reset.rubric = undefined
                  reset.turns = undefined
                  reset.situation = undefined
                  reset.direction = 'zh_to_en'
                  reset.scope = 'sentence'
                  reset.sourceTitle = ''
                  reset.sourceText = ''
                  reset.segments = [{ id: 's1', source: '', reference: '', hint: '' }]
                  reset.minWords = 0
                  reset.maxWords = 300
                } else if (nextGenre === 'dialogue') {
                  reset.questionMarkdown = undefined
                  reset.candidateRole = undefined
                  reset.audience = undefined
                  reset.purpose = undefined
                  reset.requirements = undefined
                  reset.rubric = undefined
                  reset.minWords = 40
                  reset.maxWords = 120
                } else if (value.genre === 'dialogue' || value.genre === 'translation') {
                  reset.turns = undefined
                  reset.situation = undefined
                  reset.direction = undefined
                  reset.scope = undefined
                  reset.sourceTitle = undefined
                  reset.sourceText = undefined
                  reset.segments = undefined
                  reset.questionMarkdown = ''
                  reset.minWords = 80
                  reset.maxWords = 180
                }
                onChange({ ...value, ...reset })
              }}
            >
              <option value="translation">🌐 中英互译 — 原文在上，逐句/段填写译文</option>
              <option value="dialogue">🗣️ 对话 — 日常社交对话，A说B填</option>
              <option value="message">💬 消息 — 简短留言、短信、聊天</option>
              <option value="journal">📓 日记 — 第一人称记录与反思</option>
              <option value="email">✉️ 邮件/书信 — 有明确收件人</option>
              <option value="paragraph">📝 段落 — 聚焦一个主题的短段落</option>
              <option value="essay">📄 议论文 — 正式议论型写作</option>
            </Select>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {value.genre === 'translation' && '中英互译，支持单句或篇章；学习者在原文下方填写目标语言译文，AI 会逐段反馈。'}
              {value.genre === 'dialogue' && 'A↔B 对话，学习者填写 B 的台词。像 VN 练习一样，每轮给出中文提示引导回答方向。'}
              {value.genre === 'message' && '简短社交消息，如短信、微信聊天。直接、口语化，通常 30-80 词。'}
              {value.genre === 'journal' && '个人日记或周记，第一人称记录经历、感受和反思。语气自由。'}
              {value.genre === 'email' && '邮件或书信，有明确收件人和沟通目的，注意称呼和结尾礼仪。'}
              {value.genre === 'paragraph' && '围绕一个主题的段落练习，3-5 句话，结构清晰。适合基础写作训练。'}
              {value.genre === 'essay' && '正式议论文，需明确观点、论据支撑和逻辑结构。适合考试准备。'}
            </p>
          </div>
          {isTranslation ? (
            <div className="col-span-2 flex flex-col justify-end rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              翻译题按原文分段作答，不设总词数门槛；篇章题通过完成全部段落后提交。
            </div>
          ) : <>
            <div className="flex flex-col gap-1">
              <Label>最少词数</Label>
              <Input type="number" min={20} value={value.minWords ?? (isDialogue ? 40 : 80)} onChange={(event) => onChange({ ...value, minWords: Number(event.target.value) })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>最多词数</Label>
              <Input type="number" min={20} value={value.maxWords ?? (isDialogue ? 120 : 180)} onChange={(event) => onChange({ ...value, maxWords: Number(event.target.value) })} />
            </div>
          </>}
        </div>
      </section>

      {/* ====== 对话模式专属 UI ====== */}
      {isTranslation ? (
        <TranslationFields value={value} onChange={onChange} />
      ) : isDialogue ? (
        <>
          {/* 对话情境 */}
          <section className="flex flex-col gap-3">
            <SectionHeading icon={UserRound} step="02" title="对话情境" description="交代对话发生的地点、人物关系和话题背景，帮助学习者理解语境。" />
            <div className="flex flex-col gap-1">
              <Label>情境描述</Label>
              <Input
                value={value.situation ?? ''}
                onChange={(event) => onChange({ ...value, situation: event.target.value })}
                placeholder="例如：你和朋友 A 在咖啡店闲聊，A 问你周末有什么安排"
              />
            </div>
          </section>

          {/* 对话轮次 */}
          <section className="flex flex-col gap-3">
            <SectionHeading icon={Target} step="03" title="对话轮次" description="每轮 A 先说一句话，学习者根据中文提示用英语填写 B 的回应。像 VN 练习一样，提示告诉学习者应该说什么。" />
            <div className="flex flex-col gap-3">
              {turns.map((turn, index) => (
                <div key={index} className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="shrink-0 text-[10px]">A 说</Badge>
                      <Input
                        className="h-8 text-sm"
                        value={turn.aText}
                        onChange={(event) => {
                          const next = [...turns]
                          next[index] = { ...next[index], aText: event.target.value }
                          onChange({ ...value, turns: next })
                        }}
                        placeholder="A 的台词（英文）"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0 text-[10px]">B 提示</Badge>
                      <Input
                        className="h-8 text-sm"
                        value={turn.hint}
                        onChange={(event) => {
                          const next = [...turns]
                          next[index] = { ...next[index], hint: event.target.value }
                          onChange({ ...value, turns: next })
                        }}
                        placeholder="中文提示，告诉学习者 B 应该回复什么"
                      />
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="mt-1 size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const next = turns.filter((_, i) => i !== index)
                      onChange({ ...value, turns: next })
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onChange({ ...value, turns: [...turns, { aText: '', hint: '' }] })}
              >
                <Plus className="size-3.5" />添加一轮对话
              </Button>
            </div>
          </section>

          {/* 对话写作要点 */}
          <section className="flex flex-col gap-3">
            <SectionHeading icon={ClipboardCheck} step="04" title="写作要点（选填）" description="提醒学习者在回复时要注意的要点，如语气、关键表达等。每行一项。" />
            <Textarea
              value={requirements.join('\n')}
              onChange={(event) => onChange({ ...value, requirements: lines(event.target.value) })}
              placeholder={'用自然的日常口语，不要太正式\n必要时给出具体信息（时间、地点等）\n适当使用学过的词汇或句型'}
              className="min-h-20"
            />
          </section>
        </>
      ) : (
        <>
          {/* ====== 非对话模式：题目 + 情境 + 要点 + 评分 ====== */}
          {/* 题目 */}
          <section className="flex flex-col gap-3">
            <SectionHeading icon={FilePenLine} step="02" title="题目" description="这是考生真正作答的题目正文；支持 Markdown、表格与图片。" />
            <MarkdownEditor
              label="题目正文"
              value={value.questionMarkdown ?? ''}
              onChange={(questionMarkdown) => onChange({ ...value, questionMarkdown })}
              height={360}
              preview="live"
              placeholder={'## Writing Task\n\n请阅读材料并完成写作。\n\n**要求：**\n\n- 明确表达观点\n- 使用材料中的信息支持回答'}
            />
          </section>

          {/* 写作情境 */}
          <section className="flex flex-col gap-3">
            <SectionHeading icon={UserRound} step="03" title="写作情境" description="一句话说清写作场景：谁在什么情况下写给谁、为了什么。" />
            <Input
              value={value.situation ?? value.purpose ?? ''}
              onChange={(event) => onChange({ ...value, situation: event.target.value })}
              placeholder="例如：你是学生，收到社团活动延期通知，需要给组织者写邮件说明影响并建议新时间"
            />
          </section>

          {/* 写作要点 */}
          <section className="flex flex-col gap-3">
            <SectionHeading icon={Target} step="04" title="写作要点" description="学习者写作时需要覆盖的关键内容。每行一项，应可直接从作文中判断是否完成。" />
            <Textarea
              value={requirements.join('\n')}
              onChange={(event) => onChange({ ...value, requirements: lines(event.target.value) })}
              placeholder={'说明相关背景\n完成明确的沟通动作\n覆盖指定细节\n给出合适的结尾或下一步'}
              className="min-h-24"
            />
          </section>

          {/* 评分标准（仅正式文体显示） */}
          {isFormal && (
            <section className="flex flex-col gap-3">
              <SectionHeading icon={ClipboardCheck} step="05" title="评分标准" description="用于 AI 反馈参考，不展示给考生。" />
              <Textarea
                value={(value.rubric ?? ['任务完成', '结构与衔接', '词汇与表达', '语法准确性', '语域与得体性']).join('\n')}
                onChange={(event) => onChange({ ...value, rubric: lines(event.target.value) })}
                className="min-h-20"
              />
            </section>
          )}
        </>
      )}

      {/* 考生视图预览 */}
      <aside className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2"><Eye className="size-4 text-primary" /><p className="text-sm font-semibold">考生视图</p></div>
          <Badge variant="secondary" className="text-xs">实时预览</Badge>
        </div>
        <div className="bg-[#fffefb] p-3 dark:bg-background">
          <div className="mb-3 px-1">
            <p className="text-xs text-muted-foreground">移动端写作页</p>
            <h3 className="mt-1 text-base font-semibold leading-6">{context?.title || '未命名写作题'}</h3>
          </div>
          {isTranslation ? (
            <TranslationLearnerPreview value={value} />
          ) : isDialogue ? (
            <div className="space-y-3">
              {value.situation && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-2.5 text-sm leading-relaxed dark:border-sky-800 dark:bg-sky-950/30">
                  📍 {value.situation}
                </div>
              )}
              {turns.slice(0, 3).map((turn, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">A</span>
                    <p className="text-sm leading-relaxed">{turn.aText || '(A 的台词)'}</p>
                  </div>
                  <div className="ml-6 flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">B</span>
                    <div className="min-w-[120px] rounded border border-dashed border-muted-foreground/30 bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">{turn.hint || '(提示：学习者根据此提示填写 B 的回复)'}</p>
                    </div>
                  </div>
                </div>
              ))}
              {turns.length > 3 && <p className="text-center text-xs text-muted-foreground">... 还有 {turns.length - 3} 轮对话 ...</p>}
            </div>
          ) : (
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
          )}
        </div>
      </aside>
    </div>
  )
}

type TranslationSegment = { id: string; source: string; reference: string; hint?: string }

function TranslationFields({ value, onChange }: { value: Record<string, any>; onChange: (value: Record<string, any>) => void }) {
  const scope = value.scope === 'article' ? 'article' : 'sentence'
  const direction = value.direction === 'en_to_zh' ? 'en_to_zh' : 'zh_to_en'
  const segments: TranslationSegment[] = Array.isArray(value.segments) && value.segments.length
    ? value.segments
    : [{ id: 's1', source: '', reference: '', hint: '' }]
  const updateSegment = (index: number, patch: Partial<TranslationSegment>) => {
    const next = segments.map((segment, itemIndex) => itemIndex === index ? { ...segment, ...patch } : segment)
    onChange({ ...value, segments: next, sourceText: next.map((segment) => segment.source).filter(Boolean).join('\n\n') })
  }
  const setScope = (nextScope: 'sentence' | 'article') => {
    const nextSegments = nextScope === 'sentence' ? [segments[0] ?? { id: 's1', source: '', reference: '', hint: '' }] : segments
    onChange({ ...value, scope: nextScope, segments: nextSegments, sourceText: nextSegments.map((segment) => segment.source).filter(Boolean).join('\n\n') })
  }
  const sourceLabel = direction === 'zh_to_en' ? '中文原文' : '英文原文'
  const referenceLabel = direction === 'zh_to_en' ? '英文参考译文' : '中文参考译文'

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionHeading icon={Languages} step="02" title="翻译方式" description="学习者阅读上层原文，并在下层横线式输入区写出目标语言译文。参考译文只发送给 AI 评估，不会在作答前显示。" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1"><Label>翻译方向</Label><Select value={direction} onChange={(event) => onChange({ ...value, direction: event.target.value })}><option value="zh_to_en">中文 → 英文</option><option value="en_to_zh">英文 → 中文</option></Select></div>
          <div className="space-y-1"><Label>练习范围</Label><Select value={scope} onChange={(event) => setScope(event.target.value as 'sentence' | 'article')}><option value="sentence">单个句子</option><option value="article">一篇文章（逐段）</option></Select></div>
          <div className="space-y-1"><Label>来源标题（选填）</Label><Input value={value.sourceTitle ?? ''} onChange={(event) => onChange({ ...value, sourceTitle: event.target.value })} placeholder="如：租房沟通" /></div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3"><SectionHeading icon={FilePenLine} step="03" title={scope === 'article' ? '原文与逐段译文' : '原文与参考译文'} description={scope === 'article' ? '每一项在学习端对应一段原文和一条下划线输入区。篇章建议 2–8 段，每段语义完整。' : '单句题只有一项。提示可以给关键词或语法策略，但不要写出完整译文。'} />{scope === 'article' && <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => onChange({ ...value, segments: [...segments, { id: `s${segments.length + 1}`, source: '', reference: '', hint: '' }] })}><Plus className="mr-1 size-3.5" />添加段落</Button>}</div>
        <div className="space-y-3">
          {segments.map((segment, index) => (
            <div key={`${segment.id}-${index}`} className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2"><Badge variant="secondary">{scope === 'article' ? `第 ${index + 1} 段` : '翻译句'}</Badge>{scope === 'article' && <Button type="button" size="icon" variant="ghost" className="ml-auto size-8 text-muted-foreground hover:text-destructive" onClick={() => { const next = segments.filter((_, itemIndex) => itemIndex !== index); const fallback = next.length ? next : [{ id: 's1', source: '', reference: '', hint: '' }]; onChange({ ...value, segments: fallback, sourceText: next.map((item) => item.source).filter(Boolean).join('\n\n') }) }}><Trash2 className="size-3.5" /></Button>}</div>
              <div className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><Label>{sourceLabel}</Label><Textarea value={segment.source} onChange={(event) => updateSegment(index, { source: event.target.value })} className="min-h-24" placeholder={direction === 'zh_to_en' ? '请输入学习者需要翻译的中文原文' : 'Enter the English source text learners need to translate'} /></div><div className="space-y-1.5"><Label>{referenceLabel} <span className="text-muted-foreground">（仅 AI 可见）</span></Label><Textarea value={segment.reference} onChange={(event) => updateSegment(index, { reference: event.target.value })} className="min-h-24" placeholder={direction === 'zh_to_en' ? '输入自然的英文参考译文' : '输入自然的中文参考译文'} /></div></div>
              <div className="mt-3 space-y-1.5"><Label>AI 提示（选填）</Label><Input value={segment.hint ?? ''} onChange={(event) => updateSegment(index, { hint: event.target.value })} placeholder="例如：先找主语和谓语；注意过去完成时，不要直接给出完整译文。" /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TranslationLearnerPreview({ value }: { value: Record<string, any> }) {
  const direction = value.direction === 'en_to_zh' ? '英译中' : '中译英'
  const segments: TranslationSegment[] = Array.isArray(value.segments) ? value.segments : []
  return <div className="space-y-3"><div className="flex items-center justify-between"><Badge variant="secondary">{direction} · {value.scope === 'article' ? '篇章' : '单句'}</Badge>{value.sourceTitle && <span className="text-xs text-muted-foreground">{value.sourceTitle}</span>}</div>{segments.slice(0, 3).map((segment, index) => <div key={`${segment.id}-${index}`} className="rounded-lg bg-muted/35 p-3"><p className="text-sm leading-6 text-foreground">{segment.source || '（原文会显示在这里）'}</p><div className="mt-3 border-b-2 border-dashed border-primary/35 pb-2 text-sm text-muted-foreground">在这里填写译文</div></div>)}{segments.length > 3 && <p className="text-center text-xs text-muted-foreground">… 共 {segments.length} 段 …</p>}</div>
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

type ListeningSource = 'text' | 'audio'

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
  // -- Pipeline state --
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [sourceTab, setSourceTab] = useState<ListeningSource>('text')
  const [articleText, setArticleText] = useState(value.articleText ?? '')
  const [ttsProviders, setTtsProviders] = useState<AiProviderItem[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [ttsVoiceId, setTtsVoiceId] = useState('')
  const [ttsSpeed, setTtsSpeed] = useState(1.0)
  const [forceWhisper, setForceWhisper] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load TTS providers on mount
  useEffect(() => {
    listAiProviders().then((p) => {
      const tts = (p.tts ?? []).filter((item) => ['minimax', 'cartesia'].includes(item.provider))
      setTtsProviders(tts)
      const active = tts.find((item) => item.isActive) ?? tts[0]
      if (active) {
        setSelectedProviderId(active.id)
        const config = active.config ?? {}
        const voices = Array.isArray(config.voiceIds) ? config.voiceIds
          : typeof config.voiceId === 'string' ? [config.voiceId] : []
        if (voices.length > 0) setTtsVoiceId(String(voices[0]))
      }
    }).catch(() => {})
  }, [])

  // Load existing audio URL from mediaAssetId on mount
  useEffect(() => {
    if (mediaAssetId && !audioUrl) {
      getFileAssetPrivateUrl(mediaAssetId).then(({ url }) => setAudioUrl(url)).catch(() => {})
    }
  }, [mediaAssetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProvider = ttsProviders.find((p) => p.id === selectedProviderId)

  const duration = useMemo(() => {
    const t = transcript as any[]
    if (!t?.length) return 0
    return t.reduce((max: number, s: any) => Math.max(max, s.endMs ?? 0), 0)
  }, [transcript])

  const handleGenerateFromText = async () => {
    if (!articleText.trim()) { toast.error('请先粘贴英文文章'); return }
    if (!selectedProvider) { toast.error('请先选择 TTS 供应商'); return }
    setPipelineLoading(true)
    try {
      const params: Record<string, unknown> = { speed: ttsSpeed }
      if (selectedProvider.provider === 'minimax') {
        params.subtitle_enable = true
      }
      const result = await listeningPipelineFromText({
        text: articleText.trim(),
        provider: selectedProvider.provider,
        model: selectedProvider.model,
        voiceId: ttsVoiceId || undefined,
        params,
        forceWhisperTimestamps: forceWhisper,
      })
      setAudioUrl(result.url)
      onChange({
        listening: { ...value, defaultRate: 1, pauseMs: 400, articleText: articleText.trim() },
        mediaAssetId: result.assetId,
        transcript: result.transcript,
      })
      toast.success(`已生成 ${result.transcript.length} 句字幕`)
    } catch (e: any) {
      toast.error(e?.message || '音频生成失败')
    } finally {
      setPipelineLoading(false)
    }
  }

  const handleGenerateFromAudio = async (file: File) => {
    setPipelineLoading(true)
    try {
      const result = await listeningPipelineFromAudio(file, 'en')
      setAudioUrl(result.url)
      onChange({
        listening: { ...value, defaultRate: 1, pauseMs: 400 },
        mediaAssetId: result.assetId,
        transcript: result.transcript,
      })
      toast.success(`已提取 ${result.transcript.length} 句字幕`)
    } catch (e: any) {
      toast.error(e?.message || '时间轴提取失败')
    } finally {
      setPipelineLoading(false)
    }
  }

  const updateSegment = (index: number, patch: Partial<ListeningTranscriptSegment>) => {
    const next = (transcript as any[]).map((seg, i) => i === index ? { ...seg, ...patch } : seg)
    onChange({ listening: value, mediaAssetId, transcript: next })
  }

  const deleteSegment = (index: number) => {
    const next = (transcript as any[]).filter((_, i) => i !== index)
    onChange({ listening: value, mediaAssetId, transcript: next })
  }

  // Merge adjacent segments: combines two rows into one, preserving word timestamps
  const mergeSegments = (index: number) => {
    const arr = transcript as any[]
    if (index < 0 || index >= arr.length - 1) return
    const a = arr[index]
    const b = arr[index + 1]
    const merged = {
      text: (a.text + ' ' + b.text).trim(),
      translation: [a.translation, b.translation].filter(Boolean).join(' | ') || undefined,
      startMs: a.startMs,
      endMs: b.endMs,
      words: [...(a.words ?? []), ...(b.words ?? [])],
      // track original sentences for split
      _parts: [
        { text: a.text, translation: a.translation, startMs: a.startMs, endMs: a.endMs, words: a.words },
        { text: b.text, translation: b.translation, startMs: b.startMs, endMs: b.endMs, words: b.words },
      ],
    }
    const next = [...arr.slice(0, index), merged, ...arr.slice(index + 2)]
    onChange({ listening: value, mediaAssetId, transcript: next })
  }

  // Split a merged segment back into its original parts using word timestamps
  const splitSegment = (index: number) => {
    const arr = transcript as any[]
    const seg = arr[index]
    if (!seg?._parts?.length) return
    const next = [...arr.slice(0, index), ...seg._parts.map((p: any) => ({ ...p })), ...arr.slice(index + 1)]
    onChange({ listening: value, mediaAssetId, transcript: next })
  }

  // Split a segment at sentence-ending punctuation using word timestamps
  const splitAtPunctuation = (index: number) => {
    const arr = transcript as any[]
    const seg = arr[index]
    const words: any[] = seg.words ?? []
    if (words.length < 2) return

    const SENTENCE_END = /[.!?。！？]$/
    let splitIdx = -1
    for (let i = 0; i < words.length - 1; i++) {
      if (SENTENCE_END.test((words[i].token ?? '').trim())) {
        splitIdx = i
        break
      }
    }
    if (splitIdx < 0) return // no split point found

    const part1Words = words.slice(0, splitIdx + 1)
    const part2Words = words.slice(splitIdx + 1)
    const joinText = (ws: any[]) => {
      let result = ws[0]?.token ?? ''
      for (let i = 1; i < ws.length; i++) {
        const prev = ws[i - 1].token
        const curr = ws[i].token
        if (/^[.,!?;:)\]}'"]$/.test(curr) || /[(\["']$/.test(prev)) {
          result += curr
        } else {
          result += ' ' + curr
        }
      }
      return result.trim()
    }

    const part1 = {
      text: joinText(part1Words),
      startMs: part1Words[0]?.startMs ?? seg.startMs,
      endMs: part1Words[part1Words.length - 1]?.endMs ?? seg.endMs,
      words: part1Words,
    }
    const part2 = {
      text: joinText(part2Words),
      startMs: part2Words[0]?.startMs ?? seg.startMs,
      endMs: part2Words[part2Words.length - 1]?.endMs ?? seg.endMs,
      words: part2Words,
    }

    const next = [...arr.slice(0, index), part1, part2, ...arr.slice(index + 1)]
    onChange({ listening: value, mediaAssetId, transcript: next })
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => {})
    }
  }

  const seekTo = (startMs: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = startMs / 1000
    audioRef.current.play().catch(() => {})
  }

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${min}:${String(sec).padStart(2, '0')}.${tenths}`
  }

  const hasTranscript = (transcript as any[])?.length > 0

  return (
    <div className="space-y-5">
      {/* Source Selection */}
      <div className="rounded-xl border border-border/70 bg-sky-500/[0.04] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Headphones className="size-4 text-sky-600" />
          <p className="text-sm font-semibold">音频源</p>
        </div>

        <Tabs value={sourceTab} onValueChange={(v) => setSourceTab(v as ListeningSource)}>
          <TabsList className="mb-4">
            <TabsTrigger value="text" className="gap-1.5">
              <FilePenLine className="size-3.5" />
              文本生成
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-1.5">
              <FileAudio className="size-3.5" />
              上传音频
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <div>
              <Label>英文文章</Label>
              <Textarea
                value={articleText}
                onChange={(e) => setArticleText(e.target.value)}
                placeholder="Paste an English article here, e.g.: The sun was setting behind the mountains..."
                className="min-h-[180px] font-mono text-sm"
                disabled={pipelineLoading}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>TTS 供应商</Label>
                <Select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  disabled={pipelineLoading}
                >
                  {ttsProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.provider === 'minimax' ? 'MiniMax' : p.provider === 'cartesia' ? 'Cartesia' : p.provider}
                      {p.isActive ? ' (active)' : ''} - {p.model}
                    </option>
                  ))}
                  {ttsProviders.length === 0 && <option value="">请先在 AI Models 配置 TTS</option>}
                </Select>
              </div>

              <div>
                <Label>Voice ID</Label>
                <Input
                  value={ttsVoiceId}
                  onChange={(e) => setTtsVoiceId(e.target.value)}
                  placeholder={selectedProvider?.provider === 'minimax' ? 'English_expressive_narrator' : 'Voice ID'}
                  disabled={pipelineLoading}
                />
              </div>

              <div>
                <Label>语速</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={ttsSpeed}
                  onChange={(e) => setTtsSpeed(Number(e.target.value))}
                  disabled={pipelineLoading}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="force-whisper"
                checked={forceWhisper}
                onCheckedChange={setForceWhisper}
                disabled={pipelineLoading}
              />
              <Label htmlFor="force-whisper" className="cursor-pointer text-sm text-muted-foreground">
                强制使用 Whisper 提取词时间戳
              </Label>
            </div>

            <Button
              onClick={handleGenerateFromText}
              disabled={pipelineLoading || !articleText.trim() || !selectedProvider}
              className="gap-2"
            >
              {pipelineLoading ? (
                <><Loader2 className="size-4 animate-spin" /> 生成中...</>
              ) : (
                <><Music className="size-4" /> 生成音频与时间轴</>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="audio" className="space-y-4">
            <div className="rounded-lg border border-dashed border-border/70 p-6 text-center">
              <FileAudio className="mx-auto mb-2 size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                上传 MP3 / WAV / M4A 音频文件，系统通过 Whisper 自动提取逐句时间轴
              </p>
            </div>

            <input
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.ogg"
              id="listening-audio-upload"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 50 * 1024 * 1024) {
                  toast.error('文件不能超过 50MB')
                  return
                }
                await handleGenerateFromAudio(file)
                e.target.value = ''
              }}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={pipelineLoading}
              onClick={() => document.getElementById('listening-audio-upload')?.click()}
            >
              {pipelineLoading ? (
                <><Loader2 className="size-4 animate-spin" /> 提取中...</>
              ) : (
                <><Upload className="size-4" /> 上传音频并提取时间轴</>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Playback Settings */}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>默认语速</Label>
          <Input
            type="number"
            min={0.5}
            max={2}
            step={0.1}
            value={value.defaultRate ?? 1}
            onChange={(e) => onChange({ listening: { ...value, defaultRate: Number(e.target.value) }, mediaAssetId, transcript })}
          />
        </div>
        <div>
          <Label>句间停顿（ms）</Label>
          <Input
            type="number"
            min={0}
            value={value.pauseMs ?? 400}
            onChange={(e) => onChange({ listening: { ...value, pauseMs: Number(e.target.value) }, mediaAssetId, transcript })}
          />
        </div>
        <div className="rounded-lg border border-border/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">时间轴</p>
          <p className="mt-1 text-sm font-semibold">
            {(transcript as any[])?.length ?? 0} 句 · {(duration / 1000).toFixed(1)} 秒
          </p>
        </div>
      </div>

      {/* Audio Player */}
      {audioUrl && (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="outline"
              className="size-10 shrink-0 rounded-full"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <div className="min-w-0 flex-1">
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={() => {
                  if (audioRef.current) setCurrentTime(audioRef.current.currentTime * 1000)
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-100"
                  style={{ width: duration > 0 ? `${Math.min(100, (currentTime / duration) * 100)}%` : '0%' }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0">
              <Clock className="mr-1 size-3" />
              {(duration / 1000).toFixed(1)}s
            </Badge>
          </div>
        </div>
      )}

      {/* Sentence List (Drag to merge) */}
      {hasTranscript && (
        <div className="rounded-xl border border-border/70">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <GripVertical className="size-4 text-muted-foreground" />
              <p className="text-sm font-semibold">句子列表</p>
              <Badge variant="secondary" className="text-xs">
                {(transcript as any[]).length} 句
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              拖拽到另一行合并 · 点击跳转播放
            </p>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {(transcript as any[]).map((seg: any, index: number) => {
              const isCurrent = currentTime >= seg.startMs && currentTime < seg.endMs
              const isMerged = !!seg._parts?.length
              const totalDur = seg.endMs - seg.startMs
              const parts = seg._parts as any[] | undefined
              const isLast = index === (transcript as any[]).length - 1
              const hasMultiSentence = !isMerged && (seg.words?.length ?? 0) > 1 &&
                /[.!?。！？]/.test((seg.words ?? []).map((w: any) => w.token).join(''))

              return (
              <div
                key={index}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(index))
                  e.dataTransfer.effectAllowed = 'move'
                  ;(e.currentTarget as HTMLElement).classList.add('opacity-40')
                }}
                onDragEnd={(e) => {
                  (e.currentTarget as HTMLElement).classList.remove('opacity-40')
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  ;(e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-emerald-400')
                }}
                onDragLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-emerald-400')
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  ;(e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-emerald-400')
                  const fromIdx = parseInt(e.dataTransfer.getData('text/plain'))
                  if (Number.isFinite(fromIdx) && fromIdx !== index && fromIdx >= 0 && fromIdx < (transcript as any[]).length) {
                    // Merge: put source at target's position, preserving order
                    const targetIdx = fromIdx < index ? index - 1 : index
                    mergeSegments(Math.min(fromIdx, targetIdx))
                  }
                }}
                onClick={(e) => {
                  // Don't seek if clicking on inputs/buttons
                  const target = e.target as HTMLElement
                  if (target.closest('input,button')) return
                  seekTo(seg.startMs)
                }}
                className={cn(
                  'group flex cursor-pointer items-start gap-3 border-b border-border/50 px-4 py-3 transition-all select-none',
                  'hover:bg-muted/30',
                  isCurrent && 'bg-sky-500/[0.08] ring-1 ring-inset ring-sky-500/20',
                  isMerged && 'border-l-2 border-l-amber-400/60',
                )}
              >
                {/* Row number + timestamp */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={cn(
                    'grid size-5 place-items-center rounded text-[10px] font-semibold transition-colors',
                    isCurrent ? 'bg-sky-500 text-white'
                    : isMerged ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-muted text-muted-foreground group-hover:bg-sky-500/20 group-hover:text-sky-600',
                  )}>
                    {isMerged ? `${index + 1}-${index + (parts?.length ?? 2)}` : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={cn(
                    'text-xs font-mono tabular-nums',
                    isCurrent ? 'text-sky-600' : 'text-muted-foreground',
                  )}>
                    {formatTime(seg.startMs)}
                  </span>
                  <Volume2 className={cn(
                    'size-3 opacity-0 transition-opacity group-hover:opacity-100',
                    isCurrent ? 'text-sky-500 opacity-100' : 'text-muted-foreground',
                  )} />
                </div>

                {/* Text + translation + proportional bar */}
                <div className="min-w-0 flex-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={seg.text}
                    onChange={(e) => updateSegment(index, { text: e.target.value })}
                    className={cn(
                      'h-auto border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0',
                      isMerged && 'text-amber-800 dark:text-amber-200',
                    )}
                    placeholder="句子文本"
                  />
                  <Input
                    value={seg.translation ?? ''}
                    onChange={(e) => updateSegment(index, { translation: e.target.value || undefined })}
                    className="h-auto border-0 bg-transparent p-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
                    placeholder="翻译（可选）"
                  />
                  {/* Proportional time bar for merged segments */}
                  {isMerged && parts && totalDur > 0 && (
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      {parts.map((part: any, pi: number) => {
                        const partDur = part.endMs - part.startMs
                        const pct = Math.max(1, Math.round((partDur / totalDur) * 100))
                        return (
                          <div
                            key={pi}
                            className="h-full first:rounded-l-full last:rounded-r-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pi === 0 ? '#f59e0b' : '#fbbf24',
                            }}
                            title={`${part.text} (${formatTime(part.startMs)}–${formatTime(part.endMs)})`}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col items-end text-[10px] font-mono tabular-nums text-muted-foreground/60">
                    <span>{seg.startMs}ms</span>
                    <span>{seg.endMs}ms</span>
                  </div>

                  {/* Split merged */}
                  {isMerged && (
                    <Button size="icon" variant="ghost" className="size-7 text-amber-600 hover:text-amber-700"
                      title="拆分回原句" onClick={() => splitSegment(index)}>
                      <Split className="size-3.5" />
                    </Button>
                  )}

                  {/* Split at punctuation in words */}
                  {hasMultiSentence && (
                    <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-sky-600"
                      title="在标点处拆分" onClick={() => splitAtPunctuation(index)}>
                      <Split className="size-3.5" />
                    </Button>
                  )}

                  <Button size="icon" variant="ghost"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteSegment(index)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {!hasTranscript && !pipelineLoading && (
        <div className="rounded-xl border border-dashed border-border/70 py-12 text-center">
          <Headphones className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">尚未生成字幕时间轴</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            粘贴英文文章生成音频，或上传已有音频文件，系统将自动提取逐句时间轴
          </p>
        </div>
      )}
    </div>
  )
}
