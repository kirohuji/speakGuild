import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, GraduationCap, Plane, Coffee, Briefcase, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import api from '../api/english-practice-api'

const SCENE_ICONS: Record<string, typeof BookOpen> = {
  '留学生活': GraduationCap, '旅行英语': Plane, '日常社交': Coffee, '职场交流': Briefcase, '学术挑战': Users,
}

interface SceneCategory {
  id: string; name: string; icon: string | null
  scenes: { id: string; title: string; location: string; requiredOutputLevel: string; requiredUserLevel: number }[]
}

interface TrainingTopic {
  id: string
  title: string
  promptZh: string
  difficulty: string
  suggestedDurationSec: number
}

export function PracticeHubPage() {
  const [searchParams] = useSearchParams()
  const sceneId = searchParams.get('sceneId')
  const [categories, setCategories] = useState<SceneCategory[]>([])
  const [scene, setScene] = useState<{ id: string; title: string; location: string } | null>(null)
  const [topics, setTopics] = useState<TrainingTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sceneId) {
      setLoading(true)
      api.get('/practice/topics', { params: { sceneId } })
        .then((res: any) => {
          const data = res?.data ?? res
          setScene(data.scene ?? null)
          setTopics(data.topics ?? [])
        })
        .catch(() => { setScene(null); setTopics([]) })
        .finally(() => setLoading(false))
      return
    }

    api.get('/scenes/categories')
      .then((res: any) => { if (Array.isArray(res?.data ?? res)) setCategories(res?.data ?? res) })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [sceneId])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

  if (sceneId) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
        <div className="mb-6">
          <Link to="/practice" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" />
            返回场景
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{scene?.title ?? '训练话题'}</h1>
          <p className="mt-1 text-muted-foreground">{scene?.location ?? '选择一个话题开始练习'}</p>
        </div>

        {topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="size-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">这个场景还没有训练话题</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                to={`/practice/session/${topic.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{topic.title}</p>
                    <Badge variant="secondary" className="text-xs">{topic.difficulty}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{topic.promptZh}</p>
                  <p className="mt-1 text-xs text-muted-foreground">建议 {topic.suggestedDurationSec}s</p>
                </div>
                <ChevronRight className="ml-3 size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">练习模式</h1>
        <p className="mt-1 text-muted-foreground">选择场景，激活 Chunk，开口练习</p>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">场景内容即将上线</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const Icon = SCENE_ICONS[cat.name] ?? BookOpen
            return (
              <Card key={cat.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="size-5 text-primary" />{cat.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cat.scenes.map((scene) => (
                    <Link
                      key={scene.id}
                      to={`/practice/topics?sceneId=${scene.id}`}
                      className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{scene.title}</p>
                        <p className="text-xs text-muted-foreground">{scene.location}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{scene.requiredOutputLevel}</Badge>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
