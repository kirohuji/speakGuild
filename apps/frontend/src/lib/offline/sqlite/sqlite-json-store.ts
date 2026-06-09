import type { TableName } from './schema'

export interface SqliteJsonExecutor {
  label: string
  queryRows<T>(sql: string, values?: any[]): Promise<T[]>
  run(sql: string, values?: any[], transaction?: boolean): Promise<void>
  execute(sql: string, transaction?: boolean): Promise<void>
  afterWrite?(): Promise<void>
}

export function createSqliteJsonStore(executor: SqliteJsonExecutor) {
  let writeQueue = Promise.resolve()

  async function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const run = writeQueue.then(operation, operation)
    writeQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async function write(sql: string, values: any[] = []): Promise<void> {
    await enqueueWrite(async () => {
      await executor.run(sql, values)
      await executor.afterWrite?.()
    })
  }

  return {
    async get<T>(storeName: TableName, id: string): Promise<T | null> {
      try {
        const rows = await executor.queryRows<{ data: string }>(
          `SELECT data FROM "${storeName}" WHERE id = ?`,
          [id],
        )
        if (rows.length === 0) return null
        return JSON.parse(rows[0].data) as T
      } catch (error) {
        console.warn(`[${executor.label}] get failed for ${storeName}:${id}`, error)
        return null
      }
    },

    async put<T>(storeName: TableName, value: T & { id: string }): Promise<void> {
      try {
        await write(
          `INSERT INTO "${storeName}" (id, data, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
          [value.id, JSON.stringify(value), new Date().toISOString()],
        )
      } catch (error) {
        console.warn(`[${executor.label}] put failed for ${storeName}:${value.id}`, error)
        throw error
      }
    },

    async putMany<T>(storeName: TableName, values: (T & { id: string })[]): Promise<void> {
      if (values.length === 0) return
      try {
        await enqueueWrite(async () => {
          for (const value of values) {
            await executor.run(
              `INSERT INTO "${storeName}" (id, data, updated_at) VALUES (?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
              [value.id, JSON.stringify(value), new Date().toISOString()],
            )
          }
          await executor.afterWrite?.()
        })
      } catch (error) {
        console.warn(`[${executor.label}] putMany failed for ${storeName}`, error)
        throw error
      }
    },

    async delete(storeName: TableName, id: string): Promise<void> {
      try {
        await write(`DELETE FROM "${storeName}" WHERE id = ?`, [id])
      } catch (error) {
        console.warn(`[${executor.label}] delete failed for ${storeName}:${id}`, error)
      }
    },

    async list<T>(storeName: TableName): Promise<T[]> {
      try {
        const rows = await executor.queryRows<{ data: string }>(
          `SELECT data FROM "${storeName}" ORDER BY updated_at DESC`,
        )
        return rows.map((row) => JSON.parse(row.data) as T)
      } catch (error) {
        console.warn(`[${executor.label}] list failed for ${storeName}`, error)
        return []
      }
    },

    async count(storeName: TableName): Promise<number> {
      try {
        const rows = await executor.queryRows<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM "${storeName}"`,
        )
        return rows[0]?.cnt ?? 0
      } catch {
        return 0
      }
    },

    async clear(storeName: TableName): Promise<void> {
      try {
        await write(`DELETE FROM "${storeName}"`)
      } catch (error) {
        console.warn(`[${executor.label}] clear failed for ${storeName}`, error)
      }
    },

    async deleteWhere<T>(
      storeName: TableName,
      predicate: (value: T & { id: string }) => boolean,
    ): Promise<void> {
      try {
        const rows = await executor.queryRows<{ data: string }>(
          `SELECT data FROM "${storeName}" ORDER BY updated_at DESC`,
        )
        const ids = rows
          .map((row) => JSON.parse(row.data) as T & { id: string })
          .filter(predicate)
          .map((value) => value.id)

        if (ids.length === 0) return

        await enqueueWrite(async () => {
          for (const id of ids) {
            await executor.run(`DELETE FROM "${storeName}" WHERE id = ?`, [id])
          }
          await executor.afterWrite?.()
        })
      } catch (error) {
        console.warn(`[${executor.label}] deleteWhere failed for ${storeName}`, error)
      }
    },
  }
}
