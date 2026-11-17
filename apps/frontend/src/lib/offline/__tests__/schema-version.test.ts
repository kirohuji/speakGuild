import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import {
  DB_VERSION,
  SCHEMA_VERSION_KEY,
  initializeOfflineSchema,
} from '../sqlite/schema'

async function openSchemaDb() {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  const queryRows = async (sql: string) => {
    const results = db.exec(sql)
    if (!results.length) return []
    return results[0].values.map((row) =>
      Object.fromEntries(results[0].columns.map((column, i) => [column, row[i]])),
    ) as Array<{ name?: string; id?: string; data?: string }>
  }
  const execute = async (sql: string) => {
    db.run(sql)
  }
  return { db, queryRows, execute }
}

describe('initializeOfflineSchema version gate', () => {
  it('writes schema:version after the first migrate and skips index/trigger storm on reopen', async () => {
    const { queryRows, execute } = await openSchemaDb()
    const first: string[] = []
    await initializeOfflineSchema(async (sql) => {
      first.push(sql)
      await execute(sql)
    }, queryRows)

    const marker = await queryRows(`SELECT data FROM kv WHERE id='${SCHEMA_VERSION_KEY}'`)
    expect(JSON.parse(String(marker[0]?.data)).value).toBe(DB_VERSION)
    expect(first.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS'))).toBe(true)

    const second: string[] = []
    await initializeOfflineSchema(async (sql) => {
      second.push(sql)
      await execute(sql)
    }, queryRows)

    expect(second.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS'))).toBe(false)
    expect(second.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS'))).toBe(false)
    expect(second.some((sql) => sql.includes('UPDATE practice_records SET practiced_at'))).toBe(false)
  })

  it('re-runs migrations when schema:version lags behind DB_VERSION', async () => {
    const { queryRows, execute } = await openSchemaDb()
    await initializeOfflineSchema(execute, queryRows)
    await execute(
      `UPDATE kv SET data='{"value":0}' WHERE id='${SCHEMA_VERSION_KEY}'`,
    )

    const rerun: string[] = []
    await initializeOfflineSchema(async (sql) => {
      rerun.push(sql)
      await execute(sql)
    }, queryRows)

    expect(rerun.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS'))).toBe(true)
    const marker = await queryRows(`SELECT data FROM kv WHERE id='${SCHEMA_VERSION_KEY}'`)
    expect(JSON.parse(String(marker[0]?.data)).value).toBe(DB_VERSION)
  })
})
