import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PasswordService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 发送忘记密码 OTP
   * 由 Better Auth 的 emailOTP 插件处理发送（开发环境打印到日志）
   * 这里不需要额外操作，直接返回成功即可（前端已经调用了 authClient.emailOtp.sendVerificationOtp）
   */
  async sendResetOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // 不暴露用户是否存在，统一返回成功
      return { message: '如果该邮箱已注册，验证码已发送' };
    }
    return { message: '如果该邮箱已注册，验证码已发送' };
  }

  /**
   * 通过 OTP 重置密码
   * 前端调用 authClient.emailOtp.sendVerificationOtp({ email, type: 'forget-password' }) 发送 OTP
   * 然后调用此接口验证 OTP 并更新密码
   */
  async resetPasswordByOtp(email: string, otp: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('密码至少需要 8 位字符');
    }

    // 从 verification 表查找有效的 OTP 记录
    const verification = await this.prisma.verification.findFirst({
      where: {
        identifier: email,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('验证码已过期或不存在，请重新获取');
    }

    if (verification.value !== otp) {
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

    // 使用 bcrypt 哈希新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 更新密码并清理已使用的验证码
    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: account.id },
        data: { password: hashedPassword },
      }),
      this.prisma.verification.deleteMany({
        where: { identifier: email },
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
   * 删除账户（已登录用户）
   * 需要验证密码以确保安全
   */
  async deleteAccount(userId: string, password: string) {
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

    // 级联删除用户（所有关联数据会被自动清理）
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: '账户已删除' };
  }
}
