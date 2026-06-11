# 腾讯云短信（SMS）接入方案

> 版本：v1.0 | 日期：2026-06-11 | 基于腾讯云 SMS API v2021-01-11

---

## 一、背景与目标

### 当前状态

项目已使用 Better Auth 的 `phoneNumber` 插件实现手机验证码登录流程，但 `sendOTP` 回调仅打印日志（DEV-MOCK 模式），未真正发送短信。

```typescript
// apps/backend/src/modules/auth/auth.ts（现状）
phoneNumber({
  sendOTP({ phoneNumber: phone, code }) {
    console.log(`[DEV-MOCK][Phone OTP] phone=${phone} otp=${code}`);
  },
})
```

### 目标

将 `sendOTP` 回调对接腾讯云短信服务，实现**真实短信验证码下发**。

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端（Web / Capacitor）                │
│                                                         │
│  authClient.phoneNumber.sendOtp({ phoneNumber })        │
│       ↓                                                 │
│  POST /api/auth/phone-number/send-otp                   │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  NestJS 后端（auth.ts）                   │
│                                                         │
│  Better Auth phoneNumber Plugin                         │
│    └─ sendOTP({ phoneNumber, code })                    │
│         └─ TencentSmsService.send(phone, code)          │
│              └─ 腾讯云 SMS API v2021-01-11               │
│                   SendSms 接口                           │
└─────────────────────────────────────────────────────────┘
```

**关键点：**
- 短信发送是**纯后端行为**，前端和 Capacitor 无需任何改动
- 验证码由 Better Auth 自动生成（6 位数字），我们只需负责发送
- 验证码校验由 Better Auth 内置逻辑处理，无需额外开发

---

## 三、腾讯云 SMS API 概述

### API 版本

使用最新版本 **v2021-01-11**（`SendSms` 接口）。

### 关键参数

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `PhoneNumberSet` | ✅ | E.164 格式手机号数组 | `["+8613800000000"]` |
| `SmsSdkAppId` | ✅ | 短信应用 ID | `1400xxxxxx` |
| `SignName` | ✅ | 已审核的短信签名 | `漫语町` |
| `TemplateId` | ✅ | 已审核的正文模板 ID | `1234567` |
| `TemplateParamSet` | 视模板而定 | 模板参数数组（验证码） | `["123456"]` |

### 调用限制

- 默认 QPS：3000 次/秒
- 单次最多 200 个手机号
- 验证码模板变量仅支持 0-6 位纯数字
- 30 秒内同一手机号仅允许发送 1 条

### 关键错误码

| 错误码 | 含义 |
|--------|------|
| `Ok` | 发送成功 |
| `FailedOperation.PhoneNumberInBlacklist` | 手机号在免打扰名单 |
| `FailedOperation.TemplateParamSetNotMatchApprovedTemplate` | 模板参数数量/格式不匹配 |
| `FailedOperation.SignatureIncorrectOrUnapproved` | 签名未审批 |
| `LimitExceeded.PhoneNumberThirtySecondLimit` | 30 秒内重复发送 |

---

## 四、技术选型

### SDK 选择

使用腾讯云官方 Node.js SDK 的产品特定包：

```bash
pnpm --filter @manyu/backend add tencentcloud-sdk-nodejs-sms
```

**选择理由：**
- 官方维护，API 版本同步更新
- 内置 TC3-HMAC-SHA256 签名，无需手写
- TypeScript 类型支持完整
- 包体积小（仅 SMS 模块，约 200KB）

### 凭证复用

项目已在多处使用腾讯云 API（COS、STT），`TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` 可直接复用。短信新增的变量：

| 环境变量 | 说明 | 获取位置 |
|----------|------|----------|
| `TENCENT_SECRET_ID` | 已有，复用 | 腾讯云访问管理 |
| `TENCENT_SECRET_KEY` | 已有，复用 | 腾讯云访问管理 |
| `TENCENT_REGION` | 已有，复用（默认 `ap-guangzhou`） | — |
| `TENCENT_SMS_APP_ID` | 🆕 短信应用 ID | 短信控制台 → 应用管理 |
| `TENCENT_SMS_SIGN_NAME` | 🆕 短信签名内容 | 短信控制台 → 签名管理 |
| `TENCENT_SMS_TEMPLATE_ID` | 🆕 短信模板 ID | 短信控制台 → 正文模板管理 |

---

## 五、实现方案

### 5.1 新建文件：`apps/backend/src/modules/auth/sms/tencent-sms.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';

// 使用腾讯云官方 SMS SDK
const tencentSms = require('tencentcloud-sdk-nodejs-sms');
const SmsClient = tencentSms.sms.v20210111.Client;

@Injectable()
export class TencentSmsService {
  private readonly logger = new Logger(TencentSmsService.name);
  private client: InstanceType<typeof SmsClient> | null = null;

  constructor() {
    const secretId = process.env.TENCENT_SECRET_ID?.trim();
    const secretKey = process.env.TENCENT_SECRET_KEY?.trim();

    if (!secretId || !secretKey) {
      this.logger.warn('TENCENT_SECRET_ID or TENCENT_SECRET_KEY not configured, SMS will be disabled');
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
  }

  /**
   * 发送短信验证码
   * @param phoneNumber E.164 格式手机号，如 +8613800000000
   * @param code 6 位验证码
   * @returns 是否发送成功
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(`[SMS] Client not initialized, skip sending to ${phoneNumber}`);
      return false;
    }

    const appId = process.env.TENCENT_SMS_APP_ID?.trim();
    const signName = process.env.TENCENT_SMS_SIGN_NAME?.trim();
    const templateId = process.env.TENCENT_SMS_TEMPLATE_ID?.trim();

    if (!appId || !signName || !templateId) {
      this.logger.warn(
        `[SMS] Missing config: appId=${!!appId} signName=${!!signName} templateId=${!!templateId}`,
      );
      return false;
    }

    // 规范化手机号：确保带 +86 前缀
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      const response = await this.client.SendSms({
        PhoneNumberSet: [normalizedPhone],
        SmsSdkAppId: appId,
        SignName: signName,
        TemplateId: templateId,
        TemplateParamSet: [code],
      });

      const status = response.SendStatusSet?.[0];
      if (status?.Code === 'Ok') {
        this.logger.log(`[SMS] Sent to ${normalizedPhone}, serial=${status.SerialNo}`);
        return true;
      }

      this.logger.error(
        `[SMS] Failed to send to ${normalizedPhone}: [${status?.Code}] ${status?.Message}`,
      );
      return false;
    } catch (error: any) {
      this.logger.error(`[SMS] Exception sending to ${normalizedPhone}: ${error.message}`);
      return false;
    }
  }

  /**
   * 规范化手机号为 E.164 格式
   * 输入可能是：+8613800000000 / 008613800000000 / 13800000000
   */
  private normalizePhoneNumber(phone: string): string {
    // 去掉空格和横线
    let cleaned = phone.replace(/[\s-]/g, '');

    // 已经是 +86 开头，直接返回
    if (cleaned.startsWith('+86')) return cleaned;

    // 0086 开头，转为 +86
    if (cleaned.startsWith('0086')) return '+86' + cleaned.slice(4);

    // 纯 11 位数字，加上 +86
    if (/^\d{11}$/.test(cleaned)) return '+86' + cleaned;

    // 其他情况原样返回
    return cleaned;
  }
}
```

### 5.2 修改文件：`apps/backend/src/modules/auth/auth.ts`

在 `phoneNumber` 插件的 `sendOTP` 回调中调用 `TencentSmsService`：

```typescript
// 新增 import
import { TencentSmsService } from './sms/tencent-sms.service';

const smsService = new TencentSmsService();

// 在 phoneNumber 插件中：
phoneNumber({
  async sendOTP({ phoneNumber: phone, code }) {
    // 尝试真实发送，失败时打印日志用于调试
    const sent = await smsService.sendVerificationCode(phone, code);
    if (!sent) {
      console.log(`[SMS-FALLBACK][Phone OTP] phone=${phone} otp=${code}`);
    }
  },
  signUpOnVerification: {
    getTempEmail: (phone) => `${phone}@temp.local`,
    getTempName: (phone) => phone,
  },
}),
```

### 5.3 环境变量

在 `docs/deploy-env-reference.md` 新增 **十二、腾讯云短信（SMS）** 章节。

---

## 六、模板配置指南

### 6.1 签名申请

1. 登录 [腾讯云短信控制台](https://console.cloud.tencent.com/smsv2)
2. 国内短信 → 签名管理 → 创建签名
3. 签名类型选择「App」
4. 签名内容：如 `漫语町`
5. 上传证明材料（App 截图等）
6. 等待审核（通常 2 小时内）

### 6.2 正文模板申请

1. 国内短信 → 正文模板管理 → 创建正文模板
2. 模板类型选择「验证码」
3. 模板内容示例：`您的验证码是：{1}，{2}分钟内有效。`
4. 变量 `{1}` 对应 `TemplateParamSet` 的第一个元素（验证码）
5. 申请说明填写：用于 App 用户手机号验证登录

> ⚠️ **注意**：模板中的变量个数必须与 `TemplateParamSet` 数组长度一致，否则会报错 `FailedOperation.TemplateParamSetNotMatchApprovedTemplate`。

---

## 七、安全与风控

### 7.1 Better Auth 内置防护

Better Auth 的 `phoneNumber` 插件自带以下安全机制：

- **频率限制**：同一手机号 60 秒内只能请求一次验证码
- **验证码有效期**：5 分钟过期
- **错误次数限制**：连续错误 5 次后锁定

### 7.2 腾讯云侧防护

- 30 秒内同一手机号只发 1 条
- 1 小时内同一手机号最多 5 条
- 单日同一手机号最多 10 条

### 7.3 建议额外防护

- 前端按钮 60 秒倒计时（已实现）
- 按 IP 限流（可通过 Nginx 或后端中间件）
- 图形验证码（可选，后续版本考虑）

---

## 八、测试验证

### 8.1 本地开发

未配置 `TENCENT_SMS_*` 变量时，自动回退到控制台打印模式，不影响开发流程：

```
[SMS-FALLBACK][Phone OTP] phone=+8613800000000 otp=123456
```

### 8.2 联调测试

配置真实腾讯云凭证后，可以：

1. 使用自己的手机号注册/登录
2. 检查是否收到短信
3. 输入验证码完成验证
4. 查看后端日志确认发送状态

### 8.3 错误排查

| 现象 | 检查项 |
|------|--------|
| 收不到短信 | 1. 签名/模板是否审核通过<br>2. 手机号格式是否正确<br>3. 是否在免打扰名单 |
| 报签名错误 | 签名内容是否与控制台完全一致（包括空格、符号） |
| 报模板错误 | 模板参数个数是否与 `TemplateParamSet` 一致 |

---

## 九、文件变更清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| 🆕 新建 | `apps/backend/src/modules/auth/sms/tencent-sms.service.ts` | 腾讯云短信发送服务 |
| ✏️ 修改 | `apps/backend/src/modules/auth/auth.ts` | 接入 `sendOTP` 回调 |
| ✏️ 修改 | `docs/deploy-env-reference.md` | 新增 SMS 环境变量文档 |
| 📦 依赖 | `apps/backend/package.json` | 新增 `tencentcloud-sdk-nodejs-sms` |

---

## 十、上线 Checklist

- [ ] 腾讯云短信签名审核通过
- [ ] 腾讯云短信正文模板审核通过
- [ ] GitHub Actions Secrets 配置 `TENCENT_SMS_APP_ID`
- [ ] GitHub Actions Secrets 配置 `TENCENT_SMS_SIGN_NAME`
- [ ] GitHub Actions Secrets 配置 `TENCENT_SMS_TEMPLATE_ID`
- [ ] `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` 已配置（复用现有）
- [ ] 部署后在生产环境验证短信发送
- [ ] 监控短信发送成功率（腾讯云控制台可查看）
