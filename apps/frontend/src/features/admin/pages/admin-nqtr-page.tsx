import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StoryWorkshopTab } from '../components/story-workshop-tab'
import {
  listCharacters,
  listLocations,
  type GameCharacter,
  type GameLocationData,
} from '../api-content-admin'

/** 学习包内的练习话题。角色、地图和独立剧情已迁移到“剧情包内容”。 */
export function AdminNqtrPage() {
  const [searchParams] = useSearchParams()
  const [characters, setCharacters] = useState<GameCharacter[]>([])
  const [locations, setLocations] = useState<GameLocationData[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listCharacters().catch(() => []),
      listLocations().catch(() => []),
    ]).then(([nextCharacters, nextLocations]) => {
      if (cancelled) return
      setCharacters(nextCharacters)
      setLocations(nextLocations)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <header><h1 className="text-2xl font-bold">练习话题</h1><p className="mt-1 text-sm text-muted-foreground">管理学习计划中 TrainingTopic 对应的话题实战 VN。</p></header>

      <StoryWorkshopTab
        workspace="practice"
        locations={locations}
        characters={characters}
        initialStoryId={searchParams.get('storyId') || undefined}
      />
    </div>
  )
}
