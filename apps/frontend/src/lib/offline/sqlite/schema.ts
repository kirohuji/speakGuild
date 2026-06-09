/**
 * SQLite schema for Capacitor offline storage.
 *
 * Most "stores" become a SQLite table with:
 *   - id TEXT PRIMARY KEY
 *   - data TEXT NOT NULL    (JSON-serialized value)
 *   - updated_at TEXT       (ISO-8601 timestamp)
 *
 * Tables that need fast lookup can additionally expose selected JSON fields as
 * real columns while keeping the full object in data.
 *
 * Native recording bytes stay in Capacitor Filesystem. Web does not cache
 * binary resource data.
 */
export const DB_NAME = 'speakguild_offline'

/** Increment this when schema changes; triggers onUpgrade. */
export const DB_VERSION = 2

/** All table names in the database. */
export const TABLE_NAMES = [
  'kv',
  'my_learning_units',
  'downloaded_packs',
  'downloaded_unit_details',
  'ink_scripts',
  'dictionary_entries',
  'expression_entries',
  'user_progress',
  'practice_records',
  'local_assets',
  'outbox',
  'recordings',
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
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  ink_scripts: `
    CREATE TABLE IF NOT EXISTS ink_scripts (
      id TEXT PRIMARY KEY NOT NULL,
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
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  user_progress: `
    CREATE TABLE IF NOT EXISTS user_progress (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  practice_records: `
    CREATE TABLE IF NOT EXISTS practice_records (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  local_assets: `
    CREATE TABLE IF NOT EXISTS local_assets (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  outbox: `
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  recordings: `
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
}

/** All CREATE TABLE statements as a single batch. */
export const ALL_DDL = Object.values(DDL).join(';\n') + ';'

/** Safe best-effort schema upgrades for existing databases. */
export const MIGRATIONS = [
  `ALTER TABLE downloaded_packs ADD COLUMN pack_id TEXT`,
  `ALTER TABLE downloaded_packs ADD COLUMN status TEXT`,
  `ALTER TABLE downloaded_packs ADD COLUMN version INTEGER`,
  `ALTER TABLE downloaded_packs ADD COLUMN title TEXT`,
  `ALTER TABLE downloaded_packs ADD COLUMN installed_at TEXT`,
  `UPDATE downloaded_packs
   SET
     pack_id = COALESCE(pack_id, json_extract(data, '$.packId')),
     status = COALESCE(status, json_extract(data, '$.status')),
     version = COALESCE(version, json_extract(data, '$.version')),
     title = COALESCE(title, json_extract(data, '$.title')),
     installed_at = COALESCE(installed_at, json_extract(data, '$.installedAt'))`,
]

/** Indexes for commonly queried fields. */
export const INDEXES = [
  // downloaded_packs: fast installed/missing checks and maintenance.
  `CREATE INDEX IF NOT EXISTS idx_downloaded_packs_pack_id ON downloaded_packs (pack_id)`,
  `CREATE INDEX IF NOT EXISTS idx_downloaded_packs_status ON downloaded_packs (status)`,
  // expression_entries: filter by kind or remoteId
  `CREATE INDEX IF NOT EXISTS idx_expression_kind ON expression_entries (json_extract(data, '$.kind'))`,
  `CREATE INDEX IF NOT EXISTS idx_expression_remoteId ON expression_entries (json_extract(data, '$.remoteId'))`,
  // outbox: filter by status
  `CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox (json_extract(data, '$.status'))`,
  // practice_records: filter by sessionId
  `CREATE INDEX IF NOT EXISTS idx_practice_sessionId ON practice_records (json_extract(data, '$.sessionId'))`,
  // local_assets: filter by status
  `CREATE INDEX IF NOT EXISTS idx_local_assets_status ON local_assets (json_extract(data, '$.status'))`,
]
