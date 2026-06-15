FROM node:22-alpine AS builder

WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm config set registry ${NPM_REGISTRY}
RUN pnpm install --frozen-lockfile

COPY apps/backend apps/backend

RUN pnpm --filter @manyu/backend prisma:generate
RUN pnpm --filter @manyu/backend build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ARG NPM_REGISTRY=https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm config set registry ${NPM_REGISTRY}
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/apps/backend/dist apps/backend/dist
COPY --from=builder /app/apps/backend/prisma apps/backend/prisma
COPY --from=builder /app/apps/backend/src apps/backend/src
COPY --from=builder /app/apps/backend/tsconfig.json apps/backend/tsconfig.json
COPY --from=builder /app/apps/backend/package.json apps/backend/package.json
RUN pnpm --filter @manyu/backend prisma:generate

WORKDIR /app/apps/backend

EXPOSE 3001

HEALTHCHECK --interval=60s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/manyu/ops/health || exit 1

# 启动时自动执行数据库迁移，然后启动应用
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
