import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiQuotaService } from './ai-quota.service';
import { AiQuotaController } from './ai-quota.controller';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AiQuotaController],
  providers: [AiQuotaService],
  exports: [AiQuotaService],
})
export class AiQuotaModule {}
