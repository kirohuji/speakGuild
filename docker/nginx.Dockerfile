FROM node:22-alpine AS frontend-builder

WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm config set registry ${NPM_REGISTRY}
RUN pnpm install --frozen-lockfile

COPY apps/frontend apps/frontend

ARG VITE_API_BASE_URL=/api/v1/guide-exam
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm --filter @guideready/frontend build

FROM nginx:1.27-alpine AS runner

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80
