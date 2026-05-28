import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminStatsService } from './admin-stats.service';
import { ContentAdminController } from './content-admin.controller';
import { QuestionBankAdminController } from './question-bank-admin.controller';
import { QuestionBankAdminService } from './question-bank-admin.service';
import { SystemConfigController } from './system-config/system-config.controller';
import { SystemConfigService } from './system-config/system-config.service';
import { ThemeManageModule } from './theme-manage/theme-manage.module';
import { PayModule } from '../pay/pay.module';

@Module({
  imports: [PayModule, ThemeManageModule],
  controllers: [AdminController, QuestionBankAdminController, ContentAdminController, SystemConfigController],
  providers: [AdminService, AdminStatsService, QuestionBankAdminService, SystemConfigService],
  exports: [SystemConfigService],
})
export class AdminModule {}
