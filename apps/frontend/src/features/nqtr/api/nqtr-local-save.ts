import { readNqtrSave, writeNqtrSave } from './nqtr-save-api'
import type { NqtrSave, NqtrSaveWrite } from '../model/types'

function localKey(sceneId: string, slot = 1) {
  return `nqtr-save:${sceneId}:${slot}`
}

export function readLocalNqtrSave(sceneId: string, slot = 1): NqtrSave | null {
  try {
    const raw = localStorage.getItem(localKey(sceneId, slot))
    if (!raw) return null
    return JSON.parse(raw) as NqtrSave
  } catch {
    return null
  }
}

export function writeLocalNqtrSave(data: NqtrSaveWrite): NqtrSave {
  const save: NqtrSave = { id: `local:${data.sceneId}:${data.slot}`, ...data }
  try {
    localStorage.setItem(localKey(data.sceneId, data.slot), JSON.stringify(save))
  } catch {
    /* quota / private mode */
  }
  return save
}

/** Prefer cloud when online; always keep a local mirror for offline resume. */
export async function readNqtrSaveHybrid(sceneId: string, slot = 1): Promise<NqtrSave | null> {
  try {
    const cloud = await readNqtrSave(sceneId, slot)
    if (cloud) {
      writeLocalNqtrSave({ ...cloud, sceneId: cloud.sceneId || sceneId })
      return cloud
    }
  } catch {
    /* offline or unauthorized */
  }
  return readLocalNqtrSave(sceneId, slot)
}

export async function writeNqtrSaveHybrid(data: NqtrSaveWrite): Promise<NqtrSave> {
  const local = writeLocalNqtrSave(data)
  try {
    const cloud = await writeNqtrSave(data)
    writeLocalNqtrSave({ ...cloud, sceneId: cloud.sceneId || data.sceneId })
    return cloud
  } catch {
    return local
  }
}
