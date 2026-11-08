import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OpsAlertService } from '../../../common/ops/ops-alert.service';

type RevenueCatWebhookEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
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
  event_timestamp_ms?: number;
};

type RevenueCatWebhookPayload = {
  api_version?: string;
  event?: RevenueCatWebhookEvent;
};

type MembershipState = {
  userId: string;
  planId: string;
  status: 'active' | 'expired' | 'cancelled';
  expiresAt: Date;
  autoRenew: boolean;
  cancelledAt: Date | null;
  /** Undefined for an RC API snapshot: snapshots never participate in webhook ordering. */
  eventAt?: Date;
  originalTransactionId?: string | null;
  productId?: string | null;
  pendingProductId?: string | null;
  billingIssueAt?: Date | null;
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

  /**
   * 购买/恢复后的服务端补偿同步。使用 v2 subscriptions，避免混用旧 v1 subscriber
   * 响应。有效权益快照永远不参与 webhook 的事件排序，避免 RC 查询传播延迟
   * 压过真实商店事件。空结果只代表当前 API 响应没有可安全解析的权益，绝不
   * 用来回收本地会员；退款与到期仅由带明确事件语义的 webhook 回收。
   */
  async syncCustomerMembership(userId: string) {
    if (!this.apiKey || !process.env.REVENUECAT_PROJECT_ID) {
      return { synced: false, reason: 'not-configured' as const };
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await this.getCustomerSubscriptionSnapshot(userId);
      if (snapshot?.kind === 'active') {
        const plan = await this.findPlanForEntitlements(snapshot.entitlementIds);
        if (plan && snapshot.expiresAt > new Date()) {
          await this.prisma.$transaction((tx) => this.applyMembershipState(tx, {
              userId,
              planId: plan.id,
              status: 'active',
              expiresAt: snapshot.expiresAt,
            autoRenew: snapshot.autoRenew,
            cancelledAt: snapshot.cancelledAt,
            originalTransactionId: snapshot.originalTransactionId,
            productId: snapshot.productId,
            pendingProductId: snapshot.pendingProductId,
            }));
          return { synced: true, active: true };
        }
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    return { synced: true, active: false };
  }

  private async getCustomerSubscriptionSnapshot(userId: string): Promise<{
    kind: 'active';
    entitlementIds: string[];
    expiresAt: Date;
    autoRenew: boolean;
    cancelledAt: Date | null;
    originalTransactionId: string | null;
    productId?: string;
    pendingProductId: string | null;
  } | { kind: 'empty' } | undefined> {
    try {
      const customerResponse = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!customerResponse.ok) {
        this.logger.warn(`RevenueCat 查询用户失败: userId=${userId}, status=${customerResponse.status}`);
        return undefined;
      }
      const customer = await customerResponse.json() as any;
      if (customer?.id !== userId) {
        this.logger.error(`RevenueCat customer ID mismatch: requested=${userId}, received=${customer?.id ?? 'missing'}`);
        return undefined;
      }

      const response = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(userId)}/subscriptions?limit=100`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!response.ok) {
        this.logger.warn(`RevenueCat 查询订阅失败: userId=${userId}, status=${response.status}`);
        return undefined;
      }

      const data = await response.json() as any;
      const subscriptions = Array.isArray(data?.items) ? data.items : [];
      const candidates = subscriptions
        .filter((item: any) => item?.gives_access === true)
        .map((item: any) => {
          const activeEntitlements = (item?.entitlements?.items ?? [])
            .filter((entitlement: any) => entitlement?.state === 'active');
          const entitlementIds = activeEntitlements
            .map((entitlement: any) => entitlement?.lookup_key)
            .filter(Boolean);
          // subscriptions[].product_id is an RC resource ID. The matching
          // store product lives under the active entitlement's products list.
          const storeProductId = activeEntitlements
            .flatMap((entitlement: any) => entitlement?.products?.items ?? [])
            .find((product: any) => product?.id === item?.product_id)
            ?.store_identifier;
          const autoRenewalStatus = item?.auto_renewal_status;
          const hasAlreadyRenewed = autoRenewalStatus === 'has_already_renewed';
          const expiresAtMs = hasAlreadyRenewed
            ? item?.ends_at ?? item?.current_period_ends_at
            : item?.current_period_ends_at ?? item?.ends_at;
          const pendingProductId = autoRenewalStatus === 'will_change_product'
            ? item?.pending_changes?.product?.store_identifier ?? null
            : null;
          return {
            entitlementIds,
            expiresAt: typeof expiresAtMs === 'number' ? new Date(expiresAtMs) : null,
            autoRenew: autoRenewalStatus === 'will_renew' || autoRenewalStatus === 'will_change_product' || hasAlreadyRenewed,
            cancelledAt: autoRenewalStatus === 'will_renew' || autoRenewalStatus === 'will_change_product' || hasAlreadyRenewed ? null : new Date(),
            originalTransactionId: item?.store_subscription_identifier != null
              ? String(item.store_subscription_identifier)
              : null,
            productId: storeProductId != null ? String(storeProductId) : undefined,
            pendingProductId,
          };
        })
        .filter((item: any) => item.entitlementIds.length > 0 && item.expiresAt instanceof Date && item.expiresAt > new Date())
        .sort((a: any, b: any) => b.expiresAt.getTime() - a.expiresAt.getTime());

      return candidates[0] ? { kind: 'active' as const, ...candidates[0] } : { kind: 'empty' as const };
    } catch (error) {
      this.logger.error('RevenueCat 查询订阅异常', error);
      return undefined;
    }
  }

  /** 列出订阅用户（分页） */
  async listSubscribers(params: { page?: number; pageSize?: number }): Promise<{
    list: Array<{
      userId: string;
      entitlements: Record<string, { productId: string; expiresDate: string | null; isActive: boolean; store: string }>;
      firstSeen: string;
      lastSeen: string;
    }>;
    total: number;
  } | null> {
    if (!this.apiKey) return null;

    try {
      const { page = 1, pageSize = 20 } = params;
      const response = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers?` +
        new URLSearchParams({
          limit: String(pageSize),
          starting_after_id: '',
        }).toString(),
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
        },
      );

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`RevenueCat 查询订阅列表失败: ${response.status} ${err}`);
        return null;
      }

      const data = await response.json() as any;
      const items = (data?.items || []).map((c: any) => ({
        userId: c.id || '',
        entitlements: Object.fromEntries(
          Object.entries(c.entitlements || {}).map(([key, ent]: [string, any]) => [
            key,
            {
              productId: ent.product_identifier || '',
              expiresDate: ent.expires_date || null,
              isActive: ent.expires_date ? new Date(ent.expires_date) > new Date() : false,
              store: ent.store || 'unknown',
            },
          ]),
        ),
        firstSeen: c.first_seen || '',
        lastSeen: c.last_seen || '',
      }));

      const total = items.length;

      return {
        list: items.slice((page - 1) * pageSize, page * pageSize),
        total,
      };
    } catch (error) {
      this.logger.error('RevenueCat 查询订阅列表异常', error);
      return null;
    }
  }

  /** 获取单个订阅用户详情 */
  async getSubscriberDetail(userId: string): Promise<any | null> {
    if (!this.apiKey) return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers/${userId}`,
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
        },
      );

      if (!response.ok) return null;

      const data = await response.json() as any;
      const c = data?.subscriber || {};
      const entitlements = c.entitlements || {};

      return {
        userId: c.app_user_id || userId,
        originalAppUserId: c.original_app_user_id || '',
        firstSeen: c.first_seen || '',
        lastSeen: c.last_seen || '',
        managementUrl: c.management_url || '',
        entitlements: Object.entries(entitlements).map(([key, ent]: [string, any]) => ({
          id: key,
          productId: ent.product_identifier || '',
          purchasedAt: ent.purchase_date || '',
          expiresDate: ent.expires_date || '',
          isActive: ent.expires_date ? new Date(ent.expires_date) > new Date() : false,
          isSandbox: ent.is_sandbox || false,
          store: ent.store || 'unknown',
          unsubscribeDetectedAt: ent.unsubscribe_detected_at || null,
          billingIssueDetectedAt: ent.billing_issue_detected_at || null,
        })),
      };
    } catch (error) {
      this.logger.error('RevenueCat 查询订阅详情异常', error);
      return null;
    }
  }

  async handleWebhook(payload: RevenueCatWebhookPayload) {
    const event = payload?.event;
    if (!event?.type || !event.id || typeof event.event_timestamp_ms !== 'number') {
      throw new BadRequestException('Missing RevenueCat event id, type, or timestamp');
    }

    const eventType = event.type;
    if (eventType === 'TRANSFER') {
      return this.handleTransferWebhook(event);
    }

    const userId = await this.resolveKnownUserId(event);
    if (!userId) {
      // Purchases created before identify can legitimately carry an anonymous
      // ID. Persist the delivery for audit/dedupe but never attempt an FK write.
      await this.recordIgnoredWebhook(event, event.app_user_id || event.aliases?.[0] || 'unknown');
      this.logger.warn(`RevenueCat webhook ignored for unknown app user: type=${eventType}`);
      return { success: true, ignored: true };
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
      return this.recordAndApplyWebhook(event, userId, () => this.activeStateFromWebhook(userId, plan.id, event));
    }

    if (CANCELLED_EVENT_TYPES.has(eventType)) {
      return this.recordAndApplyWebhook(event, userId, () => this.cancelledStateFromWebhook(userId, plan.id, event));
    }

    if (EXPIRED_EVENT_TYPES.has(eventType)) {
      return this.recordAndApplyWebhook(event, userId, () => this.expiredStateFromWebhook(userId, plan.id, event, eventType));
    }

    if (eventType === 'BILLING_ISSUE') {
      const result = await this.recordAndApplyWebhook(event, userId, () => this.billingIssueStateFromWebhook(userId, plan.id, event));
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
      return result;
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

  private async resolveKnownUserId(event: RevenueCatWebhookEvent) {
    const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])]
      .filter((id): id is string => !!id);
    if (candidates.length === 0) return null;
    const users = await this.prisma.user.findMany({
      where: { id: { in: candidates } },
      select: { id: true },
    });
    const known = new Set(users.map((user) => user.id));
    return candidates.find((id) => known.has(id)) ?? null;
  }

  private async recordIgnoredWebhook(event: RevenueCatWebhookEvent, userId: string) {
    try {
      await this.prisma.revenueCatWebhookEvent.create({
        data: { eventId: event.id!, userId, eventType: event.type!, eventAt: this.getEventDate(event), payload: event as object },
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
    }
  }

  private async handleTransferWebhook(event: RevenueCatWebhookEvent) {
    const destinationUserId = await this.resolveKnownUserId({
      ...event,
      app_user_id: event.transferred_to?.[0],
      aliases: event.transferred_to,
    });
    const sourceIds = event.transferred_from ?? [];
    const eventAt = this.getEventDate(event);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.revenueCatWebhookEvent.create({
          data: {
            eventId: event.id!,
            userId: destinationUserId ?? event.transferred_to?.[0] ?? 'unknown',
            eventType: event.type!,
            eventAt,
            payload: event as object,
          },
        });

        if (sourceIds.length > 0) {
          await tx.userMembership.updateMany({
            where: {
              userId: { in: sourceIds.filter((id) => id !== destinationUserId) },
              rcCustomerId: { in: sourceIds },
              OR: [{ lastEventAt: null }, { lastEventAt: { lt: eventAt } }],
            },
            data: { status: 'expired', expiredAt: eventAt, autoRenew: false, cancelledAt: eventAt, lastEventAt: eventAt },
          });
        }
      });
    } catch (error: any) {
      if (error?.code === 'P2002') return { success: true, duplicate: true };
      throw error;
    }

    if (destinationUserId) await this.syncCustomerMembership(destinationUserId);
    return { success: true };
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

  private getEventDate(event: RevenueCatWebhookEvent) {
    return new Date(event.event_timestamp_ms!);
  }

  private async recordAndApplyWebhook(
    event: RevenueCatWebhookEvent,
    userId: string,
    getState: () => MembershipState | null,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.revenueCatWebhookEvent.create({
          data: {
            eventId: event.id!,
            userId,
            eventType: event.type!,
            eventAt: this.getEventDate(event),
            payload: event as object,
          },
        });
        const state = getState();
        if (state) await this.applyMembershipState(tx, state);
      });
      return { success: true };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return { success: true, duplicate: true };
      }
      throw error;
    }
  }

  private async applyMembershipState(tx: any, params: MembershipState) {
    const existing = await tx.userMembership.findUnique({ where: { userId: params.userId } });
    const isWebhook = !!params.eventAt;

    if (isWebhook && existing?.lastEventAt && existing.lastEventAt >= params.eventAt!) return;

    // A late cancellation/expiration for the replaced monthly product must not
    // revoke a newer annual subscription. Its earlier expiration proves it is
    // no longer the entitlement currently giving access.
    if (
      isWebhook &&
      params.status !== 'active' &&
      existing?.status === 'active' &&
      existing.expiredAt > params.expiresAt
    ) return;

    // RC API snapshots are useful after purchase/restore, but never own the
    // webhook clock. Do not let a briefly stale snapshot shorten access.
    if (!isWebhook && existing?.status === 'active' && existing.expiredAt > params.expiresAt) return;

    await tx.userMembership.upsert({
        where: { userId: params.userId },
        create: {
          userId: params.userId,
          planId: params.planId,
          status: params.status,
          rcCustomerId: params.userId,
          expiredAt: params.expiresAt,
          autoRenew: params.autoRenew,
          cancelledAt: params.cancelledAt,
          lastEventAt: params.eventAt ?? null,
          originalTransactionId: params.originalTransactionId ?? null,
          rcProductId: params.productId ?? null,
          pendingProductId: params.pendingProductId ?? null,
          billingIssueAt: params.billingIssueAt ?? null,
        },
        update: {
          planId: params.planId,
          status: params.status,
          rcCustomerId: params.userId,
          expiredAt: params.expiresAt,
          autoRenew: params.autoRenew,
          cancelledAt: params.cancelledAt,
          ...(isWebhook ? { lastEventAt: params.eventAt } : {}),
          ...(params.originalTransactionId ? { originalTransactionId: params.originalTransactionId } : {}),
          ...(params.productId !== undefined ? { rcProductId: params.productId } : {}),
          ...(params.pendingProductId !== undefined ? { pendingProductId: params.pendingProductId } : {}),
          ...(params.billingIssueAt !== undefined ? { billingIssueAt: params.billingIssueAt } : {}),
        },
    });
  }

  private activeStateFromWebhook(
    userId: string,
    planId: string,
    event: RevenueCatWebhookEvent,
  ): MembershipState | null {
    const now = new Date();
    const expiredAt = this.getExpirationDate(event);

    if (!expiredAt || expiredAt <= now) {
      this.logger.warn(`RevenueCat active event without future expiration: type=${event.type}, userId=${userId}`);
      return null;
    }
    return {
      userId, planId, status: 'active', expiresAt: expiredAt, autoRenew: true,
      cancelledAt: null, eventAt: this.getEventDate(event),
      originalTransactionId: event.original_transaction_id ?? event.transaction_id ?? null,
      productId: event.product_id ?? null,
      pendingProductId: null,
      billingIssueAt: null,
    };
  }

  private cancelledStateFromWebhook(userId: string, planId: string, event: RevenueCatWebhookEvent): MembershipState {
    const now = new Date();
    const expiredAt = this.getExpirationDate(event);
    const remainsActive = !!expiredAt && expiredAt > now;

    return {
      userId, planId, status: remainsActive ? 'active' : 'cancelled', expiresAt: expiredAt ?? now,
      autoRenew: false, cancelledAt: now, eventAt: this.getEventDate(event),
      originalTransactionId: event.original_transaction_id ?? event.transaction_id ?? null,
      productId: event.product_id ?? null,
      pendingProductId: null,
      billingIssueAt: null,
    };
  }

  private expiredStateFromWebhook(
    userId: string,
    planId: string,
    event: RevenueCatWebhookEvent,
    eventType: string,
  ): MembershipState {
    const now = new Date();
    const expiredAt = this.getExpirationDate(event) ?? now;

    return {
      userId, planId, status: eventType === 'REFUND' ? 'cancelled' : 'expired', expiresAt: expiredAt,
      autoRenew: false, cancelledAt: eventType === 'REFUND' ? now : null,
      eventAt: this.getEventDate(event),
      originalTransactionId: event.original_transaction_id ?? event.transaction_id ?? null,
      productId: event.product_id ?? null,
      pendingProductId: null,
      billingIssueAt: null,
    };
  }

  private billingIssueStateFromWebhook(userId: string, planId: string, event: RevenueCatWebhookEvent): MembershipState {
    const now = new Date();
    const expiredAt = this.getExpirationDate(event);

    if (!expiredAt || expiredAt <= now) {
      return this.expiredStateFromWebhook(userId, planId, event, 'EXPIRATION');
    }
    return {
      userId, planId, status: 'active', expiresAt: expiredAt, autoRenew: false,
      cancelledAt: null, eventAt: this.getEventDate(event),
      originalTransactionId: event.original_transaction_id ?? event.transaction_id ?? null,
      productId: event.product_id ?? null,
      pendingProductId: null,
      billingIssueAt: this.getEventDate(event),
    };
  }
}
