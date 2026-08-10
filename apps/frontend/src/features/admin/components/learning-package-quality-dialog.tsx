import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  CopyCheck,
  Loader2,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Target,
  WandSparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import {
  listTrainingTopics,
  updateTrainingTopic,
  type Scene,
  type TrainingTopic,
} from '../api-content-admin'
import {
  buildWarmupMaterialUsage,
  type WarmupPipelineData,
  type WarmupPipelineItem,
} from './warmup-pipeline-tab'

type Severity = 'critical' | 'warning' | 'notice'
type MaterialKind = 'vocab' | 'chunk' | 'pattern'

interface MaterialItem {
  id: string
  text: string
  meaning?: string
  kind: MaterialKind
  examples: Array<{ en: string; zh: string }>
}

interface ExerciseRow {
  topicId: string
  topicTitle: string
  groupId: string
  groupTitle: string
  type: WarmupPipelineItem['type']
  direction: string
  prompt: string
  answer: string
}

interface AuditIssue {
  id: string
  topicId?: string
  topicIds?: string[]
  topicTitle?: string
  severity: Severity
  category: 'coverage' | 'allocation' | 'design' | 'homogeneity'
  title: string
  detail: string
  recommendation: string
  autoFixable: boolean
}

interface TopicAudit {
  topic: TrainingTopic
  materials: MaterialItem[]
  pipeline: WarmupPipelineItem[]
  exercises: ExerciseRow[]
  usage: ReturnType<typeof buildWarmupMaterialUsage>
  score: number
  issues: AuditIssue[]
}

interface TopicProposal {
  topicId: string
  topicTitle: string
  before: WarmupPipelineItem[]
  after: WarmupPipelineItem[]
  addedGroups: WarmupPipelineItem[]
  removedExercises: number
  reasons: string[]
}

interface AuditReport {
  topics: TopicAudit[]
  issues: AuditIssue[]
  proposals: TopicProposal[]
  score: number
  totals: {
    topics: number
    vocabs: number
    chunks: number
    patterns: number
    groups: number
    exercises: number
    uncovered: number
    duplicatePairs: number
  }
}

interface Props {
  open: boolean
  scene: Scene
  onOpenChange: (open: boolean) => void
  onApplied?: () => void
}

const TYPE_LABEL: Record<WarmupPipelineItem['type'], string> = {
  chunk_substitution: '句块替换',
  vocab_sentence_building: '一词多句',
  sentence_decomposition: '句子拆解',
  pattern_drill: '句型操练',
}

const CATEGORY_LABEL: Record<AuditIssue['category'], string> = {
  coverage: '覆盖度',
  allocation: '知识点分配',
  design: '题目设计',
  homogeneity: '同质化',
}

function parseExamples(input: unknown): Array<{ en: string; zh: string }> {
  let value = input
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return [] }
  }
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      en: String(item?.en ?? item?.example ?? '').trim(),
      zh: String(item?.zh ?? item?.translation ?? '').trim(),
    }))
    .filter((item) => item.en && item.zh)
}

function topicMaterials(topic: TrainingTopic): MaterialItem[] {
  const vocabs = (topic.topicVocabs ?? []).map((item: any) => ({
    id: item.vocab.id,
    text: item.vocab.word,
    meaning: item.vocab.meaning,
    kind: 'vocab' as const,
    examples: parseExamples(item.vocab.examples),
  }))
  const chunks = (topic.activeChunks ?? []).map((item: any) => ({
    id: item.chunk.id,
    text: item.chunk.text,
    meaning: item.chunk.meaning,
    kind: 'chunk' as const,
    examples: parseExamples(item.chunk.examples),
  }))
  const patterns = (topic.topicPatterns ?? []).map((item: any) => ({
    id: item.pattern.id,
    text: item.pattern.pattern,
    meaning: item.pattern.meaning,
    kind: 'pattern' as const,
    examples: parseExamples(item.pattern.examples),
  }))
  return [...vocabs, ...chunks, ...patterns]
}

function countGroupItems(item: WarmupPipelineItem) {
  if (item.type === 'sentence_decomposition') return item.levels.length
  if (item.type === 'vocab_sentence_building') {
    return item.patterns.reduce((total, pattern) => total + pattern.items.length, 0)
  }
  return item.items.length
}

function flattenExercises(topic: TrainingTopic, pipeline: WarmupPipelineItem[]): ExerciseRow[] {
  const rows: ExerciseRow[] = []
  const push = (group: WarmupPipelineItem, prompt: string, answer: string) => {
    if (!prompt.trim() && !answer.trim()) return
    rows.push({
      topicId: topic.id,
      topicTitle: topic.title,
      groupId: group.id,
      groupTitle: group.title || TYPE_LABEL[group.type],
      type: group.type,
      direction: 'direction' in group ? group.direction ?? 'zh_to_en' : 'progressive',
      prompt: prompt.trim(),
      answer: answer.trim(),
    })
  }
  pipeline.forEach((group) => {
    if (group.type === 'sentence_decomposition') {
      group.levels.forEach((item) => push(group, item.zh ?? '', item.en ?? ''))
      return
    }
    if (group.type === 'vocab_sentence_building') {
      group.patterns.forEach((pattern) => pattern.items.forEach((item) => {
        push(group, group.direction === 'en_to_zh' ? item.en ?? item.answer : item.zh ?? '', group.direction === 'en_to_zh' ? item.answer : item.answer)
      }))
      return
    }
    group.items.forEach((item) => {
      push(group, group.direction === 'en_to_zh' ? item.en ?? item.answer : item.zh ?? '', group.direction === 'en_to_zh' ? item.answer : item.answer)
    })
  })
  return rows
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9\u4e00-\u9fa5\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function exerciseSignature(row: Pick<ExerciseRow, 'prompt' | 'answer'>) {
  return `${normalizeText(row.prompt)}=>${normalizeText(row.answer)}`
}

function tokenSimilarity(left: ExerciseRow, right: ExerciseRow) {
  const a = new Set(normalizeText(`${left.prompt} ${left.answer}`).split(' ').filter((token) => token.length > 1))
  const b = new Set(normalizeText(`${right.prompt} ${right.answer}`).split(' ').filter((token) => token.length > 1))
  if (!a.size || !b.size) return 0
  const shared = [...a].filter((token) => b.has(token)).length
  return shared / Math.max(a.size, b.size)
}

function dedupePipeline(pipeline: WarmupPipelineItem[]) {
  const signatures = new Set<string>()
  let removed = 0
  const keep = <T extends { zh?: string; en?: string; answer: string }>(items: T[], direction?: string) => {
    return items.filter((item) => {
      const prompt = direction === 'en_to_zh' ? item.en ?? item.answer : item.zh ?? ''
      const signature = `${normalizeText(prompt)}=>${normalizeText(item.answer)}`
      if (!signature || signature === '=>') return true
      if (signatures.has(signature)) {
        removed += 1
        return false
      }
      signatures.add(signature)
      return true
    })
  }

  const next = pipeline.map((group) => {
    if (group.type === 'sentence_decomposition') return group
    if (group.type === 'vocab_sentence_building') {
      return {
        ...group,
        patterns: group.patterns
          .map((pattern) => ({ ...pattern, items: keep(pattern.items, group.direction) }))
          .filter((pattern) => pattern.items.length > 0),
      }
    }
    return { ...group, items: keep(group.items, group.direction) }
  }).filter((group) => countGroupItems(group) > 0)

  return { pipeline: next, removed }
}

function buildCoverageGroups(topic: TrainingTopic, materials: MaterialItem[], usage: ReturnType<typeof buildWarmupMaterialUsage>) {
  const uncovered = new Set([
    ...usage.totals.vocabs.filter((item) => item.count === 0).map((item) => item.id),
    ...usage.totals.chunks.filter((item) => item.count === 0).map((item) => item.id),
    ...usage.totals.patterns.filter((item) => item.count === 0).map((item) => item.id),
  ])

  return materials.flatMap((material): WarmupPipelineItem[] => {
    if (!uncovered.has(material.id) || !material.examples.length) return []
    const items = material.examples.slice(0, 2).map((example) => ({
      zh: example.zh,
      answer: example.en,
      hint: `使用 ${material.text} 完成表达。`,
    }))
    const id = `audit_${topic.id}_${material.kind}_${material.id}`
    if (material.kind === 'pattern') {
      return [{
        id,
        type: 'pattern_drill',
        title: `${material.text} · 覆盖补练`,
        pattern: material.text,
        patternMeaning: material.meaning,
        direction: 'zh_to_en',
        items,
      }]
    }
    return [{
      id,
      type: 'chunk_substitution',
      title: `${material.text} · 覆盖补练`,
      chunk: material.text,
      chunkMeaning: material.meaning,
      direction: 'zh_to_en',
      kind: material.kind === 'vocab' ? 'word' : 'chunk',
      items,
    }]
  })
}

function severityPenalty(severity: Severity) {
  if (severity === 'critical') return 18
  if (severity === 'warning') return 9
  return 4
}

function auditTopics(topics: TrainingTopic[]): AuditReport {
  const topicAudits: TopicAudit[] = []
  const proposals: TopicProposal[] = []
  const globalRows: ExerciseRow[] = []

  topics.forEach((topic) => {
    const materials = topicMaterials(topic)
    const warmup = (topic.metadata?.outputTraining ?? { version: 1, enabled: true, pipeline: [] }) as WarmupPipelineData
    const pipeline = Array.isArray(warmup.pipeline) ? warmup.pipeline : []
    const vocabs = materials.filter((item) => item.kind === 'vocab').map((item) => ({ id: item.id, word: item.text, meaning: item.meaning }))
    const chunks = materials.filter((item) => item.kind === 'chunk').map((item) => ({ id: item.id, text: item.text, meaning: item.meaning ?? '' }))
    const patterns = materials.filter((item) => item.kind === 'pattern').map((item) => ({ id: item.id, pattern: item.text, meaning: item.meaning }))
    const usage = buildWarmupMaterialUsage(warmup, vocabs, chunks, patterns)
    const exercises = flattenExercises(topic, pipeline)
    const issues: AuditIssue[] = []
    const addIssue = (issue: Omit<AuditIssue, 'id' | 'topicId' | 'topicTitle'>) => issues.push({
      ...issue,
      id: `${topic.id}_${issue.category}_${issues.length}`,
      topicId: topic.id,
      topicTitle: topic.title,
    })

    if (!materials.length) addIssue({
      severity: 'critical', category: 'allocation', title: '话题没有分配知识点',
      detail: '当前话题没有句型、句块或单词，无法建立明确学习目标。',
      recommendation: '先在话题编辑器中补充与场景直接相关的核心知识点，再生成练习。', autoFixable: false,
    })
    if (materials.length > 18) addIssue({
      severity: 'warning', category: 'allocation', title: '单话题知识点密度偏高',
      detail: `当前共 ${materials.length} 个知识点，可能造成一次练习负担过重。`,
      recommendation: '优先保留核心表达，其余拆分到后续话题或标为复习材料。', autoFixable: false,
    })
    if (!exercises.length) addIssue({
      severity: 'critical', category: 'design', title: '没有知识点练习',
      detail: '已分配的知识点没有任何可执行题目。',
      recommendation: '根据知识点标准例句补齐中译英、句型操练与综合输出。', autoFixable: materials.some((item) => item.examples.length > 0),
    })

    const uncoveredMaterials = [
      ...usage.totals.vocabs.filter((item) => item.count === 0).map((item) => item.word),
      ...usage.totals.chunks.filter((item) => item.count === 0).map((item) => item.text),
      ...usage.totals.patterns.filter((item) => item.count === 0).map((item) => item.pattern),
    ]
    const uncoveredCount = uncoveredMaterials.length
    if (uncoveredCount > 0) addIssue({
      severity: uncoveredCount === materials.length ? 'critical' : 'warning',
      category: 'coverage', title: `${uncoveredCount} 个知识点没有被题目覆盖`,
      detail: `未覆盖：${uncoveredMaterials.join('、')}。这些知识点虽然分配给了话题，但没有作为题目目标或出现在有效答案中。`,
      recommendation: '有标准例句的知识点可直接补练；缺少例句的知识点应先完善素材或移出话题。',
      autoFixable: materials.some((item) => uncoveredCount > 0 && item.examples.length > 0),
    })

    const types = new Set(pipeline.map((item) => item.type))
    if (exercises.length >= 6 && types.size < 2) addIssue({
      severity: 'warning', category: 'design', title: '题型结构单一',
      detail: `${exercises.length} 道题只使用了 ${[...types].map((type) => TYPE_LABEL[type]).join('、') || '一种题型'}。`,
      recommendation: '加入句型操练或一词多句，让学习者经历识别、替换和自主输出。', autoFixable: false,
    })

    const exactCounts = new Map<string, number>()
    exercises.forEach((row) => exactCounts.set(exerciseSignature(row), (exactCounts.get(exerciseSignature(row)) ?? 0) + 1))
    const exactDuplicates = [...exactCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0)
    if (exactDuplicates > 0) addIssue({
      severity: 'warning', category: 'homogeneity', title: `话题内有 ${exactDuplicates} 道重复题`,
      detail: '题干和答案完全一致，重复作答不会增加新的迁移或输出要求。',
      recommendation: '保留首次出现的题目，删除后续完全重复项。', autoFixable: true,
    })

    const compacted = dedupePipeline(pipeline)
    const coverageGroups = buildCoverageGroups(topic, materials, usage)
    const combined = dedupePipeline([...compacted.pipeline, ...coverageGroups])
    const after = combined.pipeline
    const addedGroups = coverageGroups.filter((group) => after.some((item) => item.id === group.id))
    const removedExercises = compacted.removed + combined.removed
    const reasons = [
      ...(removedExercises ? [`删除 ${removedExercises} 道完全重复题`] : []),
      ...(addedGroups.length ? [`补充 ${addedGroups.length} 个知识点覆盖题组`] : []),
    ]
    if (reasons.length) proposals.push({
      topicId: topic.id,
      topicTitle: topic.title,
      before: pipeline,
      after,
      addedGroups,
      removedExercises,
      reasons,
    })

    const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + severityPenalty(issue.severity), 0))
    topicAudits.push({ topic, materials, pipeline, exercises, usage, score, issues })
    globalRows.push(...exercises)
  })

  let duplicatePairs = 0
  const globalIssues: AuditIssue[] = []
  const materialOwners = new Map<string, { material: MaterialItem; topics: Array<{ id: string; title: string }> }>()
  topicAudits.forEach((topic) => topic.materials.forEach((material) => {
    const key = `${material.kind}:${material.id}`
    const existing = materialOwners.get(key)
    if (existing) existing.topics.push({ id: topic.topic.id, title: topic.topic.title })
    else materialOwners.set(key, { material, topics: [{ id: topic.topic.id, title: topic.topic.title }] })
  }))
  materialOwners.forEach(({ material, topics: ownerTopics }, key) => {
    if (ownerTopics.length < 2) return
    const label = material.kind === 'vocab' ? '单词' : material.kind === 'chunk' ? '句块' : '句型'
    globalIssues.push({
      id: `shared_${key}`,
      severity: 'notice',
      category: 'allocation',
      title: `${label}“${material.text}”被多个话题使用`,
      detail: `出现于：${ownerTopics.map((topic) => topic.title).join('、')}。`,
      recommendation: '确认首次出现的话题负责新学，后续话题通过不同场景和更高输出要求承担复习或迁移。',
      autoFixable: false,
      topicIds: ownerTopics.map((topic) => topic.id),
    })
  })
  for (let leftIndex = 0; leftIndex < globalRows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < globalRows.length; rightIndex += 1) {
      const left = globalRows[leftIndex]
      const right = globalRows[rightIndex]
      if (left.topicId === right.topicId || left.type !== right.type) continue
      const exact = exerciseSignature(left) === exerciseSignature(right)
      const similar = !exact && tokenSimilarity(left, right) >= 0.88
      if (!exact && !similar) continue
      duplicatePairs += 1
      globalIssues.push({
        id: `cross_${leftIndex}_${rightIndex}`,
        severity: exact ? 'warning' : 'notice',
        category: 'homogeneity',
        title: exact ? '跨话题出现完全相同题目' : '跨话题题目高度相似',
        detail: `“${left.topicTitle}”与“${right.topicTitle}”都使用了「${left.prompt} → ${left.answer}」。`,
        recommendation: '如果这是复习题，应更换场景或增加新的表达要求；否则保留更匹配的话题版本。',
        autoFixable: false,
        topicIds: [left.topicId, right.topicId],
      })
    }
  }

  const allIssues = [...topicAudits.flatMap((topic) => topic.issues), ...globalIssues]
  const unique = (kind: MaterialKind) => new Set(topicAudits.flatMap((topic) => topic.materials.filter((item) => item.kind === kind).map((item) => item.id))).size
  const uncovered = topicAudits.reduce((sum, topic) => sum
    + topic.usage.totals.vocabs.filter((item) => item.count === 0).length
    + topic.usage.totals.chunks.filter((item) => item.count === 0).length
    + topic.usage.totals.patterns.filter((item) => item.count === 0).length, 0)
  const score = topicAudits.length
    ? Math.round(topicAudits.reduce((sum, topic) => sum + topic.score, 0) / topicAudits.length - Math.min(15, globalIssues.length * 2))
    : 0

  return {
    topics: topicAudits,
    issues: allIssues,
    proposals,
    score: Math.max(0, score),
    totals: {
      topics: topicAudits.length,
      vocabs: unique('vocab'),
      chunks: unique('chunk'),
      patterns: unique('pattern'),
      groups: topicAudits.reduce((sum, topic) => sum + topic.pipeline.length, 0),
      exercises: globalRows.length,
      uncovered,
      duplicatePairs,
    },
  }
}

function severityBadge(severity: Severity) {
  if (severity === 'critical') return <Badge variant="destructive">严重</Badge>
  if (severity === 'warning') return <Badge variant="secondary">建议修改</Badge>
  return <Badge variant="outline">注意</Badge>
}

function scoreLabel(score: number) {
  if (score >= 85) return '结构健康'
  if (score >= 70) return '可用，建议优化'
  if (score >= 50) return '需要重点调整'
  return '暂不建议发布'
}

function exerciseCount(pipeline: WarmupPipelineItem[]) {
  return pipeline.reduce((sum, item) => sum + countGroupItems(item), 0)
}

export function LearningPackageQualityDialog({ open, scene, onOpenChange, onApplied }: Props) {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set())
  const report = useMemo(() => auditTopics(topics), [topics])
  const selectedTopic = report.topics.find((topic) => topic.topic.id === selectedTopicId) ?? null
  const scopedTopics = selectedTopic ? [selectedTopic] : report.topics
  const scopedIssues = selectedTopic
    ? report.issues.filter((issue) => issue.topicId === selectedTopic.topic.id || issue.topicIds?.includes(selectedTopic.topic.id))
    : report.issues
  const scopedProposals = selectedTopic
    ? report.proposals.filter((proposal) => proposal.topicId === selectedTopic.topic.id)
    : report.proposals
  const scopedTotals = selectedTopic ? {
    topics: 1,
    vocabs: selectedTopic.materials.filter((item) => item.kind === 'vocab').length,
    chunks: selectedTopic.materials.filter((item) => item.kind === 'chunk').length,
    patterns: selectedTopic.materials.filter((item) => item.kind === 'pattern').length,
    groups: selectedTopic.pipeline.length,
    exercises: selectedTopic.exercises.length,
    uncovered: selectedTopic.usage.totals.vocabs.filter((item) => item.count === 0).length
      + selectedTopic.usage.totals.chunks.filter((item) => item.count === 0).length
      + selectedTopic.usage.totals.patterns.filter((item) => item.count === 0).length,
    duplicatePairs: scopedIssues.filter((issue) => issue.category === 'homogeneity').length,
  } : report.totals
  const scopedScore = selectedTopic?.score ?? report.score

  const runAudit = async () => {
    setLoading(true)
    try {
      const items = await listTrainingTopics(scene.id, { detail: 'full' })
      setTopics(items)
      setSelectedTopicId((current) => current && items.some((topic) => topic.id === current) ? current : null)
    } catch (error: any) {
      toast.error(error?.message || '学习包质检失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void runAudit()
  }, [open, scene.id])

  useEffect(() => {
    setSelectedProposals(new Set(report.proposals.map((proposal) => proposal.topicId)))
  }, [report.proposals.map((proposal) => `${proposal.topicId}:${proposal.after.length}:${proposal.removedExercises}`).join('|')])

  const toggleProposal = (topicId: string, checked: boolean) => {
    setSelectedProposals((current) => {
      const next = new Set(current)
      if (checked) next.add(topicId)
      else next.delete(topicId)
      return next
    })
  }

  const applySelected = async () => {
    const selected = report.proposals.filter((proposal) => selectedProposals.has(proposal.topicId))
    if (!selected.length) {
      toast.error('请至少选择一项可执行修改')
      return
    }
    setApplying(true)
    try {
      for (const proposal of selected) {
        const topic = topics.find((item) => item.id === proposal.topicId)
        if (!topic) continue
        const materials = topicMaterials(topic)
        const nextWarmup: WarmupPipelineData = {
          ...(topic.metadata?.outputTraining ?? { version: 1, enabled: true }),
          pipeline: proposal.after,
        }
        const materialUsage = buildWarmupMaterialUsage(
          nextWarmup,
          materials.filter((item) => item.kind === 'vocab').map((item) => ({ id: item.id, word: item.text, meaning: item.meaning })),
          materials.filter((item) => item.kind === 'chunk').map((item) => ({ id: item.id, text: item.text, meaning: item.meaning ?? '' })),
          materials.filter((item) => item.kind === 'pattern').map((item) => ({ id: item.id, pattern: item.text, meaning: item.meaning })),
        )
        await updateTrainingTopic(topic.id, {
          metadata: {
            ...(topic.metadata ?? {}),
            outputTraining: { ...nextWarmup, materialUsage },
          },
        })
      }
      toast.success(`已应用 ${selected.length} 个话题的质检修改`)
      await runAudit()
      onApplied?.()
    } catch (error: any) {
      toast.error(error?.message || '应用修改失败，已完成的修改会保留')
    } finally {
      setApplying(false)
    }
  }

  const criticalCount = scopedIssues.filter((issue) => issue.severity === 'critical').length
  const warningCount = scopedIssues.filter((issue) => issue.severity === 'warning').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] w-[calc(100vw-32px)] max-w-[1440px] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>学习包质量审查</DialogTitle>
          <DialogDescription>统计知识点与题目，检查覆盖度、合理性和同质化，并确认可执行修改。</DialogDescription>
        </DialogHeader>

        {loading && !topics.length ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-7 animate-spin text-primary" />
              正在盘点全部话题、知识点与练习题…
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-r bg-muted/20">
              <div className="border-b px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardCheck className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">学习包质量审查</h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{scene.title}</p>
                  </div>
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-5 p-5">
                  <div className="rounded-xl border bg-background p-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">综合质量评分</p>
                        <p className="mt-1 text-4xl font-semibold tracking-tight">{scopedScore}<span className="text-base text-muted-foreground">/100</span></p>
                      </div>
                      <Badge variant={scopedScore >= 70 ? 'secondary' : 'destructive'}>{scoreLabel(scopedScore)}</Badge>
                    </div>
                    <Progress value={scopedScore} className="mt-4" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['话题', scopedTotals.topics],
                      ['练习题', scopedTotals.exercises],
                      ['未覆盖', scopedTotals.uncovered],
                      ['同质化问题', scopedTotals.duplicatePairs],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border bg-background px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground">{label}</p>
                        <p className="mt-0.5 text-xl font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">话题质量</p>
                      <span className="text-[11px] text-muted-foreground">点击查看</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                          selectedTopicId === null ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                        )}
                        onClick={() => setSelectedTopicId(null)}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background/15"><BarChart3 className="size-3.5" /></span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">全部话题</span>
                        <span className="text-xs tabular-nums opacity-80">{report.score}</span>
                      </button>
                      {report.topics.map((item, index) => (
                        <button
                          key={item.topic.id}
                          type="button"
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                            selectedTopicId === item.topic.id ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                          )}
                          onClick={() => setSelectedTopicId(item.topic.id)}
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background/15 text-xs font-semibold">{index + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.topic.title}</span>
                          <span className="text-xs tabular-nums opacity-80">{item.score}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="border-t p-4">
                <Button variant="outline" className="w-full" onClick={runAudit} disabled={loading || applying}>
                  {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
                  重新检查
                </Button>
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">质量审查报告</h3>
                    {criticalCount > 0 && <Badge variant="destructive">{criticalCount} 个严重问题</Badge>}
                    {warningCount > 0 && <Badge variant="secondary">{warningCount} 个建议修改</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">只会应用已勾选且有明确前后差异的修改，跨话题复习不会被自动删除。</p>
                </div>
                <Button onClick={applySelected} disabled={applying || selectedProposals.size === 0}>
                  {applying ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <WandSparkles data-icon="inline-start" />}
                  应用所选修改 ({selectedProposals.size})
                </Button>
              </div>

              <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
                <div className="border-b px-6 py-3">
                  <TabsList className="grid w-full max-w-3xl grid-cols-4">
                    <TabsTrigger value="overview"><BarChart3 data-icon="inline-start" />总览</TabsTrigger>
                    <TabsTrigger value="knowledge"><Boxes data-icon="inline-start" />知识点</TabsTrigger>
                    <TabsTrigger value="exercises"><Target data-icon="inline-start" />题目设计</TabsTrigger>
                    <TabsTrigger value="proposals"><Sparkles data-icon="inline-start" />修改方案</TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="p-6">
                    <TabsContent value="overview" className="m-0 flex flex-col gap-5">
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: '单词', value: scopedTotals.vocabs, icon: BookOpenCheck },
                          { label: '句块', value: scopedTotals.chunks, icon: CopyCheck },
                          { label: '句型', value: scopedTotals.patterns, icon: Boxes },
                          { label: '题组', value: scopedTotals.groups, icon: Target },
                        ].map((item) => (
                          <Card key={item.label}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                              <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                              <item.icon className="size-4 text-primary" />
                            </CardHeader>
                            <CardContent><p className="text-3xl font-semibold">{item.value}</p></CardContent>
                          </Card>
                        ))}
                      </div>

                      <Card>
                        <CardHeader><CardTitle className="text-base">优先处理的问题</CardTitle></CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          {!scopedIssues.length ? (
                            <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4 text-sm">
                              <CheckCircle2 className="size-5 text-primary" />当前规则下没有发现明显问题。
                            </div>
                          ) : scopedIssues.map((issue) => (
                            <div key={issue.id} className="flex items-start gap-3 rounded-lg border p-3">
                              {issue.severity === 'critical'
                                ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                                : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium">{issue.title}</p>
                                  {issue.topicTitle && <Badge variant="outline">{issue.topicTitle}</Badge>}
                                  {severityBadge(issue.severity)}
                                </div>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{issue.detail}</p>
                                <p className="mt-1 text-xs leading-5"><span className="font-medium">建议：</span>{issue.recommendation}</p>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="knowledge" className="m-0 flex flex-col gap-4">
                      {scopedTopics.map((item) => (
                        <Card key={item.topic.id}>
                          <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                              <CardTitle className="text-base">{item.topic.title}</CardTitle>
                              <p className="mt-1 text-xs text-muted-foreground">{item.topic.promptZh || item.topic.promptEn}</p>
                            </div>
                            <Badge variant="outline">质量 {item.score}</Badge>
                          </CardHeader>
                          <CardContent className="grid grid-cols-3 gap-4">
                            {(['pattern', 'chunk', 'vocab'] as MaterialKind[]).map((kind) => {
                              const entries = item.materials.filter((material) => material.kind === kind)
                              const label = kind === 'pattern' ? '句型' : kind === 'chunk' ? '句块' : '单词'
                              return (
                                <div key={kind} className="rounded-lg border bg-muted/20 p-3">
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                    <Badge variant="secondary">{entries.length}</Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {entries.length ? entries.map((entry) => {
                                      const total = kind === 'vocab'
                                        ? item.usage.totals.vocabs.find((value) => value.id === entry.id)?.count
                                        : kind === 'chunk'
                                          ? item.usage.totals.chunks.find((value) => value.id === entry.id)?.count
                                          : item.usage.totals.patterns.find((value) => value.id === entry.id)?.count
                                      return <Badge key={entry.id} variant={total ? 'outline' : 'destructive'}>{entry.text} · {total ?? 0}题</Badge>
                                    }) : <span className="text-xs text-muted-foreground">未分配</span>}
                                  </div>
                                </div>
                              )
                            })}
                          </CardContent>
                        </Card>
                      ))}
                    </TabsContent>

                    <TabsContent value="exercises" className="m-0 flex flex-col gap-4">
                      {scopedTopics.length ? scopedTopics.map((topicAudit) => (
                        <div key={topicAudit.topic.id} className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{topicAudit.topic.title}</h4>
                              <p className="mt-1 text-xs text-muted-foreground">共 {topicAudit.pipeline.length} 个题组、{topicAudit.exercises.length} 道题</p>
                            </div>
                            <div className="flex gap-2">
                              {[...new Set(topicAudit.pipeline.map((item) => item.type))].map((type) => <Badge key={type} variant="outline">{TYPE_LABEL[type]}</Badge>)}
                            </div>
                          </div>
                          {topicAudit.pipeline.map((group, index) => (
                            <Card key={group.id}>
                              <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <CardTitle className="text-sm">{index + 1}. {group.title || TYPE_LABEL[group.type]}</CardTitle>
                                <div className="flex gap-2"><Badge variant="secondary">{TYPE_LABEL[group.type]}</Badge><Badge variant="outline">{countGroupItems(group)} 题</Badge></div>
                              </CardHeader>
                              <CardContent className="flex flex-col gap-2">
                                {topicAudit.exercises.filter((row) => row.groupId === group.id).map((row, rowIndex) => (
                                  <div key={`${row.groupId}_${rowIndex}`} className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                                    <span>{row.prompt || '—'}</span><ArrowRight className="size-3.5 text-muted-foreground" /><span className="font-medium">{row.answer || '—'}</span>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )) : <p className="py-12 text-center text-sm text-muted-foreground">暂无话题</p>}
                    </TabsContent>

                    <TabsContent value="proposals" className="m-0 flex flex-col gap-4">
                      {!scopedProposals.length ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
                          <CheckCircle2 className="size-8 text-primary" />
                          <div><p className="font-medium">没有可安全自动应用的修改</p><p className="mt-1 text-sm text-muted-foreground">仍可在总览查看需要人工确认的课程设计建议。</p></div>
                        </div>
                      ) : scopedProposals.map((proposal) => (
                        <Card key={proposal.topicId} className={cn(selectedProposals.has(proposal.topicId) && 'border-primary/50')}>
                          <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                              <CardTitle className="text-base">{proposal.topicTitle}</CardTitle>
                              <div className="mt-2 flex flex-wrap gap-1.5">{proposal.reasons.map((reason) => <Badge key={reason} variant="secondary">{reason}</Badge>)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">应用此修改</span>
                              <Switch checked={selectedProposals.has(proposal.topicId)} onCheckedChange={(checked) => toggleProposal(proposal.topicId, checked)} />
                            </div>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-4">
                            <div className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-stretch gap-3">
                              <div className="rounded-lg border bg-muted/20 p-3">
                                <p className="text-xs font-medium text-muted-foreground">原来</p>
                                <p className="mt-2 text-2xl font-semibold">{proposal.before.length} <span className="text-sm font-normal text-muted-foreground">题组</span> · {exerciseCount(proposal.before)} <span className="text-sm font-normal text-muted-foreground">题</span></p>
                              </div>
                              <div className="flex items-center justify-center"><ArrowRight className="size-4 text-muted-foreground" /></div>
                              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                                <p className="text-xs font-medium text-primary">更新后</p>
                                <p className="mt-2 text-2xl font-semibold">{proposal.after.length} <span className="text-sm font-normal text-muted-foreground">题组</span> · {exerciseCount(proposal.after)} <span className="text-sm font-normal text-muted-foreground">题</span></p>
                              </div>
                            </div>
                            {proposal.addedGroups.length > 0 && (
                              <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">新增内容</p>
                                <div className="flex flex-col gap-2">
                                  {proposal.addedGroups.map((group) => (
                                    <div key={group.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                                      <div><p className="text-sm font-medium">{group.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{TYPE_LABEL[group.type]} · 基于知识点已有标准例句</p></div>
                                      <Badge variant="outline">+{countGroupItems(group)} 题</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}

                      {scopedIssues.some((issue) => !issue.autoFixable) && (
                        <div className="rounded-lg border bg-muted/20 p-4">
                          <div className="flex items-start gap-3">
                            <ScanSearch className="mt-0.5 size-5 text-muted-foreground" />
                            <div><p className="text-sm font-medium">还有需要课程设计者确认的问题</p><p className="mt-1 text-xs leading-5 text-muted-foreground">知识点与话题的语义匹配、跨话题复习是否有意设计，以及缺少标准例句的知识点不会被自动修改。请参考总览中的逐项建议。</p></div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
