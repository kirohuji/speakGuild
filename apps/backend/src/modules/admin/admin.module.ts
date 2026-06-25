import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminStatsService } from './admin-stats.service';
import { ContentAdminController } from './content-admin.controller';
import { LearningPackAdminController } from './learning-pack-admin.controller';
import { LearningPackAdminService } from './learning-pack-admin.service';
import { PackageDataController } from './package-data.controller';
import { PublicSystemConfigController, SystemConfigController } from './system-config/system-config.controller';
import { SystemConfigService } from './system-config/system-config.service';
import { ThemeManageModule } from './theme-manage/theme-manage.module';
import { DailySentenceModule } from './daily-sentence/daily-sentence.module';
import { PayModule } from '../pay/pay.module';
import { PracticeAiModule } from '../practice-ai/practice-ai.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { TtsModule } from '../tts/tts.module';
import { FileAssetsModule } from '../file-assets/file-assets.module';
import { LearningModule } from '../learning/learning.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PayModule, PracticeAiModule, DictionaryModule, ThemeManageModule, DailySentenceModule, TtsModule, FileAssetsModule, LearningModule, NotificationModule],
  controllers: [AdminController, ContentAdminController, SystemConfigController, PublicSystemConfigController, LearningPackAdminController, PackageDataController],
  providers: [AdminService, AdminStatsService, SystemConfigService, LearningPackAdminService],
  exports: [SystemConfigService],
})
export class AdminModule {}
