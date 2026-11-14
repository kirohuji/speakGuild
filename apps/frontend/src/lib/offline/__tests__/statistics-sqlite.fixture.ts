import initSqlJs from 'sql.js'
import { initializeOfflineSchema } from '../sqlite/schema'
import { createSqliteJsonStore, type SqliteJsonExecutor } from '../sqlite/sqlite-json-store'
export async function statisticsDb() {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  const queries: string[] = []
  let failOutbox = false
  const queryRows: SqliteJsonExecutor['queryRows'] = async (sql, values = []) => {
    queries.push(sql)
    const results = db.exec(sql, values)
    if (!results.length) return []
    return results[0].values.map(row => Object.fromEntries(results[0].columns.map((column, i) => [column, row[i]]))) as any
  }
  await initializeOfflineSchema(async sql => { db.run(sql) }, queryRows)
  const store = createSqliteJsonStore({
    label: 'real-sqlite-test', queryRows,
    run: async (sql, values = []) => { db.run(sql, values) },
    execute: async sql => { db.run(sql) },
    runMany: async statements => {
      db.run('BEGIN')
      try {
        for (const statement of statements) {
          if (failOutbox && statement.sql.includes('INTO "outbox"')) throw new Error('disk full')
          db.run(statement.sql, statement.values)
        }
        db.run('COMMIT')
      } catch (error) { db.run('ROLLBACK'); throw error }
    },
  })
  return { db, store, queries, queryRows, failOutbox: (value: boolean) => { failOutbox = value } }
}
