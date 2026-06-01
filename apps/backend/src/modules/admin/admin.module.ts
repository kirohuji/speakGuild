import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminStatsService } from './admin-stats.service';
import { ContentAdminController } from './content-admin.controller';
import { SystemConfigController } from './system-config/system-config.controller';
import { SystemConfigService } from './system-config/system-config.service';
import { ThemeManageModule } from './theme-manage/theme-manage.module';
import { DailySentenceModule } from './daily-sentence/daily-sentence.module';
import { PayModule } from '../pay/pay.module';

@Module({
  imports: [PayModule, ThemeManageModule, DailySentenceModule],
  controllers: [AdminController, ContentAdminController, SystemConfigController],
  providers: [AdminService, AdminStatsService, SystemConfigService],
  exports: [SystemConfigService],
})
export class AdminModule {}
