# 部署环境变量参考文档

> 对应 `.github/workflows/deploy.yml` 中所有环境变量的说明。
> 配置入口：GitHub 仓库 → **Settings → Secrets and variables → Actions**

---

## 🏷️ 三种分类

| 分类 | 含义 | 配置位置 |
| --- | --- | --- |
| 🔴 **Required（Secret）** | 必须配置，无默认值 | GitHub Secrets |
| 🟢 **With defaults** | 有默认值，可用 GitHub Variable 覆盖 | GitHub Variables（可选） |
| 🟡 **Optional（Secret）** | 可选，空值 = 对应功能不可用 | GitHub Secrets（可选） |

---

## 一、SSH 连接（部署用）

| 变量 | 分类 | 说明 | 示例值 |
|---|---|---|---|
| `SSH_HOST` | 🔴 Secret | 服务器 IP 或域名 | `123.45.67.89` |
| `SSH_USER` | 🔴 Secret | SSH 登录用户名 | `root` / `deploy` |
| `SSH_PASSWORD` | 🔴 Secret | SSH 登录密码 | `your-password` |
| `SSH_PORT` | 🟢 默认 `22` | SSH 端口 | `22`（用 Variable 覆盖） |
| `DEPLOY_DIR` | 🟢 默认 `/home/deploy/manyu` | 服务器部署路径，需提前创建好此目录 | `/home/deploy/manyu` |

---

## 二、应用核心（Backend）

| 变量 | 分类 | 说明 | 示例值 |
|---|---|---|---|
| `FRONTEND_URL` | 🔴 Secret | 前端域名，用于 CORS + 支付回调 | `https://your-domain.com` |
| `BACKEND_URL` | 🔴 Secret | 后端域名，用于支付回调 URL 拼接 | `https://api.your-domain.com` |
| `SSL_DEPLOY` | 🟢 默认 `./ssl` | SSL 证书目录，映射到 nginx 容器 | `./ssl` |

**代码引用：**
- `FRONTEND_URL` → CORS 配置、支付 `returnUrl`
- `BACKEND_URL` → `pay.service.ts:55,254` 支付回调地址

---

## 三、Better Auth（认证）

| 变量 | 分类 | 说明 | 获取方式 |
|---|---|---|---|
| `BETTER_AUTH_URL` | 🔴 Secret | 认证服务地址，同 `BACKEND_URL` | — |
| `BETTER_AUTH_SECRET` | 🔴 Secret | 32 位随机密钥 | `openssl rand -hex 32` |
| `WECHAT_CLIENT_ID` | 🟡 Secret | 微信开放平台 AppID（扫码登录） | [微信开放平台](https://open.weixin.qq.com/) |
| `WECHAT_CLIENT_SECRET` | 🟡 Secret | 微信开放平台 AppSecret | 同上 |
| `WECHAT_NATIVE_APP_ID` | 🟡 Secret | 微信开放平台移动应用 AppID（原生 App 登录） | 同上 |
| `WECHAT_NATIVE_APP_SECRET` | 🟡 Secret | 微信开放平台移动应用 AppSecret | 同上 |

原生 App 构建时，前端还需要在 `apps/frontend/.env` 中配置 `VITE_WECHAT_APP_ID` 和 `VITE_WECHAT_UNIVERSAL_LINK`。PC 网页扫码登录不使用这两个变量。

---

## 四、TTS（语音合成）

| 变量 | 分类 | 说明 | 获取方式 |
|---|---|---|---|
| `MINIMAX_API_KEY` | 🔴 Secret | MiniMax TTS 的 API Key | [MiniMax 平台](https://platform.minimaxi.com/) |
| `MINIMAX_GROUP_ID` | 🔴 Secret | MiniMax 分组 ID | 同上 |
| `CARTESIA_API_KEY` | 🟡 Secret | Cartesia TTS（支持词级时间戳） | [Cartesia](https://cartesia.ai/) |

> MiniMax 为核心 TTS，必须配置。Cartesia 为可选增强。

---

## 五、Whisper（语音转文字）

| 变量 | 分类 | 说明 | 默认值 |
|---|---|---|---|
| `WHISPER_INFERENCE_URL` | 🟡 Secret | 推理服务地址 | 空（功能禁用） |
| `WHISPER_LANGUAGE` | 🟢 Variable | 识别语言代码 | `en` |
| `WHISPER_TIMEOUT_MS` | 🟢 Variable | 请求超时（毫秒） | `300000` |

> 代码引用：`tts.service.ts:154`

---

## 六、AI 评分

| 变量 | 分类 | 说明 | 获取方式 |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | 🔴 Secret | DeepSeek API Key | [DeepSeek 平台](https://platform.deepseek.com/) |

---

## 七、腾讯云 COS（对象存储）

| 变量 | 分类 | 说明 | 默认值 |
|---|---|---|---|
| `COS_BUCKET` | 🔴 Secret | 存储桶名称 | — |
| `COS_REGION` | 🟢 Variable | 存储桶地域 | `ap-shanghai` |
| `COS_SECRET_ID` | 🔴 Secret | 腾讯云 API 密钥 ID | — |
| `COS_SECRET_KEY` | 🔴 Secret | 腾讯云 API 密钥 Key | — |
| `COS_PRIVATE_URL_EXPIRES_SECONDS` | 🟢 Variable | 私有链接有效期（秒） | `3600` |

> 密钥获取：[访问管理](https://console.cloud.tencent.com/cam/capi)

---

## 八、腾讯云语音识别（STT）

| 变量 | 分类 | 说明 | 默认值 |
|---|---|---|---|
| `TENCENT_SECRET_ID` | 🟡 Secret | 腾讯云 API 密钥 ID（与 COS/SMS 共用） | — |
| `TENCENT_SECRET_KEY` | 🟡 Secret | 腾讯云 API 密钥 Key（与 COS/SMS 共用） | — |
| `TENCENT_REGION` | 🟢 Variable | 语音识别服务地域 | `ap-guangzhou` |
| `STT_PROVIDER` | 🟢 Variable | STT 供应商选择 | `whisper`（可选 `tencent`） |

> 代码引用：`tts.service.ts:45`、`tencent-stt.provider.ts`。未配置 Tencent 密钥时自动回退 Whisper。

---

## 九、腾讯云短信（SMS）

用于手机验证码登录、手机号绑定等场景。基于 Better Auth `phoneNumber` 插件 + 腾讯云 SMS API v2021-01-11。

| 变量 | 分类 | 说明 | 获取方式 |
|---|---|---|---|
| `TENCENT_SECRET_ID` | 🟡 Secret | 腾讯云 API 密钥 ID（复用 COS/STT 的即可） | [访问管理](https://console.cloud.tencent.com/cam/capi) |
| `TENCENT_SECRET_KEY` | 🟡 Secret | 腾讯云 API 密钥 Key（复用 COS/STT 的即可） | 同上 |
| `TENCENT_REGION` | 🟢 Variable | 短信服务地域 | `ap-guangzhou` |
| `TENCENT_SMS_APP_ID` | 🟡 Secret | 短信应用 SdkAppId | [短信控制台](https://console.cloud.tencent.com/smsv2) → 应用管理 |
| `TENCENT_SMS_SIGN_NAME` | 🟡 Secret | 短信签名内容（已审核通过） | 短信控制台 → 签名管理 |
| `TENCENT_SMS_TEMPLATE_ID` | 🟡 Secret | 短信正文模板 ID（已审核通过） | 短信控制台 → 正文模板管理 |

> **注意**：
> - `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` 与 COS、STT 共用同一对密钥
> - 未配置 `TENCENT_SMS_*` 时，验证码会自动降级为控制台打印（不影响本地开发）
> - 代码引用：`tencent-sms.service.ts`、`auth.ts:phoneNumber.sendOTP`

---

## 十、支付（可选，未配置时 Mock 模式）

### 支付宝

| 变量 | 分类 | 说明 | 默认值 |
|---|---|---|---|
| `ALIPAY_APP_ID` | 🟡 Secret | APPID | — |
| `ALIPAY_PRIVATE_KEY` | 🟡 Secret | 商户私钥（PEM） | — |
| `ALIPAY_PUBLIC_KEY` | 🟡 Secret | 支付宝公钥（PEM） | — |
| `ALIPAY_GATEWAY` | 🟢 Variable | 网关地址 | `https://openapi.alipay.com/gateway.do` |
| `ALIPAY_SIGN_TYPE` | 🟢 Variable | 签名算法 | `RSA2` |
| `ALIPAY_KEY_TYPE` | 🟢 Variable | 密钥格式 | `PKCS8` |

### 微信支付

| 变量 | 分类 | 说明 |
|---|---|---|
| `WECHAT_PAY_APP_ID` | 🟡 Secret | 微信商户 AppID |
| `WECHAT_PAY_MCH_ID` | 🟡 Secret | 商户号 ID |
| `WECHAT_PAY_API_V3_KEY` | 🟡 Secret | API v3 密钥 |
| `WECHAT_PAY_PRIVATE_KEY` | 🟡 Secret | 证书私钥（PEM） |
| `WECHAT_PAY_SERIAL_NO` | 🟡 Secret | 证书序列号 |
| `WECHAT_PAY_PUBLIC_KEY` | 🟡 Secret | 微信支付平台公钥 |

> 申请地址：[微信支付商户平台](https://pay.weixin.qq.com/)

---

## 十一、RevenueCat（跨端会员同步，可选）

| 变量 | 分类 | 说明 | 获取方式 |
|---|---|---|---|
| `VITE_REVENUECAT_API_KEY` | 🔴 Secret | 前端 RevenueCat iOS Public SDK Key，用于 Capacitor App 初始化 Purchases SDK | RevenueCat 项目 App 设置 |
| `REVENUECAT_API_KEY` | 🟡 Secret | RevenueCat Secret Key | [RevenueCat](https://www.revenuecat.com/) |
| `REVENUECAT_PROJECT_ID` | 🟡 Secret | 项目 ID | 同上 |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | 🔴 Secret | RevenueCat webhook 的 Authorization token；配置后后端只接受 `Bearer <token>` 或原值匹配的回调 | RevenueCat webhook 自定义 Authorization |

> iOS 订阅 webhook 地址：`POST /api/v1/manyu/pay/revenuecat/webhook`。生产环境必须配置 `REVENUECAT_WEBHOOK_AUTHORIZATION`，本地未配置时后端会放行并打印警告。

---

## 十二、文件清理任务

| 变量 | 分类 | 说明 | 默认值 |
|---|---|---|---|
| `FILE_CLEANUP_CRON` | 🟢 Variable | 清理定时 Cron | `0 30 3 * * *`（每天 3:30） |
| `FILE_CLEANUP_DAYS` | 🟢 Variable | 保留天数 | `7` |
| `FILE_CLEANUP_DRY_RUN` | 🟢 Variable | 仅日志不删除 | `false` |

---

## 十三、Universal Links（iOS 第三方服务回调）

用于支付宝支付、微信登录/分享等场景的 Universal Links 配置。

### 服务端配置（已就绪）

| 配置项 | 说明 | 文件位置 |
|---|---|---|
| `apple-app-site-association` (AASA) | Apple 验证 Universal Links 的 JSON 文件 | `apps/frontend/public/.well-known/apple-app-site-association` |
| Nginx 响应 | 以 `application/json` 提供 AASA 文件 | `docker/nginx.conf` |
| 前端构建 | Vite 自动将 `public/.well-known/` 复制到 `dist/` | `apps/frontend/public/.well-known/` |

**AASA 文件路径：** `https://hope.lourd.top/.well-known/apple-app-site-association`

> ⚠️ **部署前必须修改：** 打开 `apps/frontend/public/.well-known/apple-app-site-association`，将 `YOUR_TEAM_ID` 替换为实际的 Apple Developer Team ID（如 `ABCDEF1234`）。

### ⚡ AASA 端口 443 要求（重要）

Apple 的 CDN 在验证 Universal Links 时，**只会通过标准 HTTPS 端口（443）** 获取 `apple-app-site-association` 文件。已通过以下方式解决：

1. **Nginx** 额外监听 `8443` 端口（`docker/nginx.conf`）
2. **docker-compose** 新增映射 `"443:8443"` — 宿主机 443 端口指向容器 8443 端口
3. `8443` 端口与 `443` 端口共享同一套 Nginx 配置（SSL + 路由），均能正常提供 AASA 文件

> **验证方法**：部署后用浏览器或 `curl` 访问 `https://hope.lourd.top/.well-known/apple-app-site-association`，如果返回 JSON 内容则说明配置正确。

### Xcode 配置（手动步骤）

每次 `npx cap sync ios` 后，需在 Xcode 中：

1. 打开 `ios/App/App.xcworkspace`
2. 选择 **App Target → Signing & Capabilities → + Capability → Associated Domains**
3. 添加以下条目：
   - `applinks:hope.lourd.top` （用于支付宝/微信等所有 Universal Links 场景）
4. 重新打包归档（Archive）并发布

> 也可直接编辑 `ios/App/App.entitlements` 文件（如果已存在）添加：
> ```xml
> <key>com.apple.developer.associated-domains</key>
> <array>
>     <string>applinks:hope.lourd.top</string>
> </array>
> ```

### 支付宝开放平台配置

在 [支付宝开放平台](https://open.alipay.com/) 的应用详情页：

1. **应用平台信息 → iOS** → 填写：
   - **Bundle ID**：`lourd.manyu.app`
   - **Universal Links**：`https://hope.lourd.top:3605/`
2. 保存后，测试链接是否生效：
   - 在 Safari 中输入 `https://hope.lourd.top:3605/` 下拉查看是否有「在"漫语町"中打开」入口

### 微信开放平台配置

在 [微信开放平台](https://open.weixin.qq.com/) 的移动应用详情页：

1. **开发信息 → iOS 应用** → 填写：
   - **Universal Links**：`https://hope.lourd.top/wechat/`
2. 确保 `apps/frontend/capacitor.config.ts` 中 `CapacitorWechat` 插件的 `universalLink` 与上一致
3. 确保前端 `.env` 中 `VITE_WECHAT_UNIVERSAL_LINK` 与上一致

---

## 快速配置指南

### 必须配为 Secrets（🔴 共 14 项）

```text
SSH_HOST
SSH_USER
SSH_PASSWORD
FRONTEND_URL
BACKEND_URL
BETTER_AUTH_URL
BETTER_AUTH_SECRET
MINIMAX_API_KEY
MINIMAX_GROUP_ID
DEEPSEEK_API_KEY
COS_BUCKET
COS_SECRET_ID
COS_SECRET_KEY
```

### 有默认值（🟢 共 11 项，无需配置）

它们已经写死了默认值，如需覆盖 → 设为 GitHub **Variables**：

```text
SSH_PORT=22
WHISPER_LANGUAGE=en
WHISPER_TIMEOUT_MS=300000
COS_REGION=ap-shanghai
COS_PRIVATE_URL_EXPIRES_SECONDS=3600
FILE_CLEANUP_CRON=0 30 3 * * *
FILE_CLEANUP_DAYS=7
FILE_CLEANUP_DRY_RUN=false
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_SIGN_TYPE=RSA2
ALIPAY_KEY_TYPE=PKCS8
SSL_DEPLOY=./ssl
```

### 可选（🟡 共 16 项，用到再配）

```text
WECHAT_CLIENT_ID / WECHAT_CLIENT_SECRET    # 微信扫码登录
WECHAT_NATIVE_APP_ID / WECHAT_NATIVE_APP_SECRET # 原生 App 微信登录
CARTESIA_API_KEY                            # 增强 TTS
WHISPER_INFERENCE_URL                       # 语音转写
ALIPAY_APP_ID / ...                         # 支付宝支付
WECHAT_PAY_APP_ID / ...                     # 微信支付
REVENUECAT_API_KEY / ...                    # RevenueCat 同步
```
