import { useState } from 'react'
import { Boxes, Map, UserCircle, Volume2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CharactersTab } from '../components/characters-tab'
import { NarrativeWorldStudio } from '../components/narrative-world-studio'
import { VoiceAssetsTab } from '../components/voice-assets-tab'
import type { GameCharacter, GameLocationData } from '../api-content-admin'

type AssetTab = 'characters' | 'voices' | 'maps'

/** 剧情系统的全局共享资产；剧情包和章节只保存对这些资产的引用。 */
export function AdminNarrativeAssetsPage() {
  const [characters, setCharacters] = useState<GameCharacter[]>([])
  const [locations, setLocations] = useState<GameLocationData[]>([])
  const [activeTab, setActiveTab] = useState<AssetTab>('characters')

  return (
    <div className="flex h-[calc(100dvh-5rem)] min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-6rem)]">
      {/* <header className="relative flex shrink-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/60 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-48 bg-[radial-gradient(circle_at_left,hsl(var(--primary)/0.12),transparent_68%)]"
          aria-hidden="true"
        />
        <div className="relative flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
            <Boxes className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">剧情共享资产</h1>
            <p className="truncate text-xs text-muted-foreground">
              集中维护角色、音色与地图世界，供剧情章节统一引用
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            全局资源库
          </span>
          <span className="hidden rounded-full bg-muted/70 px-2.5 py-1 md:inline-flex">
            {characters.length + locations.length} 项已载入
          </span>
        </div>
      </header> */}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as AssetTab)}
        className="mt-3 flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="h-10 w-full shrink-0 justify-start gap-1 rounded-lg border border-border/60 bg-card p-1 sm:w-fit">
          <TabsTrigger value="characters" className="h-8 gap-2 rounded-md px-4">
            <UserCircle className="size-4" />
            角色资产
            {characters.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums opacity-70">
                {characters.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="voices" className="h-8 gap-2 rounded-md px-4">
            <Volume2 className="size-4" />
            音色资产
          </TabsTrigger>
          <TabsTrigger value="maps" className="h-8 gap-2 rounded-md px-4">
            <Map className="size-4" />
            地图世界
            {locations.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums opacity-70">
                {locations.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          <CharactersTab onCharactersChange={setCharacters} />
        </TabsContent>
        <TabsContent value="maps" className="mt-3 min-h-0 flex-1 overflow-hidden">
          <NarrativeWorldStudio onLocationsChange={setLocations} />
        </TabsContent>
        <TabsContent value="voices" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          <VoiceAssetsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
