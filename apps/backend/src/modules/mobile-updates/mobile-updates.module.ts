import { Module } from '@nestjs/common';
import { FileAssetsModule } from '../file-assets/file-assets.module';
import { MobileUpdatesService } from './mobile-updates.service';
import { MobileUpdatesAdminController } from './mobile-updates-admin.controller';

@Module({
  imports: [FileAssetsModule],
  controllers: [MobileUpdatesAdminController],
  providers: [MobileUpdatesService],
  exports: [MobileUpdatesService],
})
export class MobileUpdatesModule {}
