/**
 * SQLite schema for Capacitor offline storage.
 *
 * Most "stores" become a SQLite table with:
 *   - id TEXT PRIMARY KEY
 *   - data TEXT NOT NULL    (JSON-serialized payload fields)
 *   - updated_at TEXT       (local write timestamp)
 *
 * Tables that need sync or fast lookup expose those stable fields as columns.
 * sqlite-json-store hydrates those columns back into objects when reading, so
 * repository code still works with one object shape while SQLite keeps indexes
 * over real columns instead of json_extract(data, ...).
 *
 * We intentionally do not carry schema migrations here. Offline data is cache
 * or replayable sync state, and local database resets are the supported way to
 * move between incompatible cache schemas during development.
 *
 * Binary resource data is not stored in SQLite.
 */
export const DB_NAME = 'speakguild_offline'

/** Increment this when schema changes; triggers onUpgrade. */
export const DB_VERSION = 10

/** All table names in the database. */
export const TABLE_NAMES = [
  'kv',
  'my_learning_units',
  'downloaded_packs',
  'downloaded_unit_details',
  'ink_scripts',
  'dictionary_entries',
  'expression_entries',
  'offline_vocabularies',
  'offline_chunks',
  'offline_patterns',
  'offline_content_refs',
  'user_progress',
  'practice_records',
  'warmup_records',
  'warmup_record_entries',
  'daily_activity',
  'daily_progress',
  'daily_practice_items',
  'daily_practice_runs',
  'daily_practice_attempts',
  'warmup_embedding_refs',
  'local_assets',
  'asset_refs',
  'outbox',
] as const

export type TableName = (typeof TABLE_NAMES)[number]

/** CREATE TABLE statements for each store. */
export const DDL: Record<TableName, string> = {
  kv: `
    CREATE TABLE IF NOT EXISTS kv (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  my_learning_units: `
    CREATE TABLE IF NOT EXISTS my_learning_units (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  downloaded_packs: `
    CREATE TABLE IF NOT EXISTS downloaded_packs (
      id TEXT PRIMARY KEY NOT NULL,
      pack_id TEXT,
      status TEXT,
      version INTEGER,
      title TEXT,
      installed_at TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  downloaded_unit_details: `
    CREATE TABLE IF NOT EXISTS downloaded_unit_details (
      id TEXT PRIMARY KEY NOT NULL,
      unit_id TEXT,
      topic_id TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  ink_scripts: `
    CREATE TABLE IF NOT EXISTS ink_scripts (
      id TEXT PRIMARY KEY NOT NULL,
      unit_id TEXT,
      topic_id TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  dictionary_entries: `
    CREATE TABLE IF NOT EXISTS dictionary_entries (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  expression_entries: `
    CREATE TABLE IF NOT EXISTS expression_entries (
      id TEXT PRIMARY KEY NOT NULL,
      remote_id TEXT,
      kind TEXT,
      expression_type TEXT,
      mastery_status TEXT,
      sync_status TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  offline_vocabularies: `
    CREATE TABLE IF NOT EXISTS offline_vocabularies (
      id TEXT PRIMARY KEY NOT NULL,
      word TEXT,
      normalized_text TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  offline_chunks: `
    CREATE TABLE IF NOT EXISTS offline_chunks (
      id TEXT PRIMARY KEY NOT NULL,
      text TEXT,
      normalized_text TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  offline_patterns: `
    CREATE TABLE IF NOT EXISTS offline_patterns (
      id TEXT PRIMARY KEY NOT NULL,
      pattern TEXT,
      normalized_text TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  offline_content_refs: `
    CREATE TABLE IF NOT EXISTS offline_content_refs (
      id TEXT PRIMARY KEY NOT NULL,
      content_kind TEXT,
      content_id TEXT,
      pack_id TEXT,
      unit_id TEXT,
      topic_id TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  user_progress: `
    CREATE TABLE IF NOT EXISTS user_progress (
      id TEXT PRIMARY KEY NOT NULL,
      remote_id TEXT,
      progress_type TEXT,
      scene_id TEXT,
      chunk_id TEXT,
      session_id TEXT,
      sync_status TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  practice_records: `
    CREATE TABLE IF NOT EXISTS practice_records (
      id TEXT PRIMARY KEY NOT NULL,
      remote_id TEXT,
      record_type TEXT,
      session_id TEXT,
      local_session_id TEXT,
      topic_id TEXT,
      scene_id TEXT,
      status TEXT,
      sync_status TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  warmup_records: `
    CREATE TABLE IF NOT EXISTS warmup_records (
      id TEXT PRIMARY KEY NOT NULL,
      topic_id TEXT,
      topic_title TEXT,
      sync_status TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  warmup_record_entries: `
    CREATE TABLE IF NOT EXISTS warmup_record_entries (
      id TEXT PRIMARY KEY NOT NULL,
      record_id TEXT,
      step_id TEXT,
      topic_id TEXT,
      practiced_date TEXT,
      record_updated_at TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  daily_activity: `
    CREATE TABLE IF NOT EXISTS daily_activity (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT,
      count INTEGER DEFAULT 0,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  daily_progress: `
    CREATE TABLE IF NOT EXISTS daily_progress (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT,
      pack_id TEXT,
      done_ids TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  daily_practice_items: `
    CREATE TABLE IF NOT EXISTS daily_practice_items (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT,
      pack_id TEXT,
      topic_id TEXT,
      item_type TEXT,
      status TEXT,
      due_date TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  daily_practice_runs: `
    CREATE TABLE IF NOT EXISTS daily_practice_runs (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT,
      scope TEXT,
      pack_ids TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  daily_practice_attempts: `
    CREATE TABLE IF NOT EXISTS daily_practice_attempts (
      id TEXT PRIMARY KEY NOT NULL,
      item_id TEXT,
      pack_id TEXT,
      topic_id TEXT,
      sync_status TEXT,
      practiced_at TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  warmup_embedding_refs: `
    CREATE TABLE IF NOT EXISTS warmup_embedding_refs (
      id TEXT PRIMARY KEY NOT NULL,
      model_key TEXT NOT NULL,
      reference_key TEXT NOT NULL,
      source TEXT,
      pack_id TEXT,
      topic_id TEXT,
      last_used_at TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  local_assets: `
    CREATE TABLE IF NOT EXISTS local_assets (
      id TEXT PRIMARY KEY NOT NULL,
      asset_id TEXT,
      remote_url TEXT,
      status TEXT,
      mime_type TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  asset_refs: `
    CREATE TABLE IF NOT EXISTS asset_refs (
      id TEXT PRIMARY KEY NOT NULL,
      sha256 TEXT NOT NULL,
      pack_id TEXT NOT NULL,
      logical_path TEXT NOT NULL,
      ext TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  outbox: `
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      operation TEXT,
      status TEXT,
      client_mutation_id TEXT,
      retry_count INTEGER,
      created_at TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
}

/** All CREATE TABLE statements as a single batch. */
export const ALL_DDL = Object.values(DDL).join(';\n') + ';'

/** Indexes for commonly queried fields. */
export const INDEXES = [
  // downloaded_packs: fast installed/missing checks and maintenance.
  `CREATE INDEX IF NOT EXISTS idx_downloaded_packs_pack_id ON downloaded_packs (pack_id)`,
  `CREATE INDEX IF NOT EXISTS idx_downloaded_packs_status ON downloaded_packs (status)`,
  `CREATE INDEX IF NOT EXISTS idx_downloaded_unit_details_unit_id ON downloaded_unit_details (unit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_downloaded_unit_details_topic_id ON downloaded_unit_details (topic_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ink_scripts_unit_id ON ink_scripts (unit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ink_scripts_topic_id ON ink_scripts (topic_id)`,
  // expression_entries: filter by kind or remote id.
  `CREATE INDEX IF NOT EXISTS idx_expression_kind ON expression_entries (kind)`,
  `CREATE INDEX IF NOT EXISTS idx_expression_remote_id ON expression_entries (remote_id)`,
  `CREATE INDEX IF NOT EXISTS idx_expression_type ON expression_entries (expression_type)`,
  `CREATE INDEX IF NOT EXISTS idx_expression_mastery_status ON expression_entries (mastery_status)`,
  `CREATE INDEX IF NOT EXISTS idx_offline_vocab_normalized ON offline_vocabularies (normalized_text)`,
  `CREATE INDEX IF NOT EXISTS idx_offline_chunk_normalized ON offline_chunks (normalized_text)`,
  `CREATE INDEX IF NOT EXISTS idx_offline_pattern_normalized ON offline_patterns (normalized_text)`,
  `CREATE INDEX IF NOT EXISTS idx_offline_content_refs_kind_id ON offline_content_refs (content_kind, content_id)`,
  `CREATE INDEX IF NOT EXISTS idx_offline_content_refs_pack ON offline_content_refs (pack_id)`,
  `CREATE INDEX IF NOT EXISTS idx_offline_content_refs_topic ON offline_content_refs (topic_id)`,
  `CREATE INDEX IF NOT EXISTS idx_asset_refs_sha256 ON asset_refs (sha256)`,
  `CREATE INDEX IF NOT EXISTS idx_asset_refs_pack_id ON asset_refs (pack_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_progress_remote_id ON user_progress (remote_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_progress_type ON user_progress (progress_type)`,
  `CREATE INDEX IF NOT EXISTS idx_user_progress_scene_id ON user_progress (scene_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_progress_chunk_id ON user_progress (chunk_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_progress_session_id ON user_progress (session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_practice_records_remote_id ON practice_records (remote_id)`,
  `CREATE INDEX IF NOT EXISTS idx_practice_records_type ON practice_records (record_type)`,
  `CREATE INDEX IF NOT EXISTS idx_practice_records_status ON practice_records (status)`,
  `CREATE INDEX IF NOT EXISTS idx_practice_records_sync_status ON practice_records (sync_status)`,
  `CREATE INDEX IF NOT EXISTS idx_warmup_entries_record_id ON warmup_record_entries (record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_warmup_entries_step_id ON warmup_record_entries (step_id)`,
  `CREATE INDEX IF NOT EXISTS idx_warmup_entries_practiced_date ON warmup_record_entries (practiced_date)`,
  `CREATE INDEX IF NOT EXISTS idx_warmup_entries_topic_id ON warmup_record_entries (topic_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_practice_items_item_id ON daily_practice_items (item_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_practice_items_pack_id ON daily_practice_items (pack_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_practice_items_topic_id ON daily_practice_items (topic_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_practice_items_due_date ON daily_practice_items (due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_practice_runs_date ON daily_practice_runs (date)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_practice_attempts_item_id ON daily_practice_attempts (item_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_practice_attempts_sync_status ON daily_practice_attempts (sync_status)`,
  `CREATE INDEX IF NOT EXISTS idx_warmup_embedding_model_key ON warmup_embedding_refs (model_key)`,
  `CREATE INDEX IF NOT EXISTS idx_warmup_embedding_reference_key ON warmup_embedding_refs (reference_key)`,
  `CREATE INDEX IF NOT EXISTS idx_warmup_embedding_topic_id ON warmup_embedding_refs (topic_id)`,
  // outbox: filter by status
  `CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox (status)`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_entity ON outbox (entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_client_mutation_id ON outbox (client_mutation_id)`,
  // practice_records: filter by sessionId
  `CREATE INDEX IF NOT EXISTS idx_practice_sessionId ON practice_records (session_id)`,
  // local_assets: filter by status
  `CREATE INDEX IF NOT EXISTS idx_local_assets_status ON local_assets (status)`,
  `CREATE INDEX IF NOT EXISTS idx_local_assets_remote_url ON local_assets (remote_url)`,
]
