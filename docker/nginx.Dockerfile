FROM node:22-alpine AS frontend-builder

WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm config set registry ${NPM_REGISTRY}
RUN pnpm install --frozen-lockfile

COPY apps/frontend apps/frontend

ARG VITE_API_BASE_URL=/api/v1/manyu
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

ARG VITE_APPLE_CLIENT_ID
ENV VITE_APPLE_CLIENT_ID=${VITE_APPLE_CLIENT_ID}

ARG VITE_XFD_API_KEY
ENV VITE_XFD_API_KEY=${VITE_XFD_API_KEY}

ARG VITE_MW_API_KEY
ENV VITE_MW_API_KEY=${VITE_MW_API_KEY}

ARG VITE_REVENUECAT_API_KEY
ENV VITE_REVENUECAT_API_KEY=${VITE_REVENUECAT_API_KEY}

ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

RUN pnpm --filter @manyu/frontend build

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

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/apps/frontend/dist /usr/share/nginx/html/hope
COPY --from=company-builder /app/apps/company/dist /usr/share/nginx/html/company

EXPOSE 80 443 3605
