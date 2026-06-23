import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  UserCircle, Map, ScrollText, Palette,
} from 'lucide-react'
import { CharactersTab } from '../components/characters-tab'
import { MapsTab } from '../components/maps-tab'
import { StoryWorkshopTab } from '../components/story-workshop-tab'
import { listCharacters, listLocations, type GameCharacter, type GameLocationData } from '../api-content-admin'

/**
 * NQTR 内容工坊 — 统一管理角色、地图、故事
 *
 * NQTR = Narrative (叙事) + Quest (任务) + Training (训练) + Role (角色)
 *
 * Tab 与 URL 查询参数联动：
 *   ?tab=characters       — 角色管理
 *   ?tab=maps             — 地图管理
 *   ?tab=stories          — 故事工坊
 *   ?tab=stories&storyId= — 故事工坊（直接打开指定故事）
 *
 * 工作流：
 * 1. 角色管理：创建 NPC 角色（名称、性格、立绘等）
 * 2. 地图管理：创建地图和地点（位置、NPC 关联等）
 * 3. 故事工坊：用 Markdown DSL 编写对话脚本，绑定地点和角色
 * 4. 场景管理：在训练话题中绑定故事，用户即可练习
 */
export function AdminNqtrPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [characters, setCharacters] = useState<GameCharacter[]>([])
  const [locations, setLocations] = useState<GameLocationData[]>([])

  // 从 URL 查询参数读取当前 tab 和 storyId
  const activeTab = searchParams.get('tab') || 'stories'
  const storyId = searchParams.get('storyId') || undefined

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listCharacters().catch(() => []),
      listLocations().catch(() => []),
    ]).then(([chars, locs]) => {
      if (cancelled) return
      setCharacters(chars)
      setLocations(locs)
    })
    return () => { cancelled = true }
  }, [])

  const handleCharactersChange = useCallback((chars: GameCharacter[]) => {
    setCharacters(chars)
  }, [])

  const handleLocationsChange = useCallback((locs: GameLocationData[]) => {
    setLocations(locs)
  }, [])

  // Tab 切换 → 更新 URL 查询参数（保留 storyId 仅在 stories tab 有效）
  const handleTabChange = (value: string) => {
    const next = new URLSearchParams()
    next.set('tab', value)
    if (value === 'stories' && storyId) {
      next.set('storyId', storyId)
    }
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
          <Palette className="size-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">NQTR 内容工坊</h1>
          <p className="text-sm text-muted-foreground">
            叙事 · 探索 · 训练 · 角色 — 一站式内容创作平台
          </p>
        </div>
      </div>

      {/* Tabs — value 与 URL ?tab= 双向同步 */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-10 w-full justify-start gap-0 rounded-lg bg-muted/50 p-1 sm:w-auto">
          <TabsTrigger
            value="characters"
            className="gap-1.5 rounded-md px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <UserCircle className="size-4" />
            <span className="hidden sm:inline">角色管理</span>
            <span className="text-[10px] text-muted-foreground">({characters.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="maps"
            className="gap-1.5 rounded-md px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Map className="size-4" />
            <span className="hidden sm:inline">地图管理</span>
            <span className="text-[10px] text-muted-foreground">({locations.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="stories"
            className="gap-1.5 rounded-md px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <ScrollText className="size-4" />
            <span className="hidden sm:inline">故事工坊</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters" className="mt-4">
          <CharactersTab onCharactersChange={handleCharactersChange} />
        </TabsContent>

        <TabsContent value="maps" className="mt-4">
          <MapsTab onLocationsChange={handleLocationsChange} />
        </TabsContent>

        <TabsContent value="stories" className="mt-4">
          <StoryWorkshopTab
            locations={locations}
            characters={characters}
            initialStoryId={storyId}
          />
        </TabsContent>

      </Tabs>
    </div>
  )
}
