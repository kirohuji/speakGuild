import { projectStatisticsRuns } from '../statistics-projection'
import type { TableName } from './schema'

export interface SqliteJsonExecutor {
  label: string
  queryRows<T>(sql: string, values?: any[]): Promise<T[]>
  run(sql: string, values?: any[], transaction?: boolean): Promise<void>
  runMany?(statements: Array<{ sql: string; values: any[] }>, transaction?: boolean): Promise<void>
  execute(sql: string, transaction?: boolean): Promise<void>
  afterWrite?(): Promise<void>
}

export interface NotebookExpressionPageQuery {
  notebookId: string
  kind: 'word' | 'chunk' | 'pattern'
  reviewState?: string
  search?: string
  limit: number
  offset?: number
}

export interface NotebookExpressionPage {
  items: Array<{ item: Record<string, any>; entry: Record<string, any> }>
  total: number
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
    ['row_kind', 'rowKind', (value) => value?.rowKind ?? null],
    ['sort_order', 'sortOrder', (value) => typeof value?.sortOrder === 'number' ? value.sortOrder : null],
  ],
  ink_scripts: [
    ['unit_id', 'unitId', (value) => value?.unitId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
  ],
  expression_entries: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['kind', 'kind', (value) => value?.kind ?? null],
    ['expression_type', 'type', (value) => value?.type ?? null],
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
    ['mastery_status', 'masteryStatus', (value) => value?.masteryStatus ?? null],
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
    ['sort_order', 'sortOrder', (value) => typeof value?.sortOrder === 'number' ? value.sortOrder : null],
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
    ['practiced_at', 'practicedAt', (value) => value?.practicedAt ?? value?.record?.analyzedAt ?? value?.record?.lastPracticeAt ?? null],
  ],
  script_practice_records: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['episode_id', 'episodeId', (value) => value?.episodeId ?? value?.record?.episodeId ?? null],
    ['mode', 'mode', (value) => value?.mode ?? value?.record?.mode ?? null],
    ['status', 'status', (value) => value?.status ?? value?.record?.status ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
    ['client_mutation_id', 'clientMutationId', (value) => value?.clientMutationId ?? null],
    ['created_at', 'createdAt', (value) => value?.createdAt ?? value?.record?.createdAt ?? null],
  ],
  script_works: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['episode_id', 'episodeId', (value) => value?.episodeId ?? value?.work?.episodeId ?? null],
    ['record_id', 'recordId', (value) => value?.recordId ?? value?.work?.recordId ?? null],
    ['kind', 'kind', (value) => value?.kind ?? value?.work?.kind ?? null],
    ['status', 'status', (value) => value?.status ?? value?.work?.status ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
    ['created_at', 'createdAt', (value) => value?.createdAt ?? value?.work?.createdAt ?? null],
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
    ['run_id', 'runId', (value) => value?.runId ?? null],
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
  topic_sessions: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['topic_id', 'topicId', (value) => value?.topicId ?? null],
    ['scene_id', 'sceneId', (value) => value?.sceneId ?? null],
    ['status', 'status', (value) => value?.status ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
  ],
  topic_submissions: [
    ['remote_id', 'remoteId', (value) => value?.remoteId ?? null],
    ['session_id', 'sessionId', (value) => value?.sessionId ?? null],
    ['revision', 'revision', (value) => typeof value?.revision === 'number' ? value.revision : null],
    ['status', 'status', (value) => value?.status ?? null],
    ['sync_status', 'syncStatus', (value) => value?.syncStatus ?? null],
  ],
  local_assets: [
    ['asset_id', 'assetId', (value) => value?.assetId ?? value?.id ?? null],
    ['remote_url', 'remoteUrl', (value) => value?.remoteUrl ?? null],
    ['status', 'status', (value) => value?.status ?? null],
    ['mime_type', 'mimeType', (value) => value?.mimeType ?? null],
  ],
  pack_events: [
    ['pack_id', 'packId', (value) => value?.packId ?? null],
    ['action', 'action', (value) => value?.action ?? null],
    ['version', 'version', (value) => typeof value?.version === 'number' ? value.version : null],
    ['previous_version', 'previousVersion', (value) => typeof value?.previousVersion === 'number' ? value.previousVersion : null],
    ['occurred_at', 'occurredAt', (value) => value?.occurredAt ?? null],
  ],
  outbox: [
    ['entity_type', 'entityType', (value) => value?.entityType ?? null],
    ['entity_id', 'entityId', (value) => value?.entityId ?? null],
    ['operation', 'operation', (value) => value?.operation ?? null],
    ['status', 'status', (value) => value?.status ?? null],
    ['next_retry_at', 'nextRetryAt', (value) => value?.nextRetryAt ?? value?.createdAt ?? '1970-01-01T00:00:00.000Z'],
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
  deferred_pack_assets: [
    ['pack_id', 'packId', (value) => value?.packId ?? null],
    ['lookup_key', 'lookupKey', (value) => value?.lookupKey ?? null],
    ['file_asset_id', 'fileAssetId', (value) => value?.fileAssetId ?? null],
    ['source_zip_version', 'sourceZipVersion', (value) => typeof value?.sourceZipVersion === 'number' ? value.sourceZipVersion : null],
    ['sha256', 'sha256', (value) => value?.sha256 ?? null],
    ['status', 'status', (value) => value?.status ?? null],
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

export type PageFilter = { column: string; value: string | number | null | Array<string | number> }
export type PageQuery = {
  filters?: PageFilter[]
  orderBy?: Array<{ column: string; direction: 'asc' | 'desc' }>
  limit: number
  offset?: number
}

const MAX_PAGE_SIZE = 100

function assertPageBounds(limit: number, offset: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error(`Page limit must be an integer from 1 to ${MAX_PAGE_SIZE}`)
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Page offset must be a non-negative integer')
  }
}

function whereClause(storeName: TableName, filters: PageFilter[] = []) {
  const clauses: string[] = []
  const values: Array<string | number> = []
  for (const filter of filters) {
    assertIndexedColumn(storeName, filter.column)
    if (Array.isArray(filter.value)) {
      if (filter.value.length === 0) return { sql: '1 = 0', values: [] }
      clauses.push(`"${filter.column}" IN (${filter.value.map(() => '?').join(', ')})`)
      values.push(...filter.value)
      continue
    }
    if (filter.value === null) {
      clauses.push(`"${filter.column}" IS NULL`)
      continue
    }
    clauses.push(`"${filter.column}" = ?`)
    values.push(filter.value)
  }
  return { sql: clauses.length > 0 ? clauses.join(' AND ') : '1 = 1', values }
}

function orderClause(storeName: TableName, orderBy: PageQuery['orderBy'] = []) {
  const clauses = orderBy.map((order) => {
    assertIndexedColumn(storeName, order.column)
    if (order.direction !== 'asc' && order.direction !== 'desc') {
      throw new Error(`Unsupported sort direction: ${order.direction}`)
    }
    return `"${order.column}" ${order.direction.toUpperCase()}`
  })
  if (!clauses.some((clause) => clause.startsWith('"id" '))) clauses.push('"id" ASC')
  return clauses.join(', ')
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

  async function atomic(statements: Array<{ sql: string; values: any[] }>) {
    if (!statements.length) return
    await enqueueWrite(async () => {
      if (!executor.runMany) throw new Error('Atomic SQLite batch support is required')
      await executor.runMany(statements, true)
      await executor.afterWrite?.()
    })
  }
  function upsertRow(table: TableName, value: any) {
    const metadata = metadataFor(table, value)
    return { sql: upsertSql(table, metadata.columns), values: [value.id, ...metadata.values, JSON.stringify(jsonDataFor(table, value)), new Date().toISOString()] }
  }
  function outboxStatement(id: string, entityType: string, entityId: string, operation: string, payload: any) {
    const now = new Date().toISOString()
    const value = { id, entityType, entityId, operation, payload, clientMutationId: id, revision: 1, status: 'pending', retryCount: 0, createdAt: now, updatedAt: now, nextRetryAt: now }
    const statement = upsertRow('outbox', value)
    const incoming = `CASE WHEN json_array_length(json_extract(excluded.data,'$.payload.attempts'))=0 AND json_array_length(json_extract(outbox.data,'$.payload.attempts'))>0 THEN json_remove(json_extract(excluded.data,'$.payload'),'$.attempts') ELSE json_extract(excluded.data,'$.payload') END`
    let payloadMerge = `json_patch(CASE WHEN outbox.status='synced' THEN '{}' ELSE coalesce(json_extract(outbox.data,'$.payload'),'{}') END, ${incoming})`
    if (entityType === 'daily_practice') {
      // Immutable events survive a slower facts-only snapshot or an in-flight acknowledgement.
      const events = `(SELECT coalesce(json_group_array(json(event)),'[]') FROM (
        SELECT value AS event FROM json_each(outbox.data,'$.payload.run.attemptHistory') WHERE outbox.status != 'synced'
        UNION SELECT value AS event FROM json_each(excluded.data,'$.payload.run.attemptHistory')))`
      payloadMerge = `json_set(${payloadMerge}, '$.run.attemptHistory', json(${events}))`
      const mergeItems = (path: string, identity: string, rank: string) => `(SELECT coalesce(json_group_array(json(item)),'[]') FROM (
        SELECT item FROM (SELECT item,incoming,position,ROW_NUMBER() OVER (
          PARTITION BY json_extract(item,'$.${identity}') ORDER BY ${rank} DESC,incoming DESC) AS priority FROM (
            SELECT value AS item,0 AS incoming,CAST(key AS INTEGER) AS position FROM json_each(outbox.data,'$.payload.${path}') WHERE outbox.status!='synced'
            UNION ALL SELECT value AS item,1 AS incoming,CAST(key AS INTEGER) AS position FROM json_each(excluded.data,'$.payload.${path}')
        )) WHERE priority=1 ORDER BY incoming DESC,position
      ))`
      const attempts = mergeItems('attempts', 'clientAttemptId', '0')
      payloadMerge = `json_set(${payloadMerge}, '$.attempts', json(${attempts}))`
      const items = mergeItems('warmupRecord.items', 'stepId', "coalesce(json_extract(item,'$.practiceCount'),0)")
      payloadMerge = `CASE WHEN json_type(${payloadMerge},'$.warmupRecord')='object'
        THEN json_set(${payloadMerge},'$.warmupRecord.items',json(${items})) ELSE ${payloadMerge} END`
    }
    statement.sql = statement.sql.replace(/ON CONFLICT\(id\) DO UPDATE SET[\s\S]*/, `ON CONFLICT(id) DO UPDATE SET
      status='pending', next_retry_at=excluded.next_retry_at, updated_at=excluded.updated_at,
      data=json_set(excluded.data, '$.revision', coalesce(json_extract(outbox.data,'$.revision'),0)+1,
        '$.payload', ${payloadMerge})`)

    return statement
  }

  return {
    async applyStatisticsRuns(runs: any[]) {
      const statements = projectStatisticsRuns(runs)
      // Bound the native bridge payload during initial history restoration.
      for (let i = 0; i < statements.length; i += SQL_BATCH_SIZE) await atomic(statements.slice(i, i + SQL_BATCH_SIZE))
    },
    async saveDailyPracticeOutbox(entityId: string, operation: string, payload: any) {
      await atomic([outboxStatement(`daily-practice:${entityId}`, 'daily_practice', entityId, operation, payload)])
    },
    async patchOutbox(id: string, revision: number, status: 'synced' | 'failed', error?: string, retryAt?: string) {
      return enqueueWrite(async () => {
        const now = new Date().toISOString()
        await executor.run(`UPDATE outbox SET status=?,updated_at=?,next_retry_at=COALESCE(?,next_retry_at),
          retry_count=coalesce(retry_count,0)+?,data=json_set(data,'$.status',?,'$.updatedAt',?,'$.syncedAt',?,
          '$.lastError',?,'$.nextRetryAt',COALESCE(?,next_retry_at),'$.retryCount',coalesce(retry_count,0)+?)
          WHERE id=? AND json_extract(data,'$.revision')=?`,
          [status,now,retryAt ?? null,status==='failed'?1:0,status,now,status==='synced'?now:null,error ?? null,retryAt ?? null,status==='failed'?1:0,id,revision])
        await executor.afterWrite?.()
        const rows = await executor.queryRows<any>("SELECT status,json_extract(data,'$.revision') AS revision FROM outbox WHERE id=?", [id])
        return rows[0]?.status===status && rows[0]?.revision===revision
      })
    },
    async saveRunFacts(run: any, payload: any, warmup?: any) {
      await atomic([...(warmup ? [upsertRow('warmup_records', warmup)] : []), upsertRow('daily_practice_runs', run), outboxStatement(`daily-practice:${run.id}`, 'daily_practice', run.id, 'update', payload)])
    },
    async saveLearningActivity(record: { date: string; sourceId: string; scope: string; activeSeconds: number }) {
      const projection = projectStatisticsRuns([{ date: record.date, stats: { activity: { [record.sourceId]: record } } }])
      await atomic([...projection, outboxStatement(`learning-activity:${record.date}:${record.sourceId}`, 'learning_activity', `${record.date}:${record.sourceId}`, 'snapshot', { ...record, questionCount: 0 })])
    },
    async readLearningStatistics(start: string, end: string, today: string) {
      // Serialize with writes so the visible range and cumulative counters agree.
      return enqueueWrite(async () => {
        const [days, totals, streak] = await Promise.all([
          executor.queryRows<any>('SELECT id AS date, question_count AS questionCount, active_seconds AS activeSeconds, 1 AS active FROM learning_stat_days WHERE id >= ? AND id <= ? AND (question_count > 0 OR active_seconds > 0) ORDER BY id', [start, end]),
          executor.queryRows<any>("SELECT * FROM learning_stat_totals WHERE id='total'"),
          // Index probes stop at the first missing date, without loading history.
          executor.queryRows<any>(`WITH RECURSIVE streak(day,n) AS (
            SELECT CASE WHEN EXISTS(SELECT 1 FROM learning_stat_days WHERE id=? AND (question_count>0 OR active_seconds>0)) THEN ? ELSE date(?,'-1 day') END, 0
            UNION ALL SELECT date(day,'-1 day'), n+1 FROM streak WHERE EXISTS(
              SELECT 1 FROM learning_stat_days WHERE id=streak.day AND (question_count>0 OR active_seconds>0))
          ) SELECT MAX(n) AS count FROM streak`, [today, today, today]),
        ])
        const total = totals[0] ?? {}
        return { dailyStats: days.map(day => ({ ...day, active: Boolean(day.active) })), activeDays: total.active_days ?? 0,
          uniqueQuestionsAnswered: total.unique_questions ?? 0, activeSeconds: total.active_seconds ?? 0,
          avgDailyQuestions: total.active_days ? Math.round(total.question_days / total.active_days) : 0,
          currentStreakDays: streak[0]?.count ?? 0, favoriteCount: total.favorite_count ?? 0, wordCount: total.word_count ?? 0 }
      })
    },
    async pruneSyncedOutbox(before: string) {
      await write("DELETE FROM outbox WHERE status='synced' AND updated_at < ?", [before])
    },
    async listDueOutbox(now: string, limit: number, types?: string[]) {
      const typeClause = types?.length ? ` AND entity_type IN (${types.map(() => '?').join(',')})` : ''
      const rows = await executor.queryRows<any>(`SELECT * FROM outbox WHERE status IN ('pending','failed') AND next_retry_at <= ?${typeClause} ORDER BY next_retry_at,id LIMIT ?`, [now, ...(types ?? []), limit])
      return rows.map(row => hydrateRow('outbox', row))
    },
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
        throw error
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
        throw error
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
        throw error
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
        throw error
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
        throw error
      }
    },

    async listPage<T>(storeName: TableName, query: PageQuery): Promise<T[]> {
      const offset = query.offset ?? 0
      assertPageBounds(query.limit, offset)
      const where = whereClause(storeName, query.filters)
      const rows = await executor.queryRows<Record<string, any>>(
        `SELECT * FROM "${storeName}" WHERE ${where.sql} ORDER BY ${orderClause(storeName, query.orderBy)} LIMIT ? OFFSET ?`,
        [...where.values, query.limit, offset],
      )
      return rows.map((row) => hydrateRow<T>(storeName, row))
    },

    async countWhere(storeName: TableName, filters: PageFilter[] = []): Promise<number> {
      const where = whereClause(storeName, filters)
      const rows = await executor.queryRows<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM "${storeName}" WHERE ${where.sql}`,
        where.values,
      )
      return rows[0]?.cnt ?? 0
    },

    async listContentRefPage(params: {
      packId?: string
      topicId?: string
      kind: 'vocab' | 'chunk' | 'pattern'
      limit: number
      offset?: number
    }): Promise<{ contentIds: string[]; total: number }> {
      const offset = params.offset ?? 0
      assertPageBounds(params.limit, offset)
      if (!params.packId && !params.topicId) throw new Error('Content page requires a pack or topic')
      const scopeColumn = params.topicId ? 'topic_id' : 'pack_id'
      const scopeValue = params.topicId ?? params.packId
      const rows = await executor.queryRows<{ content_id: string }>(
        `SELECT content_id
         FROM offline_content_refs
         WHERE ${scopeColumn} = ? AND content_kind = ?
         GROUP BY content_id
         ORDER BY MIN(COALESCE(sort_order, 0)), content_id
         LIMIT ? OFFSET ?`,
        [scopeValue, params.kind, params.limit, offset],
      )
      const totals = await executor.queryRows<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM (
           SELECT content_id
           FROM offline_content_refs
           WHERE ${scopeColumn} = ? AND content_kind = ?
           GROUP BY content_id
         ) grouped`,
        [scopeValue, params.kind],
      )
      return { contentIds: rows.map((row) => row.content_id), total: totals[0]?.cnt ?? 0 }
    },

    async listNotebookExpressionPage(query: NotebookExpressionPageQuery): Promise<NotebookExpressionPage> {
      const offset = query.offset ?? 0
      assertPageBounds(query.limit, offset)
      const statusSql = query.reviewState
        ? query.reviewState === 'learning'
          ? "AND ni.mastery_status IN ('learning', 'activated')"
          : 'AND ni.mastery_status = ?'
        : ''
      const searchSql = query.search?.trim() ? 'AND LOWER(ee.data) LIKE ?' : ''
      const values: any[] = [query.notebookId]
      if (query.reviewState && query.reviewState !== 'learning') values.push(query.reviewState)
      values.push(query.kind)
      if (query.search?.trim()) values.push(`%${query.search.trim().toLowerCase()}%`)
      const baseSql = `
        WITH deduplicated_items AS (
          SELECT ni.*, ROW_NUMBER() OVER (
            PARTITION BY ni.expression_entry_id
            ORDER BY CASE WHEN ni.id LIKE 'local:%' THEN 1 ELSE 0 END, ni.updated_at DESC
          ) AS duplicate_rank
          FROM learning_notebook_items ni
          WHERE ni.notebook_id = ? ${statusSql}
        ), filtered AS (
          SELECT di.*, ee.id AS entry_id, ee.remote_id AS entry_remote_id,
            ee.kind AS entry_kind, ee.expression_type AS entry_type,
            ee.sync_status AS entry_sync_status, ee.data AS entry_data,
            ee.updated_at AS entry_updated_at
          FROM deduplicated_items di
          INNER JOIN expression_entries ee ON ee.id = di.expression_entry_id
          WHERE di.duplicate_rank = 1 AND ee.kind = ? ${searchSql}
        )`
      const rows = await executor.queryRows<Record<string, any>>(
        `${baseSql} SELECT * FROM filtered ORDER BY entry_updated_at DESC, entry_id ASC LIMIT ? OFFSET ?`,
        [...values, query.limit, offset],
      )
      const totals = await executor.queryRows<{ cnt: number }>(`${baseSql} SELECT COUNT(*) AS cnt FROM filtered`, values)
      return {
        items: rows.map((row) => ({
          item: { ...JSON.parse(row.data || '{}'), id: row.id, remoteId: row.remote_id, notebookId: row.notebook_id, expressionEntryId: row.expression_entry_id, masteryStatus: row.mastery_status, syncStatus: row.sync_status, updatedAt: row.updated_at },
          entry: { ...JSON.parse(row.entry_data || '{}'), id: row.entry_id, remoteId: row.entry_remote_id, kind: row.entry_kind, type: row.entry_type, syncStatus: row.entry_sync_status, updatedAt: row.entry_updated_at },
        })),
        total: totals[0]?.cnt ?? 0,
      }
    },

    async count(storeName: TableName): Promise<number> {
      try {
        const rows = await executor.queryRows<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM "${storeName}"`,
        )
        return rows[0]?.cnt ?? 0
      } catch (error) {
        console.warn(`[${executor.label}] count failed for ${storeName}`, error)
        throw error
      }
    },

    async clear(storeName: TableName): Promise<void> {
      try {
        await write(`DELETE FROM "${storeName}"`)
      } catch (error) {
        console.warn(`[${executor.label}] clear failed for ${storeName}`, error)
        throw error
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
        throw error
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
        throw error
      }
    },
  }
}
