import { useCallback, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Map, UserCircle, Volume2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CharactersTab } from '../components/characters-tab'
import { NarrativeMapList } from '../components/narrative-map-list'
import { NarrativeWorldStudio } from '../components/narrative-world-studio'
import { VoiceAssetsTab } from '../components/voice-assets-tab'
import type { GameCharacter, GameMapData } from '../api-content-admin'
import { useAuth } from '@/providers/auth-provider'

type AssetTab = 'characters' | 'voices' | 'maps'

const TAB_PATH: Record<AssetTab, string> = {
  characters: '/admin/narrative-assets/characters',
  voices: '/admin/narrative-assets/voices',
  maps: '/admin/narrative-assets/maps',
}

function activeAssetTab(pathname: string): AssetTab {
  if (pathname.includes('/narrative-assets/maps')) return 'maps'
  if (pathname.includes('/narrative-assets/voices')) return 'voices'
  return 'characters'
}

type NarrativeAssetsContext = {
  setCharacterCount: (count: number) => void
  setMapCount: (count: number) => void
}

/** 剧情系统的全局共享资产；剧情包和章节只保存对这些资产的引用。 */
export function AdminNarrativeAssetsPage() {
  const { session } = useAuth()
  const isCreator = session?.user?.role === 'creator'
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [characterCount, setCharacterCount] = useState(0)
  const [mapCount, setMapCount] = useState(0)
  const activeTab = activeAssetTab(pathname)
  const editingMap = /\/narrative-assets\/maps\/[^/]+$/.test(pathname)

  return (
    <div className="flex h-[calc(100dvh-5rem)] min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-6rem)]">
      <Tabs
        value={activeTab}
        onValueChange={(value) => navigate(TAB_PATH[value as AssetTab])}
        className="flex min-h-0 flex-1 flex-col"
      >
        {!editingMap && <TabsList className="mt-3 h-auto w-full shrink-0 flex-wrap justify-start gap-1 rounded-lg border border-border/60 bg-card p-1 sm:w-fit">
          <TabsTrigger value="characters" className="h-8 gap-2 rounded-md px-4">
            <UserCircle className="size-4" />
            角色资产
            {characterCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums opacity-70">
                {characterCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="voices" className="h-8 gap-2 rounded-md px-4">
            <Volume2 className="size-4" />
            音色资产
          </TabsTrigger>
          {!isCreator && (
              <TabsTrigger value="maps" className="h-8 gap-2 rounded-md px-4">
                <Map className="size-4" />
                地图世界
                {mapCount > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums opacity-70">
                    {mapCount}
                  </span>
                )}
              </TabsTrigger>
          )}
        </TabsList>}

        <div className={editingMap ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "mt-3 flex min-h-0 flex-1 flex-col overflow-hidden"}>
          <Outlet context={{ setCharacterCount, setMapCount } satisfies NarrativeAssetsContext} />
        </div>
      </Tabs>
    </div>
  )
}

export function NarrativeAssetsCharactersRoute() {
  const { setCharacterCount } = useOutletContext<NarrativeAssetsContext>()
  const reportCharacters = useCallback((characters: GameCharacter[]) => {
    setCharacterCount(characters.length)
  }, [setCharacterCount])
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <CharactersTab onCharactersChange={reportCharacters} />
    </div>
  )
}

export function NarrativeAssetsVoicesRoute() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <VoiceAssetsTab />
    </div>
  )
}

export function NarrativeAssetsMapsRoute() {
  const { session } = useAuth()
  const { setMapCount } = useOutletContext<NarrativeAssetsContext>()
  const reportMaps = useCallback((maps: GameMapData[]) => {
    setMapCount(maps.length)
  }, [setMapCount])
  if (session?.user?.role === 'creator') {
    return <Navigate to="/admin/narrative-assets/characters" replace />
  }
  return (
    <NarrativeMapList onMapsChange={reportMaps} />
  )
}

export function NarrativeAssetsMapEditorRoute() {
  const { session } = useAuth()
  const { mapId } = useParams()
  if (session?.user?.role === 'creator') {
    return <Navigate to="/admin/narrative-assets/characters" replace />
  }
  if (!mapId) {
    return <Navigate to="/admin/narrative-assets/maps" replace />
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NarrativeWorldStudio mapId={mapId} />
    </div>
  )
}
