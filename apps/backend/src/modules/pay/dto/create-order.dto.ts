import { IsString, IsIn, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  planId: string;

  @IsIn(['alipay', 'wechat'])
  paymentMethod: 'alipay' | 'wechat';

  @IsIn(['monthly', 'yearly'])
  billingCycle: 'monthly' | 'yearly';
}

export class PaymentCallbackDto {
  /** 支付宝/微信回调的原始参数 */
  [key: string]: any;
}

export interface OrderResult {
  orderNo: string;
  amount: number;
  paymentMethod: string;
  payUrl?: string;       // 支付宝 PC 支付跳转 URL
  qrCode?: string;       // 微信扫码支付 code_url
  status: string;
}
