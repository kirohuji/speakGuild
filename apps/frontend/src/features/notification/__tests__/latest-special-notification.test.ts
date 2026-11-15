import { expect, it, vi } from 'vitest'
const source = new URL('../../../../../backend/src/modules/notification/notification.service.ts', import.meta.url).href
const { NotificationService } = await import(/* @vite-ignore */ source)

function fixture() {
  const rows = [
    { id: 'old', title: 'old', content: '', imageUrl: null, createdAt: new Date('2026-11-14'), type: 'broadcast', isSpecial: true, targets: [], readers: [] },
    { id: 'new', title: 'new', content: '', imageUrl: null, createdAt: new Date('2026-11-15'), type: 'broadcast', isSpecial: true, targets: [], readers: [] },
  ] as any[]
  const findMany = vi.fn(async ({ where, take, select }) => {
    const user = select.reads.where.userId
    return rows.filter(row => row.isSpecial && (row.type === 'broadcast' || row.targets.includes(user)))
      .filter(row => !where.reads || !row.readers.includes(where.reads.none.userId))
      .sort((a, b) => +b.createdAt - +a.createdAt || b.id.localeCompare(a.id)).slice(0, take)
      .map(({ type, isSpecial, targets, readers, ...row }) => ({ ...row, reads: readers.includes(user) ? [{ userId: user }] : [] }))
  })
  const prisma = { notification: { findMany } }
  return { rows, findMany, service: new NotificationService(prisma as any, {} as any, {} as any, {} as any, {} as any) }
}
it('returns only the latest visible special notification and never returns its read metadata', async () => {
  const { service } = fixture()
  const result = await service.getUnreadSpecialNotifications('a')
  expect(result.map(item => item.id)).toEqual(['new'])
  expect(result[0]).not.toHaveProperty('reads')
})
it('does not fall back to old unread notifications after the latest has been read, including on later visits', async () => {
  const { service, rows } = fixture()
  rows[1].readers.push('a')
  expect(await service.getUnreadSpecialNotifications('a')).toEqual([])
  expect(await service.getUnreadSpecialNotifications('a')).toEqual([])
  expect((await service.getUnreadSpecialNotifications('b')).map(item => item.id)).toEqual(['new'])
})
it('excludes notifications targeted at another user and permits newly published notifications', async () => {
  const { service, rows } = fixture()
  rows[1].readers.push('a')
  rows.push({ ...rows[1], id: 'target-b', createdAt: new Date('2026-11-16'), type: 'targeted', targets: ['b'], readers: [] })
  expect(await service.getUnreadSpecialNotifications('a')).toEqual([])
  rows.push({ ...rows[0], id: 'latest', createdAt: new Date('2026-11-17'), readers: [] })
  expect((await service.getUnreadSpecialNotifications('a')).map(item => item.id)).toEqual(['latest'])
})
