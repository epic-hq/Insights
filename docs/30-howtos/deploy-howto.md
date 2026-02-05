# Fly.io Deployment Guide for React Router 7 + BAML + dotenvx

This guide provides step-by-step instructions for deploying a React Router 7 application with BAML and dotenvx to Fly.io. It includes best practices, common issues, and troubleshooting steps based on our deployment experience.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Configuration](#project-configuration)
3. [Dockerfile Setup](#dockerfile-setup)
4. [Environment Variables](#environment-variables)
5. [Fly.io Configuration](#flyio-configuration)
6. [Deployment Process](#deployment-process)
7. [Health Checks](#health-checks)
8. [Troubleshooting](#troubleshooting)
9. [References](#references)

## Prerequisites

- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated
- [Docker](https://docs.docker.com/get-docker/) installed
- [dotenvx](https://dotenvx.com/docs/install) installed locally
- Git repository with your React Router 7 application

## Project Configuration

### Package.json Scripts

Ensure your `package.json` includes these scripts:

```json
"scripts": {
  "baml-generate": "baml-cli generate",
  "build": "pnpm run baml-generate && <your-build-command>",
  "start": "<your-start-command>"
}
```

### .gitignore Configuration

Configure `.gitignore` to track `.env.production` but ignore other environment files:

```
# Environment files
.env*
!.env.example
!.env.production
```

## Dockerfile Setup

Use this optimized Dockerfile for React Router 7 + BAML + dotenvx:
It runs `concurrently` to run both the app and mastra (pinned version)

```dockerfile
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
COPY package.json pnpm-lock.yaml ./
# Install all deps (including dev deps for build)
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile
# App source
COPY . .
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

# Small tools layer (optional)
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && curl -sfS https://dotenvx.sh/install.sh | sh \
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
# If you need env-in-image:
# COPY --chown=node:node .env.production ./.env.production

# Prefer running as non-root
USER node
EXPOSE 3000

# If you keep mastra + app in one container, ensure both are listed as prod deps.
# Recommend: add to package.json "dependencies": { "concurrently": "...", "mastra": "0.10.21" }
# Then:
CMD ["dotenvx", "run", "-f", ".env.production", "--", "npx", "concurrently", "-n", "App,Mastra", "--c", "green,cyan", "pnpm start", "npx", "mastra", "serve", "--dir", "app/mastra"]


```

### Key Dockerfile Considerations

1. **Base Image**: Use `node:24-slim` (Debian-based) instead of Alpine for BAML native binding compatibility
2. **Build Dependencies**: Install `python3`, `make`, `g++` for native module compilation
3. **Multi-Stage Build**: Separate build and runtime stages to minimize final image size
4. **Non-Root User**: Run as `node` user for security
5. **Cache Directory**: Create and set permissions for `.cache` directory to avoid Corepack permission issues
6. **Environment File**: Copy `.env.production` to the container for dotenvx

## Environment Variables

### Using dotenvx for Encrypted Environment Variables

1. Install dotenvx locally:

   ```bash
   curl -sfS https://dotenvx.sh/install.sh | sh
   ```

2. Create and encrypt your production environment file:

   ```bash
   dotenvx encrypt -f .env.production
   ```

3. Set the encryption key as a Fly.io secret:

   ```bash
   flyctl secrets set DOTENV_PRIVATE_KEY_PRODUCTION='your-key-here'
   ```

4. Reference: [dotenvx Fly.io Integration](https://dotenvx.com/docs/platforms/fly)

## Fly.io Configuration

Create a `fly.toml` file with the following configuration:

```toml
app = 'your-app-name'
primary_region = 'sjc'

[build]

[env]
  NODE_ENV = 'production'
  PORT = '3000'

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/healthcheck"
    protocol = "http"
    tls_skip_verify = false
    headers = { Host = "your-app-name.fly.dev" }

[machine]
  memory = '1gb'
  cpu_kind = 'shared'
  cpus = 1

[deploy]
  release_command = 'echo "Release command placeholder"'

[processes]
  app = 'dotenvx run -- pnpm start'
```

## Health Checks

Create a health check endpoint at `/healthcheck` to enable Fly.io monitoring. Be sure to set the route
in `routes.ts` route("healthcheck", "./routes/healthcheck.ts")

```typescript
// app/routes/healthcheck.ts
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  // Simple health check that returns 200 when the server is running
  return new Response('OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// No component needed for this route
export default function HealthCheck() {
  return null;
}
```

## Deployment Process

1. **Initialize Fly.io App** (first time only):

   ```bash
   flyctl launch
   ```

2. **Deploy Your Application**:

faster remote w/ cache reuse

   ```bash
   fly deploy --remote-only --build-arg BUILDKIT_INLINE_CACHE=1

  or fly deploy
   ```

3. **Monitor Deployment**:

   ```bash
   flyctl status
   flyctl logs
   ```

4. **Test Health Check**:

   ```bash
   curl https://your-app-name.fly.dev/healthcheck
   ```

## Troubleshooting

### Common Issues and Solutions

1. **BAML Native Binding Errors**
   - **Symptom**: Build fails with errors about missing native dependencies
   - **Solution**: Ensure you're using `node:24-slim` (Debian-based) instead of Alpine
   - **Fix**: Install required packages: `python3`, `make`, `g++`

2. **Missing .env.production File**
   - **Symptom**: `[MISSING_ENV_FILE] missing .env.production file (/app/.env.production)`
   - **Solution**: Ensure `.env.production` is tracked in git and copied in Dockerfile
   - **Fix**: Update `.gitignore` and add `COPY .env.production .env.production* ./` to Dockerfile

3. **Corepack Cache Permission Issues**
   - **Symptom**: `Error: EACCES: permission denied, mkdir '/nonexistent/.cache/node/corepack/v1'`
   - **Solution**: We did not have cache dir so removed command. Could be useful in future?

4. **dotenvx Not Found**
   - **Symptom**: Command not found errors for dotenvx
   - **Solution**: Install dotenvx in the runtime stage
   - **Fix**: Install curl and dotenvx in the Dockerfile

5. **Environment Variables Not Decrypted**
   - **Symptom**: Application fails due to missing environment variables
   - **Solution**: Ensure `DOTENV_PRIVATE_KEY_PRODUCTION` is set as a Fly.io secret and you are pointing to the correct file. explicitly set in Dockerfile run command
   - **Fix**: `CMD ["dotenvx", "run", "-f", ".env.production", "--", "pnpm", "start"]`
   - **Fix**: `flyctl secrets set DOTENV_PRIVATE_KEY_PRODUCTION='your-key-here'`

### Debugging Deployment

1. **Check Logs**:

   ```bash
   flyctl logs
   ```

2. **SSH into VM**:

   ```bash
   flyctl ssh console
   ```

3. **Restart App**:

   ```bash
   flyctl restart
   ```

## References

- [Fly.io Documentation](https://fly.io/docs/)
- [dotenvx Fly.io Integration](https://dotenvx.com/docs/platforms/fly)
- [React Router Documentation](https://reactrouter.com/en/main)
- [BAML Documentation](https://boundaryml.github.io/baml/)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
