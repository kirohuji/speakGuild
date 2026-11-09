export type RoomLayout = { x: number; y: number; width: number; height: number }

export type ExplorationObject = {
  id: string
  title: string
  imageUrl?: string | null
  x: number
  y: number
  hidden?: boolean
  interactionType?: string
  targetRoomId?: string | null
}

type MapLike = {
  editorData?: {
    explorationScenes?: Record<string, Record<string, Partial<RoomLayout>>>
    sceneInteractions?: Record<string, ExplorationObject[]>
    explorationObjects?: Record<string, ExplorationObject[]>
  } | null
} | null

export function getRoomLayout(
  map: MapLike,
  locationId: string,
  roomId: string,
  index: number,
): RoomLayout {
  const stored = map?.editorData?.explorationScenes?.[locationId]?.[roomId]
  const legacyDefault = stored?.width === 180 && stored?.height === 120
  return stored && typeof stored === 'object'
    ? {
        x: stored.x ?? 24,
        y: stored.y ?? 28,
        width: legacyDefault ? 10 : (stored.width ?? 10),
        height: legacyDefault ? 10 : (stored.height ?? 10),
      }
    : {
        x: 22 + (index % 3) * 28,
        y: 28 + Math.floor(index / 3) * 30,
        width: 10,
        height: 10,
      }
}

export function getExplorationObjects(map: MapLike, scopeKey: string): ExplorationObject[] {
  const legacyRoomId = scopeKey.startsWith('room:') ? scopeKey.slice('room:'.length) : scopeKey
  const normalizedRoomScope = scopeKey.includes(':') ? scopeKey : `room:${scopeKey}`
  const items =
    map?.editorData?.sceneInteractions?.[scopeKey]
    ?? map?.editorData?.sceneInteractions?.[normalizedRoomScope]
    ?? map?.editorData?.sceneInteractions?.[legacyRoomId]
    ?? map?.editorData?.explorationObjects?.[legacyRoomId]
  if (!Array.isArray(items)) return []
  return items.filter(
    (item): item is ExplorationObject =>
      !!item
      && typeof item === 'object'
      && typeof item.id === 'string'
      && typeof item.title === 'string',
  )
}
