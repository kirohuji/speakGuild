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

RUN pnpm --filter @manyu/frontend build

FROM nginx:1.27-alpine AS runner

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80
