import { Module } from '@nestjs/common';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PayModule } from '../pay/pay.module';

@Module({
  imports: [PrismaModule, PayModule],
  controllers: [MembershipController],
  providers: [MembershipService],
})
export class MembershipModule {}
