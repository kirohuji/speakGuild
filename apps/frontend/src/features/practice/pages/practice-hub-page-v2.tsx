import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronRight, GraduationCap, Plane, Coffee, Briefcase, Users } from 'lucide-react'
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

export function PracticeHubPage() {
  const [categories, setCategories] = useState<SceneCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/scenes/categories')
      .then((res: any) => { if (Array.isArray(res?.data ?? res)) setCategories(res?.data ?? res) })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>

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
