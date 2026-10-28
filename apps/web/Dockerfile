# syntax=docker/dockerfile:1

# The build context is the repository root. The web app compiles against @streamsync/shared, so
# the "..." filter builds that workspace dependency before the web app.
FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /repo

RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

# Vite reads these at build time and bakes them into the bundle.
ARG VITE_BACKEND_URL=http://localhost:5000
ARG VITE_ICE_SERVERS=
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_ICE_SERVERS=$VITE_ICE_SERVERS

RUN pnpm --filter @streamsync/web... run build

# Runtime stage: the static bundle behind nginx.
FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
