import type { TableName } from './schema'

export interface SqliteJsonExecutor {
  label: string
  queryRows<T>(sql: string, values?: any[]): Promise<T[]>
  run(sql: string, values?: any[], transaction?: boolean): Promise<void>
  runMany?(statements: Array<{ sql: string; values: any[] }>, transaction?: boolean): Promise<void>
  execute(sql: string, transaction?: boolean): Promise<void>
  afterWrite?(): Promise<void>
}

type ColumnExtractor = [columnName: string, jsonKey: string, extract: (value: any) => any]

const SQL_BATCH_SIZE = 250

const COLUMN_EXTRACTORS: Partial<Record<TableName, ColumnExtractor[]>> = {
  downloaded_packs: [
    ['pack_id', 'packId', (value) => value?.packId ?? value?.id ?? null],
    ['status', 'status', (value) => value?.status ?? null],
    ['version', 'version', (value) => typeof value?.version === 'number' ? value.version : null],
    ['title', 'title', (value) => value?.title ?? null],
    ['installed_at', 'installedAt', (value) => value?.installedAt ?? null],
  ],
  downloaded_unit_details: [
    ['unit_id', 'unitId', (value) => value?.unitId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
  ],
  ink_scripts: [
    ['unit_id', 'unitId', (value) => value?.unitId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
  ],
  expression_entries: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['kind', 'kind', (value) => value?.kind ?? null],
    ['expression_type', 'type', (value) => value?.type ?? null],
    ['mastery_status', 'masteryStatus', (value) => value?.masteryStatus ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
  ],
  learning_notebooks: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['notebook_kind', 'kind', (value) => value?.kind ?? null],
    ['sort_order', 'sortOrder', (value) => typeof value?.sortOrder === 'number' ? value.sortOrder : null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
  ],
  learning_notebook_items: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['notebook_id', 'notebookId', (value) => value?.notebookId ?? null],
    ['expression_entry_id', 'expressionEntryId', (value) => value?.expressionEntryId ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
  ],
  offline_vocabularies: [
    ['word', 'word', (value) => value?.word ?? null],
    ['normalized_text', 'normalizedText', (value) => value?.normalizedText ?? null],
  ],
  offline_chunks: [
    ['text', 'text', (value) => value?.text ?? null],
    ['normalized_text', 'normalizedText', (value) => value?.normalizedText ?? null],
  ],
  offline_patterns: [
    ['pattern', 'pattern', (value) => value?.pattern ?? null],
    ['normalized_text', 'normalizedText', (value) => value?.normalizedText ?? null],
  ],
  offline_content_refs: [
    ['content_kind', 'kind', (value) => value?.kind ?? null],
    ['content_id', 'contentId', (value) => value?.contentId ?? null],
    ['pack_id', 'packId', (value) => value?.packId ?? null],
    ['unit_id', 'unitId', (value) => value?.unitId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
  ],
  user_progress: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['progress_type', 'type', (value) => value?.type ?? null],
    ['scene_id', 'sceneId', (value) => value?.sceneId ?? null],
    ['chunk_id', 'chunkId', (value) => value?.chunkId ?? null],
    ['session_id', 'sessionId', (value) => value?.sessionId ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
  ],
  practice_records: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['record_type', 'type', (value) => value?.type ?? null],
    ['session_id', 'sessionId', (value) => value?.sessionId ?? null],
    ['local_session_id', 'localSessionId', (value) => value?.localSessionId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
    ['scene_id', 'sceneId', (value) => value?.sceneId ?? null],
    ['status', 'status', (value) => value?.status ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
  ],
  warmup_records: [
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
    ['topic_title', 'topicTitle', (value) => value?.topicTitle ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
    ['created_at', 'createdAt', (value) => value?.createdAt ?? null],
  ],
  warmup_record_entries: [
    ['record_id', 'recordId', (value) => value?.recordId ?? null],
    ['step_id', 'stepId', (value) => value?.stepId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
    ['practiced_date', 'practicedDate', (value) => value?.practicedDate ?? null],
    ['record_updated_at', 'recordUpdatedAt', (value) => value?.recordUpdatedAt ?? null],
  ],
  daily_practice_items: [
    ['item_id', 'itemId', (value) => value?.itemId ?? value?.id ?? null],
    ['pack_id', 'packId', (value) => value?.packId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
    ['item_type', 'type', (value) => value?.type ?? null],
    ['status', 'status', (value) => value?.status ?? null],
    ['due_date', 'dueDate', (value) => value?.dueDate ?? null],
  ],
  daily_practice_runs: [
    ['date', 'date', (value) => value?.date ?? null],
    ['scope', 'scope', (value) => value?.scope ?? null],
    ['pack_ids', 'packIdsKey', (value) => Array.isArray(value?.packIds) ? value.packIds.join(',') : null],
  ],
  daily_practice_attempts: [
    ['item_id', 'itemId', (value) => value?.itemId ?? null],
    ['pack_id', 'packId', (value) => value?.packId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
    ['practiced_at', 'practicedAt', (value) => value?.practicedAt ?? null],
  ],
  warmup_embedding_refs: [
    ['model_key', 'modelKey', (value) => value?.modelKey ?? null],
    ['reference_key', 'referenceKey', (value) => value?.referenceKey ?? null],
    ['source', 'source', (value) => value?.source ?? null],
    ['pack_id', 'packId', (value) => value?.packId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
    ['last_used_at', 'lastUsedAt', (value) => value?.lastUsedAt ?? null],
  ],
  local_assets: [
    ['asset_id', 'assetId', (value) => value?.assetId ?? value?.id ?? null],
    ['remote_url', 'remoteUrl', (value) => value?.remoteUrl ?? null],
    ['status', 'status', (value) => value?.status ?? null],
    ['mime_type', 'mimeType', (value) => value?.mimeType ?? null],
  ],
  outbox: [
    ['entity_type', 'entityType', (value) => value?.entityType ?? null],
    ['entity_id', 'entityId', (value) => value?.entityId ?? null],
    ['operation', 'operation', (value) => value?.operation ?? null],
    ['status', 'status', (value) => value?.status ?? null],
    ['client_mutation_id', 'clientMutationId', (value) => value?.clientMutationId ?? null],
    ['retry_count', 'retryCount', (value) => typeof value?.retryCount === 'number' ? value.retryCount : null],
    ['created_at', 'createdAt', (value) => value?.createdAt ?? null],
  ],
  asset_refs: [
    ['sha256', 'sha256', (value) => value?.sha256 ?? null],
    ['pack_id', 'packId', (value) => value?.packId ?? null],
    ['logical_path', 'logicalPath', (value) => value?.logicalPath ?? null],
    ['ext', 'ext', (value) => value?.ext ?? null],
  ],
}

// Indexed columns are the source of truth for stable sync/cache keys. They are
// stripped from data on write and hydrated back on read to keep repository
// objects unchanged without duplicating core fields inside JSON payloads.
function metadataFor(storeName: TableName, value: any) {
  const extractors = COLUMN_EXTRACTORS[storeName] ?? []
  return {
    columns: extractors.map(([column]) => column),
    values: extractors.map(([, , extract]) => extract(value)),
    jsonKeys: extractors.map(([, jsonKey]) => jsonKey),
  }
}

function jsonDataFor(storeName: TableName, value: any) {
  const metadata = metadataFor(storeName, value)
  const data = { ...value }
  delete data.id
  for (const key of metadata.jsonKeys) {
    delete data[key]
  }
  return data
}

function hydrateRow<T>(storeName: TableName, row: Record<string, any>): T {
  const value = JSON.parse(row.data) as Record<string, any>
  value.id = row.id
  for (const [columnName, jsonKey] of COLUMN_EXTRACTORS[storeName] ?? []) {
    if (row[columnName] !== null && row[columnName] !== undefined) {
      value[jsonKey] = row[columnName]
    }
  }
  return value as T
}

function upsertSql(storeName: TableName, metadataColumns: string[]) {
  const columns = ['id', ...metadataColumns, 'data', 'updated_at']
  const placeholders = columns.map(() => '?').join(', ')
  const updates = columns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = excluded.${column}`)
    .join(', ')

  return `INSERT INTO "${storeName}" (${columns.join(', ')}) VALUES (${placeholders})
          ON CONFLICT(id) DO UPDATE SET ${updates}`
}

function assertIndexedColumn(storeName: TableName, columnName: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(columnName)) {
    throw new Error(`Unsafe SQLite column name: ${columnName}`)
  }
  const allowed = new Set(['id', 'updated_at', ...(COLUMN_EXTRACTORS[storeName] ?? []).map(([column]) => column)])
  if (!allowed.has(columnName)) {
    throw new Error(`Column ${columnName} is not declared for indexed lookup on ${storeName}`)
  }
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
          `SELECT * FROM "${storeName}" WHERE id = ?`,
          [id],
        )
        if (rows.length === 0) return null
        return hydrateRow<T>(storeName, rows[0] as any)
      } catch (error) {
        console.warn(`[${executor.label}] get failed for ${storeName}:${id}`, error)
        return null
      }
    },

    async put<T>(storeName: TableName, value: T & { id: string }): Promise<void> {
      try {
        const metadata = metadataFor(storeName, value)
        const data = jsonDataFor(storeName, value)
        await write(
          upsertSql(storeName, metadata.columns),
          [value.id, ...metadata.values, JSON.stringify(data), new Date().toISOString()],
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
          const statements = values.map((value) => {
            const metadata = metadataFor(storeName, value)
            const data = jsonDataFor(storeName, value)
            return {
              sql: upsertSql(storeName, metadata.columns),
              values: [value.id, ...metadata.values, JSON.stringify(data), new Date().toISOString()],
            }
          })

          if (executor.runMany && statements.length > 1) {
            for (let i = 0; i < statements.length; i += SQL_BATCH_SIZE) {
              await executor.runMany(statements.slice(i, i + SQL_BATCH_SIZE), true)
            }
          } else {
            for (const statement of statements) {
              await executor.run(statement.sql, statement.values)
            }
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
        const rows = await executor.queryRows<Record<string, any>>(
          `SELECT * FROM "${storeName}" ORDER BY updated_at DESC`,
        )
        return rows.map((row) => hydrateRow<T>(storeName, row))
      } catch (error) {
        console.warn(`[${executor.label}] list failed for ${storeName}`, error)
        return []
      }
    },

    async findByIndex<T>(
      storeName: TableName,
      columnName: string,
      value: string | number | null,
    ): Promise<T[]> {
      try {
        assertIndexedColumn(storeName, columnName)
        const rows = await executor.queryRows<Record<string, any>>(
          `SELECT * FROM "${storeName}" WHERE ${columnName} ${value === null ? 'IS NULL' : '= ?'} ORDER BY updated_at DESC`,
          value === null ? [] : [value],
        )
        return rows.map((row) => hydrateRow<T>(storeName, row))
      } catch (error) {
        console.warn(`[${executor.label}] findByIndex failed for ${storeName}.${columnName}`, error)
        return []
      }
    },

    async findByIndexIn<T>(
      storeName: TableName,
      columnName: string,
      values: Array<string | number>,
    ): Promise<T[]> {
      const uniqueValues = [...new Set(values)]
      if (uniqueValues.length === 0) return []

      try {
        assertIndexedColumn(storeName, columnName)
        const rows: Record<string, any>[] = []
        for (let i = 0; i < uniqueValues.length; i += SQL_BATCH_SIZE) {
          const chunk = uniqueValues.slice(i, i + SQL_BATCH_SIZE)
          rows.push(...await executor.queryRows<Record<string, any>>(
            `SELECT * FROM "${storeName}" WHERE ${columnName} IN (${chunk.map(() => '?').join(', ')}) ORDER BY updated_at DESC`,
            chunk,
          ))
        }
        return rows.map((row) => hydrateRow<T>(storeName, row))
      } catch (error) {
        console.warn(`[${executor.label}] findByIndexIn failed for ${storeName}.${columnName}`, error)
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

    async deleteByIndex(storeName: TableName, columnName: string, value: string | number | null): Promise<void> {
      try {
        assertIndexedColumn(storeName, columnName)
        await write(
          `DELETE FROM "${storeName}" WHERE ${columnName} ${value === null ? 'IS NULL' : '= ?'}`,
          value === null ? [] : [value],
        )
      } catch (error) {
        console.warn(`[${executor.label}] deleteByIndex failed for ${storeName}.${columnName}`, error)
      }
    },

    async deleteWhere<T>(
      storeName: TableName,
      predicate: (value: T & { id: string }) => boolean,
    ): Promise<void> {
      try {
        const rows = await executor.queryRows<Record<string, any>>(
          `SELECT * FROM "${storeName}" ORDER BY updated_at DESC`,
        )
        const ids = rows
          .map((row) => hydrateRow<T & { id: string }>(storeName, row))
          .filter(predicate)
          .map((value) => value.id)

        if (ids.length === 0) return

        await enqueueWrite(async () => {
          for (let i = 0; i < ids.length; i += SQL_BATCH_SIZE) {
            const chunk = ids.slice(i, i + SQL_BATCH_SIZE)
            await executor.run(
              `DELETE FROM "${storeName}" WHERE id IN (${chunk.map(() => '?').join(', ')})`,
              chunk,
            )
          }
          await executor.afterWrite?.()
        })
      } catch (error) {
        console.warn(`[${executor.label}] deleteWhere failed for ${storeName}`, error)
      }
    },
  }
}
