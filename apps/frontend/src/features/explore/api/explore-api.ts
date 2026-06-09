import { get, post } from '@/lib/request'

export interface GameMap {
  id: string; name: string; displayName: string
  backgroundUrl?: string; thumbnailUrl?: string
  locations: LocationPin[]; unlocked: boolean
}

export interface LocationPin {
  id: string; name: string; displayName: string
  posX: number; posY: number; icon?: string; isPreview: boolean
}

export interface LocationDetail {
  id: string; name: string; displayName: string; description?: string
  backgroundUrl?: string; locationType: string
  map: { id: string; name: string; displayName: string }
  npcs: { character: GameCharacter }[]
  exits: { to: { id: string; name: string; displayName: string; icon?: string } }[]
}

export interface GameCharacter {
  id: string; name: string; displayName: string; role: string; personality?: string
  avatarUrl?: string; spriteBaseUrl?: string; expressions?: any
}

export interface GameSave {
  slot: number; saveName: string; playTimeSeconds: number
  currentMapId?: string; currentLocationId?: string
  updatedAt: string; createdAt: string
}

export const exploreApi = {
  getMaps: () => get<GameMap[]>('/explore/maps'),
  getMap: (id: string) => get<GameMap>(`/explore/maps/${id}`),
  getLocation: (id: string) => get<LocationDetail>(`/explore/locations/${id}`),
  getCharacters: () => get<GameCharacter[]>('/explore/characters'),
  getInk: (key: string) => get<{ inkJson: any }>(`/explore/ink/${key}`),
}

export const gameSaveApi = {
  list: () => get<GameSave[]>('/explore/saves'),
  get: (slot: number) => get<any>(`/explore/saves/${slot}`),
  save: (slot: number, data: any) => post(`/explore/saves/${slot}`, data),
  delete: (slot: number) => post(`/explore/saves/${slot}/delete`),
}

export default exploreApi
