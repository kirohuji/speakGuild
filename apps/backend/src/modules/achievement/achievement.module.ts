import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { AchievementController } from './achievement.controller'
import { AchievementService } from './achievement.service'

@Module({
  imports: [PrismaModule],
  controllers: [AchievementController],
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
