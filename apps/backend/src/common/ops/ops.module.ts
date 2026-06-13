import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OpsAlertService } from './ops-alert.service';
import { OpsController } from './ops.controller';
import { OpsCapacityJob } from './ops-capacity.job';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [OpsController],
  providers: [OpsAlertService, OpsCapacityJob],
  exports: [OpsAlertService],
})
export class OpsModule {}
