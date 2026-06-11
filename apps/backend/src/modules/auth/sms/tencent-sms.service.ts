import { Injectable, Logger } from '@nestjs/common';

// 使用腾讯云官方 SMS SDK（v2021-01-11）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tencentSms = require('tencentcloud-sdk-nodejs-sms');
const SmsClient = tencentSms.sms.v20210111.Client;

/** 同一手机号两次发送的最小间隔（秒） */
const SEND_COOLDOWN_SECONDS = 60;

interface SendRecord {
  /** 上次发送时间戳（ms） */
  lastSentAt: number;
  /** 上次发送的验证码（用于判断是否仍然有效） */
  code: string;
}

@Injectable()
export class TencentSmsService {
  private readonly logger = new Logger(TencentSmsService.name);
  private client: InstanceType<typeof SmsClient> | null = null;

  /** 内存中的发送记录：key = 规范化手机号 */
  private readonly sendRecords = new Map<string, SendRecord>();

  /** 定期清理过期记录（每 5 分钟） */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const secretId = process.env.TENCENT_SECRET_ID?.trim();
    const secretKey = process.env.TENCENT_SECRET_KEY?.trim();

    if (!secretId || !secretKey) {
      this.logger.warn(
        'TENCENT_SECRET_ID or TENCENT_SECRET_KEY not configured, SMS will be disabled',
      );
      return;
    }

    this.client = new SmsClient({
      credential: { secretId, secretKey },
      region: process.env.TENCENT_REGION?.trim() || 'ap-guangzhou',
      profile: {
        httpProfile: {
          reqTimeout: 10, // 10 秒超时
        },
      },
    });

    // 每 5 分钟清理一次过期的发送记录（避免内存泄漏）
    this.cleanupTimer = setInterval(() => this.cleanupStaleRecords(), 5 * 60 * 1000);

    this.logger.log('TencentSmsService initialized');
  }

  /**
   * 检查是否可以发送验证码
   * @returns 剩余冷却秒数（0 表示可以发送）
   */
  getCooldownRemaining(phoneNumber: string): number {
    const key = this.normalizePhoneNumber(phoneNumber);
    const record = this.sendRecords.get(key);
    if (!record) return 0;

    const elapsed = (Date.now() - record.lastSentAt) / 1000;
    const remaining = Math.ceil(SEND_COOLDOWN_SECONDS - elapsed);
    return Math.max(0, remaining);
  }

  /**
   * 发送短信验证码
   *
   * @param phoneNumber - 手机号
   * @param code - 6 位数字验证码
   * @returns `{ sent: true }` 发送成功，`{ sent: false, cooldown: number }` 冷却中
   */
  async sendVerificationCode(
    phoneNumber: string,
    code: string,
  ): Promise<{ sent: boolean; cooldown: number }> {
    const key = this.normalizePhoneNumber(phoneNumber);

    // ── 冷却检查 ──
    const cooldown = this.getCooldownRemaining(phoneNumber);
    if (cooldown > 0) {
      this.logger.warn(
        `[SMS] Rate limited: ${this.maskPhone(key)}, cooldown remaining=${cooldown}s`,
      );
      return { sent: false, cooldown };
    }

    // ── 记录发送时间（先记录，防止并发重复发送）──
    this.sendRecords.set(key, { lastSentAt: Date.now(), code });

    // ── 未配置客户端 → dev mock 模式 ──
    if (!this.client) {
      this.logger.warn(`[SMS] Client not initialized, skip sending to ${this.maskPhone(phoneNumber)}`);
      return { sent: false, cooldown: 0 };
    }

    const appId = process.env.TENCENT_SMS_APP_ID?.trim();
    const signName = process.env.TENCENT_SMS_SIGN_NAME?.trim();
    const templateId = process.env.TENCENT_SMS_TEMPLATE_ID?.trim();

    if (!appId || !signName || !templateId) {
      this.logger.warn(
        `[SMS] Missing config: appId=${!!appId} signName=${!!signName} templateId=${!!templateId}`,
      );
      return { sent: false, cooldown: 0 };
    }

    try {
      const response = await this.client.SendSms({
        PhoneNumberSet: [key],
        SmsSdkAppId: appId,
        SignName: signName,
        TemplateId: templateId,
        TemplateParamSet: [code],
      });

      const status = response.SendStatusSet?.[0];
      if (status?.Code === 'Ok') {
        this.logger.log(
          `[SMS] Sent to ${this.maskPhone(key)}, serial=${status.SerialNo}`,
        );
        return { sent: true, cooldown: 0 };
      }

      this.logger.error(
        `[SMS] Failed to send to ${this.maskPhone(key)}: [${status?.Code}] ${status?.Message}`,
      );
      // 发送失败时清除记录，允许立即重试
      this.sendRecords.delete(key);
      return { sent: false, cooldown: 0 };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SMS] Exception sending to ${this.maskPhone(phoneNumber)}: ${message}`);
      // 异常时清除记录，允许重试
      this.sendRecords.delete(key);
      return { sent: false, cooldown: 0 };
    }
  }

  /**
   * 清理超过冷却时间 2 倍的过期记录
   */
  private cleanupStaleRecords(): void {
    const cutoff = Date.now() - SEND_COOLDOWN_SECONDS * 2 * 1000;
    for (const [key, record] of this.sendRecords) {
      if (record.lastSentAt < cutoff) {
        this.sendRecords.delete(key);
      }
    }
  }

  /**
   * 规范化手机号为 E.164 格式（+86xxxxxxxxxxx）
   */
  private normalizePhoneNumber(phone: string): string {
    // 去掉空格和横线
    const cleaned = phone.replace(/[\s-]/g, '');

    // 已经是 +86 开头，直接返回
    if (cleaned.startsWith('+86')) return cleaned;

    // 0086 开头 → +86
    if (cleaned.startsWith('0086')) return '+86' + cleaned.slice(4);

    // 纯 11 位数字 → +86
    if (/^\d{11}$/.test(cleaned)) return '+86' + cleaned;

    // 其他情况原样返回
    return cleaned;
  }

  /**
   * 手机号脱敏显示（日志用）
   * +8613800000000 → +86138****000
   */
  private maskPhone(phone: string): string {
    if (phone.length < 8) return '***';
    return phone.slice(0, 6) + '****' + phone.slice(-3);
  }
}
