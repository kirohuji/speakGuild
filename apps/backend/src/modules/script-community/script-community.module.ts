import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { FileAssetsModule } from '../file-assets/file-assets.module'
import { LearningModule } from '../learning/learning.module'
import { ScriptCommunityController } from './script-community.controller'
import { ScriptCommunityService } from './script-community.service'
import { AdminTasksModule } from '../admin-tasks/admin-tasks.module'

@Module({
  imports: [PrismaModule, FileAssetsModule, LearningModule, AdminTasksModule],
  controllers: [ScriptCommunityController],
  providers: [ScriptCommunityService],
  exports: [ScriptCommunityService],
})
export class ScriptCommunityModule {}
