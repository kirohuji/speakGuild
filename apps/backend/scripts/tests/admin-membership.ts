// Run: pnpm --filter @manyu/backend exec ts-node scripts/tests/admin-membership.ts
import { strict as assert } from 'node:assert';
import { AdminService } from '../../src/modules/admin/admin.service';
import { validate } from 'class-validator';
import { UpdateMembershipDto } from '../../src/modules/admin/dto/update-membership.dto';

async function main() {
  let user: any = { id: 'user' };
  let plan: any = { id: 'standard', level: 'standard' };
  let membership: any = null;
  let write: any;
  const tx = {
    user: { findUnique: async () => user },
    membershipPlan: { findUnique: async () => plan },
    userMembership: {
      findUnique: async () => membership,
      upsert: async (args: any) => { write = args; return args; },
      update: async (args: any) => { write = args; return args; },
    },
  };
  const service = new AdminService({ ...tx, $transaction: async (fn: any) => fn(tx) } as any, {} as any, {} as any);
  const dto = { planId: 'standard', expiredAt: new Date(Date.now() + 86400000).toISOString() };
  await service.updateMembership('user', dto);
  assert.equal(write.create.userId, 'user');
  assert.equal(write.create.status, 'active');
  assert.equal(write.update.cancelledAt, null);
  membership = { status: 'active', startedAt: new Date('2020-01-01'), expiredAt: new Date(Date.now() + 172800000) };
  await service.updateMembership('user', dto);
  assert.equal(write.update.startedAt, membership.startedAt);
  assert.equal(write.update.expiredAt.toISOString(), dto.expiredAt); // shortening is supported
  membership.status = 'cancelled';
  await service.updateMembership('user', dto);
  assert(write.update.startedAt > membership.startedAt);
  await service.cancelMembership('user');
  assert.equal(write.data.status, 'cancelled');
  await assert.rejects(service.updateMembership('user', { ...dto, expiredAt: 'invalid' }));
  await assert.rejects(service.updateMembership('user', { ...dto, expiredAt: '2020-01-01T00:00:00Z' }));
  plan = { id: 'free', level: 'free' };
  await assert.rejects(service.updateMembership('user', dto));
  plan = null;
  await assert.rejects(service.updateMembership('user', dto));
  user = null;
  await assert.rejects(service.updateMembership('user', dto));
  const invalid = Object.assign(new UpdateMembershipDto(), { planId: '', expiredAt: 'invalid' });
  assert.equal((await validate(invalid)).length, 2);
  console.log('Admin membership checks passed');
}
void main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
