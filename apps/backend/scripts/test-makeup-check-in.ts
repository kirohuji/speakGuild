import assert = require('node:assert/strict');
import { PrismaService } from '../src/common/prisma/prisma.service';
import { LearningStatisticsService } from '../src/common/learning-statistics/learning-statistics.service';
import { PointsService, MAKEUP_COST } from '../src/modules/points/points.service';
import { AiQuotaService } from '../src/common/ai-quota/ai-quota.service';
import { todayDateKey, parseDateKey, addDateKeyDays, formatDateKey } from '../src/common/calendar-date';
const db = new PrismaService();
const service = new PointsService(db, new LearningStatisticsService(db));
const zone = 'Asia/Shanghai';
const today = todayDateKey(zone);
const day = (offset: number) => formatDateKey(addDateKeyDays(parseDateKey(today)!, offset));
async function user(id: string, points: number) { return db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, points } }); }
async function rejectsCode(action: Promise<unknown>, code: string) {
  await assert.rejects(action, (error: any) => error.getResponse?.().code === code);
}
async function main() {
  assert.equal(MAKEUP_COST,200);
  await user('history',1000);
  // No learning rows, more than seven days back, more than two makeups are all allowed.
  for (const offset of [-60,-61,-62]) await service.makeupCheckIn('history',day(offset),zone);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:'history'}})).points,400);
  assert.equal(await db.userCheckIn.count({where:{userId:'history',isMakeup:true}}),3);
  const retry=await service.makeupCheckIn('history',day(-60),zone);
  assert.equal(retry.alreadyApplied,true);
  assert.equal(retry.points,400);
  assert.equal(await db.pointTransaction.count({where:{userId:'history'}}),3);
  const status=await service.getCheckInStatus('history',zone);
  assert.equal(status.checkedIn,false,'A historical makeup created today must not count as today');
  const calendar=await service.getCheckInCalendar('history',day(-62),day(-60),zone);
  assert.deepEqual(calendar.makeupDates,[day(-62),day(-61),day(-60)].sort());
  assert.equal(calendar.dailyStats.length,0,'Makeups must not create learning activity');
  const normal=await service.checkIn('history',zone);
  assert.equal(normal.earned,10);
  await rejectsCode(service.makeupCheckIn('history',today,zone),'MAKEUP_ALREADY_CHECKED_IN');
  await user('range',1000);
  await rejectsCode(service.makeupCheckIn('range',today,zone),'MAKEUP_OUT_OF_RANGE');
  await rejectsCode(service.makeupCheckIn('range',day(1),zone),'MAKEUP_OUT_OF_RANGE');
  await assert.rejects(service.makeupCheckIn('range','2026-02-30',zone));
  await user('duplicate',200);
  const duplicates=await Promise.all([service.makeupCheckIn('duplicate',day(-1),zone),service.makeupCheckIn('duplicate',day(-1),zone)]);
  assert.equal(duplicates.filter(result=>!result.alreadyApplied).length,1);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:'duplicate'}})).points,0);
  assert.equal(await db.pointTransaction.count({where:{userId:'duplicate'}}),1);
  await user('insufficient',199);
  await rejectsCode(service.makeupCheckIn('insufficient',day(-1),zone),'MAKEUP_INSUFFICIENT_POINTS');
  assert.equal(await db.userCheckIn.count({where:{userId:'insufficient'}}),0);
  assert.equal(await db.pointTransaction.count({where:{userId:'insufficient'}}),0);
  await user('concurrent',200);
  const competing=await Promise.allSettled([service.makeupCheckIn('concurrent',day(-1),zone),service.makeupCheckIn('concurrent',day(-2),zone)]);
  assert.equal(competing.filter(result=>result.status==='fulfilled').length,1);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:'concurrent'}})).points,0);
  await user('streak',1000);
  await service.checkIn('streak',zone);
  await service.makeupCheckIn('streak',day(-2),zone);
  const restored=await service.makeupCheckIn('streak',day(-1),zone);
  assert.equal(restored.status.currentStreak,3);
  const todayRow=await db.userCheckIn.findUniqueOrThrow({where:{userId_date:{userId:'streak',date:parseDateKey(today)!}}});
  assert.equal(todayRow.points,10,'Restoring a streak must not award points retroactively');
  await user('exchange',200);
  await db.aiUsageDaily.create({data:{userId:'exchange',date:parseDateKey(today)!,dialogue:1}});
  await Promise.allSettled([service.makeupCheckIn('exchange',day(-1),zone),new AiQuotaService(db).exchangeByPoints('exchange','dialogue')]);
  assert.ok((await db.user.findUniqueOrThrow({where:{id:'exchange'}})).points>=0);
  assert.equal(await db.pointTransaction.count({where:{userId:'exchange'}}),1);
  await assert.rejects(db.user.update({where:{id:'exchange'},data:{points:{decrement:1000}}}));
  assert.ok((await db.user.findUniqueOrThrow({where:{id:'exchange'}})).points>=0);
  assert.equal(await db.userCheckIn.count({where:{userId:'range'}}),0,'Accounts must remain isolated');
  console.log('Makeup service: 200 points, unrestricted past dates/counts, no learning requirement, idempotent retries, concurrency, insufficient balance, streak restoration and date attribution passed.');
}
main().finally(()=>db.$disconnect()).catch(error=>{console.error(error);process.exitCode=1});
