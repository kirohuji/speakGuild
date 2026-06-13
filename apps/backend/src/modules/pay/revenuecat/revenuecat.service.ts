import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OpsAlertService } from '../../../common/ops/ops-alert.service';

type RevenueCatWebhookEvent = {
  type?: string;
  app_user_id?: string;
  aliases?: string[];
  entitlement_id?: string;
  entitlement_ids?: string[];
  product_id?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  transaction_id?: string;
  original_transaction_id?: string;
  period_type?: string;
  environment?: string;
  store?: string;
};

type RevenueCatWebhookPayload = {
  api_version?: string;
  event?: RevenueCatWebhookEvent;
};

const ACTIVE_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

const EXPIRED_EVENT_TYPES = new Set([
  'EXPIRATION',
  'REFUND',
]);

const CANCELLED_EVENT_TYPES = new Set([
  'CANCELLATION',
]);

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  private readonly baseUrl = 'https://api.revenuecat.com/v2';
  private readonly apiKey: string | undefined;
  private readonly webhookAuthorization: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: OpsAlertService,
  ) {
    this.apiKey = process.env.REVENUECAT_API_KEY;
    this.webhookAuthorization =
      process.env.REVENUECAT_WEBHOOK_AUTHORIZATION ||
      process.env.REVENUECAT_WEBHOOK_SECRET;

    if (this.apiKey) {
      this.logger.log('RevenueCat 服务已初始化');
    } else {
      this.logger.warn('REVENUECAT_API_KEY 未配置，RevenueCat 同步将跳过');
    }

    if (!this.webhookAuthorization) {
      this.logger.warn('REVENUECAT_WEBHOOK_AUTHORIZATION 未配置，RevenueCat webhook 将不校验 Authorization');
    }
  }

  verifyWebhookAuthorization(header: string | string[] | undefined) {
    if (!this.webhookAuthorization) return;

    const value = Array.isArray(header) ? header[0] : header;
    const expected = this.webhookAuthorization.startsWith('Bearer ')
      ? this.webhookAuthorization
      : `Bearer ${this.webhookAuthorization}`;

    if (value !== expected && value !== this.webhookAuthorization) {
      throw new UnauthorizedException('Invalid RevenueCat webhook authorization');
    }
  }

  /** 为 Web 端支付用户授予 RevenueCat 权益 */
  async grantEntitlement(params: {
    userId: string;
    entitlementId: string;
    durationDays: number;
  }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.log(`[RevenueCat Mock] 授予权益: userId=${params.userId}, entitlement=${params.entitlementId}`);
      return true;
    }

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + params.durationDays * 24 * 60 * 60 * 1000);

      const response = await fetch(
        `${this.baseUrl}/project/${process.env.REVENUECAT_PROJECT_ID}/customers/${params.userId}/entitlements`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entitlement_id: params.entitlementId,
            expiration_date: expiresAt.toISOString(),
            store: 'PROMOTIONAL',
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`RevenueCat 授予权益失败: ${response.status} ${errorBody}`);
        return false;
      }

      this.logger.log(`RevenueCat 权益已授予: userId=${params.userId}, entitlement=${params.entitlementId}`);
      return true;
    } catch (error) {
      this.logger.error('RevenueCat API 调用异常', error);
      return false;
    }
  }

  /** 获取用户的权益状态 */
  async getCustomerInfo(userId: string): Promise<{
    activeEntitlements: string[];
    isActive: boolean;
  } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/project/${process.env.REVENUECAT_PROJECT_ID}/customers/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as any;
      const entitlements = data?.customer?.entitlements || {};
      const activeIds: string[] = [];

      for (const key of Object.keys(entitlements)) {
        const ent = entitlements[key];
        if (ent?.expires_date && new Date(ent.expires_date) > new Date()) {
          activeIds.push(key);
        }
      }

      return {
        activeEntitlements: activeIds,
        isActive: activeIds.length > 0,
      };
    } catch (error) {
      this.logger.error('RevenueCat 查询用户信息异常', error);
      return null;
    }
  }

  async handleWebhook(payload: RevenueCatWebhookPayload) {
    const event = payload?.event;
    if (!event?.type) {
      throw new BadRequestException('Missing RevenueCat event type');
    }

    const eventType = event.type;
    const userId = event.app_user_id || event.aliases?.[0];
    if (!userId) {
      throw new BadRequestException('Missing RevenueCat app_user_id');
    }

    const entitlementIds = this.getEntitlementIds(event);
    if (entitlementIds.length === 0) {
      this.logger.warn(`RevenueCat webhook ignored without entitlement: type=${eventType}, userId=${userId}`);
      return { success: true, ignored: true };
    }

    const plan = await this.findPlanForEntitlements(entitlementIds);
    if (!plan) {
      this.logger.warn(
        `RevenueCat webhook ignored without matching plan: type=${eventType}, userId=${userId}, entitlements=${entitlementIds.join(',')}`,
      );
      return { success: true, ignored: true };
    }

    if (ACTIVE_EVENT_TYPES.has(eventType)) {
      await this.activateFromWebhook(userId, plan.id, event);
      return { success: true };
    }

    if (CANCELLED_EVENT_TYPES.has(eventType)) {
      await this.markCancelledFromWebhook(userId, plan.id, event);
      return { success: true };
    }

    if (EXPIRED_EVENT_TYPES.has(eventType)) {
      await this.markExpiredFromWebhook(userId, plan.id, event, eventType);
      return { success: true };
    }

    if (eventType === 'BILLING_ISSUE') {
      await this.markBillingIssueFromWebhook(userId, plan.id, event);
      await this.alerts.notify({
        key: 'revenuecat-billing-issue',
        title: 'RevenueCat 订阅扣费异常',
        severity: 'warning',
        details: {
          userId,
          productId: event.product_id,
          environment: event.environment,
          store: event.store,
        },
      });
      return { success: true };
    }

    this.logger.log(`RevenueCat webhook ignored: type=${eventType}, userId=${userId}`);
    return { success: true, ignored: true };
  }

  private getEntitlementIds(event: RevenueCatWebhookEvent) {
    const ids = [
      ...(event.entitlement_ids ?? []),
      event.entitlement_id,
    ].filter((item): item is string => !!item);

    return Array.from(new Set(ids));
  }

  private async findPlanForEntitlements(entitlementIds: string[]) {
    const plan = await this.prisma.membershipPlan.findFirst({
      where: {
        revenueCatEntitlementId: { in: entitlementIds },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return plan;
  }

  private getExpirationDate(event: RevenueCatWebhookEvent) {
    if (typeof event.expiration_at_ms === 'number' && event.expiration_at_ms > 0) {
      return new Date(event.expiration_at_ms);
    }

    return null;
  }

  private getPurchasedDate(event: RevenueCatWebhookEvent) {
    if (typeof event.purchased_at_ms === 'number' && event.purchased_at_ms > 0) {
      return new Date(event.purchased_at_ms);
    }

    return new Date();
  }

  private async activateFromWebhook(
    userId: string,
    planId: string,
    event: RevenueCatWebhookEvent,
  ) {
    const now = new Date();
    const expiredAt = this.getExpirationDate(event);

    if (!expiredAt || expiredAt <= now) {
      this.logger.warn(`RevenueCat active event without future expiration: type=${event.type}, userId=${userId}`);
      return;
    }

    await this.prisma.userMembership.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        status: 'active',
        rcCustomerId: userId,
        startedAt: this.getPurchasedDate(event),
        expiredAt,
        autoRenew: true,
      },
      update: {
        planId,
        status: 'active',
        rcCustomerId: userId,
        expiredAt,
        autoRenew: true,
        cancelledAt: null,
      },
    });

    this.logger.log(
      `RevenueCat membership active: userId=${userId}, product=${event.product_id}, expires=${expiredAt.toISOString()}`,
    );
  }

  private async markCancelledFromWebhook(userId: string, planId: string, event: RevenueCatWebhookEvent) {
    const now = new Date();
    const expiredAt = this.getExpirationDate(event);
    const remainsActive = !!expiredAt && expiredAt > now;

    await this.prisma.userMembership.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        status: remainsActive ? 'active' : 'cancelled',
        rcCustomerId: userId,
        expiredAt: expiredAt ?? now,
        autoRenew: false,
        cancelledAt: now,
      },
      update: {
        planId,
        status: remainsActive ? 'active' : 'cancelled',
        rcCustomerId: userId,
        expiredAt: expiredAt ?? now,
        autoRenew: false,
        cancelledAt: now,
      },
    });

    this.logger.log(`RevenueCat membership cancelled: userId=${userId}, activeUntil=${expiredAt?.toISOString() ?? 'now'}`);
  }

  private async markExpiredFromWebhook(
    userId: string,
    planId: string,
    event: RevenueCatWebhookEvent,
    eventType: string,
  ) {
    const now = new Date();
    const expiredAt = this.getExpirationDate(event) ?? now;

    await this.prisma.userMembership.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        status: eventType === 'REFUND' ? 'cancelled' : 'expired',
        rcCustomerId: userId,
        expiredAt,
        autoRenew: false,
        cancelledAt: eventType === 'REFUND' ? now : null,
      },
      update: {
        planId,
        status: eventType === 'REFUND' ? 'cancelled' : 'expired',
        rcCustomerId: userId,
        expiredAt,
        autoRenew: false,
        cancelledAt: eventType === 'REFUND' ? now : undefined,
      },
    });

    this.logger.log(`RevenueCat membership ${eventType.toLowerCase()}: userId=${userId}`);
  }

  private async markBillingIssueFromWebhook(userId: string, planId: string, event: RevenueCatWebhookEvent) {
    const now = new Date();
    const expiredAt = this.getExpirationDate(event);

    if (!expiredAt || expiredAt <= now) {
      await this.markExpiredFromWebhook(userId, planId, event, 'EXPIRATION');
      return;
    }

    await this.prisma.userMembership.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        status: 'active',
        rcCustomerId: userId,
        expiredAt,
        autoRenew: false,
      },
      update: {
        planId,
        status: 'active',
        rcCustomerId: userId,
        expiredAt,
        autoRenew: false,
      },
    });

    this.logger.warn(`RevenueCat billing issue: userId=${userId}, activeUntil=${expiredAt.toISOString()}`);
  }
}
