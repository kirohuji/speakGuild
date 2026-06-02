import { Controller, Get, Post, Delete, Body, Req, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { auth } from './auth';
import { PasswordService } from './password.service';
import { requireAuthSession } from './session.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  DeleteAccountDto,
  NativeWechatSignInDto,
} from './dto/password.dto';
import { NativeWechatAuthService } from './native-wechat-auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
    private readonly nativeWechatAuthService: NativeWechatAuthService,
  ) {}

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

  @Post('wechat/native')
  async signInWithNativeWechat(@Req() req: Request, @Body() dto: NativeWechatSignInDto) {
    return this.nativeWechatAuthService.signIn(
      dto.code,
      req.ip,
      req.headers['user-agent'],
    );
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

  // ─── 推广试用 —— 注册后调用，检查 promo_trial_days 配置 ───

  @Post('promo-trial')
  async claimPromoTrial(@Req() req: Request) {
    const session = await requireAuthSession(req);
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'promo_trial_days' },
    });
    const days = parseInt(config?.value || '0', 10);

    if (days <= 0) {
      return { granted: false, message: '暂无推广试用活动' };
    }

    // 检查是否已经领过
    const existing = await this.prisma.userMembership.findUnique({
      where: { userId: session.user.id },
    });
    if (existing && existing.expiredAt > new Date()) {
      return { granted: false, message: '您已有有效会员' };
    }

    // 授予试用天数
    const now = new Date();
    const plan = await this.prisma.membershipPlan.findFirst({
      where: { level: 'standard' },
    });

    if (!plan) {
      return { granted: false, message: '会员计划不可用' };
    }

    if (existing) {
      await this.prisma.userMembership.update({
        where: { userId: session.user.id },
        data: {
          status: 'active',
          planId: plan.id,
          expiredAt: new Date(now.getTime() + days * 86400000),
        },
      });
    } else {
      await this.prisma.userMembership.create({
        data: {
          userId: session.user.id,
          planId: plan.id,
          status: 'active',
          expiredAt: new Date(now.getTime() + days * 86400000),
        },
      });
    }

    return { granted: true, days, message: `已赠送 ${days} 天会员试用` };
  }
}
