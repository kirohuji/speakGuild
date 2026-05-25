export interface CreatePaymentParams {
  orderNo: string;
  amount: number;       // 分
  subject: string;
  body?: string;
  notifyUrl: string;
  returnUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  payUrl?: string;       // 支付宝跳转 URL
  qrCode?: string;       // 微信 code_url
  paymentRef?: string;
}

export interface CallbackVerification {
  success: boolean;
  orderNo: string;
  paymentRef: string;    // 支付网关交易号
  amount: number;        // 分
  rawData: any;
}

export interface PaymentProvider {
  /** 创建支付订单，返回支付链接或二维码 */
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;

  /** 验证支付回调签名和合法性 */
  verifyCallback(params: Record<string, any>): Promise<CallbackVerification>;
}
