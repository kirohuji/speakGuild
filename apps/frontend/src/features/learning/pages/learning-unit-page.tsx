import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, BookText, MessageSquareText,
  Mic, Target, ArrowRight,
  ExternalLink, BookmarkPlus, Search,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { learningApi, type UnitDetail } from '../api/learning-api'
import { chunkApi } from '@/features/practice/api/english-practice-api'
import { useWordsStore } from '@/stores/assets.store'
import {
  LearningInsightDialog,
  type LearningInsightItem,
} from '@/features/practice/components/learning-insight-dialog'

export function LearningUnitPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [unit, setUnit] = useState<UnitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('vocab')

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogIndex, setDialogIndex] = useState(0)
  const [dialogItems, setDialogItems] = useState<LearningInsightItem[]>([])

  // 展开的列表项（点击高亮 + 展开显示详情）
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const { addWord, hasWord } = useWordsStore()

  useEffect(() => {
    if (!unitId) return
    setLoading(true)
    learningApi.getUnitDetail(unitId)
      .then(setUnit)
      .catch(() => setUnit(null))
      .finally(() => setLoading(false))
  }, [unitId])

  const vocabDialogItems = useMemo<LearningInsightItem[]>(() =>
    (unit?.vocabularies ?? []).map((v) => ({
      kind: 'word' as const,
      id: v.id,
      word: v.word,
      meaning: v.meaning,
      sceneName: unit?.title,
    })), [unit])

  const chunkDialogItems = useMemo<LearningInsightItem[]>(() =>
    (unit?.chunks ?? []).map((c) => ({
      kind: 'chunk' as const,
      id: c.id,
      text: c.text,
      meaning: c.meaning,
      description: c.description,
      examples: c.examples,
      sceneName: unit?.title,
    })), [unit])

  const allVocabCount = vocabDialogItems.length
  const allChunkCount = chunkDialogItems.length

  // 打开 Dialog
  const openDialog = useCallback((items: LearningInsightItem[], startIndex: number) => {
    setDialogItems(items)
    setDialogIndex(Math.min(startIndex, items.length - 1))
    setDialogOpen(true)
  }, [])

  // 点击列表项展开/收起详情
  const handleItemClick = useCallback((itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId))
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open)
  }, [])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>
  if (!unit) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Target className="size-12 text-muted-foreground/40" />
      <p className="text-muted-foreground">学习单元不存在</p>
      <Button variant="outline" asChild><Link to="/learning">返回学习计划</Link></Button>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* ===== Header ===== */}
      <div className="mb-4">
        <Link to="/learning" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> 学习计划
        </Link>
        <h1 className="text-xl font-bold text-foreground">{unit.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{unit.location}</p>
      </div>

      {/* ===== 本单元练习话题 ===== */}
      {unit.trainingTopics.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Mic className="size-4 text-orange-500" />
            练习话题 ({unit.trainingTopics.length})
          </h2>
          <div className="space-y-2">
            {unit.trainingTopics.map((topic, i) => (
              <Card key={topic.id}
                className="cursor-pointer border-orange-500/30 bg-gradient-to-br from-orange-500/[0.03] to-transparent transition-colors hover:bg-orange-500/[0.08]"
                onClick={() => navigate(`/practice/session/${topic.id}`)}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
                    <span className="text-sm font-bold text-orange-500">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{topic.title}</p>
                      <Badge variant="secondary" className="text-[10px]">{topic.difficulty}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{topic.promptZh}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      建议 {Math.round(topic.suggestedDurationSec / 60)} 分钟
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Dialog */}
      <LearningInsightDialog
        items={dialogItems}
        index={dialogIndex}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onIndexChange={setDialogIndex}
      />
    </div>
  )
}
