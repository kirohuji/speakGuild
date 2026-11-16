# 漫语町（Manyu）

漫语町是一款面向中文用户的英语学习产品。它不把学习停留在“看完一节课”，而是将场景内容、知识点收集、专项练习、间隔复习、AI 反馈和剧情体验串成一条可持续的学习路径。

仓库包含 Web / iOS 学习端、内容与运营后台、NestJS API、教学内容源文件和公司官网。项目仍在持续开发，第三方登录、AI、语音、支付、对象存储等线上能力需要单独配置。

## 产品在解决什么问题

传统英语学习内容往往分散在课程、单词本、口语工具和复习应用之间，用户很难把“理解内容”“记住表达”和“真正使用”连起来。漫语町以学习包为内容载体，以个人学习库和每日任务为长期记忆层，再用口语、写作、阅读、听力及互动剧情提供真实输出场景。

一条典型的学习路径是：

1. 从学习计划中选择一个主题学习包。
2. 阅读教学内容，认识其中的词汇、语块和句型。
3. 将有价值的表达收进自己的学习库。
4. 完成口语、写作、阅读、听力或知识点专项练习。
5. 在“今日任务”中按学习进度复习、重练错题。
6. 查看 AI 反馈与历史记录，持续巩固薄弱项。
7. 在剧情包和互动探索中综合运用已经学过的表达。

## 核心业务

### 学习内容与训练

- **学习包**：按场景、主题或课程组织教学正文、词汇、语块、句型和练习话题。
- **多种训练模式**：覆盖口语对话、写作、阅读、听力、知识点练习和小说阅读。
- **今日任务**：结合当前学习包、掌握状态和复习计划生成每日练习，支持错题重练和练习记录回看。
- **个人学习库**：用户可收藏词汇、语块和句型，按笔记本管理，并在多端之间同步。
- **学习反馈**：保留作答、录音、练习轮次和 AI 点评，形成可追踪的学习历史。

### 沉浸式剧情

- **剧情包**：以章节、角色、地点和教学材料组织连续内容。
- **互动叙事**：使用 Ink 驱动分支剧情，结合 PixiJS 地图进行场景探索。
- **NQTR 体验**：把时间、任务、活动与英语练习结合，支持章节存档和世界状态推进。
- **剧本练习与作品**：用户可进行角色对话练习，保存音视频作品，并参与作品互动。

### 成长与留存

- 每日签到、学习统计和连续学习记录。
- 成就、积分、排行榜和邀请奖励。
- 站内通知、特殊活动通知与用户反馈。
- 免费、标准、高级三档会员，以及月付 / 年付订阅和权益控制。

### 离线与移动学习

iOS 客户端支持学习包下载、本地 SQLite、离线作答、录音保存和恢复联网后的增量同步。内容资源、离线模型和应用 OTA 包均由后台发布，客户端会校验版本与文件完整性。离线设计详见 [离线学习与沉浸式播放器手册](docs/离线学习与沉浸式播放器手册.md)。

## 内容与运营闭环

内容团队在后台维护学习包、教学正文、训练话题、词典和剧情资产；审核后生成可发布版本及离线包。用户的学习记录、反馈、会员状态和内容表现再回流到运营后台，用于内容迭代和用户运营。

```text
内容编写 → 材料关联 → 练习配置 → 审核发布 → 用户学习
   ↑                                          ↓
内容迭代 ← 数据统计 / 用户反馈 / AI 洞察 ← 学习记录
```

后台当前覆盖：

- 学习包、练习话题、每日一句、词典和内容语料库；
- 剧情章节、角色、配音、地图、Ink 脚本和共享资产；
- 学习包 / 剧情包发布、增量包、文件资源与移动端 OTA；
- 用户、会员、账单、通知、反馈、成就和主题；
- AI 模型、离线模型、后台任务与数据统计。

教学内容以 Markdown 进入版本管理。`apps/docs-md` 中的正文文件与 `.learning.md` 练习配置可和数据库双向同步，详细规则见 [教学文档目录说明](apps/docs-md/README.md) 与 [学习配置写作规则](docs/learning-md-writing-rules.md)。

## 系统组成

| 应用 | 面向对象 | 职责 |
| --- | --- | --- |
| `apps/frontend` | 学习者、内容编辑、运营人员 | Web / iOS 学习端及管理后台 |
| `apps/backend` | 全部客户端 | 认证、内容、学习记录、同步、AI、支付和运营 API |
| `apps/docs-md` | 教研与内容团队 | 教学正文和练习配置的版本化内容源 |
| `apps/company` | 访客 | 品牌与公司官网 |

核心技术包括 React 19、TypeScript、Vite、Capacitor 8、NestJS 10、Prisma 6、PostgreSQL 16、Redis、Better Auth、BullMQ、InkJS 和 PixiJS。

## 本地开发

### 环境要求

- Node.js 22+
- pnpm 9+
- PostgreSQL 16
- Redis 7
- Docker / Docker Compose（可选）
- macOS + Xcode（仅 iOS 原生构建需要）

### 1. 安装依赖

```bash
corepack enable
pnpm install
```

### 2. 启动依赖服务

仓库的 Compose 配置可以启动 PostgreSQL，并将其映射到本机 `6432` 端口：

```bash
docker compose up -d db
docker run -d --name manyu-redis -p 6379:6379 redis:7-alpine
```

### 3. 配置环境变量

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Windows PowerShell：

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/frontend/.env.example apps/frontend/.env
```

使用上述本地服务时，后端至少需要：

```dotenv
DATABASE_URL=postgresql://manyu:manyu@localhost:6432/manyu
REDIS_URL=redis://127.0.0.1:6379
BETTER_AUTH_SECRET=请替换为至少32位的随机字符串
```

完整配置见 [部署环境变量参考](docs/部署环境变量参考.md)。密钥只能保存在本地环境或部署平台中，不要提交到 Git。

### 4. 初始化数据库

本地开发可直接同步当前 Prisma Schema 并写入种子数据：

```bash
pnpm --filter @manyu/backend prisma:generate
pnpm --filter @manyu/backend exec prisma db push
pnpm --filter @manyu/backend prisma:seed
```

种子账号仅供本地使用：

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 管理员 | `admin@engjourney.local` | `admin123456` |
| 普通用户 | `user@engjourney.local` | `user123456` |

### 5. 启动应用

```bash
# 启动全部 workspace
pnpm dev

# 或分别启动
pnpm dev:backend
pnpm dev:frontend
pnpm dev:company
```

| 服务 | 默认地址 |
| --- | --- |
| 学习端 / 管理后台 | <http://localhost:5173> |
| 公司官网 | <http://localhost:5174> |
| 后端 API | <http://localhost:3001/api/v1/manyu> |
| 健康检查 | <http://localhost:3001/api/v1/manyu/health> |

## 常用命令

```bash
pnpm build                  # 构建全部 workspace
pnpm typecheck              # TypeScript 类型检查
pnpm lint                   # 运行各 workspace lint
pnpm docs:export            # 从数据库导出教学内容
pnpm docs:sync -- --dry-run # 预览 Markdown 写回数据库的变更
pnpm docs:sync              # 将教学内容写回数据库
pnpm --filter @manyu/frontend test:e2e
```

iOS 工程同步：

```bash
pnpm --filter @manyu/frontend cap:sync:ios
pnpm --filter @manyu/frontend cap:open:ios
```

## 业务文档

- [漫语町剧本包设计与剧情圣经](docs/漫语町剧本包设计与剧情圣经.md)
- [剧本与叙事剧情包方案](docs/剧本-叙事剧情包方案.md)
- [NQTR 架构与流程说明](docs/NQTR架构与流程说明.md)
- [离线学习与沉浸式播放器手册](docs/离线学习与沉浸式播放器手册.md)
- [会员付费与 RevenueCat 技术实现](docs/会员付费与RevenueCat技术实现.md)
- [离线学习统计](docs/offline-learning-statistics.md)
- [同步内容更新设计](docs/sync-content-update-design.md)
- [部署环境变量参考](docs/部署环境变量参考.md)

## 安全与发布

- 不要提交 `.env`、私钥、支付证书、云服务密钥或真实用户数据。
- 正式环境必须替换测试账号、认证密钥和默认域名配置。
- AI、语音、支付、短信、对象存储等属于可选集成，缺少配置时相应业务不可用。
- 对外发布前应复核数据库迁移、CORS、限流、上传限制、Webhook 鉴权、TLS 和移动端 Universal Links。

## License

仓库目前未声明开源许可证。未经项目所有者明确授权，不应将代码视为可自由复制、修改或分发的开源软件。
