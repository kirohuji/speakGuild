import { readNqtrSave, writeNqtrSave } from './nqtr-save-api'
import type { NqtrSave, NqtrSaveWrite } from '../model/types'

type LocalNqtrSave = NqtrSave & {
  /** 本机写入时间，用于后台和云端合并时判断谁更新。 */
  clientUpdatedAt?: string
  updatedAt?: string
}

function localKey(sceneId: string, slot = 1) {
  return `nqtr-save:${sceneId}:${slot}`
}

function stamp(data: NqtrSaveWrite): LocalNqtrSave {
  return {
    id: `local:${data.sceneId}:${data.slot}`,
    ...data,
    clientUpdatedAt: new Date().toISOString(),
  }
}

function parseTime(value?: string | null) {
  if (!value) return 0
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

export function readLocalNqtrSave(sceneId: string, slot = 1): LocalNqtrSave | null {
  try {
    const raw = localStorage.getItem(localKey(sceneId, slot))
    if (!raw) return null
    return JSON.parse(raw) as LocalNqtrSave
  } catch {
    return null
  }
}

export function writeLocalNqtrSave(data: NqtrSaveWrite): LocalNqtrSave {
  const save = stamp(data)
  try {
    localStorage.setItem(localKey(data.sceneId, data.slot), JSON.stringify(save))
  } catch {
    /* quota / private mode */
  }
  return save
}

function mirrorCloudSave(cloud: NqtrSave & { updatedAt?: string }, sceneId: string) {
  const save: LocalNqtrSave = {
    ...cloud,
    sceneId: cloud.sceneId || sceneId,
    clientUpdatedAt: cloud.updatedAt || new Date().toISOString(),
  }
  try {
    localStorage.setItem(localKey(sceneId, cloud.slot || 1), JSON.stringify(save))
  } catch {
    /* quota / private mode */
  }
  return save
}

/** 有本地档就先用；云端只在后台软同步。冷启动无本地时才拉一次云端。 */
async function pullCloudSaveInBackground(sceneId: string, slot: number) {
  try {
    const cloud = await readNqtrSave(sceneId, slot) as (NqtrSave & { updatedAt?: string }) | null
    if (!cloud) return
    const local = readLocalNqtrSave(sceneId, slot)
    const cloudAt = parseTime(cloud.updatedAt)
    const localAt = parseTime(local?.clientUpdatedAt || local?.updatedAt)
    if (!local || cloudAt > localAt) {
      mirrorCloudSave(cloud, sceneId)
    }
  } catch {
    /* offline / unauthorized — keep local */
  }
}

/** Local-first read: play never waits on the server when a local mirror exists. */
export async function readNqtrSaveHybrid(sceneId: string, slot = 1): Promise<NqtrSave | null> {
  const local = readLocalNqtrSave(sceneId, slot)
  if (local) {
    void pullCloudSaveInBackground(sceneId, slot)
    return local
  }
  try {
    const cloud = await readNqtrSave(sceneId, slot) as (NqtrSave & { updatedAt?: string }) | null
    if (cloud) return mirrorCloudSave(cloud, sceneId)
  } catch {
    /* offline or unauthorized */
  }
  return null
}

/** Local-first write: persist immediately, sync cloud in the background. */
export async function writeNqtrSaveHybrid(data: NqtrSaveWrite): Promise<NqtrSave> {
  const local = writeLocalNqtrSave(data)
  void writeNqtrSave(data)
    .then((cloud) => {
      mirrorCloudSave({ ...cloud, updatedAt: (cloud as NqtrSave & { updatedAt?: string }).updatedAt }, data.sceneId)
    })
    .catch(() => undefined)
  return local
}
