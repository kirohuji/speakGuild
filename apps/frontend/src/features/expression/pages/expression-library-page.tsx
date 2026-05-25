import { useState, useEffect } from 'react'
import { Trash2, BookMarked, AlertCircle, Sparkles, Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { expressionApi } from '@/features/practice/api/english-practice-api'
import { cn } from '@/lib/cn'

interface Expression {
  id: string; type: string; original: string | null; corrected: string | null
  chunkText: string | null; sceneName: string | null; masteryStatus: string
  reviewCount: number; createdAt: string
}

const TYPE_META: Record<string, { label: string; icon: typeof BookMarked; color: string }> = {
  chunk: { label: 'Chunk', icon: Layers, color: 'border-l-blue-500' },
  error_sentence: { label: '错句', icon: AlertCircle, color: 'border-l-red-500' },
  upgraded: { label: '升级', icon: Sparkles, color: 'border-l-amber-500' },
  scene_phrase: { label: '场景', icon: BookMarked, color: 'border-l-green-500' },
}

export function ExpressionLibraryPage() {
  const [expressions, setExpressions] = useState<Expression[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const fetchData = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filter !== 'all') params.type = filter
      const res: any = await expressionApi.list(params)
      setExpressions(Array.isArray(res) ? res : res?.data ?? [])
    } catch { setExpressions([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [filter])

  const handleDelete = async (id: string) => {
    try { await expressionApi.remove(id); fetchData() } catch {}
  }

  const filtered = filter === 'all' ? expressions : expressions.filter((e) => e.type === filter)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">表达库</h1>
        <p className="mt-1 text-muted-foreground">你的英语表达资产中心</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="all" className="flex-1">全部</TabsTrigger>
          <TabsTrigger value="chunk" className="flex-1">Chunk</TabsTrigger>
          <TabsTrigger value="error_sentence" className="flex-1">错句</TabsTrigger>
          <TabsTrigger value="upgraded" className="flex-1">升级</TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <BookMarked className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">还没有保存的表达</p>
              <p className="text-sm text-muted-foreground">完成练习后可以保存错句和升级表达</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((expr) => {
                const meta = TYPE_META[expr.type] ?? TYPE_META.chunk
                const Icon = meta.icon
                const text = expr.corrected ?? expr.chunkText ?? expr.original ?? ''
                return (
                  <Card key={expr.id} className={cn('border-l-4', meta.color)}>
                    <CardContent className="flex items-start justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Icon className="size-3" />{meta.label}
                          </Badge>
                          {expr.sceneName && <span className="text-xs text-muted-foreground">{expr.sceneName}</span>}
                        </div>
                        <p className="truncate text-sm text-foreground">{text}</p>
                        {expr.original && expr.corrected && expr.original !== expr.corrected && (
                          <p className="mt-1 truncate text-xs text-muted-foreground line-through">{expr.original}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="ml-2 shrink-0" onClick={() => handleDelete(expr.id)}>
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {filtered.length > 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">共 {filtered.length} 条表达</p>
      )}
    </div>
  )
}
