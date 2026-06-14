import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NativeWechatAuthService } from './native-wechat-auth.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [AuthController],
  providers: [PasswordService, PrismaService, NativeWechatAuthService],
  exports: [PasswordService],
})
export class AuthModule {}
