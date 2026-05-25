import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  CallbackVerification,
} from './payment-provider.interface';

@Injectable()
export class WechatProvider implements PaymentProvider {
  private readonly logger = new Logger(WechatProvider.name);
  private readonly client: any = null;

  constructor() {
    const appId = process.env.WECHAT_PAY_APP_ID;
    const mchId = process.env.WECHAT_PAY_MCH_ID;
    const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY;
    const privateKey = process.env.WECHAT_PAY_PRIVATE_KEY;
    const serialNo = process.env.WECHAT_PAY_SERIAL_NO;

    if (appId && mchId && apiV3Key && privateKey && serialNo) {
      try {
        const WxPay = (require('wechatpay-node-v3') as any).default || require('wechatpay-node-v3');
        this.client = new WxPay({
          appid: appId,
          mchid: mchId,
          privateKey: Buffer.from(privateKey, 'utf-8'),
          serial_no: serialNo,
          apiv3_privateKey: apiV3Key,
        } as any);
        this.logger.log('微信支付 SDK 已初始化');
      } catch (e) {
        this.logger.warn('微信支付 SDK 加载失败，将使用模拟模式');
      }
    } else {
      this.logger.warn('微信支付配置不完整，将使用模拟模式');
    }
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!this.client) {
      return this.createMockPayment(params);
    }

    try {
      const result = await (this.client as any).transactions_native({
        description: params.subject,
        out_trade_no: params.orderNo,
        notify_url: params.notifyUrl,
        amount: {
          total: params.amount,
          currency: 'CNY',
        },
      });

      if (result.status === 200 && result.data?.code_url) {
        return {
          success: true,
          qrCode: result.data.code_url,
        };
      }

      return { success: false };
    } catch (error) {
      this.logger.error('微信支付创建支付失败', error);
      return { success: false };
    }
  }

  async verifyCallback(params: Record<string, any>): Promise<CallbackVerification> {
    if (!this.client) {
      return this.verifyMockCallback(params);
    }

    try {
      const headers = params.headers || {};
      const sign = headers['wechatpay-signature'];
      const timestamp = headers['wechatpay-timestamp'];
      const nonce = headers['wechatpay-nonce'];
      const bodyStr = typeof params.body === 'string' ? params.body : JSON.stringify(params.body || {});

      if (!sign || !timestamp || !nonce || !bodyStr) {
        return { success: false, orderNo: '', paymentRef: '', amount: 0, rawData: params };
      }

      const verified = (this.client as any).verifySign({
        signature: sign,
        timestamp,
        nonce,
        body: bodyStr,
        serial: headers['wechatpay-serial'],
        apiSecret: process.env.WECHAT_PAY_API_V3_KEY || '',
      } as any);

      if (!verified) {
        return { success: false, orderNo: '', paymentRef: '', amount: 0, rawData: params };
      }

      const resource = params.body?.resource;
      if (!resource || resource.trade_state !== 'SUCCESS') {
        return { success: false, orderNo: '', paymentRef: '', amount: 0, rawData: params };
      }

      const decrypted = (this.client as any).decrypt ? (this.client as any).decrypt(resource) : JSON.stringify(resource);
      const data = JSON.parse(decrypted);

      return {
        success: true,
        orderNo: data.out_trade_no,
        paymentRef: data.transaction_id,
        amount: data.amount?.total || 0,
        rawData: params,
      };
    } catch (error) {
      this.logger.error('微信支付回调验证失败', error);
      return { success: false, orderNo: '', paymentRef: '', amount: 0, rawData: params };
    }
  }

  private async createMockPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    this.logger.log(`[Mock 微信支付] 创建支付: ${params.orderNo}, ¥${(params.amount / 100).toFixed(2)}`);
    return {
      success: true,
      qrCode: `wechat://mock-pay?orderNo=${params.orderNo}&amount=${(params.amount / 100).toFixed(2)}`,
    };
  }

  private async verifyMockCallback(params: Record<string, any>): Promise<CallbackVerification> {
    this.logger.log(`[Mock 微信支付] 回调: orderNo=${params.out_trade_no}`);
    return {
      success: true,
      orderNo: params.out_trade_no,
      paymentRef: `mock_wechat_${uuid().slice(0, 16)}`,
      amount: parseInt(params.amount || '0', 10),
      rawData: params,
    };
  }
}
