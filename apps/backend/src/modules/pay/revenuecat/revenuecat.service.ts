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
  rcCustomerId?: string | null;
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
  private readonly productInfoCache = new Map<string, { storeIdentifier: string | null; duration: string | null }>();
  /** Kept in process only; the durable webhook deliveries remain the denominator. */
  private readonly webhookFailures: Date[] = [];

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

    let active = false;
    for (let attempt = 0; attempt < 3 && !active; attempt += 1) {
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
            rcCustomerId: snapshot.customerId || userId,
            pendingProductId: snapshot.pendingProductId,
            }));
          active = true;
          break;
        }
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    await this.syncPurchaseLedger(userId);
    return { synced: true, active };
  }

  private async getCustomerSubscriptionSnapshot(userId: string): Promise<{
    kind: 'active';
    entitlementIds: string[];
    expiresAt: Date;
    autoRenew: boolean;
    cancelledAt: Date | null;
    originalTransactionId: string | null;
    productId?: string;
    customerId?: string;
    pendingProductId: string | null;
  } | { kind: 'empty' } | undefined> {
    try {
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
      const candidates = (await Promise.all(subscriptions
        .filter((item: any) => item?.gives_access === true)
        .map(async (item: any) => {
          const activeEntitlements = (item?.entitlements?.items ?? [])
            .filter((entitlement: any) => entitlement?.state === 'active');
          const entitlementIds = activeEntitlements
            .map((entitlement: any) => entitlement?.lookup_key)
            .filter(Boolean);
          // subscriptions[].product_id is an RC resource ID. The matching
          // store product lives under the active entitlement's products list,
          // and otherwise on the product resource itself.
          const embeddedStoreProductId = activeEntitlements
            .flatMap((entitlement: any) => entitlement?.products?.items ?? [])
            .find((product: any) => product?.id === item?.product_id)
            ?.store_identifier;
          const product = await this.getProductInfo(item?.product_id);
          const storeProductId = embeddedStoreProductId ?? product?.storeIdentifier;
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
            customerId: item?.customer_id != null ? String(item.customer_id) : userId,
            pendingProductId,
          };
        })))
        .filter((item: any) => item.entitlementIds.length > 0 && item.expiresAt instanceof Date && item.expiresAt > new Date())
        .sort((a: any, b: any) => b.expiresAt.getTime() - a.expiresAt.getTime());

      return candidates[0] ? { kind: 'active' as const, ...candidates[0] } : { kind: 'empty' as const };
    } catch (error) {
      this.logger.error('RevenueCat 查询订阅异常', error);
      return undefined;
    }
  }

  /**
   * 把这个本地用户在 RevenueCat 上的订阅写成购买记录，并把 RevenueCat customer id
   * 绑到已有会员上。购买同步和购买记录都走这里，避免再从全量客户目录里反查用户。
   */
  async syncPurchaseLedger(userId: string): Promise<Array<{ id: string; kind: 'monthly' | 'yearly'; purchasedAt: string; expiresAt: string | null }> | null> {
    const loaded = await this.loadCustomerPurchases(userId);
    if (!loaded) return null;

    const { purchases, customerId } = loaded;
    if (customerId) {
      await this.prisma.userMembership.updateMany({
        where: { userId },
        data: { rcCustomerId: customerId },
      });
    }
    if (purchases.length > 0) {
      await this.prisma.$transaction(purchases.map((purchase) => this.prisma.membershipPurchase.upsert({
        where: { rcSubscriptionId: purchase.id },
        create: {
          userId,
          rcSubscriptionId: purchase.id,
          kind: purchase.kind,
          purchasedAt: new Date(purchase.purchasedAt),
          expiresAt: purchase.expiresAt ? new Date(purchase.expiresAt) : null,
        },
        update: {
          userId,
          kind: purchase.kind,
          purchasedAt: new Date(purchase.purchasedAt),
          expiresAt: purchase.expiresAt ? new Date(purchase.expiresAt) : null,
        },
      })));
    }
    return purchases;
  }

  private async loadCustomerPurchases(userId: string): Promise<{
    customerId: string | null;
    purchases: Array<{ id: string; kind: 'monthly' | 'yearly'; purchasedAt: string; expiresAt: string | null }>;
  } | null> {
    if (!this.apiKey || !process.env.REVENUECAT_PROJECT_ID) return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(userId)}/subscriptions?limit=100`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!response.ok) {
        this.logger.warn(`RevenueCat 查询购买记录失败: userId=${userId}, status=${response.status}`);
        return null;
      }

      const data = await response.json() as any;
      const items = Array.isArray(data?.items) ? data.items : [];
      const productIds = Array.from(new Set(
        items
          .map((item: any) => item?.product_id)
          .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0),
      ));
      await Promise.all(productIds.map((productId) => this.getProductInfo(productId)));
      const customerId = items.find((item: any) => item?.customer_id)?.customer_id ?? null;

      return {
        customerId: customerId != null ? String(customerId) : null,
        purchases: items.flatMap((item: any) => {
          const info = typeof item?.product_id === 'string' ? this.productInfoCache.get(item.product_id) : undefined;
          const kind = this.cycleFromProduct(info?.storeIdentifier ?? null, info?.duration ?? null);
          const purchasedAt = this.toIso(item?.starts_at);
          const expiresAt = this.toIso(item?.ends_at ?? item?.current_period_ends_at);
          if (!kind || !purchasedAt || !item?.id) return [];
          return [{ id: String(item.id), kind, purchasedAt, expiresAt }];
        }).sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()),
      };
    } catch (error) {
      this.logger.error('RevenueCat 查询购买记录异常', error);
      return null;
    }
  }

  private async getProductInfo(productId: unknown) {
    if (typeof productId !== 'string' || !productId || !this.apiKey || !process.env.REVENUECAT_PROJECT_ID) return null;
    const cached = this.productInfoCache.get(productId);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/products/${encodeURIComponent(productId)}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!response.ok) return null;
      const product = await response.json() as any;
      const info = {
        storeIdentifier: typeof product?.store_identifier === 'string' ? product.store_identifier : null,
        duration: typeof product?.subscription?.duration === 'string' ? product.subscription.duration : null,
      };
      this.productInfoCache.set(productId, info);
      return info;
    } catch (error) {
      this.logger.warn(`RevenueCat 查询商品失败: productId=${productId}`);
      return null;
    }
  }

  private cycleFromProduct(storeIdentifier: string | null, duration: string | null): 'monthly' | 'yearly' | null {
    const id = storeIdentifier ?? '';
    if (id.includes('yearly') || id.includes('annual') || duration === 'P1Y') return 'yearly';
    if (id.includes('monthly') || duration === 'P1M') return 'monthly';
    return null;
  }

  /** 列出订阅用户。v2 客户列表用游标，这里最多取 200 条后在本地分页，并为当前页补上订阅。 */
  async listSubscribers(params: { page?: number; pageSize?: number }): Promise<{
    list: Array<{
      userId: string;
      aliasIds: string[];
      email: string | null;
      subscription: {
        storeProductId: string | null;
        productId: string | null;
        entitlementKeys: string[];
        status: string;
        givesAccess: boolean;
        autoRenewalStatus: string;
        environment: string | null;
        currentPeriodEndsAt: string | null;
        store: string;
        pendingProductStoreId: string | null;
      } | null;
    }>;
    total: number;
  } | null> {
    if (!this.apiKey || !process.env.REVENUECAT_PROJECT_ID) return null;

    try {
      const customers = await this.fetchCustomers();
      const { page = 1, pageSize = 20 } = params;
      const start = Math.max(0, (page - 1) * pageSize);
      const pageItems = customers.slice(start, start + pageSize);
      const list = await Promise.all(pageItems.map(async (customer) => {
        const summary = this.mapCustomerSummary(customer);
        const [subscriptions, aliasIds] = await Promise.all([
          this.fetchCustomerSubscriptions(summary.userId),
          this.fetchCustomerAliasIds(summary.userId),
        ]);
        const current = subscriptions.find((item) => item.givesAccess) ?? subscriptions[0] ?? null;
        const relatedIds = subscriptions.flatMap((item) => [item.customerId, item.originalCustomerId]);
        return {
          userId: summary.userId,
          aliasIds: Array.from(new Set([...aliasIds, ...relatedIds].filter((id): id is string => !!id && id !== summary.userId))),
          email: summary.email,
          subscription: current
            ? {
                storeProductId: current.storeProductId,
                productId: current.productId,
                entitlementKeys: current.entitlementKeys,
                status: current.status,
                givesAccess: current.givesAccess,
                autoRenewalStatus: current.autoRenewalStatus,
                environment: current.environment,
                currentPeriodEndsAt: current.currentPeriodEndsAt,
                store: current.store,
                pendingProductStoreId: current.pendingProductStoreId,
              }
            : null,
        };
      }));
      return { list, total: customers.length };
    } catch (error) {
      this.logger.error('RevenueCat 查询订阅列表异常', error);
      return null;
    }
  }

  /** 获取单个订阅用户详情，附带 v2 subscriptions。 */
  async getSubscriberDetail(userId: string): Promise<{
    userId: string;
    projectId: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    country: string | null;
    platform: string | null;
    platformVersion: string | null;
    appVersion: string | null;
    email: string | null;
    activeEntitlements: Array<{ entitlementId: string; expiresAt: string | null }>;
    subscriptions: Array<{
      id: string;
      status: string;
      givesAccess: boolean;
      pendingPayment: boolean;
      autoRenewalStatus: string;
      environment: string | null;
      store: string;
      country: string | null;
      productId: string | null;
      storeProductId: string | null;
      entitlementKeys: string[];
      startsAt: string | null;
      currentPeriodStartsAt: string | null;
      currentPeriodEndsAt: string | null;
      endsAt: string | null;
      storeSubscriptionIdentifier: string | null;
      ownership: string | null;
      managementUrl: string | null;
      pendingProductStoreId: string | null;
      totalRevenueUsd: { gross: number; commission: number; tax: number; proceeds: number } | null;
    }>;
  } | null> {
    if (!this.apiKey || !process.env.REVENUECAT_PROJECT_ID) return null;

    try {
      const customerResponse = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!customerResponse.ok) return null;

      const customer = await customerResponse.json() as any;
      return {
        ...this.mapCustomerSummary(customer),
        projectId: customer.project_id ?? null,
        subscriptions: (await this.fetchCustomerSubscriptions(userId)).sort((a, b) => {
          const aTime = new Date(a.startsAt || a.currentPeriodStartsAt || 0).getTime();
          const bTime = new Date(b.startsAt || b.currentPeriodStartsAt || 0).getTime();
          return bTime - aTime;
        }),
      };
    } catch (error) {
      this.logger.error('RevenueCat 查询订阅详情异常', error);
      return null;
    }
  }

  private async fetchCustomerAliasIds(userId: string): Promise<string[]> {
    if (!userId) return [];
    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(userId)}/aliases?limit=20`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!response.ok) return [];
      const data = await response.json() as any;
      const items = Array.isArray(data?.items) ? data.items : [];
      return items.map((item: any) => String(item?.id ?? '')).filter((id: string) => id && id !== userId);
    } catch {
      return [];
    }
  }

  private async fetchCustomerSubscriptions(userId: string) {
    if (!userId) return [];
    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(userId)}/subscriptions?limit=20`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!response.ok) return [];
      const data = await response.json() as any;
      const items = Array.isArray(data?.items) ? data.items : [];
      const subscriptions = items.map((item: any) => this.mapSubscription(item));
      await Promise.all(subscriptions.map(async (subscription) => {
        if (subscription.storeProductId || !subscription.productId) return;
        const product = await this.getProductInfo(subscription.productId);
        subscription.storeProductId = product?.storeIdentifier ?? null;
      }));
      return subscriptions;
    } catch {
      return [];
    }
  }

  private async fetchCustomers(): Promise<any[]> {
    const items: any[] = [];
    let startingAfter: string | undefined;

    for (let page = 0; page < 2 && items.length < 200; page += 1) {
      const query = new URLSearchParams({ limit: '100' });
      if (startingAfter) query.set('starting_after', startingAfter);
      const response = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers?${query}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`RevenueCat 查询订阅列表失败: ${response.status} ${err}`);
        if (items.length > 0) return items;
        throw new Error(`RevenueCat customers ${response.status}`);
      }
      const data = await response.json() as any;
      const batch = Array.isArray(data?.items) ? data.items : [];
      items.push(...batch);
      const lastId = batch[batch.length - 1]?.id;
      if (!data?.next_page || !lastId) break;
      startingAfter = String(lastId);
    }

    return items;
  }

  private mapCustomerSummary(customer: any) {
    const attributes = Array.isArray(customer?.attributes?.items) ? customer.attributes.items : [];
    const email = attributes.find((item: any) => item?.name === '$email')?.value ?? null;
    const entitlements = Array.isArray(customer?.active_entitlements?.items)
      ? customer.active_entitlements.items
      : [];
    return {
      userId: String(customer?.id ?? ''),
      firstSeenAt: this.toIso(customer?.first_seen_at),
      lastSeenAt: this.toIso(customer?.last_seen_at),
      country: customer?.last_seen_country ?? null,
      platform: customer?.last_seen_platform ?? null,
      platformVersion: customer?.last_seen_platform_version ?? null,
      appVersion: customer?.last_seen_app_version ?? null,
      email: typeof email === 'string' ? email : null,
      activeEntitlements: entitlements.map((item: any) => ({
        entitlementId: String(item?.entitlement_id ?? ''),
        expiresAt: this.toIso(item?.expires_at),
      })).filter((item: { entitlementId: string }) => item.entitlementId),
    };
  }

  private mapSubscription(item: any) {
    const entitlements = Array.isArray(item?.entitlements?.items) ? item.entitlements.items : [];
    const storeProductId = entitlements
      .flatMap((entitlement: any) => entitlement?.products?.items ?? [])
      .find((product: any) => product?.id === item?.product_id)
      ?.store_identifier ?? null;
    const revenue = item?.total_revenue_in_usd;
    return {
      id: String(item?.id ?? ''),
      customerId: item?.customer_id != null ? String(item.customer_id) : null,
      originalCustomerId: item?.original_customer_id != null ? String(item.original_customer_id) : null,
      status: String(item?.status ?? 'unknown'),
      givesAccess: item?.gives_access === true,
      pendingPayment: item?.pending_payment === true,
      autoRenewalStatus: String(item?.auto_renewal_status ?? ''),
      environment: item?.environment ?? null,
      store: item?.store ?? 'unknown',
      country: item?.country ?? null,
      productId: item?.product_id ?? null,
      storeProductId: storeProductId != null ? String(storeProductId) : null,
      entitlementKeys: entitlements.map((entitlement: any) => entitlement?.lookup_key).filter(Boolean),
      startsAt: this.toIso(item?.starts_at),
      currentPeriodStartsAt: this.toIso(item?.current_period_starts_at),
      currentPeriodEndsAt: this.toIso(item?.current_period_ends_at),
      endsAt: this.toIso(item?.ends_at),
      storeSubscriptionIdentifier: item?.store_subscription_identifier != null
        ? String(item.store_subscription_identifier)
        : null,
      ownership: item?.ownership ?? null,
      managementUrl: item?.management_url ?? null,
      pendingProductStoreId: item?.auto_renewal_status === 'will_change_product'
        ? item?.pending_changes?.product?.store_identifier ?? null
        : null,
      totalRevenueUsd: revenue && typeof revenue.gross === 'number'
        ? {
            gross: revenue.gross,
            commission: revenue.commission ?? 0,
            tax: revenue.tax ?? 0,
            proceeds: revenue.proceeds ?? 0,
          }
        : null,
    };
  }

  private toIso(value: unknown): string | null {
    return typeof value === 'number' && Number.isFinite(value) ? new Date(value).toISOString() : null;
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

    // End-of-access events must be recorded even if RevenueCat omits an
    // entitlement (or configuration has since changed). Returning 2xx before
    // recording makes that delivery unrecoverable because RevenueCat stops
    // retrying it.
    if (EXPIRED_EVENT_TYPES.has(eventType)) {
      return this.handleEndedWebhook(event, userId, eventType);
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

  private async handleEndedWebhook(event: RevenueCatWebhookEvent, userId: string, eventType: string) {
    const entitlementIds = this.getEntitlementIds(event);
    const plan = entitlementIds.length > 0
      ? await this.findPlanForEntitlements(entitlementIds)
      : null;
    const result = await this.recordAndApplyWebhook(
      event,
      userId,
      () => plan ? this.expiredStateFromWebhook(userId, plan.id, event, eventType) : null,
    );

    if (!result.duplicate && !plan) {
      await this.alerts.notify({
        key: 'revenuecat-ended-event-unmatched',
        title: 'RevenueCat 结束事件无法匹配会员计划',
        severity: 'warning',
        details: { userId, eventType, eventId: event.id, productId: event.product_id, entitlementIds },
        throttleSeconds: 24 * 60 * 60,
      });
      this.logger.warn(`RevenueCat ended webhook recorded without matching plan: type=${eventType}, userId=${userId}`);
    }
    return result;
  }

  recordWebhookFailure() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.webhookFailures.push(new Date());
    while (this.webhookFailures[0]?.getTime() < cutoff) this.webhookFailures.shift();
  }

  async checkWebhookFailureRate() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    while (this.webhookFailures[0]?.getTime() < cutoff.getTime()) this.webhookFailures.shift();
    const delivered = await this.prisma.revenueCatWebhookEvent.count({ where: { createdAt: { gte: cutoff } } });
    const failures = this.webhookFailures.length;
    const failureRate = failures / Math.max(delivered, 1);
    if (failures > 0 && failureRate > 0.05) {
      await this.alerts.notify({
        key: 'revenuecat-webhook-failure-rate',
        title: 'RevenueCat webhook 失败率过高',
        severity: 'critical',
        details: { windowHours: 24, failures, delivered, failureRate },
        throttleSeconds: 24 * 60 * 60,
      });
    }
    return { failures, delivered, failureRate };
  }

  /**
   * Compare currently active store-backed rows with RevenueCat. This is kept
   * separate from purchase sync: an empty or unavailable API response never
   * takes access away.
   */
  async reconcileActiveMemberships() {
    if (!this.apiKey || !process.env.REVENUECAT_PROJECT_ID) {
      return { scanned: 0, drifted: 0, reclaimed: 0, skipped: 'not-configured' as const };
    }
    const now = new Date();
    const configuredLimit = Number(process.env.REVENUECAT_RECONCILE_LIMIT || 100);
    const configuredPauseMs = Number(process.env.REVENUECAT_RECONCILE_INTERVAL_MS || 150);
    const limit = Number.isFinite(configuredLimit) ? Math.max(1, Math.min(configuredLimit, 500)) : 100;
    const pauseMs = Number.isFinite(configuredPauseMs) ? Math.max(0, configuredPauseMs) : 150;
    const autoReclaim = process.env.REVENUECAT_RECONCILE_AUTO_RECLAIM === 'true';
    const memberships = await this.prisma.userMembership.findMany({
      where: {
        status: 'active',
        expiredAt: { gt: now },
        OR: [{ originalTransactionId: { not: null } }, { rcProductId: { not: null } }],
      },
      take: limit,
      orderBy: { expiredAt: 'asc' },
      select: { id: true, userId: true, rcCustomerId: true, originalTransactionId: true, rcProductId: true, expiredAt: true },
    });
    const driftedUserIds: string[] = [];
    let reclaimed = 0;
    for (const membership of memberships) {
      const subscriptions = await this.loadSubscriptionsForReconciliation(membership.rcCustomerId || membership.userId);
      if (subscriptions) {
        const match = subscriptions.find((item) =>
          (membership.originalTransactionId && item.storeSubscriptionIdentifier === membership.originalTransactionId)
          || (membership.rcProductId && item.storeProductId === membership.rcProductId),
        );
        const hasOtherAccess = subscriptions.some((item) => item.givesAccess);
        const endsAt = match?.endsAt ? new Date(match.endsAt) : null;
        const endedEarly = match?.status === 'expired'
          && match.givesAccess === false
          && !hasOtherAccess
          && endsAt
          && !Number.isNaN(endsAt.getTime())
          && membership.expiredAt.getTime() - endsAt.getTime() > 5 * 60 * 1000;
        if (endedEarly && endsAt) {
          driftedUserIds.push(membership.userId);
          if (autoReclaim) {
            const updated = await this.prisma.userMembership.updateMany({
              where: { id: membership.id, status: 'active', expiredAt: { gt: new Date(endsAt.getTime() + 5 * 60 * 1000) } },
              data: { status: 'expired', autoRenew: false, expiredAt: endsAt },
            });
            reclaimed += updated.count;
          }
        }
      }
      if (pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    if (driftedUserIds.length > 0) {
      await this.alerts.notify({
        key: 'revenuecat-membership-drift',
        title: '本地会员仍有效但商店订阅已提前结束',
        severity: 'critical',
        details: { scanned: memberships.length, drifted: driftedUserIds.length, reclaimed, autoReclaim, userIds: driftedUserIds.slice(0, 20) },
        throttleSeconds: 24 * 60 * 60,
      });
    }
    return { scanned: memberships.length, drifted: driftedUserIds.length, reclaimed };
  }

  private async loadSubscriptionsForReconciliation(customerId: string): Promise<Array<{ status: string; givesAccess: boolean; storeSubscriptionIdentifier: string | null; storeProductId: string | null; endsAt: string | null }> | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${process.env.REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(customerId)}/subscriptions?limit=100`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      if (!response.ok) {
        this.logger.warn(`RevenueCat 对账查询失败: customerId=${customerId}, status=${response.status}`);
        return null;
      }
      const data = await response.json() as any;
      if (!Array.isArray(data?.items)) return null;
      const subscriptions = data.items.map((item: any) => this.mapSubscription(item));
      await Promise.all(subscriptions.map(async (subscription) => {
        if (!subscription.storeProductId && subscription.productId) {
          subscription.storeProductId = (await this.getProductInfo(subscription.productId))?.storeIdentifier ?? null;
        }
      }));
      return subscriptions.map((item) => ({
        status: item.status,
        givesAccess: item.givesAccess,
        storeSubscriptionIdentifier: item.storeSubscriptionIdentifier,
        storeProductId: item.storeProductId,
        endsAt: item.endsAt || item.currentPeriodEndsAt,
      }));
    } catch (error) {
      this.logger.warn(`RevenueCat 对账查询异常: customerId=${customerId}`);
      return null;
    }
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

    // A late cancellation for the replaced monthly product has an earlier
    // expiration and a different store product. A refund of the current
    // product also expires earlier, so only the other product is ignored.
    const replacedProduct = !!params.productId
      && !!existing?.rcProductId
      && params.productId !== existing.rcProductId;
    if (
      isWebhook &&
      params.status !== 'active' &&
      existing?.status === 'active' &&
      existing.expiredAt > params.expiresAt &&
      replacedProduct
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
          rcCustomerId: params.rcCustomerId || params.userId,
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
          rcCustomerId: params.rcCustomerId || params.userId,
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
