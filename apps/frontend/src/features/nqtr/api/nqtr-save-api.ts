import { get, put } from '@/lib/request'
import type { NqtrSave, NqtrSaveWrite } from '../model/types'

export type { NqtrSave, NqtrSaveWrite }

export function readNqtrSave(sceneId: string, slot = 1): Promise<NqtrSave | null> {
  return get('/nqtr/saves', { sceneId, slot })
}

export function writeNqtrSave(data: NqtrSaveWrite): Promise<NqtrSave> {
  return put('/nqtr/saves', data)
}
