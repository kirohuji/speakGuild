FROM node:22-alpine AS company-builder

WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/company/package.json apps/company/package.json

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm config set registry ${NPM_REGISTRY}
RUN pnpm install --frozen-lockfile

COPY apps/frontend apps/frontend
COPY apps/company apps/company

RUN pnpm --filter @manyu/company build

FROM nginx:1.27-alpine AS runner

COPY docker/company-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=company-builder /app/apps/company/dist /usr/share/nginx/html

EXPOSE 80 443
