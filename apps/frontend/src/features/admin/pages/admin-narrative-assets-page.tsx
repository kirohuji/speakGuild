import { useState } from 'react'
import { Map, UserCircle, Volume2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CharactersTab } from '../components/characters-tab'
import { MapsTab } from '../components/maps-tab'
import { VoiceAssetsTab } from '../components/voice-assets-tab'
import type { GameCharacter, GameLocationData } from '../api-content-admin'

/** 剧情系统的全局共享资产；剧情包和章节只保存对这些资产的引用。 */
export function AdminNarrativeAssetsPage() {
  const [characters, setCharacters] = useState<GameCharacter[]>([])
  const [locations, setLocations] = useState<GameLocationData[]>([])

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">剧情共享资产</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          统一维护角色与地图世界。资产不归属于某个剧情包，在章节剧情中按需引用。
        </p>
      </header>

      <Tabs defaultValue="characters">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-muted/55 p-1 sm:w-fit">
          <TabsTrigger value="characters" className="gap-2 px-4">
            <UserCircle className="size-4" />角色资产
            {characters.length > 0 && <span className="text-[10px] opacity-60">{characters.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="voices" className="gap-2 px-4">
            <Volume2 className="size-4" />音色资产
          </TabsTrigger>
          <TabsTrigger value="maps" className="gap-2 px-4">
            <Map className="size-4" />地图世界
            {locations.length > 0 && <span className="text-[10px] opacity-60">{locations.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters" className="mt-4">
          <CharactersTab onCharactersChange={setCharacters} />
        </TabsContent>
        <TabsContent value="maps" className="mt-4">
          <MapsTab onLocationsChange={setLocations} />
        </TabsContent>
        <TabsContent value="voices" className="mt-4"><VoiceAssetsTab /></TabsContent>
      </Tabs>
    </div>
  )
}
