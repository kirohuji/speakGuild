import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  controllers: [AuthController],
  providers: [PasswordService, PrismaService],
  exports: [PasswordService],
})
export class AuthModule {}
