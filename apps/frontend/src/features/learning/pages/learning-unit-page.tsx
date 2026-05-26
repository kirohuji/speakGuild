import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, BookText, MessageSquareText,
  Mic, Play, CheckCircle2, Target, ArrowRight,
  Quote, ExternalLink, BookmarkPlus, Search,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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

      {/* ===== 开始练习按钮（顶部） ===== */}
      <div className="mb-5">
        <Button className="w-full gap-2" size="lg" onClick={() => {
          if (unit.trainingTopics.length > 0) navigate(`/practice/session/${unit.trainingTopics[0].id}`)
        }}>
          <Mic className="size-5" /> 开始练习
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* ===== Tabs: 场景词汇 | 核心表达 | 句型骨架 ===== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="w-full">
          {allVocabCount > 0 && (
            <TabsTrigger value="vocab" className="flex-1 text-xs">
              场景词汇
              <span className="ml-1 text-[10px] text-muted-foreground">{allVocabCount}</span>
            </TabsTrigger>
          )}
          {allChunkCount > 0 && (
            <TabsTrigger value="chunk" className="flex-1 text-xs">
              核心表达
              <span className="ml-1 text-[10px] text-muted-foreground">{allChunkCount}</span>
            </TabsTrigger>
          )}
          {unit.sentencePatterns.length > 0 && (
            <TabsTrigger value="pattern" className="flex-1 text-xs">
              句型骨架
              <span className="ml-1 text-[10px] text-muted-foreground">{unit.sentencePatterns.length}</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab: 场景词汇（列表形式） */}
        <TabsContent value="vocab" className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">点击单项展开详情 · 点击「查询」进入沉浸式学习</span>
            <button
              onClick={() => openDialog(vocabDialogItems, 0)}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
            >
              <ExternalLink className="size-3" /> 沉浸式
            </button>
          </div>
          <div className="space-y-1">
            {unit.vocabularies.map((v, i) => {
              const isExpanded = expandedItemId === v.id
              return (
                <div key={v.id} className={cn(
                  'rounded-lg border transition-all',
                  isExpanded ? 'border-blue-500/40 bg-blue-500/5' : 'border-border bg-card',
                )}>
                  <button
                    onClick={() => handleItemClick(v.id)}
                    className="flex w-full items-center justify-between p-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-bold', isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-foreground')}>
                        {v.word}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        onClick={(e) => { e.stopPropagation(); openDialog(vocabDialogItems, i) }}
                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="查询"
                      >
                        <Search className="size-3.5" />
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!hasWord(v.word)) {
                            addWord(v.word)
                            toast.success('已收藏到我的学习库')
                          } else {
                            toast.info('已在学习库中')
                          }
                        }}
                        className={cn(
                          'inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                          hasWord(v.word)
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-muted-foreground hover:bg-muted hover:text-amber-500',
                        )}
                        title="收藏"
                      >
                        <BookmarkPlus className="size-3.5" />
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-blue-500/20 px-3 pb-3 pt-2">
                      <p className="text-sm text-foreground">{v.meaning}</p>
                      {v.description && <p className="mt-1 text-xs text-muted-foreground">{v.description}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => openDialog(vocabDialogItems, i)}
                          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                        >
                          <ExternalLink className="size-3" /> 查看详情
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </TabsContent>

        {/* Tab: 核心表达（列表形式） */}
        <TabsContent value="chunk" className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">点击单项展开详情 · 点击「查询」进入沉浸式学习</span>
            <button
              onClick={() => openDialog(chunkDialogItems, 0)}
              className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600"
            >
              <ExternalLink className="size-3" /> 沉浸式
            </button>
          </div>
          <div className="space-y-1">
            {unit.chunks.map((c, i) => {
              const isExpanded = expandedItemId === c.id
              return (
                <div key={c.id} className={cn(
                  'rounded-lg border transition-all',
                  isExpanded ? 'border-purple-500/40 bg-purple-500/5' : 'border-border bg-card',
                )}>
                  <button
                    onClick={() => handleItemClick(c.id)}
                    className="flex w-full items-center justify-between p-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-medium', isExpanded ? 'text-purple-600 dark:text-purple-400' : 'text-foreground')}>
                        {c.text}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        onClick={(e) => { e.stopPropagation(); openDialog(chunkDialogItems, i) }}
                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="查询"
                      >
                        <Search className="size-3.5" />
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-purple-500/20 px-3 pb-3 pt-2">
                      <p className="text-sm text-foreground">{c.meaning}</p>
                      {c.description && <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>}
                      {c.examples.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {c.examples.slice(0, 1).map((ex, ei) => (
                            <div key={ei} className="rounded-md bg-background/80 p-2 text-xs">
                              <p className="text-foreground">{ex.en}</p>
                              <p className="text-muted-foreground">{ex.zh}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => openDialog(chunkDialogItems, i)}
                          className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600"
                        >
                          <ExternalLink className="size-3" /> 查看详情
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </TabsContent>

        {/* Tab: 句型骨架 */}
        <TabsContent value="pattern" className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">点击单项展开详情</span>
          </div>
          <div className="space-y-1">
            {unit.sentencePatterns.map((sp, i) => {
              const isExpanded = expandedItemId === `pattern-${i}`
              return (
                <div key={i} className={cn(
                  'rounded-lg border transition-all',
                  isExpanded ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card',
                )}>
                  <button
                    onClick={() => setExpandedItemId((prev) => (prev === `pattern-${i}` ? null : `pattern-${i}`))}
                    className="flex w-full items-center justify-between p-3 text-left"
                  >
                    <p className={cn('text-sm font-mono font-bold', isExpanded ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                      {sp.pattern}
                    </p>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-amber-500/20 px-3 pb-3 pt-2">
                      <p className="text-sm text-foreground">{sp.meaning}</p>
                      {sp.slots.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {sp.slots.map((slot, si) => (
                            <Badge key={si} variant="secondary" className="text-[10px]">{slot}</Badge>
                          ))}
                        </div>
                      )}
                      {sp.example && (
                        <div className="mt-2 rounded-md bg-background/80 p-2 text-xs text-foreground">{sp.example}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>



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
