# 漫语町（Manyu）

一个围绕真实场景、表达训练与沉浸式剧情构建的英语学习应用。项目同时提供 Web/iOS 学习端、内容与运营后台、NestJS API 服务，以及独立的公司官网。

> 当前仓库处于持续开发阶段，默认配置主要面向本地开发和内部部署。第三方登录、语音、AI、支付、对象存储等能力需要单独配置相应服务。

## 核心能力

- 场景化英语学习、每日练习与间隔复习
- 词汇、语块、表达库和学习笔记本
- AI 口语/写作反馈，以及 STT、TTS 多服务商接入
- 基于 Ink + PixiJS 的互动剧情与地图探索
- 离线学习包、本地 SQLite、同步队列与移动端 OTA 更新
- 剧本创作、作品社区、成就、积分、排行榜和会员体系
- 学习内容、词典、AI 模型、用户、订单等运营后台
- Web、Capacitor iOS 客户端和响应式公司官网

## 技术栈

| 层级 | 主要技术 |
| --- | --- |
| 学习端 | React 19、TypeScript、Vite、Tailwind CSS、Radix UI、Zustand |
| 移动端 | Capacitor 8、SQLite、原生登录/通知/音频、RevenueCat |
| 互动内容 | InkJS、PixiJS、Remotion |
| 后端 | NestJS 10、Prisma 6、Better Auth、BullMQ、Socket.IO |
| 数据与队列 | PostgreSQL 16、Redis |
| 部署 | Docker Compose、Nginx |

## 仓库结构

```text
.
├─ apps/
│  ├─ frontend/       # 学习端、管理后台及 Capacitor iOS 工程
│  ├─ backend/        # NestJS API、Prisma Schema 与种子数据
│  └─ company/        # 公司官网
├─ docker/            # 后端、前端镜像与 Nginx 配置
├─ docs/              # 产品、内容、移动端和部署文档
├─ patches/           # pnpm patchedDependencies 补丁
├─ docker-compose.yml
└─ pnpm-workspace.yaml
```

## 开始开发

### 环境要求

- Node.js 22 或更高版本
- pnpm 9 或更高版本
- PostgreSQL 16（推荐）
- Redis 7（后台任务队列需要）
- Docker 与 Docker Compose（可选）
- macOS + Xcode（仅构建 iOS 客户端时需要）

### 1. 安装依赖

```bash
corepack enable
pnpm install
```

### 2. 准备本地服务

可以通过 Compose 启动 PostgreSQL：

```bash
docker compose up -d db
```

Compose 将主机的 `6432` 端口映射到 PostgreSQL 的 `5432`。Redis 尚未包含在当前 Compose 文件中，请使用本地 Redis，或单独启动一个开发实例：

```bash
docker run -d --name manyu-redis -p 6379:6379 redis:7-alpine
```

### 3. 配置环境变量

复制后端和前端示例文件：

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Windows PowerShell：

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/frontend/.env.example apps/frontend/.env
```

如果数据库由上面的 Compose 命令启动，请将 `apps/backend/.env` 中的关键配置调整为：

```dotenv
DATABASE_URL=postgresql://manyu:manyu@localhost:6432/manyu
REDIS_URL=redis://127.0.0.1:6379
BETTER_AUTH_SECRET=请替换为至少32位的随机字符串
```

前端默认连接 `http://localhost:3001`，通常无需修改。完整变量含义参见 [部署环境变量参考](docs/部署环境变量参考.md)。所有密钥都应保存在本地 `.env` 或部署平台中，不要提交到 Git。

### 4. 初始化数据库

当前仓库没有提交 Prisma migrations，本地首次启动使用 `db push` 同步 Schema：

```bash
pnpm --filter @manyu/backend prisma:generate
pnpm --filter @manyu/backend exec prisma db push
pnpm --filter @manyu/backend prisma:seed
```

种子数据会创建仅供本地开发使用的账号：

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 管理员 | `admin@engjourney.local` | `admin123456` |
| 普通用户 | `user@engjourney.local` | `user123456` |

请勿在公网或生产环境中继续使用这些默认凭据。

### 5. 启动项目

同时启动全部 workspace：

```bash
pnpm dev
```

也可以分别启动：

```bash
pnpm dev:backend
pnpm dev:frontend
pnpm dev:company
```

默认访问地址：

| 服务 | 地址 |
| --- | --- |
| 学习端 | <http://localhost:5173> |
| 公司官网 | <http://localhost:5174> |
| 后端 API | <http://localhost:3001/api/v1/manyu> |
| 健康检查 | <http://localhost:3001/api/v1/manyu/health> |
| Better Auth | <http://localhost:3001/api/auth> |

## 常用命令

```bash
# 构建所有 workspace
pnpm build

# TypeScript 类型检查
pnpm typecheck

# 仅构建某个应用
pnpm --filter @manyu/frontend build
pnpm --filter @manyu/backend build
pnpm build:company

# 前端端到端测试
pnpm --filter @manyu/frontend test:e2e

# 打开 Playwright 测试界面
pnpm --filter @manyu/frontend test:e2e:ui
```

## iOS 开发

首次准备或依赖变更后同步原生工程：

```bash
pnpm --filter @manyu/frontend cap:sync:ios
pnpm --filter @manyu/frontend cap:open:ios
```

需要真机热更新时，可在执行 Vite 的同时设置 `CAP_LIVE_RELOAD_URL`。Apple 登录、Universal Links、推送通知、微信 SDK 和签名能力仍需在 Xcode 与对应平台后台完成配置。

更多离线与播放器设计见 [离线学习与沉浸式播放器手册](docs/离线学习与沉浸式播放器手册.md)，移动端注意事项见 [移动端性能体检与优化建议](docs/移动端性能体检与优化建议.md)。

## Docker 部署

1. 从根目录的 `.env.example` 创建 `.env`，填入生产环境变量。
2. 将证书放入 `SSL_DEPLOY` 指向的目录，并确认域名与 `docker/nginx.conf` 一致。
3. 准备可由容器访问的 Redis，并正确配置 `REDIS_URL`。
4. 构建并启动服务：

```bash
docker compose up -d --build
```

当前 Compose 会启动 PostgreSQL、后端和 Nginx，但不会自动执行数据库 Schema 迁移，也不包含 Redis 服务。生产发布前应建立正式的 Prisma migration 流程，并根据实际域名调整 Nginx、CORS、认证回调与移动端 Universal Links 配置。

## 相关文档

- [剧情内容与 Ink 剧本指南](docs/剧情内容与Ink剧本指南.md)
- [交互式探索地图技术方案](docs/交互式探索地图技术方案.md)
- [教学文档生成与课程约束设计](docs/教学文档生成与课程约束设计.md)
- [会员额度与生产运营手册](docs/会员额度与生产运营手册.md)
- [部署环境变量参考](docs/部署环境变量参考.md)

## 安全提示

- 不要提交 `.env`、私钥、支付证书、云服务密钥或真实用户数据。
- 正式环境必须替换默认认证密钥与测试账号密码。
- AI、语音、支付、短信和对象存储均为可选集成；未配置时，对应功能可能不可用。
- 对外部署前请复核 CORS、限流、上传限制、Webhook 鉴权和 Nginx TLS 配置。

## License

仓库目前未声明开源许可证。未经项目所有者明确授权，不应将代码视为可自由复制、修改或分发的开源软件。
