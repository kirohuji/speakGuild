import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationAdminController } from './notification-admin.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { FileAssetsModule } from '../file-assets/file-assets.module';

@Module({
  imports: [FileAssetsModule],
  controllers: [NotificationController, NotificationAdminController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
