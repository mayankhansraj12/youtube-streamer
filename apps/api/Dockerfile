# syntax=docker/dockerfile:1

# The build context is the repository root, so the whole workspace installs from its lockfile.
#
# Build stage: compile the shared contract and the API, then write a production-only copy of the
# API package to /app. pnpm links dependencies with absolute paths, so the copy is made at the
# same path the runtime stage uses.
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
RUN pnpm --filter @streamsync/api... run build \
 && pnpm --filter @streamsync/api deploy --prod /app

# Runtime stage: the compiled API and its production dependencies, nothing else.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app /app

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
