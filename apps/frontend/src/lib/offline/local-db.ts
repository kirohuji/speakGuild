type StoreName =
  | 'kv'
  | 'my_learning_units'
  | 'downloaded_packs'
  | 'downloaded_unit_details'
  | 'ink_scripts'
  | 'dictionary_entries'
  | 'user_progress'
  | 'practice_records'
  | 'local_assets'
  | 'outbox'
  | 'recordings'

const DB_NAME = 'speakguild-offline'
const DB_VERSION = 5

const STORE_NAMES: StoreName[] = [
  'kv',
  'my_learning_units',
  'downloaded_packs',
  'downloaded_unit_details',
  'ink_scripts',
  'dictionary_entries',
  'user_progress',
  'practice_records',
  'local_assets',
  'outbox',
  'recordings',
]

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.reject(new Error('[offline-db] IndexedDB is not available'))
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      // 清理历史版本中已被移除的冗余 store
      for (const deprecated of ['vocabularies', 'chunks', 'sentence_patterns', 'wordbook']) {
        if (db.objectStoreNames.contains(deprecated)) {
          db.deleteObjectStore(deprecated)
        }
      }

      for (const storeName of STORE_NAMES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' })
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('[offline-db] Failed to open database'))
  })

  return dbPromise
}

function tx(storeName: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName))
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const localDb = {
  async get<T>(storeName: StoreName, id: string): Promise<T | null> {
    try {
      const store = await tx(storeName, 'readonly')
      const result = await requestToPromise<T | undefined>(store.get(id))
      return result ?? null
    } catch {
      return null
    }
  },

  async put<T extends { id: string }>(storeName: StoreName, value: T): Promise<void> {
    try {
      const store = await tx(storeName, 'readwrite')
      await requestToPromise(store.put(value))
    } catch (error) {
      console.warn('[offline-db] put failed:', storeName, error)
    }
  },

  async putMany<T extends { id: string }>(storeName: StoreName, values: T[]): Promise<void> {
    if (values.length === 0) return
    try {
      const db = await openDb()
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      for (const value of values) store.put(value)
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    } catch (error) {
      console.warn('[offline-db] putMany failed:', storeName, error)
    }
  },

  async delete(storeName: StoreName, id: string): Promise<void> {
    try {
      const store = await tx(storeName, 'readwrite')
      await requestToPromise(store.delete(id))
    } catch (error) {
      console.warn('[offline-db] delete failed:', storeName, error)
    }
  },

  async list<T>(storeName: StoreName): Promise<T[]> {
    try {
      const store = await tx(storeName, 'readonly')
      return await requestToPromise<T[]>(store.getAll())
    } catch {
      return []
    }
  },

  async deleteWhere<T extends { id: string }>(storeName: StoreName, predicate: (value: T) => boolean): Promise<void> {
    try {
      const readStore = await tx(storeName, 'readonly')
      const values = await requestToPromise<T[]>(readStore.getAll())
      const ids = values.filter(predicate).map((value) => value.id)
      if (ids.length === 0) return
      const db = await openDb()
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      for (const id of ids) store.delete(id)
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    } catch (error) {
      console.warn('[offline-db] deleteWhere failed:', storeName, error)
    }
  },

  async clear(storeName: StoreName): Promise<void> {
    try {
      const store = await tx(storeName, 'readwrite')
      await requestToPromise(store.clear())
    } catch (error) {
      console.warn('[offline-db] clear failed:', storeName, error)
    }
  },

  /** 存入录音 Blob，返回唯一 ID */
  async saveBlob(blob: Blob, meta?: { mimeType?: string; sessionId?: string; round?: number }): Promise<string> {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      const store = await tx('recordings', 'readwrite')
      await requestToPromise(store.put({
        id,
        blob,
        mimeType: meta?.mimeType ?? blob.type,
        sessionId: meta?.sessionId,
        round: meta?.round,
        createdAt: new Date().toISOString(),
      }))
      return id
    } catch (error) {
      console.warn('[offline-db] saveBlob failed:', error)
      throw error
    }
  },

  /** 读取录音 Blob */
  async getBlob(id: string): Promise<{ blob: Blob; mimeType?: string; sessionId?: string; round?: number } | null> {
    try {
      const store = await tx('recordings', 'readonly')
      const record = await requestToPromise<any>(store.get(id))
      if (!record?.blob) return null
      return {
        blob: record.blob instanceof Blob ? record.blob : new Blob([record.blob], { type: record.mimeType }),
        mimeType: record.mimeType,
        sessionId: record.sessionId,
        round: record.round,
      }
    } catch {
      return null
    }
  },

  /** 删除录音 Blob */
  async deleteBlob(id: string): Promise<void> {
    try {
      await this.delete('recordings', id)
    } catch (error) {
      console.warn('[offline-db] deleteBlob failed:', error)
    }
  },
}
