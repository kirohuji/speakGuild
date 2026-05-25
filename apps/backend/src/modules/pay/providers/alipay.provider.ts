import { Injectable, Logger } from '@nestjs/common';
import { AlipaySdk } from 'alipay-sdk';
import { v4 as uuid } from 'uuid';
import type {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  CallbackVerification,
} from './payment-provider.interface';

/** 确保密钥是 PEM 格式（带 BEGIN/END 头尾） */
function toPem(key: string, label: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  const trimmed = key.trim();
  if (trimmed.startsWith('-----BEGIN')) return trimmed;
  const body = trimmed.match(/.{1,64}/g)?.join('\n') || trimmed;
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

/** 去掉老版本的 /gateway.do 后缀，v4 用 endpoint 不带路径 */
function cleanEndpoint(raw: string): string {
  return raw.replace(/\/gateway\.do\/?$/, '');
}

@Injectable()
export class AlipayProvider implements PaymentProvider {
  private readonly logger = new Logger(AlipayProvider.name);
  private readonly client: AlipaySdk | null = null;

  constructor() {
    const appId = process.env.ALIPAY_APP_ID;
    const privateKey = process.env.ALIPAY_PRIVATE_KEY;
    const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;

    if (appId && privateKey && alipayPublicKey) {
      try {
        this.client = new AlipaySdk({
          appId,
          privateKey: toPem(privateKey, 'PRIVATE KEY'),
          alipayPublicKey: toPem(alipayPublicKey, 'PUBLIC KEY'),
          gateway: cleanEndpoint(process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do'),
          signType: (process.env.ALIPAY_SIGN_TYPE as 'RSA2' | 'RSA') || 'RSA2',
          keyType: (process.env.ALIPAY_KEY_TYPE as 'PKCS1' | 'PKCS8') || 'PKCS8',
        });
        this.logger.log('支付宝 SDK 已初始化');
      } catch (e) {
        this.logger.error('支付宝 SDK 初始化失败', e);
      }
    } else {
      this.logger.warn('支付宝配置不完整，将使用模拟模式');
    }
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!this.client) {
      return this.createMockPayment(params);
    }

    try {
      const bizContent = {
        out_trade_no: params.orderNo,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        total_amount: (params.amount / 100).toFixed(2),
        subject: params.subject,
        body: params.body || params.subject,
      };

      // v4: pageExecute GET 模式返回支付链接 URL
      const payUrl = (this.client as any).pageExecute('alipay.trade.page.pay', 'GET', {
        bizContent,
        notifyUrl: params.notifyUrl,
        returnUrl: params.returnUrl,
      }) as string;

      this.logger.log(`[支付宝] 支付链接已生成: ${params.orderNo}`);

      return { success: true, payUrl };
    } catch (error) {
      this.logger.error('支付宝创建支付失败', error);
      return { success: false };
    }
  }

  async verifyCallback(params: Record<string, any>): Promise<CallbackVerification> {
    if (!this.client) {
      return this.verifyMockCallback(params);
    }

    try {
      const signVerified = this.client.checkNotifySign(params);
      if (!signVerified) {
        return { success: false, orderNo: '', paymentRef: '', amount: 0, rawData: params };
      }

      const tradeStatus = params.trade_status;
      if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
        return { success: false, orderNo: '', paymentRef: '', amount: 0, rawData: params };
      }

      return {
        success: true,
        orderNo: params.out_trade_no,
        paymentRef: params.trade_no,
        amount: Math.round(parseFloat(params.total_amount || '0') * 100),
        rawData: params,
      };
    } catch (error) {
      this.logger.error('支付宝回调验证失败', error);
      return { success: false, orderNo: '', paymentRef: '', amount: 0, rawData: params };
    }
  }

  private async createMockPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    this.logger.log(`[Mock 支付宝] 创建支付: ${params.orderNo}, ¥${(params.amount / 100).toFixed(2)}`);
    return {
      success: true,
      payUrl: `/api/pay/mock-alipay?orderNo=${params.orderNo}&amount=${(params.amount / 100).toFixed(2)}&subject=${encodeURIComponent(params.subject)}`,
    };
  }

  private async verifyMockCallback(params: Record<string, any>): Promise<CallbackVerification> {
    this.logger.log(`[Mock 支付宝] 回调: orderNo=${params.out_trade_no}`);
    return {
      success: true,
      orderNo: params.out_trade_no,
      paymentRef: `mock_alipay_${uuid().slice(0, 16)}`,
      amount: Math.round(parseFloat(params.total_amount || '0') * 100),
      rawData: params,
    };
  }
}
