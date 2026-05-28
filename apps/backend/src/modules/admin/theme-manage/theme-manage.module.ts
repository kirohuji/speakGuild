import { Module } from '@nestjs/common';
import { ThemeAdminController } from './theme-admin.controller';
import { ThemePublicController } from './theme-public.controller';
import { ThemeManageService } from './theme-manage.service';

@Module({
  controllers: [ThemeAdminController, ThemePublicController],
  providers: [ThemeManageService],
  exports: [ThemeManageService],
})
export class ThemeManageModule {}
