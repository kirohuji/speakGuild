import { Controller, Get, Post, Delete, Body, Req, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { auth } from './auth';
import { PasswordService } from './password.service';
import { requireAuthSession } from './session.util';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  DeleteAccountDto,
} from './dto/password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly passwordService: PasswordService) {}

  @Get('ok')
  getOk() {
    return { status: 'ok' };
  }

  @Get('session')
  async getSession(@Req() req: Request) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      throw new UnauthorizedException('未登录');
    }

    return session;
  }

  // ─── 忘记密码 ──────────────────────────────────────────────

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    // Better Auth 的 emailOTP 插件会处理 OTP 发送（开发环境打印到日志）
    // 前端需要先调用 authClient.emailOtp.sendVerificationOtp 来触发 OTP 生成
    return this.passwordService.sendResetOtp(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordService.resetPasswordByOtp(
      dto.email,
      dto.otp,
      dto.newPassword,
    );
  }

  // ─── 修改密码（已登录） ─────────────────────────────────────

  @Post('change-password')
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const session = await requireAuthSession(req);
    return this.passwordService.changePassword(
      session.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ─── 删除账户（已登录） ─────────────────────────────────────

  @Delete('delete-account')
  async deleteAccount(@Req() req: Request, @Body() dto: DeleteAccountDto) {
    const session = await requireAuthSession(req);
    return this.passwordService.deleteAccount(session.user.id, dto.password);
  }
}
