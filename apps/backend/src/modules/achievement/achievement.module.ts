import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { AchievementController } from './achievement.controller'
import { AchievementEngineService } from './achievement-engine.service'

@Module({
  imports: [PrismaModule],
  controllers: [AchievementController],
  providers: [AchievementEngineService],
  exports: [AchievementEngineService],
})
export class AchievementModule {}
