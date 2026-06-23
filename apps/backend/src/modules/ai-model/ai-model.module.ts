import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AiModelController } from './ai-model.controller';
import { AiModelService } from './ai-model.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiModelController],
  providers: [AiModelService],
  exports: [AiModelService],
})
export class AiModelModule implements OnModuleInit {
  constructor(private readonly aiModelService: AiModelService) {}

  async onModuleInit() {
    await this.aiModelService.seedDefaults();
  }
}
