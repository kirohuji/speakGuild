import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { hashPassword } from 'better-auth/crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly deletionGracePeriodMs = 7 * 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 发送前确认邮箱已注册。未注册时 Better Auth 仍会返回成功且不发信，
   * 这里明确告诉前端，避免页面看起来像已经发出验证码。
   */
  async sendResetOtp(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'EMAIL_NOT_REGISTERED',
        message: '该邮箱尚未注册',
      });
    }
    return { message: '邮箱已注册' };
  }

  /**
   * 通过 OTP 重置密码
   * 前端先调用 authClient.emailOtp.sendVerificationOtp({ email, type: 'forget-password' })
   * 再调用此接口核对 verification 表中的 OTP 并更新密码
   */
  async resetPasswordByOtp(email: string, otp: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('密码至少需要 8 位字符');
    }

    // Better Auth emailOTP 的 identifier 是 `forget-password-otp-<email>`，value 是 `<otp>:<attempts>`
    const identifier = `forget-password-otp-${email}`;
    const verification = await this.prisma.verification.findFirst({
      where: {
        identifier,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('验证码已过期或不存在，请重新获取');
    }

    const separator = verification.value.lastIndexOf(':');
    const storedOtp = separator === -1 ? verification.value : verification.value.slice(0, separator);
    const attempts = separator === -1 ? 0 : Number(verification.value.slice(separator + 1));
    if (Number.isFinite(attempts) && attempts >= 3) {
      throw new BadRequestException('验证码错误次数过多，请重新获取');
    }

    if (storedOtp !== otp) {
      await this.prisma.verification.update({
        where: { id: verification.id },
        data: { value: `${storedOtp}:${(Number.isFinite(attempts) ? attempts : 0) + 1}` },
      });
      throw new BadRequestException('验证码错误');
    }

    // 查找用户的 credential account
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const account = await this.prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: 'credential',
      },
    });

    if (!account) {
      throw new BadRequestException('该账号使用第三方登录，无法重置密码');
    }

    // 与登录校验同一套哈希（Better Auth 使用 scrypt，不能再用 bcrypt）
    const hashedPassword = await hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: account.id },
        data: { password: hashedPassword },
      }),
      this.prisma.verification.deleteMany({
        where: { identifier },
      }),
    ]);

    return { message: '密码重置成功' };
  }

  /**
   * 修改密码（已登录用户）
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('密码至少需要 8 位字符');
    }

    // 查找用户的 credential account
    const account = await this.prisma.account.findFirst({
      where: {
        userId,
        providerId: 'credential',
      },
    });

    if (!account) {
      throw new BadRequestException('该账号使用第三方登录，无法修改密码');
    }

    // 验证当前密码
    const isValid = await bcrypt.compare(currentPassword, account.password || '');
    if (!isValid) {
      throw new BadRequestException('当前密码错误');
    }

    // 新密码不能与旧密码相同
    const isSamePassword = await bcrypt.compare(newPassword, account.password || '');
    if (isSamePassword) {
      throw new BadRequestException('新密码不能与旧密码相同');
    }

    // 哈希并更新新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await this.prisma.account.update({
      where: { id: account.id },
      data: { password: hashedPassword },
    });

    return { message: '密码修改成功' };
  }

  /**
   * 查询注销账户是否需要密码确认。
   * 第三方登录账号可能没有 credential 密码，前端应展示二次确认而不是密码框。
   */
  async getDeleteAccountRequirements(userId: string) {
    const [user, credentialAccount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          deletionRequestedAt: true,
          deletionScheduledAt: true,
        },
      }),
      this.prisma.account.findFirst({
        where: {
          userId,
          providerId: 'credential',
        },
        select: { id: true },
      }),
    ]);

    return {
      requiresPassword: !!credentialAccount,
      deletionRequestedAt: user?.deletionRequestedAt ?? null,
      deletionScheduledAt: user?.deletionScheduledAt ?? null,
      gracePeriodDays: 7,
    };
  }

  /**
   * 申请删除账户（已登录用户）。
   * 为避免误操作，账号会进入 7 天缓冲期，到期后由定时任务真正删除。
   */
  async deleteAccount(userId: string, password?: string) {
    // 验证密码
    const account = await this.prisma.account.findFirst({
      where: {
        userId,
        providerId: 'credential',
      },
    });

    if (account) {
      // 有密码的账号需要验证密码
      if (!password) {
        throw new BadRequestException('请输入密码以确认删除');
      }
      const isValid = await bcrypt.compare(password, account.password || '');
      if (!isValid) {
        throw new BadRequestException('密码错误');
      }
    }

    const now = new Date();
    const scheduledAt = new Date(now.getTime() + this.deletionGracePeriodMs);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletionRequestedAt: now,
        deletionScheduledAt: scheduledAt,
      },
    });

    return {
      message: '注销申请已提交',
      deletionScheduledAt: scheduledAt,
      gracePeriodDays: 7,
    };
  }

  async cancelDeleteAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletionRequestedAt: null,
        deletionScheduledAt: null,
      },
    });

    return { message: '注销申请已取消' };
  }

  @Cron('0 20 3 * * *')
  async purgeExpiredDeletionRequests() {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: {
        deletionScheduledAt: { lte: now },
      },
      select: { id: true },
      take: 100,
    });

    if (users.length === 0) return;

    for (const user of users) {
      try {
        await this.prisma.user.delete({ where: { id: user.id } });
      } catch (error) {
        this.logger.warn(`清理注销账号失败 userId=${user.id}: ${String(error)}`);
      }
    }

    this.logger.log(`已清理 ${users.length} 个到期注销账号`);
  }
}
