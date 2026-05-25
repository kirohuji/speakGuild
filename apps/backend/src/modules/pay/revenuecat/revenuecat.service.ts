import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  private readonly baseUrl = 'https://api.revenuecat.com/v2';
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.REVENUECAT_API_KEY;
    if (this.apiKey) {
      this.logger.log('RevenueCat 服务已初始化');
    } else {
      this.logger.warn('REVENUECAT_API_KEY 未配置，RevenueCat 同步将跳过');
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
}
