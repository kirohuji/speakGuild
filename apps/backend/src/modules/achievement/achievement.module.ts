import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { AchievementController } from './achievement.controller'
import { AchievementService } from './achievement.service'
import { AchievementEngineService } from './achievement-engine.service'

@Module({
  imports: [PrismaModule],
  controllers: [AchievementController],
  providers: [AchievementService, AchievementEngineService],
  exports: [AchievementService, AchievementEngineService],
})
export class AchievementModule {}
