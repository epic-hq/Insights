# Use Node.js 24 Alpine for smaller image size
FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate BAML client
RUN corepack enable pnpm && pnpm run baml-generate

# Build the application
RUN pnpm run build

# Install dotenvx
RUN curl -sfS https://dotenvx.sh/install.sh | sh

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 reactrouter

# Copy built application
COPY --from=builder --chown=reactrouter:nodejs /app/build ./build
COPY --from=builder --chown=reactrouter:nodejs /app/package.json ./package.json
COPY --from=builder --chown=reactrouter:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install only production dependencies
RUN corepack enable pnpm && pnpm i --frozen-lockfile --prod

USER reactrouter

# Expose the port the app runs on
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["dotenvx", "run", "--", "pnpm", "start"]
