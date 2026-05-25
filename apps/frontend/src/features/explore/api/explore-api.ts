import axios from 'axios'
import { getBearerToken } from '@/features/auth/client'

const api = axios.create({ baseURL: '/api/v1', timeout: 15000, headers: { 'Content-Type': 'application/json' } })
api.interceptors.request.use((c) => { const t = getBearerToken(); if (t) c.headers.Authorization = `Bearer ${t}`; return c })
api.interceptors.response.use(
  (r) => (r.data && typeof r.data === 'object' && 'data' in r.data ? r.data.data : r.data),
  (e) => Promise.reject(e),
)

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
  getMaps: () => api.get<any, GameMap[]>('/explore/maps'),
  getMap: (id: string) => api.get<any, GameMap>(`/explore/maps/${id}`),
  getLocation: (id: string) => api.get<any, LocationDetail>(`/explore/locations/${id}`),
  getCharacters: () => api.get<any, GameCharacter[]>('/explore/characters'),
  getInk: (key: string) => api.get<any, { inkJson: any }>(`/explore/ink/${key}`),
}

export const gameSaveApi = {
  list: () => api.get<any, GameSave[]>('/explore/saves'),
  get: (slot: number) => api.get<any, any>(`/explore/saves/${slot}`),
  save: (slot: number, data: any) => api.post(`/explore/saves/${slot}`, data),
  delete: (slot: number) => api.post(`/explore/saves/${slot}/delete`),
}

export default api
