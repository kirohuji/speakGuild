# 漫语町（ManYu）项目开发规范

> 本文件由 `.cursor/rules/` 迁移而来，GitHub Copilot 会自动读取。

---

## 项目定位与技术栈

ManYu（漫语町）是多语种全国导游资格面试练习平台，包含题库浏览、口语练习、AI 发音反馈、TTS 语音合成、模拟考试、会员系统等功能。

### 技术栈

- **前端**：React + TypeScript + shadcn/ui + Tailwind CSS + Zustand
- **后端**：NestJS + Prisma 6 + PostgreSQL 16
- **认证**：Better Auth
- **外部服务**：DeepSeek API（AI 评分）、MiniMax / Cartesia（TTS）、腾讯云 COS（对象存储）、Whisper（语音转文字）

### Monorepo 组织

- **包管理器**：pnpm workspace，两个包 `@manyu/backend` 和 `@manyu/frontend`
- **依赖隔离**：通过 `pnpm --filter` 精确安装，Docker 构建同样只安装目标子项目依赖
- **开发命令**：
  - `pnpm dev` — 前后端并行开发
  - `pnpm dev:backend` — 仅后端
  - `pnpm dev:frontend` — 仅前端

### 核心目录结构

```
manyu/
├── apps/backend/src/          # NestJS 后端（按功能域模块化）
│   ├── common/                # 公共层（filters/interceptors/prisma/response）
│   └── modules/               # 业务模块（auth/config-guide/question-bank/practice/...）
├── apps/frontend/src/         # React 前端
│   ├── features/              # 按功能域组织（每域含 api.ts + pages/）
│   ├── components/ui/         # shadcn/ui 组件
│   ├── components/common/     # 业务通用组件
│   ├── stores/                # Zustand 状态管理
│   ├── lib/                   # 工具库（request.ts/i18n/API 客户端）
│   └── providers/             # Context Provider
├── docs/                      # 项目文档
├── docker/                    # Dockerfile + Nginx 配置
└── docker-compose.yml
```

### 环境要求

- Node.js >= 22
- pnpm >= 9
- PostgreSQL >= 16
- TypeScript strict mode

---

## Git 提交规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <description>
```

### Type 类型

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（非新功能、非修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建工具、依赖更新等 |
| `ci` | CI/CD 变更 |

### Scope 示例

`backend` / `frontend` / `auth` / `practice` / `tts` / `ai` / `db`

### 分支管理

- `main` — 生产分支，push 触发 GitHub Actions 自动部署
- 功能分支从 `main` 拉出，完成后合并回 `main`
- 不要提交 `.env`、`node_modules/`、`dist/` 等

---

## NestJS 后端开发规范

### 模块化架构

- 每个功能域独立一个 NestJS 模块，位于 `modules/<feature>/`，必须含：
  - `<feature>.module.ts` — 模块定义
  - `<feature>.controller.ts` — 路由控制器
  - `<feature>.service.ts` — 业务逻辑
  - `dto/` — 请求/响应 DTO（使用 `class-validator` 装饰器校验）
- 生成新模块命令：
  ```bash
  nest g module modules/<new-module>
  nest g controller modules/<new-module>
  nest g service modules/<new-module>
  ```

### 认证模式

所有需要鉴权的业务路由使用 `requireAuthSession(request)` 从请求中提取用户身份：

```typescript
import { requireAuthSession } from './auth-utils';

@Controller('xxx')
export class XxxController {
  @Get()
  async getData(@Req() req: Request) {
    const session = await requireAuthSession(req);
    const userId = session.user.id;
  }
}
```

新增模块时，需在 `app.module.ts` 的 `imports` 中注册。

### DTO 校验

所有请求体 DTO 必须使用 `class-validator` 装饰器进行校验。ValidationPipe 全局生效。

### 公共层 (common/)

- `filters/` — 全局异常过滤器 `AllExceptionsFilter`
- `interceptors/` — 全局响应拦截器 `TransformInterceptor`
- `prisma/` — Prisma 数据库服务（唯一数据访问层）
- `response/` — 统一响应格式 `{ code, message, data }`

### 禁止事项

- 禁止在 Controller 中直接操作数据库，必须通过 Service 层
- 禁止绕过 PrismaService 使用原始 SQL（除非有充分理由）
- 禁止在模块间循环依赖，使用 forwardRef 谨慎处理

---

## API 设计规范

### 路由规范

- **业务 API 前缀**：`/api/v1/guide-exam`
- **认证路由**：`/api/auth/*`（Better Auth 原生路由，不走业务前缀）
- **请求方式**：RESTful (GET/POST/PATCH/DELETE)
- **认证方式**：`Authorization: Bearer <token>`（通过 `requireAuthSession` 提取）

### 统一响应格式

```typescript
// 成功
{ code: 200, message: "Success", data: T }

// 失败
{ code: 400, message: "错误描述", data: null }
```

`TransformInterceptor` 自动封装，已在 Controller 中手动封装的不会被二次封装。

### 流式响应 (SSE)

AI 反馈接口（`/practice-ai/feedback`）使用 SSE 流式响应，通过 Vercel AI SDK 的 `streamText` 实现。

### 文件上传

使用 `multer` 处理，COS 上传采用前端直传 + 后端回调确认模式（STS 临时密钥）。

### 禁止事项

- 禁止返回未封装的原始数据
- 禁止在 Controller 中直接调用外部 API（必须通过 Service）
- 禁止硬编码敏感信息（API Key、密钥等），统一使用环境变量

---

## Prisma 数据库规范

### 命名规范

- 表名：snake_case（如 `question_bank`）
- 模型名：PascalCase（如 `QuestionBank`）
- 枚举值：camelCase（如 `monthly`、`active`）

### 关系与删除策略

- 所有用户相关的关联表必须设置 `onDelete: Cascade`
- 使用复合唯一约束防止重复数据，典型组合：
  - `FavoriteQuestion`: `[userId, questionId]`
  - `VocabularyWord`: `[userId, term]`
  - `PracticeProgress`: `[userId, questionId]`
  - `DailyActivity`: `[userId, date]`
  - `QuestionAudio`: `[questionId, configHash]`

### 缓存与去重设计

- **TTS 缓存**：`configHash = SHA1(provider + model + voiceId + serializedParams)`，同一配置命中直接返回
- **文件去重**：`FileAsset` 以 `sha256` 为唯一键，通过 `refCount` 引用计数管理
- **引用计数清理**：`refCount=0` 且超期的文件由定时任务自动清理

### Schema 修改流程

```bash
cd apps/backend
pnpm prisma:migrate    # 创建迁移文件并应用
pnpm prisma:generate   # 重新生成 Prisma Client
```

修改 Schema 后必须运行 `prisma generate` 更新类型。新增枚举类型在 Schema 文件顶部统一定义。

---

## React 前端开发规范

### 目录组织

- 按功能域组织在 `features/` 下，每域包含：
  - `api/<feature>-api.ts` — API 调用函数
  - `pages/<feature>-page.tsx` — 页面组件
- 通用业务组件放 `components/common/`
- shadcn/ui 组件放 `components/ui/`

### 状态管理 (Zustand)

使用 Zustand 管理全局状态：
- `config.store` — 题库绑定配置（内存）
- `assets.store` — 收藏/生词列表
- `preferences.store` — 用户偏好（localStorage 持久化）

新增 Store 遵循按需订阅模式。

### HTTP 请求

- 统一使用 `lib/request.ts` 中的 Axios 实例，**不要直接使用 axios**
- 请求拦截器自动注入 Bearer Token（从 `localStorage('manyu-bearer-token')`）
- 响应拦截器自动解包 `data.data`，自动处理 401 跳转

### 认证相关

- `AuthRouteGuard` 组件包裹所有需要登录的路由
- 未认证用户自动重定向到 `#/auth/login`
- Token 存储在 localStorage 的 `manyu-bearer-token` 键

### 路由

- 使用 Hash 路由（兼容静态部署 + Capacitor iOS）
- 路由定义在 `App.tsx`

### Provider 链

层级顺序（不可颠倒）：
```
<ThemeProvider> → <AuthProvider> → <AuthRouteGuard> → <RouterProvider>
```

---

## shadcn/ui 组件规范

### 项目配置

- **style**: `default` | **baseColor**: `slate` | **iconLibrary**: `lucide-react`
- **组件路径别名**: `@/components/ui` | **工具函数**: `@/lib/cn`（使用 `cn()` 合并类名）
- **自定义注册表**: `@magicui` (https://magicui.design/r/{name})

### 语义化颜色（最重要）

始终使用 shadcn 语义化 CSS 变量，**禁止使用原生 Tailwind 颜色值**：

```tsx
// ✅ 正确
<div className="bg-background text-foreground" />
<p className="text-muted-foreground">次要文字</p>

// ❌ 错误
<div className="bg-white text-black" />
<p className="text-gray-500">次要文字</p>
```

### className 规范

- 仅用于布局，**不要用 className 覆盖组件的颜色或字体**
- **不使用 `space-x-*` / `space-y-*`**，统一用 `flex` + `gap-*`
- 宽高相等时用 `size-*` 简写（如 `size-10` 代替 `w-10 h-10`）
- **禁止手动设置 `dark:` 颜色覆盖**，始终用语义化 token
- 条件类名使用 `cn()` 函数
- 文本溢出使用 `truncate` 简写
- **禁止手动给叠加层组件设置 z-index**（Dialog、Sheet、Popover 等自带层级管理）

### 组件选择速查表

| 需求 | 应使用的组件 |
|---|---|
| 数据展示 | `Table`、`Card`、`Badge`、`Avatar` |
| 导航 | `Tabs`、`Breadcrumb`、`Pagination` |
| 弹窗/侧栏 | `Dialog`、`Sheet`、`Drawer` |
| 表单控件 | `Input`、`Select`、`Combobox`、`Switch`、`Checkbox`、`Textarea`、`Slider` |
| 2-5 项选项切换 | `ToggleGroup` + `ToggleGroupItem` |
| 菜单 | `DropdownMenu`、`ContextMenu` |
| 悬停/提示 | `Tooltip`、`HoverCard`、`Popover` |
| 反馈 | `sonner`（Toast）、`Alert`、`Progress`、`Skeleton` |
| 分隔线 | `Separator`（禁止用 `<hr>` 或 `<div className="border-t">`） |
| 加载占位 | `Skeleton`（禁止自定义 `animate-pulse` div） |

### 组件组合规范

- **Avatar 必须有 `AvatarFallback`**
- **Dialog / Sheet / Drawer 必须有标题**（`DialogTitle`、`SheetTitle`、`DrawerTitle`），仅视觉隐藏时加 `className="sr-only"`
- **Card 完整组合**：`CardHeader` → `CardTitle` → `CardDescription` → `CardContent` → `CardFooter`
- **`TabsTrigger` 必须在 `TabsList` 内**，**`SelectItem` 必须在 `SelectGroup` 内**
- **分组项必须在 Group 内**：`DropdownMenuItem` → `DropdownMenuGroup`、`CommandItem` → `CommandGroup`

### Button 加载状态

用 `Spinner` + `data-icon` + `disabled` 组合：

```tsx
<Button disabled={loading}>
  {loading && <Spinner data-icon="inline-start" />}
  {loading ? "提交中..." : "提交"}
</Button>
```

### 图标规范

- 图标在 `Button` 内必须加 `data-icon` 属性：`data-icon="inline-start"` 或 `data-icon="inline-end"`
- **不要在组件内部的图标上加尺寸类名**（不用 `size-4` / `w-4 h-4`），组件通过 CSS 自动处理

### 表单规范

使用 `FieldGroup` + `Field` 组合，不要用裸 `<div>` 加间距类：

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">邮箱</FieldLabel>
    <Input id="email" placeholder="请输入邮箱" />
  </Field>
</FieldGroup>
```

验证失败时：`Field` 上加 `data-invalid`，控件上加 `aria-invalid`。

### 添加组件后必须做的事

1. 检查新增文件的导入路径是否与项目别名匹配（`@/components/ui`）
2. 检查图标导入是否符合项目图标库（`lucide-react`）
3. 检查是否有缺失的子组件或错误的组合方式
4. 修复所有问题后再继续开发
