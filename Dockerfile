# syntax=docker/dockerfile:1.7-labs

############################
# Base & shared settings
############################
ARG NODE_VERSION=24-slim
FROM node:${NODE_VERSION} AS base
ENV NODE_ENV=production \
    PNPM_HOME=/root/.local/share/pnpm \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm
WORKDIR /app

############################
# Build
############################
FROM base AS build
# OS build deps only here (kept out of final image)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY package.json pnpm-lock.yaml ./
# Install all deps (including dev deps for build)
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile
# App source
COPY . .
# Ensure Mastra artifacts directory always exists to unblock downstream copy steps
RUN mkdir -p .mastra
# ---- your generation & build steps
RUN pnpm run baml-generate && pnpm run build

############################
# Prune to prod deps only
############################
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
# Only production deps + runtime tools
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
    pnpm install --prod --frozen-lockfile \
    && pnpm add concurrently mastra@0.10.21

############################
# Runtime (slim)
############################
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NODE_OPTIONS=--max_old_space_size=1024 \
    MASTRA_DB_PATH=/app/data/mastra.db

# Install pnpm and dotenvx for runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -sfS https://dotenvx.sh/install.sh | sh \
  && chown node:node /usr/local/bin/dotenvx \
  && npm install -g pnpm \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy prod node_modules and lockfiles
COPY --from=prod-deps /app/package.json /app/pnpm-lock.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy built assets only
COPY --from=build /app/build ./build
COPY --from=build /app/public ./public
COPY --from=build /app/.mastra ./.mastra

# Minimal runtime data dir
RUN mkdir -p /app/data
# Copy production env file for dotenvx
COPY --chown=node:node .env.production ./.env.production

# Prefer running as non-root
USER node
EXPOSE 3000

# Using shell-installed dotenvx with proper permissions
CMD ["/usr/local/bin/dotenvx", "run", "-f", ".env.production", "--", "npx", "concurrently", "-n", "App,Mastra", "--c", "green,cyan", "pnpm", "start", "npx", "mastra", "dev", "--dir", "app/mastra"]
