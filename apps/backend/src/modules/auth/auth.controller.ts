import { Controller, Get, Post, Delete, Body, Req, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { auth } from './auth';
import { PasswordService } from './password.service';
import { requireAuthSession } from './session.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
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
    private readonly notificationService: NotificationService,
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

  @Post('sessions/revoke-others')
  async revokeOtherSessions(@Req() req: Request) {
    const session = await requireAuthSession(req);
    const currentToken =
      (session as any)?.session?.token ||
      (session as any)?.token ||
      this.extractBearerSessionToken(req);

    if (!currentToken) {
      return { revoked: 0 };
    }

    const result = await this.prisma.session.deleteMany({
      where: {
        userId: session.user.id,
        token: { not: currentToken },
      },
    });

    return { revoked: result.count };
  }

  @Post('wechat/native')
  async signInWithNativeWechat(@Req() req: Request, @Body() dto: NativeWechatSignInDto) {
    return this.nativeWechatAuthService.signIn(
      dto.code,
      req.ip,
      req.headers['user-agent'],
    );
  }

  private extractBearerSessionToken(req: Request) {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return null;
    const bearer = authorization.slice('Bearer '.length).trim();
    const decoded = decodeURIComponent(bearer);
    return decoded.split('.')[0] || null;
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

  @Get('delete-account/requirements')
  async getDeleteAccountRequirements(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.passwordService.getDeleteAccountRequirements(session.user.id);
  }

  @Delete('delete-account')
  async deleteAccount(@Req() req: Request, @Body() dto: DeleteAccountDto) {
    const session = await requireAuthSession(req);
    return this.passwordService.deleteAccount(session.user.id, dto.password);
  }

  @Post('delete-account/cancel')
  async cancelDeleteAccount(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.passwordService.cancelDeleteAccount(session.user.id);
  }

  // ─── 推广试用 —— 注册后调用，检查 promo_trial_days 配置 + 名额限制 ───

  @Post('promo-trial')
  async claimPromoTrial(@Req() req: Request) {
    const session = await requireAuthSession(req);

    // 读取试用配置
    const [daysConfig, maxClaimsConfig, claimedCountConfig] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: 'promo_trial_days' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'promo_trial_max_claims' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'promo_trial_claimed_count' } }),
    ]);

    const days = parseInt(daysConfig?.value || '0', 10);
    const maxClaims = parseInt(maxClaimsConfig?.value || '100', 10);
    const claimedCount = parseInt(claimedCountConfig?.value || '0', 10);

    if (days <= 0) {
      return { granted: false, message: '暂无推广试用活动' };
    }

    if (claimedCount >= maxClaims) {
      return { granted: false, message: `试用名额已满（限前 ${maxClaims} 名），欢迎直接开通会员` };
    }

    // 检查是否已经领过
    const existing = await this.prisma.userMembership.findUnique({
      where: { userId: session.user.id },
    });
    if (existing && existing.expiredAt > new Date()) {
      return { granted: false, message: '您已有有效会员，无需重复领取' };
    }

    // 授予试用天数 + 递增计数（事务保证原子性）
    const now = new Date();
    const plan = await this.prisma.membershipPlan.findFirst({
      where: { level: 'standard' },
    });

    if (!plan) {
      return { granted: false, message: '会员计划不可用' };
    }

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.userMembership.update({
          where: { userId: session.user.id },
          data: {
            status: 'active',
            planId: plan.id,
            expiredAt: new Date(now.getTime() + days * 86400000),
          },
        });
      } else {
        await tx.userMembership.create({
          data: {
            userId: session.user.id,
            planId: plan.id,
            status: 'active',
            expiredAt: new Date(now.getTime() + days * 86400000),
          },
        });
      }

      // 递增已领取人数
      await tx.systemConfig.update({
        where: { key: 'promo_trial_claimed_count' },
        data: { value: String(claimedCount + 1) },
      });
    });

    await this.notificationService.createSystemTargetedNotification(
      session.user.id,
      session.user.id,
      '新人会员已到账',
      `欢迎来到漫语町！系统已为你赠送 ${days} 天漫语会员，可直接体验完整练习权益。`,
    ).catch((error) => {
      console.warn('[Auth] create promo trial notification failed:', error);
    });

    return { granted: true, days, message: `已赠送 ${days} 天会员试用` };
  }
}
