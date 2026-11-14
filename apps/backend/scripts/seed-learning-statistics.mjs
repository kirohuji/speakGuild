/**
 * Seed the admin account in a development/test database for the day/month/year UI.
 * Usage (from apps/backend): pnpm exec node scripts/seed-learning-statistics.mjs
 * Facts have deterministic fixture IDs; rerunning does not duplicate statistics.
 */
import { readFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const fixture = 'learning-statistics-preview-v1'
const now = new Date()
const zone = 'Asia/Shanghai'
const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now)
const currentHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).format(now))
const dateAt = offset => new Date(Date.parse(`${today}T12:00:00+08:00`) - offset * 86400000).toISOString().slice(0, 10)
const atHour = (date, hour, minute = 0) => new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`)

async function installMissingProjections(tx) {
  // Prisma db push creates the read-model tables but does not install SQL triggers.
  // Use the repository's actual projection functions, not a seed-only aggregate.
  const migrations = ['20261114000100_learning_statistics_projections', '20261114000300_hourly_learning_statistics']
  const installed = []
  for (const migration of migrations) {
    const sql = await readFile(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8')
    for (const [statement] of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION [\s\S]*?\$\$;/g)) {
      await tx.$executeRawUnsafe(statement.replace(/^CREATE FUNCTION/, 'CREATE OR REPLACE FUNCTION'))
    }
    for (const [statement] of sql.matchAll(/CREATE TRIGGER [\s\S]*?;/g)) {
      const [, name, table] = statement.match(/CREATE TRIGGER (\w+) [\s\S]*? ON (\w+)/)
      const exists = await tx.$queryRaw`SELECT 1 FROM pg_trigger WHERE tgname=${name} AND tgrelid=${table}::regclass AND NOT tgisinternal`
      if (!exists.length) { await tx.$executeRawUnsafe(statement); installed.push(name) }
    }
  }
  return installed
}

try {
  const [database] = await prisma.$queryRaw`SELECT current_database() AS name`
  if (!/(test|dev|local)/i.test(database.name)) throw new Error('This fixture is restricted to a development/test database')
  const admins = await prisma.user.findMany({ where: { role: 'admin', OR: [{ name: { equals: 'admin', mode: 'insensitive' } }, { username: { equals: 'admin', mode: 'insensitive' } }] }, select: { id: true, name: true, points: true } })
  if (admins.length !== 1) throw new Error(`Expected one admin account, found ${admins.length}`)
  const admin = admins[0]
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${fixture + ':' + admin.id},0))`
    const installedTriggers = await installMissingProjections(tx)
    // Restore this account's retained facts as well, without changing its sync timestamps.
    await tx.$executeRaw`UPDATE user_daily_practice_run SET stats=stats WHERE "userId"=${admin.id}`
    const existingCheckIns = await tx.userCheckIn.findMany({ where: { userId: admin.id }, select: { date: true } })
    const checkedDates = new Set(existingCheckIns.map(row => row.date.toISOString().slice(0, 10)))
    const checkIns = []
    let runs = 0, attempts = 0, recordedSeconds = 0, previousDate = '', streak = 0
    // Use a full year ending today: future dates are deliberately disabled in the UI.
    for (let offset = 364; offset >= 0; offset--) {
      const date = dateAt(offset)
      const active = offset === 0 || (offset % 11 !== 4 && offset % 17 !== 8)
      if (active) {
        let hours = [7, 9, 11, 12, 14, 16, 18, 19].filter((_, index) => offset === 0 || (index + offset) % 3 !== 0)
        // Today contains only completed hours; never generate a future event.
        if (offset === 0) hours = hours.filter(hour => hour < currentHour)
        if (offset === 0 && !hours.length && currentHour > 0) hours = [currentHour - 1]
        const history = [], activity = {}
        for (const hour of hours) {
          const seconds = 180 + ((offset * 137 + hour * 61) % 1500)
          const questions = 3 + ((offset * 7 + hour * 3) % 18)
          const sourceId = `seed:${fixture}:${date}:h${String(hour).padStart(2, '0')}`
          activity[sourceId] = { scope: 'learning', activeSeconds: seconds, questionCount: 0 }
          recordedSeconds += seconds
          for (let q = 0; q < questions; q++) {
            // One shared question pool across dates; repeated attempts on a date
            // exercise deduplication without inflating its completed-question count.
            const question = `seed:${fixture}:q${String((offset * 37 + hour * 23 + q) % 800).padStart(3, '0')}`
            const createdAt = atHour(date, hour, q).toISOString()
            const event = { id: `${fixture}:${date}:${hour}:${q}`, stepId: question, date, hour, createdAt, purpose: 'rehearsal', outcome: 'correct' }
            history.push(event)
            if (q % 5 === 0) history.push({ ...event, id: `${event.id}:retry`, createdAt: atHour(date, hour, q + 1).toISOString() })
          }
        }
        if (hours.length) {
          // The activity: prefix keeps preview data out of the daily task planner.
          const id = `seed:${fixture}:${date}`
          const payload = { date: new Date(`${date}T00:00:00Z`), mode: 'practice', scope: 'learning', attemptHistory: history, stats: { fixture, activity }, updatedAt: now }
          await tx.userDailyPracticeRun.upsert({ where: { userId_clientRunId: { userId: admin.id, clientRunId: `activity:${id}` } }, create: { id, userId: admin.id, clientRunId: `activity:${id}`, createdAt: atHour(date, hours[0]), ...payload }, update: payload })
          runs++; attempts += history.length
        }
      }
      // Keep gaps for checking selection, streaks and the 200-point makeup flow.
      const addCheckIn = offset % 7 !== 1 && offset % 13 !== 3
      const checked = addCheckIn || checkedDates.has(date)
      streak = checked ? (previousDate && dateAt(offset + 1) === previousDate ? streak + 1 : 1) : 0
      if (addCheckIn && !checkedDates.has(date)) checkIns.push({ id: `seed:${fixture}:checkin:${date}`, userId: admin.id, date: new Date(`${date}T00:00:00Z`), points: 0, streak, createdAt: atHour(date, offset === 0 ? Math.max(0, currentHour - 1) : 8) })
      previousDate = date
    }
    const insertedCheckIns = await tx.userCheckIn.createMany({ data: checkIns, skipDuplicates: true })
    const [totals] = await tx.$queryRaw`SELECT * FROM learning_stat_totals WHERE user_id=${admin.id}`
    const todayHours = await tx.$queryRaw`SELECT hour,question_count AS questions,active_seconds AS seconds FROM learning_stat_hours WHERE user_id=${admin.id} AND date=${today}::date AND (question_count>0 OR active_seconds>0) ORDER BY hour`
    const [mismatch] = await tx.$queryRaw`SELECT COUNT(*)::int AS count FROM learning_stat_days d WHERE d.user_id=${admin.id} AND d.date BETWEEN ${dateAt(364)}::date AND ${today}::date AND EXISTS (SELECT 1 FROM user_daily_practice_run r WHERE r."userId"=d.user_id AND r.date=d.date AND r.stats->>'fixture'=${fixture}) AND (d.question_count < (SELECT COALESCE(SUM(h.question_count),0) FROM learning_stat_hours h WHERE h.user_id=d.user_id AND h.date=d.date) OR d.active_seconds < (SELECT COALESCE(SUM(h.active_seconds),0) FROM learning_stat_hours h WHERE h.user_id=d.user_id AND h.date=d.date))`
    if (mismatch.count) throw new Error('Hourly projections exceed daily totals')
    const points = await tx.user.findUniqueOrThrow({ where: { id: admin.id }, select: { points: true } })
    if (points.points !== admin.points) throw new Error('Fixture unexpectedly changed wallet balance')
    return { installedTriggers, runs, attempts, recordedMinutes: Math.round(recordedSeconds / 60), insertedCheckIns: insertedCheckIns.count, totals, todayHours }
  }, { maxWait: 10000, timeout: 180000 })
  console.log(JSON.stringify({ database: database.name, admin: admin.name, range: { from: dateAt(364), through: today }, ...result }, null, 2))
} finally { await prisma.$disconnect() }
