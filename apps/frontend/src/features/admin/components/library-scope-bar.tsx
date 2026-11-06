import { useEffect, useState } from 'react'
import { BookOpen, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import type { Scene, SceneCategory, TrainingTopic } from '../api-content-admin'

const PACKAGE_TYPE_OPTIONS: Array<{ id: Exclude<Scene['packageType'], 'story'>; label: string }> = [
  { id: 'foundation', label: '基础学习' },
  { id: 'daily', label: '日常应用' },
  { id: 'course', label: '专项提升' },
  { id: 'exam', label: '考试备考' },
]

export type LibraryPackageTypeFilter = 'all' | Exclude<Scene['packageType'], 'story'>

export type LibraryScopeGroupOption = {
  id: string
  name: string
  count: number
}

function packageTypeLabel(type?: Scene['packageType']) {
  return PACKAGE_TYPE_OPTIONS.find((item) => item.id === type)?.label ?? '日常应用'
}

function contentModeLabel(mode?: Scene['contentMode']) {
  if (mode === 'writing') return '写作'
  if (mode === 'reading') return '阅读'
  if (mode === 'listening') return '听力'
  if (mode === 'novel') return '小说'
  if (mode === 'story') return '剧情'
  return '知识点练习'
}

export function LibraryScopeBar({
  packageType,
  onPackageTypeChange,
  categories,
  categoryId,
  onCategoryChange,
  groups,
  groupId,
  onGroupChange,
  scenes,
  sceneId,
  onSceneChange,
  topics,
  topicsLoading,
  topicId,
  onTopicChange,
  onClear,
}: {
  packageType: LibraryPackageTypeFilter
  onPackageTypeChange: (value: LibraryPackageTypeFilter) => void
  categories: SceneCategory[]
  categoryId: string | null
  onCategoryChange: (id: string | null) => void
  groups: LibraryScopeGroupOption[]
  groupId: string | null
  onGroupChange: (id: string | null) => void
  scenes: Scene[]
  sceneId: string | null
  onSceneChange: (id: string | null) => void
  topics: TrainingTopic[]
  topicsLoading: boolean
  topicId: string | null
  onTopicChange: (id: string | null) => void
  onClear: () => void
}) {
  const scene = scenes.find((item) => item.id === sceneId) ?? null
  const topic = topics.find((item) => item.id === topicId) ?? null
  const [coverFailed, setCoverFailed] = useState(false)
  const canClear = packageType !== 'all' || !!categoryId || !!groupId || !!sceneId

  useEffect(() => {
    setCoverFailed(false)
  }, [scene?.id, scene?.coverImage])

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[140px]">
            <Select
              id="library-package-type"
              aria-label="类型"
              value={packageType}
              onChange={(event) => onPackageTypeChange(event.target.value as LibraryPackageTypeFilter)}
            >
              <option value="all">全部类型</option>
              {PACKAGE_TYPE_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[180px] flex-1">
            <Select
              id="library-category"
              aria-label="主题"
              className="w-full"
              value={categoryId ?? 'all'}
              disabled={categories.length === 0}
              onChange={(event) => onCategoryChange(event.target.value === 'all' ? null : event.target.value)}
            >
              <option value="all">全部主题</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}（{category._count?.scenes ?? 0}）
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[160px] flex-1">
            <Select
              id="library-group"
              className="w-full"
              value={groupId ?? 'all'}
              disabled={groups.length === 0}
              aria-label="按所属系列筛选"
              onChange={(event) => onGroupChange(event.target.value === 'all' ? null : event.target.value)}
            >
              <option value="all">{groups.length === 0 ? '当前筛选下没有系列' : '全部系列'}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}（{group.count}）</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[180px] flex-1">
            <Select
              id="library-scene"
              aria-label="学习包"
              className="w-full"
              value={sceneId ?? ''}
              disabled={scenes.length === 0}
              onChange={(event) => onSceneChange(event.target.value || null)}
            >
              <option value="">{scenes.length === 0 ? '当前筛选下没有学习包' : '全部学习包'}</option>
              {scenes.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[160px] flex-1">
            <Select
              id="library-topic"
              aria-label="话题"
              className="w-full"
              value={topicId ?? ''}
              disabled={!sceneId || topicsLoading}
              onChange={(event) => onTopicChange(event.target.value || null)}
            >
              <option value="">{!sceneId ? '先选择学习包' : topicsLoading ? '正在加载话题' : '全部话题'}</option>
              {topics.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="清除筛选"
            disabled={!canClear}
            onClick={onClear}
          >
            <X />
          </Button>
        </div>

        {scene && (
          <div className="flex min-w-0 items-center gap-3">
            {scene.coverImage && !coverFailed ? (
              <img
                src={scene.coverImage}
                alt=""
                className="h-9 w-auto shrink-0 rounded-md object-contain"
                onError={() => setCoverFailed(true)}
              />
            ) : (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <BookOpen className="size-4" />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-medium">{scene.title}</span>
              {scene.category && <Badge variant="secondary">{scene.category.name}</Badge>}
              <Badge variant="outline">{packageTypeLabel(scene.packageType)}</Badge>
              <Badge variant="outline">{contentModeLabel(scene.contentMode)}</Badge>
              <span className="text-xs text-muted-foreground">
                {scene.requiredOutputLevel}
                {' · '}话题 {scene._count?.trainingTopics ?? 0}
                {' · '}词 {scene.contentStats?.vocabCount ?? 0}
                {' · '}句块 {scene.contentStats?.chunkCount ?? 0}
                {' · '}句型 {scene.contentStats?.patternCount ?? 0}
              </span>
              {topic && (
                <Badge variant="secondary">
                  {topic.title} · {topic.difficulty}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
